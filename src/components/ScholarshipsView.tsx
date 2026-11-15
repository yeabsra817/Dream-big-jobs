import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  ExperienceScholarship,
  OFFICIAL_NOT_STATED,
  RESEARCH_REGIONS,
} from '../types/international';

interface Props {
  scholarships: ExperienceScholarship[];
  onBack: () => void;
}

const STUDY_LEVELS: ExperienceScholarship['studyLevel'][] = [
  'Undergraduate',
  'Postgraduate / Master',
  'Leadership & Executive',
  'Professional Development',
  'Short Course',
  'PhD / Research',
];

export const ScholarshipsView: React.FC<Props> = ({ scholarships, onBack }) => {
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [levelFilter, setLevelFilter] = useState<string>('All');
  const [expCompensatesOnly, setExpCompensatesOnly] = useState<boolean>(false);
  const [noHighGpaOnly, setNoHighGpaOnly] = useState<boolean>(false);
  const [noRecLetterOnly, setNoRecLetterOnly] = useState<boolean>(false);
  const [fullFundingOnly, setFullFundingOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedScholarship, setSelectedScholarship] = useState<ExperienceScholarship | null>(null);

  const verifiedOpen = useMemo(
    () =>
      scholarships.filter(
        (s) =>
          s.verificationStatus === 'VERIFIED' &&
          s.applicationStatus !== 'expired' &&
          s.applicationStatus !== 'closed'
      ),
    [scholarships]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return verifiedOpen.filter((s) => {
      if (regionFilter !== 'All' && s.region !== regionFilter) return false;
      if (levelFilter !== 'All' && s.studyLevel !== levelFilter) return false;
      if (
        expCompensatesOnly &&
        s.professionalExperienceCompensates !== 'confirmed_yes' &&
        s.professionalExperienceCompensates !== 'considered'
      ) {
        return false;
      }
      if (noHighGpaOnly && !s.noHighGpaConfirmed) return false;
      if (noRecLetterOnly && !s.noRecommendationLetterConfirmed) return false;
      if (
        fullFundingOnly &&
        !(s.coversTuition && (s.coversLivingAllowance || s.coversAccommodation))
      ) {
        return false;
      }
      if (q) {
        const hay = `${s.scholarshipName} ${s.universityOrInstitution} ${s.country} ${s.studyProgramme} ${s.fundingCoverage} ${s.experienceCompensationNotes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    verifiedOpen,
    regionFilter,
    levelFilter,
    expCompensatesOnly,
    noHighGpaOnly,
    noRecLetterOnly,
    fullFundingOnly,
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
                <GraduationCap className="w-4 h-4" />
                <span>Universities, Governments &amp; Recognized Institutions</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                EXPERIENCE-BASED SCHOLARSHIPS
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Genuine undergraduate, postgraduate, leadership, and professional development scholarships open to Ethiopian applicants — prioritizing programmes that value management and work experience without misrepresenting GPA or recommendation letter rules.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 shrink-0 tabular-nums">
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="text-xl font-black text-amber-400">{verifiedOpen.length}</div>
                <div className="text-[11px] font-semibold text-slate-400">Verified Open</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="text-xl font-black text-emerald-400">
                  {
                    verifiedOpen.filter(
                      (s) =>
                        s.professionalExperienceCompensates === 'confirmed_yes' ||
                        s.professionalExperienceCompensates === 'considered'
                    ).length
                  }
                </div>
                <div className="text-[11px] font-semibold text-slate-400">Exp-Focused</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="text-xl font-black text-white">
                  {new Set(verifiedOpen.map((s) => s.country)).size}
                </div>
                <div className="text-[11px] font-semibold text-slate-400">Countries</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Eligibility Verification Policy:</strong> Hopeland never claims a scholarship waives high GPA or recommendation letters unless explicitly confirmed by the official university or scholarship announcement. Unstated fields are clearly labeled as not stated.
            </span>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search university, scholarship, study field..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
            >
              <option value="All">All Regions</option>
              {RESEARCH_REGIONS.map((r) => (
                <option key={r.region} value={r.region}>
                  {r.region}
                </option>
              ))}
            </select>

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
            >
              <option value="All">All Study Levels</option>
              {STUDY_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expCompensatesOnly}
                  onChange={(e) => setExpCompensatesOnly(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>Experience Compensates / Valued</span>
              </label>
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noHighGpaOnly}
                  onChange={(e) => setNoHighGpaOnly(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>Officially Confirmed No High GPA</span>
              </label>
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noRecLetterOnly}
                  onChange={(e) => setNoRecLetterOnly(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>Officially Confirmed No Rec Letters</span>
              </label>
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fullFundingOnly}
                  onChange={(e) => setFullFundingOnly(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>Tuition + Living Support</span>
              </label>
            </div>

            {(regionFilter !== 'All' ||
              levelFilter !== 'All' ||
              expCompensatesOnly ||
              noHighGpaOnly ||
              noRecLetterOnly ||
              fullFundingOnly ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setRegionFilter('All');
                  setLevelFilter('All');
                  setExpCompensatesOnly(false);
                  setNoHighGpaOnly(false);
                  setNoRecLetterOnly(false);
                  setFullFundingOnly(false);
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
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <GraduationCap className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-extrabold text-slate-900">
              No Verified Experience-Based Scholarships Found Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              {verifiedOpen.length === 0
                ? 'Hopeland strictly publishes scholarships only after verifying official university, government, or recognized institutional scholarship announcements. Administrators can run Scholarship Discovery from the Admin Control Panel.'
                : 'No scholarships match your active filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((s) => (
              <article
                key={s.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                      {s.country} · {s.studyLevel}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified</span>
                    </span>
                  </div>

                  <div>
                    <h2
                      onClick={() => setSelectedScholarship(s)}
                      className="text-base font-extrabold text-[#0B132B] hover:text-amber-600 transition-colors cursor-pointer leading-snug"
                    >
                      {s.scholarshipName}
                    </h2>
                    <p className="text-xs font-semibold text-slate-700 mt-1">
                      {s.universityOrInstitution}
                    </p>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div>
                      <strong className="text-slate-900">Programme:</strong> {s.studyProgramme}
                    </div>
                    <div>
                      <strong className="text-slate-900">GPA Rule:</strong> {s.gpaRequirement}
                      {s.noHighGpaConfirmed ? ' (Confirmed: no high GPA required)' : ''}
                    </div>
                    <div>
                      <strong className="text-slate-900">Recommendations:</strong>{' '}
                      {s.recommendationLetterRequirement}
                      {s.noRecommendationLetterConfirmed ? ' (Confirmed: not required)' : ''}
                    </div>
                    <div>
                      <strong className="text-slate-900">Funding:</strong> {s.fundingCoverage}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate max-w-[130px]">{s.applicationDeadline}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedScholarship(s)}
                    className="px-3.5 py-2 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    14 Official Details
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 14-Field Detail Modal */}
      {selectedScholarship && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0B132B] text-white px-6 py-5 flex items-start justify-between gap-4 border-b border-slate-800 shrink-0">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  {selectedScholarship.country} ({selectedScholarship.region}) · {selectedScholarship.studyLevel}
                </div>
                <h3 className="text-lg sm:text-2xl font-extrabold text-white mt-1">
                  {selectedScholarship.scholarshipName}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  {selectedScholarship.universityOrInstitution}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScholarship(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { num: '1', label: 'University or Institution', val: selectedScholarship.universityOrInstitution },
                  { num: '2', label: 'Country', val: selectedScholarship.country },
                  { num: '3', label: 'Scholarship Name', val: selectedScholarship.scholarshipName },
                  { num: '4', label: 'Study Programme', val: selectedScholarship.studyProgramme },
                  { num: '5', label: 'Eligibility for Ethiopian Applicants', val: selectedScholarship.eligibilityForEthiopians },
                  { num: '6', label: 'Academic Requirements', val: selectedScholarship.academicRequirements },
                  {
                    num: '7',
                    label: 'GPA Requirement',
                    val: `${selectedScholarship.gpaRequirement}${
                      selectedScholarship.noHighGpaConfirmed
                        ? ' [Officially confirmed: high GPA not required]'
                        : ''
                    }`,
                  },
                  {
                    num: '8',
                    label: 'Recommendation Letter Requirement',
                    val: `${selectedScholarship.recommendationLetterRequirement}${
                      selectedScholarship.noRecommendationLetterConfirmed
                        ? ' [Officially confirmed: recommendation letter not required]'
                        : ''
                    }`,
                  },
                  {
                    num: '9',
                    label: 'Work Experience Compensation',
                    val: `${selectedScholarship.professionalExperienceCompensates} — ${selectedScholarship.experienceCompensationNotes}`,
                  },
                  { num: '11', label: 'Funding Coverage', val: selectedScholarship.fundingCoverage },
                  { num: '12', label: 'Application Deadline', val: selectedScholarship.applicationDeadline },
                ].map((f) => (
                  <div key={f.num} className="p-3.5 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Field {f.num} · {f.label}
                    </div>
                    <div className="text-xs font-semibold text-slate-900 mt-1 leading-relaxed">
                      {f.val || OFFICIAL_NOT_STATED}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Field 10 · Required Documents
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-800 font-medium">
                    {(selectedScholarship.requiredDocuments?.length > 0
                      ? selectedScholarship.requiredDocuments
                      : [OFFICIAL_NOT_STATED]
                    ).map((doc, idx) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Field 14 · Exact Application Procedure
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-800 font-medium">
                    {(selectedScholarship.exactApplicationProcedure?.length > 0
                      ? selectedScholarship.exactApplicationProcedure
                      : [OFFICIAL_NOT_STATED]
                    ).map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Official Source &amp; Verification Status
                </div>
                <p className="font-semibold break-all">
                  Original Source ({selectedScholarship.sourceAuthorityType}):{' '}
                  <a
                    href={selectedScholarship.originalSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {selectedScholarship.originalSourceUrl}
                  </a>
                </p>
                <p className="tabular-nums">
                  Last Verified: {new Date(selectedScholarship.lastVerifiedAt).toLocaleString()} (HTTP {selectedScholarship.lastCheckedHttpStatus || 200})
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <a
                href={selectedScholarship.originalSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Original Announcement</span>
              </a>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedScholarship(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
                >
                  Close
                </button>
                <a
                  href={selectedScholarship.officialApplicationUrl || selectedScholarship.originalSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm"
                >
                  <span>Field 13: Official Scholarship Application Link</span>
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
