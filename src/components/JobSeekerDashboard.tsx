import React, { useState } from 'react';
import {
  User,
  Briefcase,
  GraduationCap,
  FileText,
  Clock,
  Heart,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Save,
  Upload,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building,
  MapPin,
  Calendar,
  Sparkles,
  X,
  FileCheck,
  Award,
  Compass,
  Globe,
  Target,
  Bell,
  Mail,
  CheckCheck,
  Check,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';
import {
  JobSeekerProfile,
  UserJobApplication,
  EducationItem,
  ExperienceItem,
  SeekerDocument,
  CertificationItem,
  StaffAccountRole,
  NotificationPreferencesRecord,
  NotificationPermissionState,
  UserNotificationItem,
  calculateProfileCompletion,
} from '../types/jobSeeker';
import { Vacancy } from '../types/job';
import { InternationalJob, ExperienceScholarship } from '../types/international';
import {
  computeStaffOpportunityRecommendations,
  hasSufficientProfileForRecommendations,
} from '../utils/recommendationEngine';
import { uploadDocumentToCloud, TARGET_STORAGE_CAPACITY_GB } from '../lib/storageService';
import { trackAnalyticsEvent } from '../lib/analyticsTracker';
import { askAiCareerCoach, CareerCoachAiResponse } from '../lib/aiService';
import { sendTestPushNotification } from '../lib/notificationService';

const RECOMMENDED_SECTOR_OPTIONS = [
  'Commercial Banking & Finance',
  'Microfinance & SACCOs',
  'Insurance & Risk',
  'WASH (Water, Sanitation & Hygiene)',
  'International NGOs & UN',
  'Local NGOs & Civil Society',
  'Government & Public Sector',
  'Embassies & Diplomatic Missions',
  'Airlines & Aviation',
  'Hotels & Tourism',
  'Manufacturing & Industrial',
  'Private Companies & Corporate',
  'IT, Software & Telecom',
  'Health & Medical',
  'Education & Academic',
  'Other / General Sectors',
];

interface Props {
  profile: JobSeekerProfile;
  applications: UserJobApplication[];
  savedVacancies: Vacancy[];
  vacancies?: Vacancy[];
  internationalJobs?: InternationalJob[];
  experienceScholarships?: ExperienceScholarship[];
  onUpdateProfile: (updated: JobSeekerProfile) => Promise<void>;
  onSelectVacancy: (vacancy: Vacancy) => void;
  onClose: () => void;
  initialTab?:
    | 'overview'
    | 'recommendations'
    | 'notifications'
    | 'personal'
    | 'professional'
    | 'education'
    | 'experience'
    | 'documents'
    | 'applications'
    | 'saved';
  notifications?: UserNotificationItem[];
  unreadNotificationsCount?: number;
  notificationPrefs?: NotificationPreferencesRecord | null;
  browserNotificationPermission?: NotificationPermissionState;
  hasActiveDevicePush?: boolean;
  onUpdateNotificationPrefs?: (patch: Partial<NotificationPreferencesRecord>) => Promise<void>;
  onEnableDevicePush?: () => Promise<void>;
  onMarkNotificationRead?: (id: string, read: boolean) => Promise<void>;
  onMarkAllNotificationsRead?: () => Promise<void>;
}

export const JobSeekerDashboard: React.FC<Props> = ({
  profile,
  applications,
  savedVacancies,
  vacancies = [],
  internationalJobs = [],
  experienceScholarships = [],
  onUpdateProfile,
  onSelectVacancy,
  onClose,
  initialTab = 'overview',
  notifications = [],
  unreadNotificationsCount = 0,
  notificationPrefs = null,
  browserNotificationPermission = 'default',
  hasActiveDevicePush = false,
  onUpdateNotificationPrefs = async () => {},
  onEnableDevicePush = async () => {},
  onMarkNotificationRead = async () => {},
  onMarkAllNotificationsRead = async () => {},
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'recommendations'
    | 'notifications'
    | 'personal'
    | 'professional'
    | 'education'
    | 'experience'
    | 'documents'
    | 'applications'
    | 'saved'
  >(initialTab);

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [recFilter, setRecFilter] = useState<'all' | 'qualified'>('all');
  const [testPushFeedback, setTestPushFeedback] = useState<string | null>(null);
  const [isTestingPush, setIsTestingPush] = useState(false);

  const [formProfile, setFormProfile] = useState<JobSeekerProfile>({
    ...profile,
    accountRole: profile.accountRole || 'staff',
    previousPositions: Array.isArray(profile.previousPositions) ? profile.previousPositions : [],
    areasOfExpertise: Array.isArray(profile.areasOfExpertise) ? profile.areasOfExpertise : [],
    professionalInterests: Array.isArray(profile.professionalInterests) ? profile.professionalInterests : [],
    preferredSectors: Array.isArray(profile.preferredSectors) ? profile.preferredSectors : [],
    certifications: Array.isArray(profile.certifications) ? profile.certifications : [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [aiCoachResult, setAiCoachResult] = useState<CareerCoachAiResponse | null>(null);
  const [isAiCoachLoading, setIsAiCoachLoading] = useState(false);

  // Sync if outer profile updates
  React.useEffect(() => {
    setFormProfile({
      ...profile,
      accountRole: profile.accountRole || 'staff',
      previousPositions: Array.isArray(profile.previousPositions) ? profile.previousPositions : [],
      areasOfExpertise: Array.isArray(profile.areasOfExpertise) ? profile.areasOfExpertise : [],
      professionalInterests: Array.isArray(profile.professionalInterests) ? profile.professionalInterests : [],
      preferredSectors: Array.isArray(profile.preferredSectors) ? profile.preferredSectors : [],
      certifications: Array.isArray(profile.certifications) ? profile.certifications : [],
    });
  }, [profile]);

  const [newPrevPosition, setNewPrevPosition] = useState('');
  const [isAddingCert, setIsAddingCert] = useState(false);
  const [newCert, setNewCert] = useState<Partial<CertificationItem>>({
    name: '',
    issuingOrganization: '',
    issueDate: '',
    credentialId: '',
  });

  const hasSufficientProfile = React.useMemo(
    () => hasSufficientProfileForRecommendations(formProfile),
    [formProfile]
  );

  const recommendations = React.useMemo(
    () =>
      computeStaffOpportunityRecommendations(
        formProfile,
        vacancies,
        internationalJobs,
        experienceScholarships,
        25
      ),
    [formProfile, vacancies, internationalJobs, experienceScholarships]
  );

  const handleRunAiCareerCoach = async () => {
    setIsAiCoachLoading(true);
    try {
      const res = await askAiCareerCoach({
        userProfile: formProfile,
        mode: 'profile_optimize',
      });
      setAiCoachResult(res);
    } catch (err: any) {
      setSaveToast(err.message || 'AI Career Coach is temporarily unavailable.');
      setTimeout(() => setSaveToast(null), 3500);
    } finally {
      setIsAiCoachLoading(false);
    }
  };

  // New item states
  const [isAddingEdu, setIsAddingEdu] = useState(false);
  const [newEdu, setNewEdu] = useState<Partial<EducationItem>>({
    institution: '',
    qualification: "Bachelor's Degree",
    fieldOfStudy: '',
    graduationYear: '2024',
  });

  const [isAddingExp, setIsAddingExp] = useState(false);
  const [newExp, setNewExp] = useState<Partial<ExperienceItem>>({
    companyName: '',
    jobTitle: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    responsibilities: '',
  });

  // Calculate live completion %
  const completionPct = calculateProfileCompletion(formProfile);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = {
        ...formProfile,
        profileCompletionPercentage: completionPct,
        updatedAt: new Date().toISOString(),
      };
      await onUpdateProfile(updated);
      const hasMandatoryReady =
        Boolean(updated.yearsOfExperience?.trim() || (updated.experience?.length || 0) > 0) &&
        Boolean((updated.preferredSectors?.length || 0) > 0 || updated.preferredIndustry?.trim() || updated.desiredJobTitle?.trim());
      setSaveToast(
        hasMandatoryReady
          ? 'Profile saved! Matching job recommendations & notifications are now active.'
          : 'Profile saved! Add your experience & preferred job sector to activate automatic job alerts.'
      );
      setTimeout(() => setSaveToast(null), 4000);

      trackAnalyticsEvent('profile_update', {
        title: 'Job Seeker Profile Updated',
      });
    } catch (e: any) {
      setSaveToast('Error saving profile changes.');
      setTimeout(() => setSaveToast(null), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  // Add Education
  const handleAddEducation = () => {
    if (!newEdu.institution?.trim() || !newEdu.fieldOfStudy?.trim()) return;
    const item: EducationItem = {
      id: `edu_${Date.now()}`,
      institution: newEdu.institution.trim(),
      qualification: newEdu.qualification || "Bachelor's Degree",
      fieldOfStudy: newEdu.fieldOfStudy.trim(),
      graduationYear: newEdu.graduationYear || '2024',
      additionalInfo: newEdu.additionalInfo?.trim(),
    };
    const nextList = [...(formProfile.education || []), item];
    setFormProfile({ ...formProfile, education: nextList });
    setIsAddingEdu(false);
    setNewEdu({ institution: '', qualification: "Bachelor's Degree", fieldOfStudy: '', graduationYear: '2024' });
  };

  // Remove Education
  const handleRemoveEducation = (id: string) => {
    setFormProfile({
      ...formProfile,
      education: (formProfile.education || []).filter((e) => e.id !== id),
    });
  };

  // Add Experience
  const handleAddExperience = () => {
    if (!newExp.companyName?.trim() || !newExp.jobTitle?.trim()) return;
    const item: ExperienceItem = {
      id: `exp_${Date.now()}`,
      companyName: newExp.companyName.trim(),
      jobTitle: newExp.jobTitle.trim(),
      startDate: newExp.startDate || '',
      endDate: newExp.isCurrent ? 'Present' : newExp.endDate || '',
      isCurrent: Boolean(newExp.isCurrent),
      responsibilities: newExp.responsibilities?.trim() || '',
      achievements: newExp.achievements?.trim(),
    };
    const nextList = [...(formProfile.experience || []), item];
    setFormProfile({ ...formProfile, experience: nextList });
    setIsAddingExp(false);
    setNewExp({ companyName: '', jobTitle: '', startDate: '', endDate: '', isCurrent: false, responsibilities: '' });
  };

  // Remove Experience
  const handleRemoveExperience = (id: string) => {
    setFormProfile({
      ...formProfile,
      experience: (formProfile.experience || []).filter((e) => e.id !== id),
    });
  };

  // Add Previous Position
  const handleAddPreviousPosition = () => {
    const val = newPrevPosition.trim();
    if (!val) return;
    const existing = formProfile.previousPositions || [];
    if (!existing.includes(val)) {
      setFormProfile({ ...formProfile, previousPositions: [...existing, val] });
    }
    setNewPrevPosition('');
  };

  // Remove Previous Position
  const handleRemovePreviousPosition = (idx: number) => {
    setFormProfile({
      ...formProfile,
      previousPositions: (formProfile.previousPositions || []).filter((_, i) => i !== idx),
    });
  };

  // Add Certification
  const handleAddCertification = () => {
    if (!newCert.name?.trim() || !newCert.issuingOrganization?.trim()) return;
    const item: CertificationItem = {
      id: `cert_${Date.now()}`,
      name: newCert.name.trim(),
      issuingOrganization: newCert.issuingOrganization.trim(),
      issueDate: newCert.issueDate?.trim() || '',
      credentialId: newCert.credentialId?.trim() || '',
    };
    setFormProfile({
      ...formProfile,
      certifications: [...(formProfile.certifications || []), item],
    });
    setIsAddingCert(false);
    setNewCert({ name: '', issuingOrganization: '', issueDate: '', credentialId: '' });
  };

  // Remove Certification
  const handleRemoveCertification = (id: string) => {
    setFormProfile({
      ...formProfile,
      certifications: (formProfile.certifications || []).filter((c) => c.id !== id),
    });
  };

  // Handle Document Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: SeekerDocument['type']) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    try {
      const res = await uploadDocumentToCloud(file, `doc_${Date.now()}`, file.name, 'job_seeker_documents');
      if (res.success && res.downloadUrl) {
        const docItem: SeekerDocument = {
          id: `doc_${Date.now()}`,
          name: file.name,
          type,
          url: res.downloadUrl,
          storagePath: res.storagePath,
          sizeBytes: res.fileSizeBytes,
          uploadedAt: new Date().toISOString(),
        };

        const updatedDocs = [...(formProfile.documents || []), docItem];
        const next = { ...formProfile, documents: updatedDocs };
        setFormProfile(next);
        await onUpdateProfile(next);
        setSaveToast(`${file.name} uploaded to your document vault!`);
        setTimeout(() => setSaveToast(null), 3500);

        trackAnalyticsEvent('cv_upload', {
          title: `Uploaded document: ${file.name}`,
        });
      } else {
        throw new Error(res.error || 'Upload failed');
      }
    } catch (err: any) {
      setSaveToast(`Upload failed: ${err.message || 'Error uploading file'}`);
      setTimeout(() => setSaveToast(null), 3500);
    } finally {
      setIsUploadingDoc(false);
      e.target.value = '';
    }
  };

  // Delete Document
  const handleDeleteDocument = (id: string) => {
    const updatedDocs = (formProfile.documents || []).filter((d) => d.id !== id);
    setFormProfile({ ...formProfile, documents: updatedDocs });
  };

  // Document total size calculation
  const totalSizeBytes = (formProfile.documents || []).reduce((acc, d) => acc + (d.sizeBytes || 120000), 0);
  const totalSizeMb = (totalSizeBytes / (1024 * 1024)).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#FBFBFA] rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Dashboard Top Header */}
        <div className="bg-[#0B132B] text-white p-6 sm:p-8 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {formProfile.photoUrl ? (
                <img
                  src={formProfile.photoUrl}
                  alt={formProfile.fullName || 'Profile'}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400/70 shadow-md shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-2xl shadow-md shrink-0">
                  {formProfile.fullName ? formProfile.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-white">
                    {formProfile.fullName || 'Staff & Career Profile'}
                  </h1>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    {formProfile.accountRole === 'staff' ? 'Registered Staff' : 'Verified Seeker'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formProfile.email} {formProfile.phone ? `• ${formProfile.phone}` : ''}
                </p>
                <p className="text-xs text-amber-300 font-semibold mt-0.5">
                  {formProfile.currentPosition || formProfile.desiredJobTitle || 'Career Professional'} • {formProfile.locationCity || 'Addis Ababa'}
                </p>
              </div>
            </div>

            {/* Profile Completion Bar */}
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 min-w-[220px]">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-300">Profile Strength</span>
                <span className="text-amber-400">{completionPct}%</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {completionPct >= 80 ? '🌟 High visibility to employers' : 'Complete profile to boost job matches'}
              </span>
            </div>
          </div>
        </div>

        {/* Action feedback toast */}
        {saveToast && (
          <div className="bg-emerald-950 text-emerald-100 px-6 py-2.5 text-xs font-bold flex items-center gap-2 border-b border-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveToast}</span>
          </div>
        )}

        {/* Sub Navigation Tabs */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
          {[
            { id: 'overview', label: 'Dashboard Overview', icon: User },
            { id: 'recommendations', label: 'Recommended For You', icon: Target, count: recommendations.length },
            { id: 'notifications', label: 'Alerts & Preferences', icon: Bell, count: unreadNotificationsCount },
            { id: 'personal', label: 'Personal & Role', icon: Edit2 },
            { id: 'professional', label: 'Expertise & Sectors', icon: Briefcase },
            { id: 'education', label: 'Education', icon: GraduationCap, count: formProfile.education?.length },
            { id: 'experience', label: 'Experience', icon: Building, count: formProfile.experience?.length },
            { id: 'documents', label: 'CV & Document Vault', icon: FileText, count: formProfile.documents?.length },
            { id: 'applications', label: 'My Applications', icon: Clock, count: applications.length },
            { id: 'saved', label: 'Saved Jobs', icon: Heart, count: savedVacancies.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 px-3.5 border-b-2 text-xs font-bold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-[#0B132B] text-[#0B132B]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isActive ? 'bg-[#0B132B] text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable Tab Content Area */}
        <div className="overflow-y-auto p-6 sm:p-8 flex-1 space-y-6">
          {/* ========================================================= */}
          {/* TAB 1: OVERVIEW */}
          {/* ========================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Status Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>Applied Jobs</span>
                    <Clock className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {applications.length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Submitted vacancies</div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>Under Review</span>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-amber-600 font-mono">
                    {applications.filter((a) => a.status === 'submitted' || a.status === 'under_review').length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Active employer reviews</div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>Interview Calls</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-emerald-600 font-mono">
                    {applications.filter((a) => a.status === 'interview' || a.status === 'accepted').length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Invitations received</div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>Eligible Matches</span>
                    <Target className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-700 font-mono">
                    {recommendations.length}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('recommendations')}
                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 mt-0.5"
                  >
                    View tailored list →
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>Saved Vacancies</span>
                    <Heart className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {savedVacancies.length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Bookmarked opportunities</div>
                </div>
              </div>

              {/* Tailored Eligible Opportunities Preview */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <Target className="w-4 h-4 text-emerald-600" />
                      <span>Eligible Opportunity Matches</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Automatically filtered against your documented role, years of experience, education, and certifications.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('recommendations')}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700 shrink-0"
                  >
                    See All ({recommendations.length}) →
                  </button>
                </div>

                {!hasSufficientProfile ? (
                  <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-amber-950">
                      <strong>Complete your staff profile</strong> (current position, expertise, skills, education, or experience) so we can match you accurately without guessing.
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('professional')}
                      className="px-4 py-2 rounded-xl bg-[#0B132B] text-white text-xs font-bold shrink-0 hover:bg-amber-400 hover:text-slate-950 transition-colors"
                    >
                      Complete Profile
                    </button>
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    No active open listings currently match your exact documented qualifications. Update your skills, areas of expertise, or preferred sector in <strong>Expertise &amp; Certs</strong> to expand matches.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {recommendations.slice(0, 4).map((rec) => (
                      <div
                        key={rec.id}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-amber-400 transition-all flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {rec.matchScore}% Match • {rec.eligibilityStatus}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {rec.sourceType === 'domestic_job'
                                ? 'Domestic Vacancy'
                                : rec.sourceType === 'international_job'
                                ? 'International Job'
                                : 'Scholarship'}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-sm text-slate-900 line-clamp-1">{rec.title}</h4>
                          <p className="text-[11px] text-slate-600">
                            {rec.organization} • {rec.location}
                          </p>
                          <div className="text-[11px] text-emerald-800 font-medium">
                            {rec.matchReasons[0]}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-[11px]">
                          <span className="text-slate-500">Deadline: {rec.deadline || 'Open'}</span>
                          {rec.vacancy ? (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onSelectVacancy(rec.vacancy!);
                              }}
                              className="font-extrabold text-[#0B132B] hover:text-amber-600"
                            >
                              View &amp; Apply →
                            </button>
                          ) : rec.applyUrl ? (
                            <a
                              href={rec.applyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-extrabold text-[#0B132B] hover:text-amber-600 inline-flex items-center gap-1"
                            >
                              <span>Official Source</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Career Coach & Profile Enhancer */}
              <div className="bg-gradient-to-br from-[#0B132B] to-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Gemini AI Career Coach</span>
                    </div>
                    <h3 className="text-base font-extrabold text-white mt-0.5">
                      Optimize Your Profile &amp; Boost Employer Matches
                    </h3>
                    <p className="text-xs text-slate-300">
                      Get an AI-polished professional bio, target Ethiopian job titles, and high-value skills tailored to your background.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunAiCareerCoach}
                    disabled={isAiCoachLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className={`w-4 h-4 ${isAiCoachLoading ? 'animate-spin' : ''}`} />
                    <span>{isAiCoachLoading ? 'Analyzing Profile...' : 'Optimize Profile with AI'}</span>
                  </button>
                </div>

                {aiCoachResult && (
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 text-xs animate-in fade-in">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          AI-Polished Professional Bio
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormProfile({ ...formProfile, bio: aiCoachResult.polishedBio });
                            setSaveToast('AI bio applied! Click Save in Personal Details to persist.');
                            setTimeout(() => setSaveToast(null), 3500);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] cursor-pointer"
                        >
                          Apply Bio to Profile
                        </button>
                      </div>
                      <p className="text-slate-200 leading-relaxed bg-slate-900 p-3 rounded-xl border border-slate-800">
                        {aiCoachResult.polishedBio}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300 mb-2">
                          Suggested Skills (Click to Add)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {aiCoachResult.suggestedSkills?.map((skill) => {
                            const exists = (formProfile.skills || []).includes(skill);
                            return (
                              <button
                                key={skill}
                                type="button"
                                disabled={exists}
                                onClick={() => {
                                  if (!exists) {
                                    setFormProfile({
                                      ...formProfile,
                                      skills: [...(formProfile.skills || []), skill],
                                    });
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                                  exists
                                    ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50'
                                    : 'bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-slate-200 border border-slate-700 cursor-pointer'
                                }`}
                              >
                                {exists ? `✓ ${skill}` : `+ ${skill}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-2">
                          Profile Strength Tips
                        </div>
                        <ul className="space-y-1 text-[11px] text-slate-300">
                          {aiCoachResult.profileStrengthTips?.map((tip, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Applications Feed */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-slate-900">
                    Recent Job Applications
                  </h3>
                  <button
                    onClick={() => setActiveTab('applications')}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700"
                  >
                    View All ({applications.length})
                  </button>
                </div>

                {applications.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">No Applications Submitted Yet</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Explore our published banking, NGO, embassy, and corporate vacancies and click "Apply Now".
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.slice(0, 3).map((app) => (
                      <div
                        key={app.id}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-900">{app.vacancyTitle}</h4>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                app.status === 'accepted' || app.status === 'interview'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : app.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {app.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {app.organization} • {app.location} • Applied {new Date(app.appliedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1B: RECOMMENDED FOR YOU */}
          {/* ========================================================= */}
          {activeTab === 'recommendations' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-600" />
                    <span>Personalized Opportunity Recommendations ({recommendations.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Matched across Banking, Microfinance, Insurance, WASH, NGOs, Government, Embassies, Airlines, Hospitality, Manufacturing, and Private companies. Expired and unverified listings are strictly excluded.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setRecFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        recFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      All Matches
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecFilter('qualified')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        recFilter === 'qualified' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      100% Qualified
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('professional')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Refine Sectors &amp; Skills
                  </button>
                </div>
              </div>

              {!hasSufficientProfile ? (
                <div className="p-8 text-center bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
                  <Compass className="w-10 h-10 text-amber-500 mx-auto" />
                  <h4 className="font-black text-sm text-amber-950">Add Your Role, Skills, or Education to Unlock Matches</h4>
                  <p className="text-xs text-amber-900 max-w-md mx-auto">
                    Hopeland never invents qualifications. Add your current or desired position, preferred sectors, skills, or education so we can compute verified matches.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('professional')}
                    className="px-5 py-2.5 rounded-xl bg-[#0B132B] text-white text-xs font-extrabold hover:bg-amber-400 hover:text-slate-950 transition-colors cursor-pointer"
                  >
                    Update Staff &amp; Career Profile
                  </button>
                </div>
              ) : recommendations.filter((r) => recFilter === 'all' || r.isFullyQualified).length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <Briefcase className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">No Matching Opportunities Found Right Now</p>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    We checked active verified jobs across all sectors against your experience ({formProfile.yearsOfExperience || 'Not set'}), education, and preferred sectors. Keep notifications enabled to be alerted immediately when new matches publish.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recommendations
                    .filter((r) => recFilter === 'all' || r.isFullyQualified)
                    .map((rec) => (
                    <div
                      key={`${rec.sourceType}_${rec.id}`}
                      className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-amber-400 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span
                              className={`font-black font-mono tabular-nums ${
                                rec.isFullyQualified ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {rec.matchScore}% Match ({rec.eligibilityStatus})
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-slate-700">
                              {rec.sourceType === 'domestic_job'
                                ? 'Verified Vacancy'
                                : rec.sourceType === 'international_job'
                                ? 'Verified International Job'
                                : 'Experience-Based Scholarship'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{rec.category}</span>
                          </div>
                          <h4 className="font-black text-base text-slate-900">{rec.title}</h4>
                          <p className="text-xs text-slate-600 font-semibold">
                            {rec.organization} · {rec.location}
                            {rec.salary ? ` · ${rec.salary}` : ''}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {rec.vacancy ? (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onSelectVacancy(rec.vacancy!);
                              }}
                              className="px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors cursor-pointer"
                            >
                              View &amp; Apply
                            </button>
                          ) : rec.applyUrl ? (
                            <a
                              href={rec.applyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors"
                            >
                              <span>Open Official Portal</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : null}
                        </div>
                      </div>

                      {/* Why it matches */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-600">Why this role matches your profile:</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {rec.matchReasons.map((reason, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{reason}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Clear Missing Mandatory Qualifications Notice */}
                      {rec.missingMandatoryQualifications && rec.missingMandatoryQualifications.length > 0 && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                          <div className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>Missing Mandatory Requirements to Check Before Applying:</span>
                          </div>
                          <ul className="list-disc pl-5 text-xs text-amber-900 space-y-0.5">
                            {rec.missingMandatoryQualifications.map((gap, i) => (
                              <li key={i}>{gap}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-[11px] text-slate-600">
                        <div>
                          <strong className="text-slate-800">Education:</strong> {rec.requiredEducationText}
                        </div>
                        <div>
                          <strong className="text-slate-800">Experience:</strong> {rec.requiredExperienceText}
                        </div>
                        <div>
                          <strong className="text-slate-800">Deadline:</strong> {rec.deadline || 'Rolling / Open'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1C: NOTIFICATIONS & ALERT PREFERENCES */}
          {/* ========================================================= */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              {/* Device Push & Channel Controls */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <Bell className="w-5 h-5 text-amber-500" />
                      <span>Notification Channels &amp; Device Status</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Control how Hopeland Jobs notifies you about matching vacancies across Website, Desktop/Mobile Push, and Email.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {(!hasActiveDevicePush || browserNotificationPermission !== 'granted') && (
                      <button
                        type="button"
                        onClick={() => onEnableDevicePush()}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        <span>
                          {browserNotificationPermission === 'denied'
                            ? 'Check Browser Permission'
                            : 'ENABLE NOTIFICATIONS'}
                        </span>
                      </button>
                    )}

                    {hasActiveDevicePush && (
                      <button
                        type="button"
                        disabled={isTestingPush}
                        onClick={async () => {
                          setIsTestingPush(true);
                          const res = await sendTestPushNotification(formProfile.uid, formProfile.email);
                          setTestPushFeedback(res.message);
                          setIsTestingPush(false);
                        }}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isTestingPush ? 'Sending...' : 'Send Test Push Alert'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Current Device Status Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500">This Device Permission</div>
                    <div
                      className={`font-extrabold mt-0.5 ${
                        browserNotificationPermission === 'granted'
                          ? 'text-emerald-700'
                          : browserNotificationPermission === 'denied'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {browserNotificationPermission === 'granted' && hasActiveDevicePush
                        ? 'Granted & Active'
                        : browserNotificationPermission === 'granted'
                        ? 'Granted (Syncing Device)'
                        : browserNotificationPermission === 'denied'
                        ? 'Blocked in Browser Settings'
                        : browserNotificationPermission === 'unsupported'
                        ? 'Bell & Email Mode'
                        : 'Not Enabled Yet'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500">Registered Push Devices</div>
                    <div className="font-mono tabular-nums font-extrabold text-slate-900 mt-0.5">
                      {(notificationPrefs?.deviceSubscriptions || []).filter((d) => d.active).length} active device(s)
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500">Last Alert Synced</div>
                    <div className="font-mono tabular-nums font-bold text-slate-800 mt-0.5">
                      {notificationPrefs?.lastSuccessfulDeliveryAt
                        ? new Date(notificationPrefs.lastSuccessfulDeliveryAt).toLocaleString()
                        : 'Ready for matches'}
                    </div>
                  </div>
                </div>

                {testPushFeedback && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800">
                    {testPushFeedback}
                  </div>
                )}

                {/* Channel & Type Checkboxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-extrabold text-slate-800">Notification Channels</h4>
                    {[
                      {
                        key: 'websiteBell' as const,
                        label: 'Website Notification Bell',
                        desc: 'Always show matched job alerts in your dashboard and navbar.',
                      },
                      {
                        key: 'browserPush' as const,
                        label: 'Desktop Browser Push Notifications',
                        desc: 'Real-time Chrome, Edge, or Firefox push alerts even when tab is minimized.',
                      },
                      {
                        key: 'mobilePush' as const,
                        label: 'Mobile Push Notifications (Android / iOS PWA)',
                        desc: 'Instant alerts on Android Chrome and iPhone/iPad Home Screen web apps.',
                      },
                      {
                        key: 'emailAlerts' as const,
                        label: 'Email Vacancy Alerts',
                        desc: `Send personalized match summaries to ${formProfile.email}.`,
                      },
                    ].map((ch) => {
                      const checked = notificationPrefs?.channels?.[ch.key] ?? (ch.key === 'websiteBell' || ch.key === 'emailAlerts');
                      return (
                        <label
                          key={ch.key}
                          className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:border-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              onUpdateNotificationPrefs({
                                channels: {
                                  ...(notificationPrefs?.channels || {
                                    websiteBell: true,
                                    browserPush: false,
                                    mobilePush: false,
                                    emailAlerts: true,
                                  }),
                                  [ch.key]: e.target.checked,
                                },
                              })
                            }
                            className="mt-0.5 w-4 h-4 accent-[#0B132B] cursor-pointer"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-slate-900">{ch.label}</div>
                            <div className="text-[11px] text-slate-500">{ch.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="space-y-2.5">
                    <h4 className="text-xs font-extrabold text-slate-800">Alert Categories</h4>
                    {[
                      {
                        key: 'newMatches' as const,
                        label: 'New Matching Vacancies',
                        desc: 'Alert immediately when new verified jobs match your profile.',
                      },
                      {
                        key: 'deadlineReminders' as const,
                        label: 'Application Deadline Reminders',
                        desc: 'Remind when a suitable matched job closes within 72 hours.',
                      },
                      {
                        key: 'jobChanges' as const,
                        label: 'Vacancy Updates & Deadline Extensions',
                        desc: 'Notify when an employer updates requirements or extends deadlines.',
                      },
                      {
                        key: 'sectorUpdates' as const,
                        label: 'Preferred Sector Openings',
                        desc: 'Notify on major openings across your chosen industries & WASH/NGO calls.',
                      },
                    ].map((at) => {
                      const checked = notificationPrefs?.alertTypes?.[at.key] ?? true;
                      return (
                        <label
                          key={at.key}
                          className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:border-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              onUpdateNotificationPrefs({
                                alertTypes: {
                                  ...(notificationPrefs?.alertTypes || {
                                    newMatches: true,
                                    deadlineReminders: true,
                                    jobChanges: true,
                                    sectorUpdates: true,
                                  }),
                                  [at.key]: e.target.checked,
                                },
                              })
                            }
                            className="mt-0.5 w-4 h-4 accent-[#0B132B] cursor-pointer"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-slate-900">{at.label}</div>
                            <div className="text-[11px] text-slate-500">{at.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Delivery Frequency Selector */}
                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800">Notification Frequency</h4>
                    <p className="text-[11px] text-slate-500">
                      Choose how often automated matching alerts are dispatched to your email and push devices.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      {
                        id: 'instant' as const,
                        title: 'Instant Alerts',
                        desc: 'Send immediately as new matching vacancies are published.',
                      },
                      {
                        id: 'daily' as const,
                        title: 'Daily Summary',
                        desc: 'Receive a consolidated digest once every 24 hours.',
                      },
                      {
                        id: 'weekly' as const,
                        title: 'Weekly Digest',
                        desc: 'Receive a weekly roundup of top verified opportunities.',
                      },
                    ].map((opt) => {
                      const isSelected = (notificationPrefs?.frequency || 'instant') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onUpdateNotificationPrefs({ frequency: opt.id })}
                          className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#0B132B] text-white border-[#0B132B]'
                              : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="text-xs font-extrabold">{opt.title}</div>
                          <div className={`text-[11px] mt-0.5 leading-snug ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            {opt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Persisted Notification History */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      Saved Notification History ({notifications.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      All matched vacancy notifications remain stored across sign-outs and reconnects until expired.
                    </p>
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onMarkAllNotificationsRead()}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Mark All Read</span>
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                    <Bell className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">No Job Notifications Delivered Yet</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Save your skills, education, and preferred sectors in your profile to trigger personalized vacancy alerts.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`py-4 px-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          notif.read ? 'bg-white' : 'bg-amber-50/45'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-bold text-emerald-700 font-mono tabular-nums">
                              {notif.matchScore}% Match
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{notif.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {new Date(notif.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-sm text-slate-900">{notif.title}</h4>
                          <p className="text-xs text-slate-600">
                            {notif.employer} · {notif.location}
                            {notif.salary ? ` · ${notif.salary}` : ''} · Deadline: {notif.deadline || 'Open'}
                          </p>
                          {notif.matchReasonSummary && (
                            <p className="text-xs text-emerald-800 font-medium">{notif.matchReasonSummary}</p>
                          )}
                          {notif.missingMandatoryQualifications?.length > 0 && (
                            <p className="text-xs text-amber-800 font-medium">
                              Missing requirement: {notif.missingMandatoryQualifications.join(', ')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onMarkNotificationRead(notif.id, !notif.read)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{notif.read ? 'Mark Unread' : 'Mark Read'}</span>
                          </button>

                          {(() => {
                            const matchedVac = vacancies.find((v) => v.id === notif.vacancyId);
                            if (matchedVac) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!notif.read) onMarkNotificationRead(notif.id, true);
                                    onClose();
                                    onSelectVacancy(matchedVac);
                                  }}
                                  className="px-3.5 py-1.5 rounded-lg bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white text-xs font-extrabold cursor-pointer"
                                >
                                  Open Job
                                </button>
                              );
                            }
                            if (notif.applicationUrl || notif.jobUrl) {
                              return (
                                <a
                                  href={notif.applicationUrl || notif.jobUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3.5 py-1.5 rounded-lg bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white text-xs font-extrabold inline-flex items-center gap-1"
                                >
                                  <span>View</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: PERSONAL INFORMATION */}
          {/* ========================================================= */}
          {activeTab === 'personal' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Personal &amp; Staff Identity Information</h3>
                <p className="text-xs text-slate-500">
                  Manage your permanent staff role, department, and personal contact information.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={formProfile.fullName}
                    onChange={(e) => setFormProfile({ ...formProfile, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={formProfile.email}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={formProfile.phone}
                    onChange={(e) => setFormProfile({ ...formProfile, phone: e.target.value })}
                    placeholder="+251 91 123 4567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City / Region *</label>
                  <input
                    type="text"
                    value={formProfile.locationCity}
                    onChange={(e) => setFormProfile({ ...formProfile, locationCity: e.target.value })}
                    placeholder="e.g. Addis Ababa"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date of Birth (Optional)</label>
                  <input
                    type="date"
                    value={formProfile.dateOfBirth || ''}
                    onChange={(e) => setFormProfile({ ...formProfile, dateOfBirth: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gender (Optional)</label>
                  <select
                    value={formProfile.gender || ''}
                    onChange={(e) => setFormProfile({ ...formProfile, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Role</label>
                  <select
                    value={formProfile.accountRole || 'staff'}
                    onChange={(e) =>
                      setFormProfile({ ...formProfile, accountRole: e.target.value as StaffAccountRole })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  >
                    <option value="staff">Staff Member (Organization / Team Profile)</option>
                    <option value="job_seeker">Job Seeker / Candidate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department / Practice Sector</label>
                  <input
                    type="text"
                    value={formProfile.staffDepartmentOrSector || ''}
                    onChange={(e) =>
                      setFormProfile({ ...formProfile, staffDepartmentOrSector: e.target.value })
                    }
                    placeholder="e.g. WASH Program / Banking Operations / IT"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Professional Biography / Summary
                </label>
                <textarea
                  rows={3}
                  value={formProfile.bio || ''}
                  onChange={(e) => setFormProfile({ ...formProfile, bio: e.target.value })}
                  placeholder="Summarize your background, core strengths, and career goals in Ethiopia..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors shadow-md disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Personal Details'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: PROFESSIONAL & SKILLS */}
          {/* ========================================================= */}
          {activeTab === 'professional' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Career &amp; Professional Information</h3>
                <p className="text-xs text-slate-500">
                  Specify your desired job title, expected salary in ETB, and core competencies.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Current Position</label>
                  <input
                    type="text"
                    value={formProfile.currentPosition || ''}
                    onChange={(e) => setFormProfile({ ...formProfile, currentPosition: e.target.value })}
                    placeholder="e.g. WASH Project Coordinator / Credit Analyst"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Desired Job Title *</label>
                  <input
                    type="text"
                    value={formProfile.desiredJobTitle}
                    onChange={(e) => setFormProfile({ ...formProfile, desiredJobTitle: e.target.value })}
                    placeholder="e.g. Senior Accountant / Branch Manager"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Current Status</label>
                  <select
                    value={formProfile.employmentStatus}
                    onChange={(e) => setFormProfile({ ...formProfile, employmentStatus: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  >
                    <option value="employed">Currently Employed (Seeking Next Opportunity)</option>
                    <option value="unemployed">Actively Job Hunting</option>
                    <option value="student">Student / Fresh Graduate</option>
                    <option value="freelance">Consultant / Freelancer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Total Experience Years</label>
                  <input
                    type="text"
                    value={formProfile.yearsOfExperience}
                    onChange={(e) => setFormProfile({ ...formProfile, yearsOfExperience: e.target.value })}
                    placeholder="e.g. 5 Years"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expected Monthly Salary (ETB)</label>
                  <input
                    type="text"
                    value={formProfile.expectedSalaryEtb}
                    onChange={(e) => setFormProfile({ ...formProfile, expectedSalaryEtb: e.target.value })}
                    placeholder="e.g. 35,000 - 50,000 ETB"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Primary Preferred Industry</label>
                  <input
                    type="text"
                    value={formProfile.preferredIndustry}
                    onChange={(e) => setFormProfile({ ...formProfile, preferredIndustry: e.target.value })}
                    placeholder="e.g. WASH / NGO / Banking and Financial Institutions"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                </div>
              </div>

              {/* Preferred Sectors Multi-Select (Used by Automated Matcher & Alerts) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Preferred Job Sectors for Automatic Matching &amp; Alerts
                </label>
                <p className="text-[11px] text-slate-500 mb-2.5">
                  Select all sectors you want automatic job recommendations and notifications for:
                </p>
                <div className="flex flex-wrap gap-2">
                  {RECOMMENDED_SECTOR_OPTIONS.map((sec) => {
                    const selected = (formProfile.preferredSectors || []).includes(sec);
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          const current = formProfile.preferredSectors || [];
                          const next = selected ? current.filter((x) => x !== sec) : [...current, sec];
                          setFormProfile({
                            ...formProfile,
                            preferredSectors: next,
                            preferredIndustry: next[0] || formProfile.preferredIndustry,
                          });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#0B132B] text-white border-[#0B132B]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {selected ? `✓ ${sec}` : sec}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Previous Positions */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Previous Positions Held
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(formProfile.previousPositions || []).map((pos, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-900 text-xs font-bold border border-sky-200"
                    >
                      <span>{pos}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePreviousPosition(idx)}
                        className="text-sky-500 hover:text-rose-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPrevPosition}
                    onChange={(e) => setNewPrevPosition(e.target.value)}
                    placeholder="Add a previous role (e.g. Junior Project Officer at UNICEF)..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPreviousPosition();
                      }
                    }}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddPreviousPosition}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                  >
                    Add Role
                  </button>
                </div>
              </div>

              {/* Skills Tags */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Key Skills (Press Enter to add)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(formProfile.skills || []).map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = formProfile.skills.filter((_, i) => i !== idx);
                          setFormProfile({ ...formProfile, skills: next });
                        }}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Type a skill and press Enter (e.g. IFRS, Core Banking, Python, WASH Engineering)..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !formProfile.skills.includes(val)) {
                        setFormProfile({ ...formProfile, skills: [...formProfile.skills, val] });
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              {/* Areas of Expertise */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Areas of Expertise (Press Enter to add)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(formProfile.areasOfExpertise || []).map((expTag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 text-xs font-bold border border-emerald-200"
                    >
                      <span>{expTag}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = (formProfile.areasOfExpertise || []).filter((_, i) => i !== idx);
                          setFormProfile({ ...formProfile, areasOfExpertise: next });
                        }}
                        className="text-emerald-500 hover:text-rose-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Water & Sanitation, Financial Risk Management, Monitoring & Evaluation..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      const current = formProfile.areasOfExpertise || [];
                      if (val && !current.includes(val)) {
                        setFormProfile({ ...formProfile, areasOfExpertise: [...current, val] });
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              {/* Professional Interests */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Professional &amp; Opportunity Interests (Press Enter to add)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(formProfile.professionalInterests || []).map((interest, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 text-xs font-bold border border-amber-200"
                    >
                      <span>{interest}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = (formProfile.professionalInterests || []).filter((_, i) => i !== idx);
                          setFormProfile({ ...formProfile, professionalInterests: next });
                        }}
                        className="text-amber-600 hover:text-rose-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Humanitarian WASH, International Relocation, Graduate Scholarships..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      const current = formProfile.professionalInterests || [];
                      if (val && !current.includes(val)) {
                        setFormProfile({ ...formProfile, professionalInterests: [...current, val] });
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              {/* Structured Certifications */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      Professional Certifications &amp; Licenses
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Used to verify eligibility for specialized domestic and international roles (e.g. CPA, ACCA, PMP).
                    </p>
                  </div>
                  {!isAddingCert && (
                    <button
                      type="button"
                      onClick={() => setIsAddingCert(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Certification</span>
                    </button>
                  )}
                </div>

                {isAddingCert && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Certification Name (e.g. ACCA, PMP, AWS Certified)"
                        value={newCert.name}
                        onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
                        className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Issuing Organization (e.g. PMI, ACCA Global)"
                        value={newCert.issuingOrganization}
                        onChange={(e) => setNewCert({ ...newCert, issuingOrganization: e.target.value })}
                        className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Issue Year / Date (Optional)"
                        value={newCert.issueDate}
                        onChange={(e) => setNewCert({ ...newCert, issueDate: e.target.value })}
                        className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Credential ID (Optional)"
                        value={newCert.credentialId}
                        onChange={(e) => setNewCert({ ...newCert, credentialId: e.target.value })}
                        className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs outline-none"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingCert(false)}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCertification}
                        className="px-3.5 py-1.5 rounded-xl bg-[#0B132B] text-white text-xs font-bold"
                      >
                        Save Certification
                      </button>
                    </div>
                  </div>
                )}

                {(formProfile.certifications || []).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(formProfile.certifications || []).map((cert) => (
                      <div
                        key={cert.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2"
                      >
                        <div className="flex items-start gap-2.5">
                          <Award className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-xs text-slate-900">{cert.name}</div>
                            <div className="text-[11px] text-slate-500">
                              {cert.issuingOrganization}
                              {cert.issueDate ? ` • ${cert.issueDate}` : ''}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCertification(cert.id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors shadow-md disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Professional Details'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: EDUCATION */}
          {/* ========================================================= */}
          {activeTab === 'education' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Educational History</h3>
                  <p className="text-xs text-slate-500">
                    Add your university degrees, colleges, diplomas, and certifications.
                  </p>
                </div>
                {!isAddingEdu && (
                  <button
                    onClick={() => setIsAddingEdu(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Degree / College</span>
                  </button>
                )}
              </div>

              {/* Add Edu Card Form */}
              {isAddingEdu && (
                <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3 animate-in fade-in">
                  <h4 className="text-xs font-bold text-amber-950">Add Educational Record</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="University / College (e.g. Addis Ababa University)"
                      value={newEdu.institution}
                      onChange={(e) => setNewEdu({ ...newEdu, institution: e.target.value })}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Qualification (e.g. Bachelor of Arts)"
                      value={newEdu.qualification}
                      onChange={(e) => setNewEdu({ ...newEdu, qualification: e.target.value })}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Field of Study (e.g. Accounting and Finance)"
                      value={newEdu.fieldOfStudy}
                      onChange={(e) => setNewEdu({ ...newEdu, fieldOfStudy: e.target.value })}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Graduation Year (e.g. 2024)"
                      value={newEdu.graduationYear}
                      onChange={(e) => setNewEdu({ ...newEdu, graduationYear: e.target.value })}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setIsAddingEdu(false)}
                      className="px-4 py-2 rounded-xl bg-white text-slate-700 text-xs font-bold border border-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddEducation}
                      className="px-4 py-2 rounded-xl bg-[#0B132B] text-white text-xs font-bold hover:bg-amber-400 hover:text-slate-950"
                    >
                      Save Degree
                    </button>
                  </div>
                </div>
              )}

              {/* Edu List */}
              <div className="space-y-3">
                {(formProfile.education || []).length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                    No educational history added yet. Click "Add Degree / College" to add your qualifications.
                  </div>
                ) : (
                  formProfile.education.map((edu) => (
                    <div
                      key={edu.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">{edu.institution}</h4>
                          <p className="text-xs text-slate-600">
                            {edu.qualification} in {edu.fieldOfStudy} • Class of {edu.graduationYear}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveEducation(edu.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors shadow-md disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: WORK EXPERIENCE */}
          {/* ========================================================= */}
          {activeTab === 'experience' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Work Experience</h3>
                  <p className="text-xs text-slate-500">
                    Add previous banking, NGO, or corporate jobs to strengthen your application.
                  </p>
                </div>
                {!isAddingExp && (
                  <button
                    onClick={() => setIsAddingExp(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Employment Record</span>
                  </button>
                )}
              </div>

              {/* Add Exp Form */}
              {isAddingExp && (
                <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3 animate-in fade-in">
                  <h4 className="text-xs font-bold text-amber-950">Add Work Experience</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Company / Employer (e.g. Commercial Bank of Ethiopia)"
                      value={newExp.companyName}
                      onChange={(e) => setNewExp({ ...newExp, companyName: e.target.value })}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Job Title (e.g. Banking Officer)"
                      value={newExp.jobTitle}
                      onChange={(e) => setNewExp({ ...newExp, jobTitle: e.target.value })}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Start Date (e.g. Jan 2021)"
                      value={newExp.startDate}
                      onChange={(e) => setNewExp({ ...newExp, startDate: e.target.value })}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none"
                    />
                    <input
                      type="text"
                      placeholder="End Date or 'Present'"
                      value={newExp.endDate}
                      onChange={(e) => setNewExp({ ...newExp, endDate: e.target.value })}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none"
                    />
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Key Responsibilities and Achievements..."
                    value={newExp.responsibilities}
                    onChange={(e) => setNewExp({ ...newExp, responsibilities: e.target.value })}
                    className="w-full p-3 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none resize-none"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setIsAddingExp(false)}
                      className="px-4 py-2 rounded-xl bg-white text-slate-700 text-xs font-bold border border-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddExperience}
                      className="px-4 py-2 rounded-xl bg-[#0B132B] text-white text-xs font-bold hover:bg-amber-400 hover:text-slate-950"
                    >
                      Save Experience
                    </button>
                  </div>
                </div>
              )}

              {/* Exp List */}
              <div className="space-y-3">
                {(formProfile.experience || []).length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                    No employment history added yet. Click "Add Employment Record" to list your work experience.
                  </div>
                ) : (
                  formProfile.experience.map((exp) => (
                    <div
                      key={exp.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                          <Building className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">{exp.jobTitle}</h4>
                          <p className="text-xs text-slate-600 font-semibold">
                            {exp.companyName} • {exp.startDate} – {exp.endDate}
                          </p>
                          {exp.responsibilities && (
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                              {exp.responsibilities}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveExperience(exp.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors shadow-md disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: DOCUMENTS & 10GB CLOUD VAULT */}
          {/* ========================================================= */}
          {activeTab === 'documents' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    CV &amp; Document Cloud Vault
                  </h3>
                  <p className="text-xs text-slate-500">
                    Store CVs, degrees, work certificates, and recommendation letters.
                  </p>
                </div>

                {/* 10GB Target Capacity Meter */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Permanent Cloud Storage: 10 GB Allocation</span>
                  </div>
                  <div className="h-1.5 w-48 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.max(2, (Number(totalSizeMb) / (TARGET_STORAGE_CAPACITY_GB * 1024)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {totalSizeMb} MB used of 10.00 GB ({TARGET_STORAGE_CAPACITY_GB} GB Scalable)
                  </span>
                </div>
              </div>

              {/* Upload Dropzones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-400 text-center bg-slate-50/50 transition-colors">
                  <input
                    type="file"
                    id="uploadCv"
                    accept=".pdf,.docx,.doc"
                    onChange={(e) => handleFileUpload(e, 'cv')}
                    className="hidden"
                  />
                  <label htmlFor="uploadCv" className="cursor-pointer block space-y-1">
                    <Upload className="w-6 h-6 text-amber-500 mx-auto" />
                    <span className="text-xs font-bold text-slate-800 block">Upload Master CV</span>
                    <span className="text-[10px] text-slate-400 block">PDF or DOCX (Max 15MB)</span>
                  </label>
                </div>

                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-400 text-center bg-slate-50/50 transition-colors">
                  <input
                    type="file"
                    id="uploadDegree"
                    accept=".pdf,.jpg,.png"
                    onChange={(e) => handleFileUpload(e, 'degree_certificate')}
                    className="hidden"
                  />
                  <label htmlFor="uploadDegree" className="cursor-pointer block space-y-1">
                    <GraduationCap className="w-6 h-6 text-sky-500 mx-auto" />
                    <span className="text-xs font-bold text-slate-800 block">Degree Certificate</span>
                    <span className="text-[10px] text-slate-400 block">PDF, JPG or PNG</span>
                  </label>
                </div>

                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-400 text-center bg-slate-50/50 transition-colors">
                  <input
                    type="file"
                    id="uploadExp"
                    accept=".pdf,.jpg,.png"
                    onChange={(e) => handleFileUpload(e, 'experience_letter')}
                    className="hidden"
                  />
                  <label htmlFor="uploadExp" className="cursor-pointer block space-y-1">
                    <Briefcase className="w-6 h-6 text-emerald-500 mx-auto" />
                    <span className="text-xs font-bold text-slate-800 block">Experience Letter</span>
                    <span className="text-[10px] text-slate-400 block">Proof of past employment</span>
                  </label>
                </div>

                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-400 text-center bg-slate-50/50 transition-colors">
                  <input
                    type="file"
                    id="uploadCertDoc"
                    accept=".pdf,.jpg,.png"
                    onChange={(e) => handleFileUpload(e, 'certification')}
                    className="hidden"
                  />
                  <label htmlFor="uploadCertDoc" className="cursor-pointer block space-y-1">
                    <Award className="w-6 h-6 text-amber-600 mx-auto" />
                    <span className="text-xs font-bold text-slate-800 block">Certification / License</span>
                    <span className="text-[10px] text-slate-400 block">CPA, ACCA, PMP, etc.</span>
                  </label>
                </div>
              </div>

              {isUploadingDoc && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
                  <span>Uploading document to secure cloud storage...</span>
                </div>
              )}

              {/* Uploaded Documents List */}
              <div className="space-y-2.5">
                {(formProfile.documents || []).length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                    No documents uploaded yet. Upload your CV above so employers can review your credentials.
                  </div>
                ) : (
                  formProfile.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-amber-500 shrink-0" />
                        <div>
                          <h4 className="font-bold text-xs text-slate-900">{doc.name}</h4>
                          <span className="text-[10px] text-slate-400">
                            Type: {doc.type.replace('_', ' ').toUpperCase()} • Uploaded{' '}
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 inline-flex items-center gap-1"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 7: MY APPLICATIONS (LIVE TRACKER) */}
          {/* ========================================================= */}
          {activeTab === 'applications' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Application Tracker ({applications.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Track employer reviews, shortlists, interview invitations, and status milestones.
                </p>
              </div>

              {applications.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No Job Applications Yet</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Browse verified Ethiopian job vacancies on the homepage and submit your application with one click.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-sm text-slate-900">{app.vacancyTitle}</h4>
                            <span
                              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                                app.status === 'accepted' || app.status === 'interview'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : app.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : app.status === 'shortlisted'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {app.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {app.organization} • {app.location} • Applied {new Date(app.appliedAt).toLocaleDateString()}
                          </p>
                        </div>

                        {app.resumeUrl && (
                          <a
                            href={app.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-slate-700 hover:text-amber-600 flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Submitted CV ({app.resumeName || 'Resume.pdf'})</span>
                          </a>
                        )}
                      </div>

                      {/* Status Timeline */}
                      {app.statusTimeline && app.statusTimeline.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/80">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                            Review Timeline:
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            {app.statusTimeline.map((step, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <strong>{step.status.replace('_', ' ').toUpperCase()}</strong>
                                <span className="text-slate-400 text-[10px]">
                                  ({new Date(step.timestamp).toLocaleDateString()})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 8: SAVED JOBS */}
          {/* ========================================================= */}
          {activeTab === 'saved' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Bookmarked Vacancies ({savedVacancies.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Jobs you saved for later review and application.
                </p>
              </div>

              {savedVacancies.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <Heart className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No Saved Vacancies</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Click the heart icon on any vacancy card to bookmark it for quick access.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {savedVacancies.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => onSelectVacancy(v)}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                        {v.category}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 group-hover:text-amber-600 transition-colors mt-2 line-clamp-1">
                        {v.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">{v.organization} • {v.location}</p>
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2 border-t border-slate-200/80">
                        <span>Deadline: {v.applicationDeadline}</span>
                        <span className="font-bold text-[#0B132B]">View Job &rarr;</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
