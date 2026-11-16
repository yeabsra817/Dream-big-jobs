import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Database,
  Bot,
  BarChart3,
  RefreshCw,
  HardDrive,
  Users,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Bell,
  History,
  Download,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Lock,
} from 'lucide-react';
import {
  SiteSettings,
  SystemHealthSnapshot,
  SystemBackupSummary,
  AdminNotificationItem,
  AuditLogEntry,
} from '../../types/job';
import { JobSeekerProfile } from '../../types/jobSeeker';
import {
  fetchSystemHealthAdmin,
  runSystemRecoveryAdmin,
  fetchAllStaffProfilesAdmin,
  deleteStaffProfileOwnerOnly,
  fetchSystemBackupsAdmin,
  createSystemBackupAdmin,
  restoreSystemBackupAdmin,
  acknowledgeAdminNotification,
} from '../../lib/firebase';
import {
  checkGa4Health,
  initGoogleAnalytics4,
  DEFAULT_GA_MEASUREMENT_ID,
} from '../../lib/analyticsTracker';

interface Props {
  adminEmail: string | null;
  siteSettings: SiteSettings;
  onSaveSiteSettings: (settings: SiteSettings) => Promise<void>;
}

export const SystemPersistenceCenter: React.FC<Props> = ({
  adminEmail,
  siteSettings,
  onSaveSiteSettings,
}) => {
  const [health, setHealth] = useState<SystemHealthSnapshot | null>(null);
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [backups, setBackups] = useState<SystemBackupSummary[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<JobSeekerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackupId, setIsRestoringBackupId] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [expandedStaffUid, setExpandedStaffUid] = useState<string | null>(null);
  const [botInstructionsDraft, setBotInstructionsDraft] = useState(siteSettings.botInstructions || '');
  const [isSavingBotInstructions, setIsSavingBotInstructions] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Owner-only Permanent Staff Deletion Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<JobSeekerProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);

  // Restore Backup Confirmation Modal
  const [restoreTarget, setRestoreTarget] = useState<SystemBackupSummary | null>(null);

  const gaHealth = checkGa4Health(
    siteSettings.gaMeasurementId || DEFAULT_GA_MEASUREMENT_ID,
    siteSettings.gaTrackingEnabled !== false
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sysRes, bks, profiles] = await Promise.all([
        fetchSystemHealthAdmin(adminEmail || undefined),
        fetchSystemBackupsAdmin(adminEmail || undefined),
        fetchAllStaffProfilesAdmin(adminEmail || undefined),
      ]);
      if (sysRes) {
        setHealth(sysRes.health);
        setNotifications(sysRes.notifications || []);
        setAuditLogs(sysRes.auditLogs || []);
      }
      setBackups(bks);
      setStaffProfiles(profiles);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Unable to load persistence telemetry.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [adminEmail]);

  useEffect(() => {
    setBotInstructionsDraft(siteSettings.botInstructions || '');
  }, [siteSettings.botInstructions]);

  const handleRunRecovery = async () => {
    setIsRecovering(true);
    setFeedback(null);
    try {
      const res = await runSystemRecoveryAdmin(adminEmail || undefined);
      if (res) {
        setHealth(res.health);
        setNotifications(res.notifications || []);
        setAuditLogs(res.auditLogs || []);
      }
      setFeedback({
        type: 'success',
        text: '24/7 health probe, Telegram bot verification, and Always-On GA4 check completed.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Recovery check failed.',
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    setFeedback(null);
    try {
      const res = await createSystemBackupAdmin(adminEmail || undefined);
      if (res?.backups) setBackups(res.backups);
      else await loadAll();
      setFeedback({
        type: 'success',
        text: 'Manual full-system backup snapshot created cleanly.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Backup creation failed.',
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    const target = restoreTarget;
    setRestoreTarget(null);
    setIsRestoringBackupId(target.id);
    setFeedback(null);
    try {
      await restoreSystemBackupAdmin(target.id, adminEmail || undefined);
      await loadAll();
      setFeedback({
        type: 'success',
        text: `Snapshot ${target.filename} restored cleanly (pre-restore safety backup created).`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Backup restore failed.',
      });
    } finally {
      setIsRestoringBackupId(null);
    }
  };

  const handleConfirmDeleteStaff = async () => {
    if (!deleteTarget) return;
    setIsDeletingStaff(true);
    setFeedback(null);
    try {
      await deleteStaffProfileOwnerOnly(
        deleteTarget.uid,
        deleteConfirmText.trim(),
        adminEmail || undefined
      );
      setStaffProfiles((prev) => prev.filter((p) => p.uid !== deleteTarget.uid));
      setFeedback({
        type: 'success',
        text: `Staff profile "${deleteTarget.fullName}" permanently deleted by owner (safety backup created first).`,
      });
      setDeleteTarget(null);
      setDeleteConfirmText('');
      await loadAll();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Failed to delete staff profile.',
      });
    } finally {
      setIsDeletingStaff(false);
    }
  };

  const handleSaveBotInstructions = async () => {
    setIsSavingBotInstructions(true);
    setFeedback(null);
    try {
      await onSaveSiteSettings({
        ...siteSettings,
        botInstructions: botInstructionsDraft.trim(),
        gaMeasurementId: siteSettings.gaMeasurementId || DEFAULT_GA_MEASUREMENT_ID,
        gaTrackingEnabled: true,
        updatedAt: new Date().toISOString(),
      });
      setFeedback({
        type: 'success',
        text: 'Bot instructions saved permanently to database and backup configuration.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Failed to save bot instructions.',
      });
    } finally {
      setIsSavingBotInstructions(false);
    }
  };

  const handleEnforceGa4 = async () => {
    const id = (siteSettings.gaMeasurementId || DEFAULT_GA_MEASUREMENT_ID).trim().toUpperCase();
    initGoogleAnalytics4(id, false);
    await onSaveSiteSettings({
      ...siteSettings,
      gaMeasurementId: id,
      gaTrackingEnabled: true,
      updatedAt: new Date().toISOString(),
    });
    setFeedback({
      type: 'success',
      text: `Always-On Google Analytics 4 verified and enabled (${id}).`,
    });
  };

  const filteredStaff = staffProfiles.filter((p) => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return true;
    const text = [
      p.fullName,
      p.email,
      p.currentPosition,
      p.desiredJobTitle,
      p.staffDepartmentOrSector,
      ...(p.skills || []),
      ...(p.areasOfExpertise || []),
    ]
      .join(' ')
      .toLowerCase();
    return text.includes(q);
  });

  const unacknowledgedAlerts = notifications.filter((n) => !n.acknowledged);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Owner-Only Persistence &amp; Recovery</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#0B132B]">
              24/7 Data Persistence, Backups &amp; Staff Directory
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Permanent storage health, Telegram bot auto-reconnection, Always-On GA4 telemetry, versioned snapshots, and owner-controlled staff profiles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadAll}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleRunRecovery}
              disabled={isRecovering}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white text-xs font-extrabold shadow-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRecovering ? 'animate-spin' : ''}`} />
              <span>{isRecovering ? 'Checking 24/7 Health...' : 'Run Live Recovery & Bot Check'}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : feedback.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-blue-50 border-blue-300 text-blue-900'
            }`}
          >
            <span>{feedback.text}</span>
            <button type="button" onClick={() => setFeedback(null)} className="p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 4 Status Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* DB Persistence */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-600" />
                Permanent Database
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  health?.storage.persistentDbWritable
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {health?.storage.persistentDbWritable ? 'WRITABLE' : 'CHECKING'}
              </span>
            </div>
            <div className="text-lg font-black text-slate-900 font-mono">
              {health?.storage.backupCount ?? backups.length} Snapshots
            </div>
            <div className="text-[11px] text-slate-500">
              {health?.storage.latestBackupAt
                ? `Last backup: ${new Date(health.storage.latestBackupAt).toLocaleString()}`
                : 'Automated startup & 12h backups active'}
            </div>
          </div>

          {/* Telegram Bot 24/7 Status */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-sky-600" />
                Telegram Bot 24/7
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  health?.telegramBot.status === 'CONNECTED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : health?.telegramBot.status === 'DISCONNECTED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {health?.telegramBot.status || 'SAVED'}
              </span>
            </div>
            <div className="text-sm font-black text-slate-900 truncate">
              @{health?.telegramBot.botUsername || siteSettings.telegramBotUsername?.replace('@', '') || 'DreamBigJobsEthiopiaBot'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {health?.telegramBot.lastError
                ? health.telegramBot.lastError
                : `Target: ${health?.telegramBot.channelName || siteSettings.telegramChannelName || '@DreamBigJobsEthiopia'}`}
            </div>
          </div>

          {/* Always-On GA4 Status */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-amber-600" />
                GA4 Always-On
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  gaHealth.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {gaHealth.status}
              </span>
            </div>
            <div className="text-sm font-black text-slate-900 font-mono">
              {gaHealth.measurementId || DEFAULT_GA_MEASUREMENT_ID}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{health?.analytics.totalEventsRecorded ?? 0} tracked hits</span>
              {gaHealth.status !== 'ACTIVE' && (
                <button
                  type="button"
                  onClick={handleEnforceGa4}
                  className="font-bold text-amber-700 underline"
                >
                  Re-enable
                </button>
              )}
            </div>
          </div>

          {/* Staff Directory Count */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                Registered Profiles
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                PERMANENT
              </span>
            </div>
            <div className="text-lg font-black text-slate-900 font-mono">
              {staffProfiles.length}
            </div>
            <div className="text-[11px] text-slate-500">
              {health?.counts.auditLogs ?? auditLogs.length} audit log events recorded
            </div>
          </div>
        </div>
      </div>

      {/* Permanent Bot Instructions & Reconnection Summary */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Bot className="w-4 h-4 text-sky-600" />
              <span>Saved Bot Configuration &amp; Operational Instructions</span>
            </h3>
            <p className="text-xs text-slate-500">
              Persisted credentials, channel target, test history, and operational instructions restored automatically on every startup.
            </p>
          </div>
          {health?.telegramBot.lastSuccessfulTestAt && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Last Successful Test: {new Date(health.telegramBot.lastSuccessfulTestAt).toLocaleString()}
            </span>
          )}
        </div>

        <textarea
          rows={3}
          value={botInstructionsDraft}
          onChange={(e) => setBotInstructionsDraft(e.target.value)}
          placeholder="Store standing Telegram bot rules, posting instructions, and operational notes permanently..."
          className="w-full p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:border-amber-500 outline-none"
        />

        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            Reconnect attempts recorded: <strong>{health?.telegramBot.reconnectAttempts ?? 0}</strong> • Auto-publish:{' '}
            <strong>{siteSettings.telegramAutoPublish ? 'ENABLED' : 'PAUSED'}</strong>
          </div>
          <button
            type="button"
            onClick={handleSaveBotInstructions}
            disabled={isSavingBotInstructions}
            className="px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white text-xs font-extrabold transition-colors"
          >
            {isSavingBotInstructions ? 'Saving...' : 'Save Instructions Permanently'}
          </button>
        </div>
      </div>

      {/* Backups & Recovery Snapshots */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-500" />
              <span>Automated &amp; Manual System Backups</span>
            </h3>
            <p className="text-xs text-slate-500">
              Snapshots include vacancies, settings, bot configurations, staff profiles, applications, and international data.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateBackup}
            disabled={isCreatingBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isCreatingBackup ? 'Creating Snapshot...' : 'Create Backup Snapshot Now'}</span>
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
            No snapshots created yet. Click "Create Backup Snapshot Now" to save a recovery point.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {backups.map((b) => (
              <div
                key={b.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900">{b.filename}</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                      {b.trigger}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {new Date(b.createdAt).toLocaleString()} • {Math.round(b.sizeBytes / 1024)} KB •{' '}
                    {b.counts.vacancies} jobs, {b.counts.staffProfiles} staff, {b.counts.applications} apps
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRestoreTarget(b)}
                  disabled={isRestoringBackupId === b.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-slate-800 border border-slate-300 text-xs font-bold shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isRestoringBackupId === b.id ? 'Restoring...' : 'Restore Snapshot'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Staff Profiles Directory & Owner-Only Permanent Delete */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Permanent Staff &amp; Candidate Profiles ({staffProfiles.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              All registered staff records remain saved permanently. Permanent deletion is restricted to authorized owners with explicit confirmation.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              placeholder="Search name, role, skill..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
            No matching staff profiles found.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStaff.map((sp) => {
              const isExpanded = expandedStaffUid === sp.uid;
              return (
                <div
                  key={sp.uid}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-sm text-slate-900">{sp.fullName || 'Unnamed Staff'}</h4>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          {sp.accountRole || 'staff'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {sp.profileCompletionPercentage ?? 0}% complete
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {sp.email} • {sp.currentPosition || sp.desiredJobTitle || 'Position not yet specified'}
                        {sp.yearsOfExperience ? ` • ${sp.yearsOfExperience}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpandedStaffUid(isExpanded ? null : sp.uid)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700"
                      >
                        <span>{isExpanded ? 'Hide Details' : 'Inspect Profile'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(sp);
                          setDeleteConfirmText('');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <strong className="text-slate-800">Department / Sector:</strong>{' '}
                        <span className="text-slate-600">{sp.staffDepartmentOrSector || sp.preferredIndustry || 'Not set'}</span>
                      </div>
                      <div>
                        <strong className="text-slate-800">Location:</strong>{' '}
                        <span className="text-slate-600">{sp.locationCity || 'Not set'}</span>
                      </div>
                      <div>
                        <strong className="text-slate-800">Previous Positions:</strong>{' '}
                        <span className="text-slate-600">
                          {(sp.previousPositions || []).length > 0 ? sp.previousPositions!.join(', ') : 'None listed'}
                        </span>
                      </div>
                      <div>
                        <strong className="text-slate-800">Areas of Expertise &amp; Skills:</strong>{' '}
                        <span className="text-slate-600">
                          {[...(sp.areasOfExpertise || []), ...(sp.skills || [])].join(', ') || 'None listed'}
                        </span>
                      </div>
                      <div>
                        <strong className="text-slate-800">Certifications:</strong>{' '}
                        <span className="text-slate-600">
                          {(sp.certifications || []).length > 0
                            ? sp.certifications!.map((c) => `${c.name} (${c.issuingOrganization})`).join(', ')
                            : 'None listed'}
                        </span>
                      </div>
                      <div>
                        <strong className="text-slate-800">Professional Interests:</strong>{' '}
                        <span className="text-slate-600">
                          {(sp.professionalInterests || []).join(', ') || 'None listed'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin System Notifications & Audit History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <span>Admin System Alerts ({unacknowledgedAlerts.length} unread)</span>
            </h3>
            {unacknowledgedAlerts.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  const next = await acknowledgeAdminNotification(undefined, true, adminEmail || undefined);
                  setNotifications(next);
                }}
                className="text-[11px] font-bold text-indigo-700 hover:underline"
              >
                Acknowledge All
              </button>
            )}
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">No system alerts recorded.</div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border text-xs ${
                    n.acknowledged
                      ? 'bg-slate-50 border-slate-200 opacity-70'
                      : n.severity === 'critical'
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{n.title}</span>
                    {!n.acknowledged && (
                      <button
                        type="button"
                        onClick={async () => {
                          const next = await acknowledgeAdminNotification(n.id, false, adminEmail || undefined);
                          setNotifications(next);
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">{n.message}</p>
                  <div className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-600" />
            <span>Immutable Audit Trail ({auditLogs.length})</span>
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {auditLogs.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">No audit entries yet.</div>
            ) : (
              auditLogs.slice(0, 30).map((log) => (
                <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-900 text-[11px]">{log.action}</span>
                    <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">{log.summary}</p>
                  <div className="text-[10px] text-slate-400">Actor: {log.actorEmail}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Owner-Only Permanent Staff Deletion Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-700">
              <Lock className="w-5 h-5" />
              <h3 className="text-lg font-black">Owner-Only Permanent Deletion</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to permanently delete the staff profile for <strong>{deleteTarget.fullName}</strong> ({deleteTarget.email}). A safety backup snapshot will be created before removal.
            </p>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Type <code className="bg-rose-50 px-1.5 py-0.5 rounded text-rose-700 font-black">DELETE</code> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingStaff || deleteConfirmText.trim() !== 'DELETE'}
                onClick={handleConfirmDeleteStaff}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-extrabold"
              >
                {isDeletingStaff ? 'Deleting...' : 'Permanently Delete Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Backup Confirmation Modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-black text-slate-900">Restore System Snapshot?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Restore <strong>{restoreTarget.filename}</strong> ({restoreTarget.counts.vacancies} jobs, {restoreTarget.counts.staffProfiles} staff profiles)? The server automatically saves a pre-restore safety backup before applying this snapshot.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white text-xs font-extrabold"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
