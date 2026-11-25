import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  Droplets,
  ExternalLink,
  Filter,
  Globe,
  GraduationCap,
  History,
  Info,
  Landmark,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
  AlertTriangle,
  Sparkles,
  FileCheck2,
  Plus,
  Trash2,
} from 'lucide-react';
import { JobSeekerProfile } from '../types/jobSeeker';
import {
  ApplicationTrackerStage,
  BENCHMARK_BANKING_MANAGER_PRESET,
  CountryRecommendationIntel,
  DEFAULT_GENERAL_MIGRATION_PROFILE,
  EligibilityClassification,
  EvaluatedMigrationOpportunity,
  GlobalMigrationHubEvaluationResponse,
  MigrationProfileInput,
  OfficialImmigration13PointRecord,
  UserApplicationTrackerItem,
  UserMigrationWorkspace,
} from '../types/globalMigrationHub';
import {
  evaluateGlobalMigrationHub,
  fetchUserMigrationWorkspace,
  loadGuestMigrationWorkspace,
  saveGuestMigrationWorkspace,
  saveUserMigrationWorkspace,
  triggerMigrationChangeRefresh,
} from '../lib/globalMigrationHubService';

interface Props {
  onBack: () => void;
  userProfile?: JobSeekerProfile | null;
  onOpenAuth?: () => void;
}

type HubTab =
  | 'opportunities'
  | 'countries_pr'
  | 'wash'
  | 'scholarships'
  | 'profile_tracker'
  | 'changes';

const TRACKER_STAGES: ApplicationTrackerStage[] = [
  'Researching',
  'Preparing Documents',
  'Applied',
  'Interview',
  'Offer',
  'Closed',
];

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'Just now';
  const diffMs = Date.now() - Date.parse(iso);
  if (Number.isNaN(diffMs) || diffMs < 60_000) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function classificationStyles(cls: EligibilityClassification): {
  badge: string;
  border: string;
  label: string;
} {
  if (cls === 'HIGHLY SUITABLE') {
    return {
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      border: 'border-l-emerald-600',
      label: 'HIGHLY SUITABLE',
    };
  }
  if (cls === 'POTENTIALLY SUITABLE') {
    return {
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      border: 'border-l-amber-500',
      label: 'POTENTIALLY SUITABLE',
    };
  }
  return {
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    border: 'border-l-slate-400',
    label: 'NOT ELIGIBLE',
  };
}

export const GlobalMigrationHubView: React.FC<Props> = ({
  onBack,
  userProfile,
  onOpenAuth,
}) => {
  const isSignedIn = Boolean(userProfile?.uid);

  const [activeTab, setActiveTab] = useState<HubTab>('opportunities');
  const [workspace, setWorkspace] = useState<UserMigrationWorkspace>(() =>
    loadGuestMigrationWorkspace()
  );
  const [evaluation, setEvaluation] = useState<GlobalMigrationHubEvaluationResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshingChanges, setIsRefreshingChanges] = useState<boolean>(false);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [suitabilityFilter, setSuitabilityFilter] = useState<
    'all' | 'HIGHLY SUITABLE' | 'POTENTIALLY SUITABLE' | 'NOT ELIGIBLE'
  >('all');
  const [matchVisibility, setMatchVisibility] = useState<'matching' | 'all' | 'non_matching'>('matching');
  const [budgetFriendlyOnly, setBudgetFriendlyOnly] = useState(false);
  const [applyFromEthiopiaOnly, setApplyFromEthiopiaOnly] = useState(false);
  const [selectedCountriesOnly, setSelectedCountriesOnly] = useState(false);
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [newOrUpdatedOnly, setNewOrUpdatedOnly] = useState(false);
  const [scholarshipExperienceOnly, setScholarshipExperienceOnly] = useState(true);

  // Selected detail modals
  const [inspectOpportunity, setInspectOpportunity] =
    useState<EvaluatedMigrationOpportunity | null>(null);
  const [inspectPathway, setInspectPathway] =
    useState<OfficialImmigration13PointRecord | null>(null);

  // Profile editor draft inputs
  const [skillsDraft, setSkillsDraft] = useState('');
  const [sectorsDraft, setSectorsDraft] = useState('');
  const [customCountryInput, setCustomCountryInput] = useState('');

  // Load workspace on mount / auth change (strictly per-user on server when signed in, guest localStorage otherwise)
  useEffect(() => {
    let cancelled = false;
    async function initWorkspace() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        let loaded: UserMigrationWorkspace | null = null;
        if (isSignedIn) {
          loaded = await fetchUserMigrationWorkspace();
        }
        const resolved = loaded || loadGuestMigrationWorkspace();
        // If signed in and server profile has no fieldOfStudy yet, lightly prefill from their own Hopeland profile
        if (
          isSignedIn &&
          userProfile &&
          !resolved.profile.fieldOfStudy &&
          !resolved.profile.currentOrRecentRole
        ) {
          const derivedRole = userProfile.currentPosition || userProfile.desiredJobTitle || '';
          const derivedField = userProfile.education?.[0]?.fieldOfStudy || userProfile.preferredIndustry || '';
          const derivedYears = parseInt(String(userProfile.yearsOfExperience || '0').replace(/[^0-9]/g, ''), 10) || 0;
          if (derivedRole || derivedField || derivedYears > 0) {
            resolved.profile = {
              ...resolved.profile,
              fieldOfStudy: derivedField || resolved.profile.fieldOfStudy,
              currentOrRecentRole: derivedRole || resolved.profile.currentOrRecentRole,
              totalExperienceYears: derivedYears || resolved.profile.totalExperienceYears,
              coreSkills:
                Array.isArray(userProfile.skills) && userProfile.skills.length > 0
                  ? userProfile.skills.slice(0, 15)
                  : resolved.profile.coreSkills,
            };
          }
        }
        if (cancelled) return;
        setWorkspace(resolved);
        setSkillsDraft(resolved.profile.coreSkills.join(', '));
        setSectorsDraft(resolved.profile.targetSectors.join(', '));

        const evalRes = await evaluateGlobalMigrationHub({
          profile: resolved.profile,
          selectedCountries: resolved.selectedCountries,
        });
        if (!cancelled) {
          setEvaluation(evalRes);
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMessage(err?.message || 'Unable to load Global Migration & Career intelligence.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    initWorkspace();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userProfile?.uid]);

  const persistWorkspace = useCallback(
    async (next: UserMigrationWorkspace, reEvaluate = false) => {
      setWorkspace(next);
      if (isSignedIn) {
        setIsSavingWorkspace(true);
        try {
          await saveUserMigrationWorkspace(next);
        } catch (err: any) {
          setErrorMessage(err?.message || 'Could not sync workspace to your account.');
        } finally {
          setIsSavingWorkspace(false);
        }
      } else {
        saveGuestMigrationWorkspace(next);
      }

      if (reEvaluate) {
        setIsLoading(true);
        try {
          const evalRes = await evaluateGlobalMigrationHub({
            profile: next.profile,
            selectedCountries: next.selectedCountries,
          });
          setEvaluation(evalRes);
        } catch (err: any) {
          setErrorMessage(err?.message || 'Could not re-evaluate opportunities.');
        } finally {
          setIsLoading(false);
        }
      }
    },
    [isSignedIn]
  );

  const handleToggleSelectCountry = async (countryName: string) => {
    const exists = workspace.selectedCountries.some(
      (c) => c.toLowerCase() === countryName.toLowerCase()
    );
    const nextCountries = exists
      ? workspace.selectedCountries.filter((c) => c.toLowerCase() !== countryName.toLowerCase())
      : [...workspace.selectedCountries, countryName];

    const nextWs: UserMigrationWorkspace = {
      ...workspace,
      selectedCountries: nextCountries,
      updatedAt: new Date().toISOString(),
    };
    setStatusMessage(
      exists
        ? `Removed ${countryName} from your selected focus countries.`
        : `Added ${countryName} to your selected focus countries — opportunities prioritized.`
    );
    await persistWorkspace(nextWs, true);
  };

  const handleAddCustomCountry = async () => {
    const clean = customCountryInput.trim();
    if (!clean) return;
    setCustomCountryInput('');
    await handleToggleSelectCountry(clean);
  };

  const handleToggleSaveOpportunity = async (opp: EvaluatedMigrationOpportunity) => {
    const isSaved = workspace.savedOpportunityIds.includes(opp.id);
    const nextSaved = isSaved
      ? workspace.savedOpportunityIds.filter((id) => id !== opp.id)
      : [opp.id, ...workspace.savedOpportunityIds];

    let nextTracker = [...workspace.applicationTracker];
    if (!isSaved && !nextTracker.some((item) => item.opportunityId === opp.id)) {
      nextTracker = [
        {
          opportunityId: opp.id,
          title: opp.title,
          employerOrInstitution: opp.employerOrInstitution,
          country: opp.country,
          officialUrl: opp.directOfficialLink,
          stage: 'Researching',
          notes: '',
          updatedAt: new Date().toISOString(),
        },
        ...nextTracker,
      ];
    }

    await persistWorkspace(
      {
        ...workspace,
        savedOpportunityIds: nextSaved,
        applicationTracker: nextTracker,
        updatedAt: new Date().toISOString(),
      },
      false
    );
  };

  const handleUpdateTrackerStage = async (
    opportunityId: string,
    stage: ApplicationTrackerStage
  ) => {
    const nextTracker = workspace.applicationTracker.map((item) =>
      item.opportunityId === opportunityId
        ? { ...item, stage, updatedAt: new Date().toISOString() }
        : item
    );
    await persistWorkspace(
      { ...workspace, applicationTracker: nextTracker, updatedAt: new Date().toISOString() },
      false
    );
  };

  const handleUpdateTrackerNotes = async (opportunityId: string, notes: string) => {
    const nextTracker = workspace.applicationTracker.map((item) =>
      item.opportunityId === opportunityId
        ? { ...item, notes, updatedAt: new Date().toISOString() }
        : item
    );
    await persistWorkspace(
      { ...workspace, applicationTracker: nextTracker, updatedAt: new Date().toISOString() },
      false
    );
  };

  const handleRemoveTrackerItem = async (opportunityId: string) => {
    const nextTracker = workspace.applicationTracker.filter(
      (item) => item.opportunityId !== opportunityId
    );
    const nextSaved = workspace.savedOpportunityIds.filter((id) => id !== opportunityId);
    await persistWorkspace(
      {
        ...workspace,
        savedOpportunityIds: nextSaved,
        applicationTracker: nextTracker,
        updatedAt: new Date().toISOString(),
      },
      false
    );
  };

  const handleSaveProfileAndEvaluate = async () => {
    const parsedSkills = skillsDraft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedSectors = sectorsDraft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const nextWs: UserMigrationWorkspace = {
      ...workspace,
      profile: {
        ...workspace.profile,
        coreSkills: parsedSkills,
        targetSectors: parsedSectors,
      },
      updatedAt: new Date().toISOString(),
    };
    setStatusMessage('Profile saved and all opportunities re-evaluated honestly against your criteria.');
    await persistWorkspace(nextWs, true);
  };

  const handleLoadBankingBenchmarkPreset = async () => {
    const presetProfile: MigrationProfileInput = {
      ...BENCHMARK_BANKING_MANAGER_PRESET,
      coreSkills: [...BENCHMARK_BANKING_MANAGER_PRESET.coreSkills],
      targetSectors: [...BENCHMARK_BANKING_MANAGER_PRESET.targetSectors],
    };
    setSkillsDraft(presetProfile.coreSkills.join(', '));
    setSectorsDraft(presetProfile.targetSectors.join(', '));
    const nextWs: UserMigrationWorkspace = {
      ...workspace,
      profile: presetProfile,
      selectedCountries:
        workspace.selectedCountries.length > 0
          ? workspace.selectedCountries
          : ['Saudi Arabia', 'United Arab Emirates', 'Germany', 'Canada', 'Australia'],
      updatedAt: new Date().toISOString(),
    };
    setStatusMessage(
      'Loaded Banking Branch Manager benchmark profile (9 yrs, BA Accounting & Finance, <$500 budget) into your private workspace.'
    );
    await persistWorkspace(nextWs, true);
  };

  const handleResetProfile = async () => {
    const cleanProfile: MigrationProfileInput = {
      ...DEFAULT_GENERAL_MIGRATION_PROFILE,
      coreSkills: [],
      targetSectors: [...DEFAULT_GENERAL_MIGRATION_PROFILE.targetSectors],
    };
    setSkillsDraft('');
    setSectorsDraft(cleanProfile.targetSectors.join(', '));
    const nextWs: UserMigrationWorkspace = {
      ...workspace,
      profile: cleanProfile,
      updatedAt: new Date().toISOString(),
    };
    setStatusMessage('Reset profile to clean defaults.');
    await persistWorkspace(nextWs, true);
  };

  const handleManualChangeCheck = async () => {
    setIsRefreshingChanges(true);
    setErrorMessage(null);
    try {
      const checkRes = await triggerMigrationChangeRefresh();
      const evalRes = await evaluateGlobalMigrationHub({
        profile: workspace.profile,
        selectedCountries: workspace.selectedCountries,
      });
      setEvaluation(evalRes);
      setStatusMessage(
        checkRes.meaningfulChangeDetected
          ? 'Monitoring check completed: new or updated opportunities detected and recorded in Change History.'
          : 'Monitoring check completed: all verified listings are up to date with no new changes since the last sweep.'
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not run monitoring check.');
    } finally {
      setIsRefreshingChanges(false);
    }
  };

  // Derived lists
  const allOpportunities = evaluation?.opportunities || [];

  const mainCareerOpportunities = useMemo(() => {
    return allOpportunities.filter((opp) => {
      // Keep WASH separated into its own clear tab (Section 12) unless user specifically searched "wash"
      if (opp.isWashOpportunity && !searchQuery.toLowerCase().includes('wash')) return false;

      if (matchVisibility === 'matching' && !opp.matchesUserProfile) return false;
      if (matchVisibility === 'non_matching' && opp.matchesUserProfile) return false;

      if (suitabilityFilter !== 'all' && opp.eligibilityClassification !== suitabilityFilter) {
        return false;
      }
      if (budgetFriendlyOnly && opp.costBreakdown.withinUserBudget !== 'Yes') return false;
      if (applyFromEthiopiaOnly && opp.canApplyFromEthiopia !== 'Yes') return false;
      if (selectedCountriesOnly && !opp.isInSelectedCountry) return false;
      if (countryFilter !== 'ALL' && opp.country !== countryFilter) return false;
      if (newOrUpdatedOnly && opp.changeStatus === 'unchanged') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${opp.title} ${opp.employerOrInstitution} ${opp.country} ${opp.sector} ${opp.visaOrImmigrationRoute} ${opp.suitabilityExplanation}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    allOpportunities,
    matchVisibility,
    suitabilityFilter,
    budgetFriendlyOnly,
    applyFromEthiopiaOnly,
    selectedCountriesOnly,
    countryFilter,
    newOrUpdatedOnly,
    searchQuery,
  ]);

  const washOpportunities = useMemo(() => {
    return allOpportunities.filter((opp) => {
      if (!opp.isWashOpportunity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return `${opp.title} ${opp.employerOrInstitution} ${opp.country} ${opp.suitabilityExplanation}`
          .toLowerCase()
          .includes(q);
      }
      return true;
    });
  }, [allOpportunities, searchQuery]);

  const scholarshipOpportunities = useMemo(() => {
    return allOpportunities.filter((opp) => {
      if (!opp.isScholarshipOrTraining) return false;
      if (scholarshipExperienceOnly && !opp.valuesExperienceOverGpa) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return `${opp.title} ${opp.employerOrInstitution} ${opp.country} ${opp.salaryOrFunding}`
          .toLowerCase()
          .includes(q);
      }
      return true;
    });
  }, [allOpportunities, scholarshipExperienceOnly, searchQuery]);

  const availableCountriesForFilter = useMemo(() => {
    const set = new Set<string>();
    for (const o of allOpportunities) set.add(o.country);
    return Array.from(set).sort();
  }, [allOpportunities]);

  const savedSet = useMemo(
    () => new Set(workspace.savedOpportunityIds),
    [workspace.savedOpportunityIds]
  );

  const selectedCountriesIntel = useMemo(
    () => (evaluation?.recommendedCountries || []).filter((c) => c.isSelectedByUser),
    [evaluation]
  );

  const researchRecommendedCountriesIntel = useMemo(
    () => (evaluation?.recommendedCountries || []).filter((c) => c.isRecommendedByResearch),
    [evaluation]
  );

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-slate-900">
      {/* Top Bar */}
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
                    Global Career &amp; Legal Migration Hub
                  </h1>
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    Verified Official Sources Only
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
                  Honest eligibility assessment, employer-sponsored relocation analysis, 13-point
                  government legal migration &amp; PR rules, and personal application tracking for
                  Ethiopian and eligible international professionals.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="text-right hidden sm:block">
                <div className="text-[11px] font-medium text-slate-500">
                  30-Min Change Monitor · Updated {formatRelativeTime(evaluation?.lastRefreshAt)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {isSignedIn
                    ? 'Private workspace synced to your account'
                    : 'Guest mode (saved locally in this browser)'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleManualChangeCheck}
                disabled={isRefreshingChanges}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-emerald-600 ${
                    isRefreshingChanges ? 'animate-spin' : ''
                  }`}
                />
                <span>{isRefreshingChanges ? 'Checking...' : 'Check Updates'}</span>
              </button>
              {!isSignedIn && onOpenAuth && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Sign In to Sync</span>
                </button>
              )}
            </div>
          </div>

          {/* Primary Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pt-4 -mb-px scrollbar-hide">
            {[
              {
                id: 'opportunities' as HubTab,
                label: 'Matched & Global Jobs',
                count: evaluation?.summary.matchingProfileCount,
                icon: Briefcase,
              },
              {
                id: 'countries_pr' as HubTab,
                label: 'Countries & 13-Point Legal Migration / PR',
                count: evaluation?.immigrationPathways13Point.length,
                icon: Landmark,
              },
              {
                id: 'wash' as HubTab,
                label: 'WASH Opportunities',
                count: evaluation?.summary.washOpportunitiesCount,
                icon: Droplets,
              },
              {
                id: 'scholarships' as HubTab,
                label: 'Scholarships, Training & Conferences',
                count: evaluation?.summary.scholarshipsAndTrainingCount,
                icon: GraduationCap,
              },
              {
                id: 'profile_tracker' as HubTab,
                label: 'My Profile, Saved & Tracker',
                count: workspace.applicationTracker.length,
                icon: SlidersHorizontal,
              },
              {
                id: 'changes' as HubTab,
                label: '30-Min Change History',
                count: evaluation?.changeHistory.length,
                icon: History,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-[#16A34A] text-[#0B132B]'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#16A34A]' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                      ({tab.count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Feedback Banners */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-700 font-semibold hover:underline cursor-pointer"
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
              className="text-emerald-700 font-semibold hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active Profile Strip & Summary KPIs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Assessment Profile ({workspace.profile.nationality} · Resident in{' '}
                {workspace.profile.currentResidence})
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {workspace.profile.currentOrRecentRole || 'General Professional Profile'}
                {workspace.profile.fieldOfStudy ? ` · ${workspace.profile.fieldOfStudy}` : ''} ·{' '}
                {workspace.profile.highestEducation} · {workspace.profile.totalExperienceYears} yrs
                exp · Budget ≤ ${workspace.profile.maxUpfrontBudgetUsd.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">
                Master&apos;s degree: {workspace.profile.hasMastersDegree ? 'Yes' : 'No (never auto-excluded unless mandatory)'} ·
                IELTS/TOEFL: {workspace.profile.hasEnglishTest ? workspace.profile.englishTestDetails || 'Yes' : 'Not yet (checked per listing)'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleLoadBankingBenchmarkPreset}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>Load Banking Branch Manager Preset (9 yrs, &lt;$500 Budget)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('profile_tracker')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Customize My Profile</span>
              </button>
            </div>
          </div>

          {/* Clean Numeric Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 pt-4">
            <div>
              <div className="text-[11px] font-medium text-slate-500">Active Verified</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums">
                {evaluation?.summary.totalActiveVerified ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-emerald-700">Highly Suitable</div>
              <div className="text-xl font-bold text-emerald-700 tabular-nums">
                {evaluation?.summary.highlySuitableCount ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-amber-700">Potentially Suitable</div>
              <div className="text-xl font-bold text-amber-700 tabular-nums">
                {evaluation?.summary.potentiallySuitableCount ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Apply From Ethiopia</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums">
                {evaluation?.summary.applyFromEthiopiaCount ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">
                Budget ≤ ${workspace.profile.maxUpfrontBudgetUsd}
              </div>
              <div className="text-xl font-bold text-slate-900 tabular-nums">
                {evaluation?.summary.budgetFriendlyCount ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Your Focus Countries</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums">
                {workspace.selectedCountries.length}
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && !evaluation ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center space-y-3">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              Evaluating verified global opportunities &amp; 13-point official migration routes...
            </p>
          </div>
        ) : null}

        {/* ================================================================= */}
        {/* TAB 1: MATCHED & GLOBAL OPPORTUNITIES */}
        {/* ================================================================= */}
        {!isLoading && evaluation && activeTab === 'opportunities' && (
          <div className="space-y-5">
            {/* Selected Countries vs Research Recommended Quick Strip */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-800">
                  Selected Focus Countries vs. Research-Recommended Priority Countries
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('countries_pr')}
                  className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer self-start sm:self-auto"
                >
                  Manage all countries &amp; 13-point PR rules →
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {['Saudi Arabia', 'United Arab Emirates', 'Germany', 'Canada', 'Australia', 'United Kingdom', 'Ireland', 'Netherlands'].map(
                  (cName) => {
                    const selected = workspace.selectedCountries.some(
                      (sc) => sc.toLowerCase() === cName.toLowerCase()
                    );
                    return (
                      <button
                        key={cName}
                        type="button"
                        onClick={() => handleToggleSelectCountry(cName)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#0B132B] text-white border-[#0B132B]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {selected ? `✓ ${cName} (Selected)` : `+ ${cName}`}
                      </button>
                    );
                  }
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Selected countries are prioritized first while verified opportunities from other
                recommended countries remain visible below so strong options are never missed.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search role, bank, organization, country, or visa route..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:border-emerald-600 outline-none bg-slate-50/50"
                  />
                </div>
                <div className="md:col-span-3">
                  <select
                    value={matchVisibility}
                    onChange={(e) => setMatchVisibility(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white outline-none"
                  >
                    <option value="matching">
                      Matches Your Profile ({evaluation.summary.matchingProfileCount})
                    </option>
                    <option value="all">
                      All Verified Opportunities ({evaluation.summary.totalActiveVerified})
                    </option>
                    <option value="non_matching">
                      Does Not Match Profile ({evaluation.summary.nonMatchingCount})
                    </option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={suitabilityFilter}
                    onChange={(e) => setSuitabilityFilter(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white outline-none"
                  >
                    <option value="all">All Eligibility Levels</option>
                    <option value="HIGHLY SUITABLE">Highly Suitable</option>
                    <option value="POTENTIALLY SUITABLE">Potentially Suitable</option>
                    <option value="NOT ELIGIBLE">Not Eligible</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white outline-none"
                  >
                    <option value="ALL">All Countries</option>
                    {availableCountriesForFilter.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-700">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={budgetFriendlyOnly}
                    onChange={(e) => setBudgetFriendlyOnly(e.target.checked)}
                    className="rounded border-slate-300 accent-emerald-600"
                  />
                  <span>Budget-Friendly (≤ ${workspace.profile.maxUpfrontBudgetUsd} / Employer-Funded)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyFromEthiopiaOnly}
                    onChange={(e) => setApplyFromEthiopiaOnly(e.target.checked)}
                    className="rounded border-slate-300 accent-emerald-600"
                  />
                  <span>Can Apply Directly from Ethiopia</span>
                </label>
                {workspace.selectedCountries.length > 0 && (
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCountriesOnly}
                      onChange={(e) => setSelectedCountriesOnly(e.target.checked)}
                      className="rounded border-slate-300 accent-emerald-600"
                    />
                    <span>Only My Selected Countries</span>
                  </label>
                )}
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newOrUpdatedOnly}
                    onChange={(e) => setNewOrUpdatedOnly(e.target.checked)}
                    className="rounded border-slate-300 accent-emerald-600"
                  />
                  <span>New &amp; Updated Only</span>
                </label>
              </div>
            </div>

            {/* Opportunity List */}
            {mainCareerOpportunities.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 py-14 px-6 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-900">
                  No verified opportunities match the active filter combination.
                </p>
                <p className="text-xs text-slate-500">
                  Try widening your country filter, switching to &ldquo;All Verified
                  Opportunities&rdquo;, or updating your profile skills.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-600 px-1">
                  Showing <strong className="text-slate-900">{mainCareerOpportunities.length}</strong>{' '}
                  verified opportunities (WASH listings are shown separately in the WASH tab).
                </div>
                {mainCareerOpportunities.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opp={opp}
                    isSaved={savedSet.has(opp.id)}
                    onToggleSave={() => handleToggleSaveOpportunity(opp)}
                    onInspect={() => setInspectOpportunity(opp)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: COUNTRIES RECRUITING & 13-POINT LEGAL MIGRATION / PR */}
        {/* ================================================================= */}
        {!isLoading && evaluation && activeTab === 'countries_pr' && (
          <div className="space-y-6">
            {/* Official Honesty Notice */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-amber-950 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold">
                  Strict Immigration Accuracy Notice — Temporary Work Visas vs. Permanent Residence
                </div>
                <p className="leading-relaxed text-amber-900/90">
                  {evaluation.officialDisclaimer} Temporary work permits (such as Gulf Iqama / UAE
                  Employment Visas) are explicitly marked as <strong>Temporary Work Visa (No Direct PR)</strong>{' '}
                  and are never presented as free or automatic permanent residence.
                </p>
              </div>
            </div>

            {/* Section A: Your Selected Countries vs Research-Recommended Countries */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Your Selected Countries */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#0B132B]">
                      Countries You Selected ({selectedCountriesIntel.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Prioritized across job search and immigration monitoring.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCountryInput}
                    onChange={(e) => setCustomCountryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCustomCountry();
                    }}
                    placeholder="Add any country (e.g., Qatar, Luxembourg, Kenya)..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCountry}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {selectedCountriesIntel.length === 0 ? (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-4 border border-slate-100">
                    No focus countries selected yet. Click any recommended country on the right or
                    type a country name above to prioritize it in your search.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {selectedCountriesIntel.map((c) => (
                      <div key={c.country} className="p-3.5 flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-sm font-semibold text-slate-900">
                            {c.country}{' '}
                            <span className="text-[11px] font-normal text-slate-500">
                              · {c.region}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600">{c.whyRecommended}</div>
                          <div className="text-[11px] text-slate-500 pt-1 tabular-nums">
                            {c.activeOpportunityCount} active verified · {c.highlySuitableCount}{' '}
                            highly suitable · {c.pathwayTypeLabel}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleSelectCountry(c.country)}
                          className="text-xs text-rose-700 hover:underline font-medium shrink-0 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Research-Recommended Countries */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-[#0B132B]">
                    Countries Recommended by Research ({researchRecommendedCountriesIntel.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Prioritizes Saudi Arabia &amp; UAE for employer-funded relocation, and Germany,
                    Canada, Australia &amp; Europe for career growth and long-term legal settlement.
                  </p>
                </div>

                <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {researchRecommendedCountriesIntel.map((c) => (
                    <div key={c.country} className="p-3.5 flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">{c.country}</span>
                          <span className="text-[11px] text-slate-500">{c.tierLabel}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{c.whyRecommended}</p>
                        <div className="text-[11px] text-slate-500 pt-1 tabular-nums">
                          {c.activeOpportunityCount} active verified · {c.budgetFriendlyCount}{' '}
                          budget-friendly
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSelectCountry(c.country)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 border transition-colors cursor-pointer ${
                          c.isSelectedByUser
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {c.isSelectedByUser ? 'Selected ✓' : '+ Select'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Section B: Complete 13-Point Legal Immigration & Permanent Residence Directory */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-[#0B132B]">
                    13-Point Legal Immigration, Work Visa &amp; Permanent Residence Directory
                  </h2>
                  <p className="text-xs text-slate-600">
                    Click any country below to inspect all 13 verified legal migration questions
                    including Ethiopia offshore eligibility, costs, proof of funds, family
                    reunification, and official government links.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {evaluation.immigrationPathways13Point.map((p) => {
                  const style = classificationStyles(p.eligibilityClassification);
                  return (
                    <div
                      key={p.id}
                      className={`bg-white rounded-xl border border-slate-200 border-l-4 ${style.border} p-4 flex flex-col justify-between gap-3`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-[#0B132B]">{p.country}</h3>
                              <span className="text-[11px] font-medium text-slate-500">
                                {p.region}
                              </span>
                              {p.isSelectedByUser && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#0B132B] text-white">
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-slate-700 mt-0.5">
                              {p.programName}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${style.badge}`}
                          >
                            {style.label}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-slate-800">
                          Route Type:{' '}
                          <span
                            className={
                              p.pathwayCategory === 'Direct Permanent Residence'
                                ? 'text-emerald-700'
                                : p.pathwayCategory === 'Temporary Work Visa Leading to PR'
                                ? 'text-blue-700'
                                : 'text-amber-700'
                            }
                          >
                            {p.pathwayCategory}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">{p.budgetAlert}</p>

                        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600">
                          <div>
                            <span className="font-semibold text-slate-800">Job Offer:</span>{' '}
                            {p.q4_jobOfferNecessary.slice(0, 68)}
                            {p.q4_jobOfferNecessary.length > 68 ? '…' : ''}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800">Timeline:</span>{' '}
                            {p.q12_estimatedTimeline.slice(0, 68)}
                            {p.q12_estimatedTimeline.length > 68 ? '…' : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setInspectPathway(p)}
                          className="text-xs font-semibold text-[#0B132B] hover:text-emerald-700 underline underline-offset-2 cursor-pointer"
                        >
                          View All 13 Official Questions
                        </button>
                        <a
                          href={p.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          <span>Official Gov Portal</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: WASH OPPORTUNITIES (CLEARLY SEPARATED — SECTION 12) */}
        {/* ================================================================= */}
        {!isLoading && evaluation && activeTab === 'wash' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#0B132B]">
                  International WASH (Water, Sanitation &amp; Hygiene) Opportunities
                </h2>
                <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                  Separated cleanly from banking &amp; commercial finance roles. Includes verified
                  UN, UNICEF, WHO, WaterAid, IRC, and international NGO vacancies (including
                  finance/grants roles inside WASH organizations when available).
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter WASH opportunities..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {washOpportunities.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 py-14 text-center text-xs text-slate-500">
                No active verified WASH opportunities match your search query right now.
              </div>
            ) : (
              <div className="space-y-3">
                {washOpportunities.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opp={opp}
                    isSaved={savedSet.has(opp.id)}
                    onToggleSave={() => handleToggleSaveOpportunity(opp)}
                    onInspect={() => setInspectOpportunity(opp)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: EXPERIENCE-VALUED SCHOLARSHIPS, TRAINING & CONFERENCES */}
        {/* ================================================================= */}
        {!isLoading && evaluation && activeTab === 'scholarships' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#0B132B]">
                  Fully Funded Scholarships, Professional Training &amp; Conferences
                </h2>
                <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                  Highlights international programmes open to Ethiopian professionals that value
                  leadership and work experience without requiring an existing Master&apos;s degree,
                  high GPA, or university nomination.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={scholarshipExperienceOnly}
                  onChange={(e) => setScholarshipExperienceOnly(e.target.checked)}
                  className="rounded border-slate-300 accent-emerald-600"
                />
                <span>Prioritize Experience-Valued (No Master&apos;s / High GPA Barrier)</span>
              </label>
            </div>

            {scholarshipOpportunities.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 py-14 text-center text-xs text-slate-500">
                No scholarships, training, or conferences match the active filter. Try unchecking
                the experience-only filter above.
              </div>
            ) : (
              <div className="space-y-3">
                {scholarshipOpportunities.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opp={opp}
                    isSaved={savedSet.has(opp.id)}
                    onToggleSave={() => handleToggleSaveOpportunity(opp)}
                    onInspect={() => setInspectOpportunity(opp)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: MY PROFILE, SAVED & PERSONAL APPLICATION TRACKER */}
        {/* ================================================================= */}
        {activeTab === 'profile_tracker' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Profile Editor */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#0B132B]">
                    Your Private Eligibility Profile
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isSignedIn
                      ? 'Stored privately under your account ID — never visible to other users.'
                      : 'Saved privately in your browser. Sign in anytime to sync across devices.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetProfile}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Reset
                </button>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs text-emerald-950">
                  <strong>Quick Preset:</strong> Load a 9-year Ethiopian Banking Branch Manager
                  benchmark profile (BA Accounting &amp; Finance, &lt;$500 budget).
                </div>
                <button
                  type="button"
                  onClick={handleLoadBankingBenchmarkPreset}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0 cursor-pointer"
                >
                  Load Preset
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={workspace.profile.nationality}
                    onChange={(e) =>
                      setWorkspace((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, nationality: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Current Country of Residence
                  </label>
                  <input
                    type="text"
                    value={workspace.profile.currentResidence}
                    onChange={(e) =>
                      setWorkspace((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, currentResidence: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Highest Education
                  </label>
                  <input
                    type="text"
                    value={workspace.profile.highestEducation}
                    onChange={(e) =>
                      setWorkspace((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, highestEducation: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Field of Study</label>
                  <input
                    type="text"
                    value={workspace.profile.fieldOfStudy}
                    onChange={(e) =>
                      setWorkspace((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, fieldOfStudy: e.target.value },
                      }))
                    }
                    placeholder="e.g., Accounting and Finance"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Current or Recent Role
                  </label>
                  <input
                    type="text"
                    value={workspace.profile.currentOrRecentRole}
                    onChange={(e) =>
                      setWorkspace((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, currentOrRecentRole: e.target.value },
                      }))
                    }
                    placeholder="e.g., Branch Manager"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Maximum Upfront Budget (USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={workspace.profile.maxUpfrontBudgetUsd}
                    onChange={(e) =>
                      setWorkspace((prev) => ({
                        ...prev,
                        profile: {
                          ...prev.profile,
                          maxUpfrontBudgetUsd: Number(e.target.value) || 0,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Total Experience (Years)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={workspace.profile.totalExperienceYears}
                    onChange={(e) =>
                      setWorkspace((prev) => ({
                        ...prev,
                        profile: {
                          ...prev.profile,
                          totalExperienceYears: Number(e.target.value) || 0,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Management Experience (Years)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={workspace.profile.managementExperienceYears}
                    onChange={(e) =>
                      setWorkspace((prev) => ({
                        ...prev,
                        profile: {
                          ...prev.profile,
                          managementExperienceYears: Number(e.target.value) || 0,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workspace.profile.hasMastersDegree}
                    onChange={(e) =>
                      setWorkspace((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, hasMastersDegree: e.target.checked },
                      }))
                    }
                    className="rounded border-slate-300 accent-emerald-600"
                  />
                  <span>I hold a Master&apos;s or postgraduate degree</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workspace.profile.hasEnglishTest}
                    onChange={(e) =>
                      setWorkspace((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, hasEnglishTest: e.target.checked },
                      }))
                    }
                    className="rounded border-slate-300 accent-emerald-600"
                  />
                  <span>I already have an official IELTS / TOEFL / PTE score</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workspace.profile.familyRelocationNeeded}
                    onChange={(e) =>
                      setWorkspace((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, familyRelocationNeeded: e.target.checked },
                      }))
                    }
                    className="rounded border-slate-300 accent-emerald-600"
                  />
                  <span>Plan to reunite spouse / children after initial relocation</span>
                </label>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Core Skills (comma-separated)
                  </label>
                  <textarea
                    rows={3}
                    value={skillsDraft}
                    onChange={(e) => setSkillsDraft(e.target.value)}
                    placeholder="Branch management, Banking operations, Accounting, Credit & loans, Internal controls..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Sectors (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={sectorsDraft}
                    onChange={(e) => setSectorsDraft(e.target.value)}
                    placeholder="Banking & Finance, Microfinance, Risk & Compliance, Accounting & Audit"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveProfileAndEvaluate}
                disabled={isSavingWorkspace}
                className="w-full py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSavingWorkspace
                  ? 'Saving & Re-evaluating...'
                  : 'Save Profile & Re-Evaluate All Global Opportunities'}
              </button>
            </div>

            {/* Saved Opportunities & Application Tracker */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-[#0B132B]">
                  Saved Opportunities &amp; Application Tracker (
                  {workspace.applicationTracker.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bookmark any opportunity to track document preparation, submission dates, and
                  private notes.
                </p>
              </div>

              {workspace.applicationTracker.length === 0 ? (
                <div className="py-12 px-4 text-center bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                  <Bookmark className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">
                    No saved opportunities in your tracker yet
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Click &ldquo;Save &amp; Track&rdquo; on any job, scholarship, or WASH listing to
                    manage your application progress here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {workspace.applicationTracker.map((item) => (
                    <div
                      key={item.opportunityId}
                      className="p-3.5 rounded-xl border border-slate-200 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                          <div className="text-xs text-slate-500">
                            {item.employerOrInstitution} · {item.country}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveTrackerItem(item.opportunityId)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Remove from tracker"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <select
                          value={item.stage}
                          onChange={(e) =>
                            handleUpdateTrackerStage(
                              item.opportunityId,
                              e.target.value as ApplicationTrackerStage
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-slate-50 outline-none"
                        >
                          {TRACKER_STAGES.map((st) => (
                            <option key={st} value={st}>
                              Stage: {st}
                            </option>
                          ))}
                        </select>

                        {item.officialUrl && (
                          <a
                            href={item.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                          >
                            <span>Official Link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <textarea
                        rows={2}
                        value={item.notes}
                        onChange={(e) =>
                          handleUpdateTrackerNotes(item.opportunityId, e.target.value)
                        }
                        placeholder="Private notes (e.g., documents attested, referral contact, interview date)..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-emerald-600"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: 30-MINUTE CHANGE MONITORING HISTORY */}
        {/* ================================================================= */}
        {!isLoading && evaluation && activeTab === 'changes' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-[#0B132B]">
                  30-Minute Continuous Opportunity Change Log
                </h2>
                <p className="text-xs text-slate-600">
                  Tracks meaningful additions, deadline/funding updates, and removal of expired
                  listings automatically every 30 minutes instead of repeating unchanged items.
                </p>
              </div>
              <button
                type="button"
                onClick={handleManualChangeCheck}
                disabled={isRefreshingChanges}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshingChanges ? 'animate-spin' : ''}`}
                />
                <span>Run Change Check Now</span>
              </button>
            </div>

            {evaluation.changeHistory.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                No change history recorded yet. Click &ldquo;Run Change Check Now&rdquo; to
                snapshot current verified listings.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {evaluation.changeHistory.map((ev) => (
                  <div key={ev.id} className="py-3.5 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-900">{ev.summary}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {new Date(ev.detectedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 tabular-nums">
                      <span>New: {ev.newCount}</span>
                      <span>Updated: {ev.updatedCount}</span>
                      <span>Expired/Removed: {ev.expiredRemovedCount}</span>
                      <span>Total Active Verified: {ev.totalActiveVerified}</span>
                    </div>
                    {ev.newTitles.length > 0 && (
                      <div className="text-[11px] text-emerald-800 bg-emerald-50/60 border border-emerald-100 rounded-lg p-2">
                        <strong>Added:</strong> {ev.newTitles.join(' · ')}
                      </div>
                    )}
                    {ev.updatedTitles.length > 0 && (
                      <div className="text-[11px] text-amber-900 bg-amber-50/60 border border-amber-100 rounded-lg p-2">
                        <strong>Updated:</strong> {ev.updatedTitles.join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* MODAL 1: 17-POINT OPPORTUNITY DETAIL INSPECTION (SECTION 14) */}
      {/* ================================================================= */}
      {inspectOpportunity && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      classificationStyles(inspectOpportunity.eligibilityClassification).badge
                    }`}
                  >
                    {inspectOpportunity.eligibilityClassification}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {inspectOpportunity.country} · {inspectOpportunity.sector}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#0B132B] mt-1">
                  {inspectOpportunity.title}
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  {inspectOpportunity.employerOrInstitution}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectOpportunity(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Honest Suitability Explanation */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900">
                  Suitability Assessment &amp; Explanation
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {inspectOpportunity.suitabilityExplanation}
                </p>
                {inspectOpportunity.confirmationNeededItems.length > 0 && (
                  <ul className="list-disc pl-4 text-amber-800 space-y-0.5 pt-1">
                    {inspectOpportunity.confirmationNeededItems.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Structured 17-Point Details Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DetailRow label="1. Opportunity Title" value={inspectOpportunity.title} />
                <DetailRow
                  label="2. Employer / Institution"
                  value={inspectOpportunity.employerOrInstitution}
                />
                <DetailRow
                  label="3. Country & Region"
                  value={`${inspectOpportunity.country} (${inspectOpportunity.region})`}
                />
                <DetailRow
                  label="4. Sector / Category"
                  value={`${inspectOpportunity.sector} · ${inspectOpportunity.category}`}
                />
                <DetailRow
                  label="5. Salary / Funding Package"
                  value={inspectOpportunity.salaryOrFunding}
                />
                <DetailRow
                  label="6. Nationality & Ethiopia Offshore Eligibility"
                  value={`${inspectOpportunity.nationalityEligibility} (Apply from Ethiopia: ${inspectOpportunity.canApplyFromEthiopia})`}
                />
                <DetailRow
                  label="7. Education Requirement"
                  value={`${inspectOpportunity.educationRequirement} (Master's mandatory: ${inspectOpportunity.mastersRequired})`}
                />
                <DetailRow
                  label="8. Experience Requirement"
                  value={inspectOpportunity.experienceRequirement}
                />
                <DetailRow
                  label="9. Language Requirement"
                  value={`${inspectOpportunity.languageRequirement} (IELTS/TOEFL mandatory: ${inspectOpportunity.englishTestRequired})`}
                />
                <DetailRow
                  label="10. Visa / Immigration Route"
                  value={inspectOpportunity.visaOrImmigrationRoute}
                />
                <DetailRow
                  label="11. Costs, Affordability & Who Pays"
                  value={`${inspectOpportunity.costBreakdown.applicationFeeStatus}. ${inspectOpportunity.costBreakdown.whoPaysSummary} Applicant costs: ${inspectOpportunity.costBreakdown.applicantPaidCosts} ${inspectOpportunity.costBreakdown.budgetNote}`}
                />
                <DetailRow
                  label="12. Family Relocation Options"
                  value={inspectOpportunity.familyRelocationOptions}
                />
                <DetailRow
                  label="13. Application Deadline"
                  value={`${inspectOpportunity.deadlineDisplay}${
                    inspectOpportunity.daysRemaining !== null
                      ? ` (${inspectOpportunity.daysRemaining} days remaining)`
                      : ''
                  }`}
                />
                <DetailRow
                  label="14–16. Official Source & Verification"
                  value={`${inspectOpportunity.officialSource} (${inspectOpportunity.sourceDomain || 'Verified official portal'})`}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleToggleSaveOpportunity(inspectOpportunity)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold cursor-pointer"
              >
                {savedSet.has(inspectOpportunity.id) ? (
                  <>
                    <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                    <span>Saved in Tracker</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4" />
                    <span>Save &amp; Track</span>
                  </>
                )}
              </button>

              {inspectOpportunity.directOfficialLink && (
                <a
                  href={inspectOpportunity.directOfficialLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                >
                  <span>17. Open Direct Official Application Link</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: 13-POINT OFFICIAL IMMIGRATION & PR DETAILS (SECTION 7) */}
      {/* ================================================================= */}
      {inspectPathway && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-500">
                    {inspectPathway.region} · {inspectPathway.pathwayCategory}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      classificationStyles(inspectPathway.eligibilityClassification).badge
                    }`}
                  >
                    {inspectPathway.eligibilityClassification}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#0B132B] mt-1">
                  {inspectPathway.country} — {inspectPathway.programName}
                </h3>
                <p className="text-xs text-slate-600">{inspectPathway.officialAuthority}</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectPathway(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                <strong>Budget &amp; Realism Assessment:</strong> {inspectPathway.budgetAlert}
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {[
                  ['1. Can an Ethiopian citizen apply from Ethiopia?', inspectPathway.q1_canEthiopianApplyFromEthiopia],
                  ['2. Education required', inspectPathway.q2_educationRequired],
                  ['3. Years of work experience required', inspectPathway.q3_experienceRequired],
                  ['4. Is a job offer necessary?', inspectPathway.q4_jobOfferNecessary],
                  ['5. Is an English or other language test required?', inspectPathway.q5_languageTestRequired],
                  ['6. Is financial proof (proof of funds) required?', inspectPathway.q6_financialProofRequired],
                  ['7. Official application & processing fees', inspectPathway.q7_officialFees],
                  ['8. Who pays visa, recruitment & relocation expenses?', inspectPathway.q8_whoPaysExpenses],
                  ['9. Can I initially relocate alone?', inspectPathway.q9_canRelocateInitiallyAlone],
                  ['10. When and how can spouse & children join?', inspectPathway.q10_familyReunificationRules],
                  ['11. Does this pathway genuinely lead to Permanent Residence?', inspectPathway.q11_leadsToPermanentResidence],
                  ['12. How long does the process take?', inspectPathway.q12_estimatedTimeline],
                  ['13. Official application procedure & link', inspectPathway.q13_officialProcedureAndLink],
                ].map(([q, ans]) => (
                  <div key={q} className="p-3.5 space-y-1">
                    <div className="font-bold text-slate-900">{q}</div>
                    <div className="text-slate-700 leading-relaxed">{ans}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <a
                href={inspectPathway.shortageListUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-slate-700 hover:underline inline-flex items-center gap-1"
              >
                <span>Official Occupation Shortage List</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={inspectPathway.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-bold"
              >
                <span>Visit Official Government Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</div>
    <div className="text-xs text-slate-800 leading-relaxed">{value}</div>
  </div>
);

const OpportunityCard: React.FC<{
  opp: EvaluatedMigrationOpportunity;
  isSaved: boolean;
  onToggleSave: () => void;
  onInspect: () => void;
}> = ({ opp, isSaved, onToggleSave, onInspect }) => {
  const style = classificationStyles(opp.eligibilityClassification);

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 border-l-4 ${style.border} p-4 sm:p-5 space-y-3 hover:border-slate-300 transition-colors`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${style.badge}`}>
              {style.label}
            </span>
            {opp.isInSelectedCountry && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#0B132B] text-white">
                Selected Country
              </span>
            )}
            {opp.changeStatus !== 'unchanged' && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                {opp.changeStatus}
              </span>
            )}
            <span className="text-xs text-slate-500">
              {opp.country} · {opp.sector}
            </span>
          </div>
          <h3 className="text-base font-bold text-[#0B132B] leading-snug">{opp.title}</h3>
          <div className="text-xs font-medium text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{opp.employerOrInstitution}</span>
            <span>·</span>
            <span>Apply from Ethiopia: {opp.canApplyFromEthiopia}</span>
            <span>·</span>
            <span>Budget Fit: {opp.costBreakdown.withinUserBudget}</span>
          </div>
        </div>

        <div className="text-xs text-slate-500 sm:text-right shrink-0 tabular-nums">
          <div className="font-semibold text-slate-800">Deadline: {opp.deadlineDisplay}</div>
          {opp.daysRemaining !== null && (
            <div className="text-[11px] text-slate-500">{opp.daysRemaining} days left</div>
          )}
        </div>
      </div>

      {/* Honest Explanation */}
      <p className="text-xs text-slate-700 leading-relaxed">{opp.suitabilityExplanation}</p>

      {/* Compact Key Facts Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600 border-t border-slate-100">
        <div>
          <span className="font-semibold text-slate-800">Salary / Funding:</span>{' '}
          {opp.salaryOrFunding}
        </div>
        <div>
          <span className="font-semibold text-slate-800">Visa / Sponsorship:</span>{' '}
          {opp.visaOrImmigrationRoute}
        </div>
        <div>
          <span className="font-semibold text-slate-800">Costs:</span>{' '}
          {opp.costBreakdown.applicationFeeStatus} ·{' '}
          {opp.costBreakdown.employerPaidRelocation
            ? 'Employer-sponsored'
            : opp.costBreakdown.governmentFunded
            ? 'Fully funded'
            : 'Verify costs'}
        </div>
      </div>

      {/* Card Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="text-[11px] text-slate-500">
          Official Source: <strong className="text-slate-700">{opp.officialSource}</strong>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSave}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              isSaved
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5" />
                <span>Save &amp; Track</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onInspect}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            Full 17-Point Details
          </button>

          {opp.directOfficialLink && (
            <a
              href={opp.directOfficialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
            >
              <span>Apply Official</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
