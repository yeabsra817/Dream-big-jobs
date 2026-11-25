import React, { useState } from 'react';
import {
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
} from 'lucide-react';
import {
  CareerApplicantProfile,
  PRIMARY_BENCHMARK_PROFILE,
} from '../utils/internationalCareerIntelligence';
import {
  CvMatchApiResponse,
  matchOpportunitiesByProfileOrCv,
} from '../lib/globalOpportunitiesService';
import { GlobalOpportunity } from '../types/globalOpportunities';

interface Props {
  onSelectOpportunity?: (opp: GlobalOpportunity) => void;
}

function getSafeHttpHref(url?: string | null): string {
  if (!url) return '#';
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '#';
  } catch {
    return '#';
  }
}

function getBandAccent(band: string): string {
  if (band === 'Excellent match') return 'text-[#15803D] bg-emerald-50 border-emerald-200';
  if (band === 'Strong match') return 'text-[#1D4ED8] bg-blue-50 border-blue-200';
  if (band === 'Possible match') return 'text-amber-800 bg-amber-50 border-amber-200';
  return 'text-slate-600 bg-slate-100 border-slate-200';
}

export const CareerCvMatcherPanel: React.FC<Props> = ({ onSelectOpportunity }) => {
  const [mode, setMode] = useState<'profile' | 'cv'>('profile');
  const [profile, setProfile] = useState<CareerApplicantProfile>({ ...PRIMARY_BENCHMARK_PROFILE });
  const [skillsInput, setSkillsInput] = useState(
    PRIMARY_BENCHMARK_PROFILE.skillsAndResponsibilities.join(', ')
  );
  const [cvText, setCvText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CvMatchApiResponse | null>(null);

  const handleLoadBenchmark = () => {
    setProfile({ ...PRIMARY_BENCHMARK_PROFILE });
    setSkillsInput(PRIMARY_BENCHMARK_PROFILE.skillsAndResponsibilities.join(', '));
    setMode('profile');
    setError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setError(null);
    try {
      const text = await file.text();
      // Filter printable text cleanly if user uploads text/markdown/rtf/plain CV
      const cleaned = text.replace(/\u0000/g, ' ').replace(/\s{3,}/g, '\n').trim();
      if (cleaned.length < 20) {
        setError('Could not read text from this file. Please paste your CV text below or upload a .txt/.md CV.');
        return;
      }
      setCvText(cleaned.slice(0, 35000));
      setMode('cv');
    } catch {
      setError('Could not read file content. Please paste your CV text directly.');
    }
  };

  const handleEvaluate = async (useBenchmarkShortcut = false) => {
    setLoading(true);
    setError(null);
    try {
      if (useBenchmarkShortcut) {
        handleLoadBenchmark();
        const resp = await matchOpportunitiesByProfileOrCv({
          usePrimaryTestProfile: true,
        });
        setResult(resp);
      } else if (mode === 'cv') {
        if (cvText.trim().length < 20) {
          setError('Paste at least a few lines of your CV (education, experience, skills) to run grounded matching.');
          setLoading(false);
          return;
        }
        const resp = await matchOpportunitiesByProfileOrCv({
          cvText: cvText.trim(),
          profile: {
            nationality: profile.nationality,
            currentResidence: profile.currentResidence,
            minimumMonthlySalaryUsd: profile.minimumMonthlySalaryUsd,
            englishOnly: profile.englishOnly,
            familyReunificationImportant: profile.familyReunificationImportant,
            needsEmployerSponsorship: profile.needsEmployerSponsorship,
          },
        });
        setResult(resp);
      } else {
        const parsedSkills = skillsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const resp = await matchOpportunitiesByProfileOrCv({
          profile: {
            ...profile,
            skillsAndResponsibilities: parsedSkills,
          },
        });
        setResult(resp);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to compute weighted career match.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Benchmark Preset Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#16A34A]">
              <Sparkles className="w-4 h-4" />
              <span>100-Point Weighted International Career &amp; CV Matcher</span>
            </div>
            <h2 className="text-lg font-extrabold text-[#0B132B]">
              Match Your Real Profile or CV Against Verified Global Opportunities
            </h2>
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
              Scores every active opportunity using transparent weights: <strong>Education (15%)</strong>,{' '}
              <strong>Experience (20%)</strong>, <strong>Responsibilities (20%)</strong>,{' '}
              <strong>Visa &amp; Work Authorization (20%)</strong>, <strong>Salary (10%)</strong>,{' '}
              <strong>Language (10%)</strong>, and <strong>Relocation &amp; Family (5%)</strong>. Opportunities where
              you are ineligible for work authorization are strictly capped below 45%. Never fabricates CV credentials.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleEvaluate(true)}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Run Ethiopian Branch Manager Benchmark</span>
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setMode('profile')}
            className={`px-3.5 py-2 rounded-lg font-bold border transition-colors cursor-pointer ${
              mode === 'profile'
                ? 'bg-[#16A34A] text-white border-[#16A34A]'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Structured Career Profile Form
          </button>
          <button
            type="button"
            onClick={() => setMode('cv')}
            className={`px-3.5 py-2 rounded-lg font-bold border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              mode === 'cv'
                ? 'bg-[#16A34A] text-white border-[#16A34A]'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Upload or Paste CV (Grounded Extraction)</span>
          </button>
        </div>

        {mode === 'profile' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <label className="space-y-1">
              <span className="font-semibold text-slate-600">Nationality</span>
              <input
                type="text"
                value={profile.nationality}
                onChange={(e) => setProfile((p) => ({ ...p, nationality: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-[#FBFBFA] focus:bg-white focus:outline-none focus:border-[#16A34A]"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-600">Current Residence</span>
              <input
                type="text"
                value={profile.currentResidence}
                onChange={(e) => setProfile((p) => ({ ...p, currentResidence: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-[#FBFBFA] focus:bg-white focus:outline-none focus:border-[#16A34A]"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-600">Current / Target Position</span>
              <input
                type="text"
                value={profile.currentPosition}
                onChange={(e) => setProfile((p) => ({ ...p, currentPosition: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-[#FBFBFA] focus:bg-white focus:outline-none focus:border-[#16A34A]"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-600">Highest Degree</span>
              <input
                type="text"
                value={profile.educationDegree}
                onChange={(e) => setProfile((p) => ({ ...p, educationDegree: e.target.value }))}
                placeholder="e.g. BA, BSc, MBA, MSc"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-[#FBFBFA] focus:bg-white focus:outline-none focus:border-[#16A34A]"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-600">Field of Study</span>
              <input
                type="text"
                value={profile.educationField}
                onChange={(e) => setProfile((p) => ({ ...p, educationField: e.target.value }))}
                placeholder="e.g. Accounting and Finance"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-[#FBFBFA] focus:bg-white focus:outline-none focus:border-[#16A34A]"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-600">Total Years of Experience</span>
              <input
                type="number"
                min={0}
                max={45}
                value={profile.totalYearsExperience}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, totalYearsExperience: Number(e.target.value) || 0 }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-[#FBFBFA] focus:bg-white focus:outline-none focus:border-[#16A34A] tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-600">Management / Leadership Years</span>
              <input
                type="number"
                min={0}
                max={40}
                value={profile.managementYearsExperience}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, managementYearsExperience: Number(e.target.value) || 0 }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-[#FBFBFA] focus:bg-white focus:outline-none focus:border-[#16A34A] tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-600">Minimum Monthly Salary (USD)</span>
              <input
                type="number"
                min={0}
                step={250}
                value={profile.minimumMonthlySalaryUsd}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, minimumMonthlySalaryUsd: Number(e.target.value) || 0 }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-[#FBFBFA] focus:bg-white focus:outline-none focus:border-[#16A34A] tabular-nums"
              />
            </label>
            <div className="flex flex-col justify-center gap-2 pt-4">
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.englishOnly}
                  onChange={(e) => setProfile((p) => ({ ...p, englishOnly: e.target.checked }))}
                  className="rounded border-slate-300 text-[#16A34A] focus:ring-[#16A34A]"
                />
                <span>English-only working environment required</span>
              </label>
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.needsEmployerSponsorship}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, needsEmployerSponsorship: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-[#16A34A] focus:ring-[#16A34A]"
                />
                <span>Requires employer-sponsored work permit</span>
              </label>
            </div>
            <label className="space-y-1 sm:col-span-2 lg:col-span-3">
              <span className="font-semibold text-slate-600">
                Verified Responsibilities &amp; Skills (comma-separated — only list genuine experience)
              </span>
              <textarea
                rows={2}
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-[#FBFBFA] focus:bg-white focus:outline-none focus:border-[#16A34A]"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>{uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Upload CV Text File (.txt / .md)'}</span>
                <input
                  type="file"
                  accept=".txt,.md,.text,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-slate-500">
                Zero-fabrication rule: Only qualifications, titles, years, and skills explicitly written in your CV are extracted.
              </span>
            </div>
            <textarea
              rows={6}
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder="Paste your CV text here (education, years of experience, banking/finance/WASH roles, languages, key achievements)..."
              className="w-full p-3 rounded-lg border border-slate-200 bg-[#FBFBFA] focus:bg-white focus:outline-none focus:border-[#16A34A] leading-relaxed"
            />
          </div>
        )}

        {error && (
          <div className="px-3.5 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-slate-500">
            Scoring Bands: <strong>90–100%</strong> Excellent · <strong>75–89%</strong> Strong ·{' '}
            <strong>60–74%</strong> Possible · <strong>&lt;60%</strong> Low
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleEvaluate(false)}
            className="min-h-[42px] px-5 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{loading ? 'Calculating Weighted Matches...' : 'Calculate Match Scores'}</span>
          </button>
        </div>
      </div>

      {/* Results Area */}
      {result && (
        <div className="space-y-5">
          {/* Extracted Profile Evidence & Summary Strip */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
              <div>
                <div className="text-slate-500">Opportunities Evaluated</div>
                <div className="text-lg font-extrabold text-[#0B132B]">{result.totalEvaluated}</div>
              </div>
              <div>
                <div className="text-slate-500">Excellent Matches (90–100%)</div>
                <div className="text-lg font-extrabold text-[#15803D]">{result.excellentCount}</div>
              </div>
              <div>
                <div className="text-slate-500">Strong Matches (75–89%)</div>
                <div className="text-lg font-extrabold text-[#1D4ED8]">{result.strongCount}</div>
              </div>
              <div>
                <div className="text-slate-500">Possible Matches (60–74%)</div>
                <div className="text-lg font-extrabold text-amber-700">{result.possibleCount}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
              <div>
                <strong className="text-[#0B132B]">Active Profile Evaluated:</strong>{' '}
                {result.profile.currentPosition} · {result.profile.educationDegree} {result.profile.educationField} ·{' '}
                {result.profile.totalYearsExperience} yrs exp · Min USD ${result.profile.minimumMonthlySalaryUsd.toLocaleString()}/mo ·{' '}
                {result.profile.englishOnly ? 'English-Only' : result.profile.languages.join(', ')}
              </div>
              {result.profile.cvEvidenceSnippets && result.profile.cvEvidenceSnippets.length > 0 && (
                <div className="text-[11px] text-[#15803D]">
                  <strong>Grounded CV Evidence:</strong> {result.profile.cvEvidenceSnippets.join(' · ')}
                </div>
              )}
            </div>
          </div>

          {/* Ranked Opportunities */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-[#0B132B] flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#16A34A]" />
              <span>Ranked International Opportunities ({result.matches.length})</span>
            </h3>
            {result.matches.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-xs text-slate-600 text-center">
                No active verified opportunities are currently in the live index. Check back after the next scheduled verification cycle.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {result.matches.slice(0, 20).map(({ opportunity, match }) => (
                  <article
                    key={opportunity.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between gap-3 text-xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-slate-500">
                            {match.regionGroup} · {opportunity.country} · {opportunity.organization}
                          </div>
                          <h4 className="text-sm font-bold text-[#0B132B] mt-0.5 leading-snug">
                            {opportunity.title}
                          </h4>
                        </div>
                        <div
                          className={`px-2.5 py-1.5 rounded-lg border text-right shrink-0 tabular-nums ${getBandAccent(
                            match.band
                          )}`}
                        >
                          <div className="text-base font-extrabold leading-none">{match.totalScore}%</div>
                          <div className="text-[10px] font-bold mt-0.5">{match.band}</div>
                        </div>
                      </div>

                      {match.cappedDueToWorkAuth && (
                        <div className="px-2.5 py-1.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                          <span>Score capped (&le;45%) because work authorization / sponsorship eligibility is not confirmed.</span>
                        </div>
                      )}

                      {/* 7-Dimension Weighted Breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px] tabular-nums">
                        <div>
                          <span className="text-slate-500">Education:</span>{' '}
                          <strong className="text-[#0B132B]">{match.breakdown.educationScore}/15</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Experience:</span>{' '}
                          <strong className="text-[#0B132B]">{match.breakdown.experienceScore}/20</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Role Fit:</span>{' '}
                          <strong className="text-[#0B132B]">{match.breakdown.responsibilityScore}/20</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Visa/Auth:</span>{' '}
                          <strong className="text-[#0B132B]">{match.breakdown.visaEligibilityScore}/20</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Salary:</span>{' '}
                          <strong className="text-[#0B132B]">{match.breakdown.salaryScore}/10</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Language:</span>{' '}
                          <strong className="text-[#0B132B]">{match.breakdown.languageScore}/10</strong>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-500">Relocation/Family:</span>{' '}
                          <strong className="text-[#0B132B]">{match.breakdown.relocationFamilyScore}/5</strong>
                        </div>
                      </div>

                      {/* Visa & Salary Snapshot */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                        <div>
                          <span className="text-slate-500 font-semibold">Visa Tier: </span>
                          <span className={match.visaChecklist.sponsorshipConfirmed ? 'text-[#15803D] font-bold' : 'text-amber-800 font-semibold'}>
                            {match.visaChecklist.displayLabel}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold">Est. Monthly USD: </span>
                          <span className="font-bold text-[#0B132B] tabular-nums">
                            {match.salaryInfo.hasAdvertisedSalary && match.salaryInfo.estimatedMonthlyUsd
                              ? `$${match.salaryInfo.estimatedMonthlyUsd.toLocaleString()}/mo (${match.salaryInfo.grossOrNet})`
                              : 'Not disclosed by employer'}
                          </span>
                        </div>
                      </div>

                      {match.matchReasons.length > 0 && (
                        <div className="text-[11px] text-[#15803D] flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{match.matchReasons.slice(0, 3).join(' · ')}</span>
                        </div>
                      )}
                      {match.gapOrMismatchReasons.length > 0 && (
                        <div className="text-[11px] text-amber-800">
                          <strong>Watch-outs:</strong> {match.gapOrMismatchReasons.slice(0, 2).join(' · ')}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {onSelectOpportunity ? (
                        <button
                          type="button"
                          onClick={() => onSelectOpportunity(opportunity)}
                          className="text-xs font-bold text-[#0B132B] hover:text-[#16A34A] cursor-pointer"
                        >
                          Full Checklist
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          {opportunity.deadline.fullDaysRemaining}d remaining
                        </span>
                      )}
                      <a
                        href={getSafeHttpHref(opportunity.officialApplicationUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <span>Official Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Matching Permanent Residency Pathways */}
          {result.permanentResidencyMatches && result.permanentResidencyMatches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-[#0B132B] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                <span>Top Official Permanent Residency &amp; Work-to-PR Pathways for This Profile</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {result.permanentResidencyMatches.slice(0, 9).map(({ pathway, assessment }) => (
                  <div
                    key={pathway.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-[#0B132B] flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          {pathway.country}
                        </span>
                        <span
                          className={`text-[11px] font-bold ${
                            assessment.fitLevel.startsWith('Strong')
                              ? 'text-[#15803D]'
                              : assessment.fitLevel.startsWith('Possible')
                              ? 'text-[#1D4ED8]'
                              : 'text-slate-500'
                          }`}
                        >
                          {assessment.fitLevel.split('(')[0].trim()}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-700">{pathway.programName}</div>
                      <div className="text-[11px] text-slate-500">{pathway.pathwayClassificationLabel}</div>
                      {assessment.notes.length > 0 && (
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600">
                          {assessment.notes.slice(0, 3).map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <a
                      href={getSafeHttpHref(pathway.officialApplicationUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-[#16A34A] hover:underline inline-flex items-center gap-1 pt-1"
                    >
                      <BadgeCheck className="w-3.5 h-3.5" />
                      <span>Official Government Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
