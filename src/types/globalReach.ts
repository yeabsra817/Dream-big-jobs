export type GlobalReachEntityType = 'individual' | 'organization';

export type GlobalReachOrgSize =
  | 'solo_founder'
  | 'small_business'
  | 'medium_enterprise'
  | 'large_international'
  | 'plc_listed'
  | 'ngo_foundation'
  | 'unknown';

export type GlobalReachRegion =
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Middle East'
  | 'Asia'
  | 'Africa'
  | 'Australia & Oceania';

export type GlobalReachContactCategory =
  | 'potential_employers'
  | 'banking_executives'
  | 'finance_professionals'
  | 'business_owners'
  | 'entrepreneurs'
  | 'investors'
  | 'mentors'
  | 'philanthropists'
  | 'ngos_and_foundations'
  | 'website_development_clients'
  | 'international_recruitment_professionals'
  | 'other_professional_connections';

export type GlobalReachVerificationStatus =
  | 'verified_organization'
  | 'verified_public_professional_contact'
  | 'public_contact_unverified'
  | 'unverified_contact'
  | 'invalid_or_outdated_contact';

export type GlobalReachSponsorshipTier =
  | 'confirmed_sponsorship'
  | 'previous_sponsorship_evidence'
  | 'international_recruiter'
  | 'unknown_sponsorship'
  | 'mentorship_networking';

export type GlobalReachOutreachApproach =
  | 'employment_request'
  | 'banking_finance_career'
  | 'website_development'
  | 'business_partnership'
  | 'professional_mentorship'
  | 'employment_referral'
  | 'international_relocation_guidance'
  | 'professional_networking';

export type GlobalReachChannel =
  | 'gmail'
  | 'whatsapp'
  | 'linkedin'
  | 'instagram'
  | 'contact_page'
  | 'phone';

export interface GlobalReachUserProfile {
  userId: string;
  isOwnerProfile: boolean;
  fullName: string;
  nationality: string;
  currentCountry: string;
  email: string;
  educationDegree: string;
  educationInstitution: string;
  graduationYear: string;
  totalExperienceYears: number;
  managementExperienceYears: number;
  currentOrRecentRole: string;
  coreExperienceAreas: string[];
  additionalCapabilities: string[];
  primaryObjectives: string[];
  personalStorySummary: string;
  targetRegions: GlobalReachRegion[];
  targetIndustries: string[];
  updatedAt: string;
}

export interface GlobalReachOutreachLog {
  id: string;
  channel: GlobalReachChannel;
  approach: GlobalReachOutreachApproach;
  subject?: string;
  messagePreview: string;
  recipientAddress?: string;
  mode: 'single' | 'bulk_bcc';
  approvedByHuman: true;
  sentAt: string;
  status: 'opened_in_platform' | 'replied' | 'follow_up_needed' | 'declined_opt_out';
  notes?: string;
}

export interface GlobalReachContact {
  id: string;
  ownerUserId: string;
  entityType: GlobalReachEntityType;
  fullName: string;
  companyName: string;
  positionOrRole: string;
  industry: string;
  organizationSize: GlobalReachOrgSize;
  country: string;
  city?: string;
  region: GlobalReachRegion;
  officialWebsite?: string;
  publicEmail?: string;
  publicBusinessPhone?: string;
  whatsAppBusinessNumber?: string;
  whatsAppBusinessUrl?: string;
  linkedInUrl?: string;
  instagramUrl?: string;
  contactPageUrl?: string;
  sourceUrl: string;
  sourceName: string;
  discoveredAt: string;
  lastVerifiedAt?: string;
  verificationStatus: GlobalReachVerificationStatus;
  verificationNotes: string;
  httpStatus?: number;
  emailMatchesOfficialDomain: boolean;
  sponsorshipTier: GlobalReachSponsorshipTier;
  sponsorshipEvidenceNote: string;
  mentorshipAvailable: boolean;
  websiteDevProspect: boolean;
  internationalRecruiterSignal: boolean;
  category: GlobalReachContactCategory;
  relevanceScore: number;
  relevanceReasons: string[];
  isImportant: boolean;
  isSavedByUser: boolean;
  personalNotes: string;
  nextFollowUpDate?: string;
  outreachHistory: GlobalReachOutreachLog[];
  tags: string[];
  dedupKey: string;
  updatedAt: string;
}

export interface GlobalReachSuppressionEntry {
  id: string;
  email?: string;
  domain?: string;
  contactName?: string;
  reason: string;
  createdAt: string;
}

export interface GlobalReachNotification {
  id: string;
  type:
    | 'high_relevance_contact'
    | 'potential_employer'
    | 'sponsorship_evidence'
    | 'banking_finance_opportunity'
    | 'mentor_found'
    | 'web_dev_prospect'
    | 'search_failure'
    | 'automation_stopped';
  title: string;
  message: string;
  contactId?: string;
  createdAt: string;
  read: boolean;
}

export interface GlobalReachSourceStatus {
  id: string;
  name: string;
  category: 'public_api' | 'official_web' | 'optional_api' | 'platform_restricted';
  status: 'operational' | 'requires_api_key' | 'requires_platform_permission' | 'degraded';
  description: string;
  envVarName?: string;
  lastRunAt?: string;
  lastError?: string;
  contactsDiscoveredTotal: number;
}

export interface GlobalReachCycleLog {
  id: string;
  trigger: 'startup_auto' | 'hourly_scheduler' | 'vercel_cron' | 'manual';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'completed' | 'partial' | 'failed' | 'skipped_locked' | 'skipped_paused';
  regionScanned: GlobalReachRegion;
  countriesScanned: string[];
  sourcesChecked: number;
  newContactsAdded: number;
  duplicatesPrevented: number;
  verifiedCount: number;
  errors: string[];
}

export interface GlobalReachSchedulerState {
  status: 'running' | 'active_waiting' | 'paused' | 'disabled' | 'error';
  enabled: boolean;
  paused: boolean;
  intervalMinutes: number;
  isRunningNow: boolean;
  lockAcquiredAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastSuccessfulRunEat: string | null;
  nextScheduledRunAt: string | null;
  nextScheduledRunEat: string | null;
  totalCyclesCompleted: number;
  totalCyclesFailed: number;
  consecutiveFailures: number;
  lastError: string | null;
  checkpointIndex: number;
  lastRegionScanned: GlobalReachRegion | null;
  recoveryNotes: string | null;
}

export interface GlobalReachDatabaseStats {
  automationStatus: GlobalReachSchedulerState['status'];
  lastSuccessfulSearchAt: string | null;
  lastSuccessfulSearchEat: string | null;
  nextScheduledSearchAt: string | null;
  nextScheduledSearchEat: string | null;
  totalSearchCyclesCompleted: number;
  newContactsThisHour: number;
  totalContacts: number;
  newCompaniesDiscovered: number;
  verifiedContactsFound: number;
  potentialEmployersFound: number;
  potentialMentorsFound: number;
  contactsWithPublicEmail: number;
  contactsWithPublicWhatsApp: number;
  contactsWithLinkedIn: number;
  contactsWithInstagram: number;
  potentialSponsorshipOpportunities: number;
  websiteDevelopmentProspects: number;
  searchFailures: number;
  apiErrors: number;
  outreachSentCount: number;
  upcomingFollowUpsCount: number;
}

export interface GlobalReachGeneratedDraft {
  contactId: string;
  contactName: string;
  companyName: string;
  approach: GlobalReachOutreachApproach;
  subject: string;
  message: string;
  whatsappShortMessage: string;
  linkedInNote: string;
  followUpMessage: string;
  generatedBy: 'gemini_ai' | 'manual_template';
  modelUsed?: string;
  generatedAt: string;
}

export interface GlobalReachDashboardResponse {
  success: boolean;
  workspaceId: string;
  isOwnerWorkspace: boolean;
  profile: GlobalReachUserProfile;
  contacts: GlobalReachContact[];
  stats: GlobalReachDatabaseStats;
  scheduler: GlobalReachSchedulerState;
  sources: GlobalReachSourceStatus[];
  recentCycles: GlobalReachCycleLog[];
  notifications: GlobalReachNotification[];
  unreadNotificationsCount: number;
  suppressionList: GlobalReachSuppressionEntry[];
  availableCountries: string[];
  availableIndustries: string[];
  aiProviderConfigured: boolean;
}
