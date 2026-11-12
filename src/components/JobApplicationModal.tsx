import React, { useState, useEffect } from 'react';
import {
  X,
  Building,
  MapPin,
  Clock,
  Briefcase,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Send,
  User,
  Mail,
  Phone,
} from 'lucide-react';
import { Vacancy } from '../types/job';
import { JobSeekerProfile, UserJobApplication } from '../types/jobSeeker';
import { submitJobApplication, fetchUserApplications } from '../lib/firebase';
import { uploadDocumentToCloud } from '../lib/storageService';
import { trackAnalyticsEvent } from '../lib/analyticsTracker';

interface Props {
  vacancy: Vacancy | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: any | null;
  userProfile: JobSeekerProfile | null;
  onNeedAuth: () => void;
  onApplicationSubmitted?: (application: UserJobApplication) => void;
}

export const JobApplicationModal: React.FC<Props> = ({
  vacancy,
  isOpen,
  onClose,
  currentUser,
  userProfile,
  onNeedAuth,
  onApplicationSubmitted,
}) => {
  const [selectedCvUrl, setSelectedCvUrl] = useState<string>('');
  const [selectedCvName, setSelectedCvName] = useState<string>('');
  const [newCvFile, setNewCvFile] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [existingApp, setExistingApp] = useState<UserJobApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Initialize form from user profile & check for duplicate applications
  useEffect(() => {
    if (!vacancy || !currentUser) {
      setAlreadyApplied(false);
      setExistingApp(null);
      return;
    }

    if (userProfile) {
      setFullName(userProfile.fullName || currentUser.displayName || '');
      setPhone(userProfile.phone || '');

      // Set default CV if available
      const cvDoc = userProfile.documents?.find((d) => d.type === 'cv');
      if (cvDoc) {
        setSelectedCvUrl(cvDoc.url);
        setSelectedCvName(cvDoc.name);
      }
    } else {
      setFullName(currentUser.displayName || '');
    }

    // Check if already applied to this vacancy
    fetchUserApplications(currentUser.uid).then((apps) => {
      const match = apps.find((a) => a.vacancyId === vacancy.id);
      if (match) {
        setAlreadyApplied(true);
        setExistingApp(match);
      } else {
        setAlreadyApplied(false);
        setExistingApp(null);
      }
    });
  }, [vacancy, currentUser, userProfile]);

  if (!isOpen || !vacancy) return null;

  // If not logged in, prompt user to sign in or create an account
  if (!currentUser) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden text-center p-6 sm:p-8 space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto shadow-inner">
            <User className="w-8 h-8 text-amber-700" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900">
              Sign In to Apply
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
              To apply for <strong className="text-slate-900">{vacancy.title}</strong> at{' '}
              <strong className="text-slate-900">{vacancy.organization}</strong>, please sign in or create your free Hopeland Jobs job seeker account.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>One-click apply with your stored CV and credentials</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Live tracking of your application review status</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Direct application record with the verified employer</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                onClose();
                onNeedAuth();
              }}
              className="w-full py-3 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Sign In / Register</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle Form Submission
  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !vacancy) return;

    if (alreadyApplied) {
      setError('You have already submitted an application for this vacancy.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let finalResumeUrl = selectedCvUrl;
      let finalResumeName = selectedCvName || 'Candidate_CV.pdf';

      // If user uploaded a new file, upload it to storage
      if (newCvFile) {
        const uploadRes = await uploadDocumentToCloud(
          newCvFile,
          `cv_${Date.now()}`,
          newCvFile.name,
          'user_applications'
        );
        if (uploadRes.success && uploadRes.downloadUrl) {
          finalResumeUrl = uploadRes.downloadUrl;
          finalResumeName = newCvFile.name;
        }
      }

      const application: UserJobApplication = {
        id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: currentUser.uid,
        userEmail: currentUser.email || userProfile?.email || '',
        userName: fullName.trim() || currentUser.displayName || 'Applicant',
        userPhone: phone.trim() || userProfile?.phone || '',
        vacancyId: vacancy.id,
        vacancyTitle: vacancy.title,
        organization: vacancy.organization,
        location: vacancy.location,
        category: vacancy.category,
        resumeUrl: finalResumeUrl,
        resumeName: finalResumeName,
        coverLetter: coverLetter.trim(),
        status: 'submitted',
        statusTimeline: [
          {
            status: 'submitted',
            timestamp: new Date().toISOString(),
            note: 'Application successfully received and recorded in Hopeland Jobs.',
          },
        ],
        appliedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await submitJobApplication(application);
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit application.');
      }

      // Track in GA4
      trackAnalyticsEvent('job_application', {
        jobId: vacancy.id,
        jobTitle: vacancy.title,
        organization: vacancy.organization,
        category: vacancy.category,
        title: `Application for ${vacancy.title}`,
      });

      setIsSuccess(true);
      onApplicationSubmitted?.(application);
    } catch (err: any) {
      setError(err.message || 'Error submitting application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 lg:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#0B132B] text-white p-6 sm:p-7 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-400 text-slate-950 uppercase tracking-wider">
              {vacancy.category}
            </span>
            <span className="text-xs text-slate-400">
              Deadline: {vacancy.applicationDeadline}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            Apply for {vacancy.title}
          </h2>

          <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-bold text-amber-300">
              <Building className="w-3.5 h-3.5 text-amber-400" />
              {vacancy.organization}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {vacancy.location}
            </span>
            <span className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              {vacancy.employmentType}
            </span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 sm:p-7 flex-1 space-y-6">
          {/* Success State */}
          {isSuccess ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">Application Submitted!</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Your application for <strong className="text-slate-900">{vacancy.title}</strong> at{' '}
                  <strong className="text-slate-900">{vacancy.organization}</strong> has been registered. You can track its review progress anytime in your Job Seeker Dashboard.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 max-w-sm mx-auto flex items-center justify-between">
                <span>Status: <strong>Submitted (Under Review)</strong></span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                  Confirmed
                </span>
              </div>

              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors shadow-md"
                >
                  Done
                </button>
              </div>
            </div>
          ) : alreadyApplied ? (
            /* Already Applied Warning State */
            <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-amber-950">You Have Already Applied</h3>
              <p className="text-xs text-amber-900 max-w-md mx-auto">
                You submitted an application for this position on{' '}
                <strong>{existingApp ? new Date(existingApp.appliedAt).toLocaleDateString() : 'earlier date'}</strong>.
                Duplicate submissions are prevented to protect your profile rating with the employer.
              </p>
              {existingApp && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-200 text-amber-950 text-xs font-black uppercase">
                  Current Status: {existingApp.status.replace('_', ' ')}
                </div>
              )}
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-[#0B132B] text-white text-xs font-bold hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Application Form */
            <form onSubmit={handleSubmitApplication} className="space-y-5">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Applicant Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Your Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+251 91 123 4567"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* CV / Resume Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Attach CV / Resume (PDF or DOCX) *
                </label>

                {/* Stored CV options from profile */}
                {userProfile?.documents && userProfile.documents.filter((d) => d.type === 'cv').length > 0 && (
                  <div className="space-y-2 mb-3">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Choose from your profile document vault:
                    </span>
                    <div className="space-y-2">
                      {userProfile.documents
                        .filter((d) => d.type === 'cv')
                        .map((doc) => (
                          <label
                            key={doc.id}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              selectedCvUrl === doc.url && !newCvFile
                                ? 'bg-amber-50 border-amber-400 shadow-xs'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 text-xs">
                              <input
                                type="radio"
                                name="cvSelection"
                                checked={selectedCvUrl === doc.url && !newCvFile}
                                onChange={() => {
                                  setSelectedCvUrl(doc.url);
                                  setSelectedCvName(doc.name);
                                  setNewCvFile(null);
                                }}
                                className="text-amber-500 focus:ring-amber-400"
                              />
                              <FileText className="w-4 h-4 text-amber-600" />
                              <span className="font-bold text-slate-800">{doc.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}

                {/* Or upload new file */}
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-amber-400 transition-colors text-center bg-slate-50/50">
                  <input
                    type="file"
                    id="newCvInput"
                    accept=".pdf,.docx,.doc"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setNewCvFile(e.target.files[0]);
                        setSelectedCvName(e.target.files[0].name);
                      }
                    }}
                    className="hidden"
                  />
                  <label htmlFor="newCvInput" className="cursor-pointer block space-y-1">
                    <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                    <span className="text-xs font-bold text-slate-800 block">
                      {newCvFile ? `Selected: ${newCvFile.name}` : 'Upload a New CV / Resume file'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Supported formats: PDF, DOCX (Max 15MB)
                    </span>
                  </label>
                </div>
              </div>

              {/* Cover Letter / Note to Employer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cover Letter / Note to Employer (Optional)
                </label>
                <textarea
                  rows={4}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Introduce yourself and explain why your qualifications make you an ideal candidate for this role..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || (!selectedCvUrl && !newCvFile)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-black text-xs transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Submitting Application...' : 'Submit Application Now'}</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-2">
                  By clicking Submit, your profile and attached documents will be securely submitted to {vacancy.organization}.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
