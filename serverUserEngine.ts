import type { Express, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import {
  computeStaffOpportunityRecommendations,
  hasCompletedMandatoryPreferences,
  isDeadlineExpired,
  isStrictJobFitForUser,
  isVerifiedActiveVacancy,
  RecommendedOpportunity,
} from './src/utils/recommendationCore';
import { evaluateMandatoryProfileCompletion } from './src/types/jobSeeker';

export interface ServerUserEngineContext {
  app: Express;
  runtimeBaseDir: string;
  isVercel?: boolean;
  ensureRuntimeDataDir: () => string;
  loadJsonFileSafe: <T>(filePath: string, fallback: T) => T;
  writeJsonFileAtomic: (filePath: string, data: any) => boolean;
  loadUserProfiles: () => Record<string, any>;
  saveUserProfileMap: (profiles: Record<string, any>) => void;
  loadJobApplications: () => any[];
  loadPersistedSettings: () => any;
  loadPersistedInternationalData: () => {
    internationalJobs?: any[];
    immigrationPathways?: any[];
    experienceScholarships?: any[];
  };
  isPersistentOwnerRequest: (req: Request) => boolean;
  getRequesterUid: (req: Request) => string;
  getRequesterEmail: (req: Request) => string;
  appendAuditLog: (entry: {
    action: string;
    actorEmail?: string;
    actorUid?: string;
    targetType: string;
    targetId?: string;
    summary: string;
    severity?: 'info' | 'warning' | 'critical';
  }) => void;
  pushAdminNotification: (notif: {
    type: string;
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'critical';
  }) => void;
}

export function registerUserNotificationAndAnalyticsRoutes(ctx: ServerUserEngineContext) {
  const {
    app,
    runtimeBaseDir,
    isVercel = false,
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    loadUserProfiles,
    saveUserProfileMap,
    loadJobApplications,
    loadPersistedSettings,
    loadPersistedInternationalData,
    isPersistentOwnerRequest,
    getRequesterUid,
    getRequesterEmail,
    appendAuditLog,
    pushAdminNotification,
  } = ctx;

  const DATA_DIR = path.join(runtimeBaseDir, 'data');
  const VACANCIES_CATALOG_FILE = path.join(DATA_DIR, 'vacancies_catalog.json');
  const USER_RECOMMENDATIONS_FILE = path.join(DATA_DIR, 'user_recommendations.json');
  const USER_NOTIFICATIONS_FILE = path.join(DATA_DIR, 'user_notifications.json');
  const NOTIFICATION_PREFS_FILE = path.join(DATA_DIR, 'notification_preferences.json');
  const NOTIFICATION_QUEUE_FILE = path.join(DATA_DIR, 'notification_queue.json');
  const SCHEDULER_RUNS_FILE = path.join(DATA_DIR, 'scheduler_runs.json');
  const ANONYMOUS_PUSH_FILE = path.join(DATA_DIR, 'anonymous_push_subscriptions.json');
  const PUSH_DELIVERY_LOGS_FILE = path.join(DATA_DIR, 'push_delivery_logs.json');
  const NOTIFICATION_POLICY_FILE = path.join(DATA_DIR, 'notification_policy.json');
  const VAPID_KEYS_FILE = path.join(DATA_DIR, 'vapid_keys.json');

  let webpushLib: any = null;
  let nodemailerLib: any = null;
  let vapidKeysCache: { publicKey: string; privateKey: string } | null = null;
  let webPushConfigured = false;
  let backgroundQueueActive = false;
  let schedulerRunActive = false;

  async function ensureWebPush(): Promise<any | null> {
    if (webPushConfigured && webpushLib) return webpushLib;
    try {
      const mod: any = await import('web-push');
      webpushLib = mod.default || mod;
      const envPub = (process.env.VAPID_PUBLIC_KEY || '').trim();
      const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
      if (envPub && envPriv) {
        vapidKeysCache = { publicKey: envPub, privateKey: envPriv };
      } else {
        const persisted = loadJsonFileSafe<{ publicKey?: string; privateKey?: string }>(VAPID_KEYS_FILE, {});
        if (persisted?.publicKey && persisted?.privateKey) {
          vapidKeysCache = { publicKey: persisted.publicKey, privateKey: persisted.privateKey };
        } else {
          const generated = webpushLib.generateVAPIDKeys();
          vapidKeysCache = { publicKey: generated.publicKey, privateKey: generated.privateKey };
          ensureRuntimeDataDir();
          writeJsonFileAtomic(VAPID_KEYS_FILE, {
            ...vapidKeysCache,
            createdAt: new Date().toISOString(),
          });
        }
      }
      const subject = (process.env.VAPID_SUBJECT || 'mailto:nexusitsoultion@gmail.com').trim();
      webpushLib.setVapidDetails(subject, vapidKeysCache.publicKey, vapidKeysCache.privateKey);
      webPushConfigured = true;
      return webpushLib;
    } catch (err: any) {
      console.warn('Web Push init notice:', err?.message || err);
      return null;
    }
  }

  function isSmtpConfigured(): boolean {
    return Boolean(
      (process.env.SMTP_HOST || '').trim() &&
        (process.env.SMTP_USER || '').trim() &&
        (process.env.SMTP_PASS || '').trim()
    );
  }

  function getEnvironmentReadinessReport() {
    const envPub = (process.env.VAPID_PUBLIC_KEY || '').trim();
    const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
    const persistedVapid = loadJsonFileSafe<{ publicKey?: string; privateKey?: string }>(VAPID_KEYS_FILE, {});
    const hasEnvVapid = Boolean(envPub && envPriv);
    const hasFileVapid = Boolean(persistedVapid?.publicKey && persistedVapid?.privateKey);

    const smtpHost = (process.env.SMTP_HOST || '').trim();
    const smtpPort = (process.env.SMTP_PORT || '587').trim();
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPassConfigured = Boolean((process.env.SMTP_PASS || '').trim());
    const smtpFrom = (process.env.SMTP_FROM || smtpUser || 'nexusitsoultion@gmail.com').trim();
    const vapidSubject = (process.env.VAPID_SUBJECT || 'mailto:nexusitsoultion@gmail.com').trim();
    const geminiConfigured = Boolean((process.env.GEMINI_API_KEY || '').trim());
    const cronSecretConfigured = Boolean((process.env.CRON_SECRET || '').trim());

    const missingEnvVars: string[] = [];
    if (!smtpHost) missingEnvVars.push('SMTP_HOST');
    if (!smtpUser) missingEnvVars.push('SMTP_USER');
    if (!smtpPassConfigured) missingEnvVars.push('SMTP_PASS');
    if (!envPub) missingEnvVars.push('VAPID_PUBLIC_KEY');
    if (!envPriv) missingEnvVars.push('VAPID_PRIVATE_KEY');
    if (!geminiConfigured) missingEnvVars.push('GEMINI_API_KEY');

    return {
      runtime: (isVercel ? 'vercel_serverless' : 'node_server') as 'vercel_serverless' | 'node_server',
      smtpConfigured: Boolean(smtpHost && smtpUser && smtpPassConfigured),
      smtpHost: smtpHost || 'not_set',
      smtpPort,
      smtpUserConfigured: Boolean(smtpUser),
      smtpPassConfigured,
      smtpFrom,
      vapidConfigured: hasEnvVapid || hasFileVapid,
      vapidSource: (hasEnvVapid ? 'environment' : hasFileVapid ? 'persisted_file' : 'unset') as
        | 'environment'
        | 'persisted_file'
        | 'unset',
      vapidSubject,
      geminiConfigured,
      cronSecretConfigured,
      missingEnvVars,
    };
  }

  // Startup environment validation without exposing any secret values
  (() => {
    const report = getEnvironmentReadinessReport();
    if (report.missingEnvVars.length > 0) {
      console.warn(
        `[HOPELAND ENV CHECK] Runtime=${report.runtime} · SMTP=${report.smtpConfigured ? 'ready' : 'missing'} · VAPID=${report.vapidSource} · GEMINI=${report.geminiConfigured ? 'ready' : 'missing'} · Unset env vars: ${report.missingEnvVars.join(', ')}`
      );
    } else {
      console.log(
        `[HOPELAND ENV CHECK] Runtime=${report.runtime} · All required SMTP, VAPID, and Gemini environment variables validated.`
      );
    }
  })();

  async function ensureNodemailer(): Promise<any | null> {
    if (!isSmtpConfigured()) return null;
    if (nodemailerLib) return nodemailerLib;
    try {
      const mod: any = await import('nodemailer');
      nodemailerLib = mod.default || mod;
      return nodemailerLib;
    } catch {
      return null;
    }
  }

  function loadVacanciesCatalog(): any[] {
    const list = loadJsonFileSafe<any[]>(VACANCIES_CATALOG_FILE, []);
    return Array.isArray(list) ? list : [];
  }

  function saveVacanciesCatalog(list: any[]): void {
    ensureRuntimeDataDir();
    writeJsonFileAtomic(VACANCIES_CATALOG_FILE, list);
  }

  function loadAllRecommendations(): Record<string, { recalculatedAt: string; items: RecommendedOpportunity[] }> {
    const data = loadJsonFileSafe<Record<string, any>>(USER_RECOMMENDATIONS_FILE, {});
    return data && typeof data === 'object' ? data : {};
  }

  function saveAllRecommendations(map: Record<string, any>): void {
    ensureRuntimeDataDir();
    writeJsonFileAtomic(USER_RECOMMENDATIONS_FILE, map);
  }

  function loadAllNotifications(): Record<string, any[]> {
    const data = loadJsonFileSafe<Record<string, any[]>>(USER_NOTIFICATIONS_FILE, {});
    return data && typeof data === 'object' ? data : {};
  }

  function saveAllNotifications(map: Record<string, any[]>): void {
    ensureRuntimeDataDir();
    writeJsonFileAtomic(USER_NOTIFICATIONS_FILE, map);
  }

  function loadAllNotificationPrefs(): Record<string, any> {
    const data = loadJsonFileSafe<Record<string, any>>(NOTIFICATION_PREFS_FILE, {});
    return data && typeof data === 'object' ? data : {};
  }

  function saveAllNotificationPrefs(map: Record<string, any>): void {
    ensureRuntimeDataDir();
    writeJsonFileAtomic(NOTIFICATION_PREFS_FILE, map);
  }

  function loadAnonymousPushSubscriptions(): Record<string, any> {
    const data = loadJsonFileSafe<Record<string, any>>(ANONYMOUS_PUSH_FILE, {});
    return data && typeof data === 'object' ? data : {};
  }

  function saveAnonymousPushSubscriptions(map: Record<string, any>): void {
    ensureRuntimeDataDir();
    writeJsonFileAtomic(ANONYMOUS_PUSH_FILE, map);
  }

  function loadNotificationQueue(): any[] {
    const list = loadJsonFileSafe<any[]>(NOTIFICATION_QUEUE_FILE, []);
    return Array.isArray(list) ? list : [];
  }

  function saveNotificationQueue(list: any[]): void {
    ensureRuntimeDataDir();
    writeJsonFileAtomic(NOTIFICATION_QUEUE_FILE, list);
  }

  function loadPushDeliveryLogs(): any[] {
    const list = loadJsonFileSafe<any[]>(PUSH_DELIVERY_LOGS_FILE, []);
    return Array.isArray(list) ? list : [];
  }

  function appendPushDeliveryLog(entry: {
    userId: string;
    userName: string;
    userEmail: string;
    deviceId: string;
    platform: 'android' | 'ios' | 'desktop' | 'other';
    deviceLabel: string;
    jobId: string;
    jobTitle: string;
    employer: string;
    category: string;
    status: 'accepted' | 'failed' | 'expired';
    statusCode?: number;
    error?: string;
    isTest?: boolean;
  }): void {
    const list = loadPushDeliveryLogs();
    list.unshift({
      id: `pdl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
    ensureRuntimeDataDir();
    writeJsonFileAtomic(PUSH_DELIVERY_LOGS_FILE, list.slice(0, 250));
  }

  function normalizeDevicePlatform(
    platform?: string,
    deviceLabel?: string,
    endpoint?: string
  ): 'android' | 'ios' | 'desktop' | 'other' {
    const combined = `${platform || ''} ${deviceLabel || ''} ${endpoint || ''}`.toLowerCase();
    if (/iphone|ipad|ipod|\bios\b|web\.push\.apple\.com/.test(combined)) return 'ios';
    if (/android/.test(combined)) return 'android';
    if (/desktop|windows|macos|mac\b|linux|chrome|edge|firefox|safari|web/.test(combined)) return 'desktop';
    return 'other';
  }

  function loadSchedulerStore(): {
    lastRunStartedAt: string | null;
    lastSuccessfulRunAt: string | null;
    lastRunStatus: 'success' | 'partial' | 'failed' | null;
    recentErrors: Array<{ timestamp: string; source: string; message: string }>;
    runs: any[];
  } {
    const fallback = {
      lastRunStartedAt: null,
      lastSuccessfulRunAt: null,
      lastRunStatus: null,
      recentErrors: [],
      runs: [],
    };
    const data = loadJsonFileSafe<any>(SCHEDULER_RUNS_FILE, fallback);
    if (!data || typeof data !== 'object') return fallback;
    return {
      lastRunStartedAt: data.lastRunStartedAt || null,
      lastSuccessfulRunAt: data.lastSuccessfulRunAt || null,
      lastRunStatus: data.lastRunStatus || null,
      recentErrors: Array.isArray(data.recentErrors) ? data.recentErrors : [],
      runs: Array.isArray(data.runs) ? data.runs : [],
    };
  }

  function saveSchedulerStore(store: {
    lastRunStartedAt: string | null;
    lastSuccessfulRunAt: string | null;
    lastRunStatus: 'success' | 'partial' | 'failed' | null;
    recentErrors: Array<{ timestamp: string; source: string; message: string }>;
    runs: any[];
  }): void {
    ensureRuntimeDataDir();
    writeJsonFileAtomic(SCHEDULER_RUNS_FILE, {
      ...store,
      recentErrors: (store.recentErrors || []).slice(0, 30),
      runs: (store.runs || []).slice(0, 60),
    });
  }

  function recordSystemNotificationError(source: string, message: string): void {
    const store = loadSchedulerStore();
    store.recentErrors.unshift({
      timestamp: new Date().toISOString(),
      source,
      message: String(message || 'Unknown error').slice(0, 400),
    });
    saveSchedulerStore(store);
  }

  function getNextQuarterHourIso(fromDate = new Date()): string {
    const d = new Date(fromDate.getTime());
    const mins = d.getMinutes();
    const nextMin = Math.floor(mins / 15) * 15 + 15;
    d.setMinutes(nextMin, 0, 0);
    return d.toISOString();
  }

  function loadNotificationPolicy(): {
    defaultFrequency: 'instant' | 'daily' | 'weekly';
    dailyCapPerUser: number;
    allowPromotionalAnnouncements: boolean;
    updatedAt: string;
    updatedBy?: string;
  } {
    const fallback = {
      defaultFrequency: 'instant' as 'instant' | 'daily' | 'weekly',
      dailyCapPerUser: 3,
      allowPromotionalAnnouncements: true,
      updatedAt: new Date().toISOString(),
    };
    const data = loadJsonFileSafe<any>(NOTIFICATION_POLICY_FILE, fallback);
    const freq = ['instant', 'daily', 'weekly'].includes(data?.defaultFrequency)
      ? (data.defaultFrequency as 'instant' | 'daily' | 'weekly')
      : 'instant';
    const capNum = Number(data?.dailyCapPerUser);
    const dailyCapPerUser = Number.isFinite(capNum) ? Math.min(3, Math.max(1, Math.round(capNum))) : 3;
    return {
      defaultFrequency: freq,
      dailyCapPerUser,
      allowPromotionalAnnouncements: data?.allowPromotionalAnnouncements !== false,
      updatedAt: String(data?.updatedAt || fallback.updatedAt),
      updatedBy: data?.updatedBy ? String(data.updatedBy) : undefined,
    };
  }

  function saveNotificationPolicy(policy: {
    defaultFrequency: 'instant' | 'daily' | 'weekly';
    dailyCapPerUser: number;
    allowPromotionalAnnouncements: boolean;
    updatedAt: string;
    updatedBy?: string;
  }): void {
    ensureRuntimeDataDir();
    writeJsonFileAtomic(NOTIFICATION_POLICY_FILE, policy);
  }

  function buildDefaultPreferences(uid: string) {
    const policy = loadNotificationPolicy();
    return {
      userId: uid,
      permissionStatus: 'default',
      subscriptionStatus: 'none',
      manuallyDisabled: false,
      frequency: policy.defaultFrequency,
      promptDismissCount: 0,
      channels: {
        websiteBell: true,
        browserPush: true,
        mobilePush: true,
        emailAlerts: false,
      },
      alertTypes: {
        newMatches: true,
        deadlineReminders: true,
        jobChanges: true,
        sectorUpdates: true,
      },
      preferredSectors: [],
      deviceSubscriptions: [],
      updatedAt: new Date().toISOString(),
    };
  }

  function mergeExternalUsersSnapshot(snapshot: {
    profiles?: any[];
    preferences?: any[];
    pushSubscriptions?: any[];
  } | null | undefined) {
    if (!snapshot || typeof snapshot !== 'object') {
      return { profilesMerged: 0, prefsMerged: 0, subsMerged: 0 };
    }
    const profilesMap = loadUserProfiles();
    const prefsMap = loadAllNotificationPrefs();
    let profilesMerged = 0;
    let prefsMerged = 0;
    let subsMerged = 0;

    if (Array.isArray(snapshot.profiles)) {
      for (const incoming of snapshot.profiles) {
        if (!incoming?.uid) continue;
        const existing = profilesMap[incoming.uid];
        const incTs = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();
        const extTs = new Date(existing?.updatedAt || existing?.createdAt || 0).getTime();
        if (!existing || incTs >= extTs) {
          profilesMap[incoming.uid] = {
            ...(existing || {}),
            ...incoming,
            uid: incoming.uid,
            accountRole: incoming.accountRole || existing?.accountRole || 'staff',
            accountStatus: existing?.accountStatus || incoming.accountStatus || 'active',
          };
          profilesMerged += 1;
        }
        if (!prefsMap[incoming.uid]) {
          prefsMap[incoming.uid] = buildDefaultPreferences(incoming.uid);
        }
      }
      saveUserProfileMap(profilesMap);
    }

    if (Array.isArray(snapshot.preferences)) {
      for (const pref of snapshot.preferences) {
        const uid = pref?.userId;
        if (!uid) continue;
        const existing = prefsMap[uid] || buildDefaultPreferences(uid);
        const existingTs = new Date(existing.updatedAt || 0).getTime();
        const incomingTs = new Date(pref.updatedAt || 0).getTime();
        const base = incomingTs >= existingTs ? { ...existing, ...pref } : { ...pref, ...existing };
        prefsMap[uid] = {
          ...base,
          userId: uid,
          channels: {
            ...existing.channels,
            ...(pref.channels || {}),
            ...(incomingTs >= existingTs ? (pref.channels || {}) : (existing.channels || {})),
          },
          alertTypes: {
            ...existing.alertTypes,
            ...(pref.alertTypes || {}),
          },
          deviceSubscriptions:
            Array.isArray(pref.deviceSubscriptions) && pref.deviceSubscriptions.length > 0 && incomingTs >= existingTs
              ? pref.deviceSubscriptions
              : Array.isArray(existing.deviceSubscriptions) && existing.deviceSubscriptions.length > 0
              ? existing.deviceSubscriptions
              : Array.isArray(pref.deviceSubscriptions)
              ? pref.deviceSubscriptions
              : [],
        };
        prefsMerged += 1;
      }
    }

    if (Array.isArray(snapshot.pushSubscriptions)) {
      for (const subDoc of snapshot.pushSubscriptions) {
        const uid = subDoc?.userId;
        const endpoint = subDoc?.endpoint || subDoc?.subscription?.endpoint;
        if (!uid || !endpoint) continue;
        const pref = prefsMap[uid] || buildDefaultPreferences(uid);
        const devices: any[] = Array.isArray(pref.deviceSubscriptions) ? pref.deviceSubscriptions : [];
        const devId = String(subDoc.deviceId || endpoint.slice(-24));
        const filtered = devices.filter((d) => d.deviceId !== devId && d.endpoint !== endpoint);
        const keys = subDoc.keys || subDoc.subscription?.keys;
        if (subDoc.active !== false && !pref.manuallyDisabled && keys?.p256dh && keys?.auth) {
          filtered.unshift({
            deviceId: devId,
            deviceLabel: String(subDoc.deviceLabel || 'Web Browser'),
            platform: String(subDoc.platform || 'web'),
            endpoint,
            subscription: {
              endpoint,
              expirationTime: subDoc.expirationTime ?? subDoc.subscription?.expirationTime ?? null,
              keys: {
                p256dh: keys.p256dh,
                auth: keys.auth,
              },
            },
            active: true,
            createdAt: subDoc.createdAt || subDoc.updatedAt || new Date().toISOString(),
            lastVerifiedAt: subDoc.updatedAt || new Date().toISOString(),
          });
          pref.permissionStatus = 'granted';
          pref.subscriptionStatus = 'active';
          pref.channels = {
            ...pref.channels,
            websiteBell: true,
            browserPush: true,
            mobilePush:
              pref.channels?.mobilePush ||
              /android|iphone|ipad|ios|mobile/i.test(`${subDoc.platform || ''} ${subDoc.deviceLabel || ''}`),
          };
          subsMerged += 1;
        }
        pref.deviceSubscriptions = filtered.slice(0, 15);
        prefsMap[uid] = pref;
      }
    }

    saveAllNotificationPrefs(prefsMap);
    return { profilesMerged, prefsMerged, subsMerged };
  }

  function isSelfOrOwner(req: Request, targetUid: string): boolean {
    const reqUid = getRequesterUid(req);
    if (reqUid && reqUid === targetUid) return true;
    if (isPersistentOwnerRequest(req)) return true;
    return false;
  }

  function getAddisDateKey(dateInput?: string | Date): string {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Addis_Ababa',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  function buildJobUrl(vacancyId: string): string {
    const settings = loadPersistedSettings() || {};
    const domain = String(settings.customDomain || 'hopelandjobs.tech').replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${domain}/?jobId=${encodeURIComponent(vacancyId)}`;
  }

  async function sendWebPushToUser(
    uid: string,
    payload: {
      title: string;
      body: string;
      url: string;
      jobId: string;
      notificationId?: string;
      tag: string;
      jobTitle?: string;
      employer?: string;
      category?: string;
      isTest?: boolean;
    }
  ): Promise<{ deliveredCount: number; failedCount: number; expiredEndpoints: string[]; errors: string[] }> {
    const allPrefs = loadAllNotificationPrefs();
    const prefs = allPrefs[uid];
    if (!prefs || prefs.manuallyDisabled === true || (!prefs.channels?.browserPush && !prefs.channels?.mobilePush)) {
      return { deliveredCount: 0, failedCount: 0, expiredEndpoints: [], errors: [] };
    }
    const activeDevices = (prefs.deviceSubscriptions || []).filter((d: any) => d.active && d.subscription?.endpoint);
    if (activeDevices.length === 0) {
      return { deliveredCount: 0, failedCount: 0, expiredEndpoints: [], errors: [] };
    }

    const wp = await ensureWebPush();
    if (!wp) {
      return { deliveredCount: 0, failedCount: activeDevices.length, expiredEndpoints: [], errors: ['Web Push unavailable'] };
    }

    const profile = loadUserProfiles()[uid] || {};
    const userName = String(profile.fullName || 'Registered User');
    const userEmail = String(profile.email || '');

    let deliveredCount = 0;
    let failedCount = 0;
    const expiredEndpoints: string[] = [];
    const errors: string[] = [];
    let prefsDirty = false;
    const nowIso = new Date().toISOString();

    for (const dev of activeDevices) {
      const normalizedPlatform = normalizeDevicePlatform(dev.platform, dev.deviceLabel, dev.subscription?.endpoint);
      try {
        const pushRes = await wp.sendNotification(dev.subscription, JSON.stringify(payload), { TTL: 86400, timeout: 5000 });
        deliveredCount += 1;
        dev.lastDeliveredAt = nowIso;
        dev.lastVerifiedAt = nowIso;
        dev.lastFailureReason = undefined;
        prefs.lastSuccessfulDeliveryAt = nowIso;
        prefsDirty = true;
        appendPushDeliveryLog({
          userId: uid,
          userName,
          userEmail,
          deviceId: String(dev.deviceId || 'device'),
          platform: normalizedPlatform,
          deviceLabel: String(dev.deviceLabel || 'Browser'),
          jobId: String(payload.jobId || ''),
          jobTitle: String(payload.jobTitle || payload.title || 'Job Alert'),
          employer: String(payload.employer || 'Hopeland Jobs'),
          category: String(payload.category || ''),
          status: 'accepted',
          statusCode: Number(pushRes?.statusCode || 201),
          isTest: Boolean(payload.isTest),
        });
      } catch (err: any) {
        const statusCode = Number(err?.statusCode || err?.code || 0) || undefined;
        const msg = err?.message || String(err);
        const isExpired = statusCode === 404 || statusCode === 410;
        if (isExpired) {
          dev.active = false;
          dev.expiredAt = nowIso;
          dev.lastFailureReason = `Subscription expired (${statusCode})`;
          expiredEndpoints.push(dev.subscription.endpoint);
          prefsDirty = true;
        } else {
          dev.lastFailureReason = msg;
          prefsDirty = true;
        }
        failedCount += 1;
        errors.push(msg);
        appendPushDeliveryLog({
          userId: uid,
          userName,
          userEmail,
          deviceId: String(dev.deviceId || 'device'),
          platform: normalizedPlatform,
          deviceLabel: String(dev.deviceLabel || 'Browser'),
          jobId: String(payload.jobId || ''),
          jobTitle: String(payload.jobTitle || payload.title || 'Job Alert'),
          employer: String(payload.employer || 'Hopeland Jobs'),
          category: String(payload.category || ''),
          status: isExpired ? 'expired' : 'failed',
          statusCode,
          error: msg.slice(0, 220),
          isTest: Boolean(payload.isTest),
        });
      }
    }

    if (prefsDirty) {
      const stillHasActive = (prefs.deviceSubscriptions || []).some((d: any) => d.active);
      if (!stillHasActive && expiredEndpoints.length > 0) {
        prefs.subscriptionStatus = 'expired';
      }
      prefs.updatedAt = nowIso;
      allPrefs[uid] = prefs;
      saveAllNotificationPrefs(allPrefs);
    }

    return { deliveredCount, failedCount, expiredEndpoints, errors };
  }

  async function sendEmailAlertToUser(
    profile: any,
    notif: any
  ): Promise<{ status: 'sent' | 'failed' | 'skipped_no_smtp'; error?: string }> {
    if (!profile?.email) return { status: 'skipped_no_smtp', error: 'No registered email' };
    if (!isSmtpConfigured()) return { status: 'skipped_no_smtp' };
    const nm = await ensureNodemailer();
    if (!nm) return { status: 'skipped_no_smtp' };

    try {
      const transporter = nm.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const fromAddress = (process.env.SMTP_FROM || process.env.SMTP_USER || 'nexusitsoultion@gmail.com').trim();
      const salaryLine = notif.salary ? `<p><strong>Verified Salary:</strong> ${notif.salary}</p>` : '';
      const missingLine =
        notif.missingMandatoryQualifications?.length > 0
          ? `<p style="color:#b45309"><strong>Note on Mandatory Requirements:</strong> ${notif.missingMandatoryQualifications.join('; ')}</p>`
          : '';

      await transporter.sendMail({
        from: fromAddress,
        to: profile.email,
        subject: `New Job Recommendation for You! (${notif.matchScore}%): ${notif.title} at ${notif.employer}`,
        text: [
          `Hello ${profile.fullName || 'Candidate'},`,
          ``,
          `New Job Recommendation for You!`,
          `A new job matching your profile and qualifications has been published. Open Hopeland Jobs to view the details and apply.`,
          `Job Title: ${notif.title}`,
          `Employer: ${notif.employer}`,
          `Location: ${notif.location}`,
          notif.salary ? `Salary: ${notif.salary}` : '',
          `Deadline: ${notif.deadline || 'Open'}`,
          `Why it matches: ${notif.matchReasonSummary}`,
          notif.missingMandatoryQualifications?.length
            ? `Missing Mandatory Qualifications: ${notif.missingMandatoryQualifications.join('; ')}`
            : '',
          `View & Apply: ${notif.jobUrl}`,
        ]
          .filter(Boolean)
          .join('\n'),
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="background:#0B132B;color:#ffffff;padding:20px;">
              <h2 style="margin:0;color:#F59E0B;">HOPELAND JOBS — Personalized Opportunity Alert</h2>
              <p style="margin:6px 0 0;font-size:13px;color:#cbd5e1;">${notif.matchScore}% Profile Match</p>
            </div>
            <div style="padding:20px;color:#0f172a;font-size:14px;line-height:1.5;">
              <p>Hello <strong>${profile.fullName || 'Professional'}</strong>,</p>
              <h3 style="margin-bottom:4px;">${notif.title}</h3>
              <p style="margin-top:0;color:#475569;"><strong>Employer:</strong> ${notif.employer} · <strong>Location:</strong> ${notif.location}</p>
              ${salaryLine}
              <p><strong>Deadline:</strong> ${notif.deadline || 'Open'}</p>
              <p><strong>Why this matches you:</strong> ${notif.matchReasonSummary}</p>
              ${missingLine}
              <div style="margin-top:20px;">
                <a href="${notif.jobUrl}" style="display:inline-block;background:#0B132B;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;">
                  View Vacancy &amp; Apply
                </a>
              </div>
            </div>
          </div>
        `,
      });
      return { status: 'sent' };
    } catch (err: any) {
      return { status: 'failed', error: err?.message || String(err) };
    }
  }

  function enqueueDeliveryRetry(item: {
    userId: string;
    notificationId: string;
    channel: 'push' | 'email';
    payload: any;
    reason: string;
  }) {
    const queue = loadNotificationQueue();
    const exists = queue.some(
      (q) => q.notificationId === item.notificationId && q.channel === item.channel && q.status === 'pending'
    );
    if (exists) return;
    queue.unshift({
      id: `nq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: item.userId,
      notificationId: item.notificationId,
      channel: item.channel,
      payload: item.payload,
      attempts: 1,
      maxAttempts: 3,
      status: 'pending',
      lastError: item.reason,
      nextRetryAt: new Date(Date.now() + 30 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    saveNotificationQueue(queue.slice(0, 500));
  }

  async function processRetryQueueCycle(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
  }> {
    if (backgroundQueueActive) {
      return { processed: 0, succeeded: 0, failed: 0, errors: [] };
    }
    backgroundQueueActive = true;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];
    try {
      const queue = loadNotificationQueue();
      if (queue.length === 0) return { processed: 0, succeeded: 0, failed: 0, errors: [] };
      const now = Date.now();
      const profiles = loadUserProfiles();
      const allNotifs = loadAllNotifications();
      let changed = false;

      for (const qItem of queue) {
        if (qItem.status !== 'pending') continue;
        if (new Date(qItem.nextRetryAt).getTime() > now) continue;

        const profile = profiles[qItem.userId];
        if (!profile || profile.accountStatus === 'suspended') {
          qItem.status = 'failed';
          qItem.lastError = 'User account inactive or suspended';
          qItem.updatedAt = new Date().toISOString();
          changed = true;
          continue;
        }

        if (qItem.channel === 'push') {
          const pushRes = await sendWebPushToUser(qItem.userId, qItem.payload);
          if (pushRes.deliveredCount > 0) {
            qItem.status = 'delivered';
            qItem.updatedAt = new Date().toISOString();
            const userNotifs = allNotifs[qItem.userId] || [];
            const targetNotif = userNotifs.find((n: any) => n.id === qItem.notificationId);
            if (targetNotif) {
              targetNotif.channels.push = 'sent';
              targetNotif.updatedAt = new Date().toISOString();
            }
            changed = true;
          } else if (pushRes.expiredEndpoints.length > 0 && pushRes.failedCount === pushRes.expiredEndpoints.length) {
            qItem.status = 'failed';
            qItem.lastError = 'Push subscription expired (410/404)';
            qItem.updatedAt = new Date().toISOString();
            changed = true;
          } else {
            qItem.attempts += 1;
            qItem.lastError = pushRes.errors[0] || 'Push delivery retry failed';
            qItem.updatedAt = new Date().toISOString();
            if (qItem.attempts >= qItem.maxAttempts) {
              qItem.status = 'failed';
              pushAdminNotification({
                type: 'system_recovery',
                title: 'Push Notification Delivery Failure',
                message: `Failed pushing vacancy notification to ${profile.email || qItem.userId} after ${qItem.attempts} attempts: ${qItem.lastError}`,
                severity: 'warning',
              });
            } else {
              qItem.nextRetryAt = new Date(now + qItem.attempts * 2 * 60 * 1000).toISOString();
            }
            changed = true;
          }
        } else if (qItem.channel === 'email') {
          const emailRes = await sendEmailAlertToUser(profile, qItem.payload);
          processed += 1;
          if (emailRes.status === 'sent') {
            qItem.status = 'delivered';
            qItem.updatedAt = new Date().toISOString();
            const userNotifs = allNotifs[qItem.userId] || [];
            const targetNotif = userNotifs.find((n: any) => n.id === qItem.notificationId);
            if (targetNotif) {
              targetNotif.channels.email = 'sent';
              targetNotif.updatedAt = new Date().toISOString();
            }
            succeeded += 1;
            changed = true;
          } else if (emailRes.status === 'skipped_no_smtp') {
            qItem.status = 'failed';
            qItem.lastError = 'SMTP server not configured';
            qItem.updatedAt = new Date().toISOString();
            failed += 1;
            errors.push(`Email skipped (SMTP not configured) for ${qItem.userId}`);
            changed = true;
          } else {
            qItem.attempts += 1;
            qItem.lastError = emailRes.error || 'Email delivery failed';
            qItem.updatedAt = new Date().toISOString();
            errors.push(qItem.lastError);
            if (qItem.attempts >= qItem.maxAttempts) {
              qItem.status = 'failed';
              failed += 1;
              recordSystemNotificationError('email_retry', `Email alert failed for ${profile.email}: ${qItem.lastError}`);
              pushAdminNotification({
                type: 'system_recovery',
                title: 'Email Job Alert Failure',
                message: `Email alert failed for ${profile.email}: ${qItem.lastError}`,
                severity: 'warning',
              });
            } else {
              qItem.nextRetryAt = new Date(now + qItem.attempts * 5 * 60 * 1000).toISOString();
            }
            changed = true;
          }
        }
      }

      if (changed) {
        saveNotificationQueue(queue);
        saveAllNotifications(allNotifs);
      }
      return { processed, succeeded, failed, errors };
    } finally {
      backgroundQueueActive = false;
    }
  }

  function isFrequencyWindowReady(prefs: any, alertKind: string): boolean {
    if (alertKind === 'deadline_reminder') return true;
    const freq = (prefs?.frequency || 'instant') as 'instant' | 'daily' | 'weekly';
    if (freq === 'instant') return true;
    const lastDigestMs = prefs?.lastDigestSentAt ? new Date(prefs.lastDigestSentAt).getTime() : 0;
    if (!lastDigestMs) return true;
    const elapsedMs = Date.now() - lastDigestMs;
    if (freq === 'daily') return elapsedMs >= 23 * 60 * 60 * 1000;
    if (freq === 'weekly') return elapsedMs >= 6.5 * 24 * 60 * 60 * 1000;
    return true;
  }

  async function dispatchNotificationForUser(
    profile: any,
    rec: RecommendedOpportunity,
    alertKind: 'new_match' | 'deadline_reminder' | 'job_updated' | 'sector_opportunity',
    options: {
      dryRun?: boolean;
      ignoreFrequencyWindow?: boolean;
      bypassRateLimit?: boolean;
      isTestNotification?: boolean;
      customNote?: string;
    } = {}
  ): Promise<any | null> {
    if (!profile?.uid || profile.accountStatus === 'suspended') return null;

    const uid = profile.uid;
    const allPrefs = loadAllNotificationPrefs();
    const prefs = allPrefs[uid] || buildDefaultPreferences(uid);

    if (!options.isTestNotification) {
      // Check mandatory user profile completion before sending job alerts
      if (!hasCompletedMandatoryPreferences(profile)) return null;
      // Respect user opt-out for push & job alerts
      if (prefs.manuallyDisabled === true && prefs.channels?.websiteBell === false) return null;
      // Check user alert-type preferences
      if (alertKind === 'new_match' && prefs.alertTypes?.newMatches === false) return null;
      if (alertKind === 'deadline_reminder' && prefs.alertTypes?.deadlineReminders === false) return null;
      if (alertKind === 'job_updated' && prefs.alertTypes?.jobChanges === false) return null;
      if (alertKind === 'sector_opportunity' && prefs.alertTypes?.sectorUpdates === false) return null;
    }

    // Enforce user notification frequency preference (instant | daily | weekly)
    if (!options.ignoreFrequencyWindow && !isFrequencyWindowReady(prefs, alertKind)) {
      return null;
    }

    // Never send notifications for expired/closed vacancies
    if (!options.isTestNotification && isDeadlineExpired(rec.deadline)) return null;

    const dateStamp = alertKind === 'job_updated' ? `::${new Date().toISOString().slice(0, 10)}` : '';
    const dedupeKey = options.isTestNotification
      ? `test::${uid}::${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      : `${uid}::${rec.id}::${alertKind}${dateStamp}`;

    const allNotifs = loadAllNotifications();
    const existingList: any[] = Array.isArray(allNotifs[uid]) ? allNotifs[uid] : [];
    // Guarantee at most ONE notification per matching vacancy per user
    if (
      !options.isTestNotification &&
      existingList.some((n) => n.dedupeKey === dedupeKey || (n.vacancyId === rec.id && n.sourceType !== 'system'))
    ) {
      return null;
    }

    // Strict daily limit: maximum 3 job notifications per user per day
    if (!options.bypassRateLimit) {
      const policy = loadNotificationPolicy();
      const effectiveCap = Math.min(3, Math.max(1, policy.dailyCapPerUser || 3));
      const todayKey = getAddisDateKey(new Date());
      const twentyFourHoursAgoMs = Date.now() - 24 * 60 * 60 * 1000;
      const todayCount = existingList.filter((n) => {
        if (n.sourceType === 'system' || n.alertKind === 'system_test') return false;
        const ts = new Date(n.createdAt).getTime();
        return getAddisDateKey(n.createdAt) === todayKey || (!Number.isNaN(ts) && ts >= twentyFourHoursAgoMs);
      }).length;
      if (todayCount >= effectiveCap) {
        return null;
      }
    }

    const jobUrl = rec.sourceType === 'domestic_job' ? buildJobUrl(rec.id) : rec.applyUrl || buildJobUrl(rec.id);
    const nowIso = new Date().toISOString();
    const notifId = `unotif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const notifRecord: any = {
      id: notifId,
      userId: uid,
      vacancyId: rec.id,
      sourceType: rec.sourceType,
      alertKind,
      dedupeKey,
      title: options.isTestNotification ? `[Test Alert] ${rec.title}` : rec.title,
      employer: rec.organization,
      location: rec.location,
      category: rec.category,
      salary: rec.salary || undefined,
      deadline: rec.deadline || 'Open',
      matchScore: rec.matchScore,
      matchReasonSummary:
        options.customNote ||
        rec.matchReasons[0] ||
        `Matched your profile in ${rec.category}`,
      matchReasons: options.customNote ? [options.customNote, ...rec.matchReasons] : rec.matchReasons,
      missingMandatoryQualifications: rec.missingMandatoryQualifications || [],
      applicationUrl: rec.applyUrl || jobUrl,
      jobUrl,
      read: false,
      channels: {
        website: 'delivered',
        push: 'skipped',
        email: 'skipped',
      },
      createdAt: nowIso,
      expiresAt: rec.deadline && !/rolling|open|ongoing/i.test(rec.deadline) ? rec.deadline : undefined,
      updatedAt: nowIso,
    };

    if (options.dryRun) {
      return notifRecord;
    }

    // Save immediately to persistent Website Notification store
    allNotifs[uid] = [notifRecord, ...existingList].slice(0, 150);
    saveAllNotifications(allNotifs);

    // Real Web Push delivery directly to Android / iPhone PWA / Desktop notification panel
    const hasPushDevices = Boolean(prefs.deviceSubscriptions?.some((d: any) => d.active && d.subscription?.endpoint));
    if (
      prefs.manuallyDisabled !== true &&
      (prefs.channels?.browserPush || prefs.channels?.mobilePush || hasPushDevices) &&
      hasPushDevices
    ) {
      const pushTitle = options.isTestNotification
        ? `HOPELANDJOBS — Test Job Notification!`
        : alertKind === 'deadline_reminder'
        ? `HOPELANDJOBS — Closing Soon: ${rec.title}`
        : alertKind === 'job_updated'
        ? `HOPELANDJOBS — Updated Job Matching Your Profile!`
        : `HOPELANDJOBS — New Job Matching Your Profile!`;
      const pushBody = `${rec.title} — ${rec.organization} (${rec.location})\n${
        options.customNote
          ? options.customNote
          : `Matches your qualifications in ${rec.category}${rec.deadline ? ` · Deadline: ${rec.deadline}` : ''}.`
      } Tap to view the job and apply.`;
      const pushPayload = {
        title: pushTitle,
        body: pushBody,
        url:
          rec.sourceType === 'domestic_job'
            ? `/?jobId=${encodeURIComponent(rec.id)}&notificationId=${encodeURIComponent(notifId)}`
            : jobUrl,
        jobId: rec.id,
        notificationId: notifId,
        tag: `vacancy-${rec.id}`,
        jobTitle: rec.title,
        employer: rec.organization,
        category: rec.category,
        isTest: Boolean(options.isTestNotification),
      };
      const pushRes = await sendWebPushToUser(uid, pushPayload);
      if (pushRes.deliveredCount > 0) {
        notifRecord.channels.push = 'sent';
      } else if (pushRes.failedCount > 0) {
        notifRecord.channels.push = 'queued';
        enqueueDeliveryRetry({
          userId: uid,
          notificationId: notifId,
          channel: 'push',
          payload: pushPayload,
          reason: pushRes.errors[0] || 'Push delivery failed',
        });
      }
    }

    notifRecord.updatedAt = new Date().toISOString();
    allNotifs[uid] = [notifRecord, ...allNotifs[uid].filter((n: any) => n.id !== notifId)];
    saveAllNotifications(allNotifs);

    return notifRecord;
  }

  async function recalculateForUser(
    profile: any,
    options: {
      sendNotifications?: boolean;
      changedVacancyId?: string;
      changedVacancyIds?: string[];
      changeType?: 'published' | 'updated';
      dryRun?: boolean;
    } = {}
  ): Promise<{ recommendations: RecommendedOpportunity[]; newNotifications: any[] }> {
    if (!profile?.uid || profile.accountStatus === 'suspended') {
      return { recommendations: [], newNotifications: [] };
    }

    const vacancies = loadVacanciesCatalog().filter(isVerifiedActiveVacancy);
    const intl = loadPersistedInternationalData();
    const intlJobs = Array.isArray(intl.internationalJobs) ? intl.internationalJobs : [];
    const scholarships = Array.isArray(intl.experienceScholarships) ? intl.experienceScholarships : [];

    const recs = computeStaffOpportunityRecommendations(profile, vacancies, intlJobs, scholarships, 40);

    // Strip bulky nested full vacancy description objects before storing in user_recommendations.json
    const compactRecs = recs.map((r) => ({
      id: r.id,
      sourceType: r.sourceType,
      title: r.title,
      organization: r.organization,
      location: r.location,
      category: r.category,
      salary: r.salary,
      deadline: r.deadline,
      matchScore: r.matchScore,
      eligibilityStatus: r.eligibilityStatus,
      isFullyQualified: r.isFullyQualified,
      strictlyQualified: r.strictlyQualified,
      matchReasons: r.matchReasons,
      missingMandatoryQualifications: r.missingMandatoryQualifications,
      requiredExperienceText: r.requiredExperienceText,
      requiredEducationText: r.requiredEducationText,
      applyUrl: r.applyUrl,
    }));

    if (!options.dryRun) {
      const allRecs = loadAllRecommendations();
      allRecs[profile.uid] = {
        recalculatedAt: new Date().toISOString(),
        items: compactRecs,
      };
      saveAllRecommendations(allRecs);

      // Prune/filter expired notifications automatically
      const allNotifs = loadAllNotifications();
      if (Array.isArray(allNotifs[profile.uid])) {
        const vacancyMap = new Map(loadVacanciesCatalog().map((v) => [v.id, v]));
        const activeFiltered = allNotifs[profile.uid].filter((n: any) => {
          if (n.sourceType === 'system') return true;
          if (isDeadlineExpired(n.deadline || n.expiresAt)) return false;
          const linkedVac = vacancyMap.get(n.vacancyId);
          if (linkedVac && linkedVac.status !== 'published') return false;
          return true;
        });
        if (activeFiltered.length !== allNotifs[profile.uid].length) {
          allNotifs[profile.uid] = activeFiltered;
          saveAllNotifications(allNotifs);
        }
      }
    }

    const newNotifications: any[] = [];
    const currentPrefs = loadAllNotificationPrefs()[profile.uid];
    const hasMandatoryProfile = hasCompletedMandatoryPreferences(profile);
    const notificationsPausedByUser = currentPrefs?.manuallyDisabled === true;

    if (options.sendNotifications && hasMandatoryProfile && !notificationsPausedByUser) {
      const changedSet = new Set(
        [
          ...(options.changedVacancyId ? [options.changedVacancyId] : []),
          ...(Array.isArray(options.changedVacancyIds) ? options.changedVacancyIds : []),
        ].filter(Boolean)
      );

      // Strictly only jobs the user fulfills with verified qualification & domain fit (max 3 jobs)
      const qualified = compactRecs.filter((r) => isStrictJobFitForUser(r as RecommendedOpportunity));
      const changedMatches = changedSet.size > 0 ? qualified.filter((r) => changedSet.has(r.id)) : [];
      const topGeneralMatches = qualified.filter((r) => !changedSet.has(r.id));
      const prioritized = [...changedMatches, ...topGeneralMatches].slice(0, 3);

      for (const r of prioritized) {
        if (newNotifications.length >= 3) break;
        const alertKind: 'new_match' | 'job_updated' =
          changedSet.has(r.id) && options.changeType === 'updated' ? 'job_updated' : 'new_match';
        const sent = await dispatchNotificationForUser(profile, r as RecommendedOpportunity, alertKind, {
          dryRun: options.dryRun,
        });
        if (sent) newNotifications.push(sent);
      }

      if (!options.dryRun && newNotifications.length > 0) {
        const allPrefs = loadAllNotificationPrefs();
        if (allPrefs[profile.uid]) {
          allPrefs[profile.uid].lastDigestSentAt = new Date().toISOString();
          allPrefs[profile.uid].updatedAt = new Date().toISOString();
          saveAllNotificationPrefs(allPrefs);
        }
      }
    }

    return { recommendations: recs, newNotifications };
  }

  async function executeAutomatedSchedulerSweep(options: {
    trigger: 'vercel_cron' | 'background_interval' | 'manual_admin';
    dryRun?: boolean;
    changedVacancyId?: string;
    changeType?: 'published' | 'updated';
  }): Promise<{ skipped: boolean; reason?: string; run?: any }> {
    if (schedulerRunActive) {
      return { skipped: true, reason: 'Another scheduler sweep is currently running.' };
    }
    schedulerRunActive = true;
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    const errors: string[] = [];

    let usersEvaluated = 0;
    let usersEligibleForAlerts = 0;
    let recommendationsUpdated = 0;
    let notificationsCreated = 0;
    let pushAttempted = 0;
    let pushSucceeded = 0;
    let pushFailed = 0;
    let emailAttempted = 0;
    let emailSucceeded = 0;
    let emailFailed = 0;
    let retriesProcessed = 0;

    try {
      const store = loadSchedulerStore();
      store.lastRunStartedAt = startedAt;
      saveSchedulerStore(store);

      // Step 1: Process delivery retry queue (with backoff)
      if (!options.dryRun) {
        const retryStats = await processRetryQueueCycle();
        retriesProcessed = retryStats.processed;
        if (retryStats.errors.length > 0) {
          errors.push(...retryStats.errors.slice(0, 5));
        }
      }

      // Step 2: Evaluate all active, non-suspended registered profiles
      const profiles = Object.values(loadUserProfiles() || {}).filter(
        (p: any) => p?.uid && p.accountStatus !== 'suspended'
      );

      for (const prof of profiles) {
        try {
          usersEvaluated += 1;
          const result = await recalculateForUser(prof, {
            sendNotifications: true,
            changedVacancyId: options.changedVacancyId,
            changeType: options.changeType,
            dryRun: options.dryRun,
          });
          if (result.recommendations.length > 0) {
            recommendationsUpdated += result.recommendations.length;
            usersEligibleForAlerts += 1;
          }
          for (const notif of result.newNotifications) {
            notificationsCreated += 1;
            if (notif.channels?.push === 'sent') {
              pushAttempted += 1;
              pushSucceeded += 1;
            } else if (notif.channels?.push === 'failed' || notif.channels?.push === 'queued') {
              pushAttempted += 1;
              pushFailed += 1;
            }
            if (notif.channels?.email === 'sent') {
              emailAttempted += 1;
              emailSucceeded += 1;
            } else if (notif.channels?.email === 'failed' || notif.channels?.email === 'queued') {
              emailAttempted += 1;
              emailFailed += 1;
            }
          }
        } catch (userErr: any) {
          errors.push(`User ${prof.uid}: ${userErr?.message || String(userErr)}`);
        }
      }

      const finishedAt = new Date().toISOString();
      const status: 'success' | 'partial' | 'failed' =
        errors.length === 0 ? 'success' : usersEvaluated > 0 ? 'partial' : 'failed';

      const runRecord = {
        id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        trigger: options.trigger,
        status,
        dryRun: Boolean(options.dryRun),
        startedAt,
        finishedAt,
        durationMs: Math.max(1, Date.now() - startMs),
        usersEvaluated,
        usersEligibleForAlerts,
        recommendationsUpdated,
        notificationsCreated,
        pushAttempted,
        pushSucceeded,
        pushFailed,
        emailAttempted,
        emailSucceeded,
        emailFailed,
        retriesProcessed,
        errorSummary: errors[0] || undefined,
        errors: errors.slice(0, 10),
      };

      const nextStore = loadSchedulerStore();
      nextStore.lastRunStartedAt = startedAt;
      nextStore.lastRunStatus = status;
      if (status !== 'failed') {
        nextStore.lastSuccessfulRunAt = finishedAt;
      }
      if (errors.length > 0) {
        for (const msg of errors.slice(0, 5)) {
          nextStore.recentErrors.unshift({
            timestamp: finishedAt,
            source: options.trigger,
            message: msg.slice(0, 400),
          });
        }
      }
      nextStore.runs.unshift(runRecord);
      saveSchedulerStore(nextStore);

      return { skipped: false, run: runRecord };
    } catch (fatalErr: any) {
      const finishedAt = new Date().toISOString();
      const msg = fatalErr?.message || String(fatalErr);
      const runRecord = {
        id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        trigger: options.trigger,
        status: 'failed' as const,
        dryRun: Boolean(options.dryRun),
        startedAt,
        finishedAt,
        durationMs: Math.max(1, Date.now() - startMs),
        usersEvaluated,
        usersEligibleForAlerts,
        recommendationsUpdated,
        notificationsCreated,
        pushAttempted,
        pushSucceeded,
        pushFailed,
        emailAttempted,
        emailSucceeded,
        emailFailed,
        retriesProcessed,
        errorSummary: msg,
        errors: [msg],
      };
      const nextStore = loadSchedulerStore();
      nextStore.lastRunStatus = 'failed';
      nextStore.recentErrors.unshift({ timestamp: finishedAt, source: options.trigger, message: msg });
      nextStore.runs.unshift(runRecord);
      saveSchedulerStore(nextStore);
      return { skipped: false, run: runRecord };
    } finally {
      schedulerRunActive = false;
    }
  }

  function buildAdminSchedulerStatus() {
    const envReport = getEnvironmentReadinessReport();
    const store = loadSchedulerStore();
    const queue = loadNotificationQueue();
    const allNotifs = loadAllNotifications();
    const allPrefs = loadAllNotificationPrefs();
    const anonSubs = loadAnonymousPushSubscriptions();
    const allRecs = loadAllRecommendations();
    const profiles = loadUserProfiles();
    const deliveryLogs = loadPushDeliveryLogs();
    const todayKey = getAddisDateKey(new Date());

    let totalNotificationsSent = 0;
    let notificationsSentToday = 0;
    let pushDeliveriesCount = 0;
    let emailDeliveriesCount = 0;
    let failedDeliveriesCount = 0;

    for (const list of Object.values(allNotifs)) {
      if (!Array.isArray(list)) continue;
      for (const n of list) {
        totalNotificationsSent += 1;
        if (getAddisDateKey(n.createdAt) === todayKey) notificationsSentToday += 1;
        if (n.channels?.push === 'sent') pushDeliveriesCount += 1;
        if (n.channels?.email === 'sent') emailDeliveriesCount += 1;
        if (n.channels?.push === 'failed' || n.channels?.email === 'failed') {
          failedDeliveriesCount += 1;
        }
      }
    }

    const queuePending = queue.filter((q) => q.status === 'pending').length;
    const queueFailed = queue.filter((q) => q.status === 'failed').length;

    let totalSubscribedUsers = 0;
    let activePushSubscriptionsCount = 0;
    let invalidOrExpiredSubscriptions = 0;
    let androidSubscriptions = 0;
    let iphoneSubscriptions = 0;
    let desktopSubscriptions = 0;
    let anonymousActiveDevices = 0;

    for (const pref of Object.values(allPrefs)) {
      const devices = Array.isArray((pref as any)?.deviceSubscriptions) ? (pref as any).deviceSubscriptions : [];
      let userHasActive = false;
      for (const dev of devices) {
        if (dev?.active && (dev?.endpoint || dev?.subscription?.endpoint)) {
          userHasActive = true;
          activePushSubscriptionsCount += 1;
          const plat = normalizeDevicePlatform(dev.platform, dev.deviceLabel, dev.endpoint || dev.subscription?.endpoint);
          if (plat === 'android') androidSubscriptions += 1;
          else if (plat === 'ios') iphoneSubscriptions += 1;
          else if (plat === 'desktop') desktopSubscriptions += 1;
        } else if (dev?.endpoint || dev?.subscription?.endpoint) {
          invalidOrExpiredSubscriptions += 1;
        }
      }
      if (userHasActive) totalSubscribedUsers += 1;
    }

    for (const anon of Object.values(anonSubs)) {
      if (anon?.active && (anon?.endpoint || anon?.subscription?.endpoint)) {
        anonymousActiveDevices += 1;
        activePushSubscriptionsCount += 1;
        const plat = normalizeDevicePlatform(anon.platform, anon.deviceLabel, anon.endpoint || anon.subscription?.endpoint);
        if (plat === 'android') androidSubscriptions += 1;
        else if (plat === 'ios') iphoneSubscriptions += 1;
        else if (plat === 'desktop') desktopSubscriptions += 1;
      } else if (anon?.endpoint || anon?.subscription?.endpoint) {
        invalidOrExpiredSubscriptions += 1;
      }
    }

    const acceptedLogs = deliveryLogs.filter((l) => l.status === 'accepted').length;
    const failedLogs = deliveryLogs.filter((l) => l.status === 'failed' || l.status === 'expired').length;
    const pushAcceptedCount = Math.max(acceptedLogs, pushDeliveriesCount);
    const pushFailedCount = Math.max(failedLogs, failedDeliveriesCount + queueFailed);

    const usersReceivingRecommendationsCount = Object.values(profiles).filter(
      (p: any) => p?.uid && p.accountStatus !== 'suspended' && (allRecs[p.uid]?.items?.length || 0) > 0
    ).length;

    const schedulerStatus: 'idle' | 'running' | 'error' = schedulerRunActive
      ? 'running'
      : store.lastRunStatus === 'failed'
      ? 'error'
      : 'idle';

    return {
      success: true,
      checkedAt: new Date().toISOString(),
      environment: envReport,
      scheduler: {
        status: schedulerStatus,
        cronPath: '/api/vacancies/sync',
        cronSchedule: 'Event-Driven (Instant on Job Publish)',
        lastRunStartedAt: store.lastRunStartedAt,
        lastSuccessfulRunAt: store.lastSuccessfulRunAt,
        lastRunStatus: store.lastRunStatus,
        nextScheduledRunAt: 'Instant on Job Publish',
      },
      totals: {
        totalNotificationsSent,
        successfulDeliveries: pushDeliveriesCount + emailDeliveriesCount + totalNotificationsSent,
        failedDeliveries: queueFailed + failedDeliveriesCount,
        pendingNotifications: queuePending,
        pushDeliveriesCount,
        emailDeliveriesCount,
        usersReceivingRecommendationsCount,
        activePushSubscriptionsCount,
      },
      pushStats: {
        totalSubscribedUsers,
        anonymousActiveDevices,
        androidSubscriptions,
        iphoneSubscriptions,
        desktopSubscriptions,
        activeSubscriptions: activePushSubscriptionsCount,
        invalidOrExpiredSubscriptions,
        notificationsSentToday,
        pushAcceptedCount,
        pushFailedCount,
      },
      notificationHistory: deliveryLogs.slice(0, 40),
      recentErrors: store.recentErrors.slice(0, 15),
      recentRuns: store.runs.slice(0, 20),
    };
  }

  let bulkRecalcInProgress = false;
  function triggerBackgroundRecalcAllUsers(options: {
    sendNotifications?: boolean;
    changedVacancyId?: string;
    changeType?: 'published' | 'updated';
  } = {}) {
    if (bulkRecalcInProgress) return;
    bulkRecalcInProgress = true;
    const profiles = Object.values(loadUserProfiles() || {}).filter(
      (p: any) => p?.uid && p.accountStatus !== 'suspended'
    );
    let idx = 0;

    const processNextChunk = async () => {
      try {
        const chunk = profiles.slice(idx, idx + 5);
        idx += 5;
        for (const prof of chunk) {
          await recalculateForUser(prof, options).catch(() => {});
        }
        if (idx < profiles.length) {
          setImmediate(() => {
            void processNextChunk();
          });
        } else {
          bulkRecalcInProgress = false;
        }
      } catch {
        bulkRecalcInProgress = false;
      }
    };

    setImmediate(() => {
      void processNextChunk();
    });
  }

  // Persistent Node runtime only: periodic sweep + retry processor.
  // On Vercel serverless deployments, Vercel Cron (/api/cron/notifications) triggers sweeps cleanly.
  if (!isVercel) {
    const retryTimer = setInterval(() => {
      void processRetryQueueCycle();
    }, 2 * 60 * 1000);
    if (typeof retryTimer?.unref === 'function') retryTimer.unref();

    const schedulerTimer = setInterval(() => {
      void executeAutomatedSchedulerSweep({ trigger: 'background_interval' });
    }, 15 * 60 * 1000);
    if (typeof schedulerTimer?.unref === 'function') schedulerTimer.unref();
  }

  // =========================================================================
  // ROUTES: VAPID KEY & WEB PUSH SUBSCRIPTION
  // =========================================================================

  app.get('/api/push/vapid-public-key', async (_req: Request, res: Response): Promise<void> => {
    const wp = await ensureWebPush();
    if (!wp || !vapidKeysCache?.publicKey) {
      res.status(503).json({ error: 'Web Push VAPID keys are unavailable.' });
      return;
    }
    res.json({ publicKey: vapidKeysCache.publicKey });
  });

  async function deliverPendingPushNotificationsForUser(uid: string): Promise<number> {
    const allPrefs = loadAllNotificationPrefs();
    const prefs = allPrefs[uid];
    if (!prefs || prefs.manuallyDisabled === true) return 0;
    const hasDevices = Boolean(prefs.deviceSubscriptions?.some((d: any) => d.active && d.subscription?.endpoint));
    if (!hasDevices) return 0;

    const allNotifs = loadAllNotifications();
    const userNotifs: any[] = Array.isArray(allNotifs[uid]) ? allNotifs[uid] : [];
    const pendingPush = userNotifs
      .filter(
        (n) =>
          !n.read &&
          n.sourceType !== 'system' &&
          n.channels?.push !== 'sent' &&
          !isDeadlineExpired(n.deadline || n.expiresAt)
      )
      .slice(0, 3);

    if (pendingPush.length === 0) return 0;

    let pushedCount = 0;
    let mutated = false;
    for (const notif of pendingPush) {
      const pushRes = await sendWebPushToUser(uid, {
        title: `HOPELANDJOBS — ${notif.title}`,
        body: `${notif.employer} (${notif.location}) · ${notif.matchReasonSummary || `Matches your qualifications in ${notif.category}`}. Tap to apply.`,
        url:
          notif.sourceType === 'domestic_job'
            ? `/?jobId=${encodeURIComponent(notif.vacancyId)}&notificationId=${encodeURIComponent(notif.id)}`
            : notif.jobUrl || '/',
        jobId: notif.vacancyId,
        notificationId: notif.id,
        tag: `vacancy-${notif.vacancyId}`,
        jobTitle: notif.title,
        employer: notif.employer,
        category: notif.category,
      });
      if (pushRes.deliveredCount > 0) {
        notif.channels = { ...(notif.channels || { website: 'delivered', email: 'skipped' }), push: 'sent' };
        notif.updatedAt = new Date().toISOString();
        pushedCount += 1;
        mutated = true;
      }
    }
    if (mutated) {
      allNotifs[uid] = userNotifs;
      saveAllNotifications(allNotifs);
    }
    return pushedCount;
  }

  app.post('/api/push/subscribe/:uid', async (req: Request, res: Response): Promise<void> => {
    const { uid } = req.params;
    if (!isSelfOrOwner(req, uid)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const { deviceId, deviceLabel, platform, subscription } = req.body || {};
    if (!subscription?.endpoint) {
      res.status(400).json({ error: 'Valid push subscription endpoint is required.' });
      return;
    }

    const allPrefs = loadAllNotificationPrefs();
    const existing = allPrefs[uid] || buildDefaultPreferences(uid);
    const nowIso = new Date().toISOString();
    const cleanDeviceId = String(deviceId || subscription.endpoint.slice(-24)).trim();
    const devices: any[] = Array.isArray(existing.deviceSubscriptions) ? existing.deviceSubscriptions : [];

    const filtered = devices.filter(
      (d) => d.deviceId !== cleanDeviceId && d.endpoint !== subscription.endpoint
    );
    const isMobile = /android|iphone|ipad|ios|mobile/i.test(`${platform || ''} ${deviceLabel || ''}`);

    filtered.unshift({
      deviceId: cleanDeviceId,
      deviceLabel: String(deviceLabel || 'Web Browser').slice(0, 120),
      platform: String(platform || 'web').slice(0, 60),
      endpoint: subscription.endpoint,
      subscription,
      active: true,
      createdAt: nowIso,
      lastVerifiedAt: nowIso,
    });

    const updated = {
      ...existing,
      userId: uid,
      permissionStatus: 'granted',
      subscriptionStatus: 'active',
      manuallyDisabled: false,
      enabledAt: existing.enabledAt || nowIso,
      permissionVerifiedAt: nowIso,
      channels: {
        ...existing.channels,
        websiteBell: true,
        browserPush: true,
        mobilePush: existing.channels?.mobilePush || isMobile || true,
      },
      deviceSubscriptions: filtered.slice(0, 15),
      updatedAt: nowIso,
    };

    allPrefs[uid] = updated;
    saveAllNotificationPrefs(allPrefs);
    const pendingPushDelivered = await deliverPendingPushNotificationsForUser(uid).catch(() => 0);
    res.json({ success: true, preferences: updated, pendingPushDelivered });
  });

  app.post('/api/push/subscribe-anonymous', (req: Request, res: Response): void => {
    const { deviceId, deviceLabel, platform, subscription } = req.body || {};
    const endpoint = String(subscription?.endpoint || '').trim();
    const p256dh = String(subscription?.keys?.p256dh || '').trim();
    const authKey = String(subscription?.keys?.auth || '').trim();

    if (!endpoint.startsWith('https://') || endpoint.length > 1000 || !p256dh || !authKey) {
      res.status(400).json({ error: 'Valid HTTPS push subscription with encryption keys is required.' });
      return;
    }

    const cleanDeviceId = String(deviceId || endpoint.slice(-24))
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .slice(0, 128);
    if (!cleanDeviceId) {
      res.status(400).json({ error: 'Valid deviceId is required.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const anonMap = loadAnonymousPushSubscriptions();

    for (const [key, item] of Object.entries(anonMap)) {
      if (key !== cleanDeviceId && (item?.endpoint === endpoint || item?.subscription?.endpoint === endpoint)) {
        delete anonMap[key];
      }
    }

    const existing = anonMap[cleanDeviceId];
    anonMap[cleanDeviceId] = {
      deviceId: cleanDeviceId,
      deviceLabel: String(deviceLabel || 'Web Browser').slice(0, 150),
      platform: String(platform || 'web').slice(0, 60),
      endpoint,
      subscription: {
        endpoint,
        expirationTime: subscription?.expirationTime ?? null,
        keys: { p256dh, auth: authKey },
      },
      active: true,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    saveAnonymousPushSubscriptions(anonMap);
    res.json({
      success: true,
      saved: true,
      deviceId: cleanDeviceId,
      updatedAt: nowIso,
    });
  });

  app.post('/api/push/claim-anonymous/:uid', async (req: Request, res: Response): Promise<void> => {
    const { uid } = req.params;
    if (!isSelfOrOwner(req, uid)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { deviceId, deviceLabel, platform, subscription } = req.body || {};
    const cleanDeviceId = deviceId
      ? String(deviceId).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128)
      : '';
    const requestedEndpoint = String(subscription?.endpoint || '').trim();

    const anonMap = loadAnonymousPushSubscriptions();
    let matchedAnonKey: string | null = null;
    let matchedAnonRecord: any = null;

    if (cleanDeviceId && anonMap[cleanDeviceId]) {
      matchedAnonKey = cleanDeviceId;
      matchedAnonRecord = anonMap[cleanDeviceId];
    } else if (requestedEndpoint) {
      for (const [k, rec] of Object.entries(anonMap)) {
        if (rec?.endpoint === requestedEndpoint || rec?.subscription?.endpoint === requestedEndpoint) {
          matchedAnonKey = k;
          matchedAnonRecord = rec;
          break;
        }
      }
    }

    const resolvedSub =
      subscription?.endpoint?.startsWith('https://') && subscription?.keys?.p256dh && subscription?.keys?.auth
        ? subscription
        : matchedAnonRecord?.subscription || null;

    const allPrefs = loadAllNotificationPrefs();
    const existingPrefs = allPrefs[uid] || buildDefaultPreferences(uid);

    if (!resolvedSub?.endpoint || existingPrefs.manuallyDisabled === true) {
      res.json({ success: true, claimed: false, preferences: existingPrefs });
      return;
    }

    const nowIso = new Date().toISOString();
    const targetDeviceId =
      cleanDeviceId || matchedAnonRecord?.deviceId || resolvedSub.endpoint.slice(-24).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const targetLabel = String(deviceLabel || matchedAnonRecord?.deviceLabel || 'Web Browser').slice(0, 150);
    const targetPlatform = String(platform || matchedAnonRecord?.platform || 'web').slice(0, 60);
    const isMobile = /android|iphone|ipad|ios|mobile/i.test(`${targetPlatform} ${targetLabel}`);

    const devices: any[] = Array.isArray(existingPrefs.deviceSubscriptions) ? existingPrefs.deviceSubscriptions : [];
    const filtered = devices.filter(
      (d) => d.deviceId !== targetDeviceId && d.endpoint !== resolvedSub.endpoint
    );
    filtered.unshift({
      deviceId: targetDeviceId,
      deviceLabel: targetLabel,
      platform: targetPlatform,
      endpoint: resolvedSub.endpoint,
      subscription: {
        endpoint: resolvedSub.endpoint,
        expirationTime: resolvedSub.expirationTime ?? null,
        keys: {
          p256dh: resolvedSub.keys?.p256dh || '',
          auth: resolvedSub.keys?.auth || '',
        },
      },
      active: true,
      createdAt: matchedAnonRecord?.createdAt || nowIso,
      lastVerifiedAt: nowIso,
    });

    const updated = {
      ...existingPrefs,
      userId: uid,
      permissionStatus: 'granted',
      subscriptionStatus: 'active',
      manuallyDisabled: false,
      enabledAt: existingPrefs.enabledAt || nowIso,
      permissionVerifiedAt: nowIso,
      channels: {
        ...existingPrefs.channels,
        websiteBell: true,
        browserPush: true,
        mobilePush: existingPrefs.channels?.mobilePush || isMobile || true,
      },
      deviceSubscriptions: filtered.slice(0, 15),
      updatedAt: nowIso,
    };

    allPrefs[uid] = updated;
    saveAllNotificationPrefs(allPrefs);

    if (matchedAnonKey && anonMap[matchedAnonKey]) {
      delete anonMap[matchedAnonKey];
      saveAnonymousPushSubscriptions(anonMap);
    }

    const pendingPushDelivered = await deliverPendingPushNotificationsForUser(uid).catch(() => 0);
    res.json({ success: true, claimed: true, preferences: updated, pendingPushDelivered });
  });

  app.post('/api/push/unsubscribe/:uid', (req: Request, res: Response): void => {
    const { uid } = req.params;
    if (!isSelfOrOwner(req, uid)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const { deviceId, endpoint } = req.body || {};
    const allPrefs = loadAllNotificationPrefs();
    const existing = allPrefs[uid] || buildDefaultPreferences(uid);
    const nowIso = new Date().toISOString();

    const nextDevices = (existing.deviceSubscriptions || []).map((d: any) => {
      const matches =
        (deviceId && d.deviceId === String(deviceId)) ||
        (endpoint && (d.endpoint === String(endpoint) || d.subscription?.endpoint === String(endpoint))) ||
        (!deviceId && !endpoint);
      if (matches) {
        return {
          ...d,
          active: false,
          lastFailureReason: 'Disabled by user',
          lastVerifiedAt: nowIso,
        };
      }
      return d;
    });

    const stillHasActive = nextDevices.some((d: any) => d.active);
    const updated = {
      ...existing,
      userId: uid,
      manuallyDisabled: !stillHasActive,
      subscriptionStatus: stillHasActive ? 'active' : 'revoked',
      channels: {
        ...existing.channels,
        browserPush: stillHasActive ? Boolean(existing.channels?.browserPush) : false,
        mobilePush: stillHasActive ? Boolean(existing.channels?.mobilePush) : false,
      },
      deviceSubscriptions: nextDevices,
      updatedAt: nowIso,
    };

    allPrefs[uid] = updated;
    saveAllNotificationPrefs(allPrefs);
    res.json({ success: true, preferences: updated });
  });

  app.post('/api/push/deliver-pending/:uid', async (req: Request, res: Response): Promise<void> => {
    const { uid } = req.params;
    if (!isSelfOrOwner(req, uid)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const deliveredCount = await deliverPendingPushNotificationsForUser(uid).catch(() => 0);
    res.json({ success: true, deliveredCount });
  });

  app.post('/api/push/test/:uid', async (req: Request, res: Response): Promise<void> => {
    const { uid } = req.params;
    if (!isSelfOrOwner(req, uid)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const settings = loadPersistedSettings() || {};
    const domain = String(settings.customDomain || 'hopelandjobs.tech').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const pushRes = await sendWebPushToUser(uid, {
      title: 'HOPELAND JOBS — Notifications Active',
      body: 'Real-time personalized job alerts are verified and active on this device.',
      url: '/',
      jobId: '',
      tag: `hopeland-test-${uid}`,
    });

    res.json({
      success: pushRes.deliveredCount > 0,
      deliveredCount: pushRes.deliveredCount,
      failedCount: pushRes.failedCount,
      expiredEndpoints: pushRes.expiredEndpoints,
      errors: pushRes.errors,
      domain,
    });
  });

  // =========================================================================
  // ROUTES: USER NOTIFICATION PREFERENCES & PERSISTENT NOTIFICATIONS
  // =========================================================================

  app.get('/api/user/notification-preferences/:uid', (req: Request, res: Response): void => {
    const { uid } = req.params;
    if (!isSelfOrOwner(req, uid)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const allPrefs = loadAllNotificationPrefs();
    const record = allPrefs[uid] || buildDefaultPreferences(uid);
    res.json({ success: true, preferences: record });
  });

  app.post('/api/user/notification-preferences/:uid', (req: Request, res: Response): void => {
    const { uid } = req.params;
    if (!isSelfOrOwner(req, uid)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const body = req.body || {};
    const allPrefs = loadAllNotificationPrefs();
    const existing = allPrefs[uid] || buildDefaultPreferences(uid);
    const nowIso = new Date().toISOString();

    let nextDevices = Array.isArray(existing.deviceSubscriptions) ? existing.deviceSubscriptions : [];
    if (body.markDeviceExpired && typeof body.markDeviceExpired === 'string') {
      nextDevices = nextDevices.map((d: any) =>
        d.deviceId === body.markDeviceExpired ? { ...d, active: false, lastFailureReason: 'Device subscription invalid/expired' } : d
      );
    }

    const validFreq = ['instant', 'daily', 'weekly'].includes(body.frequency)
      ? body.frequency
      : existing.frequency || 'instant';

    const nextChannels = {
      ...existing.channels,
      ...(body.channels || {}),
    };
    const nextManuallyDisabled =
      typeof body.manuallyDisabled === 'boolean'
        ? body.manuallyDisabled
        : body.channels &&
          typeof body.channels.browserPush === 'boolean' &&
          typeof body.channels.mobilePush === 'boolean' &&
          !body.channels.browserPush &&
          !body.channels.mobilePush
        ? true
        : body.channels?.browserPush === true || body.channels?.mobilePush === true
        ? false
        : Boolean(existing.manuallyDisabled);

    const updated = {
      ...existing,
      userId: uid,
      permissionStatus: body.permissionStatus || existing.permissionStatus,
      subscriptionStatus: body.subscriptionStatus || existing.subscriptionStatus,
      manuallyDisabled: nextManuallyDisabled,
      frequency: validFreq,
      enabledAt:
        body.permissionStatus === 'granted' && !existing.enabledAt ? nowIso : body.enabledAt || existing.enabledAt,
      permissionVerifiedAt: body.permissionVerifiedAt || nowIso,
      promptDismissCount:
        typeof body.incrementDismiss === 'boolean' && body.incrementDismiss
          ? (existing.promptDismissCount || 0) + 1
          : body.promptDismissCount ?? existing.promptDismissCount ?? 0,
      channels: nextChannels,
      alertTypes: {
        ...existing.alertTypes,
        ...(body.alertTypes || {}),
      },
      preferredSectors: Array.isArray(body.preferredSectors) ? body.preferredSectors : existing.preferredSectors || [],
      deviceSubscriptions: nextDevices,
      updatedAt: nowIso,
    };

    allPrefs[uid] = updated;
    saveAllNotificationPrefs(allPrefs);
    res.json({ success: true, preferences: updated });
  });

  app.get('/api/user/recommendations/:uid', async (req: Request, res: Response): Promise<void> => {
    const { uid } = req.params;
    if (!isSelfOrOwner(req, uid)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const profiles = loadUserProfiles();
    const profile = profiles[uid];
    if (!profile) {
      res.json({ success: true, recommendations: [], recalculatedAt: null });
      return;
    }

    const { recommendations } = await recalculateForUser(profile, { sendNotifications: false });
    res.json({
      success: true,
      recommendations,
      recalculatedAt: new Date().toISOString(),
    });
  });

  app.post('/api/user/recommendations/recalculate/:uid', async (req: Request, res: Response): Promise<void> => {
    const { uid } = req.params;
    if (!isSelfOrOwner(req, uid)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const profiles = loadUserProfiles();
    const profile = profiles[uid];
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const sendNotifications = req.body?.sendNotifications !== false;
    const { recommendations, newNotifications } = await recalculateForUser(profile, { sendNotifications });
    res.json({
      success: true,
      recommendations,
      newNotifications,
      recalculatedAt: new Date().toISOString(),
    });
  });

  app.get('/api/user/notifications/:uid', (req: Request, res: Response): void => {
    const { uid } = req.params;
    if (!isSelfOrOwner(req, uid)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const allNotifs = loadAllNotifications();
    const vacancyMap = new Map(loadVacanciesCatalog().map((v) => [v.id, v]));
    const activeList = (allNotifs[uid] || []).filter((n: any) => {
      if (n.sourceType === 'system') return true;
      if (isDeadlineExpired(n.deadline || n.expiresAt)) return false;
      const v = vacancyMap.get(n.vacancyId);
      if (v && v.status !== 'published') return false;
      return true;
    });
    const unreadCount = activeList.filter((n: any) => !n.read).length;
    res.json({
      success: true,
      notifications: activeList,
      unreadCount,
    });
  });

  app.post('/api/user/notifications/:uid/read', (req: Request, res: Response): void => {
    const { uid } = req.params;
    if (!isSelfOrOwner(req, uid)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const { notificationId, markAll, read } = req.body || {};
    const targetReadState = read === false ? false : true;
    const nowIso = new Date().toISOString();
    const allNotifs = loadAllNotifications();
    const current = Array.isArray(allNotifs[uid]) ? allNotifs[uid] : [];

    const next = current.map((n: any) => {
      if (markAll || (notificationId && n.id === notificationId)) {
        return {
          ...n,
          read: targetReadState,
          readAt: targetReadState ? nowIso : undefined,
          updatedAt: nowIso,
        };
      }
      return n;
    });

    allNotifs[uid] = next;
    saveAllNotifications(allNotifs);
    const unreadCount = next.filter((n: any) => !n.read).length;
    res.json({ success: true, notifications: next, unreadCount });
  });

  app.post('/api/user/notifications/sync-reconnect/:uid', async (req: Request, res: Response): Promise<void> => {
    const { uid } = req.params;
    if (!isSelfOrOwner(req, uid)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const profiles = loadUserProfiles();
    const profile = profiles[uid];
    if (!profile) {
      res.json({
        success: true,
        recommendations: [],
        notifications: [],
        unreadCount: 0,
        newDeliveriesCount: 0,
        syncedAt: new Date().toISOString(),
      });
      return;
    }

    // Touch lastActiveAt reliably on reconnect/login sync
    profile.lastActiveAt = new Date().toISOString();
    profiles[uid] = profile;
    saveUserProfileMap(profiles);

    const { recommendations, newNotifications } = await recalculateForUser(profile, { sendNotifications: true });
    const allNotifs = loadAllNotifications();
    const vacancyMap = new Map(loadVacanciesCatalog().map((v) => [v.id, v]));
    const activeList = (allNotifs[uid] || []).filter((n: any) => {
      if (n.sourceType === 'system') return true;
      if (isDeadlineExpired(n.deadline || n.expiresAt)) return false;
      const v = vacancyMap.get(n.vacancyId);
      if (v && v.status !== 'published') return false;
      return true;
    });
    const unreadCount = activeList.filter((n: any) => !n.read).length;

    res.json({
      success: true,
      recommendations,
      notifications: activeList,
      unreadCount,
      newDeliveriesCount: newNotifications.length,
      syncedAt: new Date().toISOString(),
    });
  });

  // =========================================================================
  // ROUTES: VACANCIES CATALOG SYNC (TRIGGERS BACKGROUND MATCHING + ALERTS)
  // =========================================================================

  app.post('/api/vacancies/sync', async (req: Request, res: Response): Promise<void> => {
    const {
      vacancies: incomingList,
      mode,
      changedVacancyId,
      changedVacancyIds,
      changeType,
      usersSnapshot,
    } = req.body || {};
    if (!Array.isArray(incomingList)) {
      res.status(400).json({ error: 'vacancies array is required' });
      return;
    }

    const existing = loadVacanciesCatalog();
    // Require owner auth for mutations if catalog already exists (prevent unauthenticated overwrite)
    if (existing.length > 0 && mode !== 'seed_if_empty' && !isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required to sync vacancies catalog.' });
      return;
    }

    // Merge inline Firestore snapshot (profiles, prefs, active push subscriptions) so serverless lambdas always have fresh targets
    if (usersSnapshot && isPersistentOwnerRequest(req)) {
      mergeExternalUsersSnapshot(usersSnapshot);
    }

    if (mode === 'seed_if_empty' && existing.length > 0) {
      res.json({ success: true, total: existing.length, seeded: false });
      return;
    }

    const map = new Map<string, any>(mode === 'replace' ? [] : existing.map((v) => [v.id, v]));
    const changedSet = new Set<string>(
      [
        ...(changedVacancyId ? [String(changedVacancyId)] : []),
        ...(Array.isArray(changedVacancyIds) ? changedVacancyIds.map(String) : []),
      ].filter(Boolean)
    );
    let newlyPublishedOrUpdatedId = changedVacancyId || '';
    let resolvedChangeType: 'published' | 'updated' | undefined = changeType;

    for (const item of incomingList) {
      if (!item?.id) continue;
      const prev = map.get(item.id);
      if (!prev && item.status === 'published') {
        changedSet.add(item.id);
        if (!newlyPublishedOrUpdatedId) newlyPublishedOrUpdatedId = item.id;
        if (!resolvedChangeType) resolvedChangeType = 'published';
      } else if (prev && prev.status !== 'published' && item.status === 'published') {
        changedSet.add(item.id);
        if (!newlyPublishedOrUpdatedId) newlyPublishedOrUpdatedId = item.id;
        if (!resolvedChangeType) resolvedChangeType = 'published';
      } else if (
        prev &&
        item.status === 'published' &&
        (prev.applicationDeadline !== item.applicationDeadline || prev.salary !== item.salary || prev.title !== item.title)
      ) {
        changedSet.add(item.id);
        if (!newlyPublishedOrUpdatedId) newlyPublishedOrUpdatedId = item.id;
        if (!resolvedChangeType) resolvedChangeType = 'updated';
      }
      map.set(item.id, item);
    }

    const merged = Array.from(map.values());
    saveVacanciesCatalog(merged);

    const changedIds = Array.from(changedSet);
    let notificationsDispatched = 0;
    let notifiedUsersCount = 0;
    let emailsSent = 0;
    let pushSent = 0;

    if (mode === 'seed_if_empty') {
      // Initial seed updates recommendations quietly without blasting push
      triggerBackgroundRecalcAllUsers({
        sendNotifications: false,
      });
    } else {
      // Instant event-driven matching & Web Push delivery when jobs are published or updated
      const profiles = Object.values(loadUserProfiles() || {}).filter(
        (p: any) => p?.uid && p.accountStatus !== 'suspended'
      );
      for (const prof of profiles) {
        try {
          const result = await recalculateForUser(prof, {
            sendNotifications: true,
            changedVacancyId: newlyPublishedOrUpdatedId || undefined,
            changedVacancyIds: changedIds.length > 0 ? changedIds : undefined,
            changeType: resolvedChangeType,
          });
          if (result.newNotifications.length > 0) {
            notifiedUsersCount += 1;
            notificationsDispatched += result.newNotifications.length;
            for (const n of result.newNotifications) {
              if (n.channels?.email === 'sent') emailsSent += 1;
              if (n.channels?.push === 'sent') pushSent += 1;
            }
          }
        } catch {}
      }
    }

    res.json({
      success: true,
      total: merged.length,
      backgroundMatchingTriggered: true,
      notifiedUsersCount,
      notificationsDispatched,
      emailsSent,
      pushSent,
    });
  });

  app.post('/api/vacancies/delete', (req: Request, res: Response): void => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    const { ids } = req.body || {};
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids array is required' });
      return;
    }
    const idSet = new Set(ids);
    const next = loadVacanciesCatalog().filter((v) => !idSet.has(v.id));
    saveVacanciesCatalog(next);
    triggerBackgroundRecalcAllUsers({ sendNotifications: false });
    res.json({ success: true, remaining: next.length });
  });

  // =========================================================================
  // ROUTES: OWNER-ONLY LIVE REGISTERED USER ANALYTICS & MANAGEMENT
  // =========================================================================

  function computeRegisteredUserAnalytics(): any {
    const profilesMap = loadUserProfiles();
    const allPrefs = loadAllNotificationPrefs();
    const allRecs = loadAllRecommendations();
    const allNotifs = loadAllNotifications();
    const allApps = loadJobApplications();
    const queue = loadNotificationQueue();

    const rawUsers = Object.values(profilesMap || {}).filter((u: any) => u && u.uid);
    const now = Date.now();
    const todayKey = getAddisDateKey(new Date());
    const monthPrefix = todayKey.slice(0, 7);
    const yearPrefix = todayKey.slice(0, 4);
    const weekAgoMs = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoMs = now - 30 * 24 * 60 * 60 * 1000;
    const onlineWindowMs = now - 5 * 60 * 1000;

    // App counts per user
    const appsPerUser = new Map<string, number>();
    for (const appItem of allApps || []) {
      if (appItem?.userId) {
        appsPerUser.set(appItem.userId, (appsPerUser.get(appItem.userId) || 0) + 1);
      }
    }

    // Duplicate / suspicious account detection by normalized email or phone
    const emailGroups = new Map<string, Array<{ uid: string; email: string }>>();
    const phoneGroups = new Map<string, Array<{ uid: string; email: string }>>();

    let onlineUsersCount = 0;
    let totalActiveUsers = 0;
    let totalInactiveUsers = 0;
    let totalSuspendedUsers = 0;
    let newRegistrationsToday = 0;
    let newRegistrationsThisWeek = 0;
    let newRegistrationsThisMonth = 0;
    let newRegistrationsThisYear = 0;
    let completedProfilesCount = 0;
    let incompleteProfilesCount = 0;
    let completionSum = 0;
    let notificationsEnabledCount = 0;
    let usersReceivingRecommendationsCount = 0;

    const sectorCounts = new Map<string, number>();
    const educationCounts = new Map<string, number>();
    const experienceCounts = new Map<string, number>();
    const jobPrefCounts = new Map<string, number>();
    const timelineCounts = new Map<string, number>();
    // Pre-seed last 14 days
    for (let i = 13; i >= 0; i--) {
      const k = getAddisDateKey(new Date(now - i * 24 * 60 * 60 * 1000));
      if (k) timelineCounts.set(k, 0);
    }

    const sanitizedUsers = rawUsers.map((u: any) => {
      const regIso = u.createdAt || u.updatedAt || new Date().toISOString();
      const lastActIso = u.lastActiveAt || u.lastLoginAt || u.updatedAt || regIso;
      const regDateKey = getAddisDateKey(regIso);
      const regMs = new Date(regIso).getTime() || 0;
      const lastActMs = new Date(lastActIso).getTime() || regMs;
      const isOnline = lastActMs >= onlineWindowMs;

      if (isOnline) onlineUsersCount += 1;
      if (regDateKey === todayKey) newRegistrationsToday += 1;
      if (regMs >= weekAgoMs) newRegistrationsThisWeek += 1;
      if (regDateKey.startsWith(monthPrefix)) newRegistrationsThisMonth += 1;
      if (regDateKey.startsWith(yearPrefix)) newRegistrationsThisYear += 1;
      if (regDateKey && timelineCounts.has(regDateKey)) {
        timelineCounts.set(regDateKey, (timelineCounts.get(regDateKey) || 0) + 1);
      }

      const explicitStatus = u.accountStatus;
      let accountStatus: 'active' | 'inactive' | 'suspended' = 'active';
      if (explicitStatus === 'suspended') {
        accountStatus = 'suspended';
        totalSuspendedUsers += 1;
        totalInactiveUsers += 1;
      } else if (explicitStatus === 'inactive' || now - lastActMs > thirtyDaysAgoMs) {
        accountStatus = 'inactive';
        totalInactiveUsers += 1;
      } else {
        accountStatus = 'active';
        totalActiveUsers += 1;
      }

      const evalResult = evaluateMandatoryProfileCompletion(u);
      const completionPct = evalResult.percentage;
      const isProfileComplete = evalResult.isProfileComplete;
      completionSum += completionPct;
      if (isProfileComplete) completedProfilesCount += 1;
      else incompleteProfilesCount += 1;

      // Education classification
      const eduList = Array.isArray(u.education) ? u.education : [];
      const eduQuals = eduList.map((e: any) => `${e.qualification || ''} ${e.fieldOfStudy || ''}`).join(' ').toLowerCase();
      let educationLevel = 'Not Specified';
      if (eduList.length > 0) {
        if (/phd|doctor/i.test(eduQuals)) educationLevel = 'PhD / Doctorate';
        else if (/master|msc|mba|ma\b|mph/i.test(eduQuals)) educationLevel = "Master's Degree";
        else if (/bachelor|bsc|ba\b|degree|undergraduate/i.test(eduQuals)) educationLevel = "Bachelor's Degree";
        else if (/diploma|associate|level/i.test(eduQuals)) educationLevel = 'Diploma / TVET';
        else educationLevel = eduList[0]?.qualification || 'Certificate / Other';
      }
      educationCounts.set(educationLevel, (educationCounts.get(educationLevel) || 0) + 1);

      // Experience classification
      const rawYearsStr = String(u.yearsOfExperience || '');
      const yrsNumMatch = rawYearsStr.match(/\d+/);
      const expEntries = Array.isArray(u.experience) ? u.experience.length : 0;
      let experienceBand = 'Not Specified';
      if (u.noExperience === true && expEntries === 0) {
        experienceBand = 'No Experience / Fresh Graduate';
      } else if (yrsNumMatch) {
        const y = parseInt(yrsNumMatch[0], 10);
        if (y === 0) experienceBand = 'No Experience / Fresh Graduate';
        else if (y <= 2) experienceBand = '1-2 Years';
        else if (y <= 5) experienceBand = '3-5 Years';
        else experienceBand = '5+ Years';
      } else if (expEntries > 0) {
        experienceBand = expEntries === 1 ? '1-2 Years' : '3-5 Years';
      }
      experienceCounts.set(experienceBand, (experienceCounts.get(experienceBand) || 0) + 1);

      // Job preferences classification
      const prefPos = String(u.desiredJobTitle || u.currentPosition || 'Not Specified').trim() || 'Not Specified';
      jobPrefCounts.set(prefPos, (jobPrefCounts.get(prefPos) || 0) + 1);

      const prefs = allPrefs[u.uid];
      const hasActiveDevicePush = Boolean(prefs?.deviceSubscriptions?.some((d: any) => d.active));
      const notificationsEnabled = Boolean(
        prefs?.permissionStatus === 'granted' || hasActiveDevicePush
      );
      if (notificationsEnabled) notificationsEnabledCount += 1;

      const userRecs = allRecs[u.uid]?.items || [];
      const recommendationsCount = Array.isArray(userRecs) ? userRecs.length : 0;
      if (recommendationsCount > 0 && accountStatus !== 'suspended') {
        usersReceivingRecommendationsCount += 1;
      }

      const userNotifs = allNotifs[u.uid] || [];
      const unreadNotificationsCount = userNotifs.filter((n: any) => !n.read && !isDeadlineExpired(n.deadline)).length;

      const sectorLabel = String(u.preferredIndustry || u.preferredSectors?.[0] || u.staffDepartmentOrSector || 'Unspecified').trim() || 'Unspecified';
      sectorCounts.set(sectorLabel, (sectorCounts.get(sectorLabel) || 0) + 1);

      const normEmail = String(u.email || '').toLowerCase().trim();
      if (normEmail) {
        const arr = emailGroups.get(normEmail) || [];
        arr.push({ uid: u.uid, email: normEmail });
        emailGroups.set(normEmail, arr);
      }
      const normPhone = String(u.phone || '').replace(/\D/g, '');
      if (normPhone.length >= 9) {
        const keyPhone = normPhone.slice(-9);
        const arr = phoneGroups.get(keyPhone) || [];
        arr.push({ uid: u.uid, email: normEmail || u.uid });
        phoneGroups.set(keyPhone, arr);
      }

      const expList = Array.isArray(u.experience) ? u.experience : [];
      const currentOrPreviousEmployer = String(
        expList[0]?.companyName ||
          u.staffDepartmentOrSector ||
          (u.noExperience ? 'Fresh Graduate / No Prior Employer' : 'Not Specified')
      ).trim();
      const firstEdu = eduList[0];
      const educationSummary = firstEdu
        ? `${firstEdu.qualification || educationLevel}${firstEdu.fieldOfStudy ? ` in ${firstEdu.fieldOfStudy}` : ''}`
        : educationLevel;

      return {
        uid: u.uid,
        fullName: u.fullName || 'Registered User',
        email: u.email || '',
        accountRole: u.accountRole || 'staff',
        accountStatus,
        suspendedReason: u.suspendedReason || undefined,
        locationCity: u.locationCity || 'Addis Ababa',
        desiredJobTitle: u.desiredJobTitle || u.currentPosition || '',
        preferredIndustry: sectorLabel,
        currentOrPreviousEmployer,
        educationSummary,
        educationLevel,
        experienceBand,
        yearsOfExperience: rawYearsStr,
        noExperience: Boolean(u.noExperience),
        profileCompletionPercentage: completionPct,
        completedSections: evalResult.completedSections,
        missingSections: evalResult.missingSections,
        isProfileComplete,
        isOnline,
        notificationsEnabled,
        permissionStatus: prefs?.permissionStatus || 'default',
        subscriptionStatus: prefs?.subscriptionStatus || 'none',
        frequency: prefs?.frequency || 'instant',
        emailAlertsEnabled: Boolean(prefs?.channels?.emailAlerts),
        recommendationsCount,
        unreadNotificationsCount,
        applicationsCount: appsPerUser.get(u.uid) || 0,
        registeredAt: regIso,
        lastActiveAt: lastActIso,
      };
    });

    const suspiciousDuplicates: Array<{ reason: string; uids: string[]; emails: string[] }> = [];
    for (const [email, items] of emailGroups.entries()) {
      if (items.length > 1) {
        suspiciousDuplicates.push({
          reason: `Duplicate email across ${items.length} accounts (${email})`,
          uids: items.map((i) => i.uid),
          emails: items.map((i) => i.email),
        });
      }
    }
    for (const [phoneSuffix, items] of phoneGroups.entries()) {
      if (items.length > 1) {
        suspiciousDuplicates.push({
          reason: `Shared phone suffix (*${phoneSuffix}) across ${items.length} accounts`,
          uids: items.map((i) => i.uid),
          emails: items.map((i) => i.email),
        });
      }
    }

    let totalNotificationsSent = 0;
    let pushDeliveriesCount = 0;
    let emailDeliveriesCount = 0;
    for (const list of Object.values(allNotifs)) {
      if (!Array.isArray(list)) continue;
      for (const n of list) {
        totalNotificationsSent += 1;
        if (n.channels?.push === 'sent') pushDeliveriesCount += 1;
        if (n.channels?.email === 'sent') emailDeliveriesCount += 1;
      }
    }

    const queuePending = queue.filter((q) => q.status === 'pending').length;
    const queueFailedItems = queue.filter((q) => q.status === 'failed');

    return {
      generatedAt: new Date().toISOString(),
      metrics: {
        totalRegisteredUsers: rawUsers.length,
        onlineUsersCount,
        totalActiveUsers,
        totalInactiveUsers,
        totalSuspendedUsers,
        newRegistrationsToday,
        newRegistrationsThisWeek,
        newRegistrationsThisMonth,
        newRegistrationsThisYear,
        completedProfilesCount,
        incompleteProfilesCount,
        averageCompletionRate: rawUsers.length > 0 ? Math.round(completionSum / rawUsers.length) : 0,
        notificationsEnabledCount,
        usersReceivingRecommendationsCount,
      },
      deliveryHealth: {
        queuePending,
        queueFailed: queueFailedItems.length,
        totalNotificationsSent,
        pushDeliveriesCount,
        emailDeliveriesCount,
        smtpConfigured: isSmtpConfigured(),
        recentFailures: queueFailedItems.slice(0, 15).map((q) => ({
          id: q.id,
          userId: q.userId,
          channel: q.channel,
          reason: q.lastError || 'Delivery error',
          attempts: q.attempts,
          updatedAt: q.updatedAt,
        })),
      },
      registrationTimeline: Array.from(timelineCounts.entries()).map(([date, count]) => ({ date, count })),
      sectorBreakdown: Array.from(sectorCounts.entries())
        .map(([sector, count]) => ({ sector, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
      educationBreakdown: Array.from(educationCounts.entries())
        .map(([level, count]) => ({ level, count }))
        .sort((a, b) => b.count - a.count),
      experienceBreakdown: Array.from(experienceCounts.entries())
        .map(([band, count]) => ({ band, count }))
        .sort((a, b) => b.count - a.count),
      jobPreferenceBreakdown: Array.from(jobPrefCounts.entries())
        .map(([position, count]) => ({ position, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      suspiciousDuplicates,
      users: sanitizedUsers.sort(
        (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
      ),
    };
  }

  app.get('/api/admin/user-analytics', (req: Request, res: Response): void => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    const summary = computeRegisteredUserAnalytics();
    res.json({ success: true, ...summary });
  });

  app.post('/api/admin/users/:uid/status', (req: Request, res: Response): void => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    const { uid } = req.params;
    const { accountStatus, reason } = req.body || {};
    if (!['active', 'inactive', 'suspended'].includes(String(accountStatus || ''))) {
      res.status(400).json({ error: 'Invalid accountStatus (active | inactive | suspended).' });
      return;
    }
    const profiles = loadUserProfiles();
    const target = profiles[uid];
    if (!target) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    const nowIso = new Date().toISOString();
    target.accountStatus = accountStatus;
    if (accountStatus === 'suspended') {
      target.suspendedAt = nowIso;
      target.suspendedReason = String(reason || 'Suspended by administrator').slice(0, 300);
    } else {
      delete target.suspendedAt;
      delete target.suspendedReason;
    }
    target.updatedAt = nowIso;
    profiles[uid] = target;
    saveUserProfileMap(profiles);

    appendAuditLog({
      action: `user_account_${accountStatus}`,
      actorEmail: getRequesterEmail(req) || 'owner',
      targetType: 'staff_profile',
      targetId: uid,
      summary: `Owner updated account status of ${target.fullName || target.email || uid} to ${accountStatus.toUpperCase()}${reason ? ` (${reason})` : ''}`,
      severity: accountStatus === 'suspended' ? 'warning' : 'info',
    });

    res.json({ success: true, uid, accountStatus, summary: computeRegisteredUserAnalytics() });
  });

  app.get('/api/admin/users/export.csv', (req: Request, res: Response): void => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    const summary = computeRegisteredUserAnalytics();
    const headers = [
      'UID',
      'Full Name',
      'Email',
      'Account Role',
      'Account Status',
      'Location',
      'Current/Previous Employer',
      'Education',
      'Experience',
      'Desired Role',
      'Preferred Sector',
      'Profile Completion %',
      'Notifications Enabled',
      'Push Permission',
      'Recommendations Count',
      'Applications Count',
      'Registered At',
      'Last Active At',
    ];
    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = summary.users.map((u: any) =>
      [
        u.uid,
        u.fullName,
        u.email,
        u.accountRole,
        u.accountStatus,
        u.locationCity,
        u.currentOrPreviousEmployer || '',
        u.educationSummary || u.educationLevel,
        u.experienceBand,
        u.desiredJobTitle,
        u.preferredIndustry,
        u.profileCompletionPercentage,
        u.notificationsEnabled ? 'Yes' : 'No',
        u.permissionStatus,
        u.recommendationsCount,
        u.applicationsCount,
        u.registeredAt,
        u.lastActiveAt || '',
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csv = `\uFEFF${headers.map(escapeCsv).join(',')}\n${rows.join('\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="hopeland-registered-users-${getAddisDateKey()}.csv"`);
    res.send(csv);
  });

  // =========================================================================
  // ROUTES: VERCEL CRON & ADMIN SCHEDULER OPERATIONS CONSOLE
  // =========================================================================

  function isAuthorizedCronRequest(req: Request): boolean {
    if (isPersistentOwnerRequest(req)) return true;
    const expectedSecret = (process.env.CRON_SECRET || '').trim();
    if (expectedSecret) {
      const authHeader = String(req.headers.authorization || '').trim();
      return authHeader === `Bearer ${expectedSecret}`;
    }
    // When CRON_SECRET is unset, trust Vercel Cron header or local non-Vercel test invocation
    return Boolean(req.headers['x-vercel-cron']) || !isVercel;
  }

  app.all('/api/cron/notifications', async (req: Request, res: Response): Promise<void> => {
    if (!isAuthorizedCronRequest(req)) {
      res.status(401).json({ error: 'Unauthorized Cron invocation' });
      return;
    }
    const dryRun = req.query?.dryRun === 'true' || req.body?.dryRun === true;
    const result = await executeAutomatedSchedulerSweep({
      trigger: 'vercel_cron',
      dryRun,
    });
    res.status(result.skipped ? 409 : 200).json({
      success: !result.skipped,
      ...result,
      status: buildAdminSchedulerStatus().scheduler,
    });
  });

  app.get('/api/admin/scheduler-status', (req: Request, res: Response): void => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    res.json(buildAdminSchedulerStatus());
  });

  app.post('/api/admin/scheduler/run-now', async (req: Request, res: Response): Promise<void> => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    const dryRun = req.body?.dryRun === true;
    const result = await executeAutomatedSchedulerSweep({
      trigger: 'manual_admin',
      dryRun,
    });
    if (!result.skipped && result.run && !dryRun) {
      appendAuditLog({
        action: 'notification_scheduler_manual_run',
        actorEmail: getRequesterEmail(req) || 'owner',
        targetType: 'scheduler',
        targetId: result.run.id,
        summary: `Manual scheduler sweep finished (${result.run.status}): ${result.run.usersEvaluated} users checked, ${result.run.notificationsCreated} alerts dispatched`,
        severity: result.run.status === 'failed' ? 'warning' : 'info',
      });
    }
    res.json({
      success: !result.skipped,
      ...result,
      schedulerStatus: buildAdminSchedulerStatus(),
    });
  });

  app.post('/api/admin/scheduler/verify-smtp', async (req: Request, res: Response): Promise<void> => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    const envReport = getEnvironmentReadinessReport();
    if (!envReport.smtpConfigured) {
      res.json({
        success: false,
        configured: false,
        verified: false,
        host: envReport.smtpHost,
        port: envReport.smtpPort,
        from: envReport.smtpFrom,
        message: `SMTP credentials incomplete. Missing: ${envReport.missingEnvVars.filter((k) => k.startsWith('SMTP_')).join(', ')}`,
      });
      return;
    }

    try {
      const nm = await ensureNodemailer();
      if (!nm) {
        res.json({ success: false, configured: true, verified: false, message: 'Nodemailer module unavailable.' });
        return;
      }
      const transporter = nm.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.verify();
      res.json({
        success: true,
        configured: true,
        verified: true,
        host: envReport.smtpHost,
        port: envReport.smtpPort,
        from: envReport.smtpFrom,
        message: 'SMTP server connection verified successfully.',
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      recordSystemNotificationError('smtp_verify', msg);
      res.json({
        success: false,
        configured: true,
        verified: false,
        host: envReport.smtpHost,
        port: envReport.smtpPort,
        from: envReport.smtpFrom,
        message: `SMTP verification failed: ${msg}`,
      });
    }
  });

  app.post('/api/admin/sync-registered-users', (req: Request, res: Response): void => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    const {
      profiles: incomingProfiles,
      preferences: incomingPrefs,
      pushSubscriptions: incomingSubs,
    } = req.body || {};
    const { profilesMerged, prefsMerged, subsMerged } = mergeExternalUsersSnapshot({
      profiles: incomingProfiles,
      preferences: incomingPrefs,
      pushSubscriptions: incomingSubs,
    });

    res.json({
      success: true,
      profilesMerged,
      prefsMerged,
      subsMerged,
      totalRegisteredUsers: Object.keys(loadUserProfiles() || {}).length,
    });
  });

  app.post('/api/admin/notifications/send-test', async (req: Request, res: Response): Promise<void> => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    const { targetUid, sendToAll, customNote } = req.body || {};
    const profilesMap = loadUserProfiles();
    const allProfiles = Object.values(profilesMap || {}).filter(
      (p: any) => p?.uid && p.accountStatus !== 'suspended'
    );

    const targets = targetUid
      ? allProfiles.filter((p: any) => p.uid === String(targetUid))
      : sendToAll !== false
      ? allProfiles
      : allProfiles.slice(0, 1);

    if (targets.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No saved active registered users found to notify.',
      });
      return;
    }

    const activeVacancies = loadVacanciesCatalog().filter(isVerifiedActiveVacancy);
    const intl = loadPersistedInternationalData();
    const intlJobs = Array.isArray(intl.internationalJobs) ? intl.internationalJobs : [];
    const scholarships = Array.isArray(intl.experienceScholarships) ? intl.experienceScholarships : [];

    const fallbackVacancy = activeVacancies[0];
    let usersNotified = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    let pushSent = 0;
    let pushQueued = 0;
    const deliveries: Array<{
      uid: string;
      email: string;
      fullName: string;
      jobTitle: string;
      website: string;
      emailStatus: string;
      pushStatus: string;
    }> = [];
    const errors: string[] = [];

    for (const profile of targets) {
      try {
        const allPrefs = loadAllNotificationPrefs();
        if (!allPrefs[profile.uid]) {
          allPrefs[profile.uid] = buildDefaultPreferences(profile.uid);
          saveAllNotificationPrefs(allPrefs);
        }

        const recs = computeStaffOpportunityRecommendations(profile, activeVacancies, intlJobs, scholarships, 5);
        const topMatch: RecommendedOpportunity = recs[0] || {
          id: fallbackVacancy?.id || `test_alert_${Date.now()}`,
          sourceType: 'domestic_job',
          title: fallbackVacancy?.title || 'Hopeland Jobs — Live Personalized Job Alerts Active',
          organization: fallbackVacancy?.organization || 'Hopeland Jobs Ethiopia',
          location: fallbackVacancy?.location || profile.locationCity || 'Addis Ababa',
          category: fallbackVacancy?.category || profile.preferredIndustry || 'Banking & NGO Opportunities',
          salary: fallbackVacancy?.salary && fallbackVacancy.salary !== 'Not specified' ? fallbackVacancy.salary : undefined,
          deadline: fallbackVacancy?.applicationDeadline || 'Open',
          matchScore: 95,
          eligibilityStatus: 'Eligible',
          isFullyQualified: true,
          matchReasons: [
            String(customNote || 'Automated job recommendation & notification test from Hopeland Jobs Admin.'),
          ],
          missingMandatoryQualifications: [],
          requiredExperienceText: fallbackVacancy?.experienceYears || profile.yearsOfExperience || 'Not specified',
          requiredEducationText: fallbackVacancy?.educationQualification || 'Not specified',
          applyUrl: fallbackVacancy?.applicationUrl,
        };

        const sent = await dispatchNotificationForUser(profile, topMatch, 'new_match', {
          ignoreFrequencyWindow: true,
          bypassRateLimit: true,
          isTestNotification: true,
          customNote:
            String(customNote || '').trim() ||
            'Live test job recommendation message verifying your Website Bell, Email, and Push alerts on Hopeland Jobs.',
        });

        if (sent) {
          usersNotified += 1;
          if (sent.channels?.email === 'sent') emailsSent += 1;
          else if (sent.channels?.email === 'queued' || sent.channels?.email === 'failed') emailsFailed += 1;
          if (sent.channels?.push === 'sent') pushSent += 1;
          else if (sent.channels?.push === 'queued' || sent.channels?.push === 'failed') pushQueued += 1;

          deliveries.push({
            uid: profile.uid,
            email: profile.email || '',
            fullName: profile.fullName || 'Registered User',
            jobTitle: sent.title,
            website: sent.channels?.website || 'delivered',
            emailStatus: sent.channels?.email || 'skipped',
            pushStatus: sent.channels?.push || 'skipped',
          });
        }
      } catch (err: any) {
        errors.push(`${profile.email || profile.uid}: ${err?.message || String(err)}`);
      }
    }

    appendAuditLog({
      action: 'admin_test_job_notification',
      actorEmail: getRequesterEmail(req) || 'owner',
      targetType: 'user_notifications',
      targetId: targetUid || 'all_saved_users',
      summary: `Admin sent test job alert to ${usersNotified}/${targets.length} saved user(s) (Emails sent: ${emailsSent}, Push sent: ${pushSent}).`,
      severity: 'info',
    });

    res.json({
      success: usersNotified > 0,
      usersTargeted: targets.length,
      usersNotified,
      emailsSent,
      emailsFailed,
      pushSent,
      pushQueued,
      deliveries,
      errors,
    });
  });

  // Authorized Admin/Owner Direct Device Push Test (sends real Web Push to current device or active owner device, never email)
  app.post('/api/admin/push/test-device', async (req: Request, res: Response): Promise<void> => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }

    const { subscription, deviceLabel, platform, customTitle, customBody } = req.body || {};
    const wp = await ensureWebPush();
    if (!wp) {
      res.status(503).json({
        success: false,
        error: 'Web Push VAPID configuration is unavailable on this server.',
      });
      return;
    }

    let targetSub = subscription?.endpoint ? subscription : null;
    let resolvedLabel = String(deviceLabel || 'Authorized Admin Device');
    let resolvedPlatform = normalizeDevicePlatform(platform, resolvedLabel, targetSub?.endpoint);
    let resolvedUid = getRequesterEmail(req) || 'owner';

    if (!targetSub) {
      const allPrefs = loadAllNotificationPrefs();
      const anonSubs = loadAnonymousPushSubscriptions();
      for (const pref of Object.values(allPrefs)) {
        const activeDev = (pref?.deviceSubscriptions || []).find(
          (d: any) => d.active && d.subscription?.endpoint
        );
        if (activeDev) {
          targetSub = activeDev.subscription;
          resolvedLabel = activeDev.deviceLabel || resolvedLabel;
          resolvedPlatform = normalizeDevicePlatform(
            activeDev.platform,
            resolvedLabel,
            targetSub.endpoint
          );
          resolvedUid = pref.userId || resolvedUid;
          break;
        }
      }
      if (!targetSub) {
        const activeAnon = Object.values(anonSubs).find(
          (a: any) => a?.active && a?.subscription?.endpoint
        );
        if (activeAnon) {
          targetSub = activeAnon.subscription;
          resolvedLabel = activeAnon.deviceLabel || resolvedLabel;
          resolvedPlatform = normalizeDevicePlatform(
            activeAnon.platform,
            resolvedLabel,
            targetSub.endpoint
          );
        }
      }
    }

    if (!targetSub?.endpoint || !targetSub?.keys?.p256dh || !targetSub?.keys?.auth) {
      res.status(400).json({
        success: false,
        error: 'No active Web Push subscription available on this device. Click Enable Notifications first, then retry.',
      });
      return;
    }

    const payload = {
      title: String(customTitle || 'HOPELANDJOBS — Test Notification Active!'),
      body: String(
        customBody ||
          'Direct real-time push notifications are configured and working on your device. Tap to open HopelandJobs.'
      ),
      url: '/',
      jobId: '',
      tag: `hopeland-admin-test-${Date.now()}`,
    };

    try {
      const pushRes = await wp.sendNotification(targetSub, JSON.stringify(payload), { TTL: 86400, timeout: 5000 });
      const statusCode = Number(pushRes?.statusCode || 201);
      appendPushDeliveryLog({
        userId: resolvedUid,
        userName: 'Authorized Test Device',
        userEmail: getRequesterEmail(req) || '',
        deviceId: targetSub.endpoint.slice(-24),
        platform: resolvedPlatform,
        deviceLabel: resolvedLabel,
        jobId: '',
        jobTitle: payload.title,
        employer: 'HOPELAND JOBS Admin Console',
        category: 'Admin Push Test',
        status: 'accepted',
        statusCode,
        isTest: true,
      });
      appendAuditLog({
        action: 'admin_device_push_test',
        actorEmail: getRequesterEmail(req) || 'owner',
        targetType: 'push_subscription',
        summary: `Authorized device Web Push test accepted (${statusCode}) on ${resolvedLabel} [${resolvedPlatform}]`,
        severity: 'info',
      });
      res.json({
        success: true,
        statusCode,
        platform: resolvedPlatform,
        deviceLabel: resolvedLabel,
        deliveredAt: new Date().toISOString(),
        message: `Real Web Push accepted by push service (HTTP ${statusCode}) for ${resolvedLabel}.`,
      });
    } catch (err: any) {
      const statusCode = Number(err?.statusCode || err?.code || 0) || undefined;
      const errMsg = err?.message || String(err);
      const isExpired = statusCode === 404 || statusCode === 410;
      appendPushDeliveryLog({
        userId: resolvedUid,
        userName: 'Authorized Test Device',
        userEmail: getRequesterEmail(req) || '',
        deviceId: targetSub.endpoint.slice(-24),
        platform: resolvedPlatform,
        deviceLabel: resolvedLabel,
        jobId: '',
        jobTitle: payload.title,
        employer: 'HOPELAND JOBS Admin Console',
        category: 'Admin Push Test',
        status: isExpired ? 'expired' : 'failed',
        statusCode,
        error: errMsg.slice(0, 220),
        isTest: true,
      });
      res.status(statusCode === 404 || statusCode === 410 ? 410 : 502).json({
        success: false,
        statusCode,
        platform: resolvedPlatform,
        deviceLabel: resolvedLabel,
        error: isExpired
          ? `Device push subscription expired (${statusCode}). Please re-enable notifications on this device.`
          : `Push delivery failed: ${errMsg}`,
      });
    }
  });

  // =========================================================================
  // ROUTES: ADMIN NOTIFICATION POLICY, USER PREFERENCES & TARGETED BROADCAST
  // =========================================================================

  app.get('/api/admin/notifications/policy', (req: Request, res: Response): void => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    res.json({ success: true, policy: loadNotificationPolicy() });
  });

  app.post('/api/admin/notifications/policy', (req: Request, res: Response): void => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    const { defaultFrequency, dailyCapPerUser, allowPromotionalAnnouncements, applyFrequencyToExistingUsers } =
      req.body || {};
    const current = loadNotificationPolicy();
    const nextFreq = ['instant', 'daily', 'weekly'].includes(defaultFrequency)
      ? (defaultFrequency as 'instant' | 'daily' | 'weekly')
      : current.defaultFrequency;
    const capParsed = Number(dailyCapPerUser);
    const nextCap = Number.isFinite(capParsed)
      ? Math.min(10, Math.max(1, Math.round(capParsed)))
      : current.dailyCapPerUser;
    const nowIso = new Date().toISOString();
    const updatedPolicy = {
      defaultFrequency: nextFreq,
      dailyCapPerUser: nextCap,
      allowPromotionalAnnouncements:
        typeof allowPromotionalAnnouncements === 'boolean'
          ? allowPromotionalAnnouncements
          : current.allowPromotionalAnnouncements,
      updatedAt: nowIso,
      updatedBy: getRequesterEmail(req) || 'owner',
    };
    saveNotificationPolicy(updatedPolicy);

    let usersUpdated = 0;
    if (applyFrequencyToExistingUsers === true) {
      const allPrefs = loadAllNotificationPrefs();
      const profiles = loadUserProfiles();
      for (const uid of Object.keys(profiles || {})) {
        const pref = allPrefs[uid] || buildDefaultPreferences(uid);
        allPrefs[uid] = { ...pref, frequency: nextFreq, updatedAt: nowIso };
        usersUpdated += 1;
      }
      saveAllNotificationPrefs(allPrefs);
    }

    appendAuditLog({
      action: 'admin_notification_policy_updated',
      actorEmail: getRequesterEmail(req) || 'owner',
      targetType: 'notification_policy',
      summary: `Updated platform notification policy: default frequency=${nextFreq}, dailyCap=${nextCap}${usersUpdated > 0 ? `, applied to ${usersUpdated} users` : ''}.`,
      severity: 'info',
    });

    res.json({ success: true, policy: updatedPolicy, usersUpdated });
  });

  app.post('/api/admin/users/:uid/notification-preferences', (req: Request, res: Response): void => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    const { uid } = req.params;
    const profiles = loadUserProfiles();
    if (!profiles[uid]) {
      res.status(404).json({ error: 'Registered user not found.' });
      return;
    }
    const { frequency, websiteBell, browserPush, mobilePush } = req.body || {};
    const allPrefs = loadAllNotificationPrefs();
    const existing = allPrefs[uid] || buildDefaultPreferences(uid);
    const nowIso = new Date().toISOString();
    const nextFreq = ['instant', 'daily', 'weekly'].includes(frequency)
      ? (frequency as 'instant' | 'daily' | 'weekly')
      : existing.frequency || 'instant';

    const updated = {
      ...existing,
      userId: uid,
      frequency: nextFreq,
      channels: {
        ...existing.channels,
        ...(typeof websiteBell === 'boolean' ? { websiteBell } : {}),
        ...(typeof browserPush === 'boolean' ? { browserPush } : {}),
        ...(typeof mobilePush === 'boolean' ? { mobilePush } : {}),
        emailAlerts: false,
      },
      updatedAt: nowIso,
    };

    allPrefs[uid] = updated;
    saveAllNotificationPrefs(allPrefs);

    appendAuditLog({
      action: 'admin_user_notification_prefs_updated',
      actorEmail: getRequesterEmail(req) || 'owner',
      targetType: 'user_notification_preferences',
      targetId: uid,
      summary: `Admin updated notification settings for ${profiles[uid].email || uid}: frequency=${nextFreq}`,
      severity: 'info',
    });

    res.json({
      success: true,
      preferences: updated,
      summary: computeRegisteredUserAnalytics(),
    });
  });

  app.post('/api/admin/notifications/broadcast', async (req: Request, res: Response): Promise<void> => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ error: 'Owner authorization required' });
      return;
    }
    const {
      title,
      message,
      audience = 'all_subscribed',
      sector,
      vacancyId,
    } = req.body || {};

    const cleanTitle = String(title || '').trim().slice(0, 140);
    const cleanMessage = String(message || '').trim().slice(0, 600);
    if (!cleanTitle || !cleanMessage) {
      res.status(400).json({ error: 'Both notification title and message are required.' });
      return;
    }

    const profiles = Object.values(loadUserProfiles() || {}).filter(
      (p: any) => p?.uid && p.accountStatus !== 'suspended'
    );
    const allPrefs = loadAllNotificationPrefs();
    const sectorNeedle = String(sector || '').trim().toLowerCase();

    const targets = profiles.filter((p: any) => {
      const pref = allPrefs[p.uid];
      const hasActiveDevice = Boolean(pref?.deviceSubscriptions?.some((d: any) => d.active && d.subscription?.endpoint));
      const isPushReady = pref?.permissionStatus === 'granted' || pref?.subscriptionStatus === 'active' || hasActiveDevice;
      const evalRes = evaluateMandatoryProfileCompletion(p);

      if (audience === 'all_subscribed') return isPushReady;
      if (audience === 'completed_profiles') return evalRes.isProfileComplete;
      if (audience === 'by_sector') {
        if (!sectorNeedle) return true;
        const userText = `${p.preferredIndustry || ''} ${(p.preferredSectors || []).join(' ')} ${p.desiredJobTitle || ''}`.toLowerCase();
        return userText.includes(sectorNeedle);
      }
      return true;
    });

    if (targets.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No matching registered users found for the selected audience.',
      });
      return;
    }

    const linkedVacancy = vacancyId
      ? loadVacanciesCatalog().find((v: any) => v.id === String(vacancyId))
      : null;
    const targetUrl = linkedVacancy ? buildJobUrl(linkedVacancy.id) : 'https://hopelandjobs.tech/';
    const relUrl = linkedVacancy ? `/?jobId=${encodeURIComponent(linkedVacancy.id)}` : '/';
    const nowIso = new Date().toISOString();
    const allNotifs = loadAllNotifications();

    let websiteDeliveredCount = 0;
    let pushDeliveredCount = 0;
    let pushFailedCount = 0;
    const errors: string[] = [];

    for (const p of targets) {
      const uid = p.uid;
      const notifId = `unotif_bc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const notifRecord: any = {
        id: notifId,
        userId: uid,
        vacancyId: linkedVacancy?.id || `announcement_${Date.now()}`,
        sourceType: linkedVacancy ? 'domestic_job' : 'system',
        alertKind: linkedVacancy ? 'sector_opportunity' : 'system_test',
        dedupeKey: `admin_broadcast::${uid}::${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        title: cleanTitle,
        employer: linkedVacancy?.organization || 'HOPELAND JOBS Announcement',
        location: linkedVacancy?.location || p.locationCity || 'Ethiopia',
        category: linkedVacancy?.category || (sector ? String(sector) : 'Job Announcement'),
        deadline: linkedVacancy?.applicationDeadline || 'Open',
        matchScore: 100,
        matchReasonSummary: cleanMessage,
        matchReasons: [cleanMessage],
        missingMandatoryQualifications: [],
        applicationUrl: linkedVacancy?.applicationUrl || targetUrl,
        jobUrl: targetUrl,
        read: false,
        channels: {
          website: 'delivered',
          push: 'skipped',
          email: 'skipped',
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const existingList = Array.isArray(allNotifs[uid]) ? allNotifs[uid] : [];
      allNotifs[uid] = [notifRecord, ...existingList].slice(0, 150);
      websiteDeliveredCount += 1;

      const pref = allPrefs[uid];
      const hasDevices = Boolean(pref?.deviceSubscriptions?.some((d: any) => d.active && d.subscription?.endpoint));
      if (pref && (pref.channels?.browserPush || pref.channels?.mobilePush || hasDevices)) {
        const pushRes = await sendWebPushToUser(uid, {
          title: cleanTitle,
          body: cleanMessage,
          url: `${relUrl}${relUrl.includes('?') ? '&' : '?'}notificationId=${encodeURIComponent(notifId)}`,
          jobId: linkedVacancy?.id || '',
          notificationId: notifId,
          tag: linkedVacancy ? `vacancy-${linkedVacancy.id}` : `announcement-${Date.now()}`,
          jobTitle: linkedVacancy?.title || cleanTitle,
          employer: linkedVacancy?.organization || 'HOPELAND JOBS',
          category: linkedVacancy?.category || (sector ? String(sector) : 'Announcement'),
        });
        if (pushRes.deliveredCount > 0) {
          notifRecord.channels.push = 'sent';
          pushDeliveredCount += pushRes.deliveredCount;
        } else if (pushRes.failedCount > 0) {
          notifRecord.channels.push = 'failed';
          pushFailedCount += pushRes.failedCount;
          if (pushRes.errors[0]) errors.push(`${p.email || uid}: ${pushRes.errors[0]}`);
        }
      }
    }

    saveAllNotifications(allNotifs);

    appendAuditLog({
      action: 'admin_notification_broadcast',
      actorEmail: getRequesterEmail(req) || 'owner',
      targetType: 'user_notifications',
      targetId: linkedVacancy?.id || audience,
      summary: `Broadcast "${cleanTitle}" sent to ${targets.length} user(s) [${audience}${sector ? `:${sector}` : ''}] — Website Bell: ${websiteDeliveredCount}, Web Push: ${pushDeliveredCount}`,
      severity: 'info',
    });

    res.json({
      success: true,
      targetedUsersCount: targets.length,
      websiteDeliveredCount,
      pushDeliveredCount,
      pushFailedCount,
      emailsSent: 0,
      audience,
      errors: errors.slice(0, 10),
    });
  });

  return {
    onUserProfileSaved: async (savedProfile: any, _isNewRegistration: boolean) => {
      if (!savedProfile?.uid) return { recommendationsCount: 0, newNotificationsCount: 0 };
      const allPrefs = loadAllNotificationPrefs();
      if (!allPrefs[savedProfile.uid]) {
        allPrefs[savedProfile.uid] = buildDefaultPreferences(savedProfile.uid);
        saveAllNotificationPrefs(allPrefs);
      }
      const readyForStrictAlerts = hasCompletedMandatoryPreferences(savedProfile);
      // Only dispatch job notifications once mandatory experience, years of experience, and job expertise are filled
      const res = await recalculateForUser(savedProfile, {
        sendNotifications: readyForStrictAlerts,
      }).catch(() => ({ recommendations: [], newNotifications: [] }));
      return {
        recommendationsCount: res.recommendations.length,
        newNotificationsCount: res.newNotifications.length,
      };
    },
    getPersistentFilesForBackup: () => ({
      vacanciesCatalog: loadVacanciesCatalog(),
      userRecommendations: loadAllRecommendations(),
      userNotifications: loadAllNotifications(),
      notificationPreferences: loadAllNotificationPrefs(),
      notificationPolicy: loadNotificationPolicy(),
      anonymousPushSubscriptions: loadAnonymousPushSubscriptions(),
      notificationQueue: loadNotificationQueue(),
      schedulerRuns: loadSchedulerStore(),
    }),
    restorePersistentFilesFromBackup: (d: any) => {
      if (Array.isArray(d?.vacanciesCatalog)) saveVacanciesCatalog(d.vacanciesCatalog);
      if (d?.userRecommendations && typeof d.userRecommendations === 'object') saveAllRecommendations(d.userRecommendations);
      if (d?.userNotifications && typeof d.userNotifications === 'object') saveAllNotifications(d.userNotifications);
      if (d?.notificationPreferences && typeof d.notificationPreferences === 'object') saveAllNotificationPrefs(d.notificationPreferences);
      if (d?.notificationPolicy && typeof d.notificationPolicy === 'object') saveNotificationPolicy(d.notificationPolicy);
      if (d?.anonymousPushSubscriptions && typeof d.anonymousPushSubscriptions === 'object') saveAnonymousPushSubscriptions(d.anonymousPushSubscriptions);
      if (Array.isArray(d?.notificationQueue)) saveNotificationQueue(d.notificationQueue);
      if (d?.schedulerRuns && typeof d.schedulerRuns === 'object') saveSchedulerStore(d.schedulerRuns);
    },
    getHealthCounts: () => ({
      vacanciesCatalog: loadVacanciesCatalog().length,
      registeredUsers: Object.keys(loadUserProfiles() || {}).length,
      anonymousPushSubscriptions: Object.keys(loadAnonymousPushSubscriptions() || {}).length,
      notificationsStored: Object.values(loadAllNotifications()).reduce(
        (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
        0
      ),
      pendingQueue: loadNotificationQueue().filter((q) => q.status === 'pending').length,
    }),
  };
}
