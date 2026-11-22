export type GlobalOpportunityCategory =
  | 'international_job'
  | 'university_scholarship'
  | 'professional_training'
  | 'conference_summit'
  | 'wash_opportunity';

export type GlobalOpportunitySubsection =
  | 'international_jobs'
  | 'scholarships'
  | 'professional_training'
  | 'conferences_summits'
  | 'banking_finance'
  | 'wash_opportunities'
  | 'recommended'
  | 'closing_soon'
  | 'saved';

export type GlobalVerificationStatus =
  | 'Verified and Open'
  | 'Fully Funded'
  | 'Partially Funded'
  | 'Visa Sponsored'
  | 'Funding Not Confirmed'
  | 'Eligibility Not Confirmed'
  | 'Closing Soon'
  | 'Expired'
  | 'Unverified';

export type FundingTransparencyCategory =
  | 'Fully funded'
  | 'Tuition funded'
  | 'Travel funded'
  | 'Accommodation funded'
  | 'Visa fees funded'
  | 'Employer-sponsored visa'
  | 'Visa application assistance only'
  | 'Self-funded'
  | 'Funding Not Confirmed';

export type RequirementBooleanStatus = 'required' | 'not_required' | 'optional' | 'not_confirmed';

export type ApplicationLifecycleStatus = 'open' | 'closing_soon' | 'closed' | 'expired' | 'withdrawn' | 'unverified';

export type SectorTag =
  | 'banking_finance'
  | 'wash'
  | 'technology_ai'
  | 'international_development'
  | 'humanitarian'
  | 'engineering'
  | 'healthcare_public_health'
  | 'climate_environment'
  | 'entrepreneurship_business'
  | 'leadership_management'
  | 'academic_research';

export interface OpportunityFundingRecord {
  id: string;
  opportunityId: string;
  fundingLevel: 'fully_funded' | 'partially_funded' | 'self_funded' | 'not_confirmed';
  fundingSummary: string;
  transparencyTags: FundingTransparencyCategory[];
  tuitionCovered: 'yes' | 'partial' | 'no' | 'not_confirmed';
  airfareCovered: 'yes' | 'partial' | 'no' | 'not_confirmed';
  accommodationCovered: 'yes' | 'partial' | 'no' | 'not_confirmed';
  visaSupportType:
    | 'employer_sponsored_visa'
    | 'visa_fees_funded'
    | 'visa_assistance_only'
    | 'invitation_letter_only'
    | 'none'
    | 'not_confirmed';
  visaSupportSummary: string;
  relocationAssistance: 'yes' | 'partial' | 'no' | 'not_confirmed';
  applicationFee: string; // e.g., "None (Free)", "$50 USD", "Not Confirmed"
  stipendOrSalary?: string;
  evidenceExcerpt?: string;
  verifiedAt: string;
}

export interface OpportunityEligibilityRecord {
  id: string;
  opportunityId: string;
  eligibleNationalities: string[]; // e.g., ["Ethiopian citizens", "All nationalities", "Developing countries"]
  ethiopianEligible: 'confirmed' | 'likely_global' | 'not_confirmed' | 'excluded';
  educationRequirement: string;
  minimumEducationLevel: 'none' | 'diploma' | 'bachelors' | 'masters' | 'phd' | 'not_confirmed';
  experienceRequirement: string;
  minimumYearsExperience: number | null;
  careerLevel: 'entry' | 'mid' | 'senior' | 'technical' | 'management' | 'internship' | 'fellowship' | 'all_levels' | 'not_confirmed';
  requiredSkills: string[];
  languagesRequired: string[];
  universityRecommendationRequired: RequirementBooleanStatus;
  companyRecommendationRequired: RequirementBooleanStatus;
  institutionalNominationRequired: RequirementBooleanStatus;
  directIndividualApplicationAllowed: 'yes' | 'no' | 'not_confirmed';
  verifiedAt: string;
}

export interface OpportunityDeadlineRecord {
  id: string;
  opportunityId: string;
  deadlineDateRaw: string;
  deadlineUtcIso: string | null;
  deadlineTimezone: string; // IANA timezone e.g. 'UTC', 'Africa/Addis_Ababa', 'Europe/Geneva'
  fullDaysRemaining: number;
  hoursRemaining: number;
  meetsMinimumThreeFullDays: boolean;
  isClosingSoon: boolean; // 3..7 full days remaining
  isExpired: boolean;
  startDate: string; // Official start date or "Not Confirmed"
  lastCheckedAt: string;
}

export interface GlobalOpportunity {
  id: string;
  fingerprint: string;
  title: string;
  organization: string;
  organizationType:
    | 'un_agency'
    | 'multilateral_bank'
    | 'international_ngo'
    | 'university'
    | 'government_agency'
    | 'financial_institution'
    | 'conference_organizer'
    | 'employer'
    | 'other';
  category: GlobalOpportunityCategory;
  sectors: SectorTag[];
  isWashDedicated: boolean;
  isBankingFinance: boolean;
  country: string;
  location: string;
  summary: string;

  // Source & Official Link Verification (Fields 1-3)
  organizationAuthentic: boolean;
  sourceId: string;
  sourceName: string;
  originalSourceUrl: string;
  officialApplicationUrl: string;
  officialDomain: string;

  // Status & Verification Badges (Fields 4-5, 20)
  applicationStatus: ApplicationLifecycleStatus;
  verificationStatus: GlobalVerificationStatus;
  hasVerifiedBadge: boolean;
  httpStatusCode: number | null;
  robotsAllowed: boolean;
  verificationNotes: string;
  sourceEvidenceSnippet: string;

  // Embedded Normalized Structured Sub-Records (Fields 6-19)
  funding: OpportunityFundingRecord;
  eligibility: OpportunityEligibilityRecord;
  deadline: OpportunityDeadlineRecord;

  // Timestamps
  discoveredAt: string;
  lastVerifiedAt: string;
  updatedAt: string;
}

export interface MonitoredPortalCheck {
  name: string;
  url: string;
  organizationGroup: string;
  httpStatus: number | null;
  robotsAllowed: boolean;
  itemsFound: number;
  checkedAt: string;
}

export interface OpportunitySourceRecord {
  id: string;
  name: string;
  providerType:
    | 'official_api'
    | 'direct_website_monitor'
    | 'gemini_search_grounding'
    | 'tavily_search_api'
    | 'brave_search_api'
    | 'official_portal';
  organizationGroup: string;
  baseUrl: string;
  categoriesCovered: GlobalOpportunityCategory[];
  sectorsCovered: SectorTag[];
  configured: boolean;
  requiresCredentials: boolean;
  isOptional?: boolean;
  pricingNote?: string;
  disabledByConfig?: boolean;
  requiredEnvVars: string[];
  status: 'connected' | 'optional_unconfigured' | 'disabled' | 'requires_credentials' | 'degraded' | 'error';
  lastPolledAt: string | null;
  lastSuccessAt: string | null;
  lastItemCount: number;
  lastError: string | null;
  monitoredPortals?: MonitoredPortalCheck[];
}

export interface OpportunityVerificationLogRecord {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  organization: string;
  officialUrl: string;
  httpStatus: number | null;
  robotsAllowed: boolean;
  passedUrlVerification: boolean;
  passedDeadlineRule: boolean;
  fullDaysRemaining: number | null;
  resultingStatus: GlobalVerificationStatus;
  checkedFieldsCount: number;
  notes: string;
  checkedAt: string;
}

export interface UserSavedOpportunityRecord {
  id: string;
  userId: string;
  opportunityId: string;
  title: string;
  organization: string;
  category: GlobalOpportunityCategory;
  country: string;
  deadlineUtcIso: string | null;
  officialApplicationUrl: string;
  savedAt: string;
}

export interface UserOpportunityRecommendationRecord {
  id: string;
  userId: string;
  opportunityId: string;
  matchScore: number; // 0..100
  eligible: boolean;
  matchReasons: string[];
  eligibilitySummary: string;
  matchedSectors: string[];
  disqualificationReasons: string[];
  generatedAt: string;
}

export interface DiscoveryJobLogRecord {
  id: string;
  trigger:
    | 'vercel_cron'
    | 'github_actions_cron'
    | 'ethiopia_6h_schedule'
    | 'server_interval'
    | 'manual_admin'
    | 'startup_recheck';
  jobType: 'full_discovery' | 'deadline_and_link_recheck';
  status: 'success' | 'partial' | 'failed';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  sourcesQueried: number;
  candidatesDiscovered: number;
  duplicatesSkipped: number;
  verifiedAndActiveCount: number;
  savedCount?: number;
  recommendationsUpdatedCount?: number;
  rejectedUnderThreeDaysCount: number;
  rejectedBrokenOrClosedCount: number;
  expiredPurgedCount: number;
  scheduledSlotEat?: string;
  attemptNumber?: number;
  maxAttempts?: number;
  skippedOverlap?: boolean;
  errors: string[];
}

export interface GlobalOpportunityWithMatch extends GlobalOpportunity {
  recommendation?: UserOpportunityRecommendationRecord;
  isSaved?: boolean;
}

export interface SchedulerFailureAlert {
  active: boolean;
  severity: 'warning' | 'error';
  message: string;
  errors: string[];
  failedAt: string;
  failedAtEat: string;
  consecutiveFailures: number;
  nextAutoRetryAt: string | null;
  acknowledgedAt: string | null;
}

export interface SchedulerPersistentState {
  lastSuccessfulRunAt: string | null;
  lastSuccessfulRunAtEat: string | null;
  lastFailedRunAt: string | null;
  lastRecoveredAt: string | null;
  consecutiveFailures: number;
  totalScheduledRuns: number;
  activeRunLock: {
    runId: string;
    trigger: string;
    startedAt: string;
    expiresAt: string;
  } | null;
  adminFailureAlert: SchedulerFailureAlert | null;
}

export interface AutonomousSchedulerInfo {
  enabled: boolean;
  intervalMinutes: number;
  timezone: 'Africa/Addis_Ababa';
  scheduleHoursEat: string[];
  cronExpressionUtc: string;
  operatesWithoutVisitors: boolean;
  runtimeMode: 'persistent_node_server' | 'vercel_serverless';
  activeProviders: string[];
  connectedSourcesCount: number;
  totalSourcesCount: number;
  nextScheduledRunAt: string | null;
  nextScheduledRunAtEat: string | null;
  nextScheduledSlotLabel: string | null;
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastSuccessfulRunAtEat: string | null;
  consecutiveFailures: number;
  isRunningNow: boolean;
  adminFailureAlert: SchedulerFailureAlert | null;
}

export interface GlobalOpportunitiesApiResponse {
  success: boolean;
  generatedAt: string;
  minimumDaysRemainingRule: number;
  totalActiveVerified: number;
  totalStoredAllStatuses: number;
  countsBySubsection: Record<GlobalOpportunitySubsection, number>;
  opportunities: GlobalOpportunityWithMatch[];
  sources: OpportunitySourceRecord[];
  lastDiscoveryRun: DiscoveryJobLogRecord | null;
  schedulerInfo?: AutonomousSchedulerInfo;
  websiteOnlyPolicyNote: string;
}
