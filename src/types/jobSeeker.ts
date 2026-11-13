export interface EducationItem {
  id: string;
  institution: string;
  qualification: string;
  fieldOfStudy: string;
  graduationYear: string;
  additionalInfo?: string;
}

export interface ExperienceItem {
  id: string;
  companyName: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  responsibilities: string;
  achievements?: string;
}

export interface SeekerDocument {
  id: string;
  name: string;
  type: 'cv' | 'degree_certificate' | 'experience_letter' | 'other';
  url: string;
  storagePath?: string;
  sizeBytes?: number;
  uploadedAt: string;
}

export interface JobSeekerProfile {
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  photoUrl?: string;
  locationCity: string;
  locationRegion: string;
  dateOfBirth?: string;
  gender?: string;
  bio?: string;
  storageUsedBytes?: number;
  storageCapacityBytes?: number;
  authProvider?: string;
  emailVerified?: boolean;

  // Professional Information
  employmentStatus: 'employed' | 'unemployed' | 'student' | 'freelance' | 'other';
  desiredJobTitle: string;
  preferredIndustry: string;
  yearsOfExperience: string;
  expectedSalaryEtb: string;
  preferredEmploymentType: 'Full-time' | 'Part-time' | 'Contract' | 'Internship' | 'Remote' | 'Any';
  preferredWorkLocation: string;
  skills: string[];

  // Education & Experience
  education: EducationItem[];
  experience: ExperienceItem[];

  // Documents
  documents: SeekerDocument[];

  // Job Preferences
  jobPreferences: {
    fullTime: boolean;
    partTime: boolean;
    contract: boolean;
    internship: boolean;
    remote: boolean;
    freshGraduate: boolean;
  };

  savedJobIds?: string[];
  profileCompletionPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'interview'
  | 'rejected'
  | 'accepted';

export interface UserJobApplication {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone: string;
  vacancyId: string;
  vacancyTitle: string;
  organization: string;
  location: string;
  category: string;
  resumeUrl?: string;
  resumeName?: string;
  coverLetter?: string;
  status: ApplicationStatus;
  statusNotes?: string;
  statusTimeline: Array<{
    status: ApplicationStatus;
    timestamp: string;
    note?: string;
  }>;
  appliedAt: string;
  updatedAt: string;
}

export function calculateProfileCompletion(profile: Partial<JobSeekerProfile>): number {
  let score = 0;
  const weights = {
    fullName: 10,
    email: 10,
    phone: 10,
    locationCity: 10,
    desiredJobTitle: 10,
    skills: 10,
    education: 15,
    experience: 15,
    documents: 10,
  };

  if (profile.fullName && profile.fullName.trim().length > 2) score += weights.fullName;
  if (profile.email && profile.email.includes('@')) score += weights.email;
  if (profile.phone && profile.phone.trim().length > 5) score += weights.phone;
  if (profile.locationCity && profile.locationCity.trim().length > 1) score += weights.locationCity;
  if (profile.desiredJobTitle && profile.desiredJobTitle.trim().length > 2) score += weights.desiredJobTitle;
  if (profile.skills && profile.skills.length > 0) score += weights.skills;
  if (profile.education && profile.education.length > 0) score += weights.education;
  if (profile.experience && profile.experience.length > 0) score += weights.experience;
  if (profile.documents && profile.documents.length > 0) score += weights.documents;

  return Math.min(100, Math.max(10, score));
}

export const DEFAULT_JOB_SEEKER_PROFILE: JobSeekerProfile = {
  uid: '',
  email: '',
  fullName: '',
  phone: '',
  locationCity: 'Addis Ababa',
  locationRegion: 'Addis Ababa',
  employmentStatus: 'unemployed',
  desiredJobTitle: '',
  preferredIndustry: 'Banking and Financial Institutions',
  yearsOfExperience: '0-1 Years (Entry Level)',
  expectedSalaryEtb: '',
  preferredEmploymentType: 'Full-time',
  preferredWorkLocation: 'Addis Ababa',
  skills: ['Communication', 'Microsoft Office', 'Teamwork'],
  education: [],
  experience: [],
  documents: [],
  jobPreferences: {
    fullTime: true,
    partTime: false,
    contract: false,
    internship: false,
    remote: false,
    freshGraduate: true,
  },
  profileCompletionPercentage: 20,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
