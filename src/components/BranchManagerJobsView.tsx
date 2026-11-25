import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { JobSeekerProfile } from '../types/jobSeeker';
import {
  ALLOWED_BRANCH_MANAGER_REGIONS,
  BranchManagerJobsSearchResponse,
  BranchManagerProfileInput,
  BranchManagerRegionScope,
  DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE,
  TARGET_BRANCH_MANAGER_POSITIONS,
  VerifiedBranchManagerJob,
} from '../types/branchManagerJobs';
import {
  fetchSavedBranchManagerProfile,
  loadGuestBranchManagerProfile,
  saveGuestBranchManagerProfile,
  saveUserBranchManagerProfile,
  searchBranchManagerJobs,
  triggerBranchManagerLiveDiscovery,
} from '../lib/branchManagerJobsService';
import { fetchAutonomousDiscoveryStatus } from '../lib/autonomousDiscoveryService';

interface Props {
  onBack: () => void;
  userProfile?: JobSeekerProfile | null;
  onOpenAuth?: () => void;
}

export const BranchManagerJobsView: React.FC<Props> = ({
  onBack,
  userProfile,
  onOpenAuth,
}) => {
  const isSignedIn = Boolean(userProfile?.uid);

  const [profile, setProfile] = useState<BranchManagerProfileInput>(() =>
    loadGuestBranchManagerProfile()
  );
  const [isOwnerAccountProfile, setIsOwnerAccountProfile] = useState(false);
  const [response, setResponse] = useState<BranchManagerJobsSearchResponse | null>(null);
  const [selectedJob, setSelectedJob] = useState<VerifiedBranchManagerJob | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<BranchManagerRegionScope | 'ALL'>('ALL');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [minSalaryUsd, setMinSalaryUsd] = useState<number>(3000);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isScanningLive, setIsScanningLive] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showAuditBreakdown, setShowAuditBreakdown] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Profile editor text buffers
  const [skillsText, setSkillsText] = useState('');
  const [employersText, setEmployersText] = useState('');
  const [languagesText, setLanguagesText] = useState('');

  const syncBuffers = useCallback((p: BranchManagerProfileInput) => {
    setSkillsText((p.coreSkills || []).join(', '));
    setEmployersText((p.employers || []).join(', '));
    setLanguagesText((p.languages || []).join(', '));
  }, []);

  // Load user's own private profile (or clean guest default) & run strict 6-gate search
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        let activeProfile: BranchManagerProfileInput;
        let ownerFlag = false;

        if (isSignedIn) {
          const saved = await fetchSavedBranchManagerProfile();
          if (saved) {
            activeProfile = saved.profile;
            ownerFlag = saved.isOwnerAccountProfile;
          } else {
            activeProfile = loadGuestBranchManagerProfile();
          }
        } else {
          activeProfile = loadGuestBranchManagerProfile();
        }

        if (cancelled) return;
        setProfile(activeProfile);
        setIsOwnerAccountProfile(ownerFlag);
        syncBuffers(activeProfile);

        const res = await searchBranchManagerJobs({
          profile: ownerFlag ? undefined : activeProfile,
          regionFilter: 'ALL',
          positionFilter: 'ALL',
          minSalaryUsd: Math.max(3000, activeProfile.minimumMonthlyGrossUsd || 3000),
        });
        if (!cancelled) {
          setResponse(res);
          if (res.isOwnerAccountProfile && res.profileUsed) {
            setProfile(res.profileUsed);
            syncBuffers(res.profileUsed);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMessage(
            err?.message || 'Unable to load verified $3,000+ visa-sponsored roles.'
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userProfile?.uid, syncBuffers]);

  // Silent auto-refresh whenever the 1-minute autonomous discovery worker updates verified $3,000+ results
  useEffect(() => {
    let active = true;
    let lastSeenSuccessAt: string | null = null;
    const poll = async () => {
      const st = await fetchAutonomousDiscoveryStatus();
      if (!active || !st?.lastSuccessfulSearchAt) return;
      if (lastSeenSuccessAt && st.lastSuccessfulSearchAt !== lastSeenSuccessAt) {
        try {
          const fresh = await searchBranchManagerJobs({
            profile: isOwnerAccountProfile ? undefined : profile,
            regionFilter: 'ALL',
            positionFilter: 'ALL',
            minSalaryUsd: Math.max(3000, profile.minimumMonthlyGrossUsd || 3000),
          });
          if (active) setResponse(fresh);
        } catch {
          // Preserve existing displayed jobs on transient poll failure
        }
      }
      lastSeenSuccessAt = st.lastSuccessfulSearchAt;
    };
    poll();
    const timer = window.setInterval(poll, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isOwnerAccountProfile, profile]);

  const handleRunLiveScan = async () => {
    setIsScanningLive(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await triggerBranchManagerLiveDiscovery(profile);
      setResponse(res);
      setStatusMessage(
        `Scanned ${res.audit.totalCandidatesScanned.toLocaleString()} live openings across ${res.audit.sourcesChecked.length} official portals (${res.audit.passedAllSixGates} passed all 6 strict $3,000+ & visa-sponsorship verification gates).`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to scan live official banking portals.');
    } finally {
      setIsScanningLive(false);
    }
  };

  const handleSaveProfile = async () => {
    const nextProfile: BranchManagerProfileInput = {
      ...profile,
      minimumMonthlyGrossUsd: Math.max(3000, Number(profile.minimumMonthlyGrossUsd || 3000)),
      coreSkills: skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      employers: employersText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      languages: languagesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    setIsSavingProfile(true);
    setErrorMessage(null);
    try {
      let persisted = nextProfile;
      if (isSignedIn) {
        persisted = await saveUserBranchManagerProfile(nextProfile);
      } else {
        saveGuestBranchManagerProfile(nextProfile);
      }
      setProfile(persisted);
      syncBuffers(persisted);
      setIsProfileEditorOpen(false);
      setStatusMessage(
        'Your private professional profile was saved and all verified $3,000+ openings were re-scored.'
      );

      setIsLoading(true);
      const res = await searchBranchManagerJobs({
        profile: persisted,
        regionFilter: 'ALL',
        positionFilter: 'ALL',
        minSalaryUsd: Math.max(3000, persisted.minimumMonthlyGrossUsd || 3000),
      });
      setResponse(res);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not save your profile.');
    } finally {
      setIsSavingProfile(false);
      setIsLoading(false);
    }
  };

  const handleResetProfile = () => {
    const clean = {
      ...DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE,
      employers: [],
      coreSkills: [...DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE.coreSkills],
      targetPositions: [...DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE.targetPositions],
      languages: [...DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE.languages],
    };
    setProfile(clean);
    syncBuffers(clean);
  };

  // Client-side instant filtering over strictly 6-gate verified results
  const visibleJobs = useMemo(() => {
    const all = response?.jobs || [];
    return all.filter((job) => {
      if (regionFilter !== 'ALL' && job.regionScope !== regionFilter) return false;
      if (job.grossMonthlySalaryUsd < minSalaryUsd) return false;
      if (positionFilter !== 'ALL') {
        const pf = positionFilter.toLowerCase();
        if (
          !job.matchedTargetPosition.toLowerCase().includes(pf) &&
          !job.jobTitle.toLowerCase().includes(pf)
        ) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const hay = `${job.jobTitle} ${job.employerName} ${job.country} ${job.city} ${job.regionScope} ${job.matchedTargetPosition} ${job.visaSponsorshipEvidence} ${job.originalSalaryDisplay}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [response, regionFilter, minSalaryUsd, positionFilter, searchQuery]);

  const countsByRegion = useMemo(() => {
    const counts: Record<string, number> = { ALL: (response?.jobs || []).length };
    for (const r of ALLOWED_BRANCH_MANAGER_REGIONS) {
      counts[r] = (response?.jobs || []).filter((j) => j.regionScope === r).length;
    }
    return counts;
  }, [response]);

  // =========================================================================
  // DEDICATED JOB DETAILS PAGE (ALL 19 REQUIRED SECTION 6 FIELDS)
  // =========================================================================
  if (selectedJob) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] text-slate-900">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedJob(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Jobs for Branch Manager</span>
            </button>
            <a
              href={selectedJob.officialApplicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
            >
              <span>Apply on Official Employer Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Header Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    Verified Visa-Sponsored · &gt;$3,000/mo
                  </span>
                  <span className="text-slate-500 font-medium">{selectedJob.regionScope}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600">{selectedJob.matchedTargetPosition}</span>
                </div>
                <h1 className="text-2xl font-bold text-[#0B132B]">{selectedJob.jobTitle}</h1>
                <div className="text-sm font-semibold text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{selectedJob.employerName}</span>
                  <span className="text-slate-300">|</span>
                  <span className="font-normal text-slate-600">{selectedJob.employerTypeLabel}</span>
                  <span className="text-slate-300">|</span>
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {selectedJob.city}, {selectedJob.country}
                  </span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 min-w-[230px] text-left md:text-right">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                  Guaranteed Gross Monthly (USD)
                </div>
                <div className="text-2xl font-bold text-emerald-900 tabular-nums">
                  ${selectedJob.grossMonthlySalaryUsd.toLocaleString()} / mo
                </div>
                <div className="text-xs text-emerald-800 mt-0.5">
                  Profile Match: <strong className="tabular-nums">{selectedJob.profileMatchPercentage}%</strong>
                </div>
              </div>
            </div>

            {/* Salary Conversion Transparency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800">Original Disclosed Base Salary</div>
                <div className="text-slate-700 font-medium">{selectedJob.originalSalaryDisplay}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800">USD Equivalent &amp; Exchange Rate</div>
                <div className="text-slate-700 font-medium">{selectedJob.usdEquivalentDisplay}</div>
                <div className="text-[11px] text-slate-500">{selectedJob.exchangeRateUsed}</div>
              </div>
            </div>
          </div>

          {/* Visa Sponsorship Evidence & Ethiopia Confirmation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0B132B]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified Visa Sponsorship Evidence</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed bg-emerald-50/60 border border-emerald-100 p-3 rounded-lg">
                &ldquo;{selectedJob.visaSponsorshipEvidence}&rdquo;
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0B132B]">
                <Globe className="w-4 h-4 text-emerald-600" />
                <span>Ethiopian Applicant Eligibility Confirmation</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {selectedJob.ethiopianEligibilityConfirmation}
              </p>
            </div>
          </div>

          {/* Why You Qualify vs Gaps / Unmet Requirements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5">
              <h2 className="text-sm font-bold text-emerald-900">
                Why You Qualify ({selectedJob.profileMatchPercentage}% Profile Match)
              </h2>
              <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                {selectedJob.whyYouQualify.map((reason, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5">
              <h2 className="text-sm font-bold text-amber-900">
                Gaps or Requirements to Confirm
              </h2>
              {selectedJob.gapsOrUnmetRequirements.length === 0 ? (
                <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                  No mandatory credential gaps identified against your profile. Confirm final
                  interview &amp; visa documentation steps on the official employer portal.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs text-amber-950 list-disc pl-4">
                  {selectedJob.gapsOrUnmetRequirements.map((gap, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {gap}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Full Structured Specifications */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-bold text-[#0B132B]">
              Verified Role Specifications, Relocation &amp; Dates
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <SpecCard label="Required Education" value={selectedJob.requiredEducation} />
              <SpecCard label="Required Experience" value={selectedJob.requiredExperience} />
              <SpecCard label="Language Requirements" value={selectedJob.languageRequirements} />
              <SpecCard label="Relocation Support" value={selectedJob.relocationSupport} />
              <SpecCard
                label="Family Relocation Possibilities"
                value={selectedJob.familyRelocationPossibilities}
              />
              <SpecCard
                label="Date Posted & Application Deadline"
                value={`Posted: ${selectedJob.datePosted} · Deadline: ${selectedJob.applicationDeadline}`}
              />
            </div>

            <div className="pt-2 space-y-2">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Key Job Responsibilities
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-5">
                {selectedJob.jobResponsibilities.map((r, i) => (
                  <li key={i} className="leading-relaxed">
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Verified Official Source: <strong className="text-slate-800">{selectedJob.sourcePortal}</strong>
              </div>
              <a
                href={selectedJob.officialApplicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
              >
                <span>Open Official Employer Application Link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN JOBS FOR BRANCH MANAGER PAGE
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#FBFBFA] text-slate-900">
      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={onBack}
                className="mt-0.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B132B]">
                    Jobs for Branch Manager
                  </h1>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    Visa-Sponsored · &gt;$3,000/mo Gross Base
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
                  Strictly verified senior banking &amp; finance openings above USD 3,000/month
                  gross base salary with explicit employer visa sponsorship across{' '}
                  <strong className="text-slate-800">
                    Africa (International Banks &amp; Companies Only), Middle East, Europe &amp;
                    Scandinavian
                  </strong>{' '}
                  only.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsProfileEditorOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
                <span>My Profile</span>
              </button>
              <button
                type="button"
                onClick={handleRunLiveScan}
                disabled={isScanningLive}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isScanningLive ? 'animate-spin text-emerald-400' : ''}`}
                />
                <span>{isScanningLive ? 'Scanning Official Portals...' : 'Scan Live Portals'}</span>
              </button>
              {!isSignedIn && onOpenAuth && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-semibold cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="font-semibold hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {statusMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="font-semibold hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active Profile & 6-Gate Transparency Strip */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Active Private Profile ({isSignedIn ? 'Account-Isolated' : 'Browser-Local Guest'})
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {profile.currentOrRecentPosition || 'Senior Banking & Finance'} ·{' '}
                {profile.educationDegree} in {profile.fieldOfStudy || 'Accounting & Finance'}
                {profile.institution ? ` (${profile.institution}${profile.graduationYear ? `, ${profile.graduationYear}` : ''})` : ''}{' '}
                · {profile.totalBankingYears} yrs banking ({profile.branchManagerYears} yrs Branch
                Manager)
              </div>
              <div className="text-xs text-slate-500">
                Strict Floor: Gross Base Salary &gt; $3,000/month ($36,000/yr USD) · Explicit Visa
                Sponsorship Required · Ethiopian Offshore Applicants Eligible
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAuditBreakdown((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-[#0B132B] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer self-start lg:self-auto"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                {showAuditBreakdown ? 'Hide 6-Gate Audit' : 'View 6-Gate Verification Audit'}
              </span>
            </button>
          </div>

          {/* Numeric Audit Summary */}
          {response && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
              <div>
                <div className="text-[11px] text-slate-500">Live Official Jobs Scanned</div>
                <div className="text-xl font-bold text-slate-900 tabular-nums">
                  {response.audit.totalCandidatesScanned.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-emerald-700 font-medium">
                  Passed All 6 Strict Gates
                </div>
                <div className="text-xl font-bold text-emerald-700 tabular-nums">
                  {response.audit.passedAllSixGates}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Excluded (Undisclosed Salary)</div>
                <div className="text-xl font-bold text-slate-700 tabular-nums">
                  {response.audit.excludedUndisclosedSalary}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">
                  Excluded (No Confirmed Sponsorship)
                </div>
                <div className="text-xl font-bold text-slate-700 tabular-nums">
                  {response.audit.excludedUnconfirmedVisaSponsorship}
                </div>
              </div>
            </div>
          )}

          {/* Expandable Full 6-Gate Audit */}
          {showAuditBreakdown && response && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-900">
                Zero-Fabrication 6-Gate Exclusion Breakdown
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 tabular-nums">
                <div>Outside 4 Allowed Regions: {response.audit.excludedOutsideAllowedRegions}</div>
                <div>
                  Local African (Non-Intl): {response.audit.excludedLocalAfricanNonInternational}
                </div>
                <div>Unrelated Roles Blocked: {response.audit.excludedNonMatchingRole}</div>
                <div>Below $3,000/mo Base: {response.audit.excludedBelow3000Usd}</div>
                <div>Undisclosed Salary Blocked: {response.audit.excludedUndisclosedSalary}</div>
                <div>
                  Unconfirmed Sponsorship: {response.audit.excludedUnconfirmedVisaSponsorship}
                </div>
                <div>Offshore/Ethiopian Ineligible: {response.audit.excludedEthiopianIneligible}</div>
                <div>Expired / Duplicates: {response.audit.excludedExpiredOrDuplicate}</div>
              </div>
              <div className="text-[11px] text-slate-500 pt-1">
                FX Source: {response.audit.fxSourceNote} · Official Portals Checked (
                {response.audit.sourcesChecked.length}):{' '}
                {response.audit.sourcesChecked.join(', ') || 'Initializing'}
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Private Profile Editor (Per-User Isolated) */}
        {isProfileEditorOpen && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#0B132B]">
                  Edit Your Private Professional Profile
                </h2>
                <p className="text-xs text-slate-500">
                  Your credentials are stored privately for your own profile matching only and are
                  never visible to other users.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileEditorOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nationality</label>
                <input
                  type="text"
                  value={profile.nationality}
                  onChange={(e) => setProfile({ ...profile, nationality: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Residence</label>
                <input
                  type="text"
                  value={profile.currentResidence}
                  onChange={(e) => setProfile({ ...profile, currentResidence: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Current / Recent Position
                </label>
                <input
                  type="text"
                  value={profile.currentOrRecentPosition}
                  onChange={(e) =>
                    setProfile({ ...profile, currentOrRecentPosition: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Education Degree</label>
                <input
                  type="text"
                  value={profile.educationDegree}
                  onChange={(e) => setProfile({ ...profile, educationDegree: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Field of Study</label>
                <input
                  type="text"
                  value={profile.fieldOfStudy}
                  onChange={(e) => setProfile({ ...profile, fieldOfStudy: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  University / Institution
                </label>
                <input
                  type="text"
                  value={profile.institution}
                  onChange={(e) => setProfile({ ...profile, institution: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Total Banking Experience (Years)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={profile.totalBankingYears}
                  onChange={(e) =>
                    setProfile({ ...profile, totalBankingYears: Number(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Branch Manager Experience (Years)
                </label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={profile.branchManagerYears}
                  onChange={(e) =>
                    setProfile({ ...profile, branchManagerYears: Number(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Minimum Gross Monthly USD (&ge;$3,000)
                </label>
                <input
                  type="number"
                  min={3000}
                  max={50000}
                  value={profile.minimumMonthlyGrossUsd}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      minimumMonthlyGrossUsd: Math.max(3000, Number(e.target.value) || 3000),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Core Banking &amp; Finance Skills (comma-separated)
                </label>
                <textarea
                  rows={2}
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Banks / Employers Worked At (comma-separated)
                </label>
                <textarea
                  rows={2}
                  value={employersText}
                  onChange={(e) => setEmployersText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profile.hasMastersDegree}
                    onChange={(e) => setProfile({ ...profile, hasMastersDegree: e.target.checked })}
                    className="accent-emerald-600"
                  />
                  <span>Hold Master&apos;s Degree</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profile.hasEnglishTest}
                    onChange={(e) => setProfile({ ...profile, hasEnglishTest: e.target.checked })}
                    className="accent-emerald-600"
                  />
                  <span>Have IELTS / TOEFL Score</span>
                </label>
                {!isOwnerAccountProfile && (
                  <button
                    type="button"
                    onClick={handleResetProfile}
                    className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isSavingProfile ? 'Saving...' : 'Save Profile & Re-Match'}
              </button>
            </div>
          </div>
        )}

        {/* Dedicated 4-Region Scope Selector (Africa Intl Banks/Companies, Middle East, Europe, Scandinavian ONLY) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                'ALL',
                'Scandinavian',
                'Europe',
                'Middle East',
                'Africa (International Banks & Companies)',
              ] as Array<'ALL' | BranchManagerRegionScope>
            ).map((reg) => {
              const active = regionFilter === reg;
              return (
                <button
                  key={reg}
                  type="button"
                  onClick={() => setRegionFilter(reg)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0B132B] text-white border-[#0B132B]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {reg === 'ALL' ? 'All 4 Allowed Regions' : reg}{' '}
                  <span className="opacity-75 tabular-nums">({countsByRegion[reg] ?? 0})</span>
                </button>
              );
            })}
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, international bank, country, city, or sponsorship..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-emerald-600 outline-none bg-slate-50/50"
              />
            </div>

            <div className="md:col-span-4">
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white outline-none"
              >
                <option value="ALL">All Target Senior Banking &amp; Finance Roles</option>
                {TARGET_BRANCH_MANAGER_POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={minSalaryUsd}
                onChange={(e) => setMinSalaryUsd(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white outline-none"
              >
                <option value={3000}>Gross Base &gt; $3,000 / mo ($36k/yr)</option>
                <option value={5000}>Gross Base &ge; $5,000 / mo ($60k/yr)</option>
                <option value={7500}>Gross Base &ge; $7,500 / mo ($90k/yr)</option>
                <option value={10000}>Gross Base &ge; $10,000 / mo ($120k/yr)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center space-y-3">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              Scanning live official portals &amp; verifying $3,000+ gross salary and visa
              sponsorship gates...
            </p>
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
            <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto" />
            <h2 className="text-base font-bold text-[#0B132B]">
              No Live Openings Currently Pass All 6 Strict Verification Gates Under This Filter
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Per strict zero-fabrication rules, postings with undisclosed base salaries, salaries
              at or below USD 3,000/month, unconfirmed visa sponsorship, local-only hiring, or
              locations outside Africa (International Banks &amp; Companies), Middle East, Europe,
              and Scandinavia are strictly excluded.{' '}
              {response && (
                <span>
                  ({response.audit.totalCandidatesScanned.toLocaleString()} live postings were
                  audited; {response.audit.excludedUndisclosedSalary} had undisclosed salaries and{' '}
                  {response.audit.excludedUnconfirmedVisaSponsorship} lacked explicit sponsorship
                  text.)
                </span>
              )}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              {regionFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setRegionFilter('ALL')}
                  className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Show All 4 Allowed Regions
                </button>
              )}
              <button
                type="button"
                onClick={handleRunLiveScan}
                disabled={isScanningLive}
                className="px-4 py-2 rounded-lg bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                {isScanningLive ? 'Scanning...' : 'Re-Scan Live Official Portals Now'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 px-1">
              <span>
                Showing <strong className="text-slate-900">{visibleJobs.length}</strong> verified
                visa-sponsored openings above{' '}
                <strong className="text-slate-900">${minSalaryUsd.toLocaleString()}/month</strong>{' '}
                ranked by sponsorship strength, salary, Ethiopian eligibility &amp; profile match.
              </span>
              {response?.lastDiscoveryAt && (
                <span className="text-[11px] text-slate-400">
                  Last live scan: {new Date(response.lastDiscoveryAt).toLocaleString()}
                </span>
              )}
            </div>

            {visibleJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-emerald-600 p-5 hover:border-slate-300 transition-colors space-y-3.5"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        Confirmed Visa Sponsorship
                      </span>
                      <span className="font-semibold text-slate-700">{job.regionScope}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-600">{job.matchedTargetPosition}</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#0B132B] leading-snug">
                      {job.jobTitle}
                    </h3>
                    <div className="text-xs font-semibold text-slate-700 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span>{job.employerName}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-normal text-slate-600">
                        {job.city}, {job.country}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-emerald-700 font-semibold tabular-nums">
                        {job.profileMatchPercentage}% Profile Match
                      </span>
                    </div>
                  </div>

                  <div className="md:text-right shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                    <div className="text-lg font-bold text-emerald-800 tabular-nums">
                      ${job.grossMonthlySalaryUsd.toLocaleString()} / mo USD
                    </div>
                    <div className="text-[11px] text-slate-600">{job.originalSalaryDisplay}</div>
                    <div className="text-[10px] text-slate-400">{job.exchangeRateUsed}</div>
                  </div>
                </div>

                {/* Visa Sponsorship Evidence */}
                <div className="text-xs text-slate-700 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                  <strong className="text-emerald-900">Visa Sponsorship Evidence:</strong>{' '}
                  &ldquo;{job.visaSponsorshipEvidence}&rdquo;
                </div>

                {/* Why You Qualify + Gaps Snapshot */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-800">Why You Qualify:</span>{' '}
                    <span className="text-slate-600">{job.whyYouQualify.slice(0, 2).join(' ')}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">Gaps / To Confirm:</span>{' '}
                    <span className="text-slate-600">
                      {job.gapsOrUnmetRequirements.length > 0
                        ? job.gapsOrUnmetRequirements[0]
                        : 'No mandatory credential gaps flagged.'}
                    </span>
                  </div>
                </div>

                {/* Metadata & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span>Ethiopian Applicants: Confirmed Eligible</span>
                    <span>Posted: {job.datePosted}</span>
                    <span>Deadline: {job.applicationDeadline}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedJob(job)}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold transition-colors cursor-pointer"
                    >
                      <span>View Full 19-Point Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={job.officialApplicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white font-semibold transition-colors"
                    >
                      <span>Apply Official</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const SpecCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</div>
    <div className="text-xs text-slate-800 leading-relaxed">{value}</div>
  </div>
);
