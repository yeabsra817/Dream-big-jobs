import {
  doc,
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
  getOwnerAuthHeaders,
  sanitizeForFirestore,
  withTimeout,
} from './firebase';
import {
  AdminSchedulerStatusResponse,
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
      .then((reg) => reg)
      .catch((err) => {
        console.warn('Service Worker registration notice:', err?.message || err);
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

function userHeaders(uid: string, email?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'x-user-uid': uid,
  };
  const resolvedEmail = email || auth.currentUser?.email || '';
  if (resolvedEmail) headers['x-user-email'] = resolvedEmail;
  return headers;
}

export async function fetchUserNotificationPreferences(
  uid: string,
  email?: string | null
): Promise<NotificationPreferencesRecord | null> {
  if (!uid) return null;
  try {
    const res = await fetch(`/api/user/notification-preferences/${encodeURIComponent(uid)}`, {
      headers: userHeaders(uid, email),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.preferences) {
        try {
          localStorage.setItem(`hopelandjobs_notif_prefs_${uid}`, JSON.stringify(data.preferences));
        } catch {}
        return data.preferences as NotificationPreferencesRecord;
      }
    }
  } catch {}
  try {
    const cached = localStorage.getItem(`hopelandjobs_notif_prefs_${uid}`);
    return cached ? (JSON.parse(cached) as NotificationPreferencesRecord) : null;
  } catch {
    return null;
  }
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
  try {
    const res = await fetch(`/api/user/notification-preferences/${encodeURIComponent(uid)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...userHeaders(uid, email),
      },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      savedPrefs = data?.preferences || null;
      if (savedPrefs) {
        try {
          localStorage.setItem(`hopelandjobs_notif_prefs_${uid}`, JSON.stringify(savedPrefs));
        } catch {}
      }
    }
  } catch {}

  if (savedPrefs && auth.currentUser?.uid === uid) {
    try {
      const clean = sanitizeForFirestore({
        userId: uid,
        permissionStatus: savedPrefs.permissionStatus,
        subscriptionStatus: savedPrefs.subscriptionStatus,
        frequency: savedPrefs.frequency || 'instant',
        enabledAt: savedPrefs.enabledAt || null,
        permissionVerifiedAt: savedPrefs.permissionVerifiedAt || null,
        lastSuccessfulDeliveryAt: savedPrefs.lastSuccessfulDeliveryAt || null,
        channels: savedPrefs.channels,
        alertTypes: savedPrefs.alertTypes,
        updatedAt: savedPrefs.updatedAt,
      });
      await withTimeout(setDoc(doc(db, 'user_notification_preferences', uid), clean, { merge: true }), 3000, undefined);
    } catch {}
  }

  return savedPrefs;
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
  const { deviceId } = getDeviceMetadata();

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
  try {
    const reg = await registerServiceWorkerSafe();
    if (reg?.pushManager) {
      browserSub = await reg.pushManager.getSubscription();
    }
  } catch {}

  const serverDevice = (prefs?.deviceSubscriptions || []).find((d) => d.deviceId === deviceId && d.active);
  const hasActiveSubscriptionOnThisDevice = Boolean(
    browserPermission === 'granted' && browserSub && serverDevice
  );

  // If browser granted permission and has a subscription not yet stored for this deviceId, sync silently!
  if (browserPermission === 'granted' && browserSub && !serverDevice && prefs?.channels?.browserPush) {
    const dev = getDeviceMetadata();
    try {
      await fetch(`/api/push/subscribe/${encodeURIComponent(uid)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...userHeaders(uid, email) },
        body: JSON.stringify({ ...dev, subscription: browserSub.toJSON() }),
      });
      return {
        browserPermission: 'granted',
        hasActiveSubscriptionOnThisDevice: true,
        needsRenewalOnThisDevice: false,
      };
    } catch {}
  }

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
 * Exact Req 10F Prompt State Evaluator:
 * Never repeatedly prompts once notifications are granted & active on the current device.
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
    // Only show instructions on explicit demand or once per session if user enabled alerts before
    return { shouldShowModal: !alreadyPromptedThisLogin && prefs?.permissionStatus === 'granted', reason: 'blocked_in_browser' };
  }

  if (browserPermission === 'unsupported') {
    // Website Bell + Email Alerts still active without browser push
    const emailSet = Boolean(prefs?.enabledAt || prefs?.channels?.websiteBell);
    return {
      shouldShowModal: !alreadyPromptedThisLogin && !prefs?.enabledAt && !emailSet,
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
          emailAlerts: options.emailAlerts !== false,
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
        ? 'Website bell and email job alerts enabled! Add Hopeland Jobs to your iPhone Home Screen to also receive iOS push alerts.'
        : 'Website notification bell and email alerts are enabled for your account.',
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
          emailAlerts: options.emailAlerts !== false,
        },
      },
      options.email
    );
    return {
      success: false,
      permissionStatus: 'denied',
      subscriptionActive: false,
      preferences: saved,
      message: 'Browser notifications are currently blocked. Enable Notifications for this site in your browser settings, then click Check Again.',
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
          emailAlerts: options.emailAlerts !== false,
        },
      },
      options.email
    );
    return {
      success: false,
      permissionStatus: 'default',
      subscriptionActive: false,
      preferences: saved,
      message: 'Permission prompt was dismissed. Website notification bell remains active, and we will remind you on your next login.',
    };
  }

  // Permission granted -> register SW + subscribe with VAPID key
  try {
    const reg = await registerServiceWorkerSafe();
    if (!reg?.pushManager) {
      throw new Error('Service Worker PushManager unavailable in this browser');
    }
    const keyRes = await fetch('/api/push/vapid-public-key');
    if (!keyRes.ok) {
      throw new Error('Could not retrieve Web Push VAPID public key');
    }
    const { publicKey } = await keyRes.json();

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
    }

    const subRes = await fetch(`/api/push/subscribe/${encodeURIComponent(uid)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...userHeaders(uid, options.email),
      },
      body: JSON.stringify({
        ...deviceMeta,
        subscription: sub.toJSON(),
      }),
    });

    const subData = subRes.ok ? await subRes.json() : null;
    const subJson = sub.toJSON();
    if (auth.currentUser?.uid === uid && subJson?.endpoint) {
      const safeSubId = `${uid}_${deviceMeta.deviceId}`.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
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
              active: true,
              updatedAt: new Date().toISOString(),
            }),
            { merge: true }
          ),
          3000,
          undefined
        );
      } catch {}
    }

    const saved = await saveUserNotificationPreferences(
      uid,
      {
        permissionStatus: 'granted',
        subscriptionStatus: 'active',
        channels: {
          websiteBell: options.websiteBell !== false,
          browserPush: true,
          mobilePush: deviceMeta.platform === 'android' || deviceMeta.platform === 'ios',
          emailAlerts: options.emailAlerts !== false,
        },
      },
      options.email
    );

    return {
      success: true,
      permissionStatus: 'granted',
      subscriptionActive: true,
      preferences: saved || subData?.preferences || null,
      message: 'Job alert notifications are now enabled across this device and your dashboard!',
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
          emailAlerts: options.emailAlerts !== false,
        },
      },
      options.email
    );
    return {
      success: true,
      permissionStatus: 'granted',
      subscriptionActive: false,
      preferences: saved,
      message: `Permission granted! Website bell & email alerts are active (Push note: ${err?.message || 'browser push unavailable'}).`,
    };
  }
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
      return {
        notifications: Array.isArray(data?.notifications) ? data.notifications : [],
        unreadCount: Number(data?.unreadCount || 0),
      };
    }
  } catch {}

  // Fallback to Firestore if offline server unavailable
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

export async function syncVacanciesToServerCatalog(
  vacancies: Vacancy[],
  options: { mode?: 'merge' | 'replace' | 'seed_if_empty'; changedVacancyId?: string; changeType?: 'published' | 'updated' } = {}
): Promise<void> {
  if (!Array.isArray(vacancies) || vacancies.length === 0) return;
  try {
    await withTimeout(
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
          changeType: options.changeType,
        }),
      }),
      3500,
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
