import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Globe,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { AdminOpportunityIntelligenceDashboardResponse } from '../../types/opportunityIntelligence';
import {
  fetchAdminOpportunityIntelligenceDashboard,
  triggerAdminDailyOpportunityCheck,
} from '../../lib/opportunityIntelligenceService';

interface OpportunityIntelligenceAdminPanelProps {
  adminEmail?: string | null;
}

function formatDateTimeEat(iso: string | null | undefined, eatFormatted?: string | null): string {
  if (eatFormatted) return eatFormatted;
  if (!iso) return 'Not yet executed';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  try {
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Addis_Ababa',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(parsed)) + ' EAT (Africa/Addis_Ababa)'
    );
  } catch {
    return new Date(parsed).toLocaleString();
  }
}

export const OpportunityIntelligenceAdminPanel: React.FC<OpportunityIntelligenceAdminPanelProps> = ({
  adminEmail,
}) => {
  const [data, setData] = useState<AdminOpportunityIntelligenceDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'sources' | 'rejections' | 'history'>('overview');
  const [sourceRegionFilter, setSourceRegionFilter] = useState<string>('ALL');
  const [sourceStatusFilter, setSourceStatusFilter] = useState<string>('ALL');
  const [sourceSearch, setSourceSearch] = useState('');
  const [rejectionSearch, setRejectionSearch] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminOpportunityIntelligenceDashboard(adminEmail);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load Opportunity Intelligence monitoring dashboard.');
    } finally {
      setLoading(false);
    }
  }, [adminEmail]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleRunDailyCheck = async () => {
    setRunning(true);
    setError(null);
    setStatusBanner(null);
    try {
      const res = await triggerAdminDailyOpportunityCheck(adminEmail);
      if (res.dashboard) {
        setData(res.dashboard);
      } else {
        await loadDashboard();
      }
      if (res.run) {
        setStatusBanner(
          `Manual check completed (${res.run.status}): checked ${res.run.sourcesChecked} sources (${res.run.sourcesSucceeded} active, ${res.run.sourcesRestricted ?? 0} restricted, ${res.run.sourcesFailed} errors), ${res.run.newOpportunitiesDiscovered} new, ${res.run.opportunitiesUpdated ?? 0} updated, ${res.run.duplicatesPrevented} duplicates prevented, ${res.run.opportunitiesUnpublished} expired removed. Automatic 24-hour Africa/Addis_Ababa schedule unchanged.`
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to execute manual source monitoring sweep.');
    } finally {
      setRunning(false);
    }
  };

  const filteredSources = useMemo(() => {
    if (!data?.sources) return [];
    const q = sourceSearch.trim().toLowerCase();
    return data.sources.filter((src) => {
      if (sourceRegionFilter !== 'ALL' && src.region !== sourceRegionFilter) return false;
      if (sourceStatusFilter !== 'ALL' && src.accessStatus !== sourceStatusFilter) return false;
      if (!q) return true;
      return (
        String(src.sourceNumber).includes(q) ||
        src.name.toLowerCase().includes(q) ||
        src.region.toLowerCase().includes(q) ||
        src.url.toLowerCase().includes(q) ||
        (src.accessNote || '').toLowerCase().includes(q) ||
        src.sectorFocus.toLowerCase().includes(q)
      );
    });
  }, [data?.sources, sourceRegionFilter, sourceStatusFilter, sourceSearch]);

  const filteredRejections = useMemo(() => {
    if (!data?.rejectionAuditLogs) return [];
    const q = rejectionSearch.trim().toLowerCase();
    if (!q) return data.rejectionAuditLogs;
    return data.rejectionAuditLogs.filter((item) =>
      `${item.title} ${item.employer} ${item.category} ${item.rejectionCodes.join(' ')} ${item.explanations.join(' ')}`
        .toLowerCase()
        .includes(q)
    );
  }, [data?.rejectionAuditLogs, rejectionSearch]);

  if (loading && !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
        <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">
          Loading 40-Source Opportunity Monitoring Dashboard...
        </p>
      </div>
    );
  }

  const m = data?.metrics;
  const monitoringStatus = data?.monitoringStatus ?? 'idle';
  const statusBadgeClass =
    monitoringStatus === 'active'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : monitoringStatus === 'running'
      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
      : monitoringStatus === 'degraded'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : 'bg-slate-700/60 text-slate-300 border-slate-600';

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-[#0B132B] text-white rounded-2xl p-6 border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Owner-Only 24-Hour Source Monitoring</span>
              <span
                className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass}`}
              >
                Status: {monitoringStatus}
              </span>
              <span className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800/80 text-slate-200 text-[10px] font-semibold normal-case">
                Timezone: {data?.timezone ?? 'Africa/Addis_Ababa'} (Every {data?.schedulerIntervalHours ?? 24}h)
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              40-Source Automatic Opportunity Monitor &amp; Strict Verification Engine
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
              Permanently tracks all {m?.totalSourcesMonitored ?? 40} registered sources across Middle East, Europe,
              USA, and Scandinavia / Nordic. Runs automatically every 24 hours on the server in Africa/Addis_Ababa time,
              respects robots.txt and rate limits, enforces permanent deduplication, and scopes the &gt;$3,000/month
              salary filter strictly to international Branch Banking roles only.
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => void loadDashboard()}
                disabled={loading || running}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => void handleRunDailyCheck()}
                disabled={running}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{running ? 'Running Manual Check...' : 'Run Manual Check Now'}</span>
              </button>
            </div>
            <span className="text-[11px] text-slate-400">
              Manual runs execute immediately without changing the automatic 24-hour schedule.
            </span>
          </div>
        </div>

        {/* Execution Schedule Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800 text-xs">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-400 font-medium">Last Successful Run (EAT)</div>
            <div className="text-white font-semibold mt-0.5 tabular-nums">
              {formatDateTimeEat(m?.lastSuccessfulExecution, m?.lastSuccessfulExecutionEat)}
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-400 font-medium">Next Scheduled 24h Run (EAT)</div>
            <div className="text-emerald-300 font-semibold mt-0.5 tabular-nums">
              {formatDateTimeEat(m?.nextScheduledExecution, m?.nextScheduledExecutionEat)}
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-400 font-medium">40 Sources Live Access Split</div>
            <div className="text-white font-semibold mt-0.5 tabular-nums">
              <span className="text-emerald-400">{m?.sourcesSuccessfullyChecked ?? 0} Active</span> ·{' '}
              <span className="text-amber-300">{m?.sourcesRestricted ?? 0} Restricted</span> ·{' '}
              <span className="text-rose-400">{m?.sourcesFailed ?? 0} Errors</span>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <div className="text-slate-400 font-medium">Published by Category</div>
            <div className="text-white font-semibold mt-0.5 tabular-nums">
              {data?.environmentBreakdown.internationalPublished ?? 0} Intl ·{' '}
              {data?.environmentBreakdown.ethiopiaDomesticPublished ?? 0} ET ·{' '}
              {data?.environmentBreakdown.branchBankingPublished ?? 0} Bank ·{' '}
              {data?.environmentBreakdown.internshipsPublished ?? 0} Int ·{' '}
              {data?.environmentBreakdown.scholarshipsPublished ?? 0} Sch ·{' '}
              {data?.environmentBreakdown.conferencesPublished ?? 0} Conf ·{' '}
              {data?.environmentBreakdown.trainingPublished ?? 0} Trn
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs sm:text-sm text-rose-900 font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {statusBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs sm:text-sm text-emerald-900 font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'overview', label: 'Monitoring Metrics Overview' },
          { id: 'sources', label: `All ${data?.sources.length ?? 40} Registered Sources` },
          { id: 'rejections', label: `Rejection Audit (${data?.rejectionAuditLogs.length ?? 0})` },
          { id: 'history', label: `24h Run History & Logs (${data?.recentScheduledRuns.length ?? 0})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeSubTab === tab.id
                ? 'bg-[#0B132B] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: MONITORING METRICS OVERVIEW */}
      {activeSubTab === 'overview' && m && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>40-Source Monitoring &amp; Discovery Pipeline</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricTile label="Total Registered Sources" value={m.totalSourcesMonitored} tone="slate" />
              <MetricTile label="Active & Monitored" value={m.sourcesSuccessfullyChecked} tone="emerald" />
              <MetricTile
                label="Restricted / Blocked"
                value={m.sourcesRestricted ?? 0}
                tone={(m.sourcesRestricted ?? 0) > 0 ? 'amber' : 'slate'}
              />
              <MetricTile
                label="Source Errors"
                value={m.sourcesFailed}
                tone={m.sourcesFailed > 0 ? 'rose' : 'slate'}
              />
              <MetricTile label="Published Active" value={m.opportunitiesPublished} tone="emerald" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <MetricTile label="New Discovered" value={m.newOpportunitiesDiscovered} tone="sky" />
              <MetricTile label="Existing Updated (24h)" value={m.opportunitiesUpdated ?? 0} tone="sky" />
              <MetricTile label="Verified Total" value={m.opportunitiesVerified} tone="slate" />
              <MetricTile label="Expired / Removed" value={m.opportunitiesRemoved} tone="amber" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Strict Visa Sponsorship, Salary &amp; Profile Rejection Counters</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricTile label="Total Rejected" value={m.opportunitiesRejected} tone="rose" />
              <MetricTile label="Unverified Sponsorship Rejected" value={m.visaSponsorshipFailures} tone="rose" />
              <MetricTile label="Intl Branch Salary (<$3k) Rejected" value={m.salaryFilterFailures} tone="amber" />
              <MetricTile label="Experience Mismatches" value={m.experienceMismatchRejections} tone="amber" />
              <MetricTile label="Seniority Mismatches" value={m.seniorityMismatchRejections} tone="rose" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-600" />
              <span>Permanent Duplicate Prevention &amp; User Notification Hygiene</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MetricTile
                label="Duplicates Prevented"
                value={m.duplicateOpportunitiesPrevented}
                tone="emerald"
              />
              <MetricTile label="Notifications Sent" value={m.notificationsSent} tone="sky" />
              <MetricTile
                label="Duplicate Notifications Prevented"
                value={m.duplicateNotificationsPrevented}
                tone="emerald"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL 40 REGISTERED SOURCES */}
      {activeSubTab === 'sources' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                placeholder="Search source #, name, region, URL, or status note..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={sourceRegionFilter}
                onChange={(e) => setSourceRegionFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white font-semibold text-slate-700"
              >
                <option value="ALL">All 4 Regions ({data?.sources.length ?? 40})</option>
                <option value="Middle East">Middle East (10)</option>
                <option value="Europe">Europe (10)</option>
                <option value="USA">USA (10)</option>
                <option value="Scandinavia / Nordic">Scandinavia / Nordic (10)</option>
              </select>
              <select
                value={sourceStatusFilter}
                onChange={(e) => setSourceStatusFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white font-semibold text-slate-700"
              >
                <option value="ALL">All Access Statuses</option>
                <option value="active">Active &amp; Monitored</option>
                <option value="restricted">Restricted / Blocked</option>
                <option value="error">Error</option>
                <option value="pending">Pending First Check</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-3 w-12">#</th>
                  <th className="px-4 py-3">Registered Source</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Categories &amp; Mode</th>
                  <th className="px-4 py-3">Access Status &amp; Robots</th>
                  <th className="px-4 py-3">Discovered</th>
                  <th className="px-4 py-3">Last Checked (EAT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSources.map((src) => (
                  <tr key={src.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-3 font-mono font-bold text-slate-400">
                      {String(src.sourceNumber).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{src.name}</div>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-sky-700 hover:underline break-all"
                      >
                        <span>{src.url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                      {src.officialEndpointUrl && (
                        <div className="text-[10px] text-emerald-700 font-medium mt-0.5 truncate max-w-[280px]" title={src.officialEndpointUrl}>
                          Official feed/API: {src.officialEndpointUrl}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                      {src.region}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="capitalize">{src.sectorFocus.replace(/_/g, ' ')}</div>
                      <div className="text-[10px] text-slate-500 uppercase mt-0.5">
                        {src.categoryCoverage.join(' · ')} ({src.feedType})
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                            src.accessStatus === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : src.accessStatus === 'restricted'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : src.accessStatus === 'error'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {src.accessStatus}
                          {src.lastHttpStatus ? ` (HTTP ${src.lastHttpStatus})` : ''}
                        </span>
                        {src.robotsAllowed !== null && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              src.robotsAllowed
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {src.robotsAllowed ? 'robots.txt OK' : 'robots.txt Disallow'}
                          </span>
                        )}
                      </div>
                      {(src.accessNote || src.lastError) && (
                        <div
                          className={`text-[10px] mt-1 max-w-[260px] leading-snug ${
                            src.accessStatus === 'error'
                              ? 'text-rose-700'
                              : src.accessStatus === 'restricted'
                              ? 'text-amber-800'
                              : 'text-slate-500'
                          }`}
                          title={src.accessNote || src.lastError || ''}
                        >
                          {src.accessNote || src.lastError}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold tabular-nums text-slate-800">
                      {src.itemsDiscoveredTotal}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                      {formatDateTimeEat(src.lastCheckedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REJECTION EXPLANATION AUDIT LOG */}
      {activeSubTab === 'rejections' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Complete Rejection Explanation Audit Log
              </h3>
              <p className="text-xs text-slate-500">
                Every rejected or auto-unpublished opportunity records the exact failing policy and human-readable explanation.
              </p>
            </div>
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={rejectionSearch}
                onChange={(e) => setRejectionSearch(e.target.value)}
                placeholder="Filter rejections by title, reason, country..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {filteredRejections.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No rejected or unpublished records match your filter.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRejections.map((item) => (
                <div key={`${item.opportunityId}-${item.checkedAt}`} className="p-4 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="text-sm font-bold text-slate-900">{item.title}</span>
                      <span className="text-xs text-slate-500">· {item.employer}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {formatDateTimeEat(item.checkedAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold uppercase">
                      {item.category}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      {item.environment === 'ethiopia_domestic' ? 'Ethiopia Domestic' : 'International'}
                    </span>
                    {item.rejectionCodes.map((code) => (
                      <span
                        key={code}
                        className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-mono"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {item.explanations.join(' ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SCHEDULED EXECUTION RUNS & VERIFICATION LOGS */}
      {activeSubTab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Recent 24-Hour &amp; Manual Runs (EAT)</h3>
            </div>
            {data?.recentScheduledRuns.length === 0 ? (
              <div className="p-6 text-xs text-slate-500 text-center">
                No scheduled runs recorded yet. Click &ldquo;Run Manual Check Now&rdquo; to trigger an immediate sweep.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {data?.recentScheduledRuns.map((run) => (
                  <div key={run.id} className="p-4 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 capitalize">
                        {run.trigger.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                          run.status === 'success'
                            ? 'bg-emerald-50 text-emerald-800'
                            : run.status === 'partial'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {run.status} · {(run.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="text-slate-600">
                      Sources: {run.sourcesSucceeded} active · {run.sourcesRestricted ?? 0} restricted ·{' '}
                      {run.sourcesFailed} errors / {run.sourcesChecked} checked
                    </div>
                    <div className="text-slate-600">
                      New: {run.newOpportunitiesDiscovered} · Updated: {run.opportunitiesUpdated ?? 0} · Published:{' '}
                      {run.opportunitiesPublished} · Rejected: {run.opportunitiesRejected} · Expired removed:{' '}
                      {run.opportunitiesUnpublished}
                    </div>
                    <div className="text-slate-500">
                      Duplicates prevented: {run.duplicatesPrevented} · Notifications sent:{' '}
                      {run.notificationsSent} (dup blocked: {run.duplicateNotificationsPrevented})
                    </div>
                    <div className="text-[11px] text-slate-400">{formatDateTimeEat(run.finishedAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">Immutable Verification History</h3>
            </div>
            {data?.recentVerificationLogs.length === 0 ? (
              <div className="p-6 text-xs text-slate-500 text-center">
                No verification log entries recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {data?.recentVerificationLogs.map((log) => (
                  <div key={log.id} className="p-4 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 font-mono text-[11px]">
                        {log.opportunityId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                          log.newStatus === 'published'
                            ? 'bg-emerald-50 text-emerald-800'
                            : log.newStatus === 'unpublished'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {log.previousStatus} → {log.newStatus}
                      </span>
                    </div>
                    <div className="text-slate-600">{log.explanation}</div>
                    <div className="text-[11px] text-slate-400">
                      {log.action.replace(/_/g, ' ')} · {formatDateTimeEat(log.checkedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MetricTile: React.FC<{
  label: string;
  value: number;
  tone: 'emerald' | 'rose' | 'amber' | 'sky' | 'slate';
}> = ({ label, value, tone }) => {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
      : tone === 'rose'
      ? 'border-rose-200 bg-rose-50/50 text-rose-900'
      : tone === 'amber'
      ? 'border-amber-200 bg-amber-50/50 text-amber-900'
      : tone === 'sky'
      ? 'border-sky-200 bg-sky-50/50 text-sky-900'
      : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className={`rounded-xl border p-3.5 ${toneClass}`}>
      <div className="text-[11px] font-semibold opacity-80 leading-snug">{label}</div>
      <div className="text-2xl font-extrabold mt-1 tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
};
