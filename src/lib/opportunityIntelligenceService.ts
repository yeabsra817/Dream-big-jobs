import { auth } from './firebase';
import type {
  AdminOpportunityIntelligenceDashboardResponse,
  OpportunityEnvironment,
  ScheduledDiscoveryLogRecord,
  UserNotificationHistoryRecord,
  UserNotificationPreferenceRecord,
} from '../types/opportunityIntelligence';

function buildAuthHeaders(adminEmail?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const uid = auth?.currentUser?.uid || '';
  const email = adminEmail || auth?.currentUser?.email || '';
  if (uid) headers['x-user-uid'] = uid;
  if (email) headers['x-user-email'] = email;
  return headers;
}

export interface BranchBankingIntelligenceItem {
  id: string;
  positionTitle: string;
  employer: string;
  country: string;
  city: string;
  workMode?: string;
  environment: OpportunityEnvironment;
  category?: string;
  publishedDate?: string | null;
  salary: string;
  salaryPeriod: string;
  salaryTaxBasis: string;
  normalizedMonthlyUsd: number | null;
  requiredBankingExperience: string;
  requiredManagerialExperience: string;
  actualResponsibilities: string[];
  visaSponsorshipStatus: string;
  visaEvidence?: string;
  visaFeesCovered: string;
  relocationSupport: string;
  ethiopianEligibility?: string;
  applicationDeadline: string;
  deadlineStatusLabel?: string;
  deadlineTime?: string | null;
  deadlineTimezone?: string | null;
  fullDaysRemaining: number | null;
  officialSourceWebsite?: string;
  officialApplicationLink: string;
  applicationLinkStatus?: string;
  lastVerifiedAt?: string;
  verificationStatus: string;
  whyMatchesReferenceProfile: string[];
  relevanceScore: number;
}

export interface LiveOpportunityVerificationResult {
  success: boolean;
  opportunityId: string;
  verified: boolean;
  httpStatus?: number | null;
  linkStatus: 'VERIFIED' | 'NOT VERIFIED';
  isClosedPage?: boolean;
  deadlineStatusLabel: string;
  deadlineDateExact?: string | null;
  deadlineTime?: string | null;
  deadlineTimezone?: string | null;
  fullDaysRemaining: number | null;
  lastVerifiedAt: string;
  note: string;
}

export async function fetchAdminOpportunityIntelligenceDashboard(
  adminEmail?: string | null
): Promise<AdminOpportunityIntelligenceDashboardResponse> {
  const res = await fetch('/api/opportunity-intelligence/admin/dashboard', {
    method: 'GET',
    credentials: 'include',
    headers: buildAuthHeaders(adminEmail),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(
      data?.error || `HTTP ${res.status}: Unable to load Opportunity Intelligence Dashboard.`
    );
  }
  return data as AdminOpportunityIntelligenceDashboardResponse;
}

export async function triggerAdminDailyOpportunityCheck(
  adminEmail?: string | null
): Promise<{
  success: boolean;
  run?: ScheduledDiscoveryLogRecord;
  dashboard?: AdminOpportunityIntelligenceDashboardResponse;
  error?: string;
}> {
  const res = await fetch('/api/opportunity-intelligence/admin/run-daily-check', {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(adminEmail),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}: Failed to run daily source monitoring.`);
  }
  return data;
}

export async function fetchBranchBankingIntelligence(params?: {
  environment?: 'all' | 'international' | 'ethiopia_domestic';
  q?: string;
}): Promise<{
  success: boolean;
  totalMatched: number;
  jobs: BranchBankingIntelligenceItem[];
}> {
  const query = new URLSearchParams();
  if (params?.environment) query.set('environment', params.environment);
  if (params?.q) query.set('q', params.q);

  const res = await fetch(`/api/opportunity-intelligence/branch-banking?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `HTTP ${res.status}: Failed to load Branch Banking intelligence.`);
  }
  return data;
}

export async function verifyOpportunityLive(
  opportunityId: string,
  payload?: { url?: string; applicationDeadline?: string | null }
): Promise<LiveOpportunityVerificationResult | null> {
  try {
    const res = await fetch(
      `/api/opportunity-intelligence/opportunities/${encodeURIComponent(opportunityId)}/verify-live`,
      {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify(payload || {}),
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) return null;
    return data as LiveOpportunityVerificationResult;
  } catch {
    return null;
  }
}

export async function fetchUserNotificationPreferences(): Promise<{
  preferences: UserNotificationPreferenceRecord;
  history: UserNotificationHistoryRecord[];
}> {
  const res = await fetch('/api/opportunity-intelligence/notifications/preferences', {
    method: 'GET',
    credentials: 'include',
    headers: buildAuthHeaders(),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `HTTP ${res.status}: Unable to load notification preferences.`);
  }
  return {
    preferences: data.preferences,
    history: Array.isArray(data.history) ? data.history : [],
  };
}

export async function saveUserNotificationPreferences(
  updates: Partial<UserNotificationPreferenceRecord>
): Promise<UserNotificationPreferenceRecord> {
  const res = await fetch('/api/opportunity-intelligence/notifications/preferences', {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `HTTP ${res.status}: Unable to save notification preferences.`);
  }
  return data.preferences;
}

export async function markOpportunityViewedForDeduplication(
  opportunityId: string,
  saved = false
): Promise<void> {
  try {
    await fetch('/api/opportunity-intelligence/notifications/mark-viewed', {
      method: 'POST',
      credentials: 'include',
      headers: buildAuthHeaders(),
      body: JSON.stringify({ opportunityId, saved }),
    });
  } catch {
    // Non-blocking
  }
}
