import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Ban,
  Archive,
} from 'lucide-react';
import {
  AutonomousSchedulerInfo,
  DiscoveryJobLogRecord,
  OpportunitySourceRecord,
  OpportunityVerificationLogRecord,
  VerificationMonitoringSummary,
} from '../../types/globalOpportunities';
import {
  acknowledgeAdminDiscoveryAlert,
  ArchivedOpportunityAuditRecord,
  fetchAdminGlobalOpportunityLogs,
  triggerAdminDeadlineRecheck,
  triggerAdminGlobalDiscovery,
} from '../../lib/globalOpportunitiesService';

interface Props {
  adminEmail?: string | null;
}

type AuditFilterTab = 'all' | 'visa' | 'professional_restriction' | 'unpublished' | 'expired';

function formatRejectionCategoryLabel(cat?: string): string {
  switch (cat) {
    case 'visa':
      return 'Visa Rule Rejected';
    case 'professional_restriction':
      return 'Professional Restriction';
    case 'deadline':
      return 'Expired / < 3 Days';
    case 'withdrawn':
      return 'Closed / Withdrawn';
    case 'broken_link':
      return 'Broken Official Link';
    case 'eligibility':
      return 'Eligibility Ineligible';
    case 'authenticity':
      return 'Unofficial Source';
    default:
      return 'Verification Failed';
  }
}

export const GlobalOpportunityAdminPanel: React.FC<Props> = ({ adminEmail }) => {
  const [loading, setLoading] = useState(true);
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [runningRecheck, setRunningRecheck] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<OpportunitySourceRecord[]>([]);
  const [schedulerInfo, setSchedulerInfo] = useState<AutonomousSchedulerInfo | null>(null);
  const [monitoringSummary, setMonitoringSummary] = useState<VerificationMonitoringSummary | null>(null);
  const [archivedOpportunities, setArchivedOpportunities] = useState<ArchivedOpportunityAuditRecord[]>([]);
  const [auditFilter, setAuditFilter] = useState<AuditFilterTab>('all');
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
      setMonitoringSummary(data.monitoringSummary || null);
      setArchivedOpportunities(data.archivedOpportunities || []);
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
      const r = res.runLog;
      setMessage(
        `Discovery & verification complete: ${r.verifiedAndActiveCount} verified active (>=3d & visa-confirmed), ${
          r.rejectedDueToVisaCount ?? 0
        } rejected (visa rule), ${r.rejectedDueToProfessionalRestrictionCount ?? 0} rejected (professional restriction), ${
          r.autoUnpublishedCount ?? 0
        } auto-unpublished, ${r.rejectedUnderThreeDaysCount} excluded (<3d).`
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
      const r = res.runLog;
      setMessage(
        `6-hour compliance recheck finished: ${r.verifiedAndActiveCount} verified active, ${
          r.autoUnpublishedCount ?? 0
        } auto-unpublished & archived, ${r.rejectedDueToVisaCount ?? 0} visa failures, ${
          r.expiredPurgedCount
        } expired.`
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

  const filteredArchived = useMemo(() => {
    return archivedOpportunities.filter((item) => {
      if (auditFilter === 'visa') return item.rejectionCategory === 'visa';
      if (auditFilter === 'professional_restriction') return item.rejectionCategory === 'professional_restriction';
      if (auditFilter === 'unpublished') return item.wasPreviouslyPublished;
      if (auditFilter === 'expired') {
        return (
          item.rejectionCategory === 'deadline' ||
          item.rejectionCategory === 'withdrawn' ||
          item.applicationStatus === 'expired' ||
          item.applicationStatus === 'closed'
        );
      }
      return true;
    });
  }, [archivedOpportunities, auditFilter]);

  const activeAlert = schedulerInfo?.adminFailureAlert?.active ? schedulerInfo.adminFailureAlert : null;

  const summary: VerificationMonitoringSummary = monitoringSummary || {
    totalDiscoveredAllTime: totals.stored,
    activeVerifiedCount: totals.activeVerified,
    totalRejectedCount: Math.max(0, totals.stored - totals.activeVerified),
    autoUnpublishedCount: archivedOpportunities.filter((o) => o.wasPreviouslyPublished).length,
    rejectedDueToVisaCount: archivedOpportunities.filter((o) => o.rejectionCategory === 'visa').length,
    rejectedDueToProfessionalRestrictionCount: archivedOpportunities.filter(
      (o) => o.rejectionCategory === 'professional_restriction'
    ).length,
    expiredCount: archivedOpportunities.filter(
      (o) => o.rejectionCategory === 'deadline' || o.applicationStatus === 'expired'
    ).length,
    archivedRecordsCount: archivedOpportunities.length,
    sourceFailuresCount: sources.filter((s) => s.status === 'degraded' || s.status === 'error').length,
    lastVerificationAt: jobLogs[0]?.finishedAt || null,
    lastVerificationAtEat: schedulerInfo?.lastSuccessfulRunAtEat || null,
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-6 mb-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#16A34A]">
            <Globe className="w-4 h-4" />
            <span>Global Opportunity Verification Monitoring Dashboard</span>
          </div>
          <h3 className="text-lg font-extrabold text-[#0B132B] mt-0.5">
            Mandatory Visa Filter, Banking/WASH Restrictions &amp; 6-Hour Recheck Engine
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            Runs every 6 hours at <strong>00:00, 06:00, 12:00 &amp; 18:00 Africa/Addis_Ababa (EAT)</strong>. Rechecks
            every published opportunity against its official source and immediately soft-deletes/unpublishes any item
            that loses visa coverage, violates Banking/WASH restrictions, or drops under 3 full days.
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
            <span>Run 6h Compliance Recheck</span>
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

      {/* Complete Section G Verification & 6-Department Monitoring KPI Matrix (Single Elevation, Hairline Divided, Tabular Numerals) */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-200 text-xs tabular-nums">
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Intl Banking &amp; Finance Jobs</div>
            <div className="text-xl font-extrabold text-[#0B132B] mt-0.5">{summary.bankingJobsCount ?? 0}</div>
          </div>
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">International WASH Jobs</div>
            <div className="text-xl font-extrabold text-[#0B132B] mt-0.5">{summary.washJobsCount ?? 0}</div>
          </div>
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Visa-Sponsored / Intl Rec. Jobs</div>
            <div className="text-xl font-extrabold text-[#15803D] mt-0.5">{summary.visaSponsoredJobsCount ?? 0}</div>
          </div>
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Scholarships (Fully Funded)</div>
            <div className="text-xl font-extrabold text-[#0B132B] mt-0.5">
              {summary.scholarshipsCount ?? 0}{' '}
              <span className="text-xs font-semibold text-[#15803D]">({summary.fullyFundedScholarshipsCount ?? 0} full)</span>
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Professional Training</div>
            <div className="text-xl font-extrabold text-[#0B132B] mt-0.5">{summary.trainingCount ?? 0}</div>
          </div>
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">International Conferences</div>
            <div className="text-xl font-extrabold text-[#0B132B] mt-0.5">{summary.conferencesCount ?? 0}</div>
          </div>
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">PR Pathways (Countries Seeking)</div>
            <div className="text-xl font-extrabold text-[#15803D] mt-0.5">
              {summary.permanentResidencyPathwaysCount ?? 0}{' '}
              <span className="text-xs font-semibold text-slate-500">({summary.countriesSeekingWorkersCount ?? 0} nations)</span>
            </div>
          </div>
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Shortage Lists (Prof / Labour)</div>
            <div className="text-xl font-extrabold text-[#0B132B] mt-0.5">
              {summary.professionalShortageOccupationsCount ?? 0} / {summary.labourShortageOccupationsCount ?? 0}
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-slate-500 font-medium">VERIFIED / Partially Verified</div>
            <div className="text-xl font-extrabold text-[#15803D] mt-0.5">
              {summary.verifiedTierCount ?? summary.activeVerifiedCount}{' '}
              <span className="text-xs font-semibold text-[#1D4ED8]">/ {summary.partiallyVerifiedTierCount ?? 0}</span>
            </div>
          </div>
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Pending Verification</div>
            <div className="text-xl font-extrabold text-amber-700 mt-0.5">{summary.pendingVerificationCount ?? 0}</div>
          </div>
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Expired / &lt;3 Full Days</div>
            <div className="text-xl font-extrabold text-slate-700 mt-0.5">{summary.expiredCount}</div>
          </div>
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Duplicates Skipped (Last Run)</div>
            <div className="text-xl font-extrabold text-slate-700 mt-0.5">{summary.duplicatesSkippedLastRun ?? 0}</div>
          </div>

          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Total Stored / Discovered</div>
            <div className="text-xl font-extrabold text-[#0B132B] mt-0.5">{summary.totalDiscoveredAllTime}</div>
          </div>
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Auto-Unpublished</div>
            <div className="text-xl font-extrabold text-amber-700 mt-0.5">{summary.autoUnpublishedCount}</div>
          </div>
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Rejected (Visa / Sector)</div>
            <div className="text-xl font-extrabold text-rose-700 mt-0.5">
              {summary.rejectedDueToVisaCount} / {summary.rejectedDueToProfessionalRestrictionCount}
            </div>
          </div>
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Source Availability Failures</div>
            <div
              className={`text-xl font-extrabold mt-0.5 ${
                summary.sourceFailuresCount > 0 ? 'text-rose-700' : 'text-[#15803D]'
              }`}
            >
              {summary.sourceFailuresCount}
            </div>
          </div>
        </div>

        {/* Schedule Timestamps Strip */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs tabular-nums">
          <div>
            <span className="text-slate-500">Last Successful Search: </span>
            <strong className="text-[#0B132B]">
              {schedulerInfo?.lastSuccessfulRunAtEat ||
                summary.lastVerificationAtEat ||
                (summary.lastVerificationAt
                  ? new Date(summary.lastVerificationAt).toLocaleString()
                  : 'Pending first run')}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Next Scheduled Search: </span>
            <strong className="text-[#15803D]">
              {schedulerInfo?.nextScheduledRunAtEat || '00:00 / 06:00 / 12:00 / 18:00 EAT'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Schedule: </span>
            <strong className="text-[#0B132B]">
              {schedulerInfo ? `${schedulerInfo.scheduleHoursEat.join(' · ')} (${schedulerInfo.timezone})` : 'Every 6 hours EAT'}
            </strong>
          </div>
        </div>
      </div>

      {/* 6 Fault-Isolated Discovery Departments Status Table */}
      {jobLogs[0]?.departmentSummaries && jobLogs[0].departmentSummaries.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            6 Independent Discovery Departments (Fault-Isolated Last Run)
          </h4>
          <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">Department</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-3 py-2.5 font-bold text-right">Total</th>
                  <th className="px-3 py-2.5 font-bold text-right">VERIFIED</th>
                  <th className="px-3 py-2.5 font-bold text-right">Partially Verified</th>
                  <th className="px-3 py-2.5 font-bold text-right">Pending</th>
                  <th className="px-3 py-2.5 font-bold text-right">Rejected / Expired</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobLogs[0].departmentSummaries.map((d) => (
                  <tr key={d.department} className="hover:bg-slate-50/50">
                    <td className="px-3.5 py-2 font-semibold text-[#0B132B]">{d.label}</td>
                    <td className="px-3 py-2 font-bold">
                      <span
                        className={
                          d.status === 'success'
                            ? 'text-[#15803D]'
                            : d.status === 'partial'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }
                      >
                        {d.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-700">{d.candidatesFound}</td>
                    <td className="px-3 py-2 text-right font-bold text-[#15803D]">{d.verifiedCount}</td>
                    <td className="px-3 py-2 text-right font-semibold text-[#1D4ED8]">{d.partiallyVerifiedCount}</td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-700">{d.pendingCount}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{d.rejectedOrExpiredCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Exact Rejection & Auto-Unpublish Audit History */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5 text-slate-500" />
            <span>Rejected &amp; Auto-Unpublished Audit Records (Soft-Deleted)</span>
          </h4>
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            {(
              [
                ['all', `All (${archivedOpportunities.length})`],
                ['visa', `Visa Rejected (${summary.rejectedDueToVisaCount})`],
                ['professional_restriction', `Prof. Restriction (${summary.rejectedDueToProfessionalRestrictionCount})`],
                ['unpublished', `Auto-Unpublished (${summary.autoUnpublishedCount})`],
                ['expired', `Expired (${summary.expiredCount})`],
              ] as Array<[AuditFilterTab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAuditFilter(key)}
                className={`px-2.5 py-1 rounded-md border font-semibold transition-colors cursor-pointer ${
                  auditFilter === key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-xs text-slate-500 py-3">Loading archived rejection records...</div>
        ) : filteredArchived.length === 0 ? (
          <div className="border border-slate-200 rounded-xl px-4 py-5 text-xs text-slate-500 bg-slate-50/50">
            No archived rejection or unpublish records match this filter yet.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden text-xs max-h-80 overflow-y-auto">
            {filteredArchived.slice(0, 40).map((item) => (
              <div key={item.id} className="p-3.5 space-y-1.5 bg-white hover:bg-slate-50/60">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-[#0B132B]">{item.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {item.organization} · {item.category.replace(/_/g, ' ')}
                      {item.wasPreviouslyPublished ? ' · Previously Published (Auto-Unpublished)' : ' · Rejected Pre-Publication'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-rose-700 inline-flex items-center gap-1">
                      <Ban className="w-3 h-3" />
                      {formatRejectionCategoryLabel(item.rejectionCategory)}
                    </span>
                    <a
                      href={item.officialApplicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-[#16A34A]"
                      title="Inspect official source URL"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
                <div className="text-xs text-rose-800 bg-rose-50/70 border border-rose-200/70 rounded-md px-2.5 py-1.5">
                  <strong>Exact Reason:</strong> {item.rejectionReason}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
                  <span>Visa Verification: {item.visaSupportSummary}</span>
                  <span>
                    {item.unpublishedAt
                      ? `Unpublished ${new Date(item.unpublishedAt).toLocaleString()}`
                      : `Archived ${new Date(item.archivedAt).toLocaleString()}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
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
                      {s.monitoredPortals.filter((p) => p.httpStatus !== null && p.httpStatus >= 200 && p.httpStatus < 400).length}/
                      {s.monitoredPortals.length} official portals live (HTTP 200)
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
            <span>Recent 6-Hour Scheduled &amp; Manual Runs</span>
          </h4>
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
            {jobLogs.slice(0, 6).map((run) => (
              <div
                key={run.id}
                className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 tabular-nums"
              >
                <div>
                  <span className="font-bold text-[#0B132B]">{run.jobType}</span> ·{' '}
                  <span className="text-slate-600">{run.trigger}</span> ·{' '}
                  <span className="text-slate-500">{new Date(run.finishedAt).toLocaleString()}</span>
                </div>
                <div className="text-slate-700 font-medium">
                  Verified: <strong>{run.verifiedAndActiveCount}</strong> · Visa Rej:{' '}
                  <strong>{run.rejectedDueToVisaCount ?? 0}</strong> · Prof Rej:{' '}
                  <strong>{run.rejectedDueToProfessionalRestrictionCount ?? 0}</strong> · Unpub:{' '}
                  <strong>{run.autoUnpublishedCount ?? 0}</strong> · {run.durationMs}ms
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {verLogs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Verification History Log
          </h4>
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs max-h-64 overflow-y-auto">
            {verLogs.slice(0, 15).map((vl) => (
              <div key={vl.id} className="px-3.5 py-2.5 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#0B132B] truncate">{vl.opportunityTitle}</div>
                    <div className="text-[11px] text-slate-500 truncate tabular-nums">
                      {vl.organization} · HTTP {vl.httpStatus ?? 'API'} · {vl.fullDaysRemaining ?? 0}d left ·{' '}
                      {new Date(vl.checkedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-bold ${
                        vl.actionTaken === 'verified' ||
                        (vl.passedUrlVerification &&
                          vl.passedDeadlineRule &&
                          vl.passedVisaRule !== false &&
                          vl.passedProfessionalRestriction !== false)
                          ? 'text-[#15803D]'
                          : 'text-rose-700'
                      }`}
                    >
                      {vl.actionTaken === 'auto_unpublished'
                        ? 'Auto-Unpublished'
                        : vl.actionTaken === 'rejected'
                        ? 'Rejected'
                        : vl.resultingStatus}
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
                {vl.rejectionReason && (
                  <div className="text-[11px] text-rose-700">{vl.rejectionReason}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
