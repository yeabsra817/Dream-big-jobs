export type GlobalOpportunityCategory =
  | 'international_job'
  | 'university_scholarship'
  | 'professional_training'
  | 'conference_summit'
  | 'wash_opportunity';

export type GlobalDiscoveryDepartment =
  | 'banking_finance_jobs'
  | 'wash_jobs'
  | 'banking_wash_scholarships'
  | 'banking_wash_training'
  | 'banking_wash_conferences'
  | 'permanent_residency_intelligence';

export type GlobalOpportunitySubsection =
  | 'international_jobs'
  | 'europe_jobs'
  | 'middle_east_jobs'
  | 'management_jobs'
  | 'scholarships'
  | 'professional_training'
  | 'conferences_summits'
  | 'banking_finance'
  | 'wash_opportunities'
  | 'permanent_residency'
  | 'recruiting_countries'
  | 'cv_matching'
  | 'recommended'
  | 'closing_soon'
  | 'saved';

export type CanonicalVerificationTier =
  | 'VERIFIED'
  | 'PARTIALLY VERIFIED'
  | 'PENDING VERIFICATION'
  | 'EXPIRED'
  | 'REJECTED / POTENTIAL SCAM';

export type EmploymentVisaClassification =
  | 'confirmed_visa_sponsorship'
  | 'confirmed_international_recruitment'
  | 'relocation_assistance'
  | 'work_permit_assistance'
  | 'no_sponsorship_stated'
  | 'not_eligible_international';

export type PermanentResidencyPathwayType =
  | 'direct_pr'
  | 'route_to_pr'
  | 'temporary_work_permit';

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

export type ApplicationLifecycleStatus =
  | 'open'
  | 'closing_soon'
  | 'closed'
  | 'expired'
  | 'withdrawn'
  | 'rejected'
  | 'unverified';

export type OpportunityRejectionCategory =
  | 'visa'
  | 'professional_restriction'
  | 'deadline'
  | 'broken_link'
  | 'withdrawn'
  | 'eligibility'
  | 'authenticity';

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
  fundingLevel: 'fully_funded' | 'partially_funded' | 'free' | 'self_funded' | 'not_confirmed';
  fundingSummary: string;
  transparencyTags: FundingTransparencyCategory[];
  tuitionCovered: 'yes' | 'partial' | 'no' | 'not_confirmed';
  airfareCovered: 'yes' | 'partial' | 'no' | 'not_confirmed';
  accommodationCovered: 'yes' | 'partial' | 'no' | 'not_confirmed';
  insuranceCovered?: 'yes' | 'partial' | 'no' | 'not_confirmed';
  livingAllowanceCovered?: 'yes' | 'partial' | 'no' | 'not_confirmed';
  visaSupportType:
    | 'employer_sponsored_visa'
    | 'visa_fees_funded'
    | 'visa_assistance_only'
    | 'invitation_letter_only'
    | 'visa_free_not_sponsorship'
    | 'none'
    | 'not_confirmed';
  employmentVisaClassification?: EmploymentVisaClassification;
  employmentVisaLabel?: string;
  visaSupportSummary: string;
  visaMandatoryRulePassed?: boolean;
  visaRejectionReason?: string | null;
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
  department?: GlobalDiscoveryDepartment;
  applicationStatus: ApplicationLifecycleStatus;
  verificationStatus: GlobalVerificationStatus;
  verificationTier?: CanonicalVerificationTier;
  hasVerifiedBadge: boolean;
  httpStatusCode: number | null;
  robotsAllowed: boolean;
  verificationNotes: string;
  sourceEvidenceSnippet: string;
  publicationDate?: string | null;

  // Embedded Normalized Structured Sub-Records (Fields 6-19)
  funding: OpportunityFundingRecord;
  eligibility: OpportunityEligibilityRecord;
  deadline: OpportunityDeadlineRecord;

  // Soft-Deletion / Archival & Strict Audit Compliance
  isArchived?: boolean;
  wasPreviouslyPublished?: boolean;
  unpublishedAt?: string | null;
  archivedAt?: string | null;
  rejectionCategory?: OpportunityRejectionCategory | null;
  rejectionReason?: string | null;
  visaCompliancePassed?: boolean;
  professionalRestrictionPassed?: boolean;

  // Timestamps
  discoveredAt: string;
  lastVerifiedAt: string;
  updatedAt: string;
}

export interface PermanentResidencyCountryRecord {
  id: string;
  country: string;
  region: 'North America' | 'Oceania' | 'Europe' | 'Asia' | 'Middle East' | 'Africa & Other';
  programName: string;
  pathwayClassification: PermanentResidencyPathwayType;
  pathwayClassificationLabel: string;
  officialAuthority: string;
  officialApplicationUrl: string;
  shortageOccupationListUrl: string;
  officialDomain: string;
  httpStatus: number | null;
  verificationTier: CanonicalVerificationTier;
  sourceEvidenceExcerpt: string;
  professionalOccupationsInDemand: string[];
  labourOccupationsInDemand: string[];
  bankingFinanceOccupations: string[];
  washWaterOccupations: string[];
  foreignApplicantsEligible: boolean;
  ethiopianCitizensEligible: 'confirmed' | 'eligible_general_third_country' | 'verify_embassy';
  ethiopianEligibilityNotes: string;
  educationRequirement: string;
  experienceRequirement: string;
  languageRequirement: string;
  ageRestriction: string;
  skillsAssessmentRequired: string;
  permanentResidencyRoute: string;
  employerSponsorshipOptions: string;
  familyRelocationOptions: string;
  governmentApplicationFees: string;
  // Extended 12-point Immigration Transparency Details (Section 7)
  jobOfferRequired?: string;
  minimumSalaryRequirement?: string;
  financialProofRequirement?: string;
  recruiterOrEmployerRequired?: string;
  estimatedProcessingStages?: string;
  officialDisclaimer: string;
  lastVerifiedAt: string;
}

export interface PermanentResidencyAssessmentResult {
  pathwayId: string;
  country: string;
  programName: string;
  pathwayClassification: PermanentResidencyPathwayType;
  readinessStatus: 'Potentially Eligible — Verify Official Criteria' | 'Partial Fit — Additional Requirements Needed' | 'Not Currently Matched';
  matchedCriteria: string[];
  missingOrUnverifiedCriteria: string[];
  disclaimer: string;
}

export interface DepartmentRunSummary {
  department: GlobalDiscoveryDepartment;
  label: string;
  status: 'success' | 'partial' | 'failed';
  candidatesFound: number;
  verifiedCount: number;
  partiallyVerifiedCount: number;
  pendingCount: number;
  rejectedOrExpiredCount: number;
  errors: string[];
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
  passedVisaRule?: boolean;
  passedProfessionalRestriction?: boolean;
  rejectionCategory?: OpportunityRejectionCategory | null;
  rejectionReason?: string | null;
  actionTaken?: 'verified' | 'rejected' | 'auto_unpublished' | 'expired';
  fullDaysRemaining: number | null;
  resultingStatus: GlobalVerificationStatus;
  checkedFieldsCount: number;
  notes: string;
  evidenceExcerpt?: string;
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
  rejectedDueToVisaCount?: number;
  rejectedDueToProfessionalRestrictionCount?: number;
  autoUnpublishedCount?: number;
  expiredPurgedCount: number;
  recheckedPublishedCount?: number;
  scheduledSlotEat?: string;
  attemptNumber?: number;
  maxAttempts?: number;
  skippedOverlap?: boolean;
  departmentSummaries?: DepartmentRunSummary[];
  errors: string[];
}

export interface VerificationMonitoringSummary {
  totalDiscoveredAllTime: number;
  activeVerifiedCount: number;
  verifiedTierCount?: number;
  partiallyVerifiedTierCount?: number;
  pendingVerificationCount?: number;
  totalRejectedCount: number;
  autoUnpublishedCount: number;
  rejectedDueToVisaCount: number;
  rejectedDueToProfessionalRestrictionCount: number;
  expiredCount: number;
  duplicatesSkippedLastRun?: number;
  archivedRecordsCount: number;
  sourceFailuresCount: number;
  failedSourcesList?: string[];
  bankingJobsCount?: number;
  washJobsCount?: number;
  visaSponsoredJobsCount?: number;
  scholarshipsCount?: number;
  fullyFundedScholarshipsCount?: number;
  trainingCount?: number;
  conferencesCount?: number;
  permanentResidencyPathwaysCount?: number;
  countriesSeekingWorkersCount?: number;
  professionalShortageOccupationsCount?: number;
  labourShortageOccupationsCount?: number;
  lastVerificationAt: string | null;
  lastVerificationAtEat: string | null;
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
  permanentResidencyPathways?: PermanentResidencyCountryRecord[];
  permanentResidencyAssessments?: PermanentResidencyAssessmentResult[];
  sources: OpportunitySourceRecord[];
  lastDiscoveryRun: DiscoveryJobLogRecord | null;
  schedulerInfo?: AutonomousSchedulerInfo;
  websiteOnlyPolicyNote: string;
}
