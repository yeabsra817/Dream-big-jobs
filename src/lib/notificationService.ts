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
  const isIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
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
  const isIos =
    /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
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

const SESSION_DISMISS_KEY = 'hopelandjobs_notif_prompt_session_dismissed';
const LOCAL_DISMISS_KEY = 'hopelandjobs_notif_prompt_dismiss_state';
const ANON_PUSH_SUB_KEY = 'hopelandjobs_anon_push_sub';

const FIRST_DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const REPEAT_DISMISS_COOLDOWN_MS = 72 * 60 * 60 * 1000; // 72 hours

function sanitizeDeviceDocId(rawId: string): string {
  const cleaned = String(rawId || 'device')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 128);
  return cleaned || `dev_${Date.now().toString(36)}`;
}

export function clearNotificationPromptDismissal(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_DISMISS_KEY);
    localStorage.removeItem(LOCAL_DISMISS_KEY);
  } catch {}
}

export function isPromptDismissedInSessionOrCooldown(
  prefs?: NotificationPreferencesRecord | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(SESSION_DISMISS_KEY) === '1') {
      return true;
    }
    const raw = localStorage.getItem(LOCAL_DISMISS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { dismissedAt?: number; dismissCount?: number };
    const dismissedAt = Number(parsed?.dismissedAt || 0);
    if (!dismissedAt || Number.isNaN(dismissedAt)) return false;
    const effectiveCount = Math.max(
      Number(parsed?.dismissCount || 1),
      Number(prefs?.promptDismissCount || 0)
    );
    const cooldownMs =
      effectiveCount >= 2 ? REPEAT_DISMISS_COOLDOWN_MS : FIRST_DISMISS_COOLDOWN_MS;
    return Date.now() - dismissedAt < cooldownMs;
  } catch {
    return false;
  }
}

export async function recordNotificationPromptDismissal(
  uid?: string | null,
  email?: string | null
): Promise<NotificationPreferencesRecord | null> {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
      let prevCount = 0;
      const existingRaw = localStorage.getItem(LOCAL_DISMISS_KEY);
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw);
        prevCount = Number(parsed?.dismissCount || 0);
      }
      localStorage.setItem(
        LOCAL_DISMISS_KEY,
        JSON.stringify({
          dismissedAt: Date.now(),
          dismissCount: prevCount + 1,
        })
      );
    } catch {}
  }

  if (uid) {
    return saveUserNotificationPreferences(uid, { incrementDismiss: true }, email).catch(() => null);
  }
  return null;
}

function saveAnonPushCache(deviceId: string, subJson: PushSubscriptionJSON): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      ANON_PUSH_SUB_KEY,
      JSON.stringify({
        deviceId: sanitizeDeviceDocId(deviceId),
        subscription: subJson,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {}
}

function readAnonPushCache(): {
  deviceId: string;
  subscription: PushSubscriptionJSON;
  updatedAt?: string;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ANON_PUSH_SUB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.subscription?.endpoint && parsed?.subscription?.keys?.p256dh && parsed?.subscription?.keys?.auth) {
      return parsed;
    }
  } catch {}
  return null;
}

async function persistAnonymousPushSubscription(
  subJson: PushSubscriptionJSON,
  deviceMeta: { deviceId: string; deviceLabel: string; platform: string }
): Promise<{ saved: boolean; serverSaved: boolean; firestoreSaved: boolean }> {
  const endpoint = String(subJson?.endpoint || '').trim();
  const p256dh = String(subJson?.keys?.p256dh || '').trim();
  const authKey = String(subJson?.keys?.auth || '').trim();
  if (!endpoint.startsWith('https://') || !p256dh || !authKey) {
    return { saved: false, serverSaved: false, firestoreSaved: false };
  }

  const cleanDeviceId = sanitizeDeviceDocId(deviceMeta.deviceId);
  const nowIso = new Date().toISOString();
  let serverSaved = false;
  let firestoreSaved = false;

  try {
    const res = await withTimeout(
      fetch('/api/push/subscribe-anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: cleanDeviceId,
          deviceLabel: deviceMeta.deviceLabel,
          platform: deviceMeta.platform,
          subscription: {
            endpoint,
            expirationTime: subJson.expirationTime ?? null,
            keys: { p256dh, auth: authKey },
          },
        }),
      }),
      4000,
      null as any
    );
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      serverSaved = Boolean(data?.success && data?.saved);
    }
  } catch {}

  try {
    const payload = sanitizeForFirestore({
      deviceId: cleanDeviceId,
      deviceLabel: String(deviceMeta.deviceLabel || 'Web Browser').slice(0, 150),
      platform: String(deviceMeta.platform || 'web').slice(0, 60),
      endpoint: endpoint.slice(0, 1000),
      expirationTime: typeof subJson.expirationTime === 'number' ? subJson.expirationTime : null,
      keys: {
        p256dh: p256dh.slice(0, 300),
        auth: authKey.slice(0, 128),
      },
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await withTimeout(
      setDoc(doc(db, 'anonymous_push_subscriptions', cleanDeviceId), payload, { merge: true }),
      4000,
      undefined
    );
    firestoreSaved = true;
  } catch {}

  const saved = serverSaved || firestoreSaved;
  if (saved) {
    saveAnonPushCache(cleanDeviceId, {
      endpoint,
      expirationTime: subJson.expirationTime ?? null,
      keys: { p256dh, auth: authKey },
    });
  }
  return { saved, serverSaved, firestoreSaved };
}

async function persistPushSubscriptionToFirestoreAndServer(
  uid: string,
  subJson: PushSubscriptionJSON,
  deviceMeta: { deviceId: string; deviceLabel: string; platform: string },
  email?: string | null
): Promise<{
  serverPrefs: NotificationPreferencesRecord | null;
  serverSaved: boolean;
  firestoreSaved: boolean;
}> {
  const nowIso = new Date().toISOString();
  let serverPrefs: NotificationPreferencesRecord | null = null;
  let serverSaved = false;
  let firestoreSaved = false;

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
      const data = await subRes.json().catch(() => null);
      if (data?.success) {
        serverSaved = true;
        serverPrefs = data?.preferences || null;
      }
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
      firestoreSaved = true;
    } catch {}
  }

  return { serverPrefs, serverSaved, firestoreSaved };
}

export async function syncBrowserPushWithUserAccount(
  uid: string,
  email?: string | null,
  existingBrowserSub?: PushSubscription | null,
  prefs?: NotificationPreferencesRecord | null
): Promise<{
  synced: boolean;
  preferences: NotificationPreferencesRecord | null;
}> {
  if (!uid) return { synced: false, preferences: null };
  const deviceMeta = getDeviceMetadata();
  const cachedAnon = readAnonPushCache();
  let subJson: PushSubscriptionJSON | null = existingBrowserSub?.toJSON() || null;

  if (!subJson && typeof window !== 'undefined' && getBrowserNotificationPermission() === 'granted' && isPushSupportedOnDevice()) {
    try {
      const reg = await registerServiceWorkerSafe();
      const browserSub = await reg?.pushManager?.getSubscription();
      if (browserSub) subJson = browserSub.toJSON();
    } catch {}
  }

  if (!subJson && cachedAnon?.subscription) {
    subJson = cachedAnon.subscription;
  }

  if (!subJson?.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
    // Still attempt server claim in case an anonymous record exists by deviceId on the server
    if (cachedAnon?.deviceId || deviceMeta.deviceId) {
      try {
        const res = await withTimeout(
          fetch(`/api/push/claim-anonymous/${encodeURIComponent(uid)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...userHeaders(uid, email) },
            body: JSON.stringify({ ...deviceMeta }),
          }),
          3500,
          null as any
        );
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.claimed && data?.preferences) {
            return { synced: true, preferences: data.preferences };
          }
        }
      } catch {}
    }
    return { synced: false, preferences: prefs || null };
  }

  let claimedPrefs: NotificationPreferencesRecord | null = null;
  let claimedOk = false;
  try {
    const claimRes = await withTimeout(
      fetch(`/api/push/claim-anonymous/${encodeURIComponent(uid)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...userHeaders(uid, email) },
        body: JSON.stringify({
          deviceId: cachedAnon?.deviceId || deviceMeta.deviceId,
          deviceLabel: deviceMeta.deviceLabel,
          platform: deviceMeta.platform,
          subscription: subJson,
        }),
      }),
      4000,
      null as any
    );
    if (claimRes && claimRes.ok) {
      const data = await claimRes.json().catch(() => null);
      if (data?.success) {
        claimedOk = Boolean(data?.claimed);
        claimedPrefs = data?.preferences || null;
      }
    }
  } catch {}

  const persistRes = await persistPushSubscriptionToFirestoreAndServer(
    uid,
    subJson,
    deviceMeta,
    email
  );
  const finalPrefs = persistRes.serverPrefs || claimedPrefs || prefs || null;
  if (persistRes.serverSaved || persistRes.firestoreSaved || claimedOk) {
    try {
      localStorage.removeItem(ANON_PUSH_SUB_KEY);
    } catch {}
    await saveUserNotificationPreferences(
      uid,
      {
        permissionStatus: 'granted',
        subscriptionStatus: 'active',
        enabledAt: finalPrefs?.enabledAt || new Date().toISOString(),
        channels: {
          websiteBell: true,
          browserPush: true,
          mobilePush:
            Boolean(finalPrefs?.channels?.mobilePush) ||
            deviceMeta.platform === 'android' ||
            deviceMeta.platform === 'ios',
          emailAlerts: Boolean(finalPrefs?.channels?.emailAlerts),
        },
        deviceSubscriptions: finalPrefs?.deviceSubscriptions,
      },
      email
    ).catch(() => null);
    return { synced: true, preferences: finalPrefs };
  }

  return { synced: false, preferences: finalPrefs };
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

  const publicKey = browserPermission === 'granted' ? await fetchVapidPublicKeySafe() : '';
  if (browserPermission === 'granted' && browserSub && publicKey && !isSubscriptionVapidMatch(browserSub, publicKey)) {
    try {
      await browserSub.unsubscribe();
      browserSub = await reg!.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
    } catch {}
  } else if (browserPermission === 'granted' && !browserSub && reg?.pushManager && publicKey) {
    // Permission is already granted in browser — silently create/restore subscription without showing popup
    try {
      browserSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
    } catch {}
  }

  const serverDevice = (prefs?.deviceSubscriptions || []).find((d) => d.deviceId === deviceId && d.active);
  const subJson = browserSub?.toJSON();
  const hasKeysSynced = Boolean(serverDevice?.subscription?.keys?.p256dh && serverDevice?.subscription?.keys?.auth);
  const anonPending = Boolean(readAnonPushCache());

  // Sync silently if browser granted permission & holds a subscription not yet synced (or transitioning from anonymous)
  if (
    browserPermission === 'granted' &&
    browserSub &&
    subJson?.endpoint &&
    (!serverDevice || !hasKeysSynced || anonPending)
  ) {
    try {
      const syncResult = await syncBrowserPushWithUserAccount(uid, email, browserSub, prefs);
      if (syncResult.synced) {
        return {
          browserPermission: 'granted',
          hasActiveSubscriptionOnThisDevice: true,
          needsRenewalOnThisDevice: false,
        };
      }
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
 * Checks browser notification permission, active PushSubscription, VAPID match,
 * dismissal cooldown, and account sync for ANY visitor (anonymous or signed-in).
 */
export async function checkVisitorNotificationStatus(
  uid?: string | null,
  email?: string | null
): Promise<{
  shouldShowPopup: boolean;
  reason:
    | 'first_time'
    | 'not_enabled_yet'
    | 'renew_device'
    | 'blocked_in_browser'
    | 'ios_install_required'
    | 'already_active'
    | 'dismissed_cooldown'
    | 'unsupported';
  browserPermission: NotificationPermissionState;
  hasValidSubscription: boolean;
  preferences: NotificationPreferencesRecord | null;
}> {
  const browserPermission = getBrowserNotificationPermission();
  const prefs = uid ? await fetchUserNotificationPreferences(uid, email).catch(() => null) : null;

  if (isIosSafariNeedsInstall()) {
    if (isPromptDismissedInSessionOrCooldown(prefs)) {
      return {
        shouldShowPopup: false,
        reason: 'dismissed_cooldown',
        browserPermission: 'unsupported',
        hasValidSubscription: false,
        preferences: prefs,
      };
    }
    return {
      shouldShowPopup: true,
      reason: 'ios_install_required',
      browserPermission: 'unsupported',
      hasValidSubscription: false,
      preferences: prefs,
    };
  }

  if (browserPermission === 'unsupported' || !isPushSupportedOnDevice()) {
    return {
      shouldShowPopup: false,
      reason: 'unsupported',
      browserPermission,
      hasValidSubscription: false,
      preferences: prefs,
    };
  }

  // Logged-in path shares full device health & anonymous-claim sync
  if (uid) {
    const health = await checkCurrentDevicePushHealth(uid, prefs, email);
    if (health.browserPermission === 'granted' && health.hasActiveSubscriptionOnThisDevice) {
      clearNotificationPromptDismissal();
      return {
        shouldShowPopup: false,
        reason: 'already_active',
        browserPermission: 'granted',
        hasValidSubscription: true,
        preferences: prefs,
      };
    }

    if (isPromptDismissedInSessionOrCooldown(prefs)) {
      return {
        shouldShowPopup: false,
        reason: 'dismissed_cooldown',
        browserPermission: health.browserPermission,
        hasValidSubscription: false,
        preferences: prefs,
      };
    }

    if (health.browserPermission === 'denied') {
      return {
        shouldShowPopup: true,
        reason: 'blocked_in_browser',
        browserPermission: 'denied',
        hasValidSubscription: false,
        preferences: prefs,
      };
    }

    if (health.needsRenewalOnThisDevice) {
      return {
        shouldShowPopup: true,
        reason: 'renew_device',
        browserPermission: health.browserPermission,
        hasValidSubscription: false,
        preferences: prefs,
      };
    }

    return {
      shouldShowPopup: true,
      reason: prefs ? 'not_enabled_yet' : 'first_time',
      browserPermission: health.browserPermission,
      hasValidSubscription: false,
      preferences: prefs,
    };
  }

  // Anonymous visitor path
  let browserSub: PushSubscription | null = null;
  let reg: ServiceWorkerRegistration | null = null;
  try {
    reg = await registerServiceWorkerSafe();
    if (reg?.pushManager) {
      browserSub = await reg.pushManager.getSubscription();
    }
  } catch {}

  if (browserPermission === 'granted') {
    const publicKey = await fetchVapidPublicKeySafe();
    if (browserSub && publicKey && !isSubscriptionVapidMatch(browserSub, publicKey)) {
      try {
        await browserSub.unsubscribe();
        browserSub = await reg!.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        });
      } catch {}
    } else if (!browserSub && reg?.pushManager && publicKey) {
      // Browser already allows notifications — subscribe silently without showing popup
      try {
        browserSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        });
      } catch {}
    }

    const subJson = browserSub?.toJSON();
    if (browserSub && subJson?.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
      const deviceMeta = getDeviceMetadata();
      const cachedAnon = readAnonPushCache();
      if (!cachedAnon || cachedAnon.subscription?.endpoint !== subJson.endpoint) {
        await persistAnonymousPushSubscription(subJson, deviceMeta).catch(() => null);
      }
      clearNotificationPromptDismissal();
      return {
        shouldShowPopup: false,
        reason: 'already_active',
        browserPermission: 'granted',
        hasValidSubscription: true,
        preferences: null,
      };
    }
  }

  if (isPromptDismissedInSessionOrCooldown(null)) {
    return {
      shouldShowPopup: false,
      reason: 'dismissed_cooldown',
      browserPermission,
      hasValidSubscription: false,
      preferences: null,
    };
  }

  if (browserPermission === 'denied') {
    return {
      shouldShowPopup: true,
      reason: 'blocked_in_browser',
      browserPermission: 'denied',
      hasValidSubscription: false,
      preferences: null,
    };
  }

  return {
    shouldShowPopup: true,
    reason: browserPermission === 'granted' ? 'renew_device' : 'first_time',
    browserPermission,
    hasValidSubscription: false,
    preferences: null,
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
  reason:
    | 'first_time'
    | 'not_enabled_yet'
    | 'renew_device'
    | 'blocked_in_browser'
    | 'ios_install_required'
    | 'already_active'
    | 'unsupported';
} {
  const { prefs, browserPermission, hasActiveDeviceSub, needsDeviceRenewal, alreadyPromptedThisLogin } = args;

  if (browserPermission === 'granted' && hasActiveDeviceSub) {
    return { shouldShowModal: false, reason: 'already_active' };
  }

  if (isIosSafariNeedsInstall()) {
    if (isPromptDismissedInSessionOrCooldown(prefs)) {
      return { shouldShowModal: false, reason: 'ios_install_required' };
    }
    return { shouldShowModal: !alreadyPromptedThisLogin, reason: 'ios_install_required' };
  }

  if (browserPermission === 'unsupported') {
    return {
      shouldShowModal: false,
      reason: 'unsupported',
    };
  }

  if (isPromptDismissedInSessionOrCooldown(prefs)) {
    return {
      shouldShowModal: false,
      reason: browserPermission === 'denied' ? 'blocked_in_browser' : 'already_active',
    };
  }

  if (browserPermission === 'denied') {
    return { shouldShowModal: !alreadyPromptedThisLogin, reason: 'blocked_in_browser' };
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
  uid?: string | null,
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
    if (uid) {
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
        success: false,
        permissionStatus: 'unsupported',
        subscriptionActive: false,
        preferences: saved,
        message: isIosSafariNeedsInstall()
          ? 'In Safari on iOS, tap Share and Add to Home Screen to enable Web Push alerts. Your Dashboard Notification Bell remains active.'
          : 'Web Push notifications are not supported by this browser.',
      };
    }
    return {
      success: false,
      permissionStatus: 'unsupported',
      subscriptionActive: false,
      preferences: null,
      message: isIosSafariNeedsInstall()
        ? 'In Safari on iOS, tap Share and Add to Home Screen to enable Web Push alerts.'
        : 'Web Push notifications are not supported by this browser.',
    };
  }

  // Never repeatedly call Notification.requestPermission() if browser permission is already denied
  let permResult: NotificationPermission = Notification.permission;
  if (permResult === 'denied') {
    const saved = uid
      ? await saveUserNotificationPreferences(
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
        )
      : null;
    return {
      success: false,
      permissionStatus: 'denied',
      subscriptionActive: false,
      preferences: saved,
      message:
        'Notifications are blocked in your browser settings. Follow the instructions above to allow notifications for this site, then check again.',
    };
  }

  if (permResult === 'default') {
    try {
      permResult = await Notification.requestPermission();
    } catch {
      permResult = Notification.permission;
    }
  }

  if (permResult === 'denied') {
    const saved = uid
      ? await saveUserNotificationPreferences(
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
        )
      : null;
    return {
      success: false,
      permissionStatus: 'denied',
      subscriptionActive: false,
      preferences: saved,
      message:
        'Notifications were blocked by the browser. Please allow Notifications in your browser Site Settings to enable job alerts.',
    };
  }

  if (permResult !== 'granted') {
    const saved = await recordNotificationPromptDismissal(uid, options.email);
    return {
      success: false,
      permissionStatus: 'default',
      subscriptionActive: false,
      preferences: saved,
      message: 'Notification prompt was dismissed. You can enable job alerts anytime.',
    };
  }

  // Permission granted -> register SW, verify production VAPID, subscribe, and confirm durable DB write
  try {
    const reg = await registerServiceWorkerSafe();
    if (!reg?.pushManager) {
      throw new Error('Production Service Worker PushManager is unavailable in this browser.');
    }
    const publicKey = await fetchVapidPublicKeySafe();
    if (!publicKey) {
      throw new Error('Could not retrieve production Web Push VAPID public key.');
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
    if (!subJson?.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      throw new Error('Browser created an incomplete push subscription without encryption keys.');
    }

    if (uid) {
      const persistRes = await persistPushSubscriptionToFirestoreAndServer(
        uid,
        subJson,
        deviceMeta,
        options.email
      );
      if (!persistRes.serverSaved && !persistRes.firestoreSaved) {
        throw new Error(
          'Push subscription could not be saved to our database. Please check your connection and try again.'
        );
      }

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
          deviceSubscriptions: persistRes.serverPrefs?.deviceSubscriptions,
        },
        options.email
      );
      clearNotificationPromptDismissal();
      try {
        localStorage.removeItem(ANON_PUSH_SUB_KEY);
      } catch {}

      return {
        success: true,
        permissionStatus: 'granted',
        subscriptionActive: true,
        preferences: saved || persistRes.serverPrefs || null,
        message: 'Instant job notifications are enabled and saved to your account!',
      };
    }

    // Anonymous visitor path: persist to backend & anonymous_push_subscriptions before confirming success
    const anonPersist = await persistAnonymousPushSubscription(subJson, deviceMeta);
    if (!anonPersist.saved) {
      throw new Error(
        'Push subscription could not be saved to the database right now. Please try again.'
      );
    }
    clearNotificationPromptDismissal();
    return {
      success: true,
      permissionStatus: 'granted',
      subscriptionActive: true,
      preferences: null,
      message: 'Instant job alerts are active! Sign in or register anytime to sync them with your profile.',
    };
  } catch (err: any) {
    return {
      success: false,
      permissionStatus: 'granted',
      subscriptionActive: false,
      preferences: null,
      message: err?.message || 'Unable to save your push subscription to the database. Please try again.',
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

export async function sendAuthorizedDeviceTestPush(
  adminEmailOverride?: string
): Promise<{
  success: boolean;
  statusCode?: number;
  platform?: string;
  deviceLabel?: string;
  deliveredAt?: string;
  message?: string;
  error?: string;
}> {
  const deviceMeta = getDeviceMetadata();
  let subJson: PushSubscriptionJSON | undefined;

  if (isPushSupportedOnDevice()) {
    try {
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
      }
      if (perm === 'granted') {
        const reg = await registerServiceWorkerSafe();
        const publicKey = await fetchVapidPublicKeySafe();
        if (reg?.pushManager && publicKey) {
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
          const candidate = sub.toJSON();
          if (candidate?.endpoint && candidate.keys?.p256dh && candidate.keys?.auth) {
            subJson = candidate;
          }
        }
      }
    } catch {}
  }

  const res = await fetch('/api/admin/push/test-device', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOwnerAuthHeaders(adminEmailOverride),
    },
    credentials: 'include',
    body: JSON.stringify({
      ...(subJson ? { subscription: subJson } : {}),
      deviceLabel: deviceMeta.deviceLabel,
      platform: deviceMeta.platform,
    }),
  });
  return res.json();
}

const AMHARIC_SIGNUP_PROMO_DISMISS_KEY = 'hopelandjobs_amharic_signup_promo_dismiss';
const AMHARIC_SIGNUP_PROMO_SESSION_KEY = 'hopelandjobs_amharic_signup_promo_session';
const AMHARIC_PROMO_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours

export function isAmharicSignupPromoDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(AMHARIC_SIGNUP_PROMO_SESSION_KEY) === '1') return true;
    const raw = localStorage.getItem(AMHARIC_SIGNUP_PROMO_DISMISS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { dismissedAt?: number };
    const dismissedAt = Number(parsed?.dismissedAt || 0);
    if (!dismissedAt || Number.isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < AMHARIC_PROMO_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function recordAmharicSignupPromoDismissed(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(AMHARIC_SIGNUP_PROMO_SESSION_KEY, '1');
    localStorage.setItem(
      AMHARIC_SIGNUP_PROMO_DISMISS_KEY,
      JSON.stringify({ dismissedAt: Date.now() })
    );
  } catch {}
}

export function clearAmharicSignupPromoDismissed(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(AMHARIC_SIGNUP_PROMO_SESSION_KEY);
    localStorage.removeItem(AMHARIC_SIGNUP_PROMO_DISMISS_KEY);
  } catch {}
}

export async function fetchAdminNotificationPolicy(
  adminEmailOverride?: string
): Promise<import('../types/jobSeeker').NotificationPolicyConfig | null> {
  try {
    const res = await fetch('/api/admin/notifications/policy', {
      headers: getOwnerAuthHeaders(adminEmailOverride),
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.policy || null;
  } catch {
    return null;
  }
}

export async function updateAdminNotificationPolicy(
  payload: {
    defaultFrequency: 'instant' | 'daily' | 'weekly';
    dailyCapPerUser: number;
    allowPromotionalAnnouncements?: boolean;
    applyFrequencyToExistingUsers?: boolean;
  },
  adminEmailOverride?: string
): Promise<{
  success: boolean;
  policy?: import('../types/jobSeeker').NotificationPolicyConfig;
  usersUpdated?: number;
  error?: string;
}> {
  const res = await fetch('/api/admin/notifications/policy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOwnerAuthHeaders(adminEmailOverride),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateAdminUserNotificationPreferences(
  uid: string,
  payload: {
    frequency?: 'instant' | 'daily' | 'weekly';
    websiteBell?: boolean;
    browserPush?: boolean;
    mobilePush?: boolean;
  },
  adminEmailOverride?: string
): Promise<{
  success: boolean;
  preferences?: NotificationPreferencesRecord;
  summary?: RegisteredUserAnalyticsSummary;
  error?: string;
}> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/notification-preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOwnerAuthHeaders(adminEmailOverride),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function sendAdminBroadcastNotification(
  payload: {
    title: string;
    message: string;
    audience: 'all_subscribed' | 'completed_profiles' | 'by_sector' | 'all_registered';
    sector?: string;
    vacancyId?: string;
  },
  adminEmailOverride?: string
): Promise<{
  success: boolean;
  targetedUsersCount?: number;
  websiteDeliveredCount?: number;
  pushDeliveredCount?: number;
  pushFailedCount?: number;
  emailsSent?: number;
  errors?: string[];
  error?: string;
}> {
  const res = await fetch('/api/admin/notifications/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOwnerAuthHeaders(adminEmailOverride),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return res.json();
}

