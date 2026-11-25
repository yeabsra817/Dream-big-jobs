import {
  DEFAULT_GENERAL_MIGRATION_PROFILE,
  GlobalMigrationHubEvaluationResponse,
  MigrationProfileInput,
  UserMigrationWorkspace,
} from '../types/globalMigrationHub';
import { auth } from './firebase';

const GUEST_STORAGE_KEY = 'hopeland_global_migration_hub_guest_v1';

async function buildOptionalAuthHeaders(): Promise<Record<string, string>> {
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
    // Proceed as unauthenticated guest
  }
  return headers;
}

export function loadGuestMigrationWorkspace(): UserMigrationWorkspace {
  const fallback: UserMigrationWorkspace = {
    profile: {
      ...DEFAULT_GENERAL_MIGRATION_PROFILE,
      coreSkills: [...DEFAULT_GENERAL_MIGRATION_PROFILE.coreSkills],
      targetSectors: [...DEFAULT_GENERAL_MIGRATION_PROFILE.targetSectors],
    },
    selectedCountries: [],
    savedOpportunityIds: [],
    applicationTracker: [],
    updatedAt: new Date().toISOString(),
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<UserMigrationWorkspace>;
    return {
      profile: {
        ...fallback.profile,
        ...(parsed.profile || {}),
        coreSkills: Array.isArray(parsed.profile?.coreSkills) ? parsed.profile.coreSkills : [],
        targetSectors: Array.isArray(parsed.profile?.targetSectors)
          ? parsed.profile.targetSectors
          : fallback.profile.targetSectors,
      },
      selectedCountries: Array.isArray(parsed.selectedCountries) ? parsed.selectedCountries : [],
      savedOpportunityIds: Array.isArray(parsed.savedOpportunityIds) ? parsed.savedOpportunityIds : [],
      applicationTracker: Array.isArray(parsed.applicationTracker) ? parsed.applicationTracker : [],
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}

export function saveGuestMigrationWorkspace(workspace: UserMigrationWorkspace): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Ignore storage quota issues
  }
}

export async function fetchUserMigrationWorkspace(): Promise<UserMigrationWorkspace | null> {
  const headers = await buildOptionalAuthHeaders();
  if (!headers['x-user-uid'] && !headers.Authorization) {
    return null;
  }
  const res = await fetch('/api/global-migration-hub/user-state', {
    method: 'GET',
    headers,
  });
  if (res.status === 401) return null;
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Could not load your saved career & migration workspace.');
  }
  return data.workspace as UserMigrationWorkspace;
}

export async function saveUserMigrationWorkspace(
  workspace: Partial<UserMigrationWorkspace>
): Promise<UserMigrationWorkspace> {
  const headers = await buildOptionalAuthHeaders();
  const res = await fetch('/api/global-migration-hub/user-state', {
    method: 'PUT',
    headers,
    body: JSON.stringify(workspace),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Could not save your workspace.');
  }
  return data.workspace as UserMigrationWorkspace;
}

export async function evaluateGlobalMigrationHub(params: {
  profile: MigrationProfileInput;
  selectedCountries: string[];
}): Promise<GlobalMigrationHubEvaluationResponse> {
  const headers = await buildOptionalAuthHeaders();
  const res = await fetch('/api/global-migration-hub/evaluate', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Failed to evaluate global migration and career opportunities.');
  }
  return data as GlobalMigrationHubEvaluationResponse;
}

export async function triggerMigrationChangeRefresh(): Promise<{
  lastRefreshAt: string;
  nextRefreshAt: string;
  meaningfulChangeDetected: boolean;
}> {
  const res = await fetch('/api/global-migration-hub/refresh-changes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Failed to refresh opportunity change monitor.');
  }
  return {
    lastRefreshAt: data.lastRefreshAt,
    nextRefreshAt: data.nextRefreshAt,
    meaningfulChangeDetected: Boolean(data.meaningfulChangeDetected),
  };
}
