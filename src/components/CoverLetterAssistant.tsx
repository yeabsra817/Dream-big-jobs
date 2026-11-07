import React, { useState } from 'react';
import { Copy, Check, Sparkles, User, Mail, Phone, FileText } from 'lucide-react';
import { Vacancy } from '../types/job';

interface Props {
  vacancy: Vacancy;
}

export const CoverLetterAssistant: React.FC<Props> = ({ vacancy }) => {
  const [applicantName, setApplicantName] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const letterText = `Date: ${currentDate}

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
  }, as officially advertised on DREAM BIG JOBS. With my professional background in ${
    vacancy.requiredFieldOfStudy || 'relevant field'
  } and my dedication to professional excellence, I am confident in my capacity to contribute immediately to your organization.

Throughout my career, I have cultivated skills in ${
    vacancy.requiredSkills && vacancy.requiredSkills.length > 0
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

  const handleCopy = () => {
    navigator.clipboard.writeText(letterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-amber-200 shadow-md space-y-4 animate-in fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#0B132B]">
              Tailored Cover Letter Generator
            </h4>
            <p className="text-xs text-slate-500">
              Personalized for {vacancy.organization} • {vacancy.title}
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors shadow-sm"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied Letter!' : 'Copy Letter'}</span>
        </button>
      </div>

      {/* Input fields to personalize */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      </div>

      {/* Preview box */}
      <div className="relative">
        <textarea
          readOnly
          value={letterText}
          rows={11}
          className="w-full text-xs font-mono p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed outline-none"
        />
      </div>

      <div className="text-[11px] text-slate-500 bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
        💡 <strong>Application Tip:</strong> Ethiopian employers (banks, embassies, NGOs) value clean structure, correct reference numbers, and listed attachments. Always save your final cover letter and CV in PDF format before submitting.
      </div>
    </div>
  );
};
