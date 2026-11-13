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
} from 'lucide-react';
import {
  JobSeekerProfile,
  UserJobApplication,
  EducationItem,
  ExperienceItem,
  SeekerDocument,
  calculateProfileCompletion,
} from '../types/jobSeeker';
import { Vacancy } from '../types/job';
import { saveJobSeekerProfile } from '../lib/firebase';
import { uploadDocumentToCloud, TARGET_STORAGE_CAPACITY_GB } from '../lib/storageService';
import { trackAnalyticsEvent } from '../lib/analyticsTracker';
import { askAiCareerCoach, CareerCoachAiResponse } from '../lib/aiService';

interface Props {
  profile: JobSeekerProfile;
  applications: UserJobApplication[];
  savedVacancies: Vacancy[];
  onUpdateProfile: (updated: JobSeekerProfile) => Promise<void>;
  onSelectVacancy: (vacancy: Vacancy) => void;
  onClose: () => void;
}

export const JobSeekerDashboard: React.FC<Props> = ({
  profile,
  applications,
  savedVacancies,
  onUpdateProfile,
  onSelectVacancy,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'personal' | 'professional' | 'education' | 'experience' | 'documents' | 'applications' | 'saved'
  >('overview');

  const [formProfile, setFormProfile] = useState<JobSeekerProfile>({ ...profile });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [aiCoachResult, setAiCoachResult] = useState<CareerCoachAiResponse | null>(null);
  const [isAiCoachLoading, setIsAiCoachLoading] = useState(false);

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
      setSaveToast('Profile changes saved successfully!');
      setTimeout(() => setSaveToast(null), 3500);

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
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white">
                    {formProfile.fullName || 'Job Seeker Profile'}
                  </h1>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    Verified Seeker
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formProfile.email} {formProfile.phone ? `• ${formProfile.phone}` : ''}
                </p>
                <p className="text-xs text-amber-300 font-semibold mt-0.5">
                  {formProfile.desiredJobTitle || 'Career Professional'} • {formProfile.locationCity || 'Addis Ababa'}
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
            { id: 'personal', label: 'Personal Details', icon: Edit2 },
            { id: 'professional', label: 'Career & Skills', icon: Briefcase },
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
                    <span>Saved Vacancies</span>
                    <Heart className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {savedVacancies.length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Bookmarked opportunities</div>
                </div>
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
          {/* TAB 2: PERSONAL INFORMATION */}
          {/* ========================================================= */}
          {activeTab === 'personal' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Personal Information</h3>
                <p className="text-xs text-slate-500">
                  Manage your personal contact information displayed to employers.
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
              </div>

              {/* Skills Tags */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Key Skills (Comma separated or add tags)
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
                  placeholder="Type a skill and press Enter (e.g. IFRS, Core Banking, Python)..."
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
