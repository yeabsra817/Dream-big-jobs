import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Globe,
  GraduationCap,
  History,
  Landmark,
  Link2,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  ExperienceScholarship,
  ImmigrationPathway,
  INTERNATIONAL_JOB_CATEGORIES,
  InternationalJob,
  InternationalRegion,
  OFFICIAL_NOT_STATED,
  RESEARCH_REGIONS,
  ResearchFrequency,
  ResearchHistoryRun,
  VerificationReportItem,
} from '../../types/international';
import { SiteSettings, TelegramDistributionMode, Vacancy } from '../../types/job';
import { safeResponseJson } from '../../lib/firebase';

interface Props {
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
}

export const InternationalControlCenter: React.FC<Props> = ({
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
}) => {
  const [subTab, setSubTab] = useState<'runner' | 'jobs' | 'immigration' | 'scholarships' | 'logs'>('runner');

  // Research Control State
  const [selectedRegion, setSelectedRegion] = useState<InternationalRegion>('Europe');
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['Germany', 'Finland', 'Estonia', 'Poland', 'Latvia']);
  const [customCountryInput, setCustomCountryInput] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Banking & Finance',
    'NGO & International Organizations',
    'Government Approved Foreign Recruitment',
  ]);
  const [scholarshipStudyLevel, setScholarshipStudyLevel] = useState<ExperienceScholarship['studyLevel']>('Postgraduate / Master');

  // Automation Frequency & Telegram Distribution Mode
  const [frequency, setFrequency] = useState<ResearchFrequency>(siteSettings.researchFrequency || 'manual');
  const [distributionMode, setDistributionMode] = useState<TelegramDistributionMode>(
    siteSettings.telegramDistributionMode || 'all_jobs'
  );
  const [includeImmigration, setIncludeImmigration] = useState(
    Boolean(siteSettings.telegramIncludeInternationalImmigration)
  );
  const [includeScholarships, setIncludeScholarships] = useState(
    Boolean(siteSettings.telegramIncludeScholarships)
  );

  // Loading & Feedback
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Manual Entry Modal
  const [manualModalType, setManualModalType] = useState<'job' | 'immigration' | 'scholarship' | null>(null);
  const [manualForm, setManualForm] = useState<Record<string, any>>({});

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

  const handleSaveControls = async () => {
    setBusyAction('save_controls');
    try {
      await onSaveSiteSettings({
        ...siteSettings,
        researchEnabledRegions: Array.from(new Set([...(siteSettings.researchEnabledRegions || []), selectedRegion])),
        researchEnabledCountries: selectedCountries,
        researchJobCategories: selectedCategories,
        researchFrequency: frequency,
        telegramDistributionMode: distributionMode,
        telegramIncludeInternationalImmigration: includeImmigration,
        telegramIncludeScholarships: includeScholarships,
        updatedAt: new Date().toISOString(),
      });
      setFeedback({
        type: 'success',
        text: `Automation & Telegram distribution controls saved (${frequency.toUpperCase()} research, Telegram mode: ${distributionMode.replace('_', ' ').toUpperCase()}).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to save controls.' });
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
        headers: { 'Content-Type': 'application/json' },
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
        text: data.run?.summary || `Discovered ${data.discovered?.length || 0} candidate jobs.`,
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
        headers: { 'Content-Type': 'application/json' },
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
        text: data.run?.summary || `Verified ${data.discovered?.length || 0} official pathways.`,
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
        headers: { 'Content-Type': 'application/json' },
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
        text: data.run?.summary || `Verified ${data.discovered?.length || 0} scholarships.`,
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
        headers: { 'Content-Type': 'application/json' },
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
      if (data.logs?.length) await onSaveVerificationLogs(data.logs);
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="space-y-6 pb-16">
      {/* Header + 8 Mandatory Live KPI Cards */}
      <div className="bg-[#0B132B] text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-lg space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
              <Globe className="w-4 h-4" />
              <span>Hopland International Expansion &amp; Verification Center</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black mt-1">
              WORKFORCE DISCOVERY, LEGAL IMMIGRATION, SCHOLARSHIPS &amp; AUDIT
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Research grounded official programmes across Europe, Middle East, Far East &amp; Asia, enforce anti-fabrication &amp; official source domain verification, and control Telegram job distribution.
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
          { id: 'runner', label: '1. Research & Telegram Controls', icon: Sparkles },
          { id: 'jobs', label: `2. International Jobs (${internationalJobs.length})`, icon: Globe },
          { id: 'immigration', label: `3. Immigration & PR (${immigrationPathways.length})`, icon: Landmark },
          { id: 'scholarships', label: `4. Scholarships (${scholarships.length})`, icon: GraduationCap },
          { id: 'logs', label: `5. History & Verification Logs (${verificationLogs.length})`, icon: History },
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

          {/* Right Col: Automation Schedule & Telegram Distribution Mode Quick Controls */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-extrabold text-[#0B132B] flex items-center gap-2">
                <Send className="w-4 h-4 text-[#229ED9]" />
                <span>Telegram Distribution Mode</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Switch anytime between ALL JOBS, BANKING JOBS ONLY, or NGO JOBS ONLY.
              </p>
            </div>

            <div className="space-y-2">
              {[
                { id: 'all_jobs' as TelegramDistributionMode, label: 'OPTION A: ALL JOBS' },
                { id: 'banking_only' as TelegramDistributionMode, label: 'OPTION B: BANKING JOBS ONLY' },
                { id: 'ngo_only' as TelegramDistributionMode, label: 'OPTION C: NGO JOBS ONLY' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDistributionMode(opt.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                    distributionMode === opt.id
                      ? 'bg-[#0B132B] text-amber-400 border-[#0B132B]'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <span>{opt.label}</span>
                  {distributionMode === opt.id && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </button>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <div className="font-bold text-slate-800">Content Separation Defaults</div>
              <label className="flex items-center justify-between gap-2 text-slate-700 cursor-pointer">
                <span>Allow Immigration / PR in Jobs TG</span>
                <input
                  type="checkbox"
                  checked={includeImmigration}
                  onChange={(e) => setIncludeImmigration(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-slate-700 cursor-pointer">
                <span>Allow Scholarships in Jobs TG</span>
                <input
                  type="checkbox"
                  checked={includeScholarships}
                  onChange={(e) => setIncludeScholarships(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
              </label>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <label className="font-bold text-slate-800 block">Research Schedule Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ResearchFrequency)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
              >
                <option value="manual">Manual Trigger Only</option>
                <option value="daily">Daily Automated Check</option>
                <option value="weekly">Weekly Automated Check</option>
              </select>
              {siteSettings.lastResearchRunAt && (
                <p className="text-[11px] text-slate-500 tabular-nums">
                  Last Run: {new Date(siteSettings.lastResearchRunAt).toLocaleString()}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveControls}
              disabled={busyAction !== null}
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-colors"
            >
              {busyAction === 'save_controls' ? 'Saving...' : 'Save Automation & TG Settings'}
            </button>
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
