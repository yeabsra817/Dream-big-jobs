import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Droplets,
  ExternalLink,
  Filter,
  Globe,
  GraduationCap,
  Info,
  Landmark,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  AlertCircle,
  BookOpen,
  FileEdit,
} from 'lucide-react';
import {
  GlobalOpportunitiesApiResponse,
  GlobalOpportunityCategory,
  GlobalOpportunitySubsection,
  GlobalOpportunityWithMatch,
  GlobalVerificationStatus,
} from '../types/globalOpportunities';
import { JobSeekerProfile } from '../types/jobSeeker';
import {
  fetchGlobalOpportunities,
  toggleSavedGlobalOpportunity,
  triggerAdminGlobalDiscovery,
} from '../lib/globalOpportunitiesService';
import { fetchAutonomousDiscoveryStatus } from '../lib/autonomousDiscoveryService';
import {
  formatRecommendationSummary,
  MINIMUM_FULL_DAYS_REMAINING,
} from '../utils/opportunityIntelligenceEngine';
import {
  CAREER_SPECIALTY_LABELS,
  classifyCareerSpecialtyCategory,
  classifySevenTierVisaSponsorship,
  detectInternationalRegion,
  parseAndNormalizeSalaryUsd,
  SEVEN_TIER_VISA_LABELS,
} from '../utils/internationalCareerIntelligence';
import { CareerCvMatcherPanel } from './CareerCvMatcherPanel';

interface Props {
  onBack: () => void;
  userProfile?: JobSeekerProfile | null;
  isAdmin?: boolean;
  adminEmail?: string | null;
  onOpenAuth?: () => void;
  onOpenProfile?: () => void;
  onOpenWritingTool?: (tool: 'humanize-text' | 'humanize-checker') => void;
  initialSubsection?: GlobalOpportunitySubsection | 'all';
}

const SUBSECTIONS: Array<{
  id: GlobalOpportunitySubsection | 'all';
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', label: 'All Verified', shortLabel: 'All', icon: Globe },
  { id: 'international_jobs', label: 'International Sponsored Jobs', shortLabel: 'Sponsored Jobs', icon: Briefcase },
  { id: 'europe_jobs', label: 'European Jobs', shortLabel: 'Europe', icon: Compass },
  { id: 'middle_east_jobs', label: 'Middle East Jobs', shortLabel: 'Middle East', icon: Building2 },
  { id: 'banking_finance', label: 'Banking & Finance', shortLabel: 'Banking & Finance', icon: Landmark },
  { id: 'management_jobs', label: 'Professional & Management', shortLabel: 'Management', icon: Briefcase },
  { id: 'permanent_residency', label: 'Permanent Residency & Migration', shortLabel: 'PR & Migration', icon: ShieldCheck },
  { id: 'recruiting_countries', label: 'Countries Recruiting Foreign Workers', shortLabel: 'Recruiting Countries', icon: MapPin },
  { id: 'scholarships', label: 'Scholarships', shortLabel: 'Scholarships', icon: GraduationCap },
  { id: 'professional_training', label: 'International Training', shortLabel: 'Training', icon: BookOpen },
  { id: 'conferences_summits', label: 'Conferences & Fellowships', shortLabel: 'Conferences', icon: Users },
  { id: 'cv_matching', label: 'CV & Profile Matching', shortLabel: 'CV Matcher', icon: Sparkles },
  { id: 'recommended', label: 'My Opportunities', shortLabel: 'My Matches', icon: CheckCircle2 },
  { id: 'wash_opportunities', label: 'WASH Opportunities', shortLabel: 'WASH', icon: Droplets },
  { id: 'closing_soon', label: 'Closing Soon', shortLabel: 'Closing Soon', icon: Clock },
  { id: 'saved', label: 'Saved', shortLabel: 'Saved', icon: Bookmark },
];

function formatCategoryLabel(category: GlobalOpportunityCategory): string {
  switch (category) {
    case 'international_job':
      return 'International Job';
    case 'university_scholarship':
      return 'University Scholarship';
    case 'professional_training':
      return 'Professional Training';
    case 'conference_summit':
      return 'Conference & Summit';
    case 'wash_opportunity':
      return 'WASH Opportunity';
    default:
      return 'International Opportunity';
  }
}

function formatDateReadable(iso: string | null | undefined): string {
  if (!iso || iso === 'Not Confirmed') return 'Not Confirmed';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTimeShort(iso: string | null | undefined): string {
  if (!iso) return 'Not yet run';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTriState(val: string | undefined): string {
  if (val === 'yes') return 'Confirmed Covered';
  if (val === 'partial') return 'Partially Covered';
  if (val === 'no') return 'Not Covered';
  return 'Not Confirmed';
}

function formatReqState(val: string | undefined): string {
  if (val === 'required') return 'Required';
  if (val === 'not_required') return 'Not Required';
  if (val === 'optional') return 'Optional';
  return 'Not Confirmed';
}

function getStatusAccentClasses(status: GlobalVerificationStatus): string {
  switch (status) {
    case 'Fully Funded':
    case 'Visa Sponsored':
    case 'Verified and Open':
      return 'text-[#15803D]';
    case 'Partially Funded':
      return 'text-[#1D4ED8]';
    case 'Closing Soon':
      return 'text-[#B45309]';
    case 'Funding Not Confirmed':
    case 'Eligibility Not Confirmed':
      return 'text-slate-700';
    case 'Expired':
    case 'Unverified':
    default:
      return 'text-rose-700';
  }
}

export const GlobalOpportunitiesView: React.FC<Props> = ({
  onBack,
  userProfile = null,
  isAdmin = false,
  adminEmail = null,
  onOpenAuth,
  onOpenProfile,
  onOpenWritingTool,
  initialSubsection = 'all',
}) => {
  const [activeSubsection, setActiveSubsection] = useState<GlobalOpportunitySubsection | 'all'>(initialSubsection);
  const [data, setData] = useState<GlobalOpportunitiesApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [filterCountry, setFilterCountry] = useState('all');
  const [filterFunding, setFilterFunding] = useState('all');
  const [filterVisa, setFilterVisa] = useState('all');
  const [filterMinSalaryUsd, setFilterMinSalaryUsd] = useState('0');
  const [filterEnglishOnly, setFilterEnglishOnly] = useState(false);
  const [filterExperience, setFilterExperience] = useState('all');
  const [filterEligibility, setFilterEligibility] = useState('all');
  const [filterDeadline, setFilterDeadline] = useState('all');
  const [showFiltersBar, setShowFiltersBar] = useState(true);

  // Permanent Residency & Recruiting Countries filters (separate from job/scholarship filters)
  const [prCountryFilter, setPrCountryFilter] = useState('all');
  const [prRegionFilter, setPrRegionFilter] = useState('all');
  const [prPathwayFilter, setPrPathwayFilter] = useState('all');
  const [prQuery, setPrQuery] = useState('');

  // UI panels & modals
  const [selectedOpportunity, setSelectedOpportunity] = useState<GlobalOpportunityWithMatch | null>(null);
  const [showSourcesDrawer, setShowSourcesDrawer] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [discoveryNotice, setDiscoveryNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchGlobalOpportunities(
        {},
        userProfile?.uid || null,
        userProfile?.email || null
      );
      setData(resp);
    } catch (err: any) {
      setError(err?.message || 'Unable to load verified global opportunities.');
    } finally {
      setLoading(false);
    }
  }, [userProfile?.uid, userProfile?.email]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Silent auto-refresh whenever the 1-minute autonomous worker finishes a newer successful search
  useEffect(() => {
    let active = true;
    let lastSeenSuccessAt: string | null = null;
    const poll = async () => {
      const st = await fetchAutonomousDiscoveryStatus();
      if (!active || !st?.lastSuccessfulSearchAt) return;
      if (lastSeenSuccessAt && st.lastSuccessfulSearchAt !== lastSeenSuccessAt) {
        try {
          const resp = await fetchGlobalOpportunities(
            {},
            userProfile?.uid || null,
            userProfile?.email || null
          );
          if (active) setData(resp);
        } catch {
          // Keep current list on transient poll failure
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
  }, [userProfile?.uid, userProfile?.email]);

  // Distinct countries for Country filter dropdown
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    (data?.opportunities || []).forEach((o) => {
      if (o.country) set.add(o.country);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  // Client-side instant filtering across all subsections + 7-tier visa, specialty & USD salary filters
  const filteredOpportunities = useMemo(() => {
    const all = data?.opportunities || [];
    const q = searchQuery.trim().toLowerCase();
    const minSalaryNum = Number(filterMinSalaryUsd) || 0;

    return all
      .filter((o) => {
        const region = detectInternationalRegion(o.country, o.location);
        const specialty = classifyCareerSpecialtyCategory(o.title, o.summary, o.organization);
        const visaCheck = classifySevenTierVisaSponsorship(o);
        const salaryInfo = parseAndNormalizeSalaryUsd(o);

        if (activeSubsection === 'international_jobs' && o.category !== 'international_job') return false;
        if (activeSubsection === 'europe_jobs' && region !== 'Europe') return false;
        if (activeSubsection === 'middle_east_jobs' && region !== 'Middle East') return false;
        if (activeSubsection === 'management_jobs') {
          const isMgmt =
            specialty === 'corporate_operations_management' ||
            specialty === 'banking_financial_services' ||
            specialty === 'finance_accounting' ||
            specialty === 'risk_compliance' ||
            specialty === 'credit_microfinance' ||
            /\b(manager|director|head of|controller|lead|officer|analyst|auditor|supervisor|coordinator)\b/i.test(o.title);
          if (!isMgmt) return false;
        }
        if (activeSubsection === 'scholarships' && o.category !== 'university_scholarship') return false;
        if (activeSubsection === 'professional_training' && o.category !== 'professional_training') return false;
        if (activeSubsection === 'conferences_summits' && o.category !== 'conference_summit') return false;
        if (activeSubsection === 'banking_finance' && !o.isBankingFinance && !o.sectors.includes('banking_finance')) return false;
        if (
          activeSubsection === 'wash_opportunities' &&
          !o.isWashDedicated &&
          o.category !== 'wash_opportunity' &&
          !o.sectors.includes('wash')
        ) {
          return false;
        }
        if (activeSubsection === 'recommended' && !o.recommendation?.eligible) return false;
        if (activeSubsection === 'closing_soon' && !o.deadline.isClosingSoon) return false;
        if (activeSubsection === 'saved' && !o.isSaved) return false;

        if (filterCategory !== 'all' && o.category !== filterCategory) return false;
        if (filterSpecialty !== 'all' && specialty !== filterSpecialty) return false;
        if (filterCountry !== 'all' && o.country !== filterCountry) return false;
        if (filterFunding !== 'all' && o.funding.fundingLevel !== filterFunding) return false;
        if (filterVisa !== 'all') {
          if (filterVisa === 'priority_1_to_4' && !visaCheck.isPriorityTier) return false;
          else if (filterVisa in SEVEN_TIER_VISA_LABELS && visaCheck.category !== filterVisa) return false;
          else if (
            (filterVisa === 'employer_sponsored' || filterVisa === 'confirmed_visa_sponsorship') &&
            !visaCheck.sponsorshipConfirmed
          ) {
            return false;
          } else if (filterVisa === 'visa_fees_funded' && o.funding.visaSupportType !== 'visa_fees_funded') {
            return false;
          }
        }
        if (minSalaryNum > 0) {
          if (!salaryInfo.estimatedMonthlyUsd || salaryInfo.estimatedMonthlyUsd < minSalaryNum) return false;
        }
        if (filterEnglishOnly && visaCheck.localLanguageMandatory === 'yes') {
          return false;
        }
        if (filterExperience !== 'all') {
          const minY = o.eligibility.minimumYearsExperience;
          if (filterExperience === 'entry' && !((minY !== null && minY <= 2) || o.eligibility.careerLevel === 'entry' || o.eligibility.careerLevel === 'internship')) {
            return false;
          }
          if (filterExperience === 'mid' && !(minY !== null && minY >= 2 && minY <= 6)) return false;
          if (filterExperience === 'senior' && !((minY !== null && minY >= 6) || o.eligibility.careerLevel === 'senior' || o.eligibility.careerLevel === 'management')) {
            return false;
          }
        }
        if (filterEligibility !== 'all') {
          if (filterEligibility === 'ethiopian_confirmed' && o.eligibility.ethiopianEligible !== 'confirmed') return false;
          if (
            filterEligibility === 'no_nomination' &&
            (o.eligibility.universityRecommendationRequired === 'required' ||
              o.eligibility.companyRecommendationRequired === 'required' ||
              o.eligibility.institutionalNominationRequired === 'required')
          ) {
            return false;
          }
        }
        if (filterDeadline !== 'all') {
          const d = o.deadline.fullDaysRemaining;
          if (filterDeadline === 'closing_soon' && !(d >= 3 && d <= 7)) return false;
          if (filterDeadline === 'within_14_days' && !(d >= 3 && d <= 14)) return false;
          if (filterDeadline === 'within_30_days' && !(d >= 3 && d <= 30)) return false;
        }
        if (q) {
          const hay = `${o.title} ${o.organization} ${o.country} ${o.location} ${o.summary} ${o.eligibility.requiredSkills.join(' ')} ${o.funding.fundingSummary} ${CAREER_SPECIALTY_LABELS[specialty]}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (activeSubsection === 'recommended') {
          return (b.recommendation?.matchScore || 0) - (a.recommendation?.matchScore || 0);
        }
        if (activeSubsection === 'closing_soon') {
          return a.deadline.fullDaysRemaining - b.deadline.fullDaysRemaining;
        }
        // Prioritize confirmed 7-tier visa priority (Categories 1-4), then personalized match score, then deadline
        const va = classifySevenTierVisaSponsorship(a).isPriorityTier ? 1 : 0;
        const vb = classifySevenTierVisaSponsorship(b).isPriorityTier ? 1 : 0;
        if (va !== vb) return vb - va;
        const sa = a.recommendation?.eligible ? a.recommendation.matchScore : 0;
        const sb = b.recommendation?.eligible ? b.recommendation.matchScore : 0;
        if (sa !== sb) return sb - sa;
        return a.deadline.fullDaysRemaining - b.deadline.fullDaysRemaining;
      });
  }, [
    data,
    activeSubsection,
    searchQuery,
    filterCategory,
    filterSpecialty,
    filterCountry,
    filterFunding,
    filterVisa,
    filterMinSalaryUsd,
    filterEnglishOnly,
    filterExperience,
    filterEligibility,
    filterDeadline,
  ]);

  const handleToggleSave = async (opp: GlobalOpportunityWithMatch) => {
    if (!userProfile?.uid) {
      onOpenAuth?.();
      return;
    }
    setSavingId(opp.id);
    try {
      const result = await toggleSavedGlobalOpportunity(
        opp,
        Boolean(opp.isSaved),
        userProfile.uid,
        userProfile.email
      );
      setData((prev) => {
        if (!prev) return prev;
        const updatedOpps = prev.opportunities.map((item) =>
          item.id === opp.id ? { ...item, isSaved: result.saved } : item
        );
        const savedCount = updatedOpps.filter((i) => i.isSaved).length;
        return {
          ...prev,
          opportunities: updatedOpps,
          countsBySubsection: {
            ...prev.countsBySubsection,
            saved: savedCount,
          },
        };
      });
      if (selectedOpportunity?.id === opp.id) {
        setSelectedOpportunity((prev) => (prev ? { ...prev, isSaved: result.saved } : null));
      }
    } catch (err: any) {
      setError(err?.message || 'Could not save opportunity.');
    } finally {
      setSavingId(null);
    }
  };

  const handleRunLiveDiscovery = async () => {
    setRunningDiscovery(true);
    setDiscoveryNotice(null);
    try {
      const result = await triggerAdminGlobalDiscovery(adminEmail);
      setDiscoveryNotice(
        `Live official scan completed: ${result.runLog.verifiedAndActiveCount} verified active opportunities (${result.runLog.rejectedUnderThreeDaysCount} excluded under 3-day rule, ${result.runLog.rejectedBrokenOrClosedCount} closed/unverified filtered out).`
      );
      await loadData();
    } catch (err: any) {
      setDiscoveryNotice(`Discovery check failed: ${err?.message || 'Unauthorized or network error'}`);
    } finally {
      setRunningDiscovery(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterCategory('all');
    setFilterSpecialty('all');
    setFilterCountry('all');
    setFilterFunding('all');
    setFilterVisa('all');
    setFilterMinSalaryUsd('0');
    setFilterEnglishOnly(false);
    setFilterExperience('all');
    setFilterEligibility('all');
    setFilterDeadline('all');
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filterCategory !== 'all' ||
    filterSpecialty !== 'all' ||
    filterCountry !== 'all' ||
    filterFunding !== 'all' ||
    filterVisa !== 'all' ||
    filterMinSalaryUsd !== '0' ||
    filterEnglishOnly ||
    filterExperience !== 'all' ||
    filterEligibility !== 'all' ||
    filterDeadline !== 'all';

  const getTabCount = (id: GlobalOpportunitySubsection | 'all'): number => {
    if (!data) return 0;
    if (id === 'all') return data.totalActiveVerified;
    return data.countsBySubsection[id] ?? 0;
  };

  const connectedSourcesCount = (data?.sources || []).filter((s) => s.status === 'connected').length;

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#0B132B]">
      {/* Top Contextual Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#16A34A] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Hopeland Jobs</span>
                </button>
                <span>/</span>
                <span className="text-[#0B132B]">International Opportunities</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B132B]">
                International Opportunities
              </h1>
              <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
                Verified global jobs, university scholarships, Banking &amp; Finance trainings, WASH fellowships, and
                international conferences sourced directly from official institutions — strictly filtered for{' '}
                <span className="font-semibold text-[#0B132B] tabular-nums">
                  {MINIMUM_FULL_DAYS_REMAINING}+ full days
                </span>{' '}
                remaining before deadline.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {onOpenWritingTool && (
                <button
                  type="button"
                  onClick={() => onOpenWritingTool('humanize-text')}
                  className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FileEdit className="w-4 h-4 text-[#16A34A]" />
                  <span>Writing Studio</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveSubsection('cv_matching')}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Match My CV</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowSourcesDrawer((v) => !v)}
                  className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                  <span>
                    Admin Source Monitor (<span className="tabular-nums">{connectedSourcesCount}</span>/{data?.sources.length || 5})
                  </span>
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  disabled={runningDiscovery}
                  onClick={handleRunLiveDiscovery}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#0B132B] hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {runningDiscovery ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>{runningDiscovery ? 'Scanning Official Sources...' : 'Run Live Discovery'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Honest Summary Metrics Strip (Single-Elevation, Tabular Figures, Zero Pills) */}
          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
            <div>
              <div className="text-slate-500 font-medium">Verified Open (&ge;3 Days)</div>
              <div className="mt-0.5 text-lg font-extrabold text-[#0B132B] tabular-nums">
                {loading ? '—' : data?.totalActiveVerified ?? 0}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-medium">Banking &amp; Finance</div>
              <div className="mt-0.5 text-lg font-extrabold text-[#0B132B] tabular-nums">
                {loading ? '—' : data?.countsBySubsection.banking_finance ?? 0}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-medium">WASH &amp; Water Sector</div>
              <div className="mt-0.5 text-lg font-extrabold text-[#0B132B] tabular-nums">
                {loading ? '—' : data?.countsBySubsection.wash_opportunities ?? 0}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-medium">PR &amp; Shortage Countries</div>
              <div className="mt-0.5 text-lg font-extrabold text-[#15803D] tabular-nums">
                {loading ? '—' : data?.permanentResidencyPathways?.length ?? 0}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-medium">Last Automated Verification</div>
              <div className="mt-1 text-xs font-semibold text-slate-800 tabular-nums">
                {formatDateTimeShort(data?.lastDiscoveryRun?.finishedAt)}
              </div>
            </div>
          </div>

          {discoveryNotice && (
            <div className="mt-4 px-3.5 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 text-xs font-medium text-emerald-900 flex items-center justify-between gap-3">
              <span>{discoveryNotice}</span>
              <button
                type="button"
                onClick={() => setDiscoveryNotice(null)}
                className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
                aria-label="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Admin-Only Official Source Status Drawer (Hidden from Public Visitors) */}
          {isAdmin && showSourcesDrawer && data && (
            <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-bold text-[#0B132B]">
                    Official Source Connectors &amp; Verification Policy
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Every opportunity is fetched automatically from official RSS feeds, direct institutional websites,
                    and live web search connectors every 6 hours at{' '}
                    <strong>00:00, 06:00, 12:00 &amp; 18:00 Africa/Addis_Ababa (EAT)</strong>, verified against its live
                    HTTPS source URL while respecting <code className="font-mono text-[11px]">robots.txt</code>, and
                    checked against the mandatory 3-full-days deadline rule.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSourcesDrawer(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500 cursor-pointer"
                  aria-label="Close source panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="divide-y divide-slate-200 bg-white rounded-lg border border-slate-200">
                {data.sources.map((src) => {
                  const healthyPortalsCount = src.monitoredPortals
                    ? src.monitoredPortals.filter((p) => p.httpStatus !== null && p.httpStatus >= 200 && p.httpStatus < 400).length
                    : 0;
                  return (
                  <div key={src.id} className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#0B132B]">{src.name}</div>
                      <div className="text-slate-500 mt-0.5">
                        {src.organizationGroup} · <span className="font-mono text-[11px]">{src.baseUrl}</span>
                      </div>
                      {src.monitoredPortals && src.monitoredPortals.length > 0 && (
                        <div className="text-[11px] text-[#15803D] font-medium mt-0.5 tabular-nums">
                          Monitoring {src.monitoredPortals.length} official portals ({healthyPortalsCount}/
                          {src.monitoredPortals.length} HTTP 200 verified):{' '}
                          {src.monitoredPortals.slice(0, 6).map((p) => p.name).join(', ')}
                          {src.monitoredPortals.length > 6 ? `, +${src.monitoredPortals.length - 6} more` : ''}
                        </div>
                      )}
                      {src.pricingNote && (
                        <div className="text-[11px] text-slate-600 mt-0.5">{src.pricingNote}</div>
                      )}
                      {src.lastError && src.status !== 'optional_unconfigured' && src.status !== 'disabled' && (
                        <div className="text-amber-700 mt-0.5">{src.lastError}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <span
                        className={`font-bold ${
                          src.status === 'connected'
                            ? 'text-[#15803D]'
                            : src.status === 'optional_unconfigured' || src.status === 'disabled'
                            ? 'text-slate-500'
                            : src.status === 'requires_credentials' || src.status === 'degraded'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {src.status === 'connected'
                          ? 'Connected'
                          : src.status === 'optional_unconfigured'
                          ? 'Optional · Not Configured'
                          : src.status === 'disabled'
                          ? 'Disabled by Config'
                          : src.status === 'requires_credentials'
                          ? 'Credentials Needed'
                          : src.status === 'degraded'
                          ? 'Temporarily Unavailable'
                          : 'Error'}
                      </span>
                      <div className="text-[11px] text-slate-500">
                        {src.lastPolledAt
                          ? `Last checked ${formatDateTimeShort(src.lastPolledAt)}`
                          : src.status === 'optional_unconfigured'
                          ? 'Website runs without it'
                          : 'Pending first scan'}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-600 pt-1">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <span>{data.websiteOnlyPolicyNote}</span>
              </div>
            </div>
          )}
        </div>

        {/* 9 Interactive Subsections Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            role="tablist"
            aria-label="International opportunity categories"
            className="flex items-center gap-1 overflow-x-auto pb-0 -mb-px scrollbar-none"
          >
            {SUBSECTIONS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubsection === tab.id;
              const count = getTabCount(tab.id);
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveSubsection(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-[#16A34A] text-[#0B132B]'
                      : 'border-transparent text-slate-600 hover:text-[#0B132B] hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#16A34A]' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Search & Filter Bar (Shown on Opportunity Listing Tabs) */}
        {activeSubsection !== 'permanent_residency' &&
          activeSubsection !== 'recruiting_countries' &&
          activeSubsection !== 'cv_matching' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, Branch Manager, Finance, Audit, Compliance, UAE, Europe, WASH, scholarship..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-[#FBFBFA] text-sm text-[#0B132B] placeholder:text-slate-400 focus:outline-none focus:border-[#16A34A] focus:bg-white transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFiltersBar((v) => !v)}
                className="min-h-[42px] px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{showFiltersBar ? 'Hide Filters' : 'Show Filters'}</span>
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="min-h-[42px] px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {showFiltersBar && (
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <select
                  aria-label="Filter by professional specialty"
                  value={filterSpecialty}
                  onChange={(e) => setFilterSpecialty(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#16A34A]"
                >
                  <option value="all">Sector / Specialty: All (8 Sectors)</option>
                  {Object.entries(CAREER_SPECIALTY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by country"
                  value={filterCountry}
                  onChange={(e) => setFilterCountry(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#16A34A]"
                >
                  <option value="all">Country: All ({availableCountries.length})</option>
                  {availableCountries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by 7-tier visa sponsorship"
                  value={filterVisa}
                  onChange={(e) => setFilterVisa(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#16A34A]"
                >
                  <option value="all">Visa Sponsorship (7-Tier): All</option>
                  <option value="priority_1_to_4">Priority Tiers 1–4 (Confirmed / Foreign Accepted)</option>
                  {Object.entries(SEVEN_TIER_VISA_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                  <option value="visa_fees_funded">Visa Fees Funded (Scholarships/Training)</option>
                </select>

                <select
                  aria-label="Filter by minimum monthly USD salary"
                  value={filterMinSalaryUsd}
                  onChange={(e) => setFilterMinSalaryUsd(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#16A34A]"
                >
                  <option value="0">Monthly Salary (USD): Any / Disclosed</option>
                  <option value="2000">USD $2,000+ / month</option>
                  <option value="3000">USD $3,000+ / month (Target Min)</option>
                  <option value="4000">USD $4,000+ / month</option>
                  <option value="5000">USD $5,000+ / month</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-center">
                <select
                  aria-label="Filter by category"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#16A34A]"
                >
                  <option value="all">Type: All Opportunities</option>
                  <option value="international_job">International Jobs</option>
                  <option value="university_scholarship">Scholarships</option>
                  <option value="professional_training">Professional Training</option>
                  <option value="conference_summit">Conferences &amp; Fellowships</option>
                  <option value="wash_opportunity">WASH Dedicated</option>
                </select>

                <select
                  aria-label="Filter by funding"
                  value={filterFunding}
                  onChange={(e) => setFilterFunding(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#16A34A]"
                >
                  <option value="all">Funding: All</option>
                  <option value="fully_funded">Fully Funded</option>
                  <option value="partially_funded">Partially Funded</option>
                  <option value="free">Free Program</option>
                  <option value="self_funded">Self-Funded</option>
                  <option value="not_confirmed">Funding Not Confirmed</option>
                </select>

                <select
                  aria-label="Filter by experience"
                  value={filterExperience}
                  onChange={(e) => setFilterExperience(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#16A34A]"
                >
                  <option value="all">Experience: All</option>
                  <option value="entry">Entry / 0–2 Years</option>
                  <option value="mid">Mid-Level / 2–6 Years</option>
                  <option value="senior">Senior / Management (6+ Yrs)</option>
                </select>

                <select
                  aria-label="Filter by deadline"
                  value={filterDeadline}
                  onChange={(e) => setFilterDeadline(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#16A34A]"
                >
                  <option value="all">Deadline: All (&ge;3 Days)</option>
                  <option value="closing_soon">Closing Soon (3–7 Days)</option>
                  <option value="within_14_days">Within 14 Days</option>
                  <option value="within_30_days">Within 30 Days</option>
                </select>

                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-[#FBFBFA] text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterEnglishOnly}
                    onChange={(e) => setFilterEnglishOnly(e.target.checked)}
                    className="rounded border-slate-300 text-[#16A34A] focus:ring-[#16A34A]"
                  />
                  <span>English-Only Sufficient</span>
                </label>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Contextual Prompt for Recommended / Saved when Guest */}
        {!userProfile?.uid && (activeSubsection === 'recommended' || activeSubsection === 'saved') && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#0B132B]">
                {activeSubsection === 'recommended'
                  ? 'Sign in for Personalized International Recommendations'
                  : 'Sign in to Sync Your Saved Opportunities'}
              </h2>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                Your HopelandJobs profile (education, years of experience, Banking/Finance, WASH, or Tech skills) is
                matched automatically inside the website to surface only opportunities where you meet mandatory
                eligibility criteria. No unsolicited emails or SMS are sent for scholarships, training, or conferences.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Sign In / Register
            </button>
          </div>
        )}

        {/* Profile completeness hint on Recommended tab when signed in */}
        {userProfile?.uid && activeSubsection === 'recommended' && (
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="text-slate-600">
              Matching against your profile:{' '}
              <span className="font-semibold text-[#0B132B]">
                {userProfile.desiredJobTitle || userProfile.currentPosition || 'Role not set'}
              </span>{' '}
              · {userProfile.preferredIndustry || 'Industry not set'} ·{' '}
              <span className="tabular-nums">{userProfile.yearsOfExperience || 'Experience not set'}</span>
            </div>
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="font-semibold text-[#16A34A] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                Update Profile for Better Matches
              </button>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between gap-3 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="font-bold underline cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State (Geometry-matched Skeletons) */}
        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 animate-pulse">
                <div className="h-3 w-40 bg-slate-200 rounded" />
                <div className="h-5 w-4/5 bg-slate-200 rounded" />
                <div className="h-3 w-3/5 bg-slate-100 rounded" />
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div className="h-8 bg-slate-100 rounded" />
                  <div className="h-8 bg-slate-100 rounded" />
                  <div className="h-8 bg-slate-100 rounded" />
                  <div className="h-8 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CV & Profile Weighted Matching View */}
        {!loading && activeSubsection === 'cv_matching' && (
          <CareerCvMatcherPanel onSelectOpportunity={(opp) => setSelectedOpportunity(opp)} />
        )}

        {/* Permanent Residency & Countries Recruiting Foreign Workers View (22 Official Governments, All 12 Criteria) */}
        {!loading && (activeSubsection === 'permanent_residency' || activeSubsection === 'recruiting_countries') && (
          <div className="space-y-5">
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-xs text-amber-950 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-[#0B132B]">
                  {activeSubsection === 'recruiting_countries'
                    ? 'Countries Actively Recruiting Foreign Professionals & Skilled Workers (22 Official Government Portals)'
                    : 'Official Government Permanent Residency & Skilled Migration Intelligence (22 Countries)'}
                </div>
                <p className="leading-relaxed">
                  <strong>Mandatory Legal Accuracy Notice:</strong> Labour or skill shortages do{' '}
                  <strong>NOT</strong> automatically grant permanent residency. Every pathway below links exclusively
                  to official national immigration ministries and clearly separates <strong>Direct PR</strong>,{' '}
                  <strong>Work Permit with Route to PR</strong>, and <strong>Temporary Work Permits</strong>, detailing
                  Ethiopian offshore eligibility, minimum salary thresholds, financial proof, fees, and family reunification.
                </p>
              </div>
            </div>

            {/* PR & Recruiting Country Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={prQuery}
                  onChange={(e) => setPrQuery(e.target.value)}
                  placeholder="Search occupation (Auditor, Banker, Nurse, Water Engineer...)"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-[#FBFBFA] text-xs focus:outline-none focus:border-[#16A34A]"
                />
              </div>
              <select
                aria-label="Filter PR by region"
                value={prRegionFilter}
                onChange={(e) => setPrRegionFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#16A34A]"
              >
                <option value="all">Region: All Regions</option>
                <option value="Europe">Europe</option>
                <option value="Middle East">Middle East</option>
                <option value="Asia">Asia (Singapore, Japan)</option>
                <option value="North America">North America</option>
                <option value="Oceania">Oceania (Australia, NZ)</option>
                <option value="Africa & Other">Africa &amp; Other</option>
              </select>
              <select
                aria-label="Filter PR by country"
                value={prCountryFilter}
                onChange={(e) => setPrCountryFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#16A34A]"
              >
                <option value="all">Country: All ({data?.permanentResidencyPathways?.length || 0})</option>
                {(data?.permanentResidencyPathways || []).map((p) => (
                  <option key={p.id} value={p.country}>
                    {p.country} ({p.region})
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter PR by pathway classification"
                value={prPathwayFilter}
                onChange={(e) => setPrPathwayFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#16A34A]"
              >
                <option value="all">Pathway Type: All</option>
                <option value="direct_pr">Direct Permanent Residency</option>
                <option value="route_to_pr">Work Permit with Route to PR</option>
                <option value="temporary_work_permit">Temporary Work Permit (Long-Term Quota)</option>
              </select>
            </div>

            {/* Separate Permanent Residency Eligibility Assessment Panel */}
            {userProfile?.uid && (data?.permanentResidencyAssessments?.length || 0) > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-[#0B132B]">
                      Personal Permanent Residency Eligibility Assessment (Separate from Job Matching)
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Evaluated honestly against your profile ({userProfile.desiredJobTitle || userProfile.currentPosition || 'Role not set'} · {userProfile.yearsOfExperience || 'Experience not set'}). Unverified criteria (language test scores, credentials, age, job offer) are explicitly listed as missing.
                    </p>
                  </div>
                  {onOpenProfile && (
                    <button
                      type="button"
                      onClick={onOpenProfile}
                      className="text-xs font-bold text-[#16A34A] hover:underline cursor-pointer shrink-0"
                    >
                      Update Profile
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {(data?.permanentResidencyAssessments || []).slice(0, 6).map((a) => (
                    <div key={a.pathwayId} className="border border-slate-200 rounded-lg p-3 space-y-1.5 bg-[#FBFBFA]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#0B132B]">{a.country}</span>
                        <span
                          className={`text-[11px] font-bold ${
                            a.readinessStatus.startsWith('Potentially')
                              ? 'text-[#15803D]'
                              : a.readinessStatus.startsWith('Partial')
                              ? 'text-[#1D4ED8]'
                              : 'text-slate-500'
                          }`}
                        >
                          {a.readinessStatus.split('—')[0].trim()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 line-clamp-1">{a.programName}</div>
                      {a.matchedCriteria.length > 0 && (
                        <div className="text-[11px] text-[#15803D]">
                          <strong>Matched:</strong> {a.matchedCriteria[0]}
                        </div>
                      )}
                      {a.missingOrUnverifiedCriteria.length > 0 && (
                        <div className="text-[11px] text-amber-800">
                          <strong>Verify / Needed:</strong> {a.missingOrUnverifiedCriteria[0]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="text-slate-600">
                  <strong className="text-[#0B132B]">Permanent Residency Eligibility Assessment:</strong> Sign in with
                  your profile to compare your profession, education, and experience against official government PR
                  pathways (kept completely separate from job matching).
                </div>
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="px-3.5 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer shrink-0"
                  >
                    Sign In to Assess Eligibility
                  </button>
                )}
              </div>
            )}

            {/* Official Government Country Pathway Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(data?.permanentResidencyPathways || [])
                .filter((p) => {
                  if (prRegionFilter !== 'all' && p.region !== prRegionFilter) return false;
                  if (prCountryFilter !== 'all' && p.country !== prCountryFilter) return false;
                  if (prPathwayFilter !== 'all' && p.pathwayClassification !== prPathwayFilter) return false;
                  if (prQuery.trim()) {
                    const hay = `${p.country} ${p.programName} ${p.officialAuthority} ${p.professionalOccupationsInDemand.join(' ')} ${p.labourOccupationsInDemand.join(' ')} ${p.bankingFinanceOccupations.join(' ')} ${p.washWaterOccupations.join(' ')}`.toLowerCase();
                    if (!hay.includes(prQuery.trim().toLowerCase())) return false;
                  }
                  return true;
                })
                .map((p) => (
                  <article
                    key={p.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between gap-4 text-xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold text-[#0B132B]">{p.country}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-semibold text-slate-500">{p.region}</span>
                        </div>
                        <span
                          className={`font-bold ${
                            p.verificationTier === 'VERIFIED' ? 'text-[#15803D]' : 'text-[#1D4ED8]'
                          }`}
                        >
                          {p.verificationTier} {isAdmin && p.httpStatus ? `(HTTP ${p.httpStatus})` : ''}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-[#0B132B] leading-snug">{p.programName}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                          <span
                            className={`font-bold ${
                              p.pathwayClassification === 'direct_pr'
                                ? 'text-[#15803D]'
                                : p.pathwayClassification === 'route_to_pr'
                                ? 'text-[#1D4ED8]'
                                : 'text-amber-700'
                            }`}
                          >
                            {p.pathwayClassificationLabel}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-600">{p.officialAuthority}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <div>
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                            Professional Shortage Demand
                          </div>
                          <ul className="mt-1 space-y-0.5 text-slate-700 list-disc pl-4">
                            {p.professionalOccupationsInDemand.slice(0, 4).map((occ, idx) => (
                              <li key={idx}>{occ}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                            Skilled Trades &amp; Labour Demand
                          </div>
                          <ul className="mt-1 space-y-0.5 text-slate-700 list-disc pl-4">
                            {p.labourOccupationsInDemand.slice(0, 4).map((occ, idx) => (
                              <li key={idx}>{occ}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500">Banking &amp; Finance Roles</div>
                          <div className="text-slate-800 mt-0.5">{p.bankingFinanceOccupations.join('; ')}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500">WASH &amp; Water Engineering</div>
                          <div className="text-slate-800 mt-0.5">{p.washWaterOccupations.join('; ')}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                        <div>
                          <span className="font-semibold text-slate-500">PR Route: </span>
                          <span className="text-slate-800">{p.permanentResidencyRoute}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Ethiopian Eligibility: </span>
                          <span className="text-slate-800">{p.ethiopianEligibilityNotes}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Education &amp; Experience: </span>
                          <span className="text-slate-800">{p.educationRequirement} · {p.experienceRequirement}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Language Requirement: </span>
                          <span className="text-slate-800">{p.languageRequirement}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Job Offer &amp; Min Salary: </span>
                          <span className="text-slate-800">
                            {p.jobOfferRequired || p.recruiterOrEmployerRequired || 'See official portal'}
                            {p.minimumSalaryRequirement ? ` · ${p.minimumSalaryRequirement}` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Financial Proof &amp; Fees: </span>
                          <span className="text-slate-800">
                            {p.financialProofRequirement ? `${p.financialProofRequirement} · ` : ''}
                            {p.governmentApplicationFees}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Family Reunification: </span>
                          <span className="text-slate-800">{p.familyRelocationOptions}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Processing Stages: </span>
                          <span className="text-slate-800">
                            {p.estimatedProcessingStages || p.skillsAssessmentRequired}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <a
                        href={p.shortageOccupationListUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-[#0B132B] hover:text-[#16A34A] inline-flex items-center gap-1"
                      >
                        <span>Official Shortage List</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={p.officialApplicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[36px] px-3.5 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <span>Official Government Portal</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </article>
                ))}
            </div>
          </div>
        )}

        {/* Empty State (Honest — Never Fakes Data) */}
        {!loading &&
          !error &&
          activeSubsection !== 'permanent_residency' &&
          activeSubsection !== 'recruiting_countries' &&
          activeSubsection !== 'cv_matching' &&
          filteredOpportunities.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
            <Compass className="w-8 h-8 text-slate-400 mx-auto" />
            <h2 className="text-base font-bold text-[#0B132B]">
              No verified opportunities match this view right now
            </h2>
            <p className="text-xs text-slate-600 max-w-xl mx-auto leading-relaxed">
              HopelandJobs strictly publishes only genuine opportunities whose official documentation explicitly confirms
              employer work visa sponsorship (for jobs) or visa application fee coverage / sponsorship (for Banking &amp;
              Finance and WASH scholarships, training, and conferences), with at least {MINIMUM_FULL_DAYS_REMAINING}{' '}
              full days remaining. Opportunities with unconfirmed visa coverage, invitation-letter-only support, or
              outside permitted sectors are automatically rejected and archived.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
              {activeSubsection !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveSubsection('all')}
                  className="px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  View All Verified Opportunities
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  disabled={runningDiscovery}
                  onClick={handleRunLiveDiscovery}
                  className="px-4 py-2 rounded-lg bg-[#16A34A] text-white text-xs font-semibold hover:bg-[#15803D] cursor-pointer"
                >
                  {runningDiscovery ? 'Scanning Official Sources...' : 'Scan Official Sources Now'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Populated Opportunity Cards Grid — 7-Tier Visa, USD Salary Standardization, Zero-Pill Discipline */}
        {!loading &&
          activeSubsection !== 'permanent_residency' &&
          activeSubsection !== 'recruiting_countries' &&
          activeSubsection !== 'cv_matching' &&
          filteredOpportunities.length > 0 && (
          <>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing <strong className="text-[#0B132B] tabular-nums">{filteredOpportunities.length}</strong> verified
                active {filteredOpportunities.length === 1 ? 'opportunity' : 'opportunities'}
              </span>
              <span className="hidden sm:inline">
                Verified International Opportunities · Transparent 7-Tier Visa &amp; USD Salary Reporting
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredOpportunities.map((opp) => {
                const isClosing = opp.deadline.isClosingSoon;
                const rec = opp.recommendation;
                const visaCheck = classifySevenTierVisaSponsorship(opp);
                const salaryInfo = parseAndNormalizeSalaryUsd(opp);
                const specialty = classifyCareerSpecialtyCategory(opp.title, opp.summary, opp.organization);
                const region = detectInternationalRegion(opp.country, opp.location);

                return (
                  <article
                    key={opp.id}
                    className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      {/* Row 1: Category · Verification Tier · Days Remaining (Unboxed Typographic Line) */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span className="font-semibold text-slate-600">{formatCategoryLabel(opp.category)}</span>
                          <span className="text-slate-300">·</span>
                          <span className={`inline-flex items-center gap-1 font-bold ${getStatusAccentClasses(opp.verificationStatus)}`}>
                            {opp.hasVerifiedBadge && <BadgeCheck className="w-3.5 h-3.5 shrink-0" />}
                            <span>{opp.verificationTier || opp.verificationStatus}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-xs font-bold tabular-nums ${
                              isClosing ? 'text-[#B45309]' : 'text-[#0B132B]'
                            }`}
                          >
                            {opp.deadline.fullDaysRemaining}d left
                          </span>
                          <button
                            type="button"
                            disabled={savingId === opp.id}
                            onClick={() => handleToggleSave(opp)}
                            aria-label={opp.isSaved ? 'Remove saved opportunity' : 'Save opportunity'}
                            title={opp.isSaved ? 'Saved' : 'Save opportunity'}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              opp.isSaved
                                ? 'border-emerald-200 bg-emerald-50 text-[#16A34A]'
                                : 'border-slate-200 text-slate-400 hover:text-[#0B132B] hover:border-slate-300'
                            }`}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${opp.isSaved ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Title, Organization & Country */}
                      <div>
                        <h3 className="text-base font-bold text-[#0B132B] leading-snug">
                          <button
                            type="button"
                            onClick={() => setSelectedOpportunity(opp)}
                            className="text-left hover:text-[#16A34A] transition-colors cursor-pointer"
                          >
                            {opp.title}
                          </button>
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{opp.organization}</span>
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{opp.country}</span>
                          </span>
                        </div>
                      </div>

                      {/* Row 3: Structured 6-Cell Verification Summary Grid (7-Tier Visa + USD Salary Standardization) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 pt-3 border-t border-slate-100 text-xs">
                        <div>
                          <div className="text-[11px] font-medium text-slate-500">7-Tier Visa Sponsorship Status</div>
                          <div
                            className={`font-semibold mt-0.5 line-clamp-1 ${
                              visaCheck.sponsorshipConfirmed ? 'text-[#15803D]' : 'text-amber-800'
                            }`}
                          >
                            {visaCheck.displayLabel}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] font-medium text-slate-500">Salary / Funding (USD Est.)</div>
                          <div className="font-semibold text-[#0B132B] mt-0.5 line-clamp-1 tabular-nums">
                            {salaryInfo.hasAdvertisedSalary && salaryInfo.estimatedMonthlyUsd
                              ? `$${salaryInfo.estimatedMonthlyUsd.toLocaleString()}/mo (${salaryInfo.grossOrNet === 'not_specified' ? 'est. USD' : salaryInfo.grossOrNet})`
                              : opp.funding.transparencyTags.join(' · ')}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] font-medium text-slate-500">Sector &amp; Region</div>
                          <div className="font-semibold text-slate-800 mt-0.5 line-clamp-1">
                            {CAREER_SPECIALTY_LABELS[specialty]} · {region}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] font-medium text-slate-500">Experience &amp; Nomination</div>
                          <div className="font-semibold text-slate-800 mt-0.5 line-clamp-1">
                            {opp.eligibility.experienceRequirement} · {formatRecommendationSummary(opp.eligibility)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] font-medium text-slate-500">Official Deadline</div>
                          <div className="font-semibold text-[#0B132B] mt-0.5 tabular-nums inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>
                              {formatDateReadable(opp.deadline.deadlineUtcIso || opp.deadline.deadlineDateRaw)} (
                              {opp.deadline.fullDaysRemaining} full days left)
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] font-medium text-slate-500">Last Verified Date</div>
                          <div className="font-medium text-slate-700 mt-0.5 tabular-nums">
                            {formatDateReadable(opp.lastVerifiedAt)} · {opp.officialDomain}
                          </div>
                        </div>
                      </div>

                      {/* Personalized Match Explanation (Only when signed in & eligible) */}
                      {rec?.eligible && rec.matchReasons.length > 0 && (
                        <div className="pt-2.5 border-t border-slate-100 text-xs">
                          <div className="flex items-center justify-between gap-2 text-[#15803D] font-bold">
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Why this matches your profile</span>
                            </span>
                            <span className="font-mono tabular-nums">{rec.matchScore}% match</span>
                          </div>
                          <p className="mt-1 text-slate-600 leading-relaxed line-clamp-2">
                            {rec.matchReasons.join(' · ')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions — Manual Review & Official Application Portal Link Only */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedOpportunity(opp)}
                        className="text-xs font-bold text-[#0B132B] hover:text-[#16A34A] transition-colors cursor-pointer"
                      >
                        View All 20 Verified Fields
                      </button>

                      <a
                        href={opp.officialApplicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] px-3.5 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <span>Official Portal</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 20-Field Official Verification Detail Modal */}
      {selectedOpportunity && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={selectedOpportunity.title}
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-600">
                    {formatCategoryLabel(selectedOpportunity.category)}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span
                    className={`inline-flex items-center gap-1 font-bold ${getStatusAccentClasses(
                      selectedOpportunity.verificationStatus
                    )}`}
                  >
                    {selectedOpportunity.hasVerifiedBadge && <BadgeCheck className="w-3.5 h-3.5" />}
                    <span>{selectedOpportunity.verificationStatus}</span>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="font-bold text-[#0B132B] tabular-nums">
                    {selectedOpportunity.deadline.fullDaysRemaining} full days remaining
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#0B132B] leading-snug">
                  {selectedOpportunity.title}
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  {selectedOpportunity.organization} · {selectedOpportunity.location} ({selectedOpportunity.country})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOpportunity(null)}
                aria-label="Close opportunity details"
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body — Complete 20 Verified Fields */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {selectedOpportunity.summary && (
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Official Program Overview
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{selectedOpportunity.summary}</p>
                </div>
              )}

              {selectedOpportunity.recommendation?.eligible && (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-[#15803D]">
                    <span>Personalized Profile Match Explanation</span>
                    <span className="font-mono tabular-nums">
                      {selectedOpportunity.recommendation.matchScore}% Match
                    </span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    {selectedOpportunity.recommendation.matchReasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 9-Point Visa & USD Salary Verification Summary */}
              {(() => {
                const vc = classifySevenTierVisaSponsorship(selectedOpportunity);
                const sal = parseAndNormalizeSalaryUsd(selectedOpportunity);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        7-Tier Visa &amp; Relocation Verification
                      </div>
                      <div className={`font-bold text-xs ${vc.sponsorshipConfirmed ? 'text-[#15803D]' : 'text-amber-800'}`}>
                        {vc.displayLabel}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-700">
                        <div>Outside Country: <strong>{vc.outsideCountryAllowed.replace('_', ' ')}</strong></div>
                        <div>Ethiopian Eligible: <strong>{vc.ethiopianEligible.replace('_', ' ')}</strong></div>
                        <div>Sponsors Permit: <strong>{vc.employerSponsorsWorkPermit.replace('_', ' ')}</strong></div>
                        <div>Relocation: <strong>{vc.relocationAssistanceProvided.replace('_', ' ')}</strong></div>
                        <div>English Sufficient: <strong>{vc.englishSufficient.replace('_', ' ')}</strong></div>
                        <div>Family Reunification: <strong>{vc.familyReunificationPossible.replace('_', ' ')}</strong></div>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        USD Standardized Compensation &amp; Benefits
                      </div>
                      <div className="font-bold text-xs text-[#0B132B] tabular-nums">
                        {sal.hasAdvertisedSalary && sal.estimatedMonthlyUsd
                          ? `Est. $${sal.estimatedMonthlyUsd.toLocaleString()}/month ($${(sal.estimatedAnnualUsd || 0).toLocaleString()}/yr · ${sal.grossOrNet})`
                          : 'Salary not disclosed in official posting'}
                      </div>
                      {sal.originalText && (
                        <div className="text-[11px] text-slate-600">Original posting: {sal.originalText}</div>
                      )}
                      {sal.benefitsSummary.length > 0 && (
                        <div className="text-[11px] text-[#15803D]">
                          Benefits: {sal.benefitsSummary.join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 20 Verified Fields Table */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Official Source Verification Checklist (20 Verified Fields)
                </h3>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {[
                    ['1. Organization Authenticity', selectedOpportunity.organizationAuthentic ? `Confirmed Official Domain (${selectedOpportunity.officialDomain})` : 'Unverified'],
                    ['2. Original Official Source', `${selectedOpportunity.sourceName} (${selectedOpportunity.originalSourceUrl})`],
                    ['3. Official Application URL', selectedOpportunity.officialApplicationUrl],
                    ['4. Official Deadline', `${formatDateReadable(selectedOpportunity.deadline.deadlineUtcIso || selectedOpportunity.deadline.deadlineDateRaw)} (${selectedOpportunity.deadline.deadlineTimezone}) — ${selectedOpportunity.deadline.fullDaysRemaining} full days remaining`],
                    ['5. Current Application Status', `${selectedOpportunity.applicationStatus.toUpperCase()} (${selectedOpportunity.verificationStatus})`],
                    ['6. Eligible Nationalities', selectedOpportunity.eligibility.eligibleNationalities.join(', ') || 'Not Confirmed'],
                    ['7. Education Requirements', selectedOpportunity.eligibility.educationRequirement],
                    ['8. Experience Requirements', selectedOpportunity.eligibility.experienceRequirement],
                    ['9. Required Skills', selectedOpportunity.eligibility.requiredSkills.length > 0 ? selectedOpportunity.eligibility.requiredSkills.join(', ') : 'See official announcement'],
                    ['10. University Recommendation', formatReqState(selectedOpportunity.eligibility.universityRecommendationRequired)],
                    ['11. Company Recommendation', formatReqState(selectedOpportunity.eligibility.companyRecommendationRequired)],
                    ['12. Institutional Nomination', formatReqState(selectedOpportunity.eligibility.institutionalNominationRequired)],
                    ['13. Funding Details', `${selectedOpportunity.funding.fundingSummary} [${selectedOpportunity.funding.transparencyTags.join(', ')}]`],
                    ['14. Airfare Coverage', formatTriState(selectedOpportunity.funding.airfareCovered)],
                    ['15. Accommodation Coverage', formatTriState(selectedOpportunity.funding.accommodationCovered)],
                    ['16. Visa Sponsorship / Visa Fees', selectedOpportunity.funding.visaSupportSummary],
                    ['17. Application Fees', selectedOpportunity.funding.applicationFee],
                    ['18. Location & Country', `${selectedOpportunity.location} (${selectedOpportunity.country})`],
                    ['19. Start Date', selectedOpportunity.deadline.startDate || 'Not Confirmed'],
                    ['20. Last Verification Date', `${formatDateTimeShort(selectedOpportunity.lastVerifiedAt)}${isAdmin ? ` (HTTP ${selectedOpportunity.httpStatusCode ?? 'Verified'})` : ''}`],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 px-4 py-2.5 bg-white">
                      <div className="font-semibold text-slate-600">{label}</div>
                      <div className="sm:col-span-2 text-[#0B132B] font-medium break-words tabular-nums">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOpportunity.verificationNotes && (
                <div className="text-[11px] text-slate-500 leading-relaxed">
                  <strong className="text-slate-700">Verification Evidence:</strong>{' '}
                  {selectedOpportunity.verificationNotes}
                </div>
              )}
            </div>

            {/* Modal Footer — Manual Application Only */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-[11px] text-slate-600">
                HopelandJobs never submits applications automatically. Always complete and verify your application
                directly on the official organization website.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleSave(selectedOpportunity)}
                  className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#0B132B] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Bookmark className={`w-3.5 h-3.5 ${selectedOpportunity.isSaved ? 'fill-current text-[#16A34A]' : ''}`} />
                  <span>{selectedOpportunity.isSaved ? 'Saved' : 'Save'}</span>
                </button>
                <a
                  href={selectedOpportunity.officialApplicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>Open Official Application Page</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
