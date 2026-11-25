import {
  BranchManagerJobsSearchResponse,
  BranchManagerProfileInput,
  BranchManagerRegionScope,
  DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE,
} from '../types/branchManagerJobs';
import { auth } from './firebase';

const GUEST_PROFILE_STORAGE_KEY = 'hopeland_branch_manager_jobs_profile_v1';

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      if (user.uid) headers['x-user-uid'] = user.uid;
      if (user.email) headers['x-user-email'] = user.email;
    }
  } catch {
    // Continue as guest
  }
  return headers;
}

export function loadGuestBranchManagerProfile(): BranchManagerProfileInput {
  const fallback: BranchManagerProfileInput = {
    ...DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE,
    employers: [...DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE.employers],
    coreSkills: [...DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE.coreSkills],
    targetPositions: [...DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE.targetPositions],
    languages: [...DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE.languages],
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(GUEST_PROFILE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<BranchManagerProfileInput>;
    return {
      ...fallback,
      ...parsed,
      employers: Array.isArray(parsed.employers) ? parsed.employers : fallback.employers,
      coreSkills: Array.isArray(parsed.coreSkills) ? parsed.coreSkills : fallback.coreSkills,
      targetPositions: Array.isArray(parsed.targetPositions)
        ? parsed.targetPositions
        : fallback.targetPositions,
      languages: Array.isArray(parsed.languages) ? parsed.languages : fallback.languages,
      minimumMonthlyGrossUsd: 0,
    };
  } catch {
    return fallback;
  }
}

export function saveGuestBranchManagerProfile(profile: BranchManagerProfileInput): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage errors
  }
}

export async function fetchSavedBranchManagerProfile(): Promise<{
  profile: BranchManagerProfileInput;
  isOwnerAccountProfile: boolean;
} | null> {
  const headers = await buildAuthHeaders();
  if (!headers['x-user-uid'] && !headers.Authorization) return null;
  const res = await fetch('/api/branch-manager-jobs/user-profile', {
    method: 'GET',
    headers,
  });
  if (res.status === 401) return null;
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Could not load your saved profile.');
  }
  return {
    profile: data.profile as BranchManagerProfileInput,
    isOwnerAccountProfile: Boolean(data.isOwnerAccountProfile),
  };
}

export async function saveUserBranchManagerProfile(
  profile: BranchManagerProfileInput
): Promise<BranchManagerProfileInput> {
  const headers = await buildAuthHeaders();
  const res = await fetch('/api/branch-manager-jobs/user-profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ profile }),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Could not save your profile.');
  }
  return data.profile as BranchManagerProfileInput;
}

export async function searchBranchManagerJobs(params: {
  profile?: BranchManagerProfileInput;
  regionFilter?: BranchManagerRegionScope | 'ALL';
  positionFilter?: string;
  minSalaryUsd?: number;
  searchQuery?: string;
}): Promise<BranchManagerJobsSearchResponse> {
  const headers = await buildAuthHeaders();
  const res = await fetch('/api/branch-manager-jobs/search', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Failed to load verified visa-sponsored Branch Banking jobs.');
  }
  return data as BranchManagerJobsSearchResponse;
}

export async function triggerBranchManagerLiveDiscovery(
  profile?: BranchManagerProfileInput
): Promise<BranchManagerJobsSearchResponse> {
  const headers = await buildAuthHeaders();
  const res = await fetch('/api/branch-manager-jobs/discover', {
    method: 'POST',
    headers,
    body: JSON.stringify({ profile }),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Failed to scan live official portals.');
  }
  return data as BranchManagerJobsSearchResponse;
}
