import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  AutonomousSchedulerInfo,
  DiscoveryJobLogRecord,
  GlobalOpportunitiesApiResponse,
  GlobalOpportunity,
  GlobalOpportunitySubsection,
  OpportunitySourceRecord,
  OpportunityVerificationLogRecord,
  UserSavedOpportunityRecord,
} from '../types/globalOpportunities';

export interface GlobalOpportunitiesFilterParams {
  subsection?: GlobalOpportunitySubsection | 'all';
  category?: string;
  country?: string;
  funding?: string;
  visa?: string;
  experience?: string;
  eligibility?: string;
  deadline?: string;
  q?: string;
}

function buildAuthHeaders(userUid?: string | null, userEmail?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const uid = userUid || auth?.currentUser?.uid || '';
  const email = userEmail || auth?.currentUser?.email || '';
  if (uid) headers['x-user-uid'] = uid;
  if (email) headers['x-user-email'] = email;
  return headers;
}

export async function fetchGlobalOpportunities(
  filters: GlobalOpportunitiesFilterParams = {},
  userUid?: string | null,
  userEmail?: string | null
): Promise<GlobalOpportunitiesApiResponse> {
  const params = new URLSearchParams();
  if (filters.subsection && filters.subsection !== 'all') params.set('subsection', filters.subsection);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.country && filters.country !== 'all') params.set('country', filters.country);
  if (filters.funding && filters.funding !== 'all') params.set('funding', filters.funding);
  if (filters.visa && filters.visa !== 'all') params.set('visa', filters.visa);
  if (filters.experience && filters.experience !== 'all') params.set('experience', filters.experience);
  if (filters.eligibility && filters.eligibility !== 'all') params.set('eligibility', filters.eligibility);
  if (filters.deadline && filters.deadline !== 'all') params.set('deadline', filters.deadline);
  if (filters.q && filters.q.trim()) params.set('q', filters.q.trim());

  const qs = params.toString();
  const resp = await fetch(`/api/global-opportunities${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: buildAuthHeaders(userUid, userEmail),
    cache: 'no-store',
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch global opportunities (HTTP ${resp.status})`);
  }
  return resp.json();
}

export async function toggleSavedGlobalOpportunity(
  opportunity: GlobalOpportunity,
  currentlySaved: boolean,
  userUid: string,
  userEmail?: string | null
): Promise<{ saved: boolean }> {
  const saveId = `usave_${userUid}_${opportunity.id}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);

  // Persist to backend API
  const resp = await fetch('/api/global-opportunities/saved/toggle', {
    method: 'POST',
    headers: buildAuthHeaders(userUid, userEmail),
    body: JSON.stringify({ opportunityId: opportunity.id }),
  });

  if (!resp.ok) {
    throw new Error('Could not update saved opportunity status.');
  }

  // Mirror to Firestore user_saved_opportunities collection (owner-scoped)
  try {
    if (db && auth?.currentUser?.uid === userUid) {
      const ref = doc(db, 'user_saved_opportunities', saveId);
      if (currentlySaved) {
        await deleteDoc(ref);
      } else {
        const record: UserSavedOpportunityRecord = {
          id: saveId,
          userId: userUid,
          opportunityId: opportunity.id,
          title: opportunity.title.slice(0, 300),
          organization: opportunity.organization.slice(0, 250),
          category: opportunity.category,
          country: opportunity.country.slice(0, 120),
          deadlineUtcIso: opportunity.deadline.deadlineUtcIso,
          officialApplicationUrl: opportunity.officialApplicationUrl,
          savedAt: new Date().toISOString(),
        };
        await setDoc(ref, record, { merge: true });
      }
    }
  } catch (err) {
    console.warn('Firestore mirror for user_saved_opportunities skipped:', err);
  }

  const data = await resp.json();
  return { saved: Boolean(data.saved) };
}

export async function fetchUserSavedOpportunityIdsFirestore(userUid: string): Promise<string[]> {
  if (!db || !userUid) return [];
  try {
    const q = query(collection(db, 'user_saved_opportunities'), where('userId', '==', userUid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => String(d.data()?.opportunityId || '')).filter(Boolean);
  } catch {
    return [];
  }
}

export async function triggerAdminGlobalDiscovery(adminEmail?: string | null): Promise<{
  success: boolean;
  runLog: DiscoveryJobLogRecord;
  sources: OpportunitySourceRecord[];
  activeVerifiedCount: number;
}> {
  const resp = await fetch('/api/admin/global-opportunities/run-discovery', {
    method: 'POST',
    headers: buildAuthHeaders(auth?.currentUser?.uid, adminEmail),
    credentials: 'include',
    body: JSON.stringify({}),
  });
  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(data.error || `Discovery failed (HTTP ${resp.status})`);
  }
  return data;
}

export async function triggerAdminDeadlineRecheck(
  checkLinksLive: boolean = true,
  adminEmail?: string | null
): Promise<{ success: boolean; runLog: DiscoveryJobLogRecord }> {
  const resp = await fetch('/api/admin/global-opportunities/recheck-deadlines', {
    method: 'POST',
    headers: buildAuthHeaders(auth?.currentUser?.uid, adminEmail),
    credentials: 'include',
    body: JSON.stringify({ checkLinksLive }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(data.error || `Deadline recheck failed (HTTP ${resp.status})`);
  }
  return data;
}

export async function fetchAdminGlobalOpportunityLogs(adminEmail?: string | null): Promise<{
  success: boolean;
  verificationLogs: OpportunityVerificationLogRecord[];
  discoveryJobLogs: DiscoveryJobLogRecord[];
  sources: OpportunitySourceRecord[];
  schedulerInfo?: AutonomousSchedulerInfo;
  totals: {
    stored: number;
    activeVerified: number;
    savedCount: number;
    recommendationsCount: number;
  };
}> {
  const resp = await fetch('/api/global-opportunities/logs', {
    method: 'GET',
    headers: buildAuthHeaders(auth?.currentUser?.uid, adminEmail),
    credentials: 'include',
  });
  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(data.error || `Could not load logs (HTTP ${resp.status})`);
  }
  return data;
}

export async function acknowledgeAdminDiscoveryAlert(adminEmail?: string | null): Promise<{
  success: boolean;
  schedulerInfo?: AutonomousSchedulerInfo;
}> {
  const resp = await fetch('/api/admin/global-opportunities/acknowledge-alert', {
    method: 'POST',
    headers: buildAuthHeaders(auth?.currentUser?.uid, adminEmail),
    credentials: 'include',
    body: JSON.stringify({}),
  });
  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(data.error || `Could not acknowledge alert (HTTP ${resp.status})`);
  }
  return data;
}
