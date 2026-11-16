import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Download,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  UserX,
  Ban,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Mail,
  Activity,
  X,
  Clock,
  Play,
  Server,
} from 'lucide-react';
import {
  AdminSchedulerStatusResponse,
  RegisteredUserAnalyticsSummary,
} from '../../types/jobSeeker';
import {
  fetchAdminSchedulerStatus,
  fetchRegisteredUserAnalyticsAdmin,
  triggerAdminSchedulerRun,
  updateAdminUserAccountStatus,
  verifyAdminSmtpConnection,
} from '../../lib/notificationService';
import { getOwnerAuthHeaders } from '../../lib/firebase';

interface Props {
  adminEmail?: string | null;
}

type UserFilterKey =
  | 'all'
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'completed'
  | 'incomplete'
  | 'notifications_enabled';

export const UserAnalyticsCenter: React.FC<Props> = ({ adminEmail }) => {
  const [summary, setSummary] = useState<RegisteredUserAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<UserFilterKey>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Account Status Action Modal State
  const [targetUser, setTargetUser] = useState<RegisteredUserAnalyticsSummary['users'][0] | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'active' | 'inactive' | 'suspended'>('suspended');
  const [statusReason, setStatusReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Automated Notification & Scheduler Console State
  const [schedulerStatus, setSchedulerStatus] = useState<AdminSchedulerStatusResponse | null>(null);
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);
  const [isVerifyingSmtp, setIsVerifyingSmtp] = useState(false);
  const [smtpCheckResult, setSmtpCheckResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, sched] = await Promise.all([
        fetchRegisteredUserAnalyticsAdmin(adminEmail || undefined),
        fetchAdminSchedulerStatus(adminEmail || undefined),
      ]);
      if (!data) {
        setError('Unable to load live user analytics. Verify you are signed in as the platform owner.');
      } else {
        setSummary(data);
      }
      if (sched) {
        setSchedulerStatus(sched);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed loading registered user analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [adminEmail]);

  const handleRunScheduler = async (dryRun: boolean) => {
    setIsRunningScheduler(true);
    setError(null);
    try {
      const res = await triggerAdminSchedulerRun({ dryRun }, adminEmail || undefined);
      if (res.schedulerStatus) {
        setSchedulerStatus(res.schedulerStatus);
      }
      if (res.skipped) {
        setActionToast(res.reason || 'Scheduler sweep already in progress.');
      } else if (res.run) {
        setActionToast(
          `${dryRun ? 'Dry-run simulation' : 'Scheduler sweep'} ${res.run.status}: ${res.run.usersEvaluated} users evaluated, ${res.run.notificationsCreated} alerts ${dryRun ? 'matched' : 'dispatched'}.`
        );
      }
      await loadAnalytics();
      setTimeout(() => setActionToast(null), 5000);
    } catch (err: any) {
      setError(err?.message || 'Failed running notification scheduler.');
    } finally {
      setIsRunningScheduler(false);
    }
  };

  const handleVerifySmtp = async () => {
    setIsVerifyingSmtp(true);
    setSmtpCheckResult(null);
    try {
      const res = await verifyAdminSmtpConnection(adminEmail || undefined);
      setSmtpCheckResult({ ok: Boolean(res.verified), message: res.message });
    } catch (err: any) {
      setSmtpCheckResult({ ok: false, message: err?.message || 'SMTP verification request failed.' });
    } finally {
      setIsVerifyingSmtp(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const list = summary?.users || [];
    const q = searchQuery.toLowerCase().trim();
    return list.filter((u) => {
      if (activeFilter === 'active' && u.accountStatus !== 'active') return false;
      if (activeFilter === 'inactive' && u.accountStatus !== 'inactive') return false;
      if (activeFilter === 'suspended' && u.accountStatus !== 'suspended') return false;
      if (activeFilter === 'completed' && !u.isProfileComplete) return false;
      if (activeFilter === 'incomplete' && u.isProfileComplete) return false;
      if (activeFilter === 'notifications_enabled' && !u.notificationsEnabled) return false;

      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.desiredJobTitle.toLowerCase().includes(q) ||
        u.preferredIndustry.toLowerCase().includes(q) ||
        u.locationCity.toLowerCase().includes(q) ||
        u.accountRole.toLowerCase().includes(q)
      );
    });
  }, [summary, searchQuery, activeFilter]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/admin/users/export.csv', {
        headers: getOwnerAuthHeaders(adminEmail || undefined),
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to export user report. Ensure owner session is active.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hopelandjobs-registered-users-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setActionToast('CSV export downloaded successfully.');
      setTimeout(() => setActionToast(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'CSV export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!targetUser) return;
    setIsUpdatingStatus(true);
    try {
      const updatedSummary = await updateAdminUserAccountStatus(
        targetUser.uid,
        pendingStatus,
        statusReason.trim() || undefined,
        adminEmail || undefined
      );
      if (updatedSummary) setSummary(updatedSummary);
      setActionToast(`${targetUser.fullName} updated to ${pendingStatus.toUpperCase()}.`);
      setTimeout(() => setActionToast(null), 3500);
      setTargetUser(null);
      setStatusReason('');
    } catch (err: any) {
      setError(err?.message || 'Failed updating account status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const metrics = summary?.metrics;
  const timeline = summary?.registrationTimeline || [];
  const maxTimelineCount = Math.max(1, ...timeline.map((t) => t.count));
  const sectorList = summary?.sectorBreakdown || [];
  const maxSectorCount = Math.max(1, ...sectorList.map((s) => s.count));

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Registered User Analytics &amp; Account Control
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Live counts computed strictly from unique registered accounts. Passwords, hashes, and private CVs are never exposed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadAnalytics}
            disabled={loading}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Live Data</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting || !summary}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>{isExporting ? 'Exporting...' : 'Download CSV Report'}</span>
          </button>
        </div>
      </div>

      {actionToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadAnalytics}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 10 Real Registered User KPI Cards */}
      {loading && !summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500">Total Registered Users</div>
            <div className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1">
              {metrics.totalRegisteredUsers}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Unique registered accounts</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-emerald-700">Active Accounts</div>
            <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1">
              {metrics.totalActiveUsers}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Active within 30 days</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-slate-600">Inactive &amp; Suspended</div>
            <div className="text-2xl font-black text-slate-700 font-mono tabular-nums mt-1">
              {metrics.totalInactiveUsers}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              Suspended: {metrics.totalSuspendedUsers}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-amber-700">New Today</div>
            <div className="text-2xl font-black text-amber-700 font-mono tabular-nums mt-1">
              {metrics.newRegistrationsToday}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Registered today</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-slate-600">New This Week</div>
            <div className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1">
              {metrics.newRegistrationsThisWeek}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Last 7 days</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-slate-600">New This Month</div>
            <div className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1">
              {metrics.newRegistrationsThisMonth}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Last 30 days</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-emerald-700">Completed Profiles</div>
            <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1">
              {metrics.completedProfilesCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">70%+ completion score</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-amber-700">Incomplete Profiles</div>
            <div className="text-2xl font-black text-amber-700 font-mono tabular-nums mt-1">
              {metrics.incompleteProfilesCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Below 70% completion</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-sky-700">Notifications Enabled</div>
            <div className="text-2xl font-black text-sky-700 font-mono tabular-nums mt-1">
              {metrics.notificationsEnabledCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Granted or active alert channels</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-slate-600">Receiving Job Matches</div>
            <div className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1">
              {metrics.usersReceivingRecommendationsCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Matched with active verified jobs</div>
          </div>
        </div>
      ) : null}

      {/* Charts + Queue Health */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Registration Timeline SVG Bar Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  14-Day Registration Timeline
                </h3>
                <p className="text-xs text-slate-500">
                  Daily unique candidate &amp; staff signups
                </p>
              </div>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>

            <div className="h-44 flex items-end gap-1.5 pt-4 border-b border-slate-200 pb-2">
              {timeline.map((day) => {
                const heightPct = Math.max(6, Math.round((day.count / maxTimelineCount) * 100));
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center justify-end gap-1 h-full group"
                    title={`${day.date}: ${day.count} registrations`}
                  >
                    <span className="text-[10px] font-mono tabular-nums text-slate-600 font-bold">
                      {day.count > 0 ? day.count : ''}
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-colors ${
                        day.count > 0 ? 'bg-[#0B132B] group-hover:bg-amber-500' : 'bg-slate-100'
                      }`}
                      style={{ height: `${day.count > 0 ? heightPct : 4}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>{timeline[0]?.date}</span>
              <span>{timeline[Math.floor(timeline.length / 2)]?.date}</span>
              <span>{timeline[timeline.length - 1]?.date}</span>
            </div>
          </div>

          {/* Delivery Queue Health & Email / Push Status */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Notification Delivery Health
              </h3>
              <Bell className="w-4 h-4 text-amber-500" />
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Total Job Alerts Logged</span>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {summary.deliveryHealth.totalNotificationsSent}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Web Push Deliveries</span>
                <span className="font-mono font-bold tabular-nums text-emerald-700">
                  {summary.deliveryHealth.pushDeliveriesCount}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Email Deliveries</span>
                <span className="font-mono font-bold tabular-nums text-sky-700">
                  {summary.deliveryHealth.emailDeliveriesCount}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Retry Queue (Pending / Failed)</span>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {summary.deliveryHealth.queuePending} / {summary.deliveryHealth.queueFailed}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>SMTP Email Server</span>
                </span>
                <span
                  className={`text-xs font-bold ${
                    summary.deliveryHealth.smtpConfigured ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {summary.deliveryHealth.smtpConfigured ? 'Configured' : 'Not Configured'}
                </span>
              </div>
            </div>

            {!summary.deliveryHealth.smtpConfigured && (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables to dispatch real outbound emails; Website Bell &amp; Web Push operate independently.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Automated Notification & Background Scheduler Operations Console */}
      {schedulerStatus && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0B132B]" />
                <span>Automated Notification &amp; Scheduler Operations Console</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cron path: <span className="font-mono text-slate-700">{schedulerStatus.scheduler.cronPath}</span> · Schedule:{' '}
                <span className="font-mono text-slate-700">{schedulerStatus.scheduler.cronSchedule}</span> · Runtime:{' '}
                <span className="font-mono text-slate-700">{schedulerStatus.environment.runtime}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleVerifySmtp}
                disabled={isVerifyingSmtp}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5 text-slate-600" />
                <span>{isVerifyingSmtp ? 'Verifying SMTP...' : 'Verify SMTP Connection'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleRunScheduler(true)}
                disabled={isRunningScheduler}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Server className="w-3.5 h-3.5 text-slate-600" />
                <span>Dry-Run Check</span>
              </button>

              <button
                type="button"
                onClick={() => handleRunScheduler(false)}
                disabled={isRunningScheduler}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 text-amber-400" />
                <span>{isRunningScheduler ? 'Running Sweep...' : 'Run Scheduler Now'}</span>
              </button>
            </div>
          </div>

          {smtpCheckResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                smtpCheckResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              {smtpCheckResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{smtpCheckResult.message}</span>
            </div>
          )}

          {/* Scheduler Telemetry Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs border-b border-slate-200 pb-4">
            <div>
              <div className="text-[11px] font-bold text-slate-500">Scheduler State</div>
              <div
                className={`font-extrabold mt-0.5 ${
                  schedulerStatus.scheduler.status === 'running'
                    ? 'text-amber-700'
                    : schedulerStatus.scheduler.status === 'error'
                    ? 'text-rose-700'
                    : 'text-emerald-700'
                }`}
              >
                {schedulerStatus.scheduler.status === 'running'
                  ? 'Running'
                  : schedulerStatus.scheduler.status === 'error'
                  ? 'Attention Required'
                  : 'Idle / Ready'}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500">Last Success</div>
              <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 text-[11px]">
                {schedulerStatus.scheduler.lastSuccessfulRunAt
                  ? new Date(schedulerStatus.scheduler.lastSuccessfulRunAt).toLocaleString()
                  : 'Not run yet'}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500">Next Scheduled</div>
              <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5 text-[11px]">
                {new Date(schedulerStatus.scheduler.nextScheduledRunAt).toLocaleTimeString()}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500">Total Sent</div>
              <div className="font-mono tabular-nums font-black text-slate-900 text-sm mt-0.5">
                {schedulerStatus.totals.totalNotificationsSent}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500">Successful</div>
              <div className="font-mono tabular-nums font-black text-emerald-700 text-sm mt-0.5">
                {schedulerStatus.totals.successfulDeliveries}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500">Failed / Retry</div>
              <div className="font-mono tabular-nums font-black text-rose-700 text-sm mt-0.5">
                {schedulerStatus.totals.failedDeliveries} / {schedulerStatus.totals.pendingNotifications}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500">Push Devices</div>
              <div className="font-mono tabular-nums font-black text-slate-900 text-sm mt-0.5">
                {schedulerStatus.totals.activePushSubscriptionsCount}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500">Matched Users</div>
              <div className="font-mono tabular-nums font-black text-slate-900 text-sm mt-0.5">
                {schedulerStatus.totals.usersReceivingRecommendationsCount}
              </div>
            </div>
          </div>

          {/* Environment Config Status (Booleans only, never exposing secret values) */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-700">
            <span>
              SMTP Email:{' '}
              <strong className={schedulerStatus.environment.smtpConfigured ? 'text-emerald-700' : 'text-amber-700'}>
                {schedulerStatus.environment.smtpConfigured
                  ? `Configured (${schedulerStatus.environment.smtpHost}:${schedulerStatus.environment.smtpPort})`
                  : 'Missing Env Vars'}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>
              VAPID Web Push:{' '}
              <strong className={schedulerStatus.environment.vapidConfigured ? 'text-emerald-700' : 'text-rose-700'}>
                {schedulerStatus.environment.vapidConfigured
                  ? `Ready (${schedulerStatus.environment.vapidSource === 'environment' ? 'Vercel Env' : 'Persisted Keypair'})`
                  : 'Unset'}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>
              Gemini AI Key:{' '}
              <strong className={schedulerStatus.environment.geminiConfigured ? 'text-emerald-700' : 'text-amber-700'}>
                {schedulerStatus.environment.geminiConfigured ? 'Configured' : 'Missing Env Var'}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>
              Cron Auth Secret:{' '}
              <strong className={schedulerStatus.environment.cronSecretConfigured ? 'text-emerald-700' : 'text-slate-600'}>
                {schedulerStatus.environment.cronSecretConfigured ? 'CRON_SECRET Active' : 'Vercel Header Mode'}
              </strong>
            </span>
          </div>

          {schedulerStatus.environment.missingEnvVars.length > 0 && (
            <p className="text-[11px] text-amber-800 font-medium">
              Environment variables unset in current process: {schedulerStatus.environment.missingEnvVars.join(', ')}. Ensure these are configured in Vercel Project Settings &rarr; Environment Variables.
            </p>
          )}

          {/* Scheduler Execution History Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                  <th className="py-2.5 px-3">Executed At</th>
                  <th className="py-2.5 px-3">Trigger</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Users</th>
                  <th className="py-2.5 px-3 text-right">Alerts</th>
                  <th className="py-2.5 px-3 text-right">Push (Ok/Fail)</th>
                  <th className="py-2.5 px-3 text-right">Email (Ok/Fail)</th>
                  <th className="py-2.5 px-3 text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {schedulerStatus.recentRuns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500">
                      No scheduler sweeps recorded yet. Click Run Scheduler Now to execute and record an initial sweep.
                    </td>
                  </tr>
                ) : (
                  schedulerStatus.recentRuns.slice(0, 8).map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono tabular-nums text-[11px] text-slate-700">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {run.trigger}{run.dryRun ? ' (dry-run)' : ''}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <span
                          className={
                            run.status === 'success'
                              ? 'text-emerald-700'
                              : run.status === 'partial'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }
                        >
                          {run.status === 'success' ? 'Success' : run.status === 'partial' ? 'Partial' : 'Failed'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{run.usersEvaluated}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">{run.notificationsCreated}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {run.pushSucceeded}/{run.pushFailed}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {run.emailSucceeded}/{run.emailFailed}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                        {run.durationMs}ms
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {schedulerStatus.recentErrors.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-rose-800">Recent Scheduler &amp; Delivery Errors</div>
              {schedulerStatus.recentErrors.slice(0, 4).map((errItem, idx) => (
                <div key={idx} className="text-[11px] text-rose-900 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  <span className="font-mono tabular-nums text-rose-700 mr-2">
                    {new Date(errItem.timestamp).toLocaleString()}
                  </span>
                  <span className="font-bold mr-1.5">[{errItem.source}]</span>
                  <span>{errItem.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sector Distribution + Suspicious Account Flags */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900">
              Candidate Sector Distribution
            </h3>
            {sectorList.length === 0 ? (
              <p className="text-xs text-slate-500">No sector preferences recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {sectorList.slice(0, 8).map((sec) => (
                  <div key={sec.sector} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate">{sec.sector}</span>
                      <span className="font-mono tabular-nums font-bold text-slate-600">{sec.count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${Math.round((sec.count / maxSectorCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Duplicate / Suspicious Accounts & Delivery Failures */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Security &amp; Account Integrity Flags
              </h3>
              <ShieldAlert className="w-4 h-4 text-amber-600" />
            </div>

            {summary.suspiciousDuplicates.length === 0 &&
            summary.deliveryHealth.recentFailures.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>No duplicate accounts or critical notification delivery failures detected.</span>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {summary.suspiciousDuplicates.map((dup, i) => (
                  <div key={i} className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                    <div className="font-bold text-amber-950">{dup.reason}</div>
                    <div className="text-[11px] text-amber-900">
                      Emails: {dup.emails.join(', ')}
                    </div>
                  </div>
                ))}
                {summary.deliveryHealth.recentFailures.slice(0, 4).map((fail) => (
                  <div key={fail.id} className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-0.5">
                    <div className="font-bold text-rose-900">
                      Failed {fail.channel} delivery ({fail.attempts} attempts)
                    </div>
                    <div className="text-[11px] text-rose-800">{fail.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search, Filter & Registered Users Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              <span>Registered Users Directory ({filteredUsers.length})</span>
            </h3>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, role, city..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'inactive', label: 'Inactive' },
              { id: 'suspended', label: 'Suspended' },
              { id: 'completed', label: 'Completed Profiles' },
              { id: 'incomplete', label: 'Incomplete Profiles' },
              { id: 'notifications_enabled', label: 'Notifications Enabled' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as UserFilterKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                <th className="py-3 px-4">Registered User</th>
                <th className="py-3 px-4">Target Role / Sector</th>
                <th className="py-3 px-4 text-right">Profile %</th>
                <th className="py-3 px-4">Alerts Status</th>
                <th className="py-3 px-4 text-right">Matches</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No registered users match your current filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{u.fullName}</div>
                      <div className="text-[11px] text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{u.desiredJobTitle || 'Not specified'}</div>
                      <div className="text-[11px] text-slate-500">
                        {u.preferredIndustry} · {u.locationCity}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                      <span className={u.isProfileComplete ? 'text-emerald-700' : 'text-amber-700'}>
                        {u.profileCompletionPercentage}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {u.notificationsEnabled ? 'Enabled' : 'Disabled'} ({u.permissionStatus})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Push: {u.subscriptionStatus} · Email: {u.emailAlertsEnabled ? 'On' : 'Off'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {u.recommendationsCount}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-bold ${
                          u.accountStatus === 'active'
                            ? 'text-emerald-700'
                            : u.accountStatus === 'suspended'
                            ? 'text-rose-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {u.accountStatus === 'active'
                          ? 'Active'
                          : u.accountStatus === 'suspended'
                          ? 'Suspended'
                          : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-slate-500">
                      {u.registeredAt ? new Date(u.registeredAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.accountStatus === 'suspended' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetUser(u);
                            setPendingStatus('active');
                            setStatusReason('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] inline-flex items-center gap-1 border border-emerald-200 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Reactivate</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetUser(u);
                            setPendingStatus('suspended');
                            setStatusReason('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-[11px] inline-flex items-center gap-1 border border-rose-200 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Suspend</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Suspend / Reactivate */}
      {targetUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                {pendingStatus === 'suspended' ? (
                  <UserX className="w-5 h-5 text-rose-600" />
                ) : (
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                )}
                <h3 className="text-base font-extrabold text-slate-900">
                  {pendingStatus === 'suspended'
                    ? 'Suspend User Account'
                    : 'Reactivate User Account'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTargetUser(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Account: <strong>{targetUser.fullName}</strong> ({targetUser.email}).{' '}
              {pendingStatus === 'suspended'
                ? 'Suspending pauses all automated recommendations and push/email alerts until reactivated.'
                : 'Reactivating restores personalized recommendations and scheduled alerts.'}
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Audit Log Reason (Optional)
              </label>
              <input
                type="text"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Reason recorded in administrative audit log..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={isUpdatingStatus}
                className={`px-5 py-2 rounded-xl text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 ${
                  pendingStatus === 'suspended'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isUpdatingStatus
                  ? 'Updating...'
                  : pendingStatus === 'suspended'
                  ? 'Confirm Suspend'
                  : 'Confirm Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
