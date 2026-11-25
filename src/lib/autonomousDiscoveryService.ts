import { auth } from './firebase';
import type {
  AdminAutonomousTelemetryResponse,
  AutonomousDiscoveryStatusResponse,
  AutonomousNewMatchNotification,
} from '../types/autonomousDiscovery';

function buildOwnerHeaders(adminEmail?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const uid = auth?.currentUser?.uid || '';
  const email = adminEmail || auth?.currentUser?.email || '';
  if (uid) headers['x-user-uid'] = uid;
  if (email) headers['x-user-email'] = email;
  return headers;
}

export async function fetchAutonomousDiscoveryStatus(): Promise<AutonomousDiscoveryStatusResponse | null> {
  try {
    const res = await fetch('/api/autonomous-discovery/status', {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AutonomousDiscoveryStatusResponse;
    return data?.success ? data : null;
  } catch {
    return null;
  }
}

export async function fetchAdminAutonomousTelemetry(
  adminEmail?: string | null
): Promise<AdminAutonomousTelemetryResponse> {
  const res = await fetch('/api/autonomous-discovery/admin-telemetry', {
    method: 'GET',
    credentials: 'include',
    headers: buildOwnerHeaders(adminEmail),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `HTTP ${res.status}: Unable to load operational telemetry.`);
  }
  return data as AdminAutonomousTelemetryResponse;
}

export async function triggerAdminAutonomousCycle(
  adminEmail?: string | null
): Promise<{ success: boolean; cycle?: any; error?: string }> {
  const res = await fetch('/api/autonomous-discovery/trigger', {
    method: 'POST',
    credentials: 'include',
    headers: buildOwnerHeaders(adminEmail),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}: Failed to trigger discovery cycle.`);
  }
  return data;
}

export async function fetchOwnerAutonomousNotifications(
  adminEmail?: string | null
): Promise<AutonomousNewMatchNotification[]> {
  try {
    const res = await fetch('/api/autonomous-discovery/notifications', {
      credentials: 'include',
      headers: buildOwnerHeaders(adminEmail),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      success?: boolean;
      notifications?: AutonomousNewMatchNotification[];
    };
    return Array.isArray(data?.notifications) ? data.notifications : [];
  } catch {
    return [];
  }
}
