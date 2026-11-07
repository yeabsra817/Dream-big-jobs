import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  FileText,
  Mail,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Send,
  Download,
  RefreshCw,
  Play,
  Pause,
  Shield,
  Trash2,
  Plus,
  Search,
  Filter,
  Sparkles,
  ExternalLink,
  Lock,
  Check,
  X,
  Sliders,
  User,
  Award,
  Building,
  Clock,
  ChevronRight,
  Eye,
  FileCheck,
  Upload,
} from 'lucide-react';
import { Vacancy } from '../../types/job';
import {
  PersonalProfile,
  PersonalDocument,
  ApplicationRecord,
  MatchAnalysis,
  ApplicationStatus,
} from '../../types/autoApply';
import { generateCvPdf, generateCoverLetterPdf } from '../../utils/pdfGenerator';
import {
  connectGmailAccount,
  getCachedGmailToken,
  setCachedGmailToken,
  ADMIN_EMAIL,
  PERSONAL_AUTO_APPLY_EMAIL,
  auth,
} from '../../lib/firebase';

interface Props {
  vacancies: Vacancy[];
  adminEmail: string | null;
  onClose?: () => void;
}

const DEFAULT_PROFILE: PersonalProfile = {
  name: 'Yeabsra Tefera',
  email: 'yeabsra45@gmail.com',
  phone: '+251 91 123 4567',
  address: 'Addis Ababa, Ethiopia',
  totalBankingExperienceYears: 9,
  branchManagerExperienceYears: 3,
  currentPosition: 'Branch Manager',
  currentEmployer: 'Tsedey Bank S.C.',
  previousEmployers: [
    'Commercial Bank of Ethiopia (CBE)',
    'Nib Bank S.C.',
    'Oromia Bank S.C.',
  ],
  degree: "Bachelor's Degree in Accounting and Finance",
  university: 'Mekelle University',
  graduationYear: 2016,
  preferredLocation: 'Addis Ababa, Ethiopia',
  allowOtherEthiopianLocations: false,
  targetPositions: [
    'Finance Officer',
    'Senior Finance Officer',
    'Finance and Administration Officer',
    'Finance Manager',
    'Senior Accountant',
    'Accountant',
    'Budget and Finance Officer',
    'Grants Finance Officer',
    'Financial Controller',
    'Banking Operations Manager',
    'Branch Operations Manager',
    'Branch Manager',
    'Financial Management Officer',
  ],
  targetOrganizations: [
    'Médecins Sans Frontières (MSF)',
    'International NGOs',
    'Local NGOs with strong finance positions',
    'Foreign Embassies',
    'United Nations (UN) & International Organizations',
    'International Development Agencies',
    'Foreign-Owned Companies',
    'International Financial Institutions',
    'Insurance & Microfinance Institutions',
  ],
  mode: 'review',
  isAutoApplyActive: false,
  automationSchedule: '12_hours',
  gmailConnected: false,
  gmailAccountEmail: null,
  updatedAt: new Date().toISOString(),
};

const DEFAULT_DOCUMENTS: PersonalDocument[] = [
  {
    id: 'doc_cv_base',
    title: 'Yeabsra Tefera — Official Master CV',
    type: 'cv',
    fileName: 'Yeabsra_Tefera_Master_CV.pdf',
    fileSize: 145000,
    extractedText: `YEABSRA TEFERA
Addis Ababa, Ethiopia | yeabsra45@gmail.com | +251 91 123 4567

PROFESSIONAL SUMMARY
Senior Finance and Banking Professional with 9 years of banking experience, including 3 years as Branch Manager at Tsedey Bank S.C. Strong background in accounting, financial reporting, budgeting, compliance, internal controls, risk management, and multi-department team supervision. Holds a Bachelor of Arts in Accounting and Finance from Mekelle University (2016).

CORE COMPETENCIES
- Financial Accounting, General Ledger, and IFRS Standards
- Budget Planning, Expenditure Monitoring, and Cost Control
- Internal Audits, Statutory Compliance, and Risk Mitigation
- Branch Operational Leadership, Cash Reserves, and Portfolio Quality
- Credit Assessment, Financial Analysis, and Stakeholder Engagement

EMPLOYMENT HISTORY
Branch Manager — Tsedey Bank S.C. (3 Years)
- Led total branch financial management, balance sheet oversight, and compliance with National Bank directives.
- Monitored operational budgets, expense approvals, and monthly financial statement reconciliations.
- Supervised over 25 employees across customer service, accounting, operations, and credit analysis.

Senior Banking Officer / Accountant — Commercial Bank of Ethiopia, Nib Bank, Oromia Bank (6 Years)
- Managed loan underwriting, risk review, financial audits, and customer transaction reconciliations.
- Ensured compliance with financial policies, AML/CFT regulations, and strict cash handling standards.

EDUCATION
Bachelor of Arts in Accounting and Finance — Mekelle University (Graduated 2016)`,
    approved: true,
    uploadedAt: '2026-11-01T08:00:00Z',
    issuerOrOrg: 'Tsedey Bank / CBE / Mekelle University',
  },
  {
    id: 'doc_degree_cert',
    title: 'B.A. Degree Certificate in Accounting and Finance',
    type: 'degree_certificate',
    fileName: 'Mekelle_University_Degree_Accounting_Finance.pdf',
    fileSize: 320000,
    extractedText: 'MEKELLE UNIVERSITY — FACULTY OF BUSINESS AND ECONOMICS. Conferred upon Yeabsra Tefera the Degree of Bachelor of Arts in Accounting and Finance with all honors, rights, and privileges. Graduation Date: July 2016.',
    approved: true,
    uploadedAt: '2026-11-01T08:05:00Z',
    issuerOrOrg: 'Mekelle University',
  },
  {
    id: 'doc_exp_tsedey',
    title: 'Work Experience Certificate — Tsedey Bank (Branch Manager)',
    type: 'experience_letter',
    fileName: 'Tsedey_Bank_Experience_Certificate.pdf',
    fileSize: 210000,
    extractedText: 'TO WHOM IT MAY CONCERN: This is to certify that Mr. Yeabsra Tefera has served Tsedey Bank S.C. as Branch Manager for 3 consecutive years with exemplary leadership, financial integrity, and operational excellence.',
    approved: true,
    uploadedAt: '2026-11-01T08:10:00Z',
    issuerOrOrg: 'Tsedey Bank S.C.',
  },
];

export const PersonalAutoApply: React.FC<Props> = ({
  vacancies,
  adminEmail,
  onClose,
}) => {
  // Navigation sub-tabs
  const [activeTab, setActiveTab] = useState<'matches' | 'review' | 'tracker' | 'documents' | 'profile'>('matches');

  // Profile & State
  const [profile, setProfile] = useState<PersonalProfile>(() => {
    const saved = localStorage.getItem('personal_auto_apply_profile');
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
  });

  const [documents, setDocuments] = useState<PersonalDocument[]>(() => {
    const saved = localStorage.getItem('personal_auto_apply_documents');
    return saved ? JSON.parse(saved) : DEFAULT_DOCUMENTS;
  });

  const [applications, setApplications] = useState<ApplicationRecord[]>(() => {
    const saved = localStorage.getItem('personal_auto_apply_records');
    return saved ? JSON.parse(saved) : [];
  });

  // Matching & Generation state
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null);
  const [sendingAppId, setSendingAppId] = useState<string | null>(null);

  // Filters
  const [matchCategoryFilter, setMatchCategoryFilter] = useState<'all' | 'excellent' | 'good' | 'email_only'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Application for Modal Review / Editing
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editCvText, setEditCvText] = useState('');
  const [editCoverLetterText, setEditCoverLetterText] = useState('');
  const [editEmailSubject, setEditEmailSubject] = useState('');
  const [editEmailBody, setEditEmailBody] = useState('');

  // Confirmation modal state for real sending
  const [confirmSendApp, setConfirmSendApp] = useState<ApplicationRecord | null>(null);
  const [isTestSend, setIsTestSend] = useState(false);

  // Save changes to localStorage for offline persistence
  useEffect(() => {
    localStorage.setItem('personal_auto_apply_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('personal_auto_apply_documents', JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    localStorage.setItem('personal_auto_apply_records', JSON.stringify(applications));
  }, [applications]);

  // Check Gmail Profile on Mount if Token Exists
  useEffect(() => {
    const token = getCachedGmailToken();
    if (token) {
      fetch('/api/auto-apply/gmail-profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.connected && data.emailAddress) {
            setProfile((prev) => ({
              ...prev,
              gmailConnected: true,
              gmailAccountEmail: data.emailAddress,
            }));
          }
        })
        .catch((e) => console.warn('Gmail profile check:', e));
    }
  }, []);

  // Handle Connect Gmail
  const handleConnectGmail = async () => {
    try {
      const res = await connectGmailAccount();
      setProfile((prev) => ({
        ...prev,
        gmailConnected: true,
        gmailAccountEmail: res.email,
        gmailAuthorizedAt: new Date().toISOString(),
      }));
      alert(`Gmail successfully connected to ${res.email}!`);
    } catch (err: any) {
      alert(`Gmail connection failed: ${err.message}`);
    }
  };

  const handleDisconnectGmail = () => {
    setCachedGmailToken(null);
    setProfile((prev) => ({
      ...prev,
      gmailConnected: false,
      gmailAccountEmail: null,
    }));
    alert('Gmail account disconnected.');
  };

  // Helper to extract email from vacancy
  const extractRecruitmentEmail = (v: Vacancy): string | null => {
    if (v.applicationEmail && v.applicationEmail.includes('@')) return v.applicationEmail.trim();
    const full = `${v.applicationInstructions || ''} ${v.description || ''}`;
    const matches = full.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (matches && matches.length > 0) {
      const filtered = matches.filter((e) => !/example\.com|domain\.com/i.test(e));
      if (filtered.length > 0) return filtered[0];
    }
    return null;
  };

  // Match and Prepare an Application for a Vacancy
  const handleAnalyzeAndPrepare = async (v: Vacancy) => {
    setMatchingJobId(v.id);
    try {
      // 1. Check for duplicates in history
      const existing = applications.find((a) => a.vacancyId === v.id);
      if (existing && existing.status === 'SENT') {
        alert(`You have already successfully applied to "${v.title}" at "${v.organization}" on ${new Date(existing.gmailSentAt || existing.createdAt).toLocaleDateString()}.`);
        setMatchingJobId(null);
        return;
      }

      // 2. Perform Match Analysis via Backend
      const docSnippets = documents
        .filter((d) => d.approved)
        .map((d) => `${d.title}:\n${d.extractedText.slice(0, 500)}`)
        .join('\n\n');

      const matchRes = await fetch('/api/auto-apply/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacancy: v, profile, documentSnippets: docSnippets }),
      });

      if (!matchRes.ok) {
        throw new Error('Failed to analyze match');
      }

      const matchAnalysis: MatchAnalysis = await matchRes.json();

      // 3. Generate Tailored Materials
      setGeneratingJobId(v.id);
      const materialsRes = await fetch('/api/auto-apply/generate-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacancy: v, profile, matchAnalysis }),
      });

      if (!materialsRes.ok) {
        throw new Error('Failed to generate application materials');
      }

      const materials = await materialsRes.json();

      // 4. Create or Update Application Record
      const newRecord: ApplicationRecord = {
        id: `app_${v.id}_${Date.now()}`,
        vacancyId: v.id,
        jobTitle: v.title,
        organization: v.organization,
        location: v.location,
        publicationDate: v.publishedAt || v.createdAt,
        deadline: v.applicationDeadline,
        recruitmentEmail: matchAnalysis.recruitmentEmail || extractRecruitmentEmail(v) || '',
        matchScore: matchAnalysis.score,
        matchCategory: matchAnalysis.category,
        matchAnalysis,
        tailoredCvText: materials.tailoredCvText,
        tailoredCoverLetterText: materials.tailoredCoverLetterText,
        emailSubject: materials.emailSubject,
        emailBody: materials.emailBody,
        attachedDocumentIds: documents.filter((d) => d.approved).map((d) => d.id),
        attachedDocumentNames: documents.filter((d) => d.approved).map((d) => d.fileName),
        status: matchAnalysis.isEmailOnlyApplicable && matchAnalysis.recruitmentEmail ? 'READY FOR REVIEW' : 'NOT ELIGIBLE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setApplications((prev) => [newRecord, ...prev.filter((a) => a.vacancyId !== v.id)]);
      setSelectedApp(newRecord);
      setActiveTab('review');
    } catch (err: any) {
      alert(`Error during application preparation: ${err.message}`);
    } finally {
      setMatchingJobId(null);
      setGeneratingJobId(null);
    }
  };

  // Download Generated CV PDF
  const handleDownloadCvPdf = (appRecord: ApplicationRecord) => {
    const doc = generateCvPdf(appRecord.tailoredCvText, profile, {
      title: appRecord.jobTitle,
      organization: appRecord.organization,
    });
    const safeTitle = appRecord.jobTitle.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Yeabsra_Tefera_CV_${safeTitle}.pdf`);
  };

  // Download Generated Cover Letter PDF
  const handleDownloadCoverLetterPdf = (appRecord: ApplicationRecord) => {
    const doc = generateCoverLetterPdf(appRecord.tailoredCoverLetterText, profile, {
      title: appRecord.jobTitle,
      organization: appRecord.organization,
      location: appRecord.location,
    });
    const safeTitle = appRecord.jobTitle.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Yeabsra_Tefera_Application_Letter_${safeTitle}.pdf`);
  };

  // Execute Sending via Gmail
  const handleExecuteSend = async (appRecord: ApplicationRecord, isTest: boolean = false) => {
    const token = getCachedGmailToken();
    if (!token) {
      alert('Please connect your Gmail account (yeabsra45@gmail.com) first via Google OAuth.');
      return;
    }

    setSendingAppId(appRecord.id);
    try {
      // Generate PDFs as base64
      const cvDoc = generateCvPdf(appRecord.tailoredCvText, profile, {
        title: appRecord.jobTitle,
        organization: appRecord.organization,
      });
      const cvBase64 = cvDoc.output('datauristring').split(',')[1];

      const letterDoc = generateCoverLetterPdf(appRecord.tailoredCoverLetterText, profile, {
        title: appRecord.jobTitle,
        organization: appRecord.organization,
        location: appRecord.location,
      });
      const letterBase64 = letterDoc.output('datauristring').split(',')[1];

      const attachments = [
        {
          filename: `Yeabsra_Tefera_CV_${appRecord.jobTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          contentType: 'application/pdf',
          base64Content: cvBase64,
        },
        {
          filename: `Yeabsra_Tefera_Application_Letter_${appRecord.jobTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          contentType: 'application/pdf',
          base64Content: letterBase64,
        },
      ];

      const recipient = isTest ? 'yeabsra45@gmail.com' : appRecord.recruitmentEmail;
      const subject = isTest ? `[TEST APPLICATION] ${appRecord.emailSubject}` : appRecord.emailSubject;

      const res = await fetch('/api/auto-apply/send-gmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: recipient,
          subject,
          body: appRecord.emailBody,
          attachments,
          isTest,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gmail sending failed');
      }

      // Update Application Record
      setApplications((prev) =>
        prev.map((a) => {
          if (a.id === appRecord.id) {
            return {
              ...a,
              status: isTest ? a.status : 'SENT',
              gmailMessageId: data.messageId,
              gmailSentAt: data.sentAt,
              isTestEmail: isTest,
              reviewedBy: profile.name,
              reviewedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }
          return a;
        })
      );

      setConfirmSendApp(null);
      alert(
        isTest
          ? `Test email sent successfully to your account (${recipient}) with Message ID: ${data.messageId}!`
          : `Application successfully sent to ${appRecord.organization} (${recipient}) with Message ID: ${data.messageId}!`
      );
    } catch (err: any) {
      alert(`Send Error: ${err.message}`);
      setApplications((prev) =>
        prev.map((a) => (a.id === appRecord.id ? { ...a, status: 'FAILED', sendError: err.message } : a))
      );
    } finally {
      setSendingAppId(null);
    }
  };

  // Filter Target Vacancies
  const candidateVacancies = useMemo(() => {
    return vacancies.filter((v) => {
      // Must not be expired
      if (v.status === 'expired' || v.status === 'archived') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          v.title.toLowerCase().includes(q) ||
          v.organization.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      // Category filter
      if (matchCategoryFilter === 'email_only') {
        const email = extractRecruitmentEmail(v);
        if (!email) return false;
      }

      return true;
    });
  }, [vacancies, searchQuery, matchCategoryFilter]);

  // Priority Matched Vacancies (Ranked by relevance)
  const rankedVacancies = useMemo(() => {
    const targetRoles = profile.targetPositions.map((p) => p.toLowerCase());
    const topOrgs = profile.targetOrganizations.map((o) => o.toLowerCase());

    return [...candidateVacancies].sort((a, b) => {
      const aTitleMatch = targetRoles.some((r) => a.title.toLowerCase().includes(r)) ? 2 : 0;
      const bTitleMatch = targetRoles.some((r) => b.title.toLowerCase().includes(r)) ? 2 : 0;

      const aOrgMatch = topOrgs.some((o) => a.organization.toLowerCase().includes(o) || /msf|ngo|embassy|unicef|undp/i.test(a.organization)) ? 1 : 0;
      const bOrgMatch = topOrgs.some((o) => b.organization.toLowerCase().includes(o) || /msf|ngo|embassy|unicef|undp/i.test(b.organization)) ? 1 : 0;

      return bTitleMatch + bOrgMatch - (aTitleMatch + aOrgMatch);
    });
  }, [candidateVacancies, profile.targetPositions, profile.targetOrganizations]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner: Confidential Personal Module */}
      <div className="bg-[#0B132B] text-white rounded-3xl p-6 sm:p-7 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Branding & User Identity */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                <Sparkles className="w-4 h-4 fill-current" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                PERSONAL AI AUTO APPLY
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                Yeabsra Tefera Exclusive
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">
              Confidential AI discovery, requirement evaluation, ATS CV & Cover Letter PDF generation, and verified email application via authorized Gmail account ({PERSONAL_AUTO_APPLY_EMAIL}).
            </p>
          </div>

          {/* Right: Gmail Status & Operating Mode */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Switch: Review Mode vs Auto Apply */}
            <div className="bg-slate-900/90 rounded-2xl p-1.5 border border-slate-700/80 flex items-center gap-1">
              <button
                onClick={() => setProfile((p) => ({ ...p, mode: 'review' }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  profile.mode === 'review'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Review Mode (Safety)
              </button>
              <button
                onClick={() => {
                  if (!profile.gmailConnected) {
                    alert('Please connect your Gmail account before activating Auto Apply.');
                    return;
                  }
                  setProfile((p) => ({ ...p, mode: 'auto', isAutoApplyActive: true }));
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  profile.mode === 'auto'
                    ? 'bg-emerald-500 text-white font-black shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Auto Apply (Live)
              </button>
            </div>

            {/* Gmail Connection Button */}
            {profile.gmailConnected ? (
              <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 px-3.5 py-2 rounded-2xl">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <div className="text-left">
                  <div className="text-[11px] font-extrabold text-white">Gmail Authorized</div>
                  <div className="text-[10px] text-emerald-300 font-mono">{profile.gmailAccountEmail}</div>
                </div>
                <button
                  onClick={handleDisconnectGmail}
                  className="ml-2 text-[10px] text-slate-400 hover:text-rose-400 underline font-semibold"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectGmail}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs transition-colors shadow-sm"
              >
                <Mail className="w-4 h-4 text-rose-600" />
                <span>Connect Gmail ({PERSONAL_AUTO_APPLY_EMAIL})</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 text-[11px] block">Target Positions</span>
            <span className="text-base font-extrabold text-white">
              {profile.targetPositions.length} Titles
            </span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Applications Prepared</span>
            <span className="text-base font-extrabold text-amber-400">
              {applications.length} Vacancies
            </span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Successfully Sent</span>
            <span className="text-base font-extrabold text-emerald-400">
              {applications.filter((a) => a.status === 'SENT').length} Applications
            </span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Approved Documents</span>
            <span className="text-base font-extrabold text-sky-400">
              {documents.filter((d) => d.approved).length} Credentials
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
        {[
          { id: 'matches', label: '1. Matched Vacancies', icon: Briefcase, count: rankedVacancies.length },
          { id: 'review', label: '2. Application Review & Approval', icon: FileCheck, count: applications.filter((a) => a.status === 'READY FOR REVIEW').length },
          { id: 'tracker', label: '3. Application Tracker', icon: Clock, count: applications.length },
          { id: 'documents', label: '4. Document Library', icon: FileText, count: documents.length },
          { id: 'profile', label: '5. Profile & Automation Rules', icon: Sliders },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  activeTab === t.id ? 'bg-slate-950 text-amber-300' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: MATCHED VACANCIES & DISCOVERY */}
      {/* ============================================================== */}
      {activeTab === 'matches' && (
        <div className="space-y-5">
          {/* Search & Filters */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search vacancies by title, employer (MSF, NGOs, embassies)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMatchCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  matchCategoryFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Open ({candidateVacancies.length})
              </button>
              <button
                onClick={() => setMatchCategoryFilter('email_only')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  matchCategoryFilter === 'email_only'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Email Applications Only
              </button>
            </div>
          </div>

          {/* Vacancy Feed */}
          <div className="space-y-3.5">
            {rankedVacancies.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-2">
                <Briefcase className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">No Matching Vacancies Found</h3>
                <p className="text-xs text-slate-500">
                  Try adjusting your search query or importing new vacancies via the Bulk Import System.
                </p>
              </div>
            ) : (
              rankedVacancies.slice(0, 30).map((v) => {
                const existingApp = applications.find((a) => a.vacancyId === v.id);
                const email = extractRecruitmentEmail(v);
                const isMatching = matchingJobId === v.id;
                const isGenerating = generatingJobId === v.id;

                return (
                  <div
                    key={v.id}
                    className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 hover:border-amber-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{v.title}</span>
                        {email && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Email Apply: {email}
                          </span>
                        )}
                        {existingApp && (
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              existingApp.status === 'SENT'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-400 text-slate-950'
                            }`}
                          >
                            {existingApp.status}
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-slate-700 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1 text-slate-900 font-bold">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {v.organization}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">{v.location}</span>
                        <span>•</span>
                        <span className="text-slate-500">Deadline: {v.applicationDeadline || 'Open'}</span>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-2">
                        {v.description}
                      </p>
                    </div>

                    {/* Action */}
                    <div className="flex items-center gap-2 shrink-0">
                      {existingApp ? (
                        <button
                          onClick={() => {
                            setSelectedApp(existingApp);
                            setActiveTab('review');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Prepared App</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAnalyzeAndPrepare(v)}
                          disabled={isMatching || isGenerating}
                          className="px-4 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                        >
                          <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isMatching ? 'animate-spin' : ''}`} />
                          <span>
                            {isMatching
                              ? 'Evaluating with Gemini...'
                              : isGenerating
                              ? 'Crafting CV & Letter...'
                              : 'Analyze & Prepare Application'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: APPLICATION REVIEW & APPROVAL DASHBOARD */}
      {/* ============================================================== */}
      {activeTab === 'review' && (
        <div className="space-y-6">
          {applications.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
              <FileCheck className="w-12 h-12 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Applications Prepared Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Go to the "Matched Vacancies" tab and click "Analyze & Prepare Application" on any job to generate a tailored CV and cover letter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Applications List */}
              <div className="space-y-2.5 lg:col-span-1">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Prepared Applications ({applications.length})
                </h3>
                {applications.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      selectedApp?.id === app.id
                        ? 'border-amber-400 bg-amber-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-xs text-slate-900 truncate">
                        {app.jobTitle}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          app.matchScore >= 85
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {app.matchScore}%
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-semibold mt-0.5">
                      {app.organization}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
                      <span>{app.recruitmentEmail || 'No email detected'}</span>
                      <span className="uppercase font-bold text-slate-600">{app.status}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Column: Detailed Application Inspector & Actions */}
              <div className="lg:col-span-2 space-y-5">
                {selectedApp ? (
                  <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-black text-slate-900">
                            {selectedApp.jobTitle}
                          </h2>
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              selectedApp.matchScore >= 85
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {selectedApp.matchScore}% Match ({selectedApp.matchCategory})
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {selectedApp.organization} • {selectedApp.location} • Target Email:{' '}
                          <span className="font-bold text-slate-900 font-mono">
                            {selectedApp.recruitmentEmail || 'Missing Email'}
                          </span>
                        </p>
                      </div>

                      {/* Primary Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Test Email */}
                        <button
                          onClick={() => {
                            setConfirmSendApp(selectedApp);
                            setIsTestSend(true);
                          }}
                          disabled={sendingAppId === selectedApp.id}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
                          title="Send sample application directly to yeabsra45@gmail.com"
                        >
                          <Send className="w-3.5 h-3.5 text-amber-500" />
                          <span>Test to Self</span>
                        </button>

                        {/* Real Send */}
                        <button
                          onClick={() => {
                            if (!selectedApp.recruitmentEmail) {
                              alert('Cannot send: No recruitment email address found for this vacancy.');
                              return;
                            }
                            setConfirmSendApp(selectedApp);
                            setIsTestSend(false);
                          }}
                          disabled={sendingAppId === selectedApp.id || !selectedApp.recruitmentEmail}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Approve & Send Application</span>
                        </button>
                      </div>
                    </div>

                    {/* Gemini Match Assessment Card */}
                    <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-2 text-xs">
                      <div className="font-black text-amber-950 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        Gemini Career Match Evaluation
                      </div>
                      <p className="text-slate-700 leading-relaxed">
                        {selectedApp.matchAnalysis.rationale}
                      </p>
                      {selectedApp.matchAnalysis.transferableSkills.length > 0 && (
                        <div className="pt-1">
                          <span className="font-bold text-slate-900">Key Transferable Competencies: </span>
                          <span className="text-slate-600">
                            {selectedApp.matchAnalysis.transferableSkills.join(' • ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Generated Documents Preview & Download Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* CV Card */}
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-slate-900 block">
                            Tailored Professional CV
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            ATS PDF Format (Ready)
                          </span>
                        </div>
                        <button
                          onClick={() => handleDownloadCvPdf(selectedApp)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-400 hover:text-slate-950 text-slate-700 text-xs font-bold border border-slate-200 transition-colors shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>

                      {/* Cover Letter Card */}
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-slate-900 block">
                            Tailored Application Letter
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Formal PDF Letterhead
                          </span>
                        </div>
                        <button
                          onClick={() => handleDownloadCoverLetterPdf(selectedApp)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-400 hover:text-slate-950 text-slate-700 text-xs font-bold border border-slate-200 transition-colors shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>

                    {/* Email Subject & Body Preview */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Mail className="w-4 h-4 text-slate-500" />
                          Application Email Content
                        </span>
                        <button
                          onClick={() => {
                            setEditCvText(selectedApp.tailoredCvText);
                            setEditCoverLetterText(selectedApp.tailoredCoverLetterText);
                            setEditEmailSubject(selectedApp.emailSubject);
                            setEditEmailBody(selectedApp.emailBody);
                            setIsEditingModalOpen(true);
                          }}
                          className="text-xs font-bold text-amber-600 hover:text-amber-700"
                        >
                          Edit Content & Letter →
                        </button>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs font-mono">
                        <div>
                          <span className="text-slate-400">Subject:</span>{' '}
                          <span className="font-bold text-slate-900">{selectedApp.emailSubject}</span>
                        </div>
                        <div className="border-t border-slate-200 pt-2 text-slate-700 whitespace-pre-wrap font-sans">
                          {selectedApp.emailBody}
                        </div>
                      </div>
                    </div>

                    {/* Attached Supporting Credentials */}
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        Attached Supporting Credentials ({selectedApp.attachedDocumentNames.length}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {selectedApp.attachedDocumentNames.map((name, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
                    Select an application from the left column to review.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: APPLICATION TRACKER & HISTORY */}
      {/* ============================================================== */}
      {activeTab === 'tracker' && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Personal Application Tracking Ledger
              </h2>
              <p className="text-xs text-slate-500">
                Permanent record of all job applications prepared and sent through authorized Gmail account.
              </p>
            </div>
            <span className="text-xs font-extrabold text-slate-700">
              Total Applications: {applications.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            {applications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No application history recorded yet.
              </div>
            ) : (
              applications.map((app) => (
                <div key={app.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{app.jobTitle}</span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          app.status === 'SENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : app.status === 'READY FOR REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {app.status}
                      </span>
                      {app.isTestEmail && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                          Self-Test Email
                        </span>
                      )}
                    </div>
                    <div className="text-slate-600 font-semibold">
                      {app.organization} • Recipient:{' '}
                      <span className="font-mono text-slate-900">{app.recruitmentEmail || 'None'}</span>
                    </div>
                    {app.gmailMessageId && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        Gmail Message ID: {app.gmailMessageId} • Sent:{' '}
                        {new Date(app.gmailSentAt || app.createdAt).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadCvPdf(app)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold"
                    >
                      CV PDF
                    </button>
                    <button
                      onClick={() => handleDownloadCoverLetterPdf(app)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold"
                    >
                      Cover Letter
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: DOCUMENT LIBRARY */}
      {/* ============================================================== */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Personal Credential & Document Library
              </h2>
              <p className="text-xs text-slate-500">
                Uploaded certificates, educational degrees, and employment letters used by Gemini for CV generation and email attachments.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">{doc.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{doc.fileName}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDocuments((prev) =>
                        prev.map((d) => (d.id === doc.id ? { ...d, approved: !d.approved } : d))
                      );
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase transition-colors ${
                      doc.approved
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {doc.approved ? 'Approved for Attach' : 'Inactive'}
                  </button>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-600 max-h-28 overflow-y-auto font-sans leading-relaxed">
                  {doc.extractedText}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: PROFILE & AUTOMATION RULES */}
      {/* ============================================================== */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-black text-slate-900">
              Confirmed Candidate Profile & Matching Rules
            </h2>
            <p className="text-xs text-slate-500">
              Authoritative career parameters verified for Yeabsra Tefera. Used by Gemini for match scoring and tailored application generation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  disabled
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Application Email (Sender)</label>
                <input
                  type="text"
                  value={profile.email}
                  disabled
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Confirmed Career Credentials</label>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-[11px] text-slate-700">
                  <div>• Total Banking Experience: <strong>9 Years</strong></div>
                  <div>• Branch Manager Experience: <strong>3 Years (Tsedey Bank S.C.)</strong></div>
                  <div>• Previous Employers: <strong>CBE, Nib Bank, Oromia Bank</strong></div>
                  <div>• Degree: <strong>B.A. in Accounting & Finance (Mekelle University, 2016)</strong></div>
                  <div>• Location Focus: <strong>Addis Ababa, Ethiopia</strong></div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Positions</label>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-48 overflow-y-auto space-y-1">
                  {profile.targetPositions.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-slate-800">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Organizations Priority</label>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-[11px] text-slate-800">
                  {profile.targetOrganizations.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-4 text-slate-400 font-mono">{i + 1}.</span>
                      <span>{o}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT APPLICATION MATERIALS */}
      {/* ============================================================== */}
      {isEditingModalOpen && selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                Edit Application Materials — {selectedApp.jobTitle}
              </h3>
              <button
                onClick={() => setIsEditingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-800 block mb-1">Email Subject</label>
                <input
                  type="text"
                  value={editEmailSubject}
                  onChange={(e) => setEditEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Cover Email Body</label>
                <textarea
                  rows={4}
                  value={editEmailBody}
                  onChange={(e) => setEditEmailBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Tailored Application Cover Letter</label>
                <textarea
                  rows={8}
                  value={editCoverLetterText}
                  onChange={(e) => setEditCoverLetterText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Tailored CV Content</label>
                <textarea
                  rows={8}
                  value={editCvText}
                  onChange={(e) => setEditCvText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsEditingModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setApplications((prev) =>
                    prev.map((a) => {
                      if (a.id === selectedApp.id) {
                        return {
                          ...a,
                          emailSubject: editEmailSubject,
                          emailBody: editEmailBody,
                          tailoredCoverLetterText: editCoverLetterText,
                          tailoredCvText: editCvText,
                          updatedAt: new Date().toISOString(),
                        };
                      }
                      return a;
                    })
                  );
                  setSelectedApp({
                    ...selectedApp,
                    emailSubject: editEmailSubject,
                    emailBody: editEmailBody,
                    tailoredCoverLetterText: editCoverLetterText,
                    tailoredCvText: editCvText,
                  });
                  setIsEditingModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CONFIRM SENDING APPLICATION */}
      {/* ============================================================== */}
      {confirmSendApp && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black ${
                  isTestSend ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {isTestSend ? 'Send Test Application to Yourself' : 'Confirm Application Dispatch'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isTestSend
                    ? 'Verifies Gmail delivery safely without sending to real employers'
                    : 'Official application will be delivered via your authorized Gmail account'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div>
                <span className="text-slate-500">Position:</span>{' '}
                <span className="font-extrabold text-slate-900">{confirmSendApp.jobTitle}</span>
              </div>
              <div>
                <span className="text-slate-500">Employer:</span>{' '}
                <span className="font-bold text-slate-900">{confirmSendApp.organization}</span>
              </div>
              <div>
                <span className="text-slate-500">Recipient:</span>{' '}
                <span className="font-mono font-bold text-slate-900">
                  {isTestSend ? 'yeabsra45@gmail.com (Test Address)' : confirmSendApp.recruitmentEmail}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Attachments:</span>{' '}
                <span className="font-semibold text-slate-700">
                  Tailored CV PDF, Application Letter PDF, {confirmSendApp.attachedDocumentNames.length} Credentials
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmSendApp(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExecuteSend(confirmSendApp, isTestSend)}
                disabled={sendingAppId === confirmSendApp.id}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition-colors"
              >
                {sendingAppId === confirmSendApp.id ? 'Sending...' : 'Confirm & Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
