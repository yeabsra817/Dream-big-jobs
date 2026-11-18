import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Globe,
  Info,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  INTERNATIONAL_JOB_CATEGORIES,
  InternationalJob,
  OFFICIAL_NOT_STATED,
  RESEARCH_REGIONS,
} from '../types/international';
import { JobSeekerProfile } from '../types/jobSeeker';
import {
  assessInternationalJobExperienceMatch,
  ExperienceMatchAssessment,
  hasProfileExperienceSignals,
} from '../utils/recommendationEngine';

interface Props {
  jobs: InternationalJob[];
  onBack: () => void;
  userProfile?: JobSeekerProfile | null;
  onOpenAuth?: () => void;
  onOpenProfile?: () => void;
}

const FEE_POLICY_LABELS: Record<InternationalJob['visaFeePolicy'], string> = {
  employer_paid: 'Employer-Paid Visa / Permit Costs (Confirmed)',
  free_recruitment_applicant_pays_gov_fee:
    'Free Recruitment Process (Applicant Pays Gov Fees)',
  fee_waived_official: 'Official Fee Waiver Confirmed',
  not_stated: 'Fee Responsibility Not Stated Officially',
};

export const InternationalJobsView: React.FC<Props> = ({
  jobs,
  onBack,
  userProfile = null,
  onOpenAuth,
  onOpenProfile,
}) => {
  const hasExpSignals = useMemo(() => hasProfileExperienceSignals(userProfile), [userProfile]);
  const [viewMode, setViewMode] = useState<'experience' | 'all'>(() =>
    hasExpSignals ? 'experience' : 'all'
  );
  const userToggledModeRef = useRef(false);

  useEffect(() => {
    if (hasExpSignals && !userToggledModeRef.current) {
      setViewMode('experience');
    } else if (!hasExpSignals) {
      setViewMode('all');
    }
  }, [hasExpSignals]);

  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [countryFilter, setCountryFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [feePolicyFilter, setFeePolicyFilter] = useState<string>('All');
  const [visaSponsoredOnly, setVisaSponsoredOnly] = useState<boolean>(false);
  const [prOrFamilyOnly, setPrOrFamilyOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<InternationalJob | null>(null);

  const verifiedOpenJobs = useMemo(() => {
    return jobs.filter(
      (j) =>
        j.verificationStatus === 'VERIFIED' &&
        j.applicationStatus !== 'expired' &&
        j.applicationStatus !== 'closed'
    );
  }, [jobs]);

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    verifiedOpenJobs.forEach((j) => {
      if (regionFilter === 'All' || j.region === regionFilter) {
        if (j.country) set.add(j.country);
      }
    });
    return Array.from(set).sort();
  }, [verifiedOpenJobs, regionFilter]);

  const assessedJobs = useMemo(() => {
    const items: Array<{ job: InternationalJob; match: ExperienceMatchAssessment }> =
      verifiedOpenJobs.map((job) => ({
        job,
        match: assessInternationalJobExperienceMatch(userProfile, job),
      }));

    if (hasExpSignals) {
      items.sort((a, b) => {
        if (a.match.isMatch !== b.match.isMatch) return a.match.isMatch ? -1 : 1;
        if (a.match.isMatch && b.match.isMatch) {
          if (a.match.meetsYearsRequirement !== b.match.meetsYearsRequirement) {
            return a.match.meetsYearsRequirement ? -1 : 1;
          }
          if (a.match.matchType !== b.match.matchType) {
            return a.match.matchType === 'direct' ? -1 : 1;
          }
          if (a.match.score !== b.match.score) return b.match.score - a.match.score;
        }
        if (a.job.visaSponsored !== b.job.visaSponsored) return a.job.visaSponsored ? -1 : 1;
        return 0;
      });
    }
    return items;
  }, [verifiedOpenJobs, userProfile, hasExpSignals]);

  const experienceMatchedCount = useMemo(
    () => assessedJobs.filter((item) => item.match.isMatch).length,
    [assessedJobs]
  );

  const filteredJobItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assessedJobs.filter(({ job: j, match }) => {
      if (viewMode === 'experience' && hasExpSignals && !match.isMatch) return false;
      if (regionFilter !== 'All' && j.region !== regionFilter) return false;
      if (countryFilter !== 'All' && j.country !== countryFilter) return false;
      if (categoryFilter !== 'All' && j.category !== categoryFilter) return false;
      if (feePolicyFilter !== 'All' && j.visaFeePolicy !== feePolicyFilter) return false;
      if (visaSponsoredOnly && !j.visaSponsored) return false;
      if (
        prOrFamilyOnly &&
        (!j.permanentResidencePathway ||
          j.permanentResidencePathway === OFFICIAL_NOT_STATED ||
          /^no\b/i.test(j.permanentResidencePathway))
      ) {
        return false;
      }
      if (q) {
        const hay = `${j.jobTitle} ${j.employerOrProgramme} ${j.country} ${j.location} ${j.category} ${j.requiredEducation} ${j.visaSponsorshipInfo}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    assessedJobs,
    viewMode,
    hasExpSignals,
    regionFilter,
    countryFilter,
    categoryFilter,
    feePolicyFilter,
    visaSponsoredOnly,
    prOrFamilyOnly,
    searchQuery,
  ]);

  return (
    <div className="min-h-screen bg-[#FBFBFA] pb-20">
      {/* Header */}
      <section className="bg-[#0B132B] text-white border-b border-slate-800 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Hopeland Jobs Home</span>
          </button>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
                <Globe className="w-4 h-4" />
                <span>Official International Workforce Discovery</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                INTERNATIONAL WORKFORCE &amp; VISA-SPONSORED JOBS
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Verified foreign employers and government-approved recruitment programmes across Europe, Middle East, Far East &amp; Asia, and worldwide. Every listing cites its original official source, exact fee transparency, and verified direct application URL.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 shrink-0 tabular-nums">
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="text-xl font-black text-amber-400">{verifiedOpenJobs.length}</div>
                <div className="text-[11px] font-semibold text-slate-400">Verified Jobs</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="text-xl font-black text-emerald-400">
                  {verifiedOpenJobs.filter((j) => j.visaSponsored).length}
                </div>
                <div className="text-[11px] font-semibold text-slate-400">Visa Sponsored</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="text-xl font-black text-white">
                  {new Set(verifiedOpenJobs.map((j) => j.country)).size}
                </div>
                <div className="text-[11px] font-semibold text-slate-400">Countries</div>
              </div>
            </div>
          </div>

          {/* Visa Fee Honesty Notice */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Anti-Scam &amp; Visa Fee Transparency:</strong> Hopeland never labels a visa as &quot;free&quot; unless an official government or employer announcement explicitly confirms fee waivers or employer payment. Free recruitment (no agency fee) is strictly distinguished from government visa fees payable by applicants.
            </span>
          </div>
        </div>
      </section>

      {/* Filter Bar & Experience-First Switcher */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          {hasExpSignals ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    userToggledModeRef.current = true;
                    setViewMode('experience');
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    viewMode === 'experience'
                      ? 'bg-[#0B132B] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${viewMode === 'experience' ? 'text-amber-400' : 'text-emerald-600'}`} />
                  <span>Based on Your Experience ({experienceMatchedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    userToggledModeRef.current = true;
                    setViewMode('all');
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    viewMode === 'all'
                      ? 'bg-[#16A34A] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>See All Jobs ({verifiedOpenJobs.length})</span>
                </button>
              </div>
              <p className="text-[11px] font-medium text-slate-500">
                Includes your direct profession &amp; related career fields first (e.g. Banking ↔ Finance).
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 bg-emerald-50/60 -mx-1 px-3 py-2.5 rounded-xl border border-emerald-200/70">
              <div className="flex items-start gap-2 text-xs text-slate-700">
                <UserCheck className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#0B132B]">Personalize Visa-Sponsored Jobs:</strong>{' '}
                  {userProfile
                    ? 'Add your work experience or expertise to see matching & related-field jobs first.'
                    : 'Sign in and fill your experience to prioritize visa-sponsored jobs suited to your profession & related fields first.'}
                </span>
              </div>
              {userProfile ? (
                onOpenProfile && (
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="px-3.5 py-1.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs shrink-0 self-start sm:self-auto cursor-pointer transition-colors"
                  >
                    Add Experience
                  </button>
                )
              ) : (
                onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white font-bold text-xs shrink-0 self-start sm:self-auto cursor-pointer transition-colors"
                  >
                    Sign In / Set Experience
                  </button>
                )
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, employer, country..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <select
              value={regionFilter}
              onChange={(e) => {
                setRegionFilter(e.target.value);
                setCountryFilter('All');
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="All">All Regions</option>
              {RESEARCH_REGIONS.map((r) => (
                <option key={r.region} value={r.region}>
                  {r.region}
                </option>
              ))}
            </select>

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="All">All Countries ({availableCountries.length})</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="All">All Workforce Sectors</option>
              {INTERNATIONAL_JOB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={feePolicyFilter}
                onChange={(e) => setFeePolicyFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
              >
                <option value="All">All Fee Policies</option>
                <option value="employer_paid">Employer-Paid Visa / Work Permit</option>
                <option value="free_recruitment_applicant_pays_gov_fee">Free Recruitment (Gov Fee Separate)</option>
                <option value="fee_waived_official">Official Fee Waiver</option>
              </select>

              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visaSponsoredOnly}
                  onChange={(e) => setVisaSponsoredOnly(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>Employer-Sponsored Visa Only</span>
              </label>

              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prOrFamilyOnly}
                  onChange={(e) => setPrOrFamilyOnly(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>PR / Long-Term Pathway Stated</span>
              </label>
            </div>

            {(regionFilter !== 'All' ||
              countryFilter !== 'All' ||
              categoryFilter !== 'All' ||
              feePolicyFilter !== 'All' ||
              visaSponsoredOnly ||
              prOrFamilyOnly ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setRegionFilter('All');
                  setCountryFilter('All');
                  setCategoryFilter('All');
                  setFeePolicyFilter('All');
                  setVisaSponsoredOnly(false);
                  setPrOrFamilyOnly(false);
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-slate-600 hover:text-slate-950 underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Listings */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {filteredJobItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <Globe className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-extrabold text-slate-900">
              {viewMode === 'experience' && hasExpSignals && verifiedOpenJobs.length > 0
                ? 'No Visa-Sponsored Jobs Matched Your Experience & Current Filters'
                : 'No Verified International Vacancies Found Yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              {verifiedOpenJobs.length === 0
                ? 'Hopeland strictly publishes international opportunities only after source authority verification and live link checks pass. Administrators can run the International Workforce Discovery Engine or add verified official postings from the Admin Control Panel.'
                : viewMode === 'experience' && hasExpSignals
                  ? 'You can view all verified international and visa-sponsored listings across every sector, or widen your filters.'
                  : 'No verified opportunities match your current filter combination. Try widening your country, region, or fee policy filters.'}
            </p>
            {viewMode === 'experience' && hasExpSignals && verifiedOpenJobs.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    userToggledModeRef.current = true;
                    setViewMode('all');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <Globe className="w-4 h-4" />
                  <span>See All {verifiedOpenJobs.length} Visa &amp; International Jobs</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredJobItems.map(({ job, match }) => (
              <article
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                      {job.country} · {job.region}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified</span>
                    </span>
                  </div>

                  {match.isMatch && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          match.matchType === 'direct'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-sky-50 text-sky-800 border border-sky-200'
                        }`}
                      >
                        <Sparkles className="w-3 h-3 shrink-0" />
                        <span>{match.badgeLabel}</span>
                      </span>
                      {job.visaSponsored && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                          Visa Sponsored
                        </span>
                      )}
                    </div>
                  )}

                  <div>
                    <h2
                      onClick={() => setSelectedJob(job)}
                      className="text-base font-extrabold text-[#0B132B] hover:text-amber-600 transition-colors cursor-pointer leading-snug"
                    >
                      {job.jobTitle}
                    </h2>
                    <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{job.employerOrProgramme}</span>
                    </p>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">{job.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        <strong className="text-slate-900">Experience:</strong>{' '}
                        {job.requiredExperience || OFFICIAL_NOT_STATED}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700">
                      <strong className="text-slate-900">Ethiopian Applicants:</strong>{' '}
                      {job.foreignerAndEthiopianEligibility}
                    </div>
                    <div className="text-[11px] text-slate-700">
                      <strong className="text-slate-900">Fee Transparency:</strong>{' '}
                      {FEE_POLICY_LABELS[job.visaFeePolicy]}
                    </div>
                    <div className="text-[11px] text-slate-700">
                      <strong className="text-slate-900">Published Salary:</strong>{' '}
                      <span className="tabular-nums">{job.salary}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate max-w-[130px]">{job.applicationDeadline}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedJob(job)}
                    className="px-3.5 py-2 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    19 Official Details
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 19-Field Full Official Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#0B132B] text-white px-6 py-5 flex items-start justify-between gap-4 border-b border-slate-800 shrink-0">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  {selectedJob.country} ({selectedJob.region}) · {selectedJob.category}
                </div>
                <h3 className="text-lg sm:text-2xl font-extrabold text-white mt-1">
                  {selectedJob.jobTitle}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Employer / Programme: <strong className="text-white">{selectedJob.employerOrProgramme}</strong> · Location: {selectedJob.location}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: All 19 Required Fields */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Visa & Recruitment Fee Transparency Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 font-extrabold text-slate-900">
                  <Info className="w-4 h-4 text-amber-600" />
                  <span>Visa Sponsorship &amp; Cost Breakdown (Official Source)</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  <strong>Policy:</strong> {FEE_POLICY_LABELS[selectedJob.visaFeePolicy]}
                </p>
                <p className="text-slate-700 leading-relaxed">
                  <strong>Visa Sponsorship:</strong> {selectedJob.visaSponsorshipInfo}
                </p>
                <p className="text-slate-700 leading-relaxed">
                  <strong>Who Pays Visa &amp; Recruitment Costs:</strong> {selectedJob.whoPaysVisaAndRecruitmentCosts}
                </p>
              </div>

              {/* Structured 19-Field Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { num: '1', label: 'Country', val: selectedJob.country },
                  { num: '2', label: 'Employer / Government Programme', val: selectedJob.employerOrProgramme },
                  { num: '3', label: 'Job Title', val: selectedJob.jobTitle },
                  { num: '4', label: 'Location', val: selectedJob.location },
                  { num: '5', label: 'Required Education', val: selectedJob.requiredEducation },
                  { num: '6', label: 'Required Experience', val: selectedJob.requiredExperience },
                  { num: '7', label: 'Language Requirements', val: selectedJob.languageRequirements },
                  { num: '8', label: 'Official Published Salary', val: selectedJob.salary },
                  { num: '9', label: 'Foreigner & Ethiopian Eligibility', val: selectedJob.foreignerAndEthiopianEligibility },
                  { num: '10', label: 'Visa Sponsorship Information', val: selectedJob.visaSponsorshipInfo },
                  { num: '11', label: 'Visa & Recruitment Costs', val: selectedJob.whoPaysVisaAndRecruitmentCosts },
                  { num: '12', label: 'Accommodation & Relocation Support', val: selectedJob.accommodationAndRelocationSupport },
                  { num: '13', label: 'Contract Duration', val: selectedJob.contractDuration },
                  { num: '14', label: 'Application Deadline', val: selectedJob.applicationDeadline },
                ].map((f) => (
                  <div key={f.num} className="p-3.5 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Field {f.num} · {f.label}
                    </div>
                    <div className="text-xs font-semibold text-slate-900 mt-1 leading-relaxed tabular-nums">
                      {f.val || OFFICIAL_NOT_STATED}
                    </div>
                  </div>
                ))}
              </div>

              {/* Fields 15-19 */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Field 15 · Required Documents
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-800 font-medium">
                    {(selectedJob.requiredDocuments && selectedJob.requiredDocuments.length > 0
                      ? selectedJob.requiredDocuments
                      : [OFFICIAL_NOT_STATED]
                    ).map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Field 16 · Official Application Instructions
                  </div>
                  <p className="text-slate-800 leading-relaxed whitespace-pre-line">
                    {selectedJob.officialApplicationInstructions || OFFICIAL_NOT_STATED}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Family Reunification &amp; Long-Term Residence
                    </div>
                    <p className="text-slate-800 leading-relaxed">
                      <strong>Family Reunification:</strong> {selectedJob.familyReunification || OFFICIAL_NOT_STATED}
                    </p>
                    <p className="text-slate-800 leading-relaxed mt-1">
                      <strong>PR Pathway:</strong> {selectedJob.permanentResidencePathway || OFFICIAL_NOT_STATED}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      Field 18 &amp; 19 · Original Official Source &amp; Last Verified
                    </div>
                    <p className="text-emerald-950 font-semibold break-all">
                      Source ({selectedJob.sourceAuthorityType}):{' '}
                      <a
                        href={selectedJob.originalSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-emerald-700"
                      >
                        {selectedJob.originalSourceUrl}
                      </a>
                    </p>
                    <p className="text-emerald-900 tabular-nums">
                      Last Verified: {new Date(selectedJob.lastVerifiedAt).toLocaleString()} (HTTP {selectedJob.lastCheckedHttpStatus || 200})
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer CTA */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <a
                href={selectedJob.originalSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Original Source Announcement</span>
              </a>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
                >
                  Close
                </button>
                <a
                  href={selectedJob.directApplicationUrl || selectedJob.originalSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm"
                >
                  <span>Field 17: Direct Official Application Link</span>
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
