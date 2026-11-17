import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import {
  db,
  auth,
  isUserAdmin,
  getOwnerAuthHeaders,
  sanitizeForFirestore,
  withTimeout,
} from './firebase';
import {
  AdminSchedulerStatusResponse,
  NotificationDeviceSubscription,
  NotificationPermissionState,
  NotificationPreferencesRecord,
  RegisteredUserAnalyticsSummary,
  SchedulerRunRecord,
  UserNotificationItem,
} from '../types/jobSeeker';
import { Vacancy } from '../types/job';
import { RecommendedOpportunity } from '../utils/recommendationCore';

const DEVICE_ID_STORAGE_KEY = 'hopelandjobs_device_id';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.length >= 6) return existing;
    const created = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
}

export function getDeviceMetadata(): { deviceId: string; deviceLabel: string; platform: string } {
  const deviceId = getOrCreateDeviceId();
  if (typeof navigator === 'undefined') {
    return { deviceId, deviceLabel: 'Unknown Browser', platform: 'web' };
  }
  const ua = navigator.userAgent || '';
  const isAndroid = /android/i.test(ua);
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isEdge = /edg/i.test(ua);
  const isChrome = /chrome|crios/i.test(ua) && !isEdge;
  const isFirefox = /firefox|fxios/i.test(ua);
  const isSafari = /safari/i.test(ua) && !isChrome && !isEdge;

  const browserName = isEdge
    ? 'Edge'
    : isChrome
    ? 'Chrome'
    : isFirefox
    ? 'Firefox'
    : isSafari
    ? 'Safari'
    : 'Browser';
  const osName = isAndroid ? 'Android' : isIos ? 'iOS' : /mac/i.test(ua) ? 'macOS' : /win/i.test(ua) ? 'Windows' : 'Linux';

  return {
    deviceId,
    deviceLabel: `${browserName} on ${osName}`,
    platform: isAndroid ? 'android' : isIos ? 'ios' : 'desktop',
  };
}

export function getBrowserNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const perm = Notification.permission;
  if (perm === 'granted' || perm === 'denied' || perm === 'default') return perm;
  return 'default';
}

export function isPushSupportedOnDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isIosSafariNeedsInstall(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)')?.matches;
  return isIos && !isStandalone && !('Notification' in window);
}

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export async function registerServiceWorkerSafe(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(async (reg) => {
        try {
          const readyReg = await withTimeout(navigator.serviceWorker.ready, 4000, reg);
          return readyReg || reg;
        } catch {
          return reg;
        }
      })
      .catch((err) => {
        console.warn('Service Worker registration notice:', err?.message || err);
        swRegistrationPromise = null;
        return null;
      });
  }
  return swRegistrationPromise;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isSubscriptionVapidMatch(sub: PushSubscription | null, vapidPublicKey: string): boolean {
  if (!sub || !vapidPublicKey) return Boolean(sub);
  try {
    const existingBuf = sub.options?.applicationServerKey;
    if (!existingBuf) return true;
    const existingBytes = new Uint8Array(existingBuf);
    const expectedBytes = urlBase64ToUint8Array(vapidPublicKey);
    return uint8ArraysEqual(existingBytes, expectedBytes);
  } catch {
    return true;
  }
}

async function fetchVapidPublicKeySafe(): Promise<string> {
  try {
    const res = await withTimeout(fetch('/api/push/vapid-public-key'), 3500, null as any);
    if (res && res.ok) {
      const data = await res.json();
      return String(data?.publicKey || '').trim();
    }
  } catch {}
  return '';
}

function userHeaders(uid: string, email?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'x-user-uid': uid,
  };
  const resolvedEmail = email || auth.currentUser?.email || '';
  if (resolvedEmail) headers['x-user-email'] = resolvedEmail;
  return headers;
}

function buildSafeSubDocId(uid: string, deviceId: string): string {
  return `${uid}_${deviceId}`.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
}

function buildFallbackPrefs(uid: string): NotificationPreferencesRecord {
  return {
    userId: uid,
    permissionStatus: 'default',
    subscriptionStatus: 'none',
    frequency: 'instant',
    promptDismissCount: 0,
    channels: {
      websiteBell: true,
      browserPush: false,
      mobilePush: false,
      emailAlerts: false,
    },
    alertTypes: {
      newMatches: true,
      deadlineReminders: true,
      jobChanges: true,
      sectorUpdates: true,
    },
    deviceSubscriptions: [],
    updatedAt: new Date().toISOString(),
  };
}

function mergePreferenceRecords(
  uid: string,
  serverPrefs: NotificationPreferencesRecord | null,
  fsPrefs: NotificationPreferencesRecord | null,
  fsDeviceSubs: NotificationDeviceSubscription[]
): NotificationPreferencesRecord | null {
  if (!serverPrefs && !fsPrefs && fsDeviceSubs.length === 0) return null;
  const base = buildFallbackPrefs(uid);
  const srvTs = new Date(serverPrefs?.updatedAt || 0).getTime();
  const fsTs = new Date(fsPrefs?.updatedAt || 0).getTime();

  const older = srvTs >= fsTs ? fsPrefs : serverPrefs;
  const newer = srvTs >= fsTs ? serverPrefs : fsPrefs;

  const deviceMap = new Map<string, NotificationDeviceSubscription>();
  const addDevices = (list?: NotificationDeviceSubscription[]) => {
    if (!Array.isArray(list)) return;
    for (const d of list) {
      if (!d?.deviceId && !d?.endpoint) continue;
      const key = d.deviceId || d.endpoint || '';
      const existing = deviceMap.get(key);
      const existingTs = new Date(existing?.lastVerifiedAt || existing?.createdAt || 0).getTime();
      const nextTs = new Date(d.lastVerifiedAt || d.createdAt || 0).getTime();
      if (!existing || nextTs >= existingTs || (d.subscription?.keys?.p256dh && !existing.subscription?.keys?.p256dh)) {
        deviceMap.set(key, d);
      }
    }
  };
  addDevices(older?.deviceSubscriptions);
  addDevices(newer?.deviceSubscriptions);
  addDevices(fsDeviceSubs);

  const mergedDevices = Array.from(deviceMap.values()).slice(0, 15);
  const hasAnyActiveDevice = mergedDevices.some((d) => d.active);

  const resolvedPerm =
    newer?.permissionStatus && newer.permissionStatus !== 'default'
      ? newer.permissionStatus
      : older?.permissionStatus || (hasAnyActiveDevice ? 'granted' : 'default');
  const resolvedSubStatus = hasAnyActiveDevice
    ? 'active'
    : newer?.subscriptionStatus || older?.subscriptionStatus || 'none';

  return {
    ...base,
    ...(older || {}),
    ...(newer || {}),
    userId: uid,
    permissionStatus: resolvedPerm,
    subscriptionStatus: resolvedSubStatus,
    channels: {
      ...base.channels,
      ...(older?.channels || {}),
      ...(newer?.channels || {}),
    },
    alertTypes: {
      ...base.alertTypes,
      ...(older?.alertTypes || {}),
      ...(newer?.alertTypes || {}),
    },
    deviceSubscriptions: mergedDevices,
  };
}

export async function fetchUserNotificationPreferences(
  uid: string,
  email?: string | null
): Promise<NotificationPreferencesRecord | null> {
  if (!uid) return null;

  const fetchServer = async (): Promise<NotificationPreferencesRecord | null> => {
    try {
      const res = await withTimeout(
        fetch(`/api/user/notification-preferences/${encodeURIComponent(uid)}`, {
          headers: userHeaders(uid, email),
        }),
        3500,
        null as any
      );
      if (res && res.ok) {
        const data = await res.json();
        if (data?.preferences) return data.preferences as NotificationPreferencesRecord;
      }
    } catch {}
    return null;
  };

  const fetchFirestore = async (): Promise<{
    prefs: NotificationPreferencesRecord | null;
    devices: NotificationDeviceSubscription[];
  }> => {
    if (auth.currentUser?.uid !== uid && !isUserAdmin(auth.currentUser)) {
      return { prefs: null, devices: [] };
    }
    try {
      const [prefSnap, subsSnap] = await Promise.all([
        withTimeout(getDoc(doc(db, 'user_notification_preferences', uid)), 3500, null as any),
        withTimeout(
          getDocs(query(collection(db, 'push_subscriptions'), where('userId', '==', uid))),
          3500,
          null as any
        ),
      ]);

      const prefs =
        prefSnap && prefSnap.exists()
          ? (prefSnap.data() as NotificationPreferencesRecord)
          : null;

      const devices: NotificationDeviceSubscription[] = [];
      if (subsSnap && !subsSnap.empty) {
        subsSnap.forEach((docSnap: any) => {
          const d = docSnap.data();
          if (!d?.endpoint) return;
          devices.push({
            deviceId: String(d.deviceId || docSnap.id),
            deviceLabel: String(d.deviceLabel || 'Web Browser'),
            platform: String(d.platform || 'web'),
            endpoint: d.endpoint,
            subscription: d.keys?.p256dh
              ? {
                  endpoint: d.endpoint,
                  expirationTime: d.expirationTime ?? null,
                  keys: {
                    p256dh: d.keys.p256dh,
                    auth: d.keys.auth,
                  },
                }
              : undefined,
            active: d.active !== false,
            createdAt: d.createdAt || d.updatedAt || new Date().toISOString(),
            lastVerifiedAt: d.updatedAt || new Date().toISOString(),
          });
        });
      }
      return { prefs, devices };
    } catch {
      return { prefs: null, devices: [] };
    }
  };

  const [serverPrefs, fsResult] = await Promise.all([fetchServer(), fetchFirestore()]);
  let cachedPrefs: NotificationPreferencesRecord | null = null;
  try {
    const cached = localStorage.getItem(`hopelandjobs_notif_prefs_${uid}`);
    cachedPrefs = cached ? (JSON.parse(cached) as NotificationPreferencesRecord) : null;
  } catch {}

  const merged = mergePreferenceRecords(
    uid,
    serverPrefs || cachedPrefs,
    fsResult.prefs,
    fsResult.devices
  );

  if (merged) {
    try {
      localStorage.setItem(`hopelandjobs_notif_prefs_${uid}`, JSON.stringify(merged));
    } catch {}
    // Rehydrate serverless memory/tmp if Firestore had newer device subscriptions or prefs
    const serverHadDevices = Boolean(serverPrefs?.deviceSubscriptions?.some((d) => d.active && d.subscription?.keys?.p256dh));
    const mergedActiveDevice = merged.deviceSubscriptions.find((d) => d.active && d.subscription?.keys?.p256dh);
    if (!serverHadDevices && mergedActiveDevice?.subscription) {
      fetch(`/api/push/subscribe/${encodeURIComponent(uid)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...userHeaders(uid, email) },
        body: JSON.stringify({
          deviceId: mergedActiveDevice.deviceId,
          deviceLabel: mergedActiveDevice.deviceLabel,
          platform: mergedActiveDevice.platform,
          subscription: mergedActiveDevice.subscription,
        }),
      }).catch(() => {});
    }
  }

  return merged;
}

export async function saveUserNotificationPreferences(
  uid: string,
  patch: Partial<NotificationPreferencesRecord> & {
    incrementDismiss?: boolean;
    markDeviceExpired?: string;
  },
  email?: string | null
): Promise<NotificationPreferencesRecord | null> {
  if (!uid) return null;
  let savedPrefs: NotificationPreferencesRecord | null = null;

  let cachedBase: NotificationPreferencesRecord = buildFallbackPrefs(uid);
  try {
    const raw = localStorage.getItem(`hopelandjobs_notif_prefs_${uid}`);
    if (raw) cachedBase = { ...cachedBase, ...JSON.parse(raw) };
  } catch {}

  try {
    const res = await withTimeout(
      fetch(`/api/user/notification-preferences/${encodeURIComponent(uid)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...userHeaders(uid, email),
        },
        body: JSON.stringify(patch),
      }),
      3500,
      null as any
    );
    if (res && res.ok) {
      const data = await res.json();
      savedPrefs = data?.preferences || null;
    }
  } catch {}

  if (!savedPrefs) {
    const nowIso = new Date().toISOString();
    savedPrefs = {
      ...cachedBase,
      ...patch,
      userId: uid,
      channels: {
        ...cachedBase.channels,
        ...(patch.channels || {}),
      },
      alertTypes: {
        ...cachedBase.alertTypes,
        ...(patch.alertTypes || {}),
      },
      deviceSubscriptions: patch.deviceSubscriptions ?? cachedBase.deviceSubscriptions ?? [],
      updatedAt: nowIso,
    };
  }

  try {
    localStorage.setItem(`hopelandjobs_notif_prefs_${uid}`, JSON.stringify(savedPrefs));
  } catch {}

  if (savedPrefs && (auth.currentUser?.uid === uid || isUserAdmin(auth.currentUser))) {
    try {
      const clean = sanitizeForFirestore({
        userId: uid,
        permissionStatus: savedPrefs.permissionStatus,
        subscriptionStatus: savedPrefs.subscriptionStatus,
        frequency: savedPrefs.frequency || 'instant',
        enabledAt: savedPrefs.enabledAt || null,
        permissionVerifiedAt: savedPrefs.permissionVerifiedAt || null,
        lastSuccessfulDeliveryAt: savedPrefs.lastSuccessfulDeliveryAt || null,
        promptDismissCount: savedPrefs.promptDismissCount ?? 0,
        channels: savedPrefs.channels,
        alertTypes: savedPrefs.alertTypes,
        deviceSubscriptions: savedPrefs.deviceSubscriptions || [],
        updatedAt: savedPrefs.updatedAt,
      });
      await withTimeout(setDoc(doc(db, 'user_notification_preferences', uid), clean, { merge: true }), 3500, undefined);
    } catch {}
  }

  return savedPrefs;
}

async function persistPushSubscriptionToFirestoreAndServer(
  uid: string,
  subJson: PushSubscriptionJSON,
  deviceMeta: { deviceId: string; deviceLabel: string; platform: string },
  email?: string | null
): Promise<NotificationPreferencesRecord | null> {
  const nowIso = new Date().toISOString();
  let serverPrefs: NotificationPreferencesRecord | null = null;

  try {
    const subRes = await withTimeout(
      fetch(`/api/push/subscribe/${encodeURIComponent(uid)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...userHeaders(uid, email),
        },
        body: JSON.stringify({
          ...deviceMeta,
          subscription: subJson,
        }),
      }),
      4000,
      null as any
    );
    if (subRes && subRes.ok) {
      const data = await subRes.json();
      serverPrefs = data?.preferences || null;
    }
  } catch {}

  if (auth.currentUser?.uid === uid && subJson?.endpoint) {
    const safeSubId = buildSafeSubDocId(uid, deviceMeta.deviceId);
    try {
      await withTimeout(
        setDoc(
          doc(db, 'push_subscriptions', safeSubId),
          sanitizeForFirestore({
            id: safeSubId,
            userId: uid,
            deviceId: deviceMeta.deviceId,
            deviceLabel: deviceMeta.deviceLabel,
            platform: deviceMeta.platform,
            endpoint: subJson.endpoint,
            expirationTime: subJson.expirationTime ?? null,
            keys: {
              p256dh: subJson.keys?.p256dh || '',
              auth: subJson.keys?.auth || '',
            },
            active: true,
            updatedAt: nowIso,
          }),
          { merge: true }
        ),
        3500,
        undefined
      );
    } catch {}
  }

  return serverPrefs;
}

export async function checkCurrentDevicePushHealth(
  uid: string,
  prefs: NotificationPreferencesRecord | null,
  email?: string | null
): Promise<{
  browserPermission: NotificationPermissionState;
  hasActiveSubscriptionOnThisDevice: boolean;
  needsRenewalOnThisDevice: boolean;
}> {
  const browserPermission = getBrowserNotificationPermission();
  const deviceMeta = getDeviceMetadata();
  const { deviceId } = deviceMeta;

  if (browserPermission === 'unsupported' || !isPushSupportedOnDevice()) {
    return {
      browserPermission,
      hasActiveSubscriptionOnThisDevice: false,
      needsRenewalOnThisDevice: false,
    };
  }

  if (browserPermission === 'denied') {
    if (prefs && prefs.permissionStatus !== 'denied') {
      await saveUserNotificationPreferences(uid, { permissionStatus: 'denied', subscriptionStatus: 'revoked' }, email);
    }
    return {
      browserPermission: 'denied',
      hasActiveSubscriptionOnThisDevice: false,
      needsRenewalOnThisDevice: false,
    };
  }

  let browserSub: PushSubscription | null = null;
  let reg: ServiceWorkerRegistration | null = null;
  try {
    reg = await registerServiceWorkerSafe();
    if (reg?.pushManager) {
      browserSub = await reg.pushManager.getSubscription();
    }
  } catch {}

  // Check if VAPID key changed on production; if granted and mismatched, silently renew subscription
  const publicKey = browserSub ? await fetchVapidPublicKeySafe() : '';
  if (browserPermission === 'granted' && browserSub && publicKey && !isSubscriptionVapidMatch(browserSub, publicKey)) {
    try {
      await browserSub.unsubscribe();
      browserSub = await reg!.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      await persistPushSubscriptionToFirestoreAndServer(uid, browserSub.toJSON(), deviceMeta, email);
    } catch {}
  }

  const serverDevice = (prefs?.deviceSubscriptions || []).find((d) => d.deviceId === deviceId && d.active);
  const subJson = browserSub?.toJSON();
  const hasKeysSynced = Boolean(serverDevice?.subscription?.keys?.p256dh && serverDevice?.subscription?.keys?.auth);

  // Sync silently if browser granted permission & holds a subscription not yet synced with full keys
  if (browserPermission === 'granted' && browserSub && subJson?.endpoint && (!serverDevice || !hasKeysSynced)) {
    try {
      await persistPushSubscriptionToFirestoreAndServer(uid, subJson, deviceMeta, email);
      return {
        browserPermission: 'granted',
        hasActiveSubscriptionOnThisDevice: true,
        needsRenewalOnThisDevice: false,
      };
    } catch {}
  }

  const hasActiveSubscriptionOnThisDevice = Boolean(
    browserPermission === 'granted' && browserSub && serverDevice
  );

  const deviceMarkedExpired = Boolean(
    (prefs?.deviceSubscriptions || []).some((d) => d.deviceId === deviceId && !d.active)
  );
  const isNewDeviceForGrantedUser = Boolean(
    prefs?.permissionStatus === 'granted' && (!browserSub || !serverDevice)
  );

  return {
    browserPermission,
    hasActiveSubscriptionOnThisDevice,
    needsRenewalOnThisDevice: deviceMarkedExpired || isNewDeviceForGrantedUser,
  };
}

/**
 * Evaluates whether the notification permission modal should be shown.
 * Never repeatedly prompts once push notifications are granted & active on the current device.
 */
export function evaluateNotificationPromptRule(args: {
  prefs: NotificationPreferencesRecord | null;
  browserPermission: NotificationPermissionState;
  hasActiveDeviceSub: boolean;
  needsDeviceRenewal: boolean;
  alreadyPromptedThisLogin: boolean;
}): {
  shouldShowModal: boolean;
  reason: 'first_time' | 'not_enabled_yet' | 'renew_device' | 'blocked_in_browser' | 'already_active' | 'unsupported';
} {
  const { prefs, browserPermission, hasActiveDeviceSub, needsDeviceRenewal, alreadyPromptedThisLogin } = args;

  if (browserPermission === 'granted' && hasActiveDeviceSub) {
    return { shouldShowModal: false, reason: 'already_active' };
  }

  if (browserPermission === 'denied') {
    return { shouldShowModal: !alreadyPromptedThisLogin && prefs?.permissionStatus === 'granted', reason: 'blocked_in_browser' };
  }

  if (browserPermission === 'unsupported') {
    const bellSet = Boolean(prefs?.enabledAt || prefs?.channels?.websiteBell);
    return {
      shouldShowModal: !alreadyPromptedThisLogin && !bellSet,
      reason: 'unsupported',
    };
  }

  if (needsDeviceRenewal) {
    return { shouldShowModal: !alreadyPromptedThisLogin, reason: 'renew_device' };
  }

  if (!prefs || prefs.permissionStatus === 'default' || prefs.subscriptionStatus === 'none') {
    return {
      shouldShowModal: !alreadyPromptedThisLogin,
      reason: !prefs ? 'first_time' : 'not_enabled_yet',
    };
  }

  return { shouldShowModal: false, reason: 'already_active' };
}

export async function requestAndEnableNotifications(
  uid: string,
  options: {
    emailAlerts?: boolean;
    websiteBell?: boolean;
    email?: string | null;
  } = {}
): Promise<{
  success: boolean;
  permissionStatus: NotificationPermissionState;
  subscriptionActive: boolean;
  preferences: NotificationPreferencesRecord | null;
  message: string;
}> {
  const browserSupport = isPushSupportedOnDevice();
  const deviceMeta = getDeviceMetadata();
  const useEmailAlerts = options.emailAlerts === true;

  if (!browserSupport) {
    const saved = await saveUserNotificationPreferences(
      uid,
      {
        permissionStatus: 'unsupported',
        subscriptionStatus: 'none',
        enabledAt: new Date().toISOString(),
        channels: {
          websiteBell: options.websiteBell !== false,
          browserPush: false,
          mobilePush: false,
          emailAlerts: useEmailAlerts,
        },
      },
      options.email
    );
    return {
      success: true,
      permissionStatus: 'unsupported',
      subscriptionActive: false,
      preferences: saved,
      message: isIosSafariNeedsInstall()
        ? 'Dashboard notification bell enabled! Add Hopeland Jobs to your iPhone Home Screen to also receive iOS lock-screen push alerts.'
        : 'Website dashboard notification bell is enabled for your account.',
    };
  }

  let permResult: NotificationPermission = Notification.permission;
  if (permResult !== 'granted') {
    try {
      permResult = await Notification.requestPermission();
    } catch {
      permResult = Notification.permission;
    }
  }

  if (permResult === 'denied') {
    const saved = await saveUserNotificationPreferences(
      uid,
      {
        permissionStatus: 'denied',
        subscriptionStatus: 'revoked',
        channels: {
          websiteBell: options.websiteBell !== false,
          browserPush: false,
          mobilePush: false,
          emailAlerts: useEmailAlerts,
        },
      },
      options.email
    );
    return {
      success: false,
      permissionStatus: 'denied',
      subscriptionActive: false,
      preferences: saved,
      message: 'Browser notifications are currently blocked. Allow Notifications for this site in your browser settings, then click Check Again.',
    };
  }

  if (permResult !== 'granted') {
    const saved = await saveUserNotificationPreferences(
      uid,
      {
        permissionStatus: 'default',
        subscriptionStatus: 'none',
        incrementDismiss: true,
        channels: {
          websiteBell: options.websiteBell !== false,
          browserPush: false,
          mobilePush: false,
          emailAlerts: useEmailAlerts,
        },
      },
      options.email
    );
    return {
      success: false,
      permissionStatus: 'default',
      subscriptionActive: false,
      preferences: saved,
      message: 'Permission prompt was dismissed. Website notification bell remains active, and you can enable push alerts anytime.',
    };
  }

  // Permission granted -> register SW + verify VAPID match + subscribe with full keys
  try {
    const reg = await registerServiceWorkerSafe();
    if (!reg?.pushManager) {
      throw new Error('Service Worker PushManager unavailable in this browser');
    }
    const publicKey = await fetchVapidPublicKeySafe();
    if (!publicKey) {
      throw new Error('Could not retrieve Web Push VAPID public key');
    }

    let sub = await reg.pushManager.getSubscription();
    if (sub && !isSubscriptionVapidMatch(sub, publicKey)) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
    }

    const subJson = sub.toJSON();
    const srvPrefs = await persistPushSubscriptionToFirestoreAndServer(
      uid,
      subJson,
      deviceMeta,
      options.email
    );

    const saved = await saveUserNotificationPreferences(
      uid,
      {
        permissionStatus: 'granted',
        subscriptionStatus: 'active',
        enabledAt: new Date().toISOString(),
        channels: {
          websiteBell: options.websiteBell !== false,
          browserPush: true,
          mobilePush: deviceMeta.platform === 'android' || deviceMeta.platform === 'ios',
          emailAlerts: useEmailAlerts,
        },
        deviceSubscriptions: srvPrefs?.deviceSubscriptions,
      },
      options.email
    );

    return {
      success: true,
      permissionStatus: 'granted',
      subscriptionActive: true,
      preferences: saved || srvPrefs || null,
      message: 'Push notifications are now enabled! Instant matching job alerts will arrive directly on this device.',
    };
  } catch (err: any) {
    const saved = await saveUserNotificationPreferences(
      uid,
      {
        permissionStatus: 'granted',
        subscriptionStatus: 'none',
        channels: {
          websiteBell: options.websiteBell !== false,
          browserPush: false,
          mobilePush: false,
          emailAlerts: useEmailAlerts,
        },
      },
      options.email
    );
    return {
      success: true,
      permissionStatus: 'granted',
      subscriptionActive: false,
      preferences: saved,
      message: `Permission granted! Website notification bell is active (Push note: ${err?.message || 'browser push unavailable'}).`,
    };
  }
}

export async function disableDeviceNotifications(
  uid: string,
  email?: string | null
): Promise<{
  success: boolean;
  preferences: NotificationPreferencesRecord | null;
  message: string;
}> {
  const deviceMeta = getDeviceMetadata();
  let unsubscribedEndpoint = '';

  try {
    const reg = await registerServiceWorkerSafe();
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) {
      unsubscribedEndpoint = sub.endpoint;
      await sub.unsubscribe();
    }
  } catch {}

  let serverPrefs: NotificationPreferencesRecord | null = null;
  try {
    const res = await withTimeout(
      fetch(`/api/push/unsubscribe/${encodeURIComponent(uid)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...userHeaders(uid, email) },
        body: JSON.stringify({
          deviceId: deviceMeta.deviceId,
          endpoint: unsubscribedEndpoint || undefined,
        }),
      }),
      3500,
      null as any
    );
    if (res && res.ok) {
      const data = await res.json();
      serverPrefs = data?.preferences || null;
    }
  } catch {}

  if (auth.currentUser?.uid === uid) {
    const safeSubId = buildSafeSubDocId(uid, deviceMeta.deviceId);
    try {
      await withTimeout(
        setDoc(
          doc(db, 'push_subscriptions', safeSubId),
          sanitizeForFirestore({
            id: safeSubId,
            userId: uid,
            deviceId: deviceMeta.deviceId,
            deviceLabel: deviceMeta.deviceLabel,
            platform: deviceMeta.platform,
            endpoint: unsubscribedEndpoint || 'disabled',
            active: false,
            updatedAt: new Date().toISOString(),
          }),
          { merge: true }
        ),
        3500,
        undefined
      );
    } catch {}
  }

  const stillHasActive = Boolean(serverPrefs?.deviceSubscriptions?.some((d) => d.active));
  const saved = await saveUserNotificationPreferences(
    uid,
    {
      subscriptionStatus: stillHasActive ? 'active' : 'none',
      channels: {
        websiteBell: true,
        browserPush: stillHasActive,
        mobilePush: stillHasActive,
        emailAlerts: false,
      },
      deviceSubscriptions: serverPrefs?.deviceSubscriptions,
    },
    email
  );

  return {
    success: true,
    preferences: saved || serverPrefs,
    message: 'Push notifications have been disabled on this device.',
  };
}

export async function sendTestPushNotification(
  uid: string,
  email?: string | null
): Promise<{ success: boolean; deliveredCount: number; message: string }> {
  try {
    const res = await fetch(`/api/push/test/${encodeURIComponent(uid)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeaders(uid, email) },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        deliveredCount: data.deliveredCount || 1,
        message: 'Test push notification dispatched! Check your system notification tray.',
      };
    }
    return {
      success: false,
      deliveredCount: 0,
      message: data?.errors?.[0] || 'No active push subscription found for this device yet.',
    };
  } catch (err: any) {
    return {
      success: false,
      deliveredCount: 0,
      message: err?.message || 'Failed sending test push notification.',
    };
  }
}

export async function fetchUserRecommendationsServer(
  uid: string,
  email?: string | null
): Promise<RecommendedOpportunity[]> {
  if (!uid) return [];
  try {
    const res = await fetch(`/api/user/recommendations/${encodeURIComponent(uid)}`, {
      headers: userHeaders(uid, email),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.recommendations)) return data.recommendations;
    }
  } catch {}
  return [];
}

export async function recalculateUserRecommendationsServer(
  uid: string,
  email?: string | null,
  sendNotifications = true
): Promise<{ recommendations: RecommendedOpportunity[]; newNotifications: UserNotificationItem[] }> {
  if (!uid) return { recommendations: [], newNotifications: [] };
  try {
    const res = await fetch(`/api/user/recommendations/recalculate/${encodeURIComponent(uid)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeaders(uid, email) },
      body: JSON.stringify({ sendNotifications }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        recommendations: Array.isArray(data?.recommendations) ? data.recommendations : [],
        newNotifications: Array.isArray(data?.newNotifications) ? data.newNotifications : [],
      };
    }
  } catch {}
  return { recommendations: [], newNotifications: [] };
}

export async function fetchUserNotificationsServer(
  uid: string,
  email?: string | null
): Promise<{ notifications: UserNotificationItem[]; unreadCount: number }> {
  if (!uid) return { notifications: [], unreadCount: 0 };
  try {
    const res = await fetch(`/api/user/notifications/${encodeURIComponent(uid)}`, {
      headers: userHeaders(uid, email),
    });
    if (res.ok) {
      const data = await res.json();
      const serverList: UserNotificationItem[] = Array.isArray(data?.notifications) ? data.notifications : [];
      if (auth.currentUser?.uid === uid && serverList.length > 0) {
        for (const n of serverList.slice(0, 10)) {
          if (!n?.id) continue;
          setDoc(
            doc(db, 'user_notifications', n.id),
            sanitizeForFirestore({
              ...n,
              userId: uid,
            }),
            { merge: true }
          ).catch(() => {});
        }
      }
      return {
        notifications: serverList,
        unreadCount: Number(data?.unreadCount || 0),
      };
    }
  } catch {}

  if (auth.currentUser?.uid === uid) {
    try {
      const q = query(collection(db, 'user_notifications'), where('userId', '==', uid));
      const snap = await withTimeout(getDocs(q), 3000, null as any);
      if (snap && !snap.empty) {
        const list = snap.docs.map((d: any) => d.data() as UserNotificationItem);
        list.sort((a: UserNotificationItem, b: UserNotificationItem) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return { notifications: list, unreadCount: list.filter((n: UserNotificationItem) => !n.read).length };
      }
    } catch {}
  }

  return { notifications: [], unreadCount: 0 };
}

export async function markUserNotificationReadServer(
  uid: string,
  opts: { notificationId?: string; markAll?: boolean; read?: boolean },
  email?: string | null
): Promise<{ notifications: UserNotificationItem[]; unreadCount: number }> {
  if (!uid) return { notifications: [], unreadCount: 0 };
  try {
    const res = await fetch(`/api/user/notifications/${encodeURIComponent(uid)}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeaders(uid, email) },
      body: JSON.stringify(opts),
    });
    if (res.ok) {
      const data = await res.json();
      if (opts.notificationId && auth.currentUser?.uid === uid) {
        updateDoc(doc(db, 'user_notifications', opts.notificationId), {
          read: opts.read !== false,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
      return {
        notifications: Array.isArray(data?.notifications) ? data.notifications : [],
        unreadCount: Number(data?.unreadCount || 0),
      };
    }
  } catch {}
  return { notifications: [], unreadCount: 0 };
}

export async function syncNotificationsOnReconnect(
  uid: string,
  email?: string | null
): Promise<{
  recommendations: RecommendedOpportunity[];
  notifications: UserNotificationItem[];
  unreadCount: number;
  newDeliveriesCount: number;
  syncedAt: string;
} | null> {
  if (!uid) return null;
  try {
    const res = await fetch(`/api/user/notifications/sync-reconnect/${encodeURIComponent(uid)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeaders(uid, email) },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return null;
}

async function gatherFirestoreUsersSnapshot(): Promise<{
  profiles: any[];
  preferences: any[];
  pushSubscriptions: any[];
} | null> {
  if (!auth.currentUser || !isUserAdmin(auth.currentUser)) return null;
  try {
    const [profilesSnap, prefsSnap, subsSnap] = await Promise.all([
      withTimeout(getDocs(collection(db, 'job_seeker_profiles')), 3500, null as any),
      withTimeout(getDocs(collection(db, 'user_notification_preferences')), 3500, null as any),
      withTimeout(getDocs(collection(db, 'push_subscriptions')), 3500, null as any),
    ]);
    const profiles = profilesSnap ? profilesSnap.docs.map((d: any) => d.data()).filter((p: any) => p?.uid) : [];
    const preferences = prefsSnap ? prefsSnap.docs.map((d: any) => d.data()).filter((p: any) => p?.userId) : [];
    const pushSubscriptions = subsSnap ? subsSnap.docs.map((d: any) => d.data()).filter((s: any) => s?.userId && s?.endpoint) : [];
    if (profiles.length === 0 && preferences.length === 0 && pushSubscriptions.length === 0) return null;
    return { profiles, preferences, pushSubscriptions };
  } catch {
    return null;
  }
}

export async function syncVacanciesToServerCatalog(
  vacancies: Vacancy[],
  options: {
    mode?: 'merge' | 'replace' | 'seed_if_empty';
    changedVacancyId?: string;
    changedVacancyIds?: string[];
    changeType?: 'published' | 'updated';
  } = {}
): Promise<{
  success?: boolean;
  notifiedUsersCount?: number;
  notificationsDispatched?: number;
  emailsSent?: number;
  pushSent?: number;
} | null> {
  if (!Array.isArray(vacancies) || vacancies.length === 0) return null;
  try {
    const usersSnapshot =
      options.mode !== 'seed_if_empty' ? await gatherFirestoreUsersSnapshot() : null;

    const res = await withTimeout(
      fetch('/api/vacancies/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getOwnerAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          vacancies,
          mode: options.mode || 'merge',
          changedVacancyId: options.changedVacancyId,
          changedVacancyIds: options.changedVacancyIds,
          changeType: options.changeType,
          ...(usersSnapshot ? { usersSnapshot } : {}),
        }),
      }),
      10000,
      null as any
    );
    if (res && res.ok) {
      return await res.json().catch(() => null);
    }
  } catch {}
  return null;
}

export async function syncAllUsersFromFirestoreToServer(adminEmailOverride?: string): Promise<void> {
  if (!auth.currentUser) return;
  try {
    const snapshot = await gatherFirestoreUsersSnapshot();
    if (!snapshot) return;

    await withTimeout(
      fetch('/api/admin/sync-registered-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getOwnerAuthHeaders(adminEmailOverride),
        },
        credentials: 'include',
        body: JSON.stringify(snapshot),
      }),
      4500,
      null as any
    );
  } catch {}
}

export async function deleteVacanciesFromServerCatalog(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    await withTimeout(
      fetch('/api/vacancies/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getOwnerAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({ ids }),
      }),
      2500,
      null as any
    );
  } catch {}
}

export async function fetchRegisteredUserAnalyticsAdmin(
  adminEmailOverride?: string
): Promise<RegisteredUserAnalyticsSummary | null> {
  try {
    const res = await fetch('/api/admin/user-analytics', {
      headers: getOwnerAuthHeaders(adminEmailOverride),
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.success ? (data as RegisteredUserAnalyticsSummary) : null;
  } catch {
    return null;
  }
}

export async function updateAdminUserAccountStatus(
  uid: string,
  accountStatus: 'active' | 'inactive' | 'suspended',
  reason?: string,
  adminEmailOverride?: string
): Promise<RegisteredUserAnalyticsSummary | null> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOwnerAuthHeaders(adminEmailOverride),
    },
    credentials: 'include',
    body: JSON.stringify({ accountStatus, reason }),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Failed to update user account status.');
  }
  return data.summary || null;
}

export async function fetchAdminSchedulerStatus(
  adminEmailOverride?: string
): Promise<AdminSchedulerStatusResponse | null> {
  try {
    const res = await fetch('/api/admin/scheduler-status', {
      headers: getOwnerAuthHeaders(adminEmailOverride),
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.success ? (data as AdminSchedulerStatusResponse) : null;
  } catch {
    return null;
  }
}

export async function triggerAdminSchedulerRun(
  options: { dryRun?: boolean } = {},
  adminEmailOverride?: string
): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  run?: SchedulerRunRecord;
  schedulerStatus?: AdminSchedulerStatusResponse;
}> {
  const res = await fetch('/api/admin/scheduler/run-now', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOwnerAuthHeaders(adminEmailOverride),
    },
    credentials: 'include',
    body: JSON.stringify({ dryRun: Boolean(options.dryRun) }),
  });
  return res.json();
}

export async function verifyAdminSmtpConnection(adminEmailOverride?: string): Promise<{
  success: boolean;
  configured: boolean;
  verified: boolean;
  host?: string;
  port?: string;
  from?: string;
  message: string;
}> {
  const res = await fetch('/api/admin/scheduler/verify-smtp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOwnerAuthHeaders(adminEmailOverride),
    },
    credentials: 'include',
  });
  return res.json();
}

export async function sendAdminTestNotificationToUsers(
  options: { targetUid?: string; sendToAll?: boolean; customNote?: string } = {},
  adminEmailOverride?: string
): Promise<{
  success: boolean;
  usersTargeted: number;
  usersNotified: number;
  emailsSent: number;
  emailsFailed: number;
  pushSent: number;
  pushQueued: number;
  deliveries?: Array<{
    uid: string;
    email: string;
    fullName: string;
    jobTitle: string;
    website: string;
    emailStatus: string;
    pushStatus: string;
  }>;
  errors?: string[];
  error?: string;
}> {
  const res = await fetch('/api/admin/notifications/send-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOwnerAuthHeaders(adminEmailOverride),
    },
    credentials: 'include',
    body: JSON.stringify(options),
  });
  return res.json();
}
