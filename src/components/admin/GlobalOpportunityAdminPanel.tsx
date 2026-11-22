import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Globe,
  ExternalLink,
  Activity,
} from 'lucide-react';
import {
  AutonomousSchedulerInfo,
  DiscoveryJobLogRecord,
  OpportunitySourceRecord,
  OpportunityVerificationLogRecord,
} from '../../types/globalOpportunities';
import {
  acknowledgeAdminDiscoveryAlert,
  fetchAdminGlobalOpportunityLogs,
  triggerAdminDeadlineRecheck,
  triggerAdminGlobalDiscovery,
} from '../../lib/globalOpportunitiesService';

interface Props {
  adminEmail?: string | null;
}

export const GlobalOpportunityAdminPanel: React.FC<Props> = ({ adminEmail }) => {
  const [loading, setLoading] = useState(true);
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [runningRecheck, setRunningRecheck] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<OpportunitySourceRecord[]>([]);
  const [schedulerInfo, setSchedulerInfo] = useState<AutonomousSchedulerInfo | null>(null);
  const [jobLogs, setJobLogs] = useState<DiscoveryJobLogRecord[]>([]);
  const [verLogs, setVerLogs] = useState<OpportunityVerificationLogRecord[]>([]);
  const [totals, setTotals] = useState({
    stored: 0,
    activeVerified: 0,
    savedCount: 0,
    recommendationsCount: 0,
  });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminGlobalOpportunityLogs(adminEmail);
      setSources(data.sources || []);
      setSchedulerInfo(data.schedulerInfo || null);
      setJobLogs(data.discoveryJobLogs || []);
      setVerLogs(data.verificationLogs || []);
      setTotals(data.totals || { stored: 0, activeVerified: 0, savedCount: 0, recommendationsCount: 0 });
    } catch (err: any) {
      setError(err?.message || 'Unable to load Global Opportunity Intelligence logs.');
    } finally {
      setLoading(false);
    }
  }, [adminEmail]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleRunDiscovery = async () => {
    setRunningDiscovery(true);
    setMessage(null);
    setError(null);
    try {
      const res = await triggerAdminGlobalDiscovery(adminEmail);
      setMessage(
        `Discovery complete: ${res.runLog.verifiedAndActiveCount} verified active (>=3d), ${res.runLog.rejectedUnderThreeDaysCount} excluded (<3d), ${res.runLog.rejectedBrokenOrClosedCount} unverified/closed, ${res.runLog.duplicatesSkipped} duplicates skipped.`
      );
      await loadLogs();
    } catch (err: any) {
      setError(err?.message || 'Discovery run failed.');
    } finally {
      setRunningDiscovery(false);
    }
  };

  const handleRecheckDeadlines = async () => {
    setRunningRecheck(true);
    setMessage(null);
    setError(null);
    try {
      const res = await triggerAdminDeadlineRecheck(true, adminEmail);
      setMessage(
        `Deadline & broken-link recheck finished: ${res.runLog.verifiedAndActiveCount} verified active, ${res.runLog.expiredPurgedCount} expired purged, ${res.runLog.rejectedBrokenOrClosedCount} broken/closed deactivated.`
      );
      await loadLogs();
    } catch (err: any) {
      setError(err?.message || 'Recheck failed.');
    } finally {
      setRunningRecheck(false);
    }
  };

  const handleAcknowledgeAlert = async () => {
    try {
      const res = await acknowledgeAdminDiscoveryAlert(adminEmail);
      if (res.schedulerInfo) setSchedulerInfo(res.schedulerInfo);
    } catch (err: any) {
      setError(err?.message || 'Unable to acknowledge alert.');
    }
  };

  const latestFullRun = jobLogs.find((r) => r.jobType === 'full_discovery') || null;
  const activeAlert = schedulerInfo?.adminFailureAlert?.active ? schedulerInfo.adminFailureAlert : null;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#16A34A]">
            <Globe className="w-4 h-4" />
            <span>Global Verified Opportunity Intelligence System</span>
          </div>
          <h3 className="text-lg font-extrabold text-[#0B132B] mt-0.5">
            24/7 Automated Discovery, Verification &amp; 3-Day Deadline Engine
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            Runs automatically every 6 hours at{' '}
            <strong>00:00, 06:00, 12:00 &amp; 18:00 Africa/Addis_Ababa (EAT)</strong>, 365 days/year, independently of
            website visitors. Website-only display (no email/SMS/push for scholarships, training, or conferences).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={runningRecheck}
            onClick={handleRecheckDeadlines}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#0B132B] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {runningRecheck ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
            <span>Recheck Deadlines &amp; Links</span>
          </button>
          <button
            type="button"
            disabled={runningDiscovery}
            onClick={handleRunDiscovery}
            className="px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {runningDiscovery ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{runningDiscovery ? 'Running Official Discovery...' : 'Run Live Discovery'}</span>
          </button>
        </div>
      </div>

      {/* Administrator Scheduled Failure Alert */}
      {activeAlert && (
        <div
          role="alert"
          className={`p-4 rounded-xl border text-xs space-y-2 ${
            activeAlert.severity === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  Scheduled Discovery {activeAlert.severity === 'error' ? 'Failure Alert' : 'Source Warning'}
                </div>
                <p className="mt-0.5">{activeAlert.message}</p>
                <div className="text-[11px] opacity-80 mt-1 tabular-nums">
                  Failed at: {activeAlert.failedAtEat}
                  {activeAlert.consecutiveFailures > 0
                    ? ` · Consecutive failures: ${activeAlert.consecutiveFailures}`
                    : ''}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAcknowledgeAlert}
              className="px-2.5 py-1 rounded-md border border-current/30 text-[11px] font-bold hover:bg-black/5 shrink-0 cursor-pointer"
            >
              Acknowledge
            </button>
          </div>
          {activeAlert.errors && activeAlert.errors.length > 0 && (
            <ul className="list-disc pl-6 text-[11px] space-y-0.5 opacity-90">
              {activeAlert.errors.slice(0, 4).map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 24/7 Ethiopia Time Scheduled Execution Overview */}
      {schedulerInfo && (
        <div className="p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/40 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-[#0B132B] flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#16A34A]" />
              <span>
                24/7 Automated Schedule: {schedulerInfo.scheduleHoursEat.join(' · ')} ({schedulerInfo.timezone})
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-600 tabular-nums">
              UTC Cron: {schedulerInfo.cronExpressionUtc} · Server-side (zero visitor dependency)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
            <div className="bg-white rounded-lg border border-slate-200/80 p-2.5">
              <div className="text-[11px] text-slate-500 font-medium">Next Scheduled Execution</div>
              <div className="font-bold text-[#0B132B] mt-0.5">
                {schedulerInfo.nextScheduledRunAtEat || 'Calculating...'}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200/80 p-2.5">
              <div className="text-[11px] text-slate-500 font-medium">Last Successful Execution</div>
              <div className="font-bold text-[#15803D] mt-0.5">
                {schedulerInfo.lastSuccessfulRunAtEat || 'Pending first scheduled run'}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200/80 p-2.5">
              <div className="text-[11px] text-slate-500 font-medium">Connected Sources &amp; Latest Run</div>
              <div className="font-bold text-[#0B132B] mt-0.5">
                {schedulerInfo.connectedSourcesCount}/{schedulerInfo.totalSourcesCount} sources connected
                {latestFullRun
                  ? ` · ${latestFullRun.candidatesDiscovered} found / ${latestFullRun.verifiedAndActiveCount} verified`
                  : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900">
          {message}
        </div>
      )}
      {error && (
        <div className="px-3.5 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
          {error}
        </div>
      )}

      {/* Key Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
          <div className="text-slate-500 font-medium">Verified Active (&ge;3d)</div>
          <div className="text-xl font-extrabold text-[#15803D] tabular-nums mt-0.5">{totals.activeVerified}</div>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
          <div className="text-slate-500 font-medium">Total Stored Records</div>
          <div className="text-xl font-extrabold text-[#0B132B] tabular-nums mt-0.5">{totals.stored}</div>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
          <div className="text-slate-500 font-medium">Website Recommendations</div>
          <div className="text-xl font-extrabold text-[#0B132B] tabular-nums mt-0.5">{totals.recommendationsCount}</div>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
          <div className="text-slate-500 font-medium">Saved by Users</div>
          <div className="text-xl font-extrabold text-[#0B132B] tabular-nums mt-0.5">{totals.savedCount}</div>
        </div>
      </div>

      {/* Connected Sources Table */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
          <span>Official Source Connectors</span>
        </h4>
        {loading ? (
          <div className="text-xs text-slate-500 py-3">Loading connector health...</div>
        ) : (
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
            {sources.map((s) => (
              <div key={s.id} className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-[#0B132B]">{s.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{s.baseUrl}</div>
                  {s.monitoredPortals && s.monitoredPortals.length > 0 && (
                    <div className="text-[11px] text-[#15803D] font-medium mt-0.5 tabular-nums">
                      {s.monitoredPortals.filter((p) => p.httpStatus !== null && p.httpStatus >= 200 && p.httpStatus < 400).length}/{s.monitoredPortals.length} official
                      portals live (HTTP 200)
                    </div>
                  )}
                  {s.pricingNote && <div className="text-[11px] text-slate-600 mt-0.5">{s.pricingNote}</div>}
                  {s.lastError && s.status !== 'optional_unconfigured' && s.status !== 'disabled' && (
                    <div className="text-[11px] text-amber-700 mt-0.5">{s.lastError}</div>
                  )}
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <span
                    className={`font-bold inline-flex items-center gap-1 ${
                      s.status === 'connected'
                        ? 'text-[#15803D]'
                        : s.status === 'optional_unconfigured' || s.status === 'disabled'
                        ? 'text-slate-500'
                        : s.status === 'requires_credentials' || s.status === 'degraded'
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {s.status === 'connected' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : s.status === 'optional_unconfigured' || s.status === 'disabled' ? (
                      <Globe className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {s.status === 'connected'
                        ? `Connected (${s.lastItemCount} items)`
                        : s.status === 'optional_unconfigured'
                        ? `Optional (${s.requiredEnvVars.join(', ')})`
                        : s.status === 'disabled'
                        ? 'Disabled by Config'
                        : s.status === 'requires_credentials'
                        ? `Needs ${s.requiredEnvVars.join(', ')}`
                        : s.status}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Discovery Runs & Verification Logs */}
      {jobLogs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span>Recent Scheduled &amp; Manual Discovery Runs</span>
          </h4>
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
            {jobLogs.slice(0, 5).map((run) => (
              <div key={run.id} className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 tabular-nums">
                <div>
                  <span className="font-bold text-[#0B132B]">{run.jobType}</span> ·{' '}
                  <span className="text-slate-600">{run.trigger}</span> ·{' '}
                  <span className="text-slate-500">{new Date(run.finishedAt).toLocaleString()}</span>
                </div>
                <div className="text-slate-700 font-medium">
                  Active: <strong>{run.verifiedAndActiveCount}</strong> · &lt;3d Excluded:{' '}
                  <strong>{run.rejectedUnderThreeDaysCount}</strong> · Broken/Closed:{' '}
                  <strong>{run.rejectedBrokenOrClosedCount}</strong> · {run.durationMs}ms
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {verLogs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Latest Official URL Verification Checks
          </h4>
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs max-h-56 overflow-y-auto">
            {verLogs.slice(0, 12).map((vl) => (
              <div key={vl.id} className="px-3.5 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[#0B132B] truncate">{vl.opportunityTitle}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {vl.organization} · HTTP {vl.httpStatus ?? 'API'} · {vl.fullDaysRemaining ?? 0}d left
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-bold ${
                      vl.passedUrlVerification && vl.passedDeadlineRule ? 'text-[#15803D]' : 'text-rose-700'
                    }`}
                  >
                    {vl.resultingStatus}
                  </span>
                  <a
                    href={vl.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-[#16A34A]"
                    title="Open official URL"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
