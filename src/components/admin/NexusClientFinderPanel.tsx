import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Briefcase,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Globe,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  NexusClientFinderApiResponse,
  NexusClientLead,
  NexusContactStatus,
  NexusEmailClassification,
  NexusLeadCategory,
  NexusMessageTemplateType,
} from '../../types/nexusClientFinder';
import {
  NEXUS_CATEGORY_LABELS,
  NEXUS_CONTACT_STATUS_LABELS,
  NEXUS_EMAIL_CLASSIFICATION_LABELS,
  NEXUS_GMAIL_MAX_BCC_PER_BATCH,
  buildBulkBccGmailBatches,
  buildSelectedLeadsCsv,
  buildSingleClientGmailComposeUrl,
  generateNexusProposalMessage,
} from '../../utils/nexusClientFinderEngine';
import {
  addNexusSuppressionEntry,
  fetchNexusClientFinderDashboard,
  recordNexusOutreachEvent,
  removeNexusSuppressionEntry,
  requestNexusMessageDraft,
  triggerNexusFreeDiscovery,
  triggerNexusRecheckActive,
  updateNexusLeadStatus,
  updateNexusLeadsBulkStatus,
} from '../../lib/nexusClientFinderService';

interface Props {
  adminEmail: string | null;
}

type SubView = 'leads' | 'analytics' | 'sources' | 'suppression';

const TEMPLATE_OPTIONS: Array<{ value: NexusMessageTemplateType; label: string }> = [
  { value: 'website_development', label: 'Website Development' },
  { value: 'ecommerce_development', label: 'E-Commerce Website' },
  { value: 'business_website', label: 'Business Website' },
  { value: 'website_redesign', label: 'Website Redesign' },
  { value: 'follow_up', label: 'Polite Follow-Up' },
];

const CONTACT_STATUS_OPTIONS = Object.entries(NEXUS_CONTACT_STATUS_LABELS) as Array<
  [NexusContactStatus, string]
>;

const CATEGORY_OPTIONS = Object.entries(NEXUS_CATEGORY_LABELS) as Array<[NexusLeadCategory, string]>;

function getSafeExternalHref(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function formatHoursAgo(publishedAt: string): string {
  const ms = Date.parse(publishedAt);
  if (!Number.isFinite(ms)) return 'Unknown';
  const diffH = Math.max(0, (Date.now() - ms) / (3600 * 1000));
  if (diffH < 1) return `${Math.max(1, Math.round(diffH * 60))}m ago`;
  return `${diffH.toFixed(1)}h ago`;
}

function formatUtcTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function defaultTemplateForCategory(category: NexusLeadCategory): NexusMessageTemplateType {
  if (category === 'ecommerce_website_request') return 'ecommerce_development';
  if (category === 'website_redesign_improvement') return 'website_redesign';
  if (category === 'business_website_creation') return 'business_website';
  return 'website_development';
}

function emailBadgeClass(classification: NexusEmailClassification): string {
  switch (classification) {
    case 'verified_business_email':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'unverified_business_email':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'personal_email':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function verificationBadgeClass(status: NexusClientLead['verificationStatus']): string {
  switch (status) {
    case 'verified':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'partially_verified':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'pending':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'expired':
    case 'rejected':
    default:
      return 'bg-rose-50 text-rose-800 border-rose-200';
  }
}

export const NexusClientFinderPanel: React.FC<Props> = ({ adminEmail }) => {
  const [subView, setSubView] = useState<SubView>('leads');
  const [data, setData] = useState<NexusClientFinderApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningDiscovery, setIsRunningDiscovery] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(
    null
  );

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [emailFilter, setEmailFilter] = useState('all');
  const [contactStatusFilter, setContactStatusFilter] = useState('all');
  const [includeExpired, setIncludeExpired] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'verified_email_first' | 'country'>('newest');

  // Selection for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusTarget, setBulkStatusTarget] = useState<NexusContactStatus>('ready_to_contact');

  // Single-Client Gmail Modal
  const [singleModalLead, setSingleModalLead] = useState<NexusClientLead | null>(null);
  const [singleTemplate, setSingleTemplate] = useState<NexusMessageTemplateType>('website_development');
  const [singleSubject, setSingleSubject] = useState('');
  const [singleBody, setSingleBody] = useState('');
  const [singlePrivacyNotice, setSinglePrivacyNotice] = useState('');
  const [singleGeneratedBy, setSingleGeneratedBy] = useState<string>('deterministic_nexus_assistant');
  const [isPolishingDraft, setIsPolishingDraft] = useState(false);
  const [copiedSingle, setCopiedSingle] = useState(false);

  // Bulk Gmail Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkModalTab, setBulkModalTab] = useState<'bcc' | 'individual' | 'csv'>('bcc');
  const [bulkTemplate, setBulkTemplate] = useState<NexusMessageTemplateType>('website_development');
  const [bulkSubject, setBulkSubject] = useState(
    'Website Development & Digital Support — Nexus IT Solutions'
  );
  const [bulkBody, setBulkBody] = useState(
    `Hello,\n\nI saw your recent public inquiry looking for web development support. At Nexus IT Solutions, we build fast, reliable business websites, e-commerce storefronts, WordPress sites, and custom web applications.\n\nIf your project is still open, please reply with your key goals and timeline and we will share a clear, no-obligation scope and quote.\n\nBest regards,\nNexus IT Solutions`
  );
  const [allowAlreadyContactedInBulk, setAllowAlreadyContactedInBulk] = useState(false);

  // Suppression list form
  const [newSupEmail, setNewSupEmail] = useState('');
  const [newSupDomain, setNewSupDomain] = useState('');
  const [newSupReason, setNewSupReason] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetchNexusClientFinderDashboard(adminEmail, {
        search: search.trim() || undefined,
        country: countryFilter,
        category: categoryFilter,
        verificationStatus: verificationFilter,
        emailClassification: emailFilter,
        contactStatus: contactStatusFilter,
        includeExpired,
        sortBy,
      });
      setData(resp);
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: err?.message || 'Unable to load Nexus IT Solutions Client Finder data.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    adminEmail,
    search,
    countryFilter,
    categoryFilter,
    verificationFilter,
    emailFilter,
    contactStatusFilter,
    includeExpired,
    sortBy,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboard();
    }, 180);
    return () => clearTimeout(timer);
  }, [loadDashboard]);

  const handleRunFreeDiscovery = async () => {
    setIsRunningDiscovery(true);
    setBannerMessage(null);
    try {
      const res = await triggerNexusFreeDiscovery(adminEmail);
      const run = res.runLog;
      setBannerMessage({
        type: run.status === 'failed' ? 'error' : 'success',
        text: `Live free discovery finished in ${(run.durationMs / 1000).toFixed(1)}s — scanned ${run.rawCandidatesScanned} real public listings across ${run.sourcesQueried} free sources, accepted ${run.acceptedWithin72hCount} fresh (<72h) leads (${run.verifiedCount} verified, ${run.partiallyVerifiedCount} partially verified), rejected ${run.rejectedExpiredOrOver72hCount} over-72h/expired and ${run.rejectedIrrelevantOrFakeCount} irrelevant, skipped ${run.duplicatesSkippedCount} duplicates.`,
      });
      await loadDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err?.message || 'Live discovery run failed.' });
    } finally {
      setIsRunningDiscovery(false);
    }
  };

  const handleRecheckActive = async () => {
    setIsRechecking(true);
    setBannerMessage(null);
    try {
      const res = await triggerNexusRecheckActive(adminEmail);
      setBannerMessage({
        type: 'info',
        text: `Rechecked ${res.checkedCount} active leads against live URLs & 72-hour freshness window (${res.expiredOrInactiveCount} expired/inactive removed from active view).`,
      });
      await loadDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err?.message || 'Active lead recheck failed.' });
    } finally {
      setIsRechecking(false);
    }
  };

  const handleLeadStatusChange = async (leadId: string, nextStatus: NexusContactStatus) => {
    try {
      await updateNexusLeadStatus(adminEmail, leadId, { contactStatus: nextStatus });
      if (nextStatus === 'do_not_contact') {
        setBannerMessage({
          type: 'info',
          text: 'Lead marked "Do not contact" and automatically added to the Permanent Suppression List.',
        });
      }
      await loadDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err?.message || 'Status update failed.' });
    }
  };

  const handleBulkStatusApply = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const res = await updateNexusLeadsBulkStatus(adminEmail, ids, bulkStatusTarget);
      setBannerMessage({
        type: 'success',
        text: `Updated ${res.updatedCount} selected leads to "${NEXUS_CONTACT_STATUS_LABELS[bulkStatusTarget]}".`,
      });
      await loadDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err?.message || 'Bulk status update failed.' });
    }
  };

  const openSingleGmailModal = (lead: NexusClientLead) => {
    const tmpl = defaultTemplateForCategory(lead.category);
    const draft = generateNexusProposalMessage(lead, tmpl);
    setSingleModalLead(lead);
    setSingleTemplate(tmpl);
    setSingleSubject(draft.subject);
    setSingleBody(draft.body);
    setSinglePrivacyNotice(draft.privacyNotice);
    setSingleGeneratedBy(draft.generatedBy);
    setCopiedSingle(false);
  };

  const handleSingleTemplateChange = (nextTemplate: NexusMessageTemplateType) => {
    setSingleTemplate(nextTemplate);
    if (!singleModalLead) return;
    const draft = generateNexusProposalMessage(singleModalLead, nextTemplate);
    setSingleSubject(draft.subject);
    setSingleBody(draft.body);
    setSinglePrivacyNotice(draft.privacyNotice);
    setSingleGeneratedBy(draft.generatedBy);
  };

  const handlePolishSingleDraft = async () => {
    if (!singleModalLead) return;
    setIsPolishingDraft(true);
    try {
      const draft = await requestNexusMessageDraft(adminEmail, singleModalLead.id, singleTemplate, true);
      setSingleSubject(draft.subject);
      setSingleBody(draft.body);
      setSinglePrivacyNotice(draft.privacyNotice);
      setSingleGeneratedBy(draft.generatedBy);
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err?.message || 'Draft generation failed.' });
    } finally {
      setIsPolishingDraft(false);
    }
  };

  const handleRecordSingleOutreach = async (lead: NexusClientLead) => {
    try {
      await recordNexusOutreachEvent(adminEmail, {
        leadIds: [lead.id],
        mode: 'single_gmail',
        subject: singleSubject,
        templateType: singleTemplate,
        note: 'Opened via OPEN GMAIL – SINGLE CLIENT',
      });
      setBannerMessage({
        type: 'success',
        text: `Logged Gmail outreach for "${lead.advertiserName}" and updated status to Contacted.`,
      });
      await loadDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err?.message || 'Failed to record outreach.' });
    }
  };

  const handleRecordBulkBatchOutreach = async (leadIds: string[], batchIndex: number) => {
    try {
      const res = await recordNexusOutreachEvent(adminEmail, {
        leadIds,
        mode: 'bulk_bcc_gmail',
        subject: bulkSubject,
        templateType: bulkTemplate,
        note: `Opened via OPEN GMAIL – BULK CONTACT (BCC Batch ${batchIndex})`,
      });
      setBannerMessage({
        type: 'success',
        text: `Recorded BCC Batch #${batchIndex} outreach for ${res.recordedCount} leads (${res.skippedSuppressedCount} suppressed skipped).`,
      });
      await loadDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err?.message || 'Failed to record batch outreach.' });
    }
  };

  const leads = data?.leads || [];
  const stats = data?.stats;
  const suppressionList = data?.suppressionList || [];
  const sources = data?.sources || [];
  const runLogs = data?.runLogs || [];
  const schedulerInfo = data?.schedulerInfo;

  const selectedLeads = useMemo(
    () => leads.filter((l) => selectedIds.has(l.id)),
    [leads, selectedIds]
  );

  const bulkPlan = useMemo(
    () =>
      buildBulkBccGmailBatches({
        leads: selectedLeads,
        subject: bulkSubject,
        body: bulkBody,
        suppressionList,
        maxPerBatch: NEXUS_GMAIL_MAX_BCC_PER_BATCH,
        allowAlreadyContacted: allowAlreadyContactedInBulk,
      }),
    [selectedLeads, bulkSubject, bulkBody, suppressionList, allowAlreadyContactedInBulk]
  );

  const toggleSelectLead = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (leads.length === 0) return;
    const allSelected = leads.every((l) => selectedIds.has(l.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  const handleDownloadCsv = (targetLeads: NexusClientLead[], fileNameSuffix: string) => {
    if (targetLeads.length === 0) return;
    const csv = buildSelectedLeadsCsv(targetLeads, bulkTemplate);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-it-solutions-leads-${fileNameSuffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupEmail.trim() && !newSupDomain.trim()) return;
    try {
      await addNexusSuppressionEntry(adminEmail, {
        email: newSupEmail.trim() || undefined,
        domain: newSupDomain.trim() || undefined,
        reason: newSupReason.trim() || 'Added manually by Admin',
      });
      setNewSupEmail('');
      setNewSupDomain('');
      setNewSupReason('');
      setBannerMessage({ type: 'success', text: 'Added to Permanent Suppression List.' });
      await loadDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err?.message || 'Failed to add suppression entry.' });
    }
  };

  const handleRemoveSuppression = async (id: string) => {
    try {
      await removeNexusSuppressionEntry(adminEmail, id);
      setBannerMessage({ type: 'info', text: 'Removed entry from Suppression List.' });
      await loadDashboard();
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err?.message || 'Failed to remove suppression entry.' });
    }
  };

  const countryOptions = useMemo(() => {
    const list = stats?.byCountry?.map((c) => c.country) || [];
    return Array.from(new Set(list));
  }, [stats]);

  const singleGmailHref = useMemo(() => {
    if (!singleModalLead || !singleModalLead.publicEmail) return null;
    return buildSingleClientGmailComposeUrl({
      recipientEmail: singleModalLead.publicEmail,
      subject: singleSubject,
      body: singleBody,
    });
  }, [singleModalLead, singleSubject, singleBody]);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Admin Workspace Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Admin / Developer Private Module • Isolated from Public HopelandJobs</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Global Client Finder — NEXUS IT SOLUTIONS
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Discovers real individuals &amp; companies worldwide (GCC, Europe, USA, Canada, Australia) looking for
              website development, e-commerce, WordPress, redesign, and web applications using 100% free public
              sources and a strict 72-hour freshness window.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleRunFreeDiscovery}
              disabled={isRunningDiscovery}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRunningDiscovery ? 'animate-spin' : ''}`} />
              <span>{isRunningDiscovery ? 'Scanning Free Sources...' : 'Run Free Live Discovery'}</span>
            </button>

            <button
              type="button"
              onClick={handleRecheckActive}
              disabled={isRechecking}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              <Clock className="w-4 h-4" />
              <span>{isRechecking ? 'Rechecking...' : 'Recheck 72h Active'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadCsv(selectedLeads.length > 0 ? selectedLeads : leads, selectedLeads.length > 0 ? 'selected' : 'active')}
              disabled={leads.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV ({selectedLeads.length > 0 ? selectedLeads.length : leads.length})</span>
            </button>
          </div>
        </div>

        {/* Scheduler & Policy Strip */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span>
              <strong className="text-slate-800">Freshness Window:</strong> Strict &le; 72 hours
            </span>
            <span>
              <strong className="text-slate-800">Daily Target Ceiling:</strong> Up to {stats?.dailyTarget ?? 300}/day
              (real leads only — never fabricated)
            </span>
            <span>
              <strong className="text-slate-800">Cost Policy:</strong> 100% Free Public Sources Only
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
            <span>
              Auto-Scheduler: <strong className="text-slate-800">{schedulerInfo?.enabled ? `Every ${schedulerInfo.intervalHours}h` : 'Manual'}</strong>
            </span>
            <span>
              Last Run: <strong className="text-slate-800">{formatUtcTimestamp(schedulerInfo?.lastRunAt)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMessage && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
            bannerMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : bannerMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-current opacity-70 hover:opacity-100"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Discovered Today</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {stats?.discoveredTodayCount ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">of {stats?.dailyTarget ?? 300} target</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active (&le;72h)</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {stats?.totalActiveLeads ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {stats?.verifiedCount ?? 0} verified • {stats?.partiallyVerifiedCount ?? 0} partial
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Rejected / Expired</div>
          <div className="mt-1.5 text-2xl font-bold text-rose-700 tabular-nums">
            {(stats?.rejectedCount ?? 0) + (stats?.expiredCount ?? 0)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {stats?.expiredCount ?? 0} expired &gt;72h
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Business Emails</div>
          <div className="mt-1.5 text-2xl font-bold text-emerald-700 tabular-nums">
            {stats?.availableBusinessEmailsCount ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {stats?.verifiedBusinessEmailsCount ?? 0} MX/domain verified
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Personal Emails</div>
          <div className="mt-1.5 text-2xl font-bold text-amber-700 tabular-nums">
            {stats?.personalEmailsCount ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Verify consent first</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">New / Awaiting</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {stats?.awaitingContactCount ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {stats?.newOpportunitiesCount ?? 0} brand new
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Contacted / DNC</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {stats?.alreadyContactedCount ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {stats?.suppressedCount ?? 0} permanently blocked
          </div>
        </div>
      </div>

      {/* Sub-Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {(
          [
            { id: 'leads', label: `Live Opportunities (${leads.length})` },
            { id: 'analytics', label: 'Breakdown by Country, Category & Date' },
            { id: 'sources', label: `Free Public Sources & Run Logs (${sources.length})` },
            { id: 'suppression', label: `Permanent Suppression List (${suppressionList.length})` },
          ] as Array<{ id: SubView; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubView(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              subView === tab.id
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================= */}
      {/* TAB 1: LIVE OPPORTUNITIES LIST + FILTERS + GMAIL WORKFLOW         */}
      {/* ================================================================= */}
      {subView === 'leads' && (
        <div className="space-y-4">
          {/* Search & Filters Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title, advertiser, email, country, WordPress, Shopify, redesign..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                />
              </div>

              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value="all">All Countries / Markets</option>
                {countryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value="all">All 10 Opportunity Categories</option>
                {CATEGORY_OPTIONS.map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
              <select
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value="all">All Email Classifications</option>
                <option value="verified_business_email">Verified Business Email</option>
                <option value="unverified_business_email">Unverified Business Email</option>
                <option value="personal_email">Personal Email (Verify Consent)</option>
                <option value="no_public_email">No Public Email Found</option>
              </select>

              <select
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value="all">All Verification States</option>
                <option value="verified">Verified</option>
                <option value="partially_verified">Partially Verified</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired (&gt;72h)</option>
              </select>

              <select
                value={contactStatusFilter}
                onChange={(e) => setContactStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value="all">All Contact Statuses</option>
                {CONTACT_STATUS_OPTIONS.map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value="newest">Sort: Newest Published</option>
                <option value="oldest">Sort: Oldest Published</option>
                <option value="verified_email_first">Sort: Verified Business Email First</option>
                <option value="country">Sort: Country (A–Z)</option>
              </select>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeExpired}
                  onChange={(e) => setIncludeExpired(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Include expired (&gt;72h)</span>
              </label>
            </div>
          </div>

          {/* Selection & Bulk Actions Bar */}
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leads.length > 0 && leads.every((l) => selectedIds.has(l.id))}
                  onChange={toggleSelectAllVisible}
                  className="rounded border-slate-300"
                />
                <span>Select All Visible ({leads.length})</span>
              </label>
              {selectedIds.size > 0 && (
                <span className="text-xs font-semibold text-slate-600 tabular-nums">
                  {selectedIds.size} selected
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkModalTab('bcc');
                      setIsBulkModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs sm:text-sm font-bold tracking-wide hover:bg-emerald-800 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span>OPEN GMAIL – BULK CONTACT ({selectedIds.size})</span>
                  </button>

                  <div className="inline-flex items-center gap-1.5">
                    <select
                      value={bulkStatusTarget}
                      onChange={(e) => setBulkStatusTarget(e.target.value as NexusContactStatus)}
                      className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
                    >
                      {CONTACT_STATUS_OPTIONS.map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleBulkStatusApply}
                      className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                    >
                      Apply Status
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Empty / Loading / Lead Cards */}
          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Loading verified international opportunities...
            </div>
          ) : leads.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-base font-bold text-slate-900">
                No matching fresh (&le;72h) client leads currently loaded
              </div>
              <p className="text-sm text-slate-600 max-w-xl mx-auto">
                This system never displays sample or fabricated leads. Click{' '}
                <strong>Run Free Live Discovery</strong> above to scan the 8 verified 100% free public
                international sources right now, or adjust your active filters.
              </p>
              <button
                type="button"
                onClick={handleRunFreeDiscovery}
                disabled={isRunningDiscovery}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
              >
                <RefreshCw className={`w-4 h-4 ${isRunningDiscovery ? 'animate-spin' : ''}`} />
                <span>Run Free Live Discovery Now</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {leads.map((lead) => {
                const isSelected = selectedIds.has(lead.id);
                const safeSourceHref = getSafeExternalHref(lead.originalSourceUrl);
                const safeSiteHref = getSafeExternalHref(lead.officialWebsiteUrl);

                return (
                  <div
                    key={lead.id}
                    className={`bg-white border rounded-xl p-4 sm:p-5 transition-colors ${
                      lead.suppressed
                        ? 'border-rose-200 bg-rose-50/20'
                        : isSelected
                        ? 'border-slate-900 ring-1 ring-slate-900/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Left Content */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectLead(lead.id)}
                          aria-label={`Select ${lead.title}`}
                          className="mt-1 rounded border-slate-300"
                        />

                        <div className="min-w-0 flex-1 space-y-2">
                          {/* Metadata Strip */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded border font-semibold ${verificationBadgeClass(
                                lead.verificationStatus
                              )}`}
                            >
                              {lead.verificationStatus.replace('_', ' ').toUpperCase()}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded border font-semibold ${emailBadgeClass(
                                lead.emailClassification
                              )}`}
                            >
                              {NEXUS_EMAIL_CLASSIFICATION_LABELS[lead.emailClassification]}
                            </span>
                            <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700 font-medium">
                              {lead.categoryLabel}
                            </span>
                            <span className="text-slate-500 tabular-nums">
                              Published {formatHoursAgo(lead.publishedAt)} ({formatUtcTimestamp(lead.publishedAt)})
                            </span>
                            {lead.suppressed && (
                              <span className="px-2 py-0.5 rounded border border-rose-300 bg-rose-100 text-rose-800 font-bold">
                                SUPPRESSED / DO NOT CONTACT
                              </span>
                            )}
                            {lead.contactCount > 0 && (
                              <span className="px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-800 font-semibold tabular-nums">
                                Contacted {lead.contactCount}x
                              </span>
                            )}
                          </div>

                          {/* Title & Advertiser */}
                          <div>
                            <h3 className="text-base font-bold text-slate-900 leading-snug">{lead.title}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                              <span>
                                <strong className="text-slate-800">Advertiser:</strong> {lead.advertiserName} (
                                {lead.advertiserType})
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Globe className="w-3.5 h-3.5 text-slate-400" />
                                <strong className="text-slate-800">{lead.country}</strong>
                                {lead.city && lead.city !== 'Not specified' && lead.city !== 'Remote / Not specified'
                                  ? ` — ${lead.city}`
                                  : ''}
                              </span>
                              <span>
                                <strong className="text-slate-800">Source:</strong> {lead.sourceName}
                              </span>
                              {lead.estimatedBudget && (
                                <span className="text-emerald-800 font-semibold">
                                  Advertised Budget: {lead.estimatedBudget}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Ad Excerpt */}
                          {lead.originalAdText && (
                            <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
                              {lead.originalAdText}
                            </p>
                          )}

                          {/* Requirements */}
                          {lead.projectRequirements.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {lead.projectRequirements.map((req) => (
                                <span
                                  key={req}
                                  className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 rounded border border-slate-200"
                                >
                                  {req}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Real Verified Contact Details Row */}
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-500" />
                              {lead.publicEmail ? (
                                <span className="font-mono font-semibold text-slate-900">
                                  {lead.publicEmail}
                                  {lead.emailMxVerified ? ' (DNS MX Verified)' : ''}
                                </span>
                              ) : (
                                <span className="text-slate-500">
                                  No Public Email Found — contact directly on source platform
                                </span>
                              )}
                            </span>

                            {lead.publicPhone && (
                              <span className="inline-flex items-center gap-1 text-slate-800 font-mono">
                                <Phone className="w-3.5 h-3.5 text-slate-500" />
                                {lead.publicPhone}
                              </span>
                            )}

                            {safeSiteHref && (
                              <a
                                href={safeSiteHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sky-700 hover:underline font-medium"
                              >
                                <Globe className="w-3.5 h-3.5" />
                                <span>Company Website</span>
                              </a>
                            )}

                            {safeSourceHref && (
                              <a
                                href={safeSourceHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-950 hover:underline font-semibold"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Original Advertisement</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Actions Column */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2 shrink-0 lg:w-64">
                        <button
                          type="button"
                          onClick={() => openSingleGmailModal(lead)}
                          disabled={lead.suppressed}
                          className={`inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-colors w-full ${
                            lead.suppressed
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>OPEN GMAIL – SINGLE CLIENT</span>
                        </button>

                        <select
                          value={lead.contactStatus}
                          onChange={(e) =>
                            handleLeadStatusChange(lead.id, e.target.value as NexusContactStatus)
                          }
                          aria-label={`Contact status for ${lead.title}`}
                          className="w-full px-2.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800"
                        >
                          {CONTACT_STATUS_OPTIONS.map(([val, label]) => (
                            <option key={val} value={val}>
                              Status: {label}
                            </option>
                          ))}
                        </select>

                        {lead.verificationNotes && (
                          <div className="text-[11px] text-slate-500 leading-snug lg:text-right">
                            {lead.verificationNotes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: ANALYTICS & BREAKDOWNS                                     */}
      {/* ================================================================= */}
      {subView === 'analytics' && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              Active Opportunities by Country
            </h3>
            {stats.byCountry.length === 0 ? (
              <p className="text-sm text-slate-500">No active country data yet. Run discovery first.</p>
            ) : (
              <div className="space-y-2">
                {stats.byCountry.map((row) => (
                  <div key={row.country} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-700 font-medium">{row.country}</span>
                    <span className="font-bold text-slate-900 tabular-nums">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              Active Opportunities by Category (10)
            </h3>
            <div className="space-y-2">
              {stats.byCategory.map((row) => (
                <div key={row.category} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                  <span className="text-slate-700">{row.label}</span>
                  <span className="font-bold text-slate-900 tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              By Publication Date (UTC)
            </h3>
            {stats.byPublicationDate.length === 0 ? (
              <p className="text-sm text-slate-500">No dated leads yet.</p>
            ) : (
              <div className="space-y-2">
                {stats.byPublicationDate.map((row) => (
                  <div key={row.date} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                    <span className="font-mono text-slate-700">{row.date}</span>
                    <span className="font-bold text-slate-900 tabular-nums">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: FREE PUBLIC SOURCES & RUN LOGS                             */}
      {/* ================================================================= */}
      {subView === 'sources' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Connected 100% Free Public Sources ({sources.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Zero paid search APIs, zero paid lead databases, zero scraping subscriptions. Robots.txt and public
                rate limits respected automatically.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Source</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Scanned</th>
                    <th className="px-4 py-3 font-semibold text-right">Accepted (&le;72h)</th>
                    <th className="px-4 py-3 font-semibold">Last Checked</th>
                    <th className="px-4 py-3 font-semibold">Diagnostics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sources.map((src) => (
                    <tr key={src.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-900">{src.name}</td>
                      <td className="px-4 py-3 text-slate-600">{src.sourceType.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded border font-semibold uppercase ${
                            src.status === 'connected'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : src.status === 'degraded'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : src.status === 'error'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {src.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{src.lastCandidatesFound}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">
                        {src.lastAcceptedCount}
                      </td>
                      <td className="px-4 py-3 text-slate-600 tabular-nums">{formatUtcTimestamp(src.lastCheckedAt)}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                        {src.lastError ? <span className="text-rose-700">{src.lastError}</span> : src.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Discovery Audit Logs (Honest Actual Counts)
              </h3>
            </div>
            {runLogs.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No discovery runs recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Timestamp</th>
                      <th className="px-4 py-3 font-semibold">Trigger</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Scanned</th>
                      <th className="px-4 py-3 font-semibold text-right">Accepted (&le;72h)</th>
                      <th className="px-4 py-3 font-semibold text-right">Rejected (&gt;72h)</th>
                      <th className="px-4 py-3 font-semibold text-right">Irrelevant</th>
                      <th className="px-4 py-3 font-semibold text-right">Duplicates</th>
                      <th className="px-4 py-3 font-semibold text-right">Biz Emails</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {runLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3 text-slate-700">{formatUtcTimestamp(log.finishedAt)}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{log.trigger}</td>
                        <td className="px-4 py-3 uppercase font-semibold">{log.status}</td>
                        <td className="px-4 py-3 text-right">{log.rawCandidatesScanned}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">
                          {log.acceptedWithin72hCount}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-700">{log.rejectedExpiredOrOver72hCount}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{log.rejectedIrrelevantOrFakeCount}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{log.duplicatesSkippedCount}</td>
                        <td className="px-4 py-3 text-right font-semibold">{log.businessEmailsFoundCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 4: PERMANENT SUPPRESSION LIST                                 */}
      {/* ================================================================= */}
      {subView === 'suppression' && (
        <div className="space-y-4">
          <form
            onSubmit={handleAddSuppression}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Ban className="w-4 h-4 text-rose-600" />
              <span>Add to Permanent Do-Not-Contact Suppression List</span>
            </div>
            <p className="text-xs text-slate-600">
              Any email address or corporate domain added here (or any lead marked &ldquo;Do not contact&rdquo;) is
              permanently excluded from Single-Client and Bulk BCC Gmail outreach.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="email"
                value={newSupEmail}
                onChange={(e) => setNewSupEmail(e.target.value)}
                placeholder="Email (e.g. info@company.com)"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                value={newSupDomain}
                onChange={(e) => setNewSupDomain(e.target.value)}
                placeholder="Or Company Domain (e.g. company.com)"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                value={newSupReason}
                onChange={(e) => setNewSupReason(e.target.value)}
                placeholder="Reason (e.g. Opted out)"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-rose-700 text-white text-sm font-semibold hover:bg-rose-800"
              >
                Block Permanently
              </button>
            </div>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 text-sm font-bold text-slate-900">
              Active Suppression Rules ({suppressionList.length})
            </div>
            {suppressionList.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No emails or domains suppressed yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {suppressionList.map((entry) => (
                  <div key={entry.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                    <div>
                      <div className="font-mono font-semibold text-slate-900">
                        {entry.email || `@${entry.domain}`}
                        {entry.email && entry.domain ? ` (domain: ${entry.domain})` : ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        {entry.reason} • Added {formatUtcTimestamp(entry.addedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSuppression(entry.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SINGLE-CLIENT GMAIL COMPOSE & AI MESSAGE ASSISTANT MODAL          */}
      {/* ================================================================= */}
      {singleModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  NEXUS IT SOLUTIONS — AI Message Assistant &amp; Gmail Compose
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{singleModalLead.title}</h3>
                <div className="text-xs text-slate-600 mt-1">
                  {singleModalLead.advertiserName} • {singleModalLead.country} •{' '}
                  <span className="font-mono font-semibold">
                    {singleModalLead.publicEmail || 'No Public Email Found'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSingleModalLead(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Compliance & Duplicate Outreach Alerts */}
              {singleModalLead.contactCount > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Duplicate Outreach Guard:</strong> This lead was already contacted{' '}
                    {singleModalLead.contactCount} time(s) (last:{' '}
                    {formatUtcTimestamp(singleModalLead.lastContactedAt)}). Switch to the Follow-Up template if you
                    intend to follow up.
                  </span>
                </div>
              )}

              <div
                className={`rounded-lg border px-3.5 py-2.5 text-xs ${
                  singleModalLead.emailClassification === 'personal_email'
                    ? 'bg-orange-50 border-orange-200 text-orange-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {singlePrivacyNotice}
              </div>

              {/* Template Selector + Optional AI Polish */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {TEMPLATE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleSingleTemplateChange(t.value)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        singleTemplate === t.value
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handlePolishSingleDraft}
                  disabled={isPolishingDraft}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isPolishingDraft ? 'Tailoring...' : 'Tailor to Ad Details'}</span>
                </button>
              </div>

              {/* Editable Subject & Body */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Subject (Editable)
                  </label>
                  <input
                    type="text"
                    value={singleSubject}
                    onChange={(e) => setSingleSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Proposal Message Body (Editable • Grounded in Real Ad • Generated by {singleGeneratedBy})
                  </label>
                  <textarea
                    rows={9}
                    value={singleBody}
                    onChange={(e) => setSingleBody(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-sans leading-relaxed"
                  />
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {singleGmailHref ? (
                    <a
                      href={singleGmailHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        handleRecordSingleOutreach(singleModalLead);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 text-white text-xs sm:text-sm font-bold tracking-wide hover:bg-emerald-800"
                    >
                      <Mail className="w-4 h-4" />
                      <span>OPEN GMAIL – SINGLE CLIENT</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <div className="text-xs text-slate-600 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg">
                      <strong>No Public Email Found</strong> (never invented). Copy this proposal and reply via the{' '}
                      {getSafeExternalHref(singleModalLead.originalSourceUrl) && (
                        <a
                          href={getSafeExternalHref(singleModalLead.originalSourceUrl)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-700 font-semibold underline"
                        >
                          Original Source Link
                        </a>
                      )}
                      .
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(`Subject: ${singleSubject}\n\n${singleBody}`);
                      setCopiedSingle(true);
                      setTimeout(() => setCopiedSingle(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedSingle ? 'Copied!' : 'Copy Draft'}</span>
                  </button>
                </div>

                <span className="text-[11px] text-slate-500">
                  Opens Gmail Compose for manual review — never sends automatically.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* BULK GMAIL CONTACT (BCC BATCHES + INDIVIDUAL QUEUE + CSV EXPORT)  */}
      {/* ================================================================= */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Privacy-Safe BCC Only • Zero Auto-Send • Never Drops Selected Leads Silently
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  OPEN GMAIL – BULK CONTACT ({selectedLeads.length} Leads Selected)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Transparent Selection Accounting */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-emerald-800 font-semibold">Eligible (BCC)</div>
                  <div className="text-xl font-bold text-emerald-900 tabular-nums mt-0.5">
                    {bulkPlan.includedCount}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-slate-600 font-semibold">Excluded: No Email</div>
                  <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                    {bulkPlan.excludedNoEmail.length}
                  </div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <div className="text-rose-800 font-semibold">Blocked: Suppressed</div>
                  <div className="text-xl font-bold text-rose-900 tabular-nums mt-0.5">
                    {bulkPlan.excludedSuppressed.length}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="text-amber-800 font-semibold">Already Contacted</div>
                  <div className="text-xl font-bold text-amber-900 tabular-nums mt-0.5">
                    {bulkPlan.excludedAlreadyContacted.length}
                  </div>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAlreadyContactedInBulk}
                  onChange={(e) => setAllowAlreadyContactedInBulk(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Include already-contacted leads (for follow-up campaigns only)</span>
              </label>

              {/* Mode Switch Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => setBulkModalTab('bcc')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    bulkModalTab === 'bcc'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-300 text-slate-700'
                  }`}
                >
                  1. BCC Batches ({bulkPlan.batches.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBulkModalTab('individual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    bulkModalTab === 'individual'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-300 text-slate-700'
                  }`}
                >
                  2. Individual Personalized Queue ({bulkPlan.includedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setBulkModalTab('csv')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    bulkModalTab === 'csv'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-300 text-slate-700'
                  }`}
                >
                  3. CSV Export (Gmail Mail Merge)
                </button>
              </div>

              {bulkModalTab === 'bcc' && (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {TEMPLATE_OPTIONS.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setBulkTemplate(t.value)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                            bulkTemplate === t.value
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={bulkSubject}
                      onChange={(e) => setBulkSubject(e.target.value)}
                      placeholder="Bulk Email Subject"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <textarea
                      rows={5}
                      value={bulkBody}
                      onChange={(e) => setBulkBody(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  {bulkPlan.batches.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      None of the currently selected leads have an eligible public email address. Use the{' '}
                      <strong>Original Advertisement</strong> link on listings without public emails, or select leads
                      filtered by <em>Verified Business Email</em>.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {bulkPlan.batches.map((batch) => (
                        <div
                          key={batch.batchIndex}
                          className="rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900">
                              BCC Batch {batch.batchIndex} of {batch.totalBatches} ({batch.bccList.length} recipients
                              — max {NEXUS_GMAIL_MAX_BCC_PER_BATCH}/batch)
                            </div>
                            <div className="text-xs font-mono text-slate-600 mt-1 break-all">
                              BCC: {batch.bccList.join(', ')}
                            </div>
                          </div>

                          <a
                            href={batch.gmailComposeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              handleRecordBulkBatchOutreach(
                                batch.recipients.map((r) => r.leadId),
                                batch.batchIndex
                              )
                            }
                            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold shrink-0 hover:bg-emerald-800"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>OPEN GMAIL – BATCH {batch.batchIndex} (BCC)</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {bulkModalTab === 'individual' && (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {bulkPlan.batches.flatMap((b) => b.recipients).length === 0 ? (
                    <p className="text-sm text-slate-500">No eligible recipients with public email addresses.</p>
                  ) : (
                    bulkPlan.batches
                      .flatMap((b) => b.recipients)
                      .map((rec) => {
                        const lead = selectedLeads.find((l) => l.id === rec.leadId);
                        if (!lead) return null;
                        const draft = generateNexusProposalMessage(lead, defaultTemplateForCategory(lead.category));
                        const url = buildSingleClientGmailComposeUrl({
                          recipientEmail: rec.email,
                          subject: draft.subject,
                          body: draft.body,
                        });
                        return (
                          <div
                            key={rec.leadId}
                            className="rounded-lg border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900 truncate">{lead.title}</div>
                              <div className="text-xs text-slate-600">
                                {lead.advertiserName} • <span className="font-mono">{rec.email}</span>
                              </div>
                            </div>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() =>
                                recordNexusOutreachEvent(adminEmail, {
                                  leadIds: [lead.id],
                                  mode: 'individual_personalized',
                                  subject: draft.subject,
                                  templateType: draft.templateType,
                                  note: 'Opened via Individual Personalized Queue',
                                }).then(() => loadDashboard())
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold shrink-0 hover:bg-slate-800"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>OPEN GMAIL – 1-TO-1</span>
                            </a>
                          </div>
                        );
                      })
                  )}
                </div>
              )}

              {bulkModalTab === 'csv' && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-3">
                  <div className="text-sm font-bold text-slate-900">
                    Export Selected Leads for Gmail Mail Merge / Google Sheets
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Downloads a clean RFC-4180 CSV containing every selected lead&apos;s verified public email,
                    email classification, country, category, budget (if advertised), tailored subject line,
                    personalized Nexus IT Solutions message, and original advertisement URL.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDownloadCsv(selectedLeads, 'mail-merge')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download CSV ({selectedLeads.length} Selected Leads)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
