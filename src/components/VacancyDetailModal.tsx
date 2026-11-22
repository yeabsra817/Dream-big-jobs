import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  Bookmark,
  Share2,
  MapPin,
  UserCheck,
  Calendar,
  FileText,
  Users,
  Briefcase,
  Coins,
  Check,
  Copy,
  ExternalLink,
  Mail,
  Send,
  Sparkles,
  HelpCircle,
  Printer,
  CheckCircle2,
} from 'lucide-react';
import { Vacancy } from '../types/job';
import { JobSeekerProfile } from '../types/jobSeeker';
import { getDaysLeft } from '../utils/helpers';
import { CoverLetterAssistant } from './CoverLetterAssistant';
import { trackAnalyticsEvent } from '../lib/analyticsTracker';
import { askAiVacancyAssistant, VacancyAssistantAiResponse } from '../lib/aiService';
import { encodeTelegramVacancySnapshot } from '../utils/telegramSnapshot';

interface Props {
  vacancy: Vacancy;
  onClose: () => void;
  telegramUrl: string;
  userProfile?: JobSeekerProfile | null;
  onApplyOnWebsite?: (vacancy: Vacancy) => void;
  autoFocusApply?: boolean;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
}

function isMeaningful(val?: string | null): boolean {
  const s = String(val || '').trim();
  if (!s) return false;
  return !/^not specified(?:\s+in\s+the\s+original\s+vacancy)?$|^not stated$|^n\/a$|^none$/i.test(s);
}

function deriveCareerLevel(vacancy: Vacancy): string {
  if (isMeaningful(vacancy.jobGrade)) {
    return String(vacancy.jobGrade).trim();
  }
  const expText = String(vacancy.experienceYears || '').trim();
  const titleText = String(vacancy.title || '').toLowerCase();
  const combined = `${expText.toLowerCase()} ${titleText}`;
  const numMatch = expText.match(/(\d+)/);
  const minYears = numMatch ? Number(numMatch[1]) : null;

  if (/\b(intern|trainee|fresh|graduate|entry)\b/i.test(combined) || minYears === 0) {
    return 'Entry Level (0-1 year)';
  }
  if (
    /\b(director|head|chief|manager|principal|senior|lead)\b/i.test(titleText) ||
    (minYears !== null && minYears >= 5)
  ) {
    return expText ? `Senior Level (${expText})` : 'Senior Level (5+ years)';
  }
  if (minYears !== null && minYears >= 3) {
    return expText ? `Mid Level (${expText})` : 'Mid Level (3-5 years)';
  }
  if (minYears !== null && minYears >= 1) {
    return expText ? `Junior Level (${expText})` : 'Junior Level (1-3 years)';
  }
  return 'Mid Level';
}

function formatDeadlinePretty(deadline?: string): string {
  const s = String(deadline || '').trim();
  if (!s) return 'Open until filled';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  return s;
}

function getOrgInitials(org?: string): string {
  const words = String(org || 'HJ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'HJ';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export const VacancyDetailModal: React.FC<Props> = ({
  vacancy,
  onClose,
  telegramUrl: _telegramUrl,
  userProfile = null,
  onApplyOnWebsite,
  autoFocusApply = false,
  isSaved = false,
  onToggleSave,
}) => {
  const [copied, setCopied] = useState(false);
  const [localSaved, setLocalSaved] = useState(isSaved);
  const [bannerImgFailed, setBannerImgFailed] = useState(false);
  const [logoImgFailed, setLogoImgFailed] = useState(false);
  const [showCoverLetterHelper, setShowCoverLetterHelper] = useState(false);
  const [aiResult, setAiResult] = useState<VacancyAssistantAiResponse | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiTask, setAiTask] = useState<'analyze' | 'interview' | 'qa'>('analyze');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const applySectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocalSaved(isSaved);
  }, [isSaved]);

  useEffect(() => {
    setBannerImgFailed(false);
    setLogoImgFailed(false);
  }, [vacancy.id]);

  const handleRunAiAssistant = async (
    task: 'analyze' | 'interview' | 'qa',
    customQuestion?: string
  ) => {
    setAiTask(task);
    setIsAiLoading(true);
    setAiError(null);
    try {
      const res = await askAiVacancyAssistant({
        vacancy,
        userProfile,
        task,
        question: customQuestion,
      });
      setAiResult(res);
    } catch (err: any) {
      setAiError(err.message || 'AI Assistant could not respond right now.');
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    trackAnalyticsEvent('vacancy_view', {
      jobId: vacancy.id,
      jobTitle: vacancy.title,
      organization: vacancy.organization,
      category: vacancy.category,
      path: `/jobs/${encodeURIComponent(vacancy.id)}`,
    });
  }, [vacancy.id]);

  const daysInfo = getDaysLeft(vacancy.applicationDeadline);
  const isJobClosed =
    vacancy.status === 'expired' ||
    vacancy.status === 'closed' ||
    vacancy.status === 'archived' ||
    Boolean(daysInfo.expired);

  useEffect(() => {
    if (!autoFocusApply || isJobClosed) return;
    const timer = setTimeout(() => {
      applySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 320);
    return () => clearTimeout(timer);
  }, [autoFocusApply, isJobClosed, vacancy.id]);

  const currentUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}/jobs/${encodeURIComponent(vacancy.id)}`;
    const snap = encodeTelegramVacancySnapshot(vacancy, 1300);
    return snap ? `${base}?v=${snap}` : base;
  }, [vacancy]);

  const locationTypeLabel =
    vacancy.employmentType === 'Remote' || /remote|work from home/i.test(vacancy.location || '')
      ? 'Remote'
      : 'Office';

  const careerLevelLabel = deriveCareerLevel(vacancy);
  const deadlineDisplay = formatDeadlinePretty(vacancy.applicationDeadline);

  const handleCopyVacancy = () => {
    const text = `📋 JOB VACANCY | HOPELAND JOBS
Position: ${vacancy.title}
Organization: ${vacancy.organization}
Location: ${vacancy.location}
Deadline: ${deadlineDisplay}

Apply on HOPELAND JOBS:
${currentUrl}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeOrCopyShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${vacancy.title} at ${vacancy.organization}`,
          text: `${vacancy.title} at ${vacancy.organization} — ${vacancy.location}`,
          url: currentUrl,
        });
        return;
      } catch {}
    }
    handleCopyVacancy();
  };

  const handleBookmarkClick = () => {
    if (onToggleSave) {
      onToggleSave(vacancy.id);
    } else {
      setLocalSaved((prev) => !prev);
    }
  };

  const handlePrimaryApplyClick = () => {
    trackAnalyticsEvent('click_apply_link', {
      jobId: vacancy.id,
      jobTitle: vacancy.title,
      organization: vacancy.organization,
      category: vacancy.category,
      applyUrl: currentUrl,
      applyMethod: onApplyOnWebsite ? 'Website Application' : vacancy.applicationMethod,
    });

    if (onApplyOnWebsite) {
      onApplyOnWebsite(vacancy);
      return;
    }

    if (vacancy.applicationUrl && vacancy.applicationUrl.startsWith('http')) {
      window.open(vacancy.applicationUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (vacancy.applicationEmail) {
      window.location.href = `mailto:${vacancy.applicationEmail}?subject=${encodeURIComponent(
        `Application for ${vacancy.title}`
      )}`;
      return;
    }

    applySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const telegramShareText = encodeURIComponent(
    `💼 ${vacancy.title} at ${vacancy.organization}\n📍 ${vacancy.location} | ⏳ Deadline: ${deadlineDisplay}\nCheck details on HOPELAND JOBS:`
  );
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${telegramShareText}`;

  const whatsAppShareText = encodeURIComponent(
    `💼 ${vacancy.title} at ${vacancy.organization} (Ethiopia)\nDeadline: ${deadlineDisplay}\nApply here: ${currentUrl}`
  );
  const whatsAppShareUrl = `https://api.whatsapp.com/send?text=${whatsAppShareText}`;

  const qualificationBullets: string[] = [];
  if (isMeaningful(vacancy.educationQualification) || isMeaningful(vacancy.requiredFieldOfStudy)) {
    const eduLine = [
      isMeaningful(vacancy.educationQualification) ? vacancy.educationQualification : '',
      isMeaningful(vacancy.requiredFieldOfStudy) ? vacancy.requiredFieldOfStudy : '',
      isMeaningful(vacancy.experienceYears) ? `with ${vacancy.experienceYears} relevant experience` : '',
    ]
      .filter(Boolean)
      .join(' — ');
    if (eduLine) qualificationBullets.push(eduLine);
  }
  if (isMeaningful(vacancy.specialRequirements)) {
    qualificationBullets.push(String(vacancy.specialRequirements).trim());
  }
  if (isMeaningful(vacancy.languageRequirements)) {
    qualificationBullets.push(`Languages: ${String(vacancy.languageRequirements).trim()}`);
  }
  if (isMeaningful(vacancy.ageRequirements)) {
    qualificationBullets.push(`Age requirement: ${String(vacancy.ageRequirements).trim()}`);
  }
  if (isMeaningful(vacancy.genderRequirements)) {
    qualificationBullets.push(`Gender requirement: ${String(vacancy.genderRequirements).trim()}`);
  }
  if (qualificationBullets.length === 0) {
    qualificationBullets.push(
      `Relevant academic background in ${vacancy.category || 'this field'} with verified practical experience.`
    );
  }

  const requiredSkillsList =
    Array.isArray(vacancy.requiredSkills) && vacancy.requiredSkills.length > 0
      ? vacancy.requiredSkills.filter((s) => isMeaningful(s))
      : [];

  const desiredSkillsList =
    Array.isArray(vacancy.requiredDocuments) && vacancy.requiredDocuments.length > 0
      ? vacancy.requiredDocuments.filter((d) => isMeaningful(d))
      : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center sm:p-4 lg:p-6 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vacancy-detail-title"
    >
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 overflow-hidden flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Sticky Top App Bar */}
        <header
          className={`h-14 text-white px-2 sm:px-4 flex items-center justify-between gap-2 shrink-0 shadow-xs ${
            isJobClosed ? 'bg-slate-800' : 'bg-[#10B981]'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back to jobs"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <span className="text-base font-bold text-white truncate">
              {vacancy.title}
            </span>
            {isJobClosed && (
              <span className="shrink-0 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                Closed
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleBookmarkClick}
              aria-label={localSaved ? 'Remove bookmark' : 'Save job'}
              title={localSaved ? 'Saved' : 'Save job'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer"
            >
              <Bookmark
                className={`w-5 h-5 text-white ${localSaved ? 'fill-white' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={handleNativeOrCopyShare}
              aria-label="Share job link"
              title="Share job"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer"
            >
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </header>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 bg-white">
          {/* Hero Banner with Centered Location & Contrast Scrim */}
          <div className="relative h-40 sm:h-48 w-full bg-gradient-to-br from-[#0B132B] via-slate-800 to-[#065F46] overflow-hidden flex items-center justify-center">
            {vacancy.imageUrl && !bannerImgFailed && (
              <img
                src={vacancy.imageUrl}
                alt={`${vacancy.organization} banner`}
                referrerPolicy="no-referrer"
                onError={() => setBannerImgFailed(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-black/30" />
            <div className="relative z-10 px-4 text-center">
              <p className="text-base sm:text-lg font-bold text-white drop-shadow-sm">
                {vacancy.location || 'Ethiopia'}
              </p>
            </div>
          </div>

          {/* Overlapping Organization Logo & Centered Title */}
          <div className="px-5 sm:px-8 pb-8">
            <div className="-mt-11 relative z-20 flex flex-col items-center text-center">
              <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full bg-[#0B132B] border-4 border-white shadow-lg flex items-center justify-center overflow-hidden">
                {vacancy.organizationLogo && !logoImgFailed ? (
                  <img
                    src={vacancy.organizationLogo}
                    alt={vacancy.organization}
                    referrerPolicy="no-referrer"
                    onError={() => setLogoImgFailed(true)}
                    className="w-full h-full object-cover bg-white"
                  />
                ) : (
                  <span className="text-xl font-extrabold text-white tracking-tight">
                    {getOrgInitials(vacancy.organization)}
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm font-semibold text-slate-600">
                {vacancy.organization}
              </p>

              <h1
                id="vacancy-detail-title"
                className="mt-1.5 text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug text-balance max-w-xl"
              >
                {vacancy.title}
              </h1>

              {/* Clean unboxed category & status metadata */}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-slate-500">
                <span className="text-emerald-700 font-semibold">{vacancy.category}</span>
                {vacancy.publishedAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Posted {new Date(vacancy.publishedAt).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>

              {isJobClosed && (
                <div className="mt-4 w-full max-w-xl rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3.5 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                        Closed
                      </span>
                      <p className="text-xs sm:text-sm font-extrabold text-rose-950">
                        This Job Vacancy Is Closed ({deadlineDisplay})
                      </p>
                    </div>
                    <p className="text-xs text-rose-900 mt-1 leading-relaxed">
                      The application deadline has passed and this position is no longer accepting applications. Full vacancy details remain visible below for your reference.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 px-3.5 py-2 rounded-xl bg-rose-700 text-white text-xs font-extrabold hover:bg-rose-800 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Browse Open Jobs
                  </button>
                </div>
              )}
            </div>

            {/* Structured Key Metadata Rows (Matching Reference Layout) */}
            <div className="mt-7 py-5 border-y border-slate-100 space-y-3.5 text-sm">
              <div className="flex items-center gap-3 text-slate-700">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  <span className="text-slate-500">Location Type:</span>{' '}
                  <strong className="font-bold text-slate-900">{locationTypeLabel}</strong>
                </span>
              </div>

              <div className="flex items-center gap-3 text-slate-700">
                <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  <span className="text-slate-500">Career Level:</span>{' '}
                  <strong className="font-bold text-slate-900">{careerLevelLabel}</strong>
                </span>
              </div>

              <div className="flex items-center gap-3 text-slate-700">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  <span className="text-slate-500">Deadline:</span>{' '}
                  <strong className={`font-bold ${isJobClosed ? 'text-rose-700' : 'text-slate-900'}`}>
                    {deadlineDisplay}
                  </strong>
                  {isJobClosed ? (
                    <span className="inline-block ml-2 px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[11px] font-extrabold uppercase">
                      Closed
                    </span>
                  ) : (
                    daysInfo?.text && (
                      <span className="text-xs text-slate-500 ml-2">({daysInfo.text})</span>
                    )
                  )}
                </span>
              </div>

              <div className="flex items-center gap-3 text-slate-700">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  <span className="text-slate-500">Employment Type:</span>{' '}
                  <strong className="font-bold text-slate-900">
                    {vacancy.employmentType || 'Full-time'}
                  </strong>
                </span>
              </div>

              {isMeaningful(vacancy.vacanciesCount) && (
                <div className="flex items-center gap-3 text-slate-700">
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    <span className="text-slate-500">Number of people required:</span>{' '}
                    <strong className="font-bold text-slate-900">
                      {vacancy.vacanciesCount}
                    </strong>
                  </span>
                </div>
              )}

              {isMeaningful(vacancy.experienceYears) && (
                <div className="flex items-center gap-3 text-slate-700">
                  <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    <span className="text-slate-500">Work Experience:</span>{' '}
                    <strong className="font-bold text-slate-900">
                      {vacancy.experienceYears}
                    </strong>
                  </span>
                </div>
              )}

              {isMeaningful(vacancy.salary) && (
                <div className="flex items-center gap-3 text-slate-700">
                  <Coins className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    <span className="text-slate-500">Salary:</span>{' '}
                    <strong className="font-bold text-slate-900">{vacancy.salary}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Section: About The Job */}
            <section className="mt-7 space-y-3">
              <h2 className="text-lg font-bold text-slate-900">About The Job</h2>
              <p className="text-[15px] text-slate-700 leading-relaxed whitespace-pre-line">
                {vacancy.description}
              </p>

              {Array.isArray(vacancy.responsibilities) && vacancy.responsibilities.length > 0 && (
                <div className="pt-2 space-y-2">
                  <h3 className="text-sm font-bold text-slate-900">Key Responsibilities</h3>
                  <ul className="space-y-1.5 text-sm text-slate-700 leading-relaxed list-disc pl-5">
                    {vacancy.responsibilities.map((resp, idx) => (
                      <li key={idx}>{resp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Section: About You */}
            <section className="mt-7 space-y-3">
              <h2 className="text-lg font-bold text-slate-900">About You</h2>
              <h3 className="text-sm font-bold text-slate-800">Required Qualifications</h3>
              <ul className="space-y-2 text-[15px] text-slate-700 leading-relaxed">
                {qualificationBullets.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section: Required Skill */}
            <section className="mt-7 space-y-3">
              <h2 className="text-lg font-bold text-slate-900">Required Skill</h2>
              {requiredSkillsList.length > 0 ? (
                <ul className="space-y-2 text-[15px] text-slate-700">
                  {requiredSkillsList.map((skill, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#10B981] shrink-0 mt-1" />
                      <span>{skill}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">
                  Relevant technical and professional skills in {vacancy.category || 'this role'}.
                </p>
              )}
            </section>

            {/* Section: Desired Skill / Required Documents */}
            <section className="mt-7 space-y-3">
              <h2 className="text-lg font-bold text-slate-900">Desired Skill</h2>
              {desiredSkillsList.length > 0 ? (
                <ul className="space-y-2 text-[15px] text-slate-700">
                  {desiredSkillsList.map((doc, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#10B981] shrink-0 mt-1" />
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">
                  Strong communication, teamwork, and verified credentials relevant to the position.
                </p>
              )}
            </section>

            {/* Section: How to apply */}
            <section ref={applySectionRef} className="mt-7 pt-6 border-t border-slate-100 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900">How to apply</h2>
                {isMeaningful(vacancy.applicationMethod) && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
                    Method: {vacancy.applicationMethod}
                  </span>
                )}
              </div>
              <p className="text-[15px] text-slate-700 leading-relaxed whitespace-pre-line">
                {vacancy.applicationInstructions ||
                  'Qualified candidates who meet the minimum requirements can submit their application directly on HopelandJobs using the Apply Now button below or via the verified employer channel listed here.'}
              </p>

              {isMeaningful(vacancy.physicalAddress) && (
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-sm text-amber-950 flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-900 block text-xs uppercase tracking-wide">
                      Physical / In-Person / Postal Submission Address
                    </strong>
                    <span className="text-sm font-medium">{vacancy.physicalAddress}</span>
                  </div>
                </div>
              )}

              {isMeaningful(vacancy.contactInfo) && vacancy.contactInfo !== vacancy.physicalAddress && (
                <p className="text-sm text-slate-700">
                  <strong className="text-slate-900">Employer Contact:</strong> {vacancy.contactInfo}
                </p>
              )}

              {(vacancy.applicationEmail ||
                (vacancy.applicationUrl && vacancy.applicationUrl.startsWith('http'))) && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {vacancy.applicationUrl && vacancy.applicationUrl.startsWith('http') && (
                    <a
                      href={vacancy.applicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        trackAnalyticsEvent('click_apply_link', {
                          jobId: vacancy.id,
                          jobTitle: vacancy.title,
                          organization: vacancy.organization,
                          category: vacancy.category,
                          applyUrl: vacancy.applicationUrl,
                          applyMethod: 'Official Portal',
                        });
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-bold transition-colors"
                    >
                      <span>Official Employer Direct Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {vacancy.applicationEmail && (
                    <a
                      href={`mailto:${vacancy.applicationEmail}?subject=${encodeURIComponent(
                        `Application for ${vacancy.title}`
                      )}`}
                      onClick={() => {
                        trackAnalyticsEvent('click_apply_link', {
                          jobId: vacancy.id,
                          jobTitle: vacancy.title,
                          organization: vacancy.organization,
                          category: vacancy.category,
                          applyUrl: vacancy.applicationEmail,
                          applyMethod: 'Email',
                        });
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-bold transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Email: {vacancy.applicationEmail}</span>
                    </a>
                  )}
                </div>
              )}

              {isJobClosed ? (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-semibold">
                  Applications for this vacancy are now <strong>Closed</strong> (deadline: {deadlineDisplay}). Browse currently open vacancies on HopelandJobs to apply for active roles.
                </div>
              ) : (
                onApplyOnWebsite && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                    <span>
                      Click <strong>Apply Now</strong> below to apply directly (no account required) or sign in to submit with your saved CV. · ያለ ምዝገባ በቀጥታ ማመልከት ወይም በአካውንትዎ በ1 ንክኪ ማመልከት ይችላሉ።
                    </span>
                  </div>
                )
              )}
            </section>

            {/* AI Fit Assistant & Cover Letter Tools */}
            <section className="mt-8 pt-6 border-t border-slate-100 space-y-4">
              <div className="bg-[#0B132B] text-white p-5 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-emerald-300">
                      Career Readiness Assistant
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-white mt-0.5">
                      Check Fit &amp; Prepare for Interview
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRunAiAssistant('analyze')}
                      disabled={isAiLoading}
                      className="px-3.5 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isAiLoading && aiTask === 'analyze' ? 'Analyzing...' : 'Check Fit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunAiAssistant('interview')}
                      disabled={isAiLoading}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isAiLoading && aiTask === 'interview' ? 'Preparing...' : 'Interview Prep'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCoverLetterHelper(!showCoverLetterHelper)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{showCoverLetterHelper ? 'Hide Cover Letter' : 'Cover Letter'}</span>
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (aiQuestion.trim()) {
                      handleRunAiAssistant('qa', aiQuestion.trim());
                    }
                  }}
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder={`Ask a question about ${vacancy.title}...`}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-white placeholder-slate-400 focus:border-[#10B981] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isAiLoading || !aiQuestion.trim()}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    Ask Question
                  </button>
                </form>

                {aiError && (
                  <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-700 text-rose-200 text-xs">
                    {aiError}
                  </div>
                )}

                {aiResult && (
                  <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                    <div className="space-y-1">
                      <p className="text-slate-200 leading-relaxed">{aiResult.summary}</p>
                      <p className="text-emerald-300 font-semibold">{aiResult.fitAssessment}</p>
                    </div>
                    {aiResult.answer && (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-emerald-100 leading-relaxed">
                        {aiResult.answer}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ul className="space-y-1.5 text-slate-300">
                        {aiResult.eligibilityChecklist?.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <ul className="space-y-1.5 text-slate-300">
                        {aiResult.interviewQuestions?.map((q, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {showCoverLetterHelper && (
                <CoverLetterAssistant vacancy={vacancy} userProfile={userProfile} />
              )}

              {/* Share & Utility Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-600">Share:</span>
                  <a
                    href={telegramShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      trackAnalyticsEvent('share_telegram', {
                        jobId: vacancy.id,
                        jobTitle: vacancy.title,
                        organization: vacancy.organization,
                        category: vacancy.category,
                      });
                    }}
                    className="min-h-[40px] min-w-[40px] rounded-lg bg-[#229ED9] text-white hover:bg-[#1E88E5] transition-colors inline-flex items-center justify-center"
                    title="Share on Telegram"
                  >
                    <Send className="w-4 h-4" />
                  </a>
                  <a
                    href={whatsAppShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[40px] min-w-[40px] rounded-lg bg-[#25D366] text-white hover:bg-[#20BA5A] transition-colors inline-flex items-center justify-center"
                    title="Share on WhatsApp"
                  >
                    <Share2 className="w-4 h-4" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyVacancy}
                    className="min-h-[40px] inline-flex items-center gap-1.5 font-semibold px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied' : 'Copy Details'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-[40px] inline-flex items-center gap-1.5 font-semibold px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Sticky Bottom CTA Bar */}
        <footer className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 shrink-0">
          {isJobClosed ? (
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="w-full sm:flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-extrabold text-sm flex items-center justify-center text-center">
                Closed · Application Deadline Passed
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white font-bold text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Browse Open Jobs
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePrimaryApplyClick}
              className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] active:scale-[0.99] text-white font-bold text-base shadow-sm transition-all flex items-center justify-center cursor-pointer"
            >
              Apply Now
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
