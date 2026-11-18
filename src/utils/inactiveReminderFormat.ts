import { NotificationPreferencesRecord, NotificationTopJobSummary } from '../types/jobSeeker';

export const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function getUserLastActivityMs(profile: {
  lastActiveAt?: string;
  lastLoginAt?: string;
  updatedAt?: string;
  createdAt?: string;
} | null | undefined): number {
  if (!profile) return 0;
  const candidates = [
    profile.lastActiveAt,
    profile.lastLoginAt,
    profile.updatedAt,
    profile.createdAt,
  ];
  let latest = 0;
  for (const iso of candidates) {
    if (!iso) continue;
    const ms = new Date(iso).getTime();
    if (!Number.isNaN(ms) && ms > latest) {
      latest = ms;
    }
  }
  return latest;
}

/**
 * Returns true if the user is non-suspended and has been inactive for >= 3 days (72 hours)
 * or explicitly marked as inactive.
 */
export function isUserInactiveForThreeDayCheck(
  profile: {
    uid?: string;
    accountStatus?: string;
    lastActiveAt?: string;
    lastLoginAt?: string;
    updatedAt?: string;
    createdAt?: string;
  } | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!profile?.uid) return false;
  if (profile.accountStatus === 'suspended') return false;
  if (profile.accountStatus === 'inactive') return true;
  const lastActMs = getUserLastActivityMs(profile);
  if (!lastActMs) return false;
  return nowMs - lastActMs >= THREE_DAYS_MS;
}

/**
 * Returns true if at least 3 days (72 hours) have passed since the last inactive-user
 * Top-3 jobs reminder was dispatched (or if none has ever been sent).
 */
export function isInactiveReminderDueForUser(
  prefs: Pick<NotificationPreferencesRecord, 'lastInactiveReminderSentAt'> | null | undefined,
  nowMs: number = Date.now(),
  force: boolean = false
): boolean {
  if (force) return true;
  if (!prefs?.lastInactiveReminderSentAt) return true;
  const lastMs = new Date(prefs.lastInactiveReminderSentAt).getTime();
  if (Number.isNaN(lastMs)) return true;
  return nowMs - lastMs >= THREE_DAYS_MS;
}

function truncateLabel(value: string, maxLen: number): string {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

export interface Top3MobilePushPayload {
  title: string;
  body: string;
  url: string;
  jobId: string;
  notificationId: string;
  tag: string;
  icon: string;
  badge: string;
  actionType: 'open_recommendations';
  topJobs: NotificationTopJobSummary[];
  jobTitle: string;
  employer: string;
  category: string;
  timestamp: number;
}

export function buildTop3MobilePushPayload(params: {
  topJobs: NotificationTopJobSummary[];
  notifId: string;
  cycleNumber?: number;
  nowMs?: number;
}): Top3MobilePushPayload {
  const { topJobs, notifId, cycleNumber = 1, nowMs = Date.now() } = params;
  const capped = topJobs.slice(0, 3);
  const count = capped.length;

  const title =
    count === 1
      ? 'Hopeland Jobs · Top Job Matched for You'
      : `Hopeland Jobs · Top ${count} Jobs Match Your Profile`;

  const lines = capped.map((job, idx) => {
    const t = truncateLabel(job.title, 44);
    const org = truncateLabel(job.organization, 26);
    const deadlineBit =
      job.deadline && !/^(open|rolling|ongoing|not stated|asap|until filled)$/i.test(job.deadline.trim())
        ? ` · Due ${truncateLabel(job.deadline, 16)}`
        : '';
    return `${idx + 1}. ${t} — ${org}${deadlineBit}`;
  });

  const body = [
    count === 1
      ? 'Apply reminder — your top matching job is open:'
      : `Apply reminder — your top ${count} matching jobs are open:`,
    ...lines,
    'Tap to open & apply now.',
  ].join('\n');

  const url = `/?view=top-recommendations&notificationId=${encodeURIComponent(notifId)}&jobs=${encodeURIComponent(
    capped.map((j) => j.id).join(',')
  )}`;

  return {
    title,
    body,
    url,
    jobId: capped[0]?.id || '',
    notificationId: notifId,
    tag: `hopeland-inactive-top3-${cycleNumber}`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-badge-96x96.png',
    actionType: 'open_recommendations',
    topJobs: capped,
    jobTitle: capped.map((j) => j.title).join(' | ').slice(0, 140),
    employer: capped[0]?.organization || 'Hopeland Jobs',
    category: '3-Day Top Recommended Jobs',
    timestamp: nowMs,
  };
}
