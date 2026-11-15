import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  EyeOff,
  Globe,
  GraduationCap,
  History,
  Landmark,
  Link2,
  Lock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  DeveloperNotificationItem,
  ExperienceScholarship,
  ImmigrationPathway,
  INTERNATIONAL_JOB_CATEGORIES,
  InternationalJob,
  InternationalRegion,
  MonitoredSourceRecord,
  OFFICIAL_NOT_STATED,
  PrivateApprovalStatus,
  RESEARCH_REGIONS,
  ResearchHistoryRun,
  SchedulerStatusState,
  VerificationReportItem,
} from '../../types/international';
import { SiteSettings, Vacancy } from '../../types/job';
import { ADMIN_EMAILS, getActiveAdminSessionEmail, safeResponseJson } from '../../lib/firebase';

interface SyncedInternationalPayload {
  internationalJobs?: InternationalJob[];
  immigrationPathways?: ImmigrationPathway[];
  experienceScholarships?: ExperienceScholarship[];
  researchHistory?: ResearchHistoryRun[];
  verificationLogs?: VerificationReportItem[];
}

interface Props {
  adminEmail?: string | null;
  internationalJobs: InternationalJob[];
  immigrationPathways: ImmigrationPathway[];
  scholarships: ExperienceScholarship[];
  domesticVacancies: Vacancy[];
  researchHistory: ResearchHistoryRun[];
  verificationLogs: VerificationReportItem[];
  siteSettings: SiteSettings;
  onSaveInternationalJobs: (jobs: InternationalJob[]) => Promise<void>;
  onDeleteInternationalJob: (id: string) => Promise<void>;
  onSaveImmigrationPathways: (pathways: ImmigrationPathway[]) => Promise<void>;
  onDeleteImmigrationPathway: (id: string) => Promise<void>;
  onSaveScholarships: (scholarships: ExperienceScholarship[]) => Promise<void>;
  onDeleteScholarship: (id: string) => Promise<void>;
  onSaveResearchRun: (run: ResearchHistoryRun) => Promise<void>;
  onSaveVerificationLogs: (logs: VerificationReportItem[]) => Promise<void>;
  onSaveSiteSettings: (settings: SiteSettings) => Promise<void>;
  onUpdateDomesticVacancyStatus?: (id: string, status: Vacancy['status']) => Promise<void>;
  onSyncInternationalState?: (data: SyncedInternationalPayload) => void;
}

export const InternationalControlCenter: React.FC<Props> = ({
  adminEmail,
  internationalJobs,
  immigrationPathways,
  scholarships,
  domesticVacancies,
  researchHistory,
  verificationLogs,
  siteSettings,
  onSaveInternationalJobs,
  onDeleteInternationalJob,
  onSaveImmigrationPathways,
  onDeleteImmigrationPathway,
  onSaveScholarships,
  onDeleteScholarship,
  onSaveResearchRun,
  onSaveVerificationLogs,
  onSaveSiteSettings,
  onSyncInternationalState,
}) => {
  const effectiveOwnerEmail = (adminEmail || getActiveAdminSessionEmail() || '').trim().toLowerCase();
  const isAuthorizedOwner = Boolean(
    effectiveOwnerEmail && ADMIN_EMAILS.some((e) => e.toLowerCase().trim() === effectiveOwnerEmail)
  );

  const ownerHeaders = useCallback(
    (): Record<string, string> => ({
      'Content-Type': 'application/json',
      'x-admin-email': effectiveOwnerEmail,
    }),
    [effectiveOwnerEmail]
  );

  const [subTab, setSubTab] = useState<
    'runner' | 'approval' | 'sources' | 'jobs' | 'immigration' | 'scholarships' | 'logs'
  >('runner');

  // Research Control State
  const [selectedRegion, setSelectedRegion] = useState<InternationalRegion>('Europe');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([
    'Germany',
    'Finland',
    'Estonia',
    'Poland',
    'Latvia',
  ]);
  const [customCountryInput, setCustomCountryInput] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Banking & Finance',
    'NGO & International Organizations',
    'Government Approved Foreign Recruitment',
  ]);
  const [scholarshipStudyLevel, setScholarshipStudyLevel] =
    useState<ExperienceScholarship['studyLevel']>('Postgraduate / Master');

  // System 2 Autonomous Scheduler, Source Registry & Private Alerts State
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatusState | null>(null);
  const [monitoredSources, setMonitoredSources] = useState<MonitoredSourceRecord[]>([]);
  const [developerNotifications, setDeveloperNotifications] = useState<DeveloperNotificationItem[]>([]);
  const lastCycleCountRef = useRef<number>(-1);

  // Approval Queue Filter
  const [approvalFilter, setApprovalFilter] = useState<PrivateApprovalStatus | 'all'>('private_pending');

  // Add Official Source Form
  const [newSourceForm, setNewSourceForm] = useState<{
    name: string;
    country: string;
    region: InternationalRegion;
    entityType: 'international_job' | 'immigration' | 'scholarship';
    feedType: 'rss_atom' | 'official_api' | 'http_poll';
    url: string;
  }>({
    name: '',
    country: '',
    region: 'Europe',
    entityType: 'international_job',
    feedType: 'http_poll',
    url: '',
  });

  // Loading & Feedback
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Manual Entry Modal
  const [manualModalType, setManualModalType] = useState<'job' | 'immigration' | 'scholarship' | null>(null);
  const [manualForm, setManualForm] = useState<Record<string, any>>({});

  const refreshPrivateState = useCallback(async () => {
    if (!isAuthorizedOwner) return;
    try {
      const res = await fetch('/api/international/private-state', {
        headers: { 'x-admin-email': effectiveOwnerEmail },
      });
      const data = await safeResponseJson<any>(res);
      if (res.ok && data) {
        if (data.schedulerStatus) {
          setSchedulerStatus(data.schedulerStatus);
          lastCycleCountRef.current = Number(data.schedulerStatus.cycleCount ?? 0);
        }
        if (Array.isArray(data.monitoredSources)) setMonitoredSources(data.monitoredSources);
        if (Array.isArray(data.developerNotifications)) setDeveloperNotifications(data.developerNotifications);
        onSyncInternationalState?.({
          internationalJobs: data.internationalJobs,
          immigrationPathways: data.immigrationPathways,
          experienceScholarships: data.experienceScholarships,
          researchHistory: data.researchHistory,
          verificationLogs: data.verificationLogs,
        });
      }
    } catch (err) {
      console.warn('Private research state sync notice:', err);
    }
  }, [effectiveOwnerEmail, isAuthorizedOwner, onSyncInternationalState]);

  useEffect(() => {
    if (!isAuthorizedOwner) return;
    refreshPrivateState();

    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch('/api/international/scheduler/status', {
          headers: { 'x-admin-email': effectiveOwnerEmail },
        });
        const data = await safeResponseJson<{ success?: boolean; schedulerStatus?: SchedulerStatusState }>(res);
        if (res.ok && data?.schedulerStatus) {
          setSchedulerStatus(data.schedulerStatus);
          const nextCycle = Number(data.schedulerStatus.cycleCount ?? 0);
          if (lastCycleCountRef.current >= 0 && nextCycle > lastCycleCountRef.current) {
            lastCycleCountRef.current = nextCycle;
            await refreshPrivateState();
          } else {
            lastCycleCountRef.current = nextCycle;
          }
        }
      } catch {
        // Ignore transient polling hiccup
      }
    }, 5000);

    return () => clearInterval(pollTimer);
  }, [effectiveOwnerEmail, isAuthorizedOwner, refreshPrivateState]);

  // 8 Mandatory Live Statistics
  const kpis = useMemo(() => {
    const countriesSet = new Set<string>([
      ...internationalJobs.map((j) => j.country),
      ...immigrationPathways.map((p) => p.country),
      ...scholarships.map((s) => s.country),
    ]);
    const verifiedJobs = internationalJobs.filter((j) => j.verificationStatus === 'VERIFIED');
    const visaSponsoredCount = verifiedJobs.filter((j) => j.visaSponsored).length;
    const verifiedPRCount = immigrationPathways.filter((p) => p.verificationStatus === 'VERIFIED').length;
    const verifiedSchCount = scholarships.filter((s) => s.verificationStatus === 'VERIFIED').length;
    const currentlyOpenCount =
      verifiedJobs.filter((j) => j.applicationStatus === 'open').length +
      verifiedSchCount +
      domesticVacancies.filter((v) => v.status === 'published').length;
    const expiredCount =
      internationalJobs.filter((j) => j.verificationStatus === 'EXPIRED' || j.applicationStatus === 'expired').length +
      scholarships.filter((s) => s.verificationStatus === 'EXPIRED' || s.applicationStatus === 'expired').length +
      domesticVacancies.filter((v) => v.status === 'expired').length;
    const rejectedCount =
      internationalJobs.filter((j) => ['REJECTED_SUSPICIOUS', 'SUSPENDED_BROKEN_LINK', 'UNVERIFIED'].includes(j.verificationStatus)).length +
      immigrationPathways.filter((p) => ['REJECTED_SUSPICIOUS', 'SUSPENDED_BROKEN_LINK', 'UNVERIFIED'].includes(p.verificationStatus)).length +
      scholarships.filter((s) => ['REJECTED_SUSPICIOUS', 'SUSPENDED_BROKEN_LINK', 'UNVERIFIED'].includes(s.verificationStatus)).length;

    return {
      countriesResearched: countriesSet.size,
      genuineJobs: verifiedJobs.length,
      visaSponsored: visaSponsoredCount,
      prPathways: verifiedPRCount,
      scholarshipsCount: verifiedSchCount,
      currentlyOpen: currentlyOpenCount,
      expired: expiredCount,
      rejectedOrSuspicious: rejectedCount,
    };
  }, [internationalJobs, immigrationPathways, scholarships, domesticVacancies]);

  const approvalQueueItems = useMemo(() => {
    const normalizeApproval = (item: { approvalStatus?: PrivateApprovalStatus; verificationStatus?: string }): PrivateApprovalStatus => {
      if (item.approvalStatus) return item.approvalStatus;
      if (item.verificationStatus === 'EXPIRED') return 'expired';
      if (item.verificationStatus === 'VERIFIED') return 'approved_public';
      return 'private_pending';
    };

    const items = [
      ...internationalJobs.map((j) => ({
        entityType: 'international_job' as const,
        id: j.id,
        title: j.jobTitle,
        org: j.employerOrProgramme,
        country: j.country,
        region: j.region,
        url: j.directApplicationUrl || j.originalSourceUrl,
        verificationStatus: j.verificationStatus,
        approvalStatus: normalizeApproval(j),
        eligibilitySummary: j.foreignerAndEthiopianEligibility,
        requirementsSummary: `${j.requiredEducation} · Exp: ${j.requiredExperience}`,
        deadline: j.applicationDeadline,
        discoveredAt: j.discoveredAt || j.createdAt,
        verifiedAt: j.verifiedAt || j.lastVerifiedAt,
        aiAnalysisNotes: j.aiAnalysisNotes || j.verificationNotes,
        sourceName: j.sourceName || j.employerOrProgramme,
      })),
      ...immigrationPathways.map((p) => ({
        entityType: 'immigration' as const,
        id: p.id,
        title: p.pathwayTitle,
        org: p.pathwayType,
        country: p.country,
        region: p.region,
        url: p.officialGovernmentWebsite || p.originalSourceUrl,
        verificationStatus: p.verificationStatus,
        approvalStatus: normalizeApproval(p),
        eligibilitySummary: p.ethiopianEligibilityDetails,
        requirementsSummary: p.eligibilityRequirements,
        deadline: `PR Timeline: ${p.yearsToPermanentResidence}`,
        discoveredAt: p.discoveredAt || p.createdAt,
        verifiedAt: p.verifiedAt || p.lastVerifiedAt,
        aiAnalysisNotes: p.aiAnalysisNotes || p.verificationNotes,
        sourceName: p.sourceName || 'Official Government Portal',
      })),
      ...scholarships.map((s) => ({
        entityType: 'scholarship' as const,
        id: s.id,
        title: s.scholarshipName,
        org: s.universityOrInstitution,
        country: s.country,
        region: s.region,
        url: s.officialApplicationUrl || s.originalSourceUrl,
        verificationStatus: s.verificationStatus,
        approvalStatus: normalizeApproval(s),
        eligibilitySummary: s.eligibilityForEthiopians,
        requirementsSummary: s.academicRequirements,
        deadline: s.applicationDeadline,
        discoveredAt: s.discoveredAt || s.createdAt,
        verifiedAt: s.verifiedAt || s.lastVerifiedAt,
        aiAnalysisNotes: s.aiAnalysisNotes || s.verificationNotes,
        sourceName: s.sourceName || s.universityOrInstitution,
      })),
    ];

    items.sort((a, b) => new Date(b.discoveredAt || 0).getTime() - new Date(a.discoveredAt || 0).getTime());
    return items;
  }, [internationalJobs, immigrationPathways, scholarships]);

  const privatePendingCount = useMemo(
    () => approvalQueueItems.filter((item) => item.approvalStatus === 'private_pending').length,
    [approvalQueueItems]
  );

  const filteredApprovalItems = useMemo(
    () =>
      approvalFilter === 'all'
        ? approvalQueueItems
        : approvalQueueItems.filter((item) => item.approvalStatus === approvalFilter),
    [approvalQueueItems, approvalFilter]
  );

  const activeRegionPreset = useMemo(
    () => RESEARCH_REGIONS.find((r) => r.region === selectedRegion)?.countries || [],
    [selectedRegion]
  );

  const handleToggleCountry = (c: string) => {
    setSelectedCountries((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const handleAddCustomCountry = () => {
    const clean = customCountryInput.trim();
    if (!clean) return;
    if (!selectedCountries.includes(clean)) {
      setSelectedCountries((prev) => [...prev, clean]);
    }
    setCustomCountryInput('');
  };

  const handleToggleScheduler = async () => {
    const nextEnabled = !(schedulerStatus?.enabled ?? true);
    setBusyAction('scheduler_toggle');
    try {
      const res = await fetch('/api/international/scheduler/toggle', {
        method: 'POST',
        headers: ownerHeaders(),
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await safeResponseJson<{ success?: boolean; schedulerStatus?: SchedulerStatusState; error?: string }>(res);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to update scheduler state.');
      if (data.schedulerStatus) setSchedulerStatus(data.schedulerStatus);
      setFeedback({
        type: 'info',
        text: nextEnabled
          ? 'System 2 automatic 30-second background research scheduler resumed.'
          : 'System 2 automatic 30-second background research scheduler paused.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Scheduler toggle failed.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunSchedulerNow = async () => {
    setBusyAction('scheduler_run');
    setFeedback(null);
    try {
      const res = await fetch('/api/international/scheduler/run-now', {
        method: 'POST',
        headers: ownerHeaders(),
        body: JSON.stringify({}),
      });
      const data = await safeResponseJson<any>(res);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Immediate research cycle failed.');
      if (data.schedulerStatus) setSchedulerStatus(data.schedulerStatus);
      await refreshPrivateState();
      setFeedback({
        type: 'success',
        text: `Cycle #${data.cycleCount} completed: ${data.newlyDiscoveredCount ?? 0} new private_pending record(s) discovered.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Immediate scan failed.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSavePrivatePreferences = async () => {
    setBusyAction('save_controls');
    try {
      await onSaveSiteSettings({
        ...siteSettings,
        researchEnabledRegions: Array.from(new Set([...(siteSettings.researchEnabledRegions || []), selectedRegion])),
        researchEnabledCountries: selectedCountries,
        researchJobCategories: selectedCategories,
        updatedAt: new Date().toISOString(),
      });
      setFeedback({
        type: 'success',
        text: `Private System 2 target regions (${selectedRegion}) & countries saved independently of Telegram posting.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to save research preferences.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprovalAction = async (
    entityType: 'international_job' | 'immigration' | 'scholarship',
    id: string,
    action: 'approve_public' | 'keep_private' | 'reject' | 'mark_expired' | 'delete'
  ) => {
    setBusyAction(`approval_${id}`);
    try {
      const res = await fetch('/api/international/approval', {
        method: 'POST',
        headers: ownerHeaders(),
        body: JSON.stringify({ entityType, id, action }),
      });
      const data = await safeResponseJson<any>(res);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Approval update failed.');

      onSyncInternationalState?.({
        internationalJobs: data.internationalJobs,
        immigrationPathways: data.immigrationPathways,
        experienceScholarships: data.experienceScholarships,
      });

      if (action === 'delete') {
        if (entityType === 'international_job') await onDeleteInternationalJob(id);
        else if (entityType === 'immigration') await onDeleteImmigrationPathway(id);
        else await onDeleteScholarship(id);
      } else if (data.updatedRecord) {
        if (entityType === 'international_job') await onSaveInternationalJobs([data.updatedRecord]);
        else if (entityType === 'immigration') await onSaveImmigrationPathways([data.updatedRecord]);
        else await onSaveScholarships([data.updatedRecord]);
      }

      setFeedback({
        type: 'success',
        text:
          action === 'approve_public'
            ? 'Record approved and published to the public International pages.'
            : action === 'keep_private'
            ? 'Record moved back to private_pending (hidden from public).'
            : action === 'reject'
            ? 'Record rejected and hidden from public.'
            : action === 'mark_expired'
            ? 'Record marked as expired.'
            : 'Record permanently deleted.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Approval update failed.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddOfficialSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('add_source');
    setFeedback(null);
    try {
      const res = await fetch('/api/international/sources/add', {
        method: 'POST',
        headers: ownerHeaders(),
        body: JSON.stringify(newSourceForm),
      });
      const data = await safeResponseJson<any>(res);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to register official source.');
      }
      if (Array.isArray(data.monitoredSources)) {
        setMonitoredSources(data.monitoredSources);
      }
      setNewSourceForm({
        name: '',
        country: '',
        region: selectedRegion,
        entityType: 'international_job',
        feedType: 'http_poll',
        url: '',
      });
      setFeedback({
        type: 'success',
        text: data.duplicate
          ? 'Official source URL was already registered.'
          : `Registered official source "${data.source?.name}" for 30s monitoring.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to add official source.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunJobsResearch = async () => {
    const countries = selectedCountries.length > 0 ? selectedCountries : activeRegionPreset.slice(0, 4);
    setBusyAction('jobs');
    setFeedback(null);
    try {
      const res = await fetch('/api/international/research-jobs', {
        method: 'POST',
        headers: ownerHeaders(),
        body: JSON.stringify({
          region: selectedRegion,
          countries,
          categories: selectedCategories,
          existingJobs: internationalJobs,
        }),
      });
      const data = await safeResponseJson(res);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'International jobs research failed');
      }
      if (Array.isArray(data.discovered) && data.discovered.length > 0) {
        await onSaveInternationalJobs(data.discovered);
      }
      if (Array.isArray(data.logs) && data.logs.length > 0) {
        await onSaveVerificationLogs(data.logs);
      }
      if (data.run) {
        await onSaveResearchRun(data.run);
      }
      await onSaveSiteSettings({
        ...siteSettings,
        lastResearchRunAt: new Date().toISOString(),
      });
      setFeedback({
        type: 'success',
        text: data.run?.summary || `Discovered ${data.discovered?.length || 0} candidate jobs (stored privately as private_pending).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Research run failed' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunImmigrationResearch = async () => {
    const countries = selectedCountries.length > 0 ? selectedCountries : activeRegionPreset.slice(0, 4);
    setBusyAction('immigration');
    setFeedback(null);
    try {
      const res = await fetch('/api/international/research-immigration', {
        method: 'POST',
        headers: ownerHeaders(),
        body: JSON.stringify({
          region: selectedRegion,
          countries,
          existingPathways: immigrationPathways,
        }),
      });
      const data = await safeResponseJson(res);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Legal immigration research failed');
      }
      if (Array.isArray(data.discovered) && data.discovered.length > 0) {
        await onSaveImmigrationPathways(data.discovered);
      }
      if (Array.isArray(data.logs) && data.logs.length > 0) {
        await onSaveVerificationLogs(data.logs);
      }
      if (data.run) {
        await onSaveResearchRun(data.run);
      }
      setFeedback({
        type: 'success',
        text: data.run?.summary || `Verified ${data.discovered?.length || 0} official pathways (stored privately as private_pending).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Immigration research failed' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunScholarshipsResearch = async () => {
    const countries = selectedCountries.length > 0 ? selectedCountries : activeRegionPreset.slice(0, 4);
    setBusyAction('scholarships');
    setFeedback(null);
    try {
      const res = await fetch('/api/international/research-scholarships', {
        method: 'POST',
        headers: ownerHeaders(),
        body: JSON.stringify({
          region: selectedRegion,
          countries,
          studyLevel: scholarshipStudyLevel,
          existingScholarships: scholarships,
        }),
      });
      const data = await safeResponseJson(res);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Scholarship research failed');
      }
      if (Array.isArray(data.discovered) && data.discovered.length > 0) {
        await onSaveScholarships(data.discovered);
      }
      if (Array.isArray(data.logs) && data.logs.length > 0) {
        await onSaveVerificationLogs(data.logs);
      }
      if (data.run) {
        await onSaveResearchRun(data.run);
      }
      setFeedback({
        type: 'success',
        text: data.run?.summary || `Verified ${data.discovered?.length || 0} scholarships (stored privately as private_pending).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Scholarship research failed' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleVerifyAllSources = async () => {
    setBusyAction('verify_all');
    setFeedback(null);
    try {
      const res = await fetch('/api/international/verify-all-sources', {
        method: 'POST',
        headers: ownerHeaders(),
        body: JSON.stringify({
          internationalJobs,
          immigrationPathways,
          experienceScholarships: scholarships,
        }),
      });
      const data = await safeResponseJson(res);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Verification sweep failed');
      if (data.internationalJobs?.length) await onSaveInternationalJobs(data.internationalJobs);
      if (data.immigrationPathways?.length) await onSaveImmigrationPathways(data.immigrationPathways);
      if (data.experienceScholarships?.length) await onSaveScholarships(data.experienceScholarships);
      const logsList = data.newLogs || data.logs;
      if (Array.isArray(logsList) && logsList.length) await onSaveVerificationLogs(logsList);
      if (data.run) await onSaveResearchRun(data.run);
      setFeedback({ type: 'success', text: data.run?.summary || 'Live source link verification completed.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Verification failed' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCleanupExpired = async () => {
    setBusyAction('cleanup');
    setFeedback(null);
    try {
      const res = await fetch('/api/international/cleanup-expired', {
        method: 'POST',
        headers: ownerHeaders(),
        body: JSON.stringify({
          internationalJobs,
          experienceScholarships: scholarships,
        }),
      });
      const data = await safeResponseJson(res);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Cleanup failed');
      if (data.internationalJobs?.length) await onSaveInternationalJobs(data.internationalJobs);
      if (data.experienceScholarships?.length) await onSaveScholarships(data.experienceScholarships);
      if (data.run) await onSaveResearchRun(data.run);
      const flaggedTotal = data.expiredMarkedCount ?? data.cleanedCount ?? 0;
      setFeedback({
        type: 'success',
        text: `Expired opportunities cleanup completed (${flaggedTotal} items flagged as EXPIRED).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Cleanup failed' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualModalType) return;
    setBusyAction('manual_save');
    try {
      const targetUrl = String(manualForm.url || '').trim();
      const sourceUrl = String(manualForm.sourceUrl || targetUrl).trim();
      const entityType =
        manualModalType === 'job'
          ? 'international_job'
          : manualModalType === 'immigration'
          ? 'immigration'
          : 'scholarship';

      const chkRes = await fetch('/api/international/verify-url', {
        method: 'POST',
        headers: ownerHeaders(),
        body: JSON.stringify({ url: targetUrl, entityType }),
      });
      const chk = await safeResponseJson(chkRes);
      if (!chkRes.ok || !chk) {
        throw new Error(chk?.error || 'Failed to verify official URL');
      }
      const nowIso = new Date().toISOString();
      const verificationStatus = chk.verificationStatus || 'UNVERIFIED';

      if (manualModalType === 'job') {
        const job: InternationalJob = {
          id: `intl_manual_${Date.now()}`,
          region: (manualForm.region as InternationalRegion) || selectedRegion,
          category: manualForm.category || 'Government Approved Foreign Recruitment',
          country: manualForm.country || '',
          employerOrProgramme: manualForm.employer || '',
          jobTitle: manualForm.title || '',
          location: manualForm.location || OFFICIAL_NOT_STATED,
          requiredEducation: manualForm.requiredEducation || OFFICIAL_NOT_STATED,
          requiredExperience: manualForm.requiredExperience || OFFICIAL_NOT_STATED,
          languageRequirements: manualForm.languageRequirements || OFFICIAL_NOT_STATED,
          salary: manualForm.salary || OFFICIAL_NOT_STATED,
          foreignerAndEthiopianEligibility: manualForm.ethEligibility || 'Open to foreign & Ethiopian applicants per official notice',
          ethiopiansEligible: 'yes',
          visaSponsorshipInfo: manualForm.visaSponsorshipInfo || OFFICIAL_NOT_STATED,
          visaSponsored: Boolean(manualForm.visaSponsored),
          whoPaysVisaAndRecruitmentCosts: manualForm.costDetails || OFFICIAL_NOT_STATED,
          visaFeePolicy: manualForm.visaFeePolicy || 'not_stated',
          noRecruitmentAgencyFee: Boolean(manualForm.noRecruitmentAgencyFee),
          accommodationAndRelocationSupport: manualForm.accommodation || OFFICIAL_NOT_STATED,
          contractDuration: manualForm.contractDuration || OFFICIAL_NOT_STATED,
          applicationDeadline: manualForm.deadline || OFFICIAL_NOT_STATED,
          requiredDocuments: String(manualForm.documents || 'Valid Passport, CV, Education Credentials')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
          officialApplicationInstructions: manualForm.instructions || 'Apply directly via official link.',
          directApplicationUrl: targetUrl,
          originalSourceUrl: sourceUrl,
          lastVerifiedAt: nowIso,
          familyReunification: manualForm.familyReunification || OFFICIAL_NOT_STATED,
          permanentResidencePathway: manualForm.prPathway || OFFICIAL_NOT_STATED,
          verificationStatus,
          verificationNotes: chk.reason || 'Verified on entry',
          sourceAuthorityType: chk.authorityType || 'unverified',
          lastCheckedHttpStatus: chk.httpStatus,
          applicationStatus: verificationStatus === 'VERIFIED' ? 'open' : 'unverified',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await onSaveInternationalJobs([job]);
      } else if (manualModalType === 'immigration') {
        const pathway: ImmigrationPathway = {
          id: `imm_manual_${Date.now()}`,
          country: manualForm.country || '',
          region: (manualForm.region as InternationalRegion) || selectedRegion,
          pathwayTitle: manualForm.title || '',
          pathwayType: manualForm.pathwayType || 'Work-Based Residence Permit',
          ethiopianCitizenEligibility: manualForm.ethEligibilityStatus || 'eligible',
          ethiopianEligibilityDetails: manualForm.ethEligibility || OFFICIAL_NOT_STATED,
          eligibilityRequirements: manualForm.requirements || OFFICIAL_NOT_STATED,
          requiredEducationAndExperience: manualForm.requiredEducation || OFFICIAL_NOT_STATED,
          minimumIncomeOrFinancialRequirement: manualForm.minIncome || OFFICIAL_NOT_STATED,
          languageRequirements: manualForm.languageRequirements || OFFICIAL_NOT_STATED,
          requiredDocuments: String(manualForm.documents || 'Valid Passport, Educational Certificates')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
          governmentApplicationFees: manualForm.govFees || OFFICIAL_NOT_STATED,
          processingTimeline: manualForm.timeline || OFFICIAL_NOT_STATED,
          jobOfferRequired: manualForm.jobOfferRequired || 'not_stated',
          yearsToPermanentResidence: manualForm.yearsToPr || OFFICIAL_NOT_STATED,
          temporaryVsPermanentClarification:
            manualForm.tempVsPerm ||
            'Initial residence permit is temporary; permanent residence requires separate statutory fulfillment.',
          familyReunificationRules: manualForm.familyReunification || OFFICIAL_NOT_STATED,
          citizenshipPathwayNotes: manualForm.citizenshipNotes || OFFICIAL_NOT_STATED,
          officialGovernmentWebsite: targetUrl,
          exactApplicationSteps: String(manualForm.steps || 'Submit official application via government portal.')
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean),
          originalSourceUrl: sourceUrl,
          lastVerifiedAt: nowIso,
          verificationStatus,
          verificationNotes: chk.reason || 'Verified on entry',
          sourceAuthorityType: chk.authorityType || 'unverified',
          lastCheckedHttpStatus: chk.httpStatus,
          applicationStatus: verificationStatus === 'VERIFIED' ? 'open' : 'unverified',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await onSaveImmigrationPathways([pathway]);
      } else {
        const sch: ExperienceScholarship = {
          id: `sch_manual_${Date.now()}`,
          region: (manualForm.region as InternationalRegion) || selectedRegion,
          studyLevel: manualForm.studyLevel || 'Postgraduate / Master',
          universityOrInstitution: manualForm.employer || '',
          country: manualForm.country || '',
          scholarshipName: manualForm.title || '',
          studyProgramme: manualForm.programme || OFFICIAL_NOT_STATED,
          eligibilityForEthiopians: manualForm.ethEligibility || OFFICIAL_NOT_STATED,
          ethiopiansEligible: 'yes',
          academicRequirements: manualForm.requiredEducation || OFFICIAL_NOT_STATED,
          gpaRequirement: manualForm.gpaRequirement || OFFICIAL_NOT_STATED,
          noHighGpaConfirmed: Boolean(manualForm.noHighGpaConfirmed),
          recommendationLetterRequirement: manualForm.recLetters || OFFICIAL_NOT_STATED,
          noRecommendationLetterConfirmed: Boolean(manualForm.noRecommendationLetterConfirmed),
          professionalExperienceCompensates: manualForm.expCompensates || 'considered',
          experienceCompensationNotes: manualForm.expNotes || OFFICIAL_NOT_STATED,
          requiredDocuments: String(manualForm.documents || 'CV, Official Transcripts, Passport')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
          fundingCoverage: manualForm.funding || OFFICIAL_NOT_STATED,
          coversTuition: Boolean(manualForm.coversTuition),
          coversAccommodation: Boolean(manualForm.coversAccommodation),
          coversLivingAllowance: Boolean(manualForm.coversLivingAllowance),
          coversTravel: Boolean(manualForm.coversTravel),
          applicationDeadline: manualForm.deadline || OFFICIAL_NOT_STATED,
          officialApplicationUrl: targetUrl,
          exactApplicationProcedure: String(manualForm.steps || 'Complete official university scholarship form.')
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean),
          originalSourceUrl: sourceUrl,
          lastVerifiedAt: nowIso,
          verificationStatus,
          verificationNotes: chk.reason || 'Verified on entry',
          sourceAuthorityType: chk.authorityType || 'unverified',
          lastCheckedHttpStatus: chk.httpStatus,
          applicationStatus: verificationStatus === 'VERIFIED' ? 'open' : 'unverified',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await onSaveScholarships([sch]);
      }

      setManualModalType(null);
      setManualForm({});
      setFeedback({
        type: verificationStatus === 'VERIFIED' ? 'success' : 'info',
        text: `Record saved with Verification Status: ${verificationStatus} (${chk.reason || 'checked'}).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to save manual official record.' });
    } finally {
      setBusyAction(null);
    }
  };

  if (!isAuthorizedOwner) {
    return (
      <div className="bg-white rounded-3xl p-10 border border-rose-200 text-center space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900">
          Private International Research Engine — Yeabsra Tefera Only
        </h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Access to System 2 private international research controls, unapproved discoveries, source monitoring, and developer alerts is strictly restricted to the authenticated owner developer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header + 8 Mandatory Live KPI Cards */}
      <div className="bg-[#0B132B] text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-lg space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
              <Lock className="w-4 h-4" />
              <span>System 2 Private Engine — Yeabsra Tefera Only</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black mt-1">
              PRIVATE INTERNATIONAL RESEARCH ENGINE &amp; APPROVAL QUEUE
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Autonomous 30-second worldwide official source discovery (jobs, immigration/PR, experience scholarships). Newly discovered opportunities stay strictly private (private_pending) until Yeabsra Tefera approves public publication. Completely independent from System 1 Telegram posting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleVerifyAllSources}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors disabled:opacity-50"
            >
              <ShieldCheck className={`w-4 h-4 ${busyAction === 'verify_all' ? 'animate-spin' : ''}`} />
              <span>{busyAction === 'verify_all' ? 'Verifying...' : 'Run Live Source Verification'}</span>
            </button>
            <button
              type="button"
              onClick={handleCleanupExpired}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${busyAction === 'cleanup' ? 'animate-spin' : ''}`} />
              <span>Clean Expired Deadlines</span>
            </button>
          </div>
        </div>

        {/* 8 Required Live KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-4 border-t border-slate-800 tabular-nums">
          {[
            { label: 'Countries Researched', value: kpis.countriesResearched, color: 'text-white' },
            { label: 'Genuine Jobs Verified', value: kpis.genuineJobs, color: 'text-amber-400' },
            { label: 'Visa-Sponsored Jobs', value: kpis.visaSponsored, color: 'text-sky-400' },
            { label: 'PR Pathways Verified', value: kpis.prPathways, color: 'text-emerald-400' },
            { label: 'Scholarships Verified', value: kpis.scholarshipsCount, color: 'text-amber-300' },
            { label: 'Currently Open', value: kpis.currentlyOpen, color: 'text-emerald-300' },
            { label: 'Expired Flagged', value: kpis.expired, color: 'text-slate-400' },
            { label: 'Rejected / Suspicious', value: kpis.rejectedOrSuspicious, color: 'text-rose-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3">
              <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-0.5 leading-tight">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="p-1 hover:bg-black/5 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 text-xs font-bold">
        {[
          { id: 'runner', label: '1. 30s Auto-Research & Launcher', icon: Sparkles },
          { id: 'approval', label: `2. Private Discovery & Approval (${privatePendingCount})`, icon: EyeOff },
          { id: 'sources', label: `3. Official Source Registry (${monitoredSources.length})`, icon: Activity },
          { id: 'jobs', label: `4. International Jobs (${internationalJobs.length})`, icon: Globe },
          { id: 'immigration', label: `5. Immigration & PR (${immigrationPathways.length})`, icon: Landmark },
          { id: 'scholarships', label: `6. Scholarships (${scholarships.length})`, icon: GraduationCap },
          { id: 'logs', label: `7. History & Verification Logs (${verificationLogs.length})`, icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as any)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-colors ${
              subTab === tab.id
                ? 'bg-[#0B132B] text-amber-400 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: RESEARCH RUNNER & CONTROLS */}
      {subTab === 'runner' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Regions, Countries, Categories, Launchers */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="space-y-2">
              <h2 className="text-base font-extrabold text-[#0B132B]">
                Select Target Region &amp; Countries for Official Discovery
              </h2>
              <p className="text-xs text-slate-500">
                Uses Gemini Search Grounding followed by automated official domain authority verification and live HTTP link checks. Unverified or third-party aggregator URLs are automatically held out of public pages.
              </p>
            </div>

            {/* Region Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {RESEARCH_REGIONS.map((r) => (
                <button
                  key={r.region}
                  type="button"
                  onClick={() => {
                    setSelectedRegion(r.region);
                    setSelectedCountries(r.countries.slice(0, 5));
                  }}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors text-center ${
                    selectedRegion === r.region
                      ? 'bg-[#0B132B] text-amber-400 border-[#0B132B]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {r.region}
                </button>
              ))}
            </div>

            {/* Country Checkboxes + Custom Country */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  Target Countries in {selectedRegion} ({selectedCountries.length} selected)
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCountries(activeRegionPreset)}
                  className="text-xs font-bold text-amber-700 hover:underline"
                >
                  Select All Preset Countries
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set([...activeRegionPreset, ...selectedCountries])).map((c) => {
                  const active = selectedCountries.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleToggleCountry(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-amber-400 text-slate-950 border-amber-500 font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={customCountryInput}
                  onChange={(e) => setCustomCountryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomCountry();
                    }
                  }}
                  placeholder="Add any specific country (e.g. Czechia, Bahrain, Malaysia)..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddCustomCountry}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                >
                  Add Country
                </button>
              </div>
            </div>

            {/* Job Categories + Scholarship Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Workforce Job Categories
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {INTERNATIONAL_JOB_CATEGORIES.map((cat) => {
                    const active = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setSelectedCategories((prev) =>
                            prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Scholarship Study Level Focus
                </label>
                <select
                  value={scholarshipStudyLevel}
                  onChange={(e) => setScholarshipStudyLevel(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                >
                  {[
                    'Undergraduate',
                    'Postgraduate / Master',
                    'Leadership & Executive',
                    'Professional Development',
                    'Short Course',
                    'PhD / Research',
                  ].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Prioritizes scholarships that consider work/management experience and accept Ethiopian applicants.
                </p>
              </div>
            </div>

            {/* Trigger Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleRunJobsResearch}
                disabled={busyAction !== null}
                className="flex flex-col items-start gap-1 p-4 rounded-2xl bg-[#0B132B] hover:bg-slate-900 text-white border border-slate-800 transition-colors disabled:opacity-50 text-left"
              >
                <div className="flex items-center gap-2 text-amber-400 font-black text-xs">
                  <Globe className={`w-4 h-4 ${busyAction === 'jobs' ? 'animate-spin' : ''}`} />
                  <span>{busyAction === 'jobs' ? 'Researching Jobs...' : 'Research International Jobs'}</span>
                </div>
                <span className="text-[11px] text-slate-300">
                  Collects 19 official fields &amp; verifies employer/gov portals.
                </span>
              </button>

              <button
                type="button"
                onClick={handleRunImmigrationResearch}
                disabled={busyAction !== null}
                className="flex flex-col items-start gap-1 p-4 rounded-2xl bg-[#0B132B] hover:bg-slate-900 text-white border border-slate-800 transition-colors disabled:opacity-50 text-left"
              >
                <div className="flex items-center gap-2 text-emerald-400 font-black text-xs">
                  <Landmark className={`w-4 h-4 ${busyAction === 'immigration' ? 'animate-spin' : ''}`} />
                  <span>{busyAction === 'immigration' ? 'Researching PR...' : 'Research Legal Immigration'}</span>
                </div>
                <span className="text-[11px] text-slate-300">
                  Official gov ministries &amp; permanent residence rules only.
                </span>
              </button>

              <button
                type="button"
                onClick={handleRunScholarshipsResearch}
                disabled={busyAction !== null}
                className="flex flex-col items-start gap-1 p-4 rounded-2xl bg-[#0B132B] hover:bg-slate-900 text-white border border-slate-800 transition-colors disabled:opacity-50 text-left"
              >
                <div className="flex items-center gap-2 text-sky-400 font-black text-xs">
                  <GraduationCap className={`w-4 h-4 ${busyAction === 'scholarships' ? 'animate-spin' : ''}`} />
                  <span>{busyAction === 'scholarships' ? 'Researching...' : 'Research Scholarships'}</span>
                </div>
                <span className="text-[11px] text-slate-300">
                  Collects 14 official fields prioritizing experience-based routes.
                </span>
              </button>
            </div>
          </div>

          {/* Right Col: System 2 Automatic 30-Second Background Research Monitor */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-[#0B132B] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>30s Automatic Scheduler</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Runs independently on the server every 30 seconds for Yeabsra Tefera only.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                  schedulerStatus?.enabled ?? true
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {schedulerStatus?.enabled ?? true ? 'Running (30s)' : 'Paused'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs tabular-nums">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Cycles Completed</div>
                <div className="text-lg font-black text-slate-900">
                  {schedulerStatus?.cycleCount ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Private Pending</div>
                <div className="text-lg font-black text-amber-600">
                  {schedulerStatus?.recentDiscoveredCount ?? privatePendingCount}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Healthy Sources</div>
                <div className="text-sm font-black text-emerald-700">
                  {schedulerStatus?.sourcesHealthy ?? 0} / {schedulerStatus?.sourcesTotal ?? monitoredSources.length}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Failed Checks</div>
                <div className="text-sm font-black text-rose-600">
                  {schedulerStatus?.sourcesFailed ?? 0}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-[11px] text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-500">Status:</span>
                <span className="font-bold text-slate-900">
                  {schedulerStatus?.isCycleActive ? 'Scanning live sources now...' : 'Idle / Waiting next 30s tick'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-500">AI / Crawler:</span>
                <span className="font-bold text-right text-slate-900 truncate max-w-[200px]" title={schedulerStatus?.aiProviderStatus}>
                  {schedulerStatus?.aiProviderStatus || 'Live Official Crawler active'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 tabular-nums">
                <span className="font-bold text-slate-500">Started:</span>
                <span>{schedulerStatus?.startedAt ? new Date(schedulerStatus.startedAt).toLocaleTimeString() : '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 tabular-nums">
                <span className="font-bold text-slate-500">Last Scan:</span>
                <span>{schedulerStatus?.lastRunAt ? new Date(schedulerStatus.lastRunAt).toLocaleTimeString() : 'Initializing...'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 tabular-nums">
                <span className="font-bold text-slate-500">Next Scan:</span>
                <span>{schedulerStatus?.nextRunAt ? new Date(schedulerStatus.nextRunAt).toLocaleTimeString() : 'Paused'}</span>
              </div>
            </div>

            {schedulerStatus?.lastCycleSummary && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 leading-relaxed">
                <strong>Last Cycle:</strong> {schedulerStatus.lastCycleSummary}
              </div>
            )}

            {schedulerStatus?.lastError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
                <strong>Last Error:</strong> {schedulerStatus.lastError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleRunSchedulerNow}
                disabled={busyAction !== null}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#0B132B] hover:bg-slate-900 text-amber-400 font-black text-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busyAction === 'scheduler_run' ? 'animate-spin' : ''}`} />
                <span>{busyAction === 'scheduler_run' ? 'Scanning...' : 'Run Immediate Scan'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleScheduler}
                disabled={busyAction !== null}
                className={`inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-black text-xs border disabled:opacity-50 ${
                  schedulerStatus?.enabled ?? true
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
                }`}
              >
                {schedulerStatus?.enabled ?? true ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause 30s Loop</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume 30s Loop</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSavePrivatePreferences}
              disabled={busyAction !== null}
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-colors"
            >
              {busyAction === 'save_controls' ? 'Saving...' : 'Save Private Research Regions & Categories'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: PRIVATE DISCOVERY & APPROVAL QUEUE */}
      {subTab === 'approval' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#0B132B]">
                Private Discovery &amp; Public Approval Queue ({approvalQueueItems.length})
              </h2>
              <p className="text-xs text-slate-500">
                Automatic 30-second discoveries enter as <strong>private_pending</strong> (invisible to public users) until Yeabsra clicks <strong>Approve &amp; Publish Publicly</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'private_pending', label: `Private Pending (${privatePendingCount})` },
                  { id: 'approved_public', label: 'Approved Public' },
                  { id: 'rejected', label: 'Rejected' },
                  { id: 'expired', label: 'Expired' },
                  { id: 'all', label: 'All' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setApprovalFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold border transition-colors ${
                    approvalFilter === f.id
                      ? 'bg-[#0B132B] text-amber-400 border-[#0B132B]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredApprovalItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-2xl">
              No records matching filter "{approvalFilter}". The 30-second scheduler will place newly verified discoveries here automatically.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredApprovalItems.map((item) => (
                <div key={`${item.entityType}_${item.id}`} className="py-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4 text-xs">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-bold text-[10px] uppercase">
                        {item.entityType === 'international_job'
                          ? 'International Job'
                          : item.entityType === 'immigration'
                          ? 'Immigration & PR'
                          : 'Scholarship'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                          item.approvalStatus === 'approved_public'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.approvalStatus === 'private_pending'
                            ? 'bg-amber-100 text-amber-900'
                            : item.approvalStatus === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.approvalStatus}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 font-bold text-[10px]">
                        {item.verificationStatus}
                      </span>
                      <span className="font-extrabold text-sm text-slate-900">{item.title}</span>
                    </div>

                    <div className="text-slate-700 font-semibold">
                      {item.org} · {item.country} ({item.region}) · {item.deadline}
                    </div>
                    <div className="text-slate-600">
                      <strong>Ethiopian Eligibility:</strong> {item.eligibilitySummary}
                    </div>
                    <div className="text-slate-500">
                      <strong>Summary / AI Notes:</strong> {item.aiAnalysisNotes}
                    </div>
                    <div className="text-[11px] text-slate-400 tabular-nums flex flex-wrap gap-3">
                      <span>Source: {item.sourceName}</span>
                      {item.discoveredAt && (
                        <span>Discovered: {new Date(item.discoveredAt).toLocaleString()}</span>
                      )}
                      {item.verifiedAt && (
                        <span>Verified: {new Date(item.verifiedAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Official URL</span>
                      </a>
                    )}
                    {item.approvalStatus !== 'approved_public' && (
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => handleApprovalAction(item.entityType, item.id, 'approve_public')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve &amp; Publish Publicly</span>
                      </button>
                    )}
                    {item.approvalStatus === 'approved_public' && (
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => handleApprovalAction(item.entityType, item.id, 'keep_private')}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold disabled:opacity-50"
                      >
                        Unpublish (Keep Private)
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => handleApprovalAction(item.entityType, item.id, 'reject')}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => handleApprovalAction(item.entityType, item.id, 'mark_expired')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold disabled:opacity-50"
                    >
                      Mark Expired
                    </button>
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => handleApprovalAction(item.entityType, item.id, 'delete')}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OFFICIAL SOURCE REGISTRY & PRIVATE DEVELOPER ALERTS */}
      {subTab === 'sources' && (
        <div className="space-y-6">
          {/* Add Official Source Form */}
          <form
            onSubmit={handleAddOfficialSource}
            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4"
          >
            <div>
              <h2 className="text-base font-extrabold text-[#0B132B]">
                Add Official Portal / RSS / API Source to 30s Monitor
              </h2>
              <p className="text-xs text-slate-500">
                Only official government ministries, immigration authorities, embassies, universities, and recognized international portals are accepted.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
              <input
                required
                type="text"
                placeholder="Portal / Ministry Name *"
                value={newSourceForm.name}
                onChange={(e) => setNewSourceForm({ ...newSourceForm, name: e.target.value })}
                className="px-3 py-2 rounded-xl border border-slate-300"
              />
              <input
                required
                type="text"
                placeholder="Country *"
                value={newSourceForm.country}
                onChange={(e) => setNewSourceForm({ ...newSourceForm, country: e.target.value })}
                className="px-3 py-2 rounded-xl border border-slate-300"
              />
              <select
                value={newSourceForm.region}
                onChange={(e) => setNewSourceForm({ ...newSourceForm, region: e.target.value as InternationalRegion })}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
              >
                {RESEARCH_REGIONS.map((r) => (
                  <option key={r.region} value={r.region}>
                    {r.region}
                  </option>
                ))}
              </select>
              <select
                value={newSourceForm.entityType}
                onChange={(e) => setNewSourceForm({ ...newSourceForm, entityType: e.target.value as any })}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
              >
                <option value="international_job">International Jobs</option>
                <option value="immigration">Immigration &amp; PR</option>
                <option value="scholarship">Scholarships</option>
              </select>
              <select
                value={newSourceForm.feedType}
                onChange={(e) => setNewSourceForm({ ...newSourceForm, feedType: e.target.value as any })}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
              >
                <option value="http_poll">HTTP Monitor</option>
                <option value="rss_atom">RSS / Atom Feed</option>
                <option value="official_api">Official JSON API</option>
              </select>
              <input
                required
                type="url"
                placeholder="https://official-source.gov/... *"
                value={newSourceForm.url}
                onChange={(e) => setNewSourceForm({ ...newSourceForm, url: e.target.value })}
                className="px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busyAction !== null}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{busyAction === 'add_source' ? 'Verifying Official Portal...' : 'Verify & Add Official Source'}</span>
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Registered Official Sources */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-extrabold text-[#0B132B] flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-600" />
                <span>Monitored Official Sources ({monitoredSources.length})</span>
              </h3>
              <div className="space-y-2.5 max-h-[540px] overflow-y-auto text-xs">
                {monitoredSources.map((src) => (
                  <div key={src.id} className="p-3 rounded-2xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{src.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          src.verificationStatus === 'HEALTHY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : src.verificationStatus === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {src.verificationStatus}
                      </span>
                    </div>
                    <div className="text-slate-600 font-semibold">
                      {src.country} ({src.region}) · {src.entityType} · {src.feedType}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{src.url}</div>
                    <div className="text-[11px] text-slate-500 tabular-nums flex flex-wrap gap-3">
                      <span>Detected: {src.newAnnouncementsDetected || 0}</span>
                      <span>Failed Checks: {src.failedChecks || 0}</span>
                      {src.lastCheckedAt && <span>Checked: {new Date(src.lastCheckedAt).toLocaleTimeString()}</span>}
                    </div>
                    {src.lastError && <div className="text-[11px] text-rose-600">{src.lastError}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Private Developer Notifications */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-extrabold text-[#0B132B] flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <span>Private Developer Alerts ({developerNotifications.length})</span>
              </h3>
              {developerNotifications.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No new discovery alerts recorded yet. Alerts appear here automatically as the 30-second loop detects new verified portals.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[540px] overflow-y-auto text-xs">
                  {developerNotifications.map((n) => (
                    <div key={n.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{n.programmeOrOpportunityName}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                          {n.country}
                        </span>
                      </div>
                      <p className="text-slate-700">{n.whatChangedOrAnnounced}</p>
                      <div className="text-[11px] text-slate-500">
                        <strong>ET Eligibility:</strong> {n.ethiopianEligibility}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                        <span>{new Date(n.detectedAt).toLocaleString()}</span>
                        {n.exactOfficialApplicationLink && (
                          <a
                            href={n.exactOfficialApplicationLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-700 font-bold hover:underline"
                          >
                            Official Link
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANAGE INTERNATIONAL JOBS */}
      {subTab === 'jobs' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#0B132B]">
                International Jobs Repository ({internationalJobs.length})
              </h2>
              <p className="text-xs text-slate-500">
                Only items with VERIFIED status and open deadlines are visible to the public.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setManualForm({ region: selectedRegion, visaFeePolicy: 'free_recruitment_applicant_pays_gov_fee' });
                setManualModalType('job');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Official International Job</span>
            </button>
          </div>

          {internationalJobs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-2xl">
              No international jobs saved yet. Run the Workforce Discovery Engine or add an official posting above.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {internationalJobs.map((j) => (
                <div key={j.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{j.jobTitle}</span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          j.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {j.verificationStatus}
                      </span>
                    </div>
                    <div className="text-slate-600 font-semibold">
                      {j.employerOrProgramme} · {j.location}, {j.country} ({j.region}) · Deadline: {j.applicationDeadline}
                    </div>
                    <div className="text-[11px] text-slate-500">{j.verificationNotes}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={j.directApplicationUrl || j.originalSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Source</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onDeleteInternationalJob(j.id)}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MANAGE IMMIGRATION & PR */}
      {subTab === 'immigration' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#0B132B]">
                Legal Immigration &amp; Permanent Residence Repository ({immigrationPathways.length})
              </h2>
              <p className="text-xs text-slate-500">
                Only government portals, immigration ministries, and embassy portals pass verification.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setManualForm({ region: selectedRegion, pathwayType: 'Work-Based Residence Permit', ethEligibilityStatus: 'eligible', jobOfferRequired: 'yes' });
                setManualModalType('immigration');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Official Government Pathway</span>
            </button>
          </div>

          {immigrationPathways.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-2xl">
              No immigration pathways saved yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {immigrationPathways.map((p) => (
                <div key={p.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">
                        {p.country} — {p.pathwayTitle}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          p.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {p.verificationStatus}
                      </span>
                    </div>
                    <div className="text-slate-600 font-semibold">
                      {p.pathwayType} · ET Eligibility: {p.ethiopianCitizenEligibility} · PR Timeline: {p.yearsToPermanentResidence}
                    </div>
                    <div className="text-[11px] text-slate-500">{p.verificationNotes}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={p.officialGovernmentWebsite || p.originalSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Portal</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onDeleteImmigrationPathway(p.id)}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MANAGE SCHOLARSHIPS */}
      {subTab === 'scholarships' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#0B132B]">
                Experience-Based Scholarships Repository ({scholarships.length})
              </h2>
              <p className="text-xs text-slate-500">
                Only verified university, government, and institutional scholarship announcements appear publicly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setManualForm({ region: selectedRegion, studyLevel: 'Postgraduate / Master', expCompensates: 'considered' });
                setManualModalType('scholarship');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Official Scholarship</span>
            </button>
          </div>

          {scholarships.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-2xl">
              No scholarships saved yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {scholarships.map((s) => (
                <div key={s.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{s.scholarshipName}</span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          s.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {s.verificationStatus}
                      </span>
                    </div>
                    <div className="text-slate-600 font-semibold">
                      {s.universityOrInstitution} · {s.country} ({s.studyLevel}) · Deadline: {s.applicationDeadline}
                    </div>
                    <div className="text-[11px] text-slate-500">{s.verificationNotes}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={s.officialApplicationUrl || s.originalSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Portal</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onDeleteScholarship(s.id)}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: RESEARCH HISTORY & FAILED VERIFICATION LOGS */}
      {subTab === 'logs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-[#0B132B] flex items-center gap-2">
              <History className="w-4 h-4 text-amber-500" />
              <span>Research &amp; Cleanup Run History ({researchHistory.length})</span>
            </h3>
            {researchHistory.length === 0 ? (
              <p className="text-xs text-slate-500">No research runs recorded yet.</p>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto">
                {researchHistory.map((run) => (
                  <div key={run.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span className="uppercase">{run.runType.replace('_', ' ')}</span>
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {new Date(run.completedAt || run.startedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-700">{run.summary}</p>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      Verified: {run.verifiedCount} · Unverified/Blocked: {run.unverifiedCount} · Duplicates Skipped: {run.duplicatesSkipped}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-[#0B132B] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Official Source &amp; Broken Link Audit Log ({verificationLogs.length})</span>
            </h3>
            {verificationLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No verification checks recorded yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto">
                {verificationLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 truncate">{log.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 ${
                          log.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.verificationStatus === 'REJECTED_SUSPICIOUS'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {log.verificationStatus}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{log.url}</div>
                    <div className="text-[11px] text-slate-700">{log.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Verified Entry Modal */}
      {manualModalType && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveManualEntry}
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="bg-[#0B132B] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-extrabold">
                <Link2 className="w-4 h-4 text-amber-400" />
                <span>
                  Add Verified Official{' '}
                  {manualModalType === 'job'
                    ? 'International Job'
                    : manualModalType === 'immigration'
                    ? 'Government Immigration Pathway'
                    : 'Scholarship'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setManualModalType(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 text-xs">
              <p className="text-[11px] text-slate-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
                URL will be automatically verified for official source authority and live HTTP availability before publication.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  required
                  type="text"
                  placeholder="Title / Programme Name *"
                  value={manualForm.title || ''}
                  onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  required
                  type="text"
                  placeholder="Country *"
                  value={manualForm.country || ''}
                  onChange={(e) => setManualForm({ ...manualForm, country: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  required
                  type="text"
                  placeholder={manualModalType === 'immigration' ? 'Government Ministry / Portal' : 'Employer / University / Institution *'}
                  value={manualForm.employer || ''}
                  onChange={(e) => setManualForm({ ...manualForm, employer: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  required
                  type="url"
                  placeholder="Official Application / Portal URL (https://...) *"
                  value={manualForm.url || ''}
                  onChange={(e) => setManualForm({ ...manualForm, url: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  type="url"
                  placeholder="Original Official Source URL (https://...)"
                  value={manualForm.sourceUrl || ''}
                  onChange={(e) => setManualForm({ ...manualForm, sourceUrl: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  type="text"
                  placeholder="Application Deadline (YYYY-MM-DD or NOT STATED...)"
                  value={manualForm.deadline || ''}
                  onChange={(e) => setManualForm({ ...manualForm, deadline: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  type="text"
                  placeholder="Required Education & Experience"
                  value={manualForm.requiredEducation || ''}
                  onChange={(e) => setManualForm({ ...manualForm, requiredEducation: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  type="text"
                  placeholder="Language Requirements"
                  value={manualForm.languageRequirements || ''}
                  onChange={(e) => setManualForm({ ...manualForm, languageRequirements: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <textarea
                rows={3}
                placeholder="Ethiopian Citizen Eligibility / Additional Official Details..."
                value={manualForm.ethEligibility || ''}
                onChange={(e) => setManualForm({ ...manualForm, ethEligibility: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualModalType(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyAction !== null}
                className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs"
              >
                {busyAction === 'manual_save' ? 'Verifying & Saving...' : 'Verify URL & Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
