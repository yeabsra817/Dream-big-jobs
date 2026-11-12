import React, { useState, useEffect } from 'react';
import {
  X,
  Building,
  MapPin,
  Calendar,
  Clock,
  Briefcase,
  Coins,
  GraduationCap,
  FileCheck2,
  Share2,
  Copy,
  ExternalLink,
  Mail,
  Send,
  Check,
  Sparkles,
  HelpCircle,
  FileText,
  Printer,
  ChevronLeft,
} from 'lucide-react';
import { Vacancy } from '../types/job';
import { getDaysLeft } from '../utils/helpers';
import { CoverLetterAssistant } from './CoverLetterAssistant';
import { trackAnalyticsEvent } from '../lib/analyticsTracker';

interface Props {
  vacancy: Vacancy;
  onClose: () => void;
  telegramUrl: string;
}

export const VacancyDetailModal: React.FC<Props> = ({
  vacancy,
  onClose,
  telegramUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const [showCoverLetterHelper, setShowCoverLetterHelper] = useState(false);

  useEffect(() => {
    trackAnalyticsEvent('vacancy_view', {
      jobId: vacancy.id,
      jobTitle: vacancy.title,
      organization: vacancy.organization,
      category: vacancy.category,
      path: `/?jobId=${vacancy.id}`,
    });
  }, [vacancy.id]);

  const daysInfo = getDaysLeft(vacancy.applicationDeadline);
  const currentUrl = typeof window !== 'undefined' ? `${window.location.origin}/?jobId=${vacancy.id}` : '';

  const handleCopyVacancy = () => {
    const text = `📋 JOB VACANCY | HOPELAND JOBS 🇪🇹
━━━━━━━━━━━━━━━━━━━━
Position: ${vacancy.title}
Organization: ${vacancy.organization}
Category: ${vacancy.category}
Location: ${vacancy.location}
Salary: ${vacancy.salary}
Deadline: ${vacancy.applicationDeadline}

Required Qualification: ${vacancy.educationQualification}
Experience: ${vacancy.experienceYears}

Application Method: ${vacancy.applicationMethod}
${vacancy.applicationUrl ? `Apply Link: ${vacancy.applicationUrl}` : ''}
${vacancy.applicationEmail ? `Apply Email: ${vacancy.applicationEmail}` : ''}

🔗 View Full Vacancy on HOPELAND JOBS:
${currentUrl}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const telegramShareText = encodeURIComponent(
    `💼 ${vacancy.title} at ${vacancy.organization}\n📍 ${vacancy.location} | ⏳ Deadline: ${vacancy.applicationDeadline}\nCheck details on HOPELAND JOBS:`
  );
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${telegramShareText}`;

  const whatsAppShareText = encodeURIComponent(
    `💼 ${vacancy.title} at ${vacancy.organization} (Ethiopia)\nDeadline: ${vacancy.applicationDeadline}\nApply here: ${currentUrl}`
  );
  const whatsAppShareUrl = `https://api.whatsapp.com/send?text=${whatsAppShareText}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 lg:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#0B132B] text-white p-6 sm:p-8 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
              {vacancy.category}
            </span>
            <span className="text-xs font-medium text-slate-400">
              Posted: {vacancy.publishedAt ? new Date(vacancy.publishedAt).toLocaleDateString() : 'Recent'}
            </span>
            {vacancy.referenceNumber && vacancy.referenceNumber !== 'Not specified in the original vacancy' && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Ref: {vacancy.referenceNumber}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
            {vacancy.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-300">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <Building className="w-4 h-4 text-amber-400" />
              <span>{vacancy.organization}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>{vacancy.location}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <span>{vacancy.employmentType}</span>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-8 flex-1">
          {/* Key Facts Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#FFFBEB] p-4 rounded-2xl border border-amber-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Deadline</span>
              </div>
              <div className="font-bold text-sm text-slate-900 line-clamp-1">
                {vacancy.applicationDeadline}
              </div>
              <div className="text-[11px] font-semibold text-amber-700 mt-1">
                {daysInfo.text}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                <Coins className="w-3.5 h-3.5 text-slate-500" />
                <span>Salary</span>
              </div>
              <div className="font-bold text-sm text-slate-900 line-clamp-1">
                {vacancy.salary}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                ETB or company scale
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                <span>Experience</span>
              </div>
              <div className="font-bold text-sm text-slate-900 line-clamp-1">
                {vacancy.experienceYears}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {vacancy.jobGrade ? `Grade: ${vacancy.jobGrade}` : 'Relevant field'}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                <span>Qualification</span>
              </div>
              <div className="font-bold text-sm text-slate-900 line-clamp-1">
                {vacancy.educationQualification}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 truncate">
                {vacancy.requiredFieldOfStudy}
              </div>
            </div>
          </div>

          {/* Job Overview / Description */}
          <div>
            <h3 className="text-base font-bold text-[#0B132B] mb-3 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
              Job Description & Context
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
              {vacancy.description}
            </p>
          </div>

          {/* Responsibilities */}
          {vacancy.responsibilities && vacancy.responsibilities.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-[#0B132B] mb-3 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
                Key Duties & Responsibilities
              </h3>
              <ul className="space-y-2 bg-white rounded-2xl p-5 border border-slate-200">
                {vacancy.responsibilities.map((resp, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Qualifications & Requirements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-sm font-bold text-[#0B132B]">Required Qualifications & Education</h4>
              <div className="text-xs text-slate-700 space-y-2">
                <p>
                  <strong className="text-slate-900">Education Level:</strong>{' '}
                  {vacancy.educationQualification}
                </p>
                <p>
                  <strong className="text-slate-900">Required Field:</strong>{' '}
                  {vacancy.requiredFieldOfStudy}
                </p>
                <p>
                  <strong className="text-slate-900">Work Experience:</strong>{' '}
                  {vacancy.experienceYears}
                </p>
                {vacancy.vacanciesCount && vacancy.vacanciesCount !== 'Not specified in the original vacancy' && (
                  <p>
                    <strong className="text-slate-900">Number of Openings:</strong>{' '}
                    {vacancy.vacanciesCount}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-sm font-bold text-[#0B132B]">Criteria & Documents</h4>
              <div className="text-xs text-slate-700 space-y-2">
                <p>
                  <strong className="text-slate-900">Languages:</strong>{' '}
                  {vacancy.languageRequirements || 'English and Amharic'}
                </p>
                {vacancy.ageRequirements && vacancy.ageRequirements !== 'Not specified in the original vacancy' && (
                  <p>
                    <strong className="text-slate-900">Age:</strong> {vacancy.ageRequirements}
                  </p>
                )}
                {vacancy.genderRequirements && vacancy.genderRequirements !== 'Not specified in the original vacancy' && (
                  <p>
                    <strong className="text-slate-900">Gender:</strong> {vacancy.genderRequirements}
                  </p>
                )}
                {vacancy.specialRequirements && vacancy.specialRequirements !== 'Not specified in the original vacancy' && (
                  <p>
                    <strong className="text-slate-900">Special Requirements:</strong> {vacancy.specialRequirements}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Required Documents */}
          {vacancy.requiredDocuments && vacancy.requiredDocuments.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-[#0B132B] mb-3 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600" />
                Required Documents for Application
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {vacancy.requiredDocuments.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs font-semibold text-emerald-900"
                  >
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                      ✓
                    </span>
                    <span>{doc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How to Apply Box */}
          <div className="bg-[#FFFBEB] p-6 rounded-2xl border-2 border-amber-300">
            <h3 className="text-base font-bold text-amber-900 mb-2 flex items-center gap-2">
              <span className="text-amber-600 text-lg">📌</span>
              Official Application Instructions
            </h3>
            <p className="text-sm text-slate-800 leading-relaxed mb-4 whitespace-pre-line">
              {vacancy.applicationInstructions}
            </p>

            {vacancy.contactInfo && vacancy.contactInfo !== 'Not specified in the original vacancy' && (
              <div className="text-xs text-amber-900 bg-amber-100/60 p-3 rounded-xl mb-4 border border-amber-200">
                <strong>Employer Contact Info:</strong> {vacancy.contactInfo}
              </div>
            )}

            {/* Direct Apply Buttons */}
            <div className="flex flex-wrap items-center gap-3">
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
                      applyMethod: 'Online URL',
                    });
                  }}
                  className="inline-flex items-center gap-2 bg-[#0B132B] hover:bg-amber-500 hover:text-slate-950 text-white font-extrabold text-sm px-6 py-3.5 rounded-xl shadow-md transition-all transform hover:-translate-y-0.5"
                >
                  <span>APPLY ON OFFICIAL PORTAL</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {vacancy.applicationEmail && (
                <a
                  href={`mailto:${vacancy.applicationEmail}?subject=Application for ${encodeURIComponent(vacancy.title)} - [Your Name]`}
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
                  className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-sm px-6 py-3.5 rounded-xl shadow-md transition-all transform hover:-translate-y-0.5"
                >
                  <Mail className="w-4 h-4" />
                  <span>APPLY VIA EMAIL ({vacancy.applicationEmail})</span>
                </a>
              )}

              {vacancy.applicationMethod === 'In-Person / Physical' && (
                <div className="inline-flex items-center gap-2 bg-slate-900 text-white font-bold text-xs px-4 py-3 rounded-xl">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>Physical In-Person Submission Required</span>
                </div>
              )}

              {/* CV & Cover Letter Tailoring Assistant button */}
              <button
                onClick={() => setShowCoverLetterHelper(!showCoverLetterHelper)}
                className="inline-flex items-center gap-2 bg-white text-slate-800 border border-slate-300 hover:border-amber-500 font-bold text-xs px-4 py-3.5 rounded-xl transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{showCoverLetterHelper ? 'Hide Cover Letter Helper' : 'Draft Cover Letter for This Job'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Cover Letter Assistant Drawer if opened */}
          {showCoverLetterHelper && (
            <CoverLetterAssistant vacancy={vacancy} />
          )}

          {/* Social Sharing & Action Bar */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Share this vacancy:</span>
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
                className="p-2 rounded-lg bg-[#229ED9] text-white hover:bg-[#1E88E5] transition-colors inline-flex items-center justify-center cursor-pointer"
                title="Share to Telegram"
              >
                <Send className="w-4 h-4" />
              </a>
              <a
                href={whatsAppShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-[#25D366] text-white hover:bg-[#20BA5A] transition-colors inline-flex items-center justify-center cursor-pointer"
                title="Share to WhatsApp"
              >
                <Share2 className="w-4 h-4" />
              </a>
              <a
                href={facebookShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-[#1877F2] text-white hover:bg-[#166FE5] transition-colors inline-flex items-center justify-center cursor-pointer"
                title="Share to Facebook"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyVacancy}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Vacancy Details'}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Verified by HOPELAND JOBS Admin</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 font-semibold text-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
