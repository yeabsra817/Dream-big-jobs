export type BranchManagerRegionScope =
  | 'Scandinavian'
  | 'Europe'
  | 'Middle East'
  | 'Africa (International Banks & Companies)';

export const ALLOWED_BRANCH_MANAGER_REGIONS: BranchManagerRegionScope[] = [
  'Scandinavian',
  'Europe',
  'Middle East',
  'Africa (International Banks & Companies)',
];

export const TARGET_BRANCH_MANAGER_POSITIONS: string[] = [
  'Branch Manager',
  'Banking Operations Manager',
  'Finance Manager',
  'Finance and Administration Manager',
  'Financial Controller',
  'Credit Manager',
  'Relationship Manager',
  'SME Banking Manager',
  'Financial Operations Manager',
  'Microfinance Operations Manager',
  'Credit Operations Manager',
  'Compliance Manager',
  'Risk Manager',
  'Internal Control Manager',
  'AML/KYC Manager',
  'Digital Banking Operations Manager',
  'Payment Operations Manager',
  'Grants Finance Manager',
  'Project Finance Manager',
];

export interface BranchManagerProfileInput {
  profileLabel: string;
  nationality: string;
  currentResidence: string;
  educationDegree: string;
  fieldOfStudy: string;
  institution: string;
  graduationYear: string;
  totalBankingYears: number;
  branchManagerYears: number;
  currentOrRecentPosition: string;
  employers: string[];
  coreSkills: string[];
  targetPositions: string[];
  languages: string[];
  hasMastersDegree: boolean;
  hasEnglishTest: boolean;
  minimumMonthlyGrossUsd: number;
}

/**
 * Clean general default for guests and non-owner users.
 * NEVER pre-fills the site owner's personal credentials or employment history.
 */
export const DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE: BranchManagerProfileInput = {
  profileLabel: 'My Senior Banking & Finance Profile',
  nationality: 'Ethiopian',
  currentResidence: 'Ethiopia',
  educationDegree: "Bachelor's Degree",
  fieldOfStudy: 'Accounting and Finance',
  institution: '',
  graduationYear: '',
  totalBankingYears: 5,
  branchManagerYears: 2,
  currentOrRecentPosition: 'Banking & Finance Manager',
  employers: [],
  coreSkills: [
    'Banking operations',
    'Branch management',
    'Accounting',
    'Financial management',
    'Credit operations',
    'Risk and internal controls',
    'Customer relationship management',
    'Staff supervision',
  ],
  targetPositions: [...TARGET_BRANCH_MANAGER_POSITIONS],
  languages: ['English'],
  hasMastersDegree: false,
  hasEnglishTest: false,
  minimumMonthlyGrossUsd: 3000,
};

export interface VerifiedBranchManagerJob {
  id: string;
  jobTitle: string;
  employerName: string;
  employerTypeLabel: string;
  country: string;
  city: string;
  regionScope: BranchManagerRegionScope;
  grossMonthlySalaryUsd: number;
  grossAnnualSalaryUsd: number;
  originalSalaryDisplay: string;
  usdEquivalentDisplay: string;
  exchangeRateUsed: string;
  visaSponsorshipEvidence: string;
  sponsorshipStrengthScore: number;
  ethiopianEligibilityConfirmation: string;
  requiredEducation: string;
  requiredExperience: string;
  languageRequirements: string;
  jobResponsibilities: string[];
  relocationSupport: string;
  familyRelocationPossibilities: string;
  hasConfirmedRelocation: boolean;
  hasConfirmedFamilySupport: boolean;
  applicationDeadline: string;
  datePosted: string;
  officialApplicationUrl: string;
  sourcePortal: string;
  profileMatchPercentage: number;
  whyYouQualify: string[];
  gapsOrUnmetRequirements: string[];
  matchedTargetPosition: string;
  employerReputationScore: number;
  rankingScore: number;
}

export interface StrictGateAuditSummary {
  totalCandidatesScanned: number;
  passedAllSixGates: number;
  excludedUndisclosedSalary: number;
  excludedBelow3000Usd: number;
  excludedUnconfirmedVisaSponsorship: number;
  excludedOutsideAllowedRegions: number;
  excludedLocalAfricanNonInternational: number;
  excludedNonMatchingRole: number;
  excludedEthiopianIneligible: number;
  excludedExpiredOrDuplicate: number;
  sourcesChecked: string[];
  fxRatesUpdatedAt: string;
  fxSourceNote: string;
}

export interface BranchManagerJobsSearchResponse {
  success: boolean;
  generatedAt: string;
  lastDiscoveryAt: string;
  allowedRegions: BranchManagerRegionScope[];
  profileUsed: BranchManagerProfileInput;
  isOwnerAccountProfile: boolean;
  audit: StrictGateAuditSummary;
  jobs: VerifiedBranchManagerJob[];
}
