export type EligibilityClassification =
  | 'HIGHLY SUITABLE'
  | 'POTENTIALLY SUITABLE'
  | 'NOT ELIGIBLE';

export type ApplyFromEthiopiaStatus = 'Yes' | 'Verify' | 'No';

export type RequirementPresence = 'Yes' | 'No' | 'Verify';

export type ApplicationTrackerStage =
  | 'Researching'
  | 'Preparing Documents'
  | 'Applied'
  | 'Interview'
  | 'Offer'
  | 'Closed';

export interface MigrationProfileInput {
  profileLabel?: string;
  nationality: string;
  currentResidence: string;
  highestEducation: string;
  fieldOfStudy: string;
  graduationYear?: string;
  totalExperienceYears: number;
  managementExperienceYears: number;
  currentOrRecentRole: string;
  hasMastersDegree: boolean;
  hasEnglishTest: boolean;
  englishTestDetails?: string;
  otherLanguages?: string;
  maxUpfrontBudgetUsd: number;
  coreSkills: string[];
  targetSectors: string[];
  familyRelocationNeeded: boolean;
  willingToRelocateInitiallyAlone: boolean;
}

export interface CostAffordabilitySummary {
  applicationFeeStatus: 'Free application' | 'Government application fee' | 'Check official portal';
  whoPaysSummary: string;
  employerPaidRelocation: boolean;
  governmentFunded: boolean;
  applicantPaidCosts: string;
  proofOfFundsRequired: boolean;
  proofOfFundsDetails: string;
  withinUserBudget: 'Yes' | 'Verify' | 'No';
  budgetNote: string;
}

export interface EvaluatedMigrationOpportunity {
  id: string;
  title: string;
  employerOrInstitution: string;
  country: string;
  region: string;
  sector: string;
  category: string;
  salaryOrFunding: string;
  nationalityEligibility: string;
  educationRequirement: string;
  experienceRequirement: string;
  languageRequirement: string;
  visaOrImmigrationRoute: string;
  costBreakdown: CostAffordabilitySummary;
  familyRelocationOptions: string;
  deadline: string;
  deadlineDisplay: string;
  daysRemaining: number | null;
  eligibilityClassification: EligibilityClassification;
  suitabilityScore: number;
  suitabilityExplanation: string;
  confirmationNeededItems: string[];
  officialSource: string;
  sourceDomain: string;
  directOfficialLink: string;
  canApplyFromEthiopia: ApplyFromEthiopiaStatus;
  matchesUserProfile: boolean;
  isWashOpportunity: boolean;
  isScholarshipOrTraining: boolean;
  valuesExperienceOverGpa: boolean;
  isInSelectedCountry: boolean;
  isInRecommendedCountry: boolean;
  mastersRequired: RequirementPresence;
  englishTestRequired: RequirementPresence;
  changeStatus: 'new' | 'updated' | 'unchanged';
  firstSeenAt?: string;
  verifiedAt?: string;
}

export interface CountryRecommendationIntel {
  country: string;
  region: string;
  tier: 'priority_relocation' | 'priority_settlement' | 'recommended_global';
  tierLabel: string;
  isRecommendedByResearch: boolean;
  isSelectedByUser: boolean;
  whyRecommended: string;
  activeOpportunityCount: number;
  highlySuitableCount: number;
  potentiallySuitableCount: number;
  employerFundedCount: number;
  budgetFriendlyCount: number;
  pathwayTypeLabel: string;
  officialPortalUrl: string;
}

export interface OfficialImmigration13PointRecord {
  id: string;
  country: string;
  region: string;
  programName: string;
  officialAuthority: string;
  officialUrl: string;
  shortageListUrl: string;
  pathwayCategory:
    | 'Direct Permanent Residence'
    | 'Temporary Work Visa Leading to PR'
    | 'Temporary Work Visa (No Direct PR)';
  isRecommendedByResearch: boolean;
  isSelectedByUser: boolean;
  whyRecommended: string;
  eligibilityClassification: EligibilityClassification;
  suitabilityNote: string;
  budgetAlert: string;
  withinUserBudget: 'Yes' | 'Verify' | 'No';
  q1_canEthiopianApplyFromEthiopia: string;
  q2_educationRequired: string;
  q3_experienceRequired: string;
  q4_jobOfferNecessary: string;
  q5_languageTestRequired: string;
  q6_financialProofRequired: string;
  q7_officialFees: string;
  q8_whoPaysExpenses: string;
  q9_canRelocateInitiallyAlone: string;
  q10_familyReunificationRules: string;
  q11_leadsToPermanentResidence: string;
  q12_estimatedTimeline: string;
  q13_officialProcedureAndLink: string;
}

export interface ChangeHistoryEvent {
  id: string;
  detectedAt: string;
  summary: string;
  newCount: number;
  updatedCount: number;
  expiredRemovedCount: number;
  totalActiveVerified: number;
  newTitles: string[];
  updatedTitles: string[];
}

export interface UserApplicationTrackerItem {
  opportunityId: string;
  title: string;
  employerOrInstitution: string;
  country: string;
  officialUrl: string;
  stage: ApplicationTrackerStage;
  notes: string;
  updatedAt: string;
}

export interface UserMigrationWorkspace {
  profile: MigrationProfileInput;
  selectedCountries: string[];
  savedOpportunityIds: string[];
  applicationTracker: UserApplicationTrackerItem[];
  updatedAt: string;
}

export interface GlobalMigrationHubEvaluationResponse {
  success: boolean;
  generatedAt: string;
  lastRefreshAt: string;
  nextRefreshAt: string;
  refreshIntervalMinutes: number;
  officialDisclaimer: string;
  summary: {
    totalActiveVerified: number;
    highlySuitableCount: number;
    potentiallySuitableCount: number;
    notEligibleCount: number;
    matchingProfileCount: number;
    nonMatchingCount: number;
    washOpportunitiesCount: number;
    scholarshipsAndTrainingCount: number;
    budgetFriendlyCount: number;
    applyFromEthiopiaCount: number;
    selectedCountryMatchesCount: number;
    newSinceLastCheckCount: number;
    updatedSinceLastCheckCount: number;
    countriesTrackedCount: number;
  };
  profileUsed: MigrationProfileInput;
  selectedCountries: string[];
  recommendedCountries: CountryRecommendationIntel[];
  opportunities: EvaluatedMigrationOpportunity[];
  immigrationPathways13Point: OfficialImmigration13PointRecord[];
  changeHistory: ChangeHistoryEvent[];
}

export const DEFAULT_GENERAL_MIGRATION_PROFILE: MigrationProfileInput = {
  profileLabel: 'My International Career Profile',
  nationality: 'Ethiopian',
  currentResidence: 'Ethiopia',
  highestEducation: "Bachelor's Degree",
  fieldOfStudy: '',
  graduationYear: '',
  totalExperienceYears: 3,
  managementExperienceYears: 0,
  currentOrRecentRole: '',
  hasMastersDegree: false,
  hasEnglishTest: false,
  englishTestDetails: 'No IELTS/TOEFL yet',
  otherLanguages: 'Amharic, English (working proficiency)',
  maxUpfrontBudgetUsd: 500,
  coreSkills: [],
  targetSectors: ['Banking & Finance', 'Accounting & Audit', 'International Organizations'],
  familyRelocationNeeded: false,
  willingToRelocateInitiallyAlone: true,
};

/**
 * Optional one-click preset template matching a 9-year Ethiopian Banking Branch Manager profile
 * with BA in Accounting & Finance and <$500 upfront budget.
 * Never pre-loaded as another user's private data unless explicitly chosen by the user.
 */
export const BENCHMARK_BANKING_MANAGER_PRESET: MigrationProfileInput = {
  profileLabel: 'Banking Branch Manager Profile (9 yrs, BA Accounting & Finance, <$500 Budget)',
  nationality: 'Ethiopian',
  currentResidence: 'Ethiopia',
  highestEducation: "Bachelor's Degree (BA)",
  fieldOfStudy: 'Accounting and Finance',
  graduationYear: '2016',
  totalExperienceYears: 9,
  managementExperienceYears: 3,
  currentOrRecentRole: 'Branch Manager (Commercial Banking)',
  hasMastersDegree: false,
  hasEnglishTest: false,
  englishTestDetails: 'No IELTS or TOEFL yet',
  otherLanguages: 'Amharic, English (professional working)',
  maxUpfrontBudgetUsd: 500,
  coreSkills: [
    'Branch management',
    'Banking operations',
    'Accounting and financial management',
    'Customer relationship management',
    'Deposit mobilization',
    'Credit and loan administration',
    'Staff supervision and performance management',
    'Financial reporting and internal controls',
    'Digital financial services',
  ],
  targetSectors: [
    'Banking & Finance',
    'Microfinance & Financial Inclusion',
    'Risk, Compliance & AML',
    'Accounting & Audit',
    'Fintech & Digital Banking',
    'Development Banks & NGOs',
  ],
  familyRelocationNeeded: true,
  willingToRelocateInitiallyAlone: true,
};
