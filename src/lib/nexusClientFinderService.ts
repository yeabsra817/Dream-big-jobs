import {
  NexusClientFinderApiResponse,
  NexusContactStatus,
  NexusDashboardStats,
  NexusDiscoveryRunLog,
  NexusGeneratedMessage,
  NexusMessageTemplateType,
  NexusSchedulerInfo,
  NexusSearchSourceRecord,
  NexusSuppressionEntry,
} from '../types/nexusClientFinder';
import { auth, safeResponseJson } from './firebase';

function buildAdminHeaders(adminEmail?: string | null): Record<string, string> {
  const email = (adminEmail || auth.currentUser?.email || '').trim();
  const uid = auth.currentUser?.uid || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'NexusClientFinderAdmin',
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

export interface NexusDashboardQueryParams {
  search?: string;
  country?: string;
  category?: string;
  verificationStatus?: string;
  emailClassification?: string;
  contactStatus?: string;
  includeExpired?: boolean;
  sortBy?: 'newest' | 'oldest' | 'verified_email_first' | 'country';
}

export async function fetchNexusClientFinderDashboard(
  adminEmail?: string | null,
  query: NexusDashboardQueryParams = {}
): Promise<NexusClientFinderApiResponse> {
  const qs = new URLSearchParams();
  if (query.search) qs.set('search', query.search);
  if (query.country && query.country !== 'all') qs.set('country', query.country);
  if (query.category && query.category !== 'all') qs.set('category', query.category);
  if (query.verificationStatus && query.verificationStatus !== 'all') {
    qs.set('verificationStatus', query.verificationStatus);
  }
  if (query.emailClassification && query.emailClassification !== 'all') {
    qs.set('emailClassification', query.emailClassification);
  }
  if (query.contactStatus && query.contactStatus !== 'all') {
    qs.set('contactStatus', query.contactStatus);
  }
  if (query.includeExpired) qs.set('includeExpired', 'true');
  if (query.sortBy) qs.set('sortBy', query.sortBy);

  const resp = await fetch(`/api/admin/nexus-client-finder/dashboard?${qs.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildAdminHeaders(adminEmail),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to load Nexus Client Finder dashboard (HTTP ${resp.status})`);
  }
  return data as NexusClientFinderApiResponse;
}

export async function triggerNexusFreeDiscovery(adminEmail?: string | null): Promise<{
  runLog: NexusDiscoveryRunLog;
  stats: NexusDashboardStats;
  sources: NexusSearchSourceRecord[];
  schedulerInfo: NexusSchedulerInfo;
}> {
  const resp = await fetch('/api/admin/nexus-client-finder/run-discovery', {
    method: 'POST',
    credentials: 'include',
    headers: buildAdminHeaders(adminEmail),
    body: JSON.stringify({}),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Discovery run failed (HTTP ${resp.status})`);
  }
  return data;
}

export async function triggerNexusRecheckActive(adminEmail?: string | null): Promise<{
  checkedCount: number;
  expiredOrInactiveCount: number;
  stats: NexusDashboardStats;
}> {
  const resp = await fetch('/api/admin/nexus-client-finder/recheck-active', {
    method: 'POST',
    credentials: 'include',
    headers: buildAdminHeaders(adminEmail),
    body: JSON.stringify({}),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Active recheck failed (HTTP ${resp.status})`);
  }
  return data;
}

export async function updateNexusLeadStatus(
  adminEmail: string | null | undefined,
  leadId: string,
  payload: { contactStatus?: NexusContactStatus; contactNotes?: string }
): Promise<any> {
  const resp = await fetch(`/api/admin/nexus-client-finder/leads/${encodeURIComponent(leadId)}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildAdminHeaders(adminEmail),
    body: JSON.stringify(payload),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to update lead status (HTTP ${resp.status})`);
  }
  return data;
}

export async function updateNexusLeadsBulkStatus(
  adminEmail: string | null | undefined,
  leadIds: string[],
  contactStatus: NexusContactStatus
): Promise<{ updatedCount: number; stats: NexusDashboardStats; suppressionList: NexusSuppressionEntry[] }> {
  const resp = await fetch('/api/admin/nexus-client-finder/leads/bulk-status', {
    method: 'POST',
    credentials: 'include',
    headers: buildAdminHeaders(adminEmail),
    body: JSON.stringify({ leadIds, contactStatus }),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Bulk status update failed (HTTP ${resp.status})`);
  }
  return data;
}

export async function recordNexusOutreachEvent(
  adminEmail: string | null | undefined,
  payload: {
    leadIds: string[];
    mode: 'single_gmail' | 'bulk_bcc_gmail' | 'individual_personalized';
    subject: string;
    templateType: NexusMessageTemplateType;
    note?: string;
  }
): Promise<{ recordedCount: number; skippedSuppressedCount: number; stats: NexusDashboardStats }> {
  const resp = await fetch('/api/admin/nexus-client-finder/leads/record-outreach', {
    method: 'POST',
    credentials: 'include',
    headers: buildAdminHeaders(adminEmail),
    body: JSON.stringify(payload),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to record outreach (HTTP ${resp.status})`);
  }
  return data;
}

export async function requestNexusMessageDraft(
  adminEmail: string | null | undefined,
  leadId: string,
  templateType: NexusMessageTemplateType,
  useAiPolish = false
): Promise<NexusGeneratedMessage> {
  const resp = await fetch('/api/admin/nexus-client-finder/message-draft', {
    method: 'POST',
    credentials: 'include',
    headers: buildAdminHeaders(adminEmail),
    body: JSON.stringify({ leadId, templateType, useAiPolish }),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success || !data?.draft) {
    throw new Error(data?.error || `Failed to generate draft (HTTP ${resp.status})`);
  }
  return data.draft as NexusGeneratedMessage;
}

export async function addNexusSuppressionEntry(
  adminEmail: string | null | undefined,
  payload: { email?: string; domain?: string; reason: string; advertiserName?: string; leadId?: string }
): Promise<{ suppressionList: NexusSuppressionEntry[]; stats: NexusDashboardStats }> {
  const resp = await fetch('/api/admin/nexus-client-finder/suppression', {
    method: 'POST',
    credentials: 'include',
    headers: buildAdminHeaders(adminEmail),
    body: JSON.stringify(payload),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to add suppression rule (HTTP ${resp.status})`);
  }
  return data;
}

export async function removeNexusSuppressionEntry(
  adminEmail: string | null | undefined,
  id: string
): Promise<{ suppressionList: NexusSuppressionEntry[]; stats: NexusDashboardStats }> {
  const resp = await fetch(`/api/admin/nexus-client-finder/suppression/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildAdminHeaders(adminEmail),
  });
  const data = await safeResponseJson(resp);
  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || `Failed to remove suppression rule (HTTP ${resp.status})`);
  }
  return data;
}
