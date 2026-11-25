export type OpportunityCategory = 'job' | 'scholarship' | 'internship' | 'conference' | 'training';

export type OpportunityEnvironment = 'ethiopia_domestic' | 'international';

export type CareerSeniorityLevel =
  | 'entry_level'
  | 'junior_professional'
  | 'experienced_professional'
  | 'senior_professional'
  | 'supervisor'
  | 'assistant_manager'
  | 'manager'
  | 'senior_manager'
  | 'director'
  | 'executive';

export const SENIORITY_RANK: Record<CareerSeniorityLevel, number> = {
  entry_level: 1,
  junior_professional: 2,
  experienced_professional: 3,
  senior_professional: 4,
  supervisor: 5,
  assistant_manager: 6,
  manager: 7,
  senior_manager: 8,
  director: 9,
  executive: 10,
};

export const SENIORITY_LABELS: Record<CareerSeniorityLevel, string> = {
  entry_level: 'Entry Level',
  junior_professional: 'Junior Professional',
  experienced_professional: 'Experienced Professional',
  senior_professional: 'Senior Professional',
  supervisor: 'Supervisor',
  assistant_manager: 'Assistant Manager',
  manager: 'Manager',
  senior_manager: 'Senior Manager',
  director: 'Director',
  executive: 'Executive',
};

export type ProfessionalSector =
  | 'branch_banking'
  | 'banking_finance'
  | 'wash'
  | 'engineering'
  | 'healthcare'
  | 'education'
  | 'it_software'
  | 'legal_compliance'
  | 'general_management'
  | 'other';

export type OpportunityPublishStatus = 'published' | 'rejected' | 'unpublished' | 'expired';

export type RejectionReasonCode =
  | 'visa_sponsorship_unconfirmed'
  | 'visa_cost_applicant_paid'
  | 'invitation_letter_only'
  | 'salary_undisclosed'
  | 'salary_below_threshold'
  | 'experience_mismatch'
  | 'seniority_mismatch_too_senior'
  | 'seniority_mismatch_too_junior'
  | 'industry_mismatch'
  | 'non_banking_wash_learning_category'
  | 'deadline_expired'
  | 'deadline_under_three_days'
  | 'closed_or_withdrawn'
  | 'invalid_official_url'
  | 'duplicate_prevented';

export interface SalaryNormalizationRecord {
  opportunityId: string;
  disclosed: boolean;
  salaryDisplay: string; // e.g., "Not Disclosed" or "$4,800 / month (Gross)"
  period: 'monthly' | 'annual' | 'unknown';
  taxBasis: 'gross' | 'net' | 'not_specified';
  originalCurrency: string | null;
  minOriginalAmount: number | null;
  maxOriginalAmount: number | null;
  normalizedMonthlyUsd: number | null;
  normalizedAnnualUsd: number | null;
  exchangeRateUsed: string;
  meetsAbove3000UsdMonthly: boolean;
  verifiedAt: string;
}

export interface VisaAuthorizationRecord {
  opportunityId: string;
  environment: OpportunityEnvironment;
  conditionMet:
    | 'A_employer_work_visa'
    | 'B_work_permit_immigration'
    | 'C_legal_right_no_sponsorship'
    | 'domestic_not_required'
    | 'none';
  verified: boolean;
  visaFeesCovered: 'yes' | 'no' | 'not_confirmed';
  relocationSupport: 'yes' | 'no' | 'not_confirmed';
  relocationDetails: string;
  invitationLetterOnly: boolean;
  touristEntryRejected: boolean;
  sponsorshipStatement: string;
  statusLabel: string;
  lastVerifiedAt: string;
}

export interface OpportunityEligibilityRecord {
  opportunityId: string;
  category: OpportunityCategory;
  sector: ProfessionalSector;
  secondarySectors: ProfessionalSector[];
  seniorityLevel: CareerSeniorityLevel;
  requiredBankingYears: number | null;
  requiredManagerialYears: number | null;
  requiredTotalYears: number | null;
  educationRequirement: string;
  individualApplicationAllowed: 'yes' | 'no' | 'not_confirmed';
  universityRecommendationRequired: 'yes' | 'no' | 'not_confirmed';
  companyRecommendationRequired: 'yes' | 'no' | 'not_confirmed';
  fundingCoverage: string;
  visaCostsCoverageNote: string;
  nationalityEligibility: string;
  verifiedAt: string;
}

export interface OpportunityVerificationLogRecord {
  id: string;
  opportunityId: string;
  checkedAt: string;
  action: 'initial_verification' | 'daily_recheck' | 'auto_unpublish' | 'material_update';
  previousStatus: OpportunityPublishStatus | 'new';
  newStatus: OpportunityPublishStatus;
  passed: boolean;
  rejectionCodes: RejectionReasonCode[];
  explanation: string;
  sourceUrl: string;
  httpStatus?: number | null;
}

export interface OpportunitySourceRegistryRecord {
  id: string;
  sourceNumber: number;
  name: string;
  region: 'Middle East' | 'Europe' | 'USA' | 'Scandinavia / Nordic' | 'Global' | 'Ethiopia';
  sectorFocus: 'banking_finance' | 'wash' | 'multi_sector' | 'scholarship_training' | 'conference';
  categoryCoverage: OpportunityCategory[];
  url: string;
  officialEndpointUrl?: string | null;
  feedType: 'rss' | 'json_api' | 'html_portal' | 'greenhouse' | 'ashby';
  enabled: boolean;
  accessStatus: 'active' | 'restricted' | 'error' | 'pending';
  robotsAllowed: boolean | null;
  accessNote: string | null;
  lastCheckedAt: string | null;
  lastStatus: 'idle' | 'ok' | 'degraded' | 'failed';
  lastHttpStatus: number | null;
  lastError: string | null;
  lastDurationMs?: number | null;
  consecutiveFailures: number;
  itemsDiscoveredTotal: number;
}

export interface CanonicalOpportunityRecord {
  id: string;
  canonicalKey: string;
  urlFingerprint: string;
  referenceNumber: string | null;
  updateVersion: number;
  category: OpportunityCategory;
  environment: OpportunityEnvironment;
  title: string;
  employer: string;
  country: string;
  city: string;
  region: string;
  sector: ProfessionalSector;
  secondarySectors: ProfessionalSector[];
  seniorityLevel: CareerSeniorityLevel;
  actualResponsibilities: string[];
  descriptionSummary: string;
  officialApplicationUrl: string;
  primarySourceUrl: string;
  primarySourceName: string;
  sourceUrls: string[];
  sourceNames: string[];
  deadlineRaw: string;
  deadlineIso: string | null;
  fullDaysRemaining: number | null;
  salary: SalaryNormalizationRecord;
  visa: VisaAuthorizationRecord;
  eligibility: OpportunityEligibilityRecord;
  status: OpportunityPublishStatus;
  verificationBadge: string;
  rejectionCodes: RejectionReasonCode[];
  rejectionExplanations: string[];
  isBranchBankingMatch: boolean;
  branchBankingRelevanceScore: number;
  branchBankingMatchReasons: string[];
  branchBankingRejectionReasons: string[];
  discoveredAt: string;
  lastVerifiedAt: string;
  updatedAt: string;
  unpublishedAt: string | null;
  unpublishedReason: string | null;
}

export interface UserProfessionalProfileInput {
  userId: string;
  email?: string;
  fullName?: string;
  professionalSector: ProfessionalSector;
  currentOccupation: string;
  educationLevel: 'high_school' | 'diploma' | 'bachelors' | 'masters' | 'phd';
  fieldOfStudy: string;
  yearsOfExperience: number;
  bankingExperienceYears?: number;
  managerialExperienceYears: number;
  skills: string[];
  certifications: string[];
  minimumSalaryUsdMonthly?: number | null;
  careerLevel: CareerSeniorityLevel;
  preferredLocations: string[];
  preferredEnvironment: 'both' | 'ethiopia_domestic' | 'international';
  nationality: string;
  countriesWithLegalWorkRight?: string[];
  allowJuniorRoles?: boolean;
  updatedAt?: string;
}

export interface UserOpportunityMatchRecord {
  id: string;
  userId: string;
  opportunityId: string;
  environment: OpportunityEnvironment;
  category: OpportunityCategory;
  eligible: boolean;
  relevanceScore: number;
  matchReasons: string[];
  rejectionCodes: RejectionReasonCode[];
  rejectionExplanations: string[];
  evaluatedAt: string;
}

export interface UserNotificationPreferenceRecord {
  userId: string;
  enabled: boolean;
  dailyLimit: number;
  categories: OpportunityCategory[];
  environments: OpportunityEnvironment[];
  allowJuniorRoles: boolean;
  notifyOnMaterialUpdates: boolean;
  viewedOpportunityIds: string[];
  savedOpportunityIds: string[];
  updatedAt: string;
}

export interface UserNotificationHistoryRecord {
  id: string;
  userId: string;
  opportunityId: string;
  canonicalKey: string;
  notificationType: 'new_match' | 'material_update';
  title: string;
  employer: string;
  category: OpportunityCategory;
  environment: OpportunityEnvironment;
  sentAt: string;
  status: 'sent' | 'failed' | 'suppressed_duplicate' | 'suppressed_daily_limit' | 'suppressed_viewed_or_saved';
  deliveryResult: string;
  notifiedUpdateVersion: number;
}

export interface NotificationDeduplicationRecord {
  key: string; // `${userId}::${canonicalKey}`
  userId: string;
  opportunityId: string;
  canonicalKey: string;
  urlFingerprint: string;
  lastNotifiedAt: string;
  lastNotifiedUpdateVersion: number;
  notificationCount: number;
}

export interface OpportunityNotificationStatusRecord {
  opportunityId: string;
  canonicalKey: string;
  updateVersion: number;
  totalUsersNotified: number;
  totalDuplicatesPrevented: number;
  lastDispatchedAt: string | null;
}

export interface ScheduledDiscoveryLogRecord {
  id: string;
  trigger: 'daily_scheduler' | 'cron_webhook' | 'manual_admin' | 'startup_boot';
  timezone: 'Africa/Addis_Ababa';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'success' | 'partial' | 'failed';
  sourcesChecked: number;
  sourcesSucceeded: number;
  sourcesRestricted: number;
  sourcesFailed: number;
  newOpportunitiesDiscovered: number;
  opportunitiesUpdated: number;
  opportunitiesVerified: number;
  opportunitiesPublished: number;
  opportunitiesRejected: number;
  opportunitiesUnpublished: number;
  duplicatesPrevented: number;
  notificationsSent: number;
  duplicateNotificationsPrevented: number;
  errors: string[];
}

export interface AdminOpportunityIntelligenceDashboardResponse {
  success: true;
  generatedAt: string;
  timezone: 'Africa/Addis_Ababa';
  monitoringStatus: 'active' | 'running' | 'idle' | 'degraded';
  schedulerIntervalHours: 24;
  metrics: {
    totalSourcesMonitored: number;
    sourcesSuccessfullyChecked: number;
    sourcesRestricted: number;
    sourcesFailed: number;
    newOpportunitiesDiscovered: number;
    opportunitiesUpdated: number;
    opportunitiesVerified: number;
    opportunitiesRejected: number;
    opportunitiesPublished: number;
    opportunitiesRemoved: number;
    visaSponsorshipFailures: number;
    salaryFilterFailures: number;
    experienceMismatchRejections: number;
    seniorityMismatchRejections: number;
    duplicateOpportunitiesPrevented: number;
    notificationsSent: number;
    duplicateNotificationsPrevented: number;
    lastSuccessfulExecution: string | null;
    lastSuccessfulExecutionEat: string | null;
    nextScheduledExecution: string | null;
    nextScheduledExecutionEat: string | null;
  };
  environmentBreakdown: {
    ethiopiaDomesticPublished: number;
    internationalPublished: number;
    branchBankingPublished: number;
    internshipsPublished: number;
    scholarshipsPublished: number;
    conferencesPublished: number;
    trainingPublished: number;
  };
  sources: OpportunitySourceRegistryRecord[];
  rejectionAuditLogs: Array<{
    opportunityId: string;
    title: string;
    employer: string;
    category: OpportunityCategory;
    environment: OpportunityEnvironment;
    status: OpportunityPublishStatus;
    rejectionCodes: RejectionReasonCode[];
    explanations: string[];
    checkedAt: string;
    officialUrl: string;
  }>;
  recentVerificationLogs: OpportunityVerificationLogRecord[];
  recentScheduledRuns: ScheduledDiscoveryLogRecord[];
}
