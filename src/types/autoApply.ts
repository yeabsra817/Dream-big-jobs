export interface PersonalProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  totalBankingExperienceYears: number;
  branchManagerExperienceYears: number;
  currentPosition: string;
  currentEmployer: string;
  previousEmployers: string[];
  degree: string;
  university: string;
  graduationYear: number;
  preferredLocation: string;
  allowOtherEthiopianLocations: boolean;
  targetPositions: string[];
  targetOrganizations: string[];
  mode: 'review' | 'auto';
  isAutoApplyActive: boolean;
  automationSchedule: '6_hours' | '12_hours' | '24_hours';
  lastRunTimestamp?: string;
  gmailConnected: boolean;
  gmailAccountEmail: string | null;
  gmailAuthorizedAt?: string;
  updatedAt: string;
}

export interface PersonalDocument {
  id: string;
  title: string;
  type: 'cv' | 'cover_letter' | 'degree_certificate' | 'experience_letter' | 'recommendation' | 'training_cert' | 'other';
  fileName: string;
  fileSize: number;
  mimeType?: string;
  extractedText: string;
  approved: boolean;
  uploadedAt: string;
  issuerOrOrg?: string;
}

export interface MatchAnalysis {
  score: number;
  category: 'excellent' | 'good' | 'possible' | 'not_recommended';
  rationale: string;
  strengths: string[];
  transferableSkills: string[];
  missingRequirements: string[];
  isEmailOnlyApplicable: boolean;
  recruitmentEmail: string | null;
  requiredDocuments: string[];
  mandatoryRequirementsMet: boolean;
}

export type ApplicationStatus =
  | 'DRAFT'
  | 'READY FOR REVIEW'
  | 'APPROVED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'MISSING DOCUMENTS'
  | 'NOT ELIGIBLE'
  | 'DUPLICATE';

export interface ApplicationRecord {
  id: string;
  vacancyId: string;
  jobTitle: string;
  organization: string;
  location: string;
  publicationDate?: string;
  deadline?: string;
  recruitmentEmail: string;
  matchScore: number;
  matchCategory: 'excellent' | 'good' | 'possible' | 'not_recommended';
  matchAnalysis: MatchAnalysis;
  tailoredCvText: string;
  tailoredCoverLetterText: string;
  emailSubject: string;
  emailBody: string;
  attachedDocumentIds: string[];
  attachedDocumentNames: string[];
  status: ApplicationStatus;
  gmailMessageId?: string;
  gmailSentAt?: string;
  sendError?: string;
  isTestEmail?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}
