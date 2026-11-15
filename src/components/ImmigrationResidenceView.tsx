import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Globe,
  Landmark,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  ImmigrationPathway,
  OFFICIAL_NOT_STATED,
  RESEARCH_REGIONS,
} from '../types/international';

interface Props {
  pathways: ImmigrationPathway[];
  onBack: () => void;
}

const PATHWAY_TYPES: ImmigrationPathway['pathwayType'][] = [
  'Work-Based Residence Permit',
  'Permanent Residence',
  'Long-Term Residence',
  'Skilled Worker Immigration',
  'Employer-Sponsored Immigration',
  'Job-Seeker Visa',
  'Family Reunification',
  'Citizenship Track',
];

export const ImmigrationResidenceView: React.FC<Props> = ({ pathways, onBack }) => {
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [countryFilter, setCountryFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [eligibilityFilter, setEligibilityFilter] = useState<string>('All');
  const [jobOfferFilter, setJobOfferFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPathway, setSelectedPathway] = useState<ImmigrationPathway | null>(null);

  const verifiedPathways = useMemo(
    () => pathways.filter((p) => p.verificationStatus === 'VERIFIED'),
    [pathways]
  );

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    verifiedPathways.forEach((p) => {
      if (regionFilter === 'All' || p.region === regionFilter) {
        if (p.country) set.add(p.country);
      }
    });
    return Array.from(set).sort();
  }, [verifiedPathways, regionFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return verifiedPathways.filter((p) => {
      if (regionFilter !== 'All' && p.region !== regionFilter) return false;
      if (countryFilter !== 'All' && p.country !== countryFilter) return false;
      if (typeFilter !== 'All' && p.pathwayType !== typeFilter) return false;
      if (eligibilityFilter !== 'All' && p.ethiopianCitizenEligibility !== eligibilityFilter) return false;
      if (jobOfferFilter !== 'All' && p.jobOfferRequired !== jobOfferFilter) return false;
      if (q) {
        const hay = `${p.country} ${p.pathwayTitle} ${p.pathwayType} ${p.eligibilityRequirements} ${p.ethiopianEligibilityDetails}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    verifiedPathways,
    regionFilter,
    countryFilter,
    typeFilter,
    eligibilityFilter,
    jobOfferFilter,
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
                <Landmark className="w-4 h-4" />
                <span>Official Government Portals Only</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                INTERNATIONAL IMMIGRATION &amp; PERMANENT RESIDENCE
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Verified legal immigration pathways, work-based residence permits, permanent residence, skilled worker programmes, job-seeker visas, family reunification, and citizenship tracks for Ethiopian citizens — sourced exclusively from official ministries, embassies, and immigration departments.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 shrink-0 tabular-nums">
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="text-xl font-black text-amber-400">{verifiedPathways.length}</div>
                <div className="text-[11px] font-semibold text-slate-400">Verified Routes</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="text-xl font-black text-emerald-400">
                  {verifiedPathways.filter((p) => p.ethiopianCitizenEligibility === 'eligible').length}
                </div>
                <div className="text-[11px] font-semibold text-slate-400">ET Eligible</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="text-xl font-black text-white">
                  {new Set(verifiedPathways.map((p) => p.country)).size}
                </div>
                <div className="text-[11px] font-semibold text-slate-400">Countries</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Strict Immigration Accuracy Policy:</strong> Temporary work permits are explicitly distinguished from permanent residence. Where a country has no confirmed immigration pathway for Ethiopian citizens, that status is transparently stated. Zero third-party blogs or unverified consultants are used.
            </span>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country, visa programme, language or PR rule..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <select
              value={regionFilter}
              onChange={(e) => {
                setRegionFilter(e.target.value);
                setCountryFilter('All');
              }}
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
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
            >
              <option value="All">All Countries ({availableCountries.length})</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
            >
              <option value="All">All Pathway Types</option>
              {PATHWAY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={eligibilityFilter}
                onChange={(e) => setEligibilityFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
              >
                <option value="All">Ethiopian Eligibility: All</option>
                <option value="eligible">Eligible for Ethiopian Citizens</option>
                <option value="conditional">Conditional / Quota Based</option>
                <option value="no_confirmed_route">No Confirmed Route Stated</option>
              </select>

              <select
                value={jobOfferFilter}
                onChange={(e) => setJobOfferFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
              >
                <option value="All">Job Offer Requirement: Any</option>
                <option value="no">No Job Offer Required</option>
                <option value="yes">Job Offer Required</option>
                <option value="conditional">Conditional</option>
              </select>
            </div>

            {(regionFilter !== 'All' ||
              countryFilter !== 'All' ||
              typeFilter !== 'All' ||
              eligibilityFilter !== 'All' ||
              jobOfferFilter !== 'All' ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setRegionFilter('All');
                  setCountryFilter('All');
                  setTypeFilter('All');
                  setEligibilityFilter('All');
                  setJobOfferFilter('All');
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

      {/* Pathway Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <Landmark className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-extrabold text-slate-900">
              No Verified Government Immigration Pathways Listed Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              {verifiedPathways.length === 0
                ? 'Hopeland strictly publishes immigration and permanent residence routes only after verifying official ministry, immigration department, or embassy portals. Administrators can run Legal Immigration Research from the Admin Control Panel.'
                : 'No pathways match your selected filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((p) => (
              <article
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {p.country} · {p.pathwayType}
                    </div>
                    {p.ethiopianCitizenEligibility === 'no_confirmed_route' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>No Confirmed Route</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {p.ethiopianCitizenEligibility === 'eligible'
                            ? 'ET Citizens Eligible'
                            : 'Conditional Eligibility'}
                        </span>
                      </span>
                    )}
                  </div>

                  <h2
                    onClick={() => setSelectedPathway(p)}
                    className="text-base sm:text-lg font-extrabold text-[#0B132B] hover:text-amber-600 transition-colors cursor-pointer leading-snug"
                  >
                    {p.pathwayTitle}
                  </h2>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                    {p.ethiopianEligibilityDetails}
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Years to Permanent Residence
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {p.yearsToPermanentResidence}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Job Offer Required
                      </span>
                      <span className="font-bold text-slate-900 capitalize">
                        {p.jobOfferRequired === 'not_stated'
                          ? OFFICIAL_NOT_STATED
                          : p.jobOfferRequired}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Gov Application Fee
                      </span>
                      <span className="font-semibold text-slate-800 line-clamp-1">
                        {p.governmentApplicationFees}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Language Requirement
                      </span>
                      <span className="font-semibold text-slate-800 line-clamp-1">
                        {p.languageRequirements}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    Verified {new Date(p.lastVerifiedAt).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPathway(p)}
                    className="px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Full Requirements &amp; Steps
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Detail Modal */}
      {selectedPathway && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0B132B] text-white px-6 py-5 flex items-start justify-between gap-4 border-b border-slate-800 shrink-0">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  {selectedPathway.country} ({selectedPathway.region}) · {selectedPathway.pathwayType}
                </div>
                <h3 className="text-lg sm:text-2xl font-extrabold text-white mt-1">
                  {selectedPathway.pathwayTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPathway(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                <div className="font-extrabold text-slate-900">
                  Temporary Work Permit vs. Permanent Residence Clarification
                </div>
                <p className="text-slate-800 leading-relaxed">
                  {selectedPathway.temporaryVsPermanentClarification || OFFICIAL_NOT_STATED}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Ethiopian Citizen Eligibility', val: `${selectedPathway.ethiopianCitizenEligibility.toUpperCase()} — ${selectedPathway.ethiopianEligibilityDetails}` },
                  { label: 'General Eligibility Requirements', val: selectedPathway.eligibilityRequirements },
                  { label: 'Required Education & Experience', val: selectedPathway.requiredEducationAndExperience },
                  { label: 'Minimum Income / Financial Requirement', val: selectedPathway.minimumIncomeOrFinancialRequirement },
                  { label: 'Language Requirements', val: selectedPathway.languageRequirements },
                  { label: 'Government Application Fees', val: selectedPathway.governmentApplicationFees },
                  { label: 'Processing Timeline', val: selectedPathway.processingTimeline },
                  { label: 'Job Offer Required?', val: selectedPathway.jobOfferRequired },
                  { label: 'Legal Residence Before PR', val: selectedPathway.yearsToPermanentResidence },
                  { label: 'Family Reunification Rules', val: selectedPathway.familyReunificationRules },
                ].map((item) => (
                  <div key={item.label} className="p-3.5 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {item.label}
                    </div>
                    <div className="text-xs font-semibold text-slate-900 mt-1 leading-relaxed">
                      {item.val || OFFICIAL_NOT_STATED}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Citizenship Track Notes
                </div>
                <p className="text-slate-800 leading-relaxed">
                  {selectedPathway.citizenshipPathwayNotes || OFFICIAL_NOT_STATED}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Required Documents
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-800 font-medium">
                    {(selectedPathway.requiredDocuments?.length > 0
                      ? selectedPathway.requiredDocuments
                      : [OFFICIAL_NOT_STATED]
                    ).map((doc, idx) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Exact Official Application Steps
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-800 font-medium">
                    {(selectedPathway.exactApplicationSteps?.length > 0
                      ? selectedPathway.exactApplicationSteps
                      : [OFFICIAL_NOT_STATED]
                    ).map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Official Government Authority &amp; Verification Audit
                </div>
                <p className="font-semibold break-all">
                  Portal ({selectedPathway.sourceAuthorityType}):{' '}
                  <a
                    href={selectedPathway.originalSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {selectedPathway.originalSourceUrl}
                  </a>
                </p>
                <p className="tabular-nums">
                  Last Verified: {new Date(selectedPathway.lastVerifiedAt).toLocaleString()} (HTTP {selectedPathway.lastCheckedHttpStatus || 200})
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <a
                href={selectedPathway.originalSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Original Official Source</span>
              </a>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedPathway(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
                >
                  Close
                </button>
                <a
                  href={selectedPathway.officialGovernmentWebsite || selectedPathway.originalSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Open Official Government Immigration Website</span>
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
