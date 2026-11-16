import type { Express, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import {
  computeStaffOpportunityRecommendations,
  hasSufficientProfileForRecommendations,
  isDeadlineApproaching,
  isDeadlineExpired,
  isVerifiedActiveVacancy,
  RecommendedOpportunity,
} from './src/utils/recommendationCore';

export interface ServerUserEngineContext {
  app: Express;
  runtimeBaseDir: string;
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
  const VAPID_KEYS_FILE = path.join(DATA_DIR, 'vapid_keys.json');

  let webpushLib: any = null;
  let nodemailerLib: any = null;
  let vapidKeysCache: { publicKey: string; privateKey: string } | null = null;
  let webPushConfigured = false;
  let backgroundQueueActive = false;

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

  function loadNotificationQueue(): any[] {
    const list = loadJsonFileSafe<any[]>(NOTIFICATION_QUEUE_FILE, []);
    return Array.isArray(list) ? list : [];
  }

  function saveNotificationQueue(list: any[]): void {
    ensureRuntimeDataDir();
    writeJsonFileAtomic(NOTIFICATION_QUEUE_FILE, list);
  }

  function buildDefaultPreferences(uid: string) {
    return {
      userId: uid,
      permissionStatus: 'default',
      subscriptionStatus: 'none',
      promptDismissCount: 0,
      channels: {
        websiteBell: true,
        browserPush: false,
        mobilePush: false,
        emailAlerts: true,
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
    payload: { title: string; body: string; url: string; jobId: string; tag: string }
  ): Promise<{ deliveredCount: number; failedCount: number; expiredEndpoints: string[]; errors: string[] }> {
    const allPrefs = loadAllNotificationPrefs();
    const prefs = allPrefs[uid];
    if (!prefs || (!prefs.channels?.browserPush && !prefs.channels?.mobilePush)) {
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

    let deliveredCount = 0;
    let failedCount = 0;
    const expiredEndpoints: string[] = [];
    const errors: string[] = [];
    let prefsDirty = false;
    const nowIso = new Date().toISOString();

    for (const dev of activeDevices) {
      try {
        await wp.sendNotification(dev.subscription, JSON.stringify(payload), { TTL: 86400 });
        deliveredCount += 1;
        dev.lastDeliveredAt = nowIso;
        dev.lastVerifiedAt = nowIso;
        dev.lastFailureReason = undefined;
        prefs.lastSuccessfulDeliveryAt = nowIso;
        prefsDirty = true;
      } catch (err: any) {
        const statusCode = err?.statusCode || err?.code;
        const msg = err?.message || String(err);
        if (statusCode === 404 || statusCode === 410) {
          dev.active = false;
          dev.lastFailureReason = `Subscription expired (${statusCode})`;
          expiredEndpoints.push(dev.subscription.endpoint);
          prefsDirty = true;
        } else {
          dev.lastFailureReason = msg;
          prefsDirty = true;
        }
        failedCount += 1;
        errors.push(msg);
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

      const fromAddress = process.env.SMTP_FROM || `HOPELAND JOBS <${process.env.SMTP_USER}>`;
      const salaryLine = notif.salary ? `<p><strong>Verified Salary:</strong> ${notif.salary}</p>` : '';
      const missingLine =
        notif.missingMandatoryQualifications?.length > 0
          ? `<p style="color:#b45309"><strong>Note on Mandatory Requirements:</strong> ${notif.missingMandatoryQualifications.join('; ')}</p>`
          : '';

      await transporter.sendMail({
        from: fromAddress,
        to: profile.email,
        subject: `HOPELAND JOBS Match (${notif.matchScore}%): ${notif.title} at ${notif.employer}`,
        text: [
          `Hello ${profile.fullName || 'Candidate'},`,
          ``,
          `A verified job matching your profile has been identified:`,
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

  async function processRetryQueueCycle() {
    if (backgroundQueueActive) return;
    backgroundQueueActive = true;
    try {
      const queue = loadNotificationQueue();
      if (queue.length === 0) return;
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
          if (emailRes.status === 'sent') {
            qItem.status = 'delivered';
            qItem.updatedAt = new Date().toISOString();
            const userNotifs = allNotifs[qItem.userId] || [];
            const targetNotif = userNotifs.find((n: any) => n.id === qItem.notificationId);
            if (targetNotif) {
              targetNotif.channels.email = 'sent';
              targetNotif.updatedAt = new Date().toISOString();
            }
            changed = true;
          } else if (emailRes.status === 'skipped_no_smtp') {
            qItem.status = 'failed';
            qItem.lastError = 'SMTP server not configured';
            qItem.updatedAt = new Date().toISOString();
            changed = true;
          } else {
            qItem.attempts += 1;
            qItem.lastError = emailRes.error || 'Email delivery failed';
            qItem.updatedAt = new Date().toISOString();
            if (qItem.attempts >= qItem.maxAttempts) {
              qItem.status = 'failed';
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
    } finally {
      backgroundQueueActive = false;
    }
  }

  async function dispatchNotificationForUser(
    profile: any,
    rec: RecommendedOpportunity,
    alertKind: 'new_match' | 'deadline_reminder' | 'job_updated' | 'sector_opportunity'
  ): Promise<any | null> {
    if (!profile?.uid || profile.accountStatus === 'suspended') return null;

    const uid = profile.uid;
    const allPrefs = loadAllNotificationPrefs();
    const prefs = allPrefs[uid] || buildDefaultPreferences(uid);

    // Check user alert-type preferences
    if (alertKind === 'new_match' && prefs.alertTypes?.newMatches === false) return null;
    if (alertKind === 'deadline_reminder' && prefs.alertTypes?.deadlineReminders === false) return null;
    if (alertKind === 'job_updated' && prefs.alertTypes?.jobChanges === false) return null;
    if (alertKind === 'sector_opportunity' && prefs.alertTypes?.sectorUpdates === false) return null;

    // Never send notifications for expired/closed vacancies
    if (isDeadlineExpired(rec.deadline)) return null;

    const dateStamp = alertKind === 'job_updated' ? `::${new Date().toISOString().slice(0, 10)}` : '';
    const dedupeKey = `${uid}::${rec.id}::${alertKind}${dateStamp}`;

    const allNotifs = loadAllNotifications();
    const existingList: any[] = Array.isArray(allNotifs[uid]) ? allNotifs[uid] : [];
    if (existingList.some((n) => n.dedupeKey === dedupeKey)) {
      return null;
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
      title: rec.title,
      employer: rec.organization,
      location: rec.location,
      category: rec.category,
      salary: rec.salary || undefined,
      deadline: rec.deadline || 'Open',
      matchScore: rec.matchScore,
      matchReasonSummary: rec.matchReasons[0] || `Matched your profile in ${rec.category}`,
      matchReasons: rec.matchReasons,
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

    // Save immediately to persistent Website Notification store
    allNotifs[uid] = [notifRecord, ...existingList].slice(0, 150);
    saveAllNotifications(allNotifs);

    // Attempt Web Push (Desktop & Mobile) if subscribed
    if (prefs.channels?.browserPush || prefs.channels?.mobilePush) {
      const pushPrefix =
        alertKind === 'deadline_reminder'
          ? 'Deadline Approaching: '
          : alertKind === 'job_updated'
          ? 'Updated Vacancy: '
          : '';
      const pushPayload = {
        title: `${pushPrefix}${rec.title} (${rec.matchScore}% Match)`,
        body: `${rec.organization} · ${rec.location}${rec.deadline ? ` · Deadline: ${rec.deadline}` : ''}`,
        url: rec.sourceType === 'domestic_job' ? `/?jobId=${encodeURIComponent(rec.id)}` : jobUrl,
        jobId: rec.id,
        tag: dedupeKey,
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

    // Attempt Email notification if opted in
    if (prefs.channels?.emailAlerts && profile.email) {
      const emailRes = await sendEmailAlertToUser(profile, notifRecord);
      notifRecord.channels.email = emailRes.status;
      if (emailRes.status === 'failed') {
        notifRecord.channels.email = 'queued';
        enqueueDeliveryRetry({
          userId: uid,
          notificationId: notifId,
          channel: 'email',
          payload: notifRecord,
          reason: emailRes.error || 'Email send failed',
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
    options: { sendNotifications?: boolean; changedVacancyId?: string; changeType?: 'published' | 'updated' } = {}
  ): Promise<{ recommendations: RecommendedOpportunity[]; newNotifications: any[] }> {
    if (!profile?.uid || profile.accountStatus === 'suspended') {
      return { recommendations: [], newNotifications: [] };
    }

    const vacancies = loadVacanciesCatalog().filter(isVerifiedActiveVacancy);
    const intl = loadPersistedInternationalData();
    const intlJobs = Array.isArray(intl.internationalJobs) ? intl.internationalJobs : [];
    const scholarships = Array.isArray(intl.experienceScholarships) ? intl.experienceScholarships : [];

    const recs = computeStaffOpportunityRecommendations(profile, vacancies, intlJobs, scholarships, 30);

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
      matchReasons: r.matchReasons,
      missingMandatoryQualifications: r.missingMandatoryQualifications,
      requiredExperienceText: r.requiredExperienceText,
      requiredEducationText: r.requiredEducationText,
      applyUrl: r.applyUrl,
    }));

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

    const newNotifications: any[] = [];
    if (options.sendNotifications) {
      // Send notifications for high-relevance matches (prefer qualified or >= 32 score)
      for (const r of compactRecs.slice(0, 8)) {
        let alertKind: 'new_match' | 'deadline_reminder' | 'job_updated' = 'new_match';
        if (options.changedVacancyId && r.id === options.changedVacancyId && options.changeType === 'updated') {
          alertKind = 'job_updated';
        } else if (isDeadlineApproaching(r.deadline, 72)) {
          alertKind = 'deadline_reminder';
        }
        const sent = await dispatchNotificationForUser(profile, r as RecommendedOpportunity, alertKind);
        if (sent) newNotifications.push(sent);

        // Also send approaching deadline reminder separately if deadline <= 72h
        if (alertKind === 'new_match' && isDeadlineApproaching(r.deadline, 72)) {
          const dlSent = await dispatchNotificationForUser(profile, r as RecommendedOpportunity, 'deadline_reminder');
          if (dlSent) newNotifications.push(dlSent);
        }
      }
    }

    return { recommendations: recs, newNotifications };
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

  // Periodic background sweep (every 2 minutes): deadline expiration, approaching reminders & retry queue
  const periodicTimer = setInterval(() => {
    void processRetryQueueCycle();
    // Periodically evaluate deadline reminders and clean expired notifications without spamming
    triggerBackgroundRecalcAllUsers({ sendNotifications: true });
  }, 2 * 60 * 1000);
  if (typeof periodicTimer?.unref === 'function') periodicTimer.unref();

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

  app.post('/api/push/subscribe/:uid', (req: Request, res: Response): void => {
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
      enabledAt: existing.enabledAt || nowIso,
      permissionVerifiedAt: nowIso,
      channels: {
        ...existing.channels,
        websiteBell: true,
        browserPush: true,
        mobilePush: existing.channels?.mobilePush || isMobile,
      },
      deviceSubscriptions: filtered.slice(0, 15),
      updatedAt: nowIso,
    };

    allPrefs[uid] = updated;
    saveAllNotificationPrefs(allPrefs);
    res.json({ success: true, preferences: updated });
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

    const updated = {
      ...existing,
      userId: uid,
      permissionStatus: body.permissionStatus || existing.permissionStatus,
      subscriptionStatus: body.subscriptionStatus || existing.subscriptionStatus,
      enabledAt:
        body.permissionStatus === 'granted' && !existing.enabledAt ? nowIso : body.enabledAt || existing.enabledAt,
      permissionVerifiedAt: body.permissionVerifiedAt || nowIso,
      promptDismissCount:
        typeof body.incrementDismiss === 'boolean' && body.incrementDismiss
          ? (existing.promptDismissCount || 0) + 1
          : body.promptDismissCount ?? existing.promptDismissCount ?? 0,
      channels: {
        ...existing.channels,
        ...(body.channels || {}),
      },
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

  app.post('/api/vacancies/sync', (req: Request, res: Response): void => {
    const { vacancies: incomingList, mode, changedVacancyId, changeType } = req.body || {};
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
    if (mode === 'seed_if_empty' && existing.length > 0) {
      res.json({ success: true, total: existing.length, seeded: false });
      return;
    }

    const map = new Map<string, any>(mode === 'replace' ? [] : existing.map((v) => [v.id, v]));
    let newlyPublishedOrUpdatedId = changedVacancyId || '';
    let resolvedChangeType: 'published' | 'updated' | undefined = changeType;

    for (const item of incomingList) {
      if (!item?.id) continue;
      const prev = map.get(item.id);
      if (!prev && item.status === 'published' && !newlyPublishedOrUpdatedId) {
        newlyPublishedOrUpdatedId = item.id;
        resolvedChangeType = 'published';
      } else if (prev && prev.status !== 'published' && item.status === 'published' && !newlyPublishedOrUpdatedId) {
        newlyPublishedOrUpdatedId = item.id;
        resolvedChangeType = 'published';
      } else if (
        prev &&
        item.status === 'published' &&
        (prev.applicationDeadline !== item.applicationDeadline || prev.salary !== item.salary || prev.title !== item.title) &&
        !newlyPublishedOrUpdatedId
      ) {
        newlyPublishedOrUpdatedId = item.id;
        resolvedChangeType = 'updated';
      }
      map.set(item.id, item);
    }

    const merged = Array.from(map.values());
    saveVacanciesCatalog(merged);

    // Always recalculate & dispatch non-blocking background notifications across all users
    triggerBackgroundRecalcAllUsers({
      sendNotifications: true,
      changedVacancyId: newlyPublishedOrUpdatedId || undefined,
      changeType: resolvedChangeType,
    });

    res.json({ success: true, total: merged.length, backgroundMatchingTriggered: true });
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
    const weekAgoMs = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoMs = now - 30 * 24 * 60 * 60 * 1000;

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

    let totalActiveUsers = 0;
    let totalInactiveUsers = 0;
    let totalSuspendedUsers = 0;
    let newRegistrationsToday = 0;
    let newRegistrationsThisWeek = 0;
    let newRegistrationsThisMonth = 0;
    let completedProfilesCount = 0;
    let incompleteProfilesCount = 0;
    let notificationsEnabledCount = 0;
    let usersReceivingRecommendationsCount = 0;

    const sectorCounts = new Map<string, number>();
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

      if (regDateKey === todayKey) newRegistrationsToday += 1;
      if (regMs >= weekAgoMs) newRegistrationsThisWeek += 1;
      if (regDateKey.startsWith(monthPrefix)) newRegistrationsThisMonth += 1;
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

      const completionPct = Number(u.profileCompletionPercentage || 0);
      const isProfileComplete = completionPct >= 70 && hasSufficientProfileForRecommendations(u);
      if (isProfileComplete) completedProfilesCount += 1;
      else incompleteProfilesCount += 1;

      const prefs = allPrefs[u.uid];
      const hasActiveDevicePush = Boolean(prefs?.deviceSubscriptions?.some((d: any) => d.active));
      const notificationsEnabled = Boolean(
        prefs?.permissionStatus === 'granted' || hasActiveDevicePush || prefs?.channels?.emailAlerts
      );
      if (notificationsEnabled) notificationsEnabledCount += 1;

      const userRecs = allRecs[u.uid]?.items || [];
      const recommendationsCount = Array.isArray(userRecs) ? userRecs.length : 0;
      if (recommendationsCount > 0 && accountStatus !== 'suspended') {
        usersReceivingRecommendationsCount += 1;
      }

      const userNotifs = allNotifs[u.uid] || [];
      const unreadNotificationsCount = userNotifs.filter((n: any) => !n.read && !isDeadlineExpired(n.deadline)).length;

      const sectorLabel = String(u.preferredIndustry || u.staffDepartmentOrSector || 'Unspecified').trim();
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

      return {
        uid: u.uid,
        fullName: u.fullName || 'Registered User',
        email: u.email || '',
        accountRole: u.accountRole || 'staff',
        accountStatus,
        suspendedReason: u.suspendedReason || undefined,
        locationCity: u.locationCity || 'Addis Ababa',
        desiredJobTitle: u.desiredJobTitle || u.currentPosition || '',
        preferredIndustry: u.preferredIndustry || 'Unspecified',
        profileCompletionPercentage: completionPct,
        isProfileComplete,
        notificationsEnabled,
        permissionStatus: prefs?.permissionStatus || 'default',
        subscriptionStatus: prefs?.subscriptionStatus || 'none',
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
        totalActiveUsers,
        totalInactiveUsers,
        totalSuspendedUsers,
        newRegistrationsToday,
        newRegistrationsThisWeek,
        newRegistrationsThisMonth,
        completedProfilesCount,
        incompleteProfilesCount,
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

  return {
    onUserProfileSaved: async (savedProfile: any, isNewRegistration: boolean) => {
      if (!savedProfile?.uid) return;
      // Ensure preference record exists on signup
      const allPrefs = loadAllNotificationPrefs();
      if (!allPrefs[savedProfile.uid]) {
        allPrefs[savedProfile.uid] = buildDefaultPreferences(savedProfile.uid);
        saveAllNotificationPrefs(allPrefs);
      }
      // Recalculate recommendations and dispatch alerts immediately upon profile registration/completion
      await recalculateForUser(savedProfile, {
        sendNotifications: isNewRegistration || hasSufficientProfileForRecommendations(savedProfile),
      }).catch(() => {});
    },
    getPersistentFilesForBackup: () => ({
      vacanciesCatalog: loadVacanciesCatalog(),
      userRecommendations: loadAllRecommendations(),
      userNotifications: loadAllNotifications(),
      notificationPreferences: loadAllNotificationPrefs(),
      notificationQueue: loadNotificationQueue(),
    }),
    restorePersistentFilesFromBackup: (d: any) => {
      if (Array.isArray(d?.vacanciesCatalog)) saveVacanciesCatalog(d.vacanciesCatalog);
      if (d?.userRecommendations && typeof d.userRecommendations === 'object') saveAllRecommendations(d.userRecommendations);
      if (d?.userNotifications && typeof d.userNotifications === 'object') saveAllNotifications(d.userNotifications);
      if (d?.notificationPreferences && typeof d.notificationPreferences === 'object') saveAllNotificationPrefs(d.notificationPreferences);
      if (Array.isArray(d?.notificationQueue)) saveNotificationQueue(d.notificationQueue);
    },
    getHealthCounts: () => ({
      vacanciesCatalog: loadVacanciesCatalog().length,
      registeredUsers: Object.keys(loadUserProfiles() || {}).length,
      notificationsStored: Object.values(loadAllNotifications()).reduce(
        (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
        0
      ),
      pendingQueue: loadNotificationQueue().filter((q) => q.status === 'pending').length,
    }),
  };
}
