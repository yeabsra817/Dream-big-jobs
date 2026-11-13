import React, { useState, useEffect } from 'react';
import { Copy, Check, Sparkles, RefreshCw } from 'lucide-react';
import { Vacancy } from '../types/job';
import { JobSeekerProfile } from '../types/jobSeeker';
import { generateAiCoverLetter } from '../lib/aiService';

interface Props {
  vacancy: Vacancy;
  userProfile?: JobSeekerProfile | null;
}

export const CoverLetterAssistant: React.FC<Props> = ({ vacancy, userProfile = null }) => {
  const [applicantName, setApplicantName] = useState(userProfile?.fullName || '');
  const [applicantPhone, setApplicantPhone] = useState(userProfile?.phone || '');
  const [applicantEmail, setApplicantEmail] = useState(userProfile?.email || '');
  const [tone, setTone] = useState<'formal' | 'ngo' | 'concise'>('formal');
  const [customDraft, setCustomDraft] = useState<string | null>(null);
  const [aiHighlights, setAiHighlights] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (userProfile) {
      if (!applicantName && userProfile.fullName) setApplicantName(userProfile.fullName);
      if (!applicantPhone && userProfile.phone) setApplicantPhone(userProfile.phone);
      if (!applicantEmail && userProfile.email) setApplicantEmail(userProfile.email);
    }
  }, [userProfile]);

  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const defaultTemplateText = `Date: ${currentDate}

To: The Human Resources Manager / Recruitment Committee
${vacancy.organization}
${vacancy.location}, Ethiopia

Subject: Application for the Position of ${vacancy.title}${
    vacancy.referenceNumber && vacancy.referenceNumber !== 'Not specified in the original vacancy'
      ? ` (Ref: ${vacancy.referenceNumber})`
      : ''
  }

Dear Hiring Team,

I am writing to express my strong enthusiasm and application for the position of ${vacancy.title} at ${
    vacancy.organization
  }, as officially advertised on HOPELAND JOBS. With my professional background in ${
    userProfile?.desiredJobTitle || vacancy.requiredFieldOfStudy || 'relevant field'
  } and my dedication to professional excellence, I am confident in my capacity to contribute immediately to your organization.

Throughout my career, I have cultivated skills in ${
    userProfile?.skills?.length
      ? userProfile.skills.slice(0, 4).join(', ')
      : vacancy.requiredSkills && vacancy.requiredSkills.length > 0
      ? vacancy.requiredSkills.slice(0, 4).join(', ')
      : 'strategic planning, stakeholder communication, and analytical problem-solving'
  }. Your requirement for ${
    vacancy.experienceYears !== 'Not specified in the original vacancy'
      ? vacancy.experienceYears
      : 'relevant experience'
  } aligns directly with my qualifications, and I am prepared to fulfill the core responsibilities outlined in your announcement.

As requested by ${vacancy.organization}, I have attached my complete application package, including my updated Curriculum Vitae (CV)${
    vacancy.requiredDocuments && vacancy.requiredDocuments.length > 1
      ? `, ${vacancy.requiredDocuments.filter((d) => !d.toLowerCase().includes('cv')).join(', ')}`
      : ' and certified educational credentials'
  }.

I welcome the opportunity to discuss my application further in an interview. Thank you for your time, consideration, and evaluation of my candidacy.

Sincerely,

${applicantName || '[Your Full Name]'}
${applicantPhone ? `Phone: ${applicantPhone}` : 'Phone: [Your Phone Number]'}
${applicantEmail ? `Email: ${applicantEmail}` : 'Email: [Your Email Address]'}
Addis Ababa / Regional City, Ethiopia`;

  const letterText = customDraft ?? defaultTemplateText;

  const handleGenerateWithAi = async () => {
    setIsGenerating(true);
    setAiError(null);
    try {
      const res = await generateAiCoverLetter({
        vacancy,
        applicantName: applicantName || '[Your Full Name]',
        applicantPhone: applicantPhone || '[Your Phone Number]',
        applicantEmail: applicantEmail || '[Your Email Address]',
        userProfile,
        tone,
      });
      setCustomDraft(res.coverLetterText);
      setAiHighlights(res.keyHighlights || []);
    } catch (err: any) {
      setAiError(err.message || 'Could not draft cover letter with AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(letterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-amber-200 shadow-md space-y-4 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#0B132B]">
              AI Tailored Cover Letter Generator
            </h4>
            <p className="text-xs text-slate-500">
              Powered by Gemini AI • Personalized for {vacancy.organization}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateWithAi}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0B132B] hover:bg-slate-800 text-amber-400 font-bold text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isGenerating ? 'Drafting with AI...' : 'Generate with Gemini AI'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors shadow-sm cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied Letter!' : 'Copy Letter'}</span>
          </button>
        </div>
      </div>

      {/* Input fields & tone to personalize */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Your Full Name</label>
          <input
            type="text"
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            placeholder="Abebe Bikila"
            className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Your Phone Number</label>
          <input
            type="text"
            value={applicantPhone}
            onChange={(e) => setApplicantPhone(e.target.value)}
            placeholder="+251 91 123 4567"
            className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Your Email</label>
          <input
            type="email"
            value={applicantEmail}
            onChange={(e) => setApplicantEmail(e.target.value)}
            placeholder="example@gmail.com"
            className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">AI Writing Style</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as any)}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-amber-500 outline-none bg-white font-semibold"
          >
            <option value="formal">Formal Corporate / Bank</option>
            <option value="ngo">NGO / Diplomatic / UN</option>
            <option value="concise">Concise Short Note</option>
          </select>
        </div>
      </div>

      {aiError && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
          {aiError}
        </div>
      )}

      {aiHighlights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {aiHighlights.map((hl, i) => (
            <span
              key={i}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200"
            >
              ✓ {hl}
            </span>
          ))}
        </div>
      )}

      {/* Editable Preview box */}
      <div className="relative">
        <textarea
          value={letterText}
          onChange={(e) => setCustomDraft(e.target.value)}
          rows={11}
          className="w-full text-xs font-mono p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed outline-none focus:border-amber-400"
        />
      </div>

      <div className="text-[11px] text-slate-500 bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
        💡 <strong>Application Tip:</strong> Ethiopian employers (banks, embassies, NGOs) value clean structure, correct reference numbers, and listed attachments. Review your AI-generated draft and export to PDF before submitting.
      </div>
    </div>
  );
};

