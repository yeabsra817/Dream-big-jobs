export type InternationalRegion =
  | 'Europe'
  | 'Middle East'
  | 'Far East & Asia'
  | 'Americas & Oceania'
  | 'Africa & Other';

export type VerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'SUSPENDED_BROKEN_LINK'
  | 'EXPIRED'
  | 'REJECTED_SUSPICIOUS';

export type VisaFeePolicy =
  | 'employer_paid'
  | 'free_recruitment_applicant_pays_gov_fee'
  | 'fee_waived_official'
  | 'not_stated';

export type SourceAuthorityType =
  | 'government_portal'
  | 'immigration_ministry'
  | 'embassy'
  | 'official_employer'
  | 'official_university'
  | 'scholarship_body'
  | 'international_org'
  | 'unverified';

export type TelegramDistributionMode =
  | 'all_jobs'
  | 'banking_only'
  | 'ngo_only'
  | 'banking_and_ngo_only';

export type ResearchFrequency = 'manual' | 'daily' | 'weekly';

export type PublicationLifecycleStatus =
  | 'Discovered'
  | 'Awaiting Official Verification'
  | 'Verified'
  | 'Published on Website'
  | 'Published on Telegram'
  | 'Publication Failed'
  | 'Expired'
  | 'Withdrawn';

export type PrivateApprovalStatus =
  | 'private_pending'
  | 'approved_public'
  | 'rejected'
  | 'expired';

export interface SchedulerStatusState {
  enabled: boolean;
  isRunning: boolean;
  isCycleActive: boolean;
  intervalSeconds: number;
  cycleCount: number;
  startedAt: string;
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  aiProviderStatus: string;
  aiModel: string;
  sourcesTotal: number;
  sourcesHealthy: number;
  sourcesFailed: number;
  recentDiscoveredCount: number;
  lastCycleSummary: string;
}

/**
 * 19-Field Official International Workforce Opportunity Record
 * Follows strict Anti-Fabrication rules: missing salary/details must explicitly be
 * "NOT STATED IN THE OFFICIAL ANNOUNCEMENT".
 */
export interface InternationalJob {
  id: string;
  region: InternationalRegion;
  category: string;
  // 19 required fields:
  country: string;
  employerOrProgramme: string;
  jobTitle: string;
  location: string;
  requiredEducation: string;
  requiredExperience: string;
  languageRequirements: string;
  salary: string;
  foreignerAndEthiopianEligibility: string;
  ethiopiansEligible: 'yes' | 'conditional' | 'no' | 'unconfirmed';
  visaSponsorshipInfo: string;
  visaSponsored: boolean;
  whoPaysVisaAndRecruitmentCosts: string;
  visaFeePolicy: VisaFeePolicy;
  noRecruitmentAgencyFee: boolean;
  accommodationAndRelocationSupport: string;
  contractDuration: string;
  applicationDeadline: string;
  requiredDocuments: string[];
  officialApplicationInstructions: string;
  directApplicationUrl: string;
  originalSourceUrl: string;
  lastVerifiedAt: string;
  // Additional pathway & audit fields:
  familyReunification: string;
  permanentResidencePathway: string;
  verificationStatus: VerificationStatus;
  verificationNotes: string;
  sourceAuthorityType: SourceAuthorityType;
  lastCheckedHttpStatus?: number;
  applicationStatus: 'open' | 'closed' | 'expired' | 'unverified';
  publicationLifecycleStatus?: PublicationLifecycleStatus;
  approvalStatus?: PrivateApprovalStatus;
  discoveredAt?: string;
  verifiedAt?: string;
  aiAnalysisNotes?: string;
  sourceName?: string;
  detectedAt?: string;
  publishedOnWebsiteAt?: string;
  isSuspicious?: boolean;
  suspiciousReason?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * International Legal Immigration & Permanent Residence Pathway Record
 * Strictly separates temporary work permits from permanent residence & citizenship routes.
 */
export interface ImmigrationPathway {
  id: string;
  country: string;
  region: InternationalRegion;
  pathwayTitle: string;
  pathwayType:
    | 'Work-Based Residence Permit'
    | 'Permanent Residence'
    | 'Long-Term Residence'
    | 'Skilled Worker Immigration'
    | 'Employer-Sponsored Immigration'
    | 'Job-Seeker Visa'
    | 'Family Reunification'
    | 'Citizenship Track';
  ethiopianCitizenEligibility: 'eligible' | 'conditional' | 'no_confirmed_route' | 'unverified';
  ethiopianEligibilityDetails: string;
  eligibilityRequirements: string;
  requiredEducationAndExperience: string;
  minimumIncomeOrFinancialRequirement: string;
  languageRequirements: string;
  requiredDocuments: string[];
  governmentApplicationFees: string;
  processingTimeline: string;
  jobOfferRequired: 'yes' | 'no' | 'conditional' | 'not_stated';
  yearsToPermanentResidence: string;
  temporaryVsPermanentClarification: string;
  familyReunificationRules: string;
  citizenshipPathwayNotes: string;
  officialGovernmentWebsite: string;
  exactApplicationSteps: string[];
  originalSourceUrl: string;
  lastVerifiedAt: string;
  verificationStatus: VerificationStatus;
  verificationNotes: string;
  sourceAuthorityType: SourceAuthorityType;
  lastCheckedHttpStatus?: number;
  applicationStatus: 'open' | 'paused' | 'closed' | 'unverified';
  publicationLifecycleStatus?: PublicationLifecycleStatus;
  approvalStatus?: PrivateApprovalStatus;
  discoveredAt?: string;
  verifiedAt?: string;
  aiAnalysisNotes?: string;
  sourceName?: string;
  detectedAt?: string;
  publishedOnWebsiteAt?: string;
  isSuspicious?: boolean;
  suspiciousReason?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 14-Field Experience-Based International Scholarship Record
 * Never claims low GPA / no recommendation letter unless officially confirmed.
 */
export interface ExperienceScholarship {
  id: string;
  region: InternationalRegion;
  studyLevel:
    | 'Undergraduate'
    | 'Postgraduate / Master'
    | 'Leadership & Executive'
    | 'Professional Development'
    | 'Short Course'
    | 'PhD / Research';
  // 14 required fields:
  universityOrInstitution: string;
  country: string;
  scholarshipName: string;
  studyProgramme: string;
  eligibilityForEthiopians: string;
  ethiopiansEligible: 'yes' | 'conditional' | 'no' | 'unconfirmed';
  academicRequirements: string;
  gpaRequirement: string;
  noHighGpaConfirmed: boolean;
  recommendationLetterRequirement: string;
  noRecommendationLetterConfirmed: boolean;
  professionalExperienceCompensates: 'confirmed_yes' | 'considered' | 'no' | 'not_stated';
  experienceCompensationNotes: string;
  requiredDocuments: string[];
  fundingCoverage: string;
  coversTuition: boolean;
  coversAccommodation: boolean;
  coversLivingAllowance: boolean;
  coversTravel: boolean;
  applicationDeadline: string;
  officialApplicationUrl: string;
  exactApplicationProcedure: string[];
  // Verification & audit fields:
  originalSourceUrl: string;
  lastVerifiedAt: string;
  verificationStatus: VerificationStatus;
  verificationNotes: string;
  sourceAuthorityType: SourceAuthorityType;
  lastCheckedHttpStatus?: number;
  applicationStatus: 'open' | 'closed' | 'expired' | 'unverified';
  publicationLifecycleStatus?: PublicationLifecycleStatus;
  approvalStatus?: PrivateApprovalStatus;
  discoveredAt?: string;
  verifiedAt?: string;
  aiAnalysisNotes?: string;
  sourceName?: string;
  detectedAt?: string;
  publishedOnWebsiteAt?: string;
  isSuspicious?: boolean;
  suspiciousReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchHistoryRun {
  id: string;
  runType:
    | 'international_jobs'
    | 'immigration_pr'
    | 'scholarships'
    | 'source_verification'
    | 'expired_cleanup';
  triggeredBy: string;
  startedAt: string;
  completedAt: string;
  regionsResearched: string[];
  countriesResearched: string[];
  discoveredCount: number;
  verifiedCount: number;
  unverifiedCount: number;
  rejectedCount: number;
  duplicatesSkipped: number;
  summary: string;
  status: 'completed' | 'partial' | 'failed';
}

export interface VerificationReportItem {
  id: string;
  entityType: 'international_job' | 'immigration' | 'scholarship' | 'domestic_vacancy';
  entityId: string;
  title: string;
  countryOrOrg: string;
  url: string;
  verificationStatus: VerificationStatus;
  httpStatus?: number;
  reason: string;
  checkedAt: string;
}

export type EligibilityClassification =
  | 'Eligible'
  | 'Potentially eligible; more information required'
  | 'Not eligible';

export interface MonitoredSourceRecord {
  id: string;
  name: string;
  country: string;
  region: InternationalRegion;
  entityType: 'international_job' | 'immigration' | 'scholarship';
  url: string;
  feedType: 'rss_atom' | 'official_api' | 'http_poll';
  pollIntervalSeconds: number;
  enabled: boolean;
  lastSuccessfulCheck?: string;
  lastCheckedAt?: string;
  nextScheduledCheck?: string;
  newAnnouncementsDetected: number;
  failedChecks: number;
  verificationStatus: 'HEALTHY' | 'PENDING' | 'FAILED';
  lastError?: string;
  authorityType?: SourceAuthorityType;
}

export interface DeveloperNotificationItem {
  id: string;
  notificationType:
    | 'new_immigration_pr'
    | 'new_work_visa'
    | 'new_scholarship'
    | 'publication_failed'
    | 'source_failure';
  country: string;
  programmeOrOpportunityName: string;
  whatChangedOrAnnounced: string;
  ethiopianEligibility: string;
  eligibilityRequirements: string;
  requiredDocuments: string[];
  governmentFees: string;
  deadline: string;
  exactOfficialApplicationLink: string;
  originalSourceUrl: string;
  detectedAt: string;
  verifiedAt?: string;
  read: boolean;
  severity: 'info' | 'warning' | 'critical';
}

export interface TelegramRetryItem {
  id: string;
  vacancyId: string;
  title: string;
  organization: string;
  channelName: string;
  distributionMode: TelegramDistributionMode;
  isWashNgo: boolean;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string;
  lastAttemptAt: string;
  lastError: string;
  status: 'Publication Failed' | 'Retrying' | 'Published on Telegram' | 'Exhausted';
  vacancySnapshot: Record<string, any>;
  telegramMessageId?: number;
}

export interface PrivateAssistantOpportunityEvaluation {
  opportunityId: string;
  opportunityType: 'domestic_job' | 'international_job' | 'immigration_pathway' | 'scholarship';
  title: string;
  organizationOrInstitution: string;
  countryOrLocation: string;
  classification: EligibilityClassification;
  officialUrl: string;
  deadline: string;
  strengthsMatched: string[];
  gapsOrUnverifiedInfo: string[];
  requiredDocumentsChecklist: string[];
  stepByStepInstructions: string[];
  tailoredCvDraft?: string;
  tailoredCoverLetterDraft?: string;
  lastEvaluatedAt: string;
}

export const RESEARCH_REGIONS: Array<{
  region: InternationalRegion;
  label: string;
  countries: string[];
}> = [
  {
    region: 'Europe',
    label: 'Europe (Baltics, CEE, Nordics, Western Europe, Balkans & Caucasus)',
    countries: [
      'Germany',
      'Finland',
      'Sweden',
      'Norway',
      'Denmark',
      'Estonia',
      'Latvia',
      'Lithuania',
      'Poland',
      'Romania',
      'Bulgaria',
      'Croatia',
      'Serbia',
      'Georgia',
      'Netherlands',
      'Ireland',
      'Austria',
      'Czechia',
      'Portugal',
      'United Kingdom',
    ],
  },
  {
    region: 'Middle East',
    label: 'Middle East & Gulf Cooperation Council',
    countries: [
      'Saudi Arabia',
      'United Arab Emirates',
      'Qatar',
      'Kuwait',
      'Bahrain',
      'Oman',
      'Jordan',
    ],
  },
  {
    region: 'Far East & Asia',
    label: 'Far East & Asia-Pacific',
    countries: [
      'South Korea',
      'Japan',
      'China',
      'Singapore',
      'Malaysia',
      'Taiwan',
      'Hong Kong',
    ],
  },
  {
    region: 'Americas & Oceania',
    label: 'North America & Oceania',
    countries: ['Canada', 'Australia', 'New Zealand', 'United States'],
  },
  {
    region: 'Africa & Other',
    label: 'Pan-African & Global International Organizations',
    countries: ['Ethiopia (UN / Diplomatic)', 'Kenya', 'Rwanda', 'South Africa', 'Switzerland (UN / IO)'],
  },
];

export const INTERNATIONAL_JOB_CATEGORIES = [
  'Banking & Finance',
  'NGO & International Organizations',
  'Government Approved Foreign Recruitment',
  'IT & Software Engineering',
  'Healthcare & Medical',
  'Engineering & Skilled Trades',
  'Hospitality & Logistics',
  'Education & Academic',
  'Agriculture & Manufacturing',
];

export const OFFICIAL_NOT_STATED = 'NOT STATED IN THE OFFICIAL ANNOUNCEMENT';
