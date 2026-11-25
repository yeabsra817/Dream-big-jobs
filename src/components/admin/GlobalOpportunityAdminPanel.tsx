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
  Download,
  Edit3,
  Link2,
  MapPin,
  Save,
  X,
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
  AdminCountryStatRecord,
  AdminManageableOpportunityRecord,
  adminTestOpportunityLink,
  adminUpdateGlobalOpportunity,
  ArchivedOpportunityAuditRecord,
  downloadAdminGlobalOpportunitiesCsv,
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
  const [countryStats, setCountryStats] = useState<AdminCountryStatRecord[]>([]);
  const [confirmedSponsoredCount, setConfirmedSponsoredCount] = useState<number>(0);
  const [sponsorshipUnconfirmedCount, setSponsorshipUnconfirmedCount] = useState<number>(0);
  const [manageableOpportunities, setManageableOpportunities] = useState<AdminManageableOpportunityRecord[]>([]);
  const [moderationQuery, setModerationQuery] = useState('');
  const [moderationFilter, setModerationFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [busyOppId, setBusyOppId] = useState<string | null>(null);
  const [editingOppId, setEditingOppId] = useState<string | null>(null);
  const [editSalary, setEditSalary] = useState('');
  const [editVisaClass, setEditVisaClass] = useState('no_sponsorship_stated');
  const [editVisaSummary, setEditVisaSummary] = useState('');
  const [exportingCsv, setExportingCsv] = useState(false);
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
      setCountryStats(data.countryStats || []);
      setConfirmedSponsoredCount(data.confirmedSponsoredCount ?? 0);
      setSponsorshipUnconfirmedCount(data.sponsorshipUnconfirmedCount ?? 0);
      setManageableOpportunities(data.manageableOpportunities || []);
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

  const handleExportCsv = async () => {
    setExportingCsv(true);
    setError(null);
    try {
      await downloadAdminGlobalOpportunitiesCsv(adminEmail);
      setMessage('Exported verified & archived international opportunities CSV report.');
    } catch (err: any) {
      setError(err?.message || 'CSV export failed.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleModerationAction = async (
    id: string,
    action: 'approve' | 'reject' | 'expire'
  ) => {
    setBusyOppId(id);
    setError(null);
    setMessage(null);
    try {
      await adminUpdateGlobalOpportunity(id, { action }, adminEmail);
      setMessage(`Opportunity updated (${action}).`);
      await loadLogs();
    } catch (err: any) {
      setError(err?.message || `Action "${action}" failed.`);
    } finally {
      setBusyOppId(null);
    }
  };

  const handleStartEdit = (item: AdminManageableOpportunityRecord) => {
    setEditingOppId(item.id);
    setEditSalary(item.stipendOrSalary || '');
    setEditVisaClass(item.employmentVisaClassification || 'no_sponsorship_stated');
    setEditVisaSummary(item.visaSupportSummary || '');
  };

  const handleSaveEdit = async (id: string) => {
    setBusyOppId(id);
    setError(null);
    try {
      const visaSupportType =
        editVisaClass === 'confirmed_visa_sponsorship' || editVisaClass === 'work_permit_assistance'
          ? 'employer_sponsored_visa'
          : editVisaClass === 'no_sponsorship_stated'
          ? 'not_confirmed'
          : 'visa_assistance_only';
      await adminUpdateGlobalOpportunity(
        id,
        {
          action: 'edit',
          stipendOrSalary: editSalary,
          employmentVisaClassification: editVisaClass,
          visaSupportType,
          visaSupportSummary: editVisaSummary,
        },
        adminEmail
      );
      setEditingOppId(null);
      setMessage('Saved updated salary & visa sponsorship verification fields.');
      await loadLogs();
    } catch (err: any) {
      setError(err?.message || 'Could not save edits.');
    } finally {
      setBusyOppId(null);
    }
  };

  const handleTestSingleLink = async (id: string) => {
    setBusyOppId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await adminTestOpportunityLink(id, adminEmail);
      setMessage(
        `Link test (${res.latencyMs}ms): ${res.note}${res.reachable ? ' — Official application link is live.' : ' — Review or mark expired.'}`
      );
      await loadLogs();
    } catch (err: any) {
      setError(err?.message || 'Live link test failed.');
    } finally {
      setBusyOppId(null);
    }
  };

  const filteredManageable = useMemo(() => {
    const q = moderationQuery.trim().toLowerCase();
    return manageableOpportunities.filter((item) => {
      if (moderationFilter === 'active' && !item.isActiveDisplayable) return false;
      if (moderationFilter === 'archived' && item.isActiveDisplayable) return false;
      if (q) {
        const hay = `${item.title} ${item.organization} ${item.country} ${item.region} ${item.sevenTierVisaLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [manageableOpportunities, moderationQuery, moderationFilter]);

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
            disabled={exportingCsv}
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#0B132B] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {exportingCsv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Export CSV Report</span>
          </button>
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

      {/* Section 13: Country-by-Country Stats & Confirmed vs Unconfirmed Sponsorship */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Country-by-Country Breakdown &amp; Sponsorship Verification</span>
          </h4>
          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="font-bold text-[#15803D]">
              Confirmed Sponsored: {confirmedSponsoredCount}
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-bold text-amber-800">
              Sponsorship Unconfirmed: {sponsorshipUnconfirmedCount}
            </span>
          </div>
        </div>
        {countryStats.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs tabular-nums">
            {countryStats.slice(0, 12).map((cs) => (
              <div key={cs.country} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                <div className="font-bold text-[#0B132B] truncate" title={cs.country}>
                  {cs.country}
                </div>
                <div className="text-[11px] text-slate-500">{cs.region}</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-700">
                  Active: <strong>{cs.active}</strong> · Sponsored: <strong className="text-[#15803D]">{cs.sponsored}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500 bg-slate-50/50">
            Country statistics will populate after the live discovery engine collects international opportunities.
          </div>
        )}
      </div>

      {/* Section 13: Admin Review, Approve/Reject/Expire, Salary/Visa Edit & Live Link Testing */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Opportunity Review, Moderation &amp; Live Link Testing ({filteredManageable.length})</span>
          </h4>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="text"
              value={moderationQuery}
              onChange={(e) => setModerationQuery(e.target.value)}
              placeholder="Filter by title, org, country..."
              className="px-2.5 py-1 rounded-md border border-slate-200 text-xs focus:outline-none focus:border-[#16A34A]"
            />
            {(['all', 'active', 'archived'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setModerationFilter(tab)}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold capitalize cursor-pointer ${
                  moderationFilter === tab
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredManageable.length === 0 ? (
          <div className="border border-slate-200 rounded-xl px-4 py-4 text-xs text-slate-500 bg-slate-50/50">
            No opportunities match this moderation filter.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden text-xs max-h-96 overflow-y-auto">
            {filteredManageable.slice(0, 35).map((item) => {
              const isBusy = busyOppId === item.id;
              const isEditing = editingOppId === item.id;
              return (
                <div key={item.id} className="p-3.5 bg-white hover:bg-slate-50/40 space-y-2">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-[#0B132B] flex flex-wrap items-center gap-1.5">
                        <span>{item.title}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            item.isActiveDisplayable
                              ? 'bg-emerald-50 text-[#15803D] border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {item.applicationStatus.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                        {item.organization} · {item.country} ({item.region}) · {item.careerSpecialtyLabel} ·{' '}
                        <span className={item.sponsorshipConfirmed ? 'text-[#15803D] font-semibold' : 'text-amber-800 font-semibold'}>
                          {item.sevenTierVisaLabel}
                        </span>
                        {item.estimatedMonthlyUsd ? ` · Est. $${item.estimatedMonthlyUsd.toLocaleString()}/mo` : ''}
                        {item.httpStatusCode ? ` · HTTP ${item.httpStatusCode}` : ''}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleTestSingleLink(item.id)}
                        className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Test official application URL live"
                      >
                        <Link2 className="w-3 h-3" />
                        <span>Test Link</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleStartEdit(item)}
                        className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleModerationAction(item.id, 'approve')}
                        className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-bold text-[#15803D] cursor-pointer disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleModerationAction(item.id, 'expire')}
                        className="px-2 py-1 rounded border border-amber-200 bg-amber-50 hover:bg-amber-100 text-[11px] font-bold text-amber-800 cursor-pointer disabled:opacity-50"
                      >
                        Expire
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleModerationAction(item.id, 'reject')}
                        className="px-2 py-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[11px] font-bold text-rose-700 cursor-pointer disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <label className="space-y-1">
                        <span className="font-semibold text-slate-600">Salary / Stipend Text</span>
                        <input
                          type="text"
                          value={editSalary}
                          onChange={(e) => setEditSalary(e.target.value)}
                          placeholder="e.g. EUR 65,000/year gross"
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="font-semibold text-slate-600">Visa Classification</span>
                        <select
                          value={editVisaClass}
                          onChange={(e) => setEditVisaClass(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        >
                          <option value="confirmed_visa_sponsorship">Confirmed Visa Sponsorship</option>
                          <option value="work_permit_assistance">Employer-Sponsored Work Permit</option>
                          <option value="relocation_assistance">Employer-Supported Relocation</option>
                          <option value="confirmed_international_recruitment">Foreign Applicants Accepted</option>
                          <option value="no_sponsorship_stated">Sponsorship Not Confirmed</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="font-semibold text-slate-600">Visa Verification Summary</span>
                        <input
                          type="text"
                          value={editVisaSummary}
                          onChange={(e) => setEditVisaSummary(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                      </label>
                      <div className="sm:col-span-3 flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingOppId(null)}
                          className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleSaveEdit(item.id)}
                          className="px-3 py-1 rounded bg-[#16A34A] text-white font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-3 h-3" />
                          <span>Save Verification Details</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
