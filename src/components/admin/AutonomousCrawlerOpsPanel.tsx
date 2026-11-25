import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { AdminAutonomousTelemetryResponse } from '../../types/autonomousDiscovery';
import {
  fetchAdminAutonomousTelemetry,
  triggerAdminAutonomousCycle,
} from '../../lib/autonomousDiscoveryService';

interface Props {
  adminEmail?: string | null;
}

function formatTs(iso: string | null | undefined, eat?: string | null): string {
  if (eat) return eat;
  if (!iso) return 'None yet';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export const AutonomousCrawlerOpsPanel: React.FC<Props> = ({ adminEmail }) => {
  const [telemetry, setTelemetry] = useState<AdminAutonomousTelemetryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'overview' | 'domains' | 'queue' | 'opportunities' | 'incidents'>('overview');

  const loadTelemetry = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await fetchAdminAutonomousTelemetry(adminEmail);
        setTelemetry(data);
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Unable to load autonomous crawler telemetry.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [adminEmail]
  );

  useEffect(() => {
    loadTelemetry(false);
    const timer = window.setInterval(() => loadTelemetry(true), 15000);
    return () => window.clearInterval(timer);
  }, [loadTelemetry]);

  const handleManualCycle = async () => {
    setTriggering(true);
    setActionNotice(null);
    setError(null);
    try {
      const res = await triggerAdminAutonomousCycle(adminEmail);
      const cyc = res.cycle;
      setActionNotice(
        cyc
          ? `Cycle ${cyc.cycleId} finished (${cyc.status}) in ${(cyc.durationMs / 1000).toFixed(1)}s — scanned ${cyc.candidatesScanned}, crawler pages: ${cyc.crawlerPagesProcessed || 0}, new domains: ${cyc.crawlerNewDomainsFound || 0}.`
          : 'Discovery cycle completed.'
      );
      await loadTelemetry(true);
    } catch (err: any) {
      setError(err?.message || 'Manual discovery cycle failed.');
    } finally {
      setTriggering(false);
    }
  };

  if (loading && !telemetry) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 flex items-center justify-center gap-3 text-slate-600 text-sm font-semibold">
        <Loader2 className="w-5 h-5 animate-spin text-[#16A34A]" />
        <span>Loading real-time autonomous crawler &amp; worker telemetry...</span>
      </div>
    );
  }

  if (error && !telemetry) {
    return (
      <div className="bg-rose-50 rounded-2xl border border-rose-200 p-6 text-rose-900 space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>Unable to load Autonomous Crawler Monitoring</span>
        </div>
        <p className="text-xs">{error}</p>
        <button
          type="button"
          onClick={() => loadTelemetry(false)}
          className="px-4 py-2 rounded-lg bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!telemetry) return null;

  const { workerStatus, schedule, crawler, combinedCounts, pipelineBreakdown, incidents } = telemetry;
  const openIncidents = incidents.filter((i) => i.status !== 'resolved');

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Activity className="w-4 h-4" />
            <span>Autonomous Internet Discovery &amp; Reliability Monitor</span>
          </div>
          <h2 className="text-xl font-bold">
            24/7 Independent Public-Web Crawler, Queue &amp; Incident Ops
          </h2>
          <p className="text-xs text-slate-300">
            Runs server-side every {workerStatus.intervalSeconds}s without Google/Bing Search APIs (robots.txt compliant, sitemaps, RSS/Atom, HTML links, JSON-LD, public archive). Auto-refreshes every 15s.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => loadTelemetry(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Now</span>
          </button>
          <button
            type="button"
            onClick={handleManualCycle}
            disabled={triggering}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
          >
            {triggering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>{triggering ? 'Running Cycle...' : 'Run Immediate Cycle'}</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Core Operational Status Strip (Engine, Worker, Executions) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Discovery Engine Status</div>
          <div
            className={`text-lg font-extrabold mt-1 uppercase ${
              telemetry.engineStatus === 'healthy'
                ? 'text-emerald-700'
                : telemetry.engineStatus === 'degraded'
                ? 'text-amber-700'
                : telemetry.engineStatus === 'failing'
                ? 'text-rose-700'
                : 'text-slate-700'
            }`}
          >
            {telemetry.engineStatus}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Preflight: {workerStatus.lastPreflightOk ? 'OK' : 'Failed'} · Failures: {workerStatus.consecutiveFailures}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Background Worker Status</div>
          <div className="text-lg font-extrabold text-slate-900 mt-1">
            {workerStatus.running ? 'RUNNING 24/7' : 'WEBHOOK MODE'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            PID {workerStatus.pid} · Up {formatUptime(workerStatus.uptimeSeconds)} · Cycles: {workerStatus.totalCyclesCompleted}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Last Successful Execution</div>
          <div className="text-xs font-bold text-slate-900 mt-1.5 leading-snug">
            {formatTs(schedule.lastSuccessfulExecution, schedule.lastSuccessfulExecutionEat)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Overlaps skipped: {workerStatus.totalSkippedOverlaps}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Last Failed Execution</div>
          <div className="text-xs font-bold text-slate-900 mt-1.5 leading-snug">
            {schedule.lastFailedExecution
              ? formatTs(schedule.lastFailedExecution, schedule.lastFailedExecutionEat)
              : 'None recorded'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Open incidents: {openIncidents.length}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Next Scheduled Execution</div>
          <div className="text-xs font-bold text-emerald-800 mt-1.5 leading-snug">
            {formatTs(schedule.nextScheduledExecution, schedule.nextScheduledExecutionEat)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Interval: every {workerStatus.intervalSeconds}s</div>
        </div>
      </div>

      {/* Exact Required Real-Time Crawler & Pipeline Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Domains Discovered</div>
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">
            {crawler.domainsDiscovered.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Domains Monitored</div>
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">
            {crawler.domainsMonitored.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Pages Crawled</div>
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">
            {crawler.pagesCrawled.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">New Pages Discovered</div>
          <div className="text-2xl font-extrabold text-sky-700 tabular-nums mt-0.5">
            {crawler.newPagesDiscovered.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Current Processing Queue</div>
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">
            {crawler.queueDepth.total.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            {crawler.queueDepth.queued} queued · {crawler.queueDepth.retryScheduled} retry · {crawler.queueDepth.processing} active
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Opportunities Extracted</div>
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">
            {combinedCounts.opportunitiesDiscovered.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">Crawler DB: {crawler.opportunitiesExtracted}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Opportunities Verified</div>
          <div className="text-2xl font-extrabold text-emerald-700 tabular-nums mt-0.5">
            {combinedCounts.opportunitiesVerified.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">$3k+ matches: {combinedCounts.visa3kVerifiedCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Opportunities Rejected</div>
          <div className="text-2xl font-extrabold text-slate-700 tabular-nums mt-0.5">
            {combinedCounts.opportunitiesRejected.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Duplicate Records Prevented</div>
          <div className="text-2xl font-extrabold text-indigo-700 tabular-nums mt-0.5">
            {crawler.duplicateRecordsPrevented.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500">Errors &amp; Recovery Attempts</div>
          <div className="text-2xl font-extrabold text-amber-700 tabular-nums mt-0.5">
            {incidents.length}
          </div>
          <div className="text-[11px] text-slate-500">
            {openIncidents.length} open · {incidents.length - openIncidents.length} recovered
          </div>
        </div>
      </div>

      {/* 6-State Verification Lifecycle Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
          <span>Web Crawler Verification Lifecycle (Unverified Opportunities Are Never Published As Verified)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
          {(
            [
              ['DISCOVERED', pipelineBreakdown.DISCOVERED, 'bg-slate-50 text-slate-800 border-slate-200'],
              ['PENDING VERIFICATION', pipelineBreakdown.PENDING_VERIFICATION, 'bg-amber-50 text-amber-900 border-amber-200'],
              ['VERIFIED', pipelineBreakdown.VERIFIED, 'bg-sky-50 text-sky-900 border-sky-200'],
              ['PUBLISHED', pipelineBreakdown.PUBLISHED, 'bg-emerald-50 text-emerald-900 border-emerald-200'],
              ['REJECTED', pipelineBreakdown.REJECTED, 'bg-rose-50 text-rose-900 border-rose-200'],
              ['EXPIRED', pipelineBreakdown.EXPIRED, 'bg-slate-100 text-slate-700 border-slate-300'],
            ] as const
          ).map(([label, val, cls]) => (
            <div key={label} className={`rounded-xl border p-2.5 ${cls}`}>
              <div className="text-[10px] font-bold tracking-wide">{label}</div>
              <div className="text-lg font-extrabold tabular-nums mt-0.5">{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(
          [
            ['overview', 'Recent Cycles & Sources'],
            ['domains', `Discovered Domains (${telemetry.recentDomains.length})`],
            ['queue', `Processing Queue (${telemetry.activeQueueSample.length})`],
            ['opportunities', `Crawled Opportunities (${telemetry.recentWebOpportunities.length})`],
            ['incidents', `Incidents & Recovery (${incidents.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              subTab === id
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: Recent Cycles */}
      {subTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#16A34A]" />
              <span>Recent 1-Minute Autonomous Execution Cycles</span>
            </h3>
            <span className="text-xs text-slate-500">{schedule.githubBackupSchedule}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Finished</th>
                  <th className="px-4 py-2.5">Trigger</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Duration</th>
                  <th className="px-4 py-2.5">Scanned</th>
                  <th className="px-4 py-2.5">Web Pages / +Domains</th>
                  <th className="px-4 py-2.5">Sources / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {telemetry.recentCycles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      Waiting for first automated 1-minute cycle to finish...
                    </td>
                  </tr>
                ) : (
                  telemetry.recentCycles.map((c) => (
                    <tr key={c.cycleId} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 whitespace-nowrap font-medium text-slate-800">
                        {formatTs(c.finishedAt)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{c.trigger}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-bold uppercase">
                        <span
                          className={
                            c.status === 'success'
                              ? 'text-emerald-700'
                              : c.status === 'partial'
                              ? 'text-amber-700'
                              : c.status === 'skipped_overlap'
                              ? 'text-sky-700'
                              : 'text-rose-700'
                          }
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                        {(c.durationMs / 1000).toFixed(1)}s
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                        {c.candidatesScanned}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                        {c.crawlerPagesProcessed ?? 0} / +{c.crawlerNewDomainsFound ?? 0}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 max-w-md truncate">
                        {c.error ? c.error : c.sourcesPolled.join(', ') || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Discovered Domains */}
      {subTab === 'domains' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#16A34A]" />
              <span>Self-Expanding Public Website Registry (robots.txt Enforced)</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Domain</th>
                  <th className="px-4 py-2.5">Discovered From</th>
                  <th className="px-4 py-2.5">robots.txt</th>
                  <th className="px-4 py-2.5">Pages Crawled</th>
                  <th className="px-4 py-2.5">Opportunities</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {telemetry.recentDomains.map((d) => (
                  <tr key={d.domain} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-bold text-slate-900">{d.domain}</td>
                    <td className="px-4 py-2.5 text-slate-600">{d.discoveredFrom}</td>
                    <td className="px-4 py-2.5">
                      {d.robotsAllowed ? `Allowed (${d.crawlDelaySec}s delay)` : 'Disallowed'}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{d.pagesCrawledCount}</td>
                    <td className="px-4 py-2.5 tabular-nums font-bold text-emerald-700">
                      {d.opportunitiesFoundCount}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`font-bold uppercase ${
                          d.lastStatus === 'ok'
                            ? 'text-emerald-700'
                            : d.lastStatus === 'idle'
                            ? 'text-slate-500'
                            : 'text-amber-700'
                        }`}
                      >
                        {d.lastStatus}
                      </span>
                      {d.lastError && <span className="block text-[11px] text-rose-600">{d.lastError}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Processing Queue */}
      {subTab === 'queue' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#16A34A]" />
              <span>Persistent Priority Discovery Queue (Crash-Safe)</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Priority</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">URL</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Attempts</th>
                  <th className="px-4 py-2.5">Discovered From</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {telemetry.activeQueueSample.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-bold tabular-nums">{t.priority}</td>
                    <td className="px-4 py-2.5 text-slate-600">{t.taskType}</td>
                    <td className="px-4 py-2.5 text-slate-800 max-w-md truncate">{t.url}</td>
                    <td className="px-4 py-2.5 font-bold uppercase text-slate-700">{t.status}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {t.attempts}/{t.maxAttempts}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{t.discoveredFrom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Extracted Web Opportunities */}
      {subTab === 'opportunities' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-[#16A34A]" />
              <span>Autonomously Extracted Public-Web Opportunities</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Title &amp; Employer</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Country</th>
                  <th className="px-4 py-2.5">Salary / Visa</th>
                  <th className="px-4 py-2.5">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {telemetry.recentWebOpportunities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No public-web crawler items extracted yet — crawler runs every minute automatically.
                    </td>
                  </tr>
                ) : (
                  telemetry.recentWebOpportunities.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-bold uppercase whitespace-nowrap">
                        <span
                          className={
                            o.status === 'PUBLISHED' || o.status === 'VERIFIED'
                              ? 'text-emerald-700'
                              : o.status === 'REJECTED' || o.status === 'EXPIRED'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-slate-900">{o.title}</div>
                        <div className="text-[11px] text-slate-500">{o.employer}</div>
                        {o.rejectionReason && (
                          <div className="text-[11px] text-rose-600">{o.rejectionReason}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{o.category}</td>
                      <td className="px-4 py-2.5 text-slate-700">{o.country}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        <div>{o.salaryRaw || 'Undisclosed'}</div>
                        <div className="text-[11px]">
                          {o.visaSponsorshipConfirmed ? 'Visa sponsorship noted' : 'Visa not confirmed'}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <a
                          href={o.officialApplicationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sky-700 hover:underline font-semibold"
                        >
                          <span>{o.sourceDomain}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Grouped Incidents & Self-Healing Recovery */}
      {subTab === 'incidents' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Grouped Operational Incidents &amp; Recovery History (No Spam Alerts)</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Component</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Occurrences</th>
                  <th className="px-4 py-2.5">Error &amp; Recovery Result</th>
                  <th className="px-4 py-2.5">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-emerald-700 font-semibold">
                      Zero incidents recorded — all autonomous crawler and worker components operating cleanly.
                    </td>
                  </tr>
                ) : (
                  incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-bold uppercase whitespace-nowrap">
                        <span
                          className={
                            inc.status === 'resolved'
                              ? 'text-emerald-700'
                              : inc.status === 'escalated'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }
                        >
                          {inc.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{inc.component}</td>
                      <td className="px-4 py-2.5 text-slate-600 uppercase">{inc.errorType}</td>
                      <td className="px-4 py-2.5 tabular-nums font-bold">{inc.occurrences}</td>
                      <td className="px-4 py-2.5">
                        <div className="text-slate-800">{inc.message}</div>
                        {inc.lastRecoveryResult && (
                          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                            Recovery: {inc.lastRecoveryResult}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                        {formatTs(inc.lastOccurredAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
