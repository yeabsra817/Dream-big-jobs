import { auth, safeResponseJson } from './firebase';
import type {
  GlobalReachChannel,
  GlobalReachContact,
  GlobalReachCycleLog,
  GlobalReachDashboardResponse,
  GlobalReachDatabaseStats,
  GlobalReachGeneratedDraft,
  GlobalReachOutreachApproach,
  GlobalReachRegion,
  GlobalReachSchedulerState,
  GlobalReachSuppressionEntry,
  GlobalReachUserProfile,
} from '../types/globalReach';

function buildGlobalReachHeaders(actorEmail?: string | null, actorUid?: string | null): Record<string, string> {
  const email = (actorEmail || auth.currentUser?.email || '').trim();
  const uid = (actorUid || auth.currentUser?.uid || '').trim();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'HopelandGlobalReach',
  };
  if (email) {
    headers['x-user-email'] = email;
    headers['x-admin-email'] = email;
  }
  if (uid) {
    headers['x-user-uid'] = uid;
  }
  return headers;
}

export interface GlobalReachQueryParams {
  search?: string;
  country?: string;
  region?: string;
  industry?: string;
  entityType?: string;
  category?: string;
  channel?: string;
  verificationStatus?: string;
  sponsorshipTier?: string;
  importantOnly?: boolean;
}

export async function fetchGlobalReachDashboard(
  actorEmail?: string | null,
  actorUid?: string | null,
  query: GlobalReachQueryParams = {}
): Promise<GlobalReachDashboardResponse> {
  const qs = new URLSearchParams();
  if (query.search) qs.set('search', query.search);
  if (query.country && query.country !== 'all') qs.set('country', query.country);
  if (query.region && query.region !== 'all') qs.set('region', query.region);
  if (query.industry && query.industry !== 'all') qs.set('industry', query.industry);
  if (query.entityType && query.entityType !== 'all') qs.set('entityType', query.entityType);
  if (query.category && query.category !== 'all') qs.set('category', query.category);
  if (query.channel && query.channel !== 'all') qs.set('channel', query.channel);
  if (query.verificationStatus && query.verificationStatus !== 'all') {
    qs.set('verificationStatus', query.verificationStatus);
  }
  if (query.sponsorshipTier && query.sponsorshipTier !== 'all') {
    qs.set('sponsorshipTier', query.sponsorshipTier);
  }
  if (query.importantOnly) qs.set('importantOnly', 'true');

  const resp = await fetch(`/api/global-reach/dashboard?${qs.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to load Global Reach dashboard (HTTP ${resp.status})`);
  }
  return data as GlobalReachDashboardResponse;
}

export async function updateGlobalReachProfile(
  actorEmail: string | null | undefined,
  actorUid: string | null | undefined,
  profile: Partial<GlobalReachUserProfile>
): Promise<GlobalReachUserProfile> {
  const resp = await fetch('/api/global-reach/profile', {
    method: 'PUT',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
    body: JSON.stringify(profile),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to save Global Reach profile (HTTP ${resp.status})`);
  }
  return data.profile as GlobalReachUserProfile;
}

export async function triggerGlobalReachDiscoveryNow(
  actorEmail?: string | null,
  actorUid?: string | null,
  options?: { country?: string; region?: GlobalReachRegion | 'all'; query?: string }
): Promise<{
  cycleLog: GlobalReachCycleLog;
  newContacts: GlobalReachContact[];
  stats: GlobalReachDatabaseStats;
  scheduler: GlobalReachSchedulerState;
}> {
  const resp = await fetch('/api/global-reach/discover-now', {
    method: 'POST',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
    body: JSON.stringify(options || {}),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Global Reach discovery failed (HTTP ${resp.status})`);
  }
  return data;
}

export async function createGlobalReachContact(
  actorEmail: string | null | undefined,
  actorUid: string | null | undefined,
  contact: Partial<GlobalReachContact>
): Promise<{ contact: GlobalReachContact; stats: GlobalReachDatabaseStats }> {
  const resp = await fetch('/api/global-reach/contacts', {
    method: 'POST',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
    body: JSON.stringify(contact),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to add contact (HTTP ${resp.status})`);
  }
  return data;
}

export async function updateGlobalReachContact(
  actorEmail: string | null | undefined,
  actorUid: string | null | undefined,
  contactId: string,
  patch: Partial<GlobalReachContact>
): Promise<{ contact: GlobalReachContact; stats: GlobalReachDatabaseStats }> {
  const resp = await fetch(`/api/global-reach/contacts/${encodeURIComponent(contactId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
    body: JSON.stringify(patch),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to update contact (HTTP ${resp.status})`);
  }
  return data;
}

export async function deleteGlobalReachContact(
  actorEmail: string | null | undefined,
  actorUid: string | null | undefined,
  contactId: string
): Promise<{ stats: GlobalReachDatabaseStats }> {
  const resp = await fetch(`/api/global-reach/contacts/${encodeURIComponent(contactId)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to delete contact (HTTP ${resp.status})`);
  }
  return data;
}

export async function verifyGlobalReachContactLive(
  actorEmail: string | null | undefined,
  actorUid: string | null | undefined,
  contactId: string
): Promise<{ contact: GlobalReachContact; stats: GlobalReachDatabaseStats }> {
  const resp = await fetch(`/api/global-reach/contacts/${encodeURIComponent(contactId)}/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
    body: JSON.stringify({}),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Live verification failed (HTTP ${resp.status})`);
  }
  return data;
}

export async function generateGlobalReachDrafts(
  actorEmail: string | null | undefined,
  actorUid: string | null | undefined,
  payload: {
    contactIds: string[];
    approach: GlobalReachOutreachApproach;
    mode: 'ai' | 'manual_template';
  }
): Promise<GlobalReachGeneratedDraft[]> {
  const resp = await fetch('/api/global-reach/ai/draft', {
    method: 'POST',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
    body: JSON.stringify(payload),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success || !Array.isArray(data?.drafts)) {
    throw new Error(data?.error || `Failed to generate personalized draft (HTTP ${resp.status})`);
  }
  return data.drafts as GlobalReachGeneratedDraft[];
}

export async function logGlobalReachOutreach(
  actorEmail: string | null | undefined,
  actorUid: string | null | undefined,
  payload: {
    contactIds: string[];
    channel: GlobalReachChannel;
    approach: GlobalReachOutreachApproach;
    subject?: string;
    messagePreview: string;
    mode: 'single' | 'bulk_bcc';
    nextFollowUpDate?: string;
    notes?: string;
  }
): Promise<{ recordedCount: number; skippedSuppressedCount: number; stats: GlobalReachDatabaseStats }> {
  const resp = await fetch('/api/global-reach/outreach/log', {
    method: 'POST',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
    body: JSON.stringify(payload),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to record outreach log (HTTP ${resp.status})`);
  }
  return data;
}

export async function controlGlobalReachScheduler(
  actorEmail: string | null | undefined,
  actorUid: string | null | undefined,
  action: 'pause' | 'resume' | 'enable' | 'disable'
): Promise<{ scheduler: GlobalReachSchedulerState; stats: GlobalReachDatabaseStats }> {
  const resp = await fetch('/api/global-reach/scheduler/control', {
    method: 'POST',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
    body: JSON.stringify({ action }),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Scheduler control failed (HTTP ${resp.status})`);
  }
  return data;
}

export async function acknowledgeGlobalReachNotifications(
  actorEmail: string | null | undefined,
  actorUid: string | null | undefined,
  id?: string
): Promise<{ unreadNotificationsCount: number }> {
  const resp = await fetch('/api/global-reach/notifications/ack', {
    method: 'POST',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
    body: JSON.stringify(id ? { id } : {}),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to mark notifications read (HTTP ${resp.status})`);
  }
  return data;
}

export async function addGlobalReachSuppression(
  actorEmail: string | null | undefined,
  actorUid: string | null | undefined,
  payload: { email?: string; domain?: string; contactName?: string; reason: string }
): Promise<{ suppressionList: GlobalReachSuppressionEntry[] }> {
  const resp = await fetch('/api/global-reach/suppression', {
    method: 'POST',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
    body: JSON.stringify(payload),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to add suppression entry (HTTP ${resp.status})`);
  }
  return data;
}

export async function removeGlobalReachSuppression(
  actorEmail: string | null | undefined,
  actorUid: string | null | undefined,
  id: string
): Promise<{ suppressionList: GlobalReachSuppressionEntry[] }> {
  const resp = await fetch(`/api/global-reach/suppression/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to remove suppression entry (HTTP ${resp.status})`);
  }
  return data;
}

export async function purgeGlobalReachWorkspaceData(
  actorEmail: string | null | undefined,
  actorUid: string | null | undefined
): Promise<{ stats: GlobalReachDatabaseStats }> {
  const resp = await fetch('/api/global-reach/privacy/purge', {
    method: 'DELETE',
    credentials: 'include',
    headers: buildGlobalReachHeaders(actorEmail, actorUid),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to purge Global Reach workspace data (HTTP ${resp.status})`);
  }
  return data;
}
