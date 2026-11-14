import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Save,
  Check,
  AlertCircle,
  Building,
  MapPin,
  Calendar,
  FileText,
  DollarSign,
  Briefcase,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import {
  Vacancy,
  OFFICIAL_CATEGORIES,
  ETHIOPIAN_LOCATIONS,
  JobCategoryName,
} from '../../types/job';
import { checkDuplicateVacancy } from '../../utils/duplicateDetector';
import { generateAdminVacancyDraft } from '../../lib/aiService';

interface Props {
  existingVacancies: Vacancy[];
  onSaveVacancy: (vacancy: Vacancy) => Promise<void>;
  onClose: () => void;
  initialData?: Vacancy | null;
}

export const ManualPostModal: React.FC<Props> = ({
  existingVacancies,
  onSaveVacancy,
  onClose,
  initialData,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [organization, setOrganization] = useState(initialData?.organization || '');
  const [category, setCategory] = useState<JobCategoryName>(
    initialData?.category || 'Banking and Financial Institutions'
  );
  const [location, setLocation] = useState(initialData?.location || 'Addis Ababa');
  const [customLocation, setCustomLocation] = useState('');
  const [employmentType, setEmploymentType] = useState<Vacancy['employmentType']>(
    initialData?.employmentType || 'Full-time'
  );
  const [vacanciesCount, setVacanciesCount] = useState(initialData?.vacanciesCount || '1');
  const [jobGrade, setJobGrade] = useState(initialData?.jobGrade || '');
  const [salary, setSalary] = useState(initialData?.salary || 'Attractive / As per Company Scale');
  const [educationQualification, setEducationQualification] = useState(
    initialData?.educationQualification || 'Bachelor’s Degree'
  );
  const [requiredFieldOfStudy, setRequiredFieldOfStudy] = useState(
    initialData?.requiredFieldOfStudy || ''
  );
  const [experienceYears, setExperienceYears] = useState(initialData?.experienceYears || '2 Years');
  const [skillsText, setSkillsText] = useState(initialData?.requiredSkills?.join(', ') || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [responsibilitiesText, setResponsibilitiesText] = useState(
    initialData?.responsibilities?.join('\n') || ''
  );
  const [requiredDocumentsText, setRequiredDocumentsText] = useState(
    initialData?.requiredDocuments?.join(', ') || 'CV, Cover Letter, Degree & Student Copy, Work Experience'
  );
  const [applicationMethod, setApplicationMethod] = useState<Vacancy['applicationMethod']>(
    initialData?.applicationMethod || 'Online URL'
  );
  const [applicationUrl, setApplicationUrl] = useState(initialData?.applicationUrl || '');
  const [applicationEmail, setApplicationEmail] = useState(initialData?.applicationEmail || '');
  const [applicationInstructions, setApplicationInstructions] = useState(
    initialData?.applicationInstructions ||
      'Interested and qualified applicants should submit their credentials following the official application link or contact details provided above.'
  );
  const [applicationDeadline, setApplicationDeadline] = useState(
    initialData?.applicationDeadline || '2026-11-30'
  );
  const [contactInfo, setContactInfo] = useState(initialData?.contactInfo || '');
  const [referenceNumber, setReferenceNumber] = useState(initialData?.referenceNumber || '');
  const [languageRequirements, setLanguageRequirements] = useState(
    initialData?.languageRequirements || 'English and Amharic'
  );
  const [ageRequirements, setAgeRequirements] = useState(
    initialData?.ageRequirements || 'Not specified in the original vacancy'
  );
  const [genderRequirements, setGenderRequirements] = useState(
    initialData?.genderRequirements || 'Not specified in the original vacancy'
  );
  const [specialRequirements, setSpecialRequirements] = useState(
    initialData?.specialRequirements || 'Not specified in the original vacancy'
  );
  const [status, setStatus] = useState<Vacancy['status']>(initialData?.status || 'published');
  const [featured, setFeatured] = useState<boolean>(initialData?.featured || false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowDuplicateOverride, setAllowDuplicateOverride] = useState(false);
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [aiDraftMessage, setAiDraftMessage] = useState<string | null>(null);
  const [aiTelegramCaption, setAiTelegramCaption] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAiDraftVacancy = async () => {
    if (!title.trim() || !organization.trim()) {
      setFormError('Enter both Job Title and Organization before drafting with AI.');
      return;
    }
    setFormError(null);
    setAiDraftMessage(null);
    setIsAiDrafting(true);
    try {
      const res = await generateAdminVacancyDraft({
        title: title.trim(),
        organization: organization.trim(),
        category,
        location,
        experienceYears,
        educationQualification,
        notes: description.trim(),
      });
      setDescription(res.description);
      if (res.responsibilities?.length) {
        setResponsibilitiesText(res.responsibilities.join('\n'));
      }
      if (res.requiredSkills?.length) {
        setSkillsText(res.requiredSkills.join(', '));
      }
      if (res.applicationInstructions) {
        setApplicationInstructions(res.applicationInstructions);
      }
      if (res.telegramCaption) {
        setAiTelegramCaption(res.telegramCaption);
      }
      setAiDraftMessage('AI drafted job overview, responsibilities, skills, and instructions. Please review before publishing.');
    } catch (err: any) {
      setFormError(err.message || 'AI drafting assistant is temporarily unavailable.');
    } finally {
      setIsAiDrafting(false);
    }
  };

  // Strict live duplicate screening check
  const duplicateCheck = useMemo(() => {
    if (!title.trim() || !organization.trim()) return null;
    const effectiveLocation =
      location === 'Other Ethiopian Cities / Regions' && customLocation.trim()
        ? customLocation.trim()
        : location;
    return checkDuplicateVacancy(
      {
        id: initialData?.id || 'manual_temp',
        title: title.trim(),
        organization: organization.trim(),
        location: effectiveLocation,
        referenceNumber: referenceNumber.trim() || undefined,
        applicationUrl: applicationUrl.trim() || undefined,
        applicationEmail: applicationEmail.trim() || undefined,
        description: description.trim() || undefined,
      },
      existingVacancies,
      initialData?.id
    );
  }, [
    title,
    organization,
    location,
    customLocation,
    referenceNumber,
    applicationUrl,
    applicationEmail,
    description,
    existingVacancies,
    initialData,
  ]);

  const handleSubmit = async (targetStatus: 'published' | 'draft') => {
    setFormError(null);
    if (!title.trim() || !organization.trim()) {
      setFormError('Please fill in Job Title and Organization name.');
      return;
    }

    if (
      duplicateCheck?.isDuplicate &&
      duplicateCheck.similarityScore >= 0.95 &&
      !allowDuplicateOverride
    ) {
      setFormError(
        `Strict Duplicate Warning: ${duplicateCheck.reason} Check "I confirm this is a separate, distinct vacancy" to override.`
      );
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();
    const finalLocation = location === 'Other Ethiopian Cities / Regions' && customLocation ? customLocation : location;

    const vacancy: Vacancy = {
      id: initialData?.id || `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      organization: organization.trim(),
      category,
      location: finalLocation,
      employmentType,
      vacanciesCount: vacanciesCount.trim() || 'Not specified in the original vacancy',
      jobGrade: jobGrade.trim() || 'Not specified in the original vacancy',
      salary: salary.trim() || 'Not specified in the original vacancy',
      educationQualification: educationQualification.trim() || 'Not specified in the original vacancy',
      requiredFieldOfStudy: requiredFieldOfStudy.trim() || 'Not specified in the original vacancy',
      experienceYears: experienceYears.trim() || 'Not specified in the original vacancy',
      requiredSkills: skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      description: description.trim() || 'Not specified in the original vacancy',
      responsibilities: responsibilitiesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      requiredDocuments: requiredDocumentsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      applicationMethod,
      applicationUrl: applicationUrl.trim(),
      applicationEmail: applicationEmail.trim(),
      applicationInstructions: applicationInstructions.trim(),
      applicationDeadline: applicationDeadline.trim(),
      contactInfo: contactInfo.trim() || 'Not specified in the original vacancy',
      languageRequirements: languageRequirements.trim() || 'Not specified in the original vacancy',
      ageRequirements: ageRequirements.trim() || 'Not specified in the original vacancy',
      genderRequirements: genderRequirements.trim() || 'Not specified in the original vacancy',
      specialRequirements: specialRequirements.trim() || 'Not specified in the original vacancy',
      referenceNumber: referenceNumber.trim(),
      status: targetStatus,
      featured,
      viewsCount: initialData?.viewsCount || 0,
      sharesCount: initialData?.sharesCount || 0,
      createdAt: initialData?.createdAt || now,
      updatedAt: now,
      publishedAt: targetStatus === 'published' ? (initialData?.publishedAt || now) : undefined,
    };

    try {
      await onSaveVacancy(vacancy);
      onClose();
    } catch (err: any) {
      setFormError('Error saving vacancy: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#0B132B] text-white p-6 relative shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">
              {initialData ? 'Edit Vacancy' : 'Manual Vacancy Posting'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Post an official vacancy collected from banks, embassies, NGOs, or employers.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6 flex-1">
          {/* Strict Duplicate Pre-check Alert */}
          {duplicateCheck?.isDuplicate && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border-2 border-amber-300 text-amber-950 space-y-2.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span className="font-extrabold text-xs uppercase tracking-wider text-amber-900">
                    Strict Duplicate Warning ({Math.round(duplicateCheck.similarityScore * 100)}% Match)
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                  ID: {duplicateCheck.matchedVacancy?.id}
                </span>
              </div>
              <p className="text-xs font-semibold leading-relaxed text-amber-900">
                {duplicateCheck.reason}
              </p>
              {duplicateCheck.matchedVacancy && (
                <div className="bg-white p-3 rounded-xl border border-amber-200 text-xs text-slate-700 space-y-1">
                  <div className="font-bold text-slate-900">
                    Existing Record: {duplicateCheck.matchedVacancy.title} — {duplicateCheck.matchedVacancy.organization}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Category: {duplicateCheck.matchedVacancy.category} • Deadline: {duplicateCheck.matchedVacancy.applicationDeadline || 'N/A'}
                  </div>
                </div>
              )}
              <div className="pt-1 flex items-center gap-2 border-t border-amber-200/80">
                <input
                  type="checkbox"
                  id="overrideDup"
                  checked={allowDuplicateOverride}
                  onChange={(e) => setAllowDuplicateOverride(e.target.checked)}
                  className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="overrideDup" className="text-xs font-bold text-amber-950 cursor-pointer">
                  I confirm this is a separate, distinct vacancy and should be saved.
                </label>
              </div>
            </div>
          )}

          {formError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {aiDraftMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{aiDraftMessage}</span>
              </div>
              {aiTelegramCaption && (
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 text-[11px] text-slate-700">
                  <strong className="text-emerald-800 block mb-0.5">Suggested Telegram Caption:</strong>
                  <span className="whitespace-pre-line">{aiTelegramCaption}</span>
                </div>
              )}
            </div>
          )}

          {/* Core Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Job Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Branch Manager / Finance Officer"
                className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Organization / Employer *
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Awash Bank / UNICEF Ethiopia / Sheraton Addis"
                className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-600 font-medium">
              Need help structuring the description, responsibilities, and required skills?
            </span>
            <button
              type="button"
              onClick={handleAiDraftVacancy}
              disabled={isAiDrafting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-amber-400 font-extrabold text-xs transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiDrafting ? 'animate-spin' : ''}`} />
              <span>{isAiDrafting ? 'Drafting with Gemini AI...' : 'AI Draft Job Details'}</span>
            </button>
          </div>

          {/* Category & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Job Category (16 Sectors) *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as JobCategoryName)}
                className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none bg-white font-medium"
              >
                {OFFICIAL_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Ethiopian Location *
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none bg-white font-medium"
              >
                {ETHIOPIAN_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              {location === 'Other Ethiopian Cities / Regions' && (
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="Enter specific city or woreda name..."
                  className="w-full text-xs p-2.5 mt-2 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
                />
              )}
            </div>
          </div>

          {/* Employment, Openings, Salary, Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Employment Type
              </label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value as any)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none bg-white"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Permanent">Permanent</option>
                <option value="Internship">Internship</option>
                <option value="Remote">Remote</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Openings Count
              </label>
              <input
                type="text"
                value={vacanciesCount}
                onChange={(e) => setVacanciesCount(e.target.value)}
                placeholder="e.g. 1, 5, Multiple"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Salary & Benefits
              </label>
              <input
                type="text"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="e.g. ETB 45,000 / Scale"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Application Deadline *
              </label>
              <input
                type="text"
                value={applicationDeadline}
                onChange={(e) => setApplicationDeadline(e.target.value)}
                placeholder="YYYY-MM-DD or date"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none font-semibold text-amber-700"
                required
              />
            </div>
          </div>

          {/* Education & Experience */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Educational Qualification
              </label>
              <input
                type="text"
                value={educationQualification}
                onChange={(e) => setEducationQualification(e.target.value)}
                placeholder="Degree / Diploma / Masters"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Required Field of Study
              </label>
              <input
                type="text"
                value={requiredFieldOfStudy}
                onChange={(e) => setRequiredFieldOfStudy(e.target.value)}
                placeholder="e.g. Accounting, Computer Science"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Work Experience Required
              </label>
              <input
                type="text"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                placeholder="e.g. 3 years relevant experience"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Job Description & Overview *
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste or write the complete vacancy description..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none leading-relaxed"
              required
            />
          </div>

          {/* Responsibilities */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Key Responsibilities (One per line)
            </label>
            <textarea
              rows={3}
              value={responsibilitiesText}
              onChange={(e) => setResponsibilitiesText(e.target.value)}
              placeholder="- Lead daily banking branch operations&#10;- Supervise team and customer service delivery&#10;- Ensure NBE compliance"
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none leading-relaxed"
            />
          </div>

          {/* Required Documents & Skills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Required Documents (Comma separated)
              </label>
              <input
                type="text"
                value={requiredDocumentsText}
                onChange={(e) => setRequiredDocumentsText(e.target.value)}
                placeholder="CV, Cover Letter, Degree, Kebele ID"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Required Skills (Comma separated)
              </label>
              <input
                type="text"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="Financial modeling, AML compliance, Team leadership"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Application Method & Links */}
          <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 space-y-4">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Application Details & Official Channels
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Application Method
                </label>
                <select
                  value={applicationMethod}
                  onChange={(e) => setApplicationMethod(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-amber-500 outline-none bg-white font-medium"
                >
                  <option value="Online URL">Online URL / Portal</option>
                  <option value="Email">Email Application</option>
                  <option value="In-Person / Physical">In-Person / Physical</option>
                  <option value="Postal / Mail">Postal / Mail</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Official Application URL
                </label>
                <input
                  type="text"
                  value={applicationUrl}
                  onChange={(e) => setApplicationUrl(e.target.value)}
                  placeholder="https://company.com/apply"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Application Email
                </label>
                <input
                  type="email"
                  value={applicationEmail}
                  onChange={(e) => setApplicationEmail(e.target.value)}
                  placeholder="recruitment@company.com"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Application Instructions
              </label>
              <textarea
                rows={2}
                value={applicationInstructions}
                onChange={(e) => setApplicationInstructions(e.target.value)}
                placeholder="Specific submission instructions from employer..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-amber-500 outline-none leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reference Number (Vacancy Code)
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. CBE-VAC-2026-09"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Employer Contact Info
                </label>
                <input
                  type="text"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Phone, HR office address, P.O. Box"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-amber-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Featured toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="feat"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
            />
            <label htmlFor="feat" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Mark as Featured Vacancy (Highlight on category page)
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-300"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSubmit('draft')}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold text-xs"
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSubmit('published')}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20"
            >
              Publish Vacancy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
