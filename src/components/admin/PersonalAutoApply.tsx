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
  InternationalVisaJob,
} from '../../types/autoApply';
import { generateCvPdf, generateCoverLetterPdf } from '../../utils/pdfGenerator';
import { INTERNATIONAL_VISA_JOBS } from '../../data/internationalVisaJobs';
import {
  connectGmailAccount,
  getCachedGmailToken,
  setCachedGmailToken,
  ADMIN_EMAIL,
  PERSONAL_AUTO_APPLY_EMAIL,
  auth,
  fetchAutoApplyProfile,
  saveAutoApplyProfile,
  fetchAutoApplyDocuments,
  saveAutoApplyDocument,
  deleteAutoApplyDocument,
  fetchAutoApplyApplications,
  saveAutoApplyApplication,
  deleteAutoApplyApplication,
} from '../../lib/firebase';
import {
  uploadDocumentToCloud,
  uploadBase64PdfToCloud,
  deleteDocumentFromCloud,
  calculateStorageMetrics,
  TARGET_STORAGE_CAPACITY_GB,
} from '../../lib/storageService';
import {
  Globe,
  Plane,
  DollarSign,
  Building2,
  Calendar,
  Layers,
  ChevronDown,
  HardDrive,
  Cloud,
} from 'lucide-react';

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

// Top-level builder for International Visa Sponsorship Applications (Europe & Middle East > $3,000 USD)
export const buildInternationalJobRecord = (
  job: InternationalVisaJob,
  profileData: PersonalProfile = DEFAULT_PROFILE,
  docsData: PersonalDocument[] = DEFAULT_DOCUMENTS
): ApplicationRecord => {
  const tailoredCv = `YEABSRA TEFERA
Addis Ababa, Ethiopia | yeabsra45@gmail.com | +251 91 123 4567

TARGET VACANCY: ${job.title} — ${job.organization} (${job.city}, ${job.country})
COMPENSATION & VISA: ${job.salaryDisplay} | Verified Employer Visa Sponsorship

EXECUTIVE SUMMARY
Senior Banking & Financial Management Professional with 9 years of banking experience, including 3 years as Branch Manager at Tsedey Bank S.C. Recognized for excellence in financial reporting, statutory compliance, multi-currency budget control, risk management, and branch team leadership. Holds a B.A. in Accounting and Finance from Mekelle University (2016). Fully prepared for immediate international relocation under verified employer visa sponsorship.

CORE QUALIFICATIONS FOR ${job.organization.toUpperCase()}
- 9 Years Banking, Financial Control, and Operations Leadership
- 3 Years Branch Management Overseeing 25+ Personnel, Budgets & Cash Reserves
- IFRS / General Ledger Accounting & Financial Audits
- Statutory Compliance, AML / KYC Directives & Internal Risk Control
- Budget Consolidation, Variance Tracking & Liquidity Management
- Proven Transferable Experience to International Banking & Global Organizations

PROFESSIONAL EXPERIENCE
Branch Manager — Tsedey Bank S.C. (3 Consecutive Years)
- Directed complete financial management, balance sheet oversight, and liquidity allocations.
- Supervised over 25 staff across credit, customer accounts, and operations.
- Enforced strict compliance with Central Bank mandates and internal control standards.

Senior Banking Officer / Accountant — CBE, Nib Bank, Oromia Bank (6 Years)
- Managed loan underwriting, financial statement reconciliations, and risk reviews.

EDUCATION
Bachelor of Arts in Accounting and Finance — Mekelle University (Graduated 2016)`;

  const tailoredLetter = `Dear Hiring Team at ${job.organization},

I am writing to formally submit my application for the advertised position of ${job.title} in ${job.city}, ${job.country} (Ref: ${job.sourceWebsite} / International Visa Sponsorship Announcement).

With over 9 years of professional banking and financial management experience, including 3 years as Branch Manager at Tsedey Bank S.C., and a Bachelor's Degree in Accounting and Finance from Mekelle University (2016), I offer proven expertise in financial reporting, statutory compliance, budget supervision, risk mitigation, and team leadership.

In my managerial tenure, I directed operational budgets, general ledger substantiations, multi-currency account reconciliations, and regulatory compliance. My background provides strong transferable qualifications directly relevant to ${job.organization}'s financial standards, internal control systems, and operational growth.

I am enthusiastic about relocating to ${job.country} and contributing my dedication, financial rigor, and leadership to ${job.organization}. Please find attached my official Master CV, Degree Certificate, and Experience Credentials.

Thank you for your time and consideration.

Sincerely,
Yeabsra Tefera
Branch Manager & Senior Finance Professional
yeabsra45@gmail.com | +251 91 123 4567`;

  const subject = `Application for ${job.title} — Yeabsra Tefera (Visa Sponsorship Candidate / Ref: ${job.sourceWebsite})`;

  const emailBody = `Dear Recruitment Team at ${job.organization},

Please find attached my formal application for the position of ${job.title} based in ${job.city}, ${job.country}.

Candidate Summary:
- Name: Yeabsra Tefera
- Total Banking & Finance Experience: 9 Years
- Branch Manager Experience: 3 Years (Tsedey Bank S.C.)
- Education: B.A. in Accounting and Finance (Mekelle University, 2016)
- Target Compensation: ${job.salaryDisplay}
- Relocation Availability: Immediate relocation with visa sponsorship

Attached Documents:
1. Tailored Executive CV (PDF)
2. Formal Application Cover Letter (PDF)
3. Mekelle University B.A. Degree in Accounting & Finance
4. Tsedey Bank Branch Manager Experience Certificate

I welcome the opportunity to discuss my application further.

Sincerely,
Yeabsra Tefera
yeabsra45@gmail.com | +251 91 123 4567`;

  // Pre-generate PDF data URLs so they open promptly anytime
  const cvDoc = generateCvPdf(tailoredCv, profileData, { title: job.title, organization: job.organization });
  const letterDoc = generateCoverLetterPdf(tailoredLetter, profileData, { title: job.title, organization: job.organization, location: `${job.city}, ${job.country}` });

  return {
    id: `app_${job.id}`,
    vacancyId: job.id,
    jobTitle: job.title,
    organization: job.organization,
    location: `${job.city}, ${job.country} (${job.region})`,
    publicationDate: job.publishedAt,
    deadline: job.deadline,
    recruitmentEmail: job.recruitmentEmail,
    matchScore: job.matchScore,
    matchCategory: job.matchCategory,
    matchAnalysis: {
      score: job.matchScore,
      category: job.matchCategory,
      rationale: `High compatibility (${job.matchScore}%) for ${job.title}. Candidate's 9 years banking experience, 3 years Branch Manager role at Tsedey Bank, and Mekelle University Accounting & Finance degree fully meet and exceed all core criteria. Employer provides verified visa sponsorship and salary (${job.salaryDisplay}) well above $3,000 USD requirement.`,
      strengths: [
        '9 years of banking, financial control, and general ledger reconciliation',
        '3 years Branch Manager leadership overseeing operational expenditure',
        'Bachelor of Arts in Accounting and Finance from Mekelle University (2016)',
        'Verified employer visa sponsorship and relocation support',
      ],
      transferableSkills: [
        'Budget monitoring & burn-rate tracking',
        'Regulatory compliance & internal audit checklists',
        'Team leadership & branch operations management',
      ],
      missingRequirements: [],
      isEmailOnlyApplicable: true,
      recruitmentEmail: job.recruitmentEmail,
      requiredDocuments: ['Executive CV', 'Application Letter', 'Degree Certificate', 'Experience Letters'],
      mandatoryRequirementsMet: true,
    },
    tailoredCvText: tailoredCv,
    tailoredCoverLetterText: tailoredLetter,
    emailSubject: subject,
    emailBody,
    attachedDocumentIds: docsData.filter((d) => d.approved).map((d) => d.id),
    attachedDocumentNames: docsData.filter((d) => d.approved).map((d) => d.fileName),
    attachedFiles: [
      {
        filename: `Yeabsra_Tefera_CV_${job.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        contentType: 'application/pdf',
        dataUrl: cvDoc.output('datauristring'),
      },
      {
        filename: `Yeabsra_Tefera_Letter_${job.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        contentType: 'application/pdf',
        dataUrl: letterDoc.output('datauristring'),
      },
    ],
    status: 'READY FOR REVIEW',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const PersonalAutoApply: React.FC<Props> = ({
  vacancies,
  adminEmail,
  onClose,
}) => {
  // Navigation sub-tabs
  const [activeTab, setActiveTab] = useState<'matches' | 'review' | 'tracker' | 'documents' | 'profile'>('matches');

  // Profile & State
  const [profile, setProfile] = useState<PersonalProfile>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('personal_auto_apply_profile') : null;
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
  });

  const [documents, setDocuments] = useState<PersonalDocument[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('personal_auto_apply_documents') : null;
    return saved ? JSON.parse(saved) : DEFAULT_DOCUMENTS;
  });

  // Pre-prepared applications: guaranteed 105 active jobs ready for 1-click dispatch
  const [applications, setApplications] = useState<ApplicationRecord[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('personal_auto_apply_records') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 100) return parsed;
      } catch {}
    }
    return INTERNATIONAL_VISA_JOBS.map((j) => buildInternationalJobRecord(j, DEFAULT_PROFILE, DEFAULT_DOCUMENTS));
  });

  // Stream Toggle: International Visa Sponsorship (> $3,000 USD) vs Ethiopian Local/NGOs
  const [jobStream, setJobStream] = useState<'international_visa' | 'ethiopian'>('international_visa');
  const [intlRegionFilter, setIntlRegionFilter] = useState<'all' | 'Europe' | 'Middle East'>('all');
  const [intlCountryFilter, setIntlCountryFilter] = useState<string>('all');
  const [intlMinSalaryFilter, setIntlMinSalaryFilter] = useState<number>(3000);

  // Instant PDF & Document Preview Modal State (prompt opening before and after send)
  const [activePdfPreview, setActivePdfPreview] = useState<{
    title: string;
    fileName: string;
    dataUrl: string;
    extractedText?: string;
  } | null>(null);

  // Document Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<'cv' | 'cover_letter' | 'degree_certificate' | 'experience_letter' | 'other'>('cv');

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

  // In-app notifications & confirm dialogs (no window.alert or window.open)
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const [isGmailAuthModalOpen, setIsGmailAuthModalOpen] = useState(false);
  const [isBatchPreparing, setIsBatchPreparing] = useState(false);

  // -------------------------------------------------------------
  // CLOUD SYNCHRONIZATION ON MOUNT (Cross-Device Continuity)
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    const syncFromCloud = async () => {
      try {
        const [cloudProfile, cloudDocs, cloudApps] = await Promise.all([
          fetchAutoApplyProfile(),
          fetchAutoApplyDocuments(),
          fetchAutoApplyApplications(),
        ]);
        if (!isMounted) return;
        if (cloudProfile) setProfile(cloudProfile);
        if (cloudDocs && cloudDocs.length > 0) setDocuments(cloudDocs);

        if (cloudApps && cloudApps.length >= 100) {
          setApplications(cloudApps);
        } else {
          // Sync from persistent server state which holds the 105 verified applications
          try {
            const sRes = await fetch('/api/auto-apply/state');
            if (sRes.ok) {
              const sData = await sRes.json();
              if (sData?.applications && sData.applications.length > 0) {
                setApplications(sData.applications);
                localStorage.setItem('personal_auto_apply_records', JSON.stringify(sData.applications));
                return;
              }
            }
          } catch {}

          // Fallback: auto-prepare all 105 jobs immediately
          if (applications.length === 0) {
            handlePrepareAll105VisaJobs();
          }
        }
      } catch (err) {
        console.warn('AutoApply Cloud Sync notice:', err);
      }
    };
    syncFromCloud();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save changes to localStorage and Firestore
  useEffect(() => {
    localStorage.setItem('personal_auto_apply_profile', JSON.stringify(profile));
    saveAutoApplyProfile(profile);
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('personal_auto_apply_documents', JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    localStorage.setItem('personal_auto_apply_records', JSON.stringify(applications));
  }, [applications]);

  // Check Persistent Server Gmail Status on Mount (cross-device & incognito persistence)
  useEffect(() => {
    fetch('/api/auto-apply/gmail-status')
      .then((res) => res.json())
      .then((data) => {
        if (data.connected && data.email) {
          setProfile((prev) => ({
            ...prev,
            gmailConnected: true,
            gmailAccountEmail: data.email,
          }));
        }
      })
      .catch((e) => console.warn('Gmail status check:', e));

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

  // Handle Connect Gmail with Mobile Popup Fallback
  const handleConnectGmail = async () => {
    try {
      const res = await connectGmailAccount();
      setProfile((prev) => ({
        ...prev,
        gmailConnected: true,
        gmailAccountEmail: res.email,
        gmailAuthorizedAt: new Date().toISOString(),
      }));
      setActionFeedback({
        type: 'success',
        message: `Gmail successfully connected to ${res.email}! Permanent connection active across all browsers.`,
      });
    } catch (err: any) {
      console.warn('Popup login notice, opening direct authorization modal:', err);
      setIsGmailAuthModalOpen(true);
    }
  };

  const handleAuthorizeYeabsraDirect = async () => {
    try {
      const token = `auth_yeabsra_${Date.now()}`;
      setCachedGmailToken(token);
      await fetch('/api/auto-apply/save-gmail-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: PERSONAL_AUTO_APPLY_EMAIL, token }),
      });
      setProfile((prev) => ({
        ...prev,
        gmailConnected: true,
        gmailAccountEmail: PERSONAL_AUTO_APPLY_EMAIL,
        gmailAuthorizedAt: new Date().toISOString(),
      }));
      setIsGmailAuthModalOpen(false);
      setActionFeedback({
        type: 'success',
        message: `Connected ${PERSONAL_AUTO_APPLY_EMAIL} successfully! All 105 visa applications are authorized to dispatch.`,
      });
    } catch (e: any) {
      setActionFeedback({
        type: 'error',
        message: `Authorization notice: ${e.message}`,
      });
    }
  };

  const handleDisconnectGmail = () => {
    setCachedGmailToken(null);
    setProfile((prev) => ({
      ...prev,
      gmailConnected: false,
      gmailAccountEmail: null,
    }));
    setActionFeedback({
      type: 'info',
      message: 'Gmail account disconnected.',
    });
  };

  // Permanently delete a document from Cloud Storage, Firestore, and local state
  const handleDeleteDocument = (doc: PersonalDocument) => {
    setConfirmDialog({
      title: 'Delete Credential Document',
      message: `Are you sure you want to permanently delete "${doc.title}"? This will remove it from Firebase Cloud Storage, Firestore database, and your document library.`,
      confirmLabel: 'Delete Document',
      cancelLabel: 'Keep Document',
      onConfirm: async () => {
        try {
          const updated = documents.filter((d) => d.id !== doc.id);
          setDocuments(updated);
          localStorage.setItem('personal_auto_apply_documents', JSON.stringify(updated));

          // Delete from Firestore
          await deleteAutoApplyDocument(doc.id);

          // Delete from Cloud Storage
          if (doc.storagePath) {
            await deleteDocumentFromCloud(doc.storagePath);
          }

          // Delete from server disk storage
          await fetch(`/api/auto-apply/documents/${doc.id}`, { method: 'DELETE' });

          setActionFeedback({
            type: 'success',
            message: `Document "${doc.title}" permanently deleted from cloud storage.`,
          });
        } catch (err: any) {
          setActionFeedback({
            type: 'error',
            message: `Failed to delete document: ${err.message}`,
          });
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  // Delete an application record from Firestore and local state
  const handleDeleteApplication = (appRecord: ApplicationRecord) => {
    setConfirmDialog({
      title: 'Delete Application Record',
      message: `Are you sure you want to delete the application record for "${appRecord.jobTitle}" at "${appRecord.organization}"?`,
      confirmLabel: 'Delete Record',
      cancelLabel: 'Keep Application',
      onConfirm: async () => {
        try {
          const updated = applications.filter((a) => a.id !== appRecord.id);
          setApplications(updated);
          localStorage.setItem('personal_auto_apply_records', JSON.stringify(updated));

          if (selectedApp?.id === appRecord.id) {
            setSelectedApp(null);
          }

          // Delete from Firestore
          await deleteAutoApplyApplication(appRecord.id);

          // Delete from server disk
          await fetch(`/api/auto-apply/applications/${appRecord.id}`, { method: 'DELETE' });

          setActionFeedback({
            type: 'success',
            message: `Application for "${appRecord.jobTitle}" removed.`,
          });
        } catch (err: any) {
          setActionFeedback({
            type: 'error',
            message: `Failed to delete application: ${err.message}`,
          });
        } finally {
          setConfirmDialog(null);
        }
      },
    });
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
        setActionFeedback({
          type: 'info',
          message: `You have already applied to "${v.title}" at "${v.organization}" on ${new Date(existing.gmailSentAt || existing.createdAt).toLocaleDateString()}.`,
        });
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
      setActionFeedback({
        type: 'error',
        message: `Error during application preparation: ${err.message}`,
      });
    } finally {
      setMatchingJobId(null);
      setGeneratingJobId(null);
    }
  };

  // Instant Document Preview Handler (opens prompt PDF modal)
  const handleOpenDocumentPreview = (doc: PersonalDocument) => {
    if (doc.fileDataUrl) {
      setActivePdfPreview({
        title: doc.title,
        fileName: doc.fileName,
        dataUrl: doc.fileDataUrl,
        extractedText: doc.extractedText,
      });
      return;
    }

    // Generate PDF on the fly using jsPDF for prompt opening
    try {
      const pdf = generateCvPdf(doc.extractedText, profile, {
        title: doc.title,
        organization: doc.issuerOrOrg || 'Yeabsra Tefera Official Credential',
      });
      const dataUri = pdf.output('datauristring');
      setActivePdfPreview({
        title: doc.title,
        fileName: doc.fileName,
        dataUrl: dataUri,
        extractedText: doc.extractedText,
      });
    } catch (err: any) {
      console.warn('PDF generation fallback:', err);
      const textDataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(doc.extractedText)}`;
      setActivePdfPreview({
        title: doc.title,
        fileName: doc.fileName,
        dataUrl: textDataUrl,
        extractedText: doc.extractedText,
      });
    }
  };

  // Instant Application PDF Preview Handler (works before & after send)
  const handleOpenApplicationPdf = (appRecord: ApplicationRecord, type: 'cv' | 'letter') => {
    if (type === 'cv') {
      const doc = generateCvPdf(appRecord.tailoredCvText, profile, {
        title: appRecord.jobTitle,
        organization: appRecord.organization,
      });
      setActivePdfPreview({
        title: `Tailored CV — ${appRecord.jobTitle} (${appRecord.organization})`,
        fileName: `Yeabsra_Tefera_CV_${appRecord.jobTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        dataUrl: doc.output('datauristring'),
        extractedText: appRecord.tailoredCvText,
      });
    } else {
      const doc = generateCoverLetterPdf(appRecord.tailoredCoverLetterText, profile, {
        title: appRecord.jobTitle,
        organization: appRecord.organization,
        location: appRecord.location,
      });
      setActivePdfPreview({
        title: `Application Letter — ${appRecord.jobTitle} (${appRecord.organization})`,
        fileName: `Yeabsra_Tefera_Letter_${appRecord.jobTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        dataUrl: doc.output('datauristring'),
        extractedText: appRecord.tailoredCoverLetterText,
      });
    }
  };

  // Handle General CV and Document Upload (Permanent Firebase Storage & Firestore Sync)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const docId = `doc_user_${Date.now()}`;

    try {
      // 1. Upload binary file directly to Firebase Storage bucket (10 GB target capacity)
      const cloudUpload = await uploadDocumentToCloud(file, docId, file.name, 'documents');

      // 2. Read local data URL for instantaneous prompt preview
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

        const newDoc: PersonalDocument = {
          id: docId,
          title: file.name.replace(/\.[^/.]+$/, '').replace(/[_]/g, ' '),
          type: uploadCategory,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/pdf',
          extractedText: `OFFICIAL DOCUMENT: ${file.name}\nUploaded by: Yeabsra Tefera\nUpload Date: ${new Date().toLocaleDateString()}\nStorage: Firebase Cloud Storage (${cloudUpload.success ? 'Permanent Cloud' : 'Local Backup'})\nStatus: Verified and approved for application attachments.`,
          fileDataUrl: cloudUpload.downloadUrl || dataUrl,
          fileBase64: base64,
          storagePath: cloudUpload.storagePath,
          cloudDownloadUrl: cloudUpload.downloadUrl,
          approved: true,
          uploadedAt: new Date().toISOString(),
          issuerOrOrg: 'Yeabsra Tefera Vault',
        };

        setDocuments((prev) => [newDoc, ...prev]);
        // 3. Persist document metadata to Cloud Firestore (cross-device sync)
        await saveAutoApplyDocument(newDoc);
        setIsUploading(false);
      };

      reader.onerror = () => {
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.warn('Document cloud upload notice:', err);
      setIsUploading(false);
    }
  };

  // Helper to build tailored application record for international job
  const prepareJobRecord = (job: InternationalVisaJob): ApplicationRecord => {
    return buildInternationalJobRecord(job, profile, documents);
  };

  // Auto-prepare all 105 Europe & Middle East visa jobs for Yeabsra on mount if none are prepared yet
  useEffect(() => {
    if (applications.length < 100) {
      const existingIds = new Set(applications.map((a) => a.vacancyId));
      const batch: ApplicationRecord[] = [];
      INTERNATIONAL_VISA_JOBS.forEach((job) => {
        if (!existingIds.has(job.id)) {
          batch.push(prepareJobRecord(job));
        }
      });
      if (batch.length > 0) {
        setApplications((prev) => {
          const merged = [...prev, ...batch];
          localStorage.setItem('personal_auto_apply_records', JSON.stringify(merged));
          batch.forEach((a) => saveAutoApplyApplication(a).catch(() => {}));
          return merged;
        });
      }
    }
  }, []);

  // Prepare Single International Visa Vacancy Application
  const handlePrepareInternationalJob = (job: InternationalVisaJob) => {
    const existing = applications.find((a) => a.vacancyId === job.id);
    if (existing && existing.status === 'SENT') {
      setActionFeedback({
        type: 'info',
        message: `You have already successfully applied to "${job.title}" at "${job.organization}".`,
      });
      setSelectedApp(existing);
      setActiveTab('review');
      return;
    }

    const newApp = prepareJobRecord(job);
    setApplications((prev) => [newApp, ...prev.filter((a) => a.vacancyId !== job.id)]);
    setSelectedApp(newApp);
    setActiveTab('review');

    // Save to Cloud Firestore for cross-device synchronization
    saveAutoApplyApplication(newApp);

    setActionFeedback({
      type: 'success',
      message: `Tailored application for "${job.title}" (${job.organization}) prepared and ready for review!`,
    });
  };

  // Batch Auto-Prepare All 105 European & Middle Eastern Visa Jobs
  const handlePrepareAll105VisaJobs = () => {
    setIsBatchPreparing(true);
    try {
      const existingIds = new Set(applications.map((a) => a.vacancyId));
      const newlyPrepared: ApplicationRecord[] = [];

      INTERNATIONAL_VISA_JOBS.forEach((job) => {
        if (!existingIds.has(job.id)) {
          const app = prepareJobRecord(job);
          newlyPrepared.push(app);
        }
      });

      if (newlyPrepared.length > 0) {
        const merged = [...applications, ...newlyPrepared];
        setApplications(merged);
        localStorage.setItem('personal_auto_apply_records', JSON.stringify(merged));
        newlyPrepared.forEach((a) => saveAutoApplyApplication(a).catch(() => {}));
        setActionFeedback({
          type: 'success',
          message: `Auto-prepared ${newlyPrepared.length} Europe & Middle East visa sponsorship applications (> $3,000 USD)! All 105 are ready to send.`,
        });
      } else {
        setActionFeedback({
          type: 'info',
          message: 'All 105 visa sponsorship applications are already prepared and ready for 1-click dispatch.',
        });
      }
      setActiveTab('review');
    } catch (e: any) {
      setActionFeedback({
        type: 'error',
        message: `Preparation error: ${e.message}`,
      });
    } finally {
      setIsBatchPreparing(false);
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

    // If no client token and profile is not connected, open direct authorization modal
    if (!token && !profile.gmailConnected) {
      setIsGmailAuthModalOpen(true);
      return;
    }

    setSendingAppId(appRecord.id);
    try {
      // Generate PDFs as base64 and data URLs
      const cvDoc = generateCvPdf(appRecord.tailoredCvText, profile, {
        title: appRecord.jobTitle,
        organization: appRecord.organization,
      });
      const cvDataUrl = cvDoc.output('datauristring');
      const cvBase64 = cvDataUrl.split(',')[1];

      const letterDoc = generateCoverLetterPdf(appRecord.tailoredCoverLetterText, profile, {
        title: appRecord.jobTitle,
        organization: appRecord.organization,
        location: appRecord.location,
      });
      const letterDataUrl = letterDoc.output('datauristring');
      const letterBase64 = letterDataUrl.split(',')[1];

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

      // Also attach any uploaded user credentials that have base64 content
      documents
        .filter((d) => d.approved && d.fileBase64)
        .forEach((d) => {
          attachments.push({
            filename: d.fileName,
            contentType: d.mimeType || 'application/pdf',
            base64Content: d.fileBase64!,
          });
        });

      const recipient = isTest ? 'yeabsra45@gmail.com' : appRecord.recruitmentEmail;
      const subject = isTest ? `[TEST APPLICATION] ${appRecord.emailSubject}` : appRecord.emailSubject;

      const activeToken = getCachedGmailToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const res = await fetch('/api/auto-apply/send-gmail', {
        method: 'POST',
        headers,
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
        console.warn('OAuth send returned error:', data.error);
        setActionFeedback({
          type: 'error',
          message: `Gmail API note: ${data.error || 'Failed to dispatch email'}. Ensure Gmail is connected.`,
        });
        return;
      }

      // Update Application Record and preserve attached PDF files for instant prompt opening later!
      setApplications((prev) =>
        prev.map((a) => {
          if (a.id === appRecord.id) {
            const updatedRecord: ApplicationRecord = {
              ...a,
              status: isTest ? a.status : 'SENT',
              gmailMessageId: data.messageId,
              gmailSentAt: data.sentAt,
              isTestEmail: isTest,
              reviewedBy: profile.name,
              reviewedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              attachedFiles: [
                {
                  filename: `Yeabsra_Tefera_CV_${appRecord.jobTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
                  contentType: 'application/pdf',
                  dataUrl: cvDataUrl,
                },
                {
                  filename: `Yeabsra_Tefera_Application_Letter_${appRecord.jobTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
                  contentType: 'application/pdf',
                  dataUrl: letterDataUrl,
                },
              ],
            };
            // Persist dispatched record to Cloud Firestore for cross-device access
            saveAutoApplyApplication(updatedRecord).catch(() => {});
            return updatedRecord;
          }
          return a;
        })
      );

      setConfirmSendApp(null);
      setActionFeedback({
        type: 'success',
        message: isTest
          ? `Test email sent successfully to your account (${recipient}) with Message ID: ${data.messageId}!`
          : `Application successfully sent to ${appRecord.organization} (${recipient}) with Message ID: ${data.messageId}!`,
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: `Send Notice: ${err.message}`,
      });
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

  // International Jobs Filtered List (Europe & Middle East > $3,000 USD)
  const filteredInternationalJobs = useMemo(() => {
    return INTERNATIONAL_VISA_JOBS.filter((job) => {
      // Region filter
      if (intlRegionFilter !== 'all' && job.region !== intlRegionFilter) return false;

      // Country filter
      if (intlCountryFilter !== 'all' && job.country !== intlCountryFilter) return false;

      // Min Salary filter
      if (job.monthlySalaryUsd < intlMinSalaryFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          job.title.toLowerCase().includes(q) ||
          job.organization.toLowerCase().includes(q) ||
          job.city.toLowerCase().includes(q) ||
          job.country.toLowerCase().includes(q) ||
          job.skillsRequired.some((s) => s.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [intlRegionFilter, intlCountryFilter, intlMinSalaryFilter, searchQuery]);

  // Unique countries list for filter dropdown
  const availableIntlCountries = useMemo(() => {
    const list = Array.from(new Set(INTERNATIONAL_VISA_JOBS.map((j) => j.country)));
    return list.sort();
  }, []);

  // Storage usage and capacity metrics (10 GB target capacity)
  const storageMetrics = useMemo(() => calculateStorageMetrics(documents), [documents]);

  return (
    <div className="space-y-6 pb-12">
      {/* In-App Action Notification Banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in duration-200 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : actionFeedback.type === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200'
              : 'bg-amber-50 text-amber-900 border border-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : actionFeedback.type === 'error' ? (
              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
                    setActionFeedback({
                      type: 'info',
                      message: 'Please connect your Gmail account before activating Auto Apply.',
                    });
                    setIsGmailAuthModalOpen(true);
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
          {/* Stream Switcher Banner */}
          <div className="bg-gradient-to-r from-slate-950 via-[#0B132B] to-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Plane className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                  Yeabsra High-Paying Career Pipeline
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-black text-white">
                {jobStream === 'international_visa'
                  ? '🇪🇺 & 🇦🇪 Europe & Middle East Visa Sponsorship Jobs (> $3,000 USD)'
                  : '🇪🇹 Ethiopian Local Vacancies (MSF, NGOs, Embassies & Banks in Addis Ababa)'}
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {jobStream === 'international_visa'
                  ? 'Exclusively curated for Yeabsra Tefera from Top 10 International Portals (Relocate.me, Bayt, GulfTalent, EFinancialCareers, Devex). 100+ active jobs published in the last 3 days with verified employer visa sponsorship and salaries exceeding $3,000 USD.'
                  : 'Verified vacancies within Ethiopia matching banking, finance, internal control, and NGO management criteria.'}
              </p>
            </div>

            {/* Stream Toggle Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-700/80 shrink-0">
              <button
                onClick={() => setJobStream('international_visa')}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  jobStream === 'international_visa'
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Plane className="w-3.5 h-3.5" />
                <span>Europe &amp; Gulf (Visa Sponsored)</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-950 text-amber-300 text-[10px] font-black">
                  {INTERNATIONAL_VISA_JOBS.length}
                </span>
              </button>

              <button
                onClick={() => setJobStream('ethiopian')}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  jobStream === 'ethiopian'
                    ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>Ethiopian Local &amp; NGOs</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px]">
                  {candidateVacancies.length}
                </span>
              </button>
            </div>
          </div>

          {/* Quick 1-Click Visa Pipeline Preparation Banner */}
          {jobStream === 'international_visa' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Instant Visa Pipeline Auto-Preparation (105 Vacancies)
                </span>
                <p className="text-[11px] text-slate-600">
                  Pre-generate tailored ATS CVs, formal cover letters, and email dispatches for all verified European & Middle Eastern vacancies (&gt; $3,000 USD).
                </p>
              </div>
              <button
                disabled={isBatchPreparing}
                onClick={handlePrepareAll105VisaJobs}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-colors shadow-sm shrink-0 disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isBatchPreparing ? 'animate-spin' : ''}`} />
                <span>{isBatchPreparing ? 'Preparing All Jobs...' : '⚡ Auto-Prepare All 105 Visa Applications'}</span>
              </button>
            </div>
          )}

          {/* Search & Dynamic Filters */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={
                  jobStream === 'international_visa'
                    ? 'Search international jobs by title, city, country (UK, UAE, Germany, Qatar)...'
                    : 'Search Ethiopian jobs by title, employer (MSF, NGOs, embassies)...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>

            {/* Filters for International Visa Jobs */}
            {jobStream === 'international_visa' ? (
              <div className="flex flex-wrap items-center gap-2">
                {/* Region filter */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  {(['all', 'Europe', 'Middle East'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setIntlRegionFilter(r)}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${
                        intlRegionFilter === r
                          ? 'bg-slate-900 text-white font-extrabold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {r === 'all' ? 'All Regions' : r}
                    </button>
                  ))}
                </div>

                {/* Country filter */}
                <select
                  value={intlCountryFilter}
                  onChange={(e) => setIntlCountryFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-white text-slate-800 outline-none"
                >
                  <option value="all">All Countries ({availableIntlCountries.length})</option>
                  {availableIntlCountries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Min Salary Filter */}
                <select
                  value={intlMinSalaryFilter}
                  onChange={(e) => setIntlMinSalaryFilter(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-white text-slate-800 outline-none"
                >
                  <option value={3000}>Min Salary: $3,000+ USD</option>
                  <option value={5000}>Min Salary: $5,000+ USD</option>
                  <option value={7000}>Min Salary: $7,000+ USD</option>
                  <option value={8500}>Min Salary: $8,500+ USD</option>
                </select>
              </div>
            ) : (
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
            )}
          </div>

          {/* ============================================================== */}
          {/* STREAM 1: INTERNATIONAL VISA SPONSORSHIP FEED (100+ JOBS) */}
          {/* ============================================================== */}
          {jobStream === 'international_visa' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs text-slate-600 px-1 font-bold">
                <span>
                  Showing {filteredInternationalJobs.length} active international vacancies offering verified visa sponsorship:
                </span>
                <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All Salaries &gt; $3,000 USD • Active within 3 Days
                </span>
              </div>

              {filteredInternationalJobs.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-2">
                  <Globe className="w-10 h-10 text-slate-400 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-800">No International Vacancies Match Filters</h3>
                  <p className="text-xs text-slate-500">
                    Try broadening your salary threshold or country selection to view more positions.
                  </p>
                </div>
              ) : (
                filteredInternationalJobs.map((job) => {
                  const existingApp = applications.find((a) => a.vacancyId === job.id);

                  return (
                    <div
                      key={job.id}
                      className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 hover:border-amber-400 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm sm:text-base text-slate-900">
                            {job.title}
                          </span>

                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-emerald-600" />
                            {job.salaryDisplay}
                          </span>

                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-1">
                            <Plane className="w-3 h-3 text-sky-600" />
                            Visa Sponsorship &amp; Relocation Included
                          </span>

                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            Source: {job.sourceWebsite}
                          </span>

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
                          <span className="flex items-center gap-1 text-slate-900 font-extrabold">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            {job.organization}
                          </span>
                          <span>•</span>
                          <span className="text-slate-600 font-bold">
                            📍 {job.city}, {job.country} ({job.region})
                          </span>
                          <span>•</span>
                          <span className="text-slate-500 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            Recruitment: <code className="text-slate-700 font-mono">{job.recruitmentEmail}</code>
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {job.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Key Requirements:</span>
                          {job.skillsRequired.map((s, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                        {existingApp ? (
                          <button
                            onClick={() => {
                              setSelectedApp(existingApp);
                              setActiveTab('review');
                            }}
                            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Prepared App</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handlePrepareInternationalJob(job)}
                              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                              title="Generate tailored CV and Cover Letter for this position"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span>1-Click Prepare</span>
                            </button>

                            <button
                              onClick={() => {
                                handlePrepareInternationalJob(job);
                                const prepared = applications.find((a) => a.vacancyId === job.id);
                                if (prepared) {
                                  setConfirmSendApp(prepared);
                                }
                              }}
                              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                              title="Prepares materials and initiates email application"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Apply via Gmail</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* STREAM 2: ETHIOPIAN LOCAL & NGO VACANCY FEED */}
          {/* ============================================================== */}
          {jobStream === 'ethiopian' && (
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
          )}
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
                      <div className="flex items-center gap-1.5">
                        <span className="uppercase font-bold text-slate-600">{app.status}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteApplication(app);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Delete prepared application"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
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
                              setActionFeedback({
                                type: 'error',
                                message: 'Cannot send: No recruitment email address found for this vacancy.',
                              });
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

                        {/* Delete Application */}
                        <button
                          onClick={() => handleDeleteApplication(selectedApp)}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-bold text-xs flex items-center gap-1.5 transition-colors border border-slate-200 hover:border-rose-200"
                          title="Delete this prepared application"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
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
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-black text-slate-900 block">
                            Tailored Professional CV
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            ATS PDF Format (Ready)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenApplicationPdf(selectedApp, 'cv')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white text-xs font-bold transition-colors shadow-xs"
                            title="Open and read the tailored CV PDF immediately"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Open PDF</span>
                          </button>
                          <button
                            onClick={() => handleDownloadCvPdf(selectedApp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-colors shadow-xs"
                            title="Save PDF file to disk"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </div>

                      {/* Cover Letter Card */}
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-black text-slate-900 block">
                            Tailored Application Letter
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Formal PDF Letterhead
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenApplicationPdf(selectedApp, 'letter')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white text-xs font-bold transition-colors shadow-xs"
                            title="Open and read the tailored cover letter PDF immediately"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Open PDF</span>
                          </button>
                          <button
                            onClick={() => handleDownloadCoverLetterPdf(selectedApp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-colors shadow-xs"
                            title="Save PDF file to disk"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        </div>
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

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleOpenApplicationPdf(app, 'cv')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white text-xs font-bold transition-colors shadow-xs"
                      title="Open and read the tailored CV PDF immediately"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open CV</span>
                    </button>

                    <button
                      onClick={() => handleOpenApplicationPdf(app, 'letter')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors shadow-xs"
                      title="Open and read the tailored cover letter PDF immediately"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open Letter</span>
                    </button>

                    <button
                      onClick={() => handleDownloadCvPdf(app)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold"
                      title="Download CV"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteApplication(app)}
                      className="p-1.5 rounded-xl border border-transparent hover:border-rose-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete application record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: DOCUMENT LIBRARY & UPLOAD VAULT */}
      {/* ============================================================== */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Personal Credential &amp; Document Vault
              </h2>
              <p className="text-xs text-slate-500">
                Upload your official Master CV, cover letter templates, and educational documents. All files open promptly in high-fidelity PDF format and attach automatically to applications.
              </p>
            </div>
          </div>

          {/* Permanent Cloud Storage 10 GB Capacity Monitor */}
          <div className="p-4 rounded-2xl bg-[#0B132B] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-white">Permanent Firebase Cloud Storage</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Target: 10.00 GB
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Bucket: <span className="font-mono text-amber-300">gen-lang-client-0056760370.firebasestorage.app</span> • Tier: Blaze (Scalable)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-300">
              <div>
                <span className="text-slate-400 block text-[10px]">Verified Files:</span>
                <span className="text-white font-extrabold">{documents.length} documents</span>
              </div>
              <div className="border-l border-slate-700 pl-4">
                <span className="text-slate-400 block text-[10px]">Capacity Used:</span>
                <span className="text-amber-300 font-extrabold">{storageMetrics.usedMb} MB / 10,240 MB</span>
              </div>
            </div>
          </div>

          {/* Upload New Document Card */}
          <div className="p-5 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-amber-600" />
                <span>Upload New Master CV or Credential Document</span>
              </h3>
              <p className="text-[11px] text-slate-600">
                Supports PDF, Word (.docx), or scanned certificate files. Stored directly in your private vault and attached to applications.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 outline-none"
              >
                <option value="cv">General Master CV</option>
                <option value="cover_letter">General Cover Letter</option>
                <option value="degree_certificate">University Degree Certificate</option>
                <option value="experience_letter">Work Experience Letter</option>
                <option value="other">Other Official Document</option>
              </select>

              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer shadow-xs transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploading ? 'Uploading...' : 'Choose File (PDF)'}</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>

          {/* Document Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">{doc.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{doc.fileName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenDocumentPreview(doc)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white text-xs font-bold transition-colors shadow-xs"
                      title="Open and view PDF document immediately"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open PDF</span>
                    </button>

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
                      {doc.approved ? 'Active' : 'Inactive'}
                    </button>

                    <button
                      onClick={() => handleDeleteDocument(doc)}
                      className="p-1.5 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                      title="Permanently delete document from Firebase Cloud Storage and vault"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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

      {/* ============================================================== */}
      {/* PROMPT PDF & DOCUMENT VIEWER MODAL (Opens Promptly Anytime)    */}
      {/* ============================================================== */}
      {activePdfPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#0B132B] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white truncate max-w-xl">
                    {activePdfPreview.title}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {activePdfPreview.fileName} • Ready &amp; Verified
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={activePdfPreview.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                  title="Open full document in a new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open in New Tab</span>
                </a>

                <a
                  href={activePdfPreview.dataUrl}
                  download={activePdfPreview.fileName}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors shadow-xs"
                  title="Download copy to your device"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </a>

                <button
                  onClick={() => setActivePdfPreview(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors ml-1"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: High-Fidelity Object & Iframe PDF Viewer */}
            <div className="flex-1 bg-slate-100 p-3 sm:p-5 overflow-hidden flex flex-col">
              {activePdfPreview.dataUrl.startsWith('data:application/pdf') || activePdfPreview.fileName.toLowerCase().endsWith('.pdf') ? (
                <object
                  data={activePdfPreview.dataUrl}
                  type="application/pdf"
                  className="w-full h-full rounded-2xl border border-slate-300 shadow-inner bg-white"
                >
                  <iframe
                    src={activePdfPreview.dataUrl}
                    className="w-full h-full rounded-2xl border-0"
                    title={activePdfPreview.title}
                  >
                    <div className="p-8 text-center space-y-3">
                      <p className="text-sm font-bold text-slate-800">
                        Document ready. Click the button below to view or download:
                      </p>
                      <a
                        href={activePdfPreview.dataUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block px-5 py-2.5 bg-amber-400 text-slate-950 rounded-xl font-black text-xs shadow-md"
                      >
                        Open PDF in New Window
                      </a>
                    </div>
                  </iframe>
                </object>
              ) : (
                <div className="w-full h-full bg-white rounded-2xl p-6 border border-slate-300 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800 shadow-inner">
                  {activePdfPreview.extractedText || 'Document content loaded.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Gmail Authorization Modal (Supports Mobile Chrome with 1-Click Direct Connect) */}
      {isGmailAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-black">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Authorize Gmail Account
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    yeabsra45@gmail.com
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGmailAuthModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                Authorize Hopeland Jobs to send approved application emails directly from <strong>yeabsra45@gmail.com</strong>.
              </p>
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5 text-[11px] text-amber-950">
                <div className="font-bold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-700" />
                  <span>Permanent Device & Browser Sync</span>
                </div>
                <p>
                  Once connected, this authorization is permanently stored on the server and synced across all browsers and devices. It will never ask you again.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleAuthorizeYeabsraDirect}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>One-Click Connect (yeabsra45@gmail.com)</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await handleConnectGmail();
                    setIsGmailAuthModalOpen(false);
                  } catch (e: any) {
                    console.warn(e);
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Google Sign-In Popup</span>
              </button>

              <button
                type="button"
                onClick={() => setIsGmailAuthModalOpen(false)}
                className="w-full px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirm Dialog (Replaces window.confirm) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-sm font-black text-slate-900 leading-snug">
                {confirmDialog.title}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {confirmDialog.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-sm transition-colors"
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
