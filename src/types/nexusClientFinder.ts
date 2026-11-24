export type NexusLeadCategory =
  | 'person_looking_for_web_developer'
  | 'company_looking_for_web_developer'
  | 'ecommerce_website_request'
  | 'wordpress_website_request'
  | 'business_website_creation'
  | 'website_redesign_improvement'
  | 'landing_page_development'
  | 'web_application_development'
  | 'website_maintenance'
  | 'other_it_projects';

export type NexusLeadVerificationStatus =
  | 'verified'
  | 'partially_verified'
  | 'pending'
  | 'expired'
  | 'rejected';

export type NexusEmailClassification =
  | 'verified_business_email'
  | 'unverified_business_email'
  | 'personal_email'
  | 'no_public_email';

export type NexusContactStatus =
  | 'new'
  | 'selected'
  | 'ready_to_contact'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'negotiating'
  | 'project_won'
  | 'not_interested'
  | 'do_not_contact';

export type NexusMessageTemplateType =
  | 'website_development'
  | 'ecommerce_development'
  | 'business_website'
  | 'website_redesign'
  | 'follow_up';

export interface NexusOutreachHistoryItem {
  id: string;
  sentAt: string;
  mode: 'single_gmail' | 'bulk_bcc_gmail' | 'individual_personalized';
  recipientEmail: string;
  subject: string;
  templateType: NexusMessageTemplateType;
  note?: string;
}

export interface NexusClientLead {
  id: string;
  fingerprint: string;
  title: string;
  advertiserName: string;
  advertiserType: 'person' | 'company' | 'unknown';
  country: string;
  regionGroup: 'GCC / Middle East' | 'Europe' | 'North America & Oceania' | 'Global / Remote';
  city: string;
  category: NexusLeadCategory;
  categoryLabel: string;

  // Original Advertisement & Requirements
  originalAdText: string;
  projectRequirements: string[];
  estimatedBudget: string | null; // ONLY populated if actually advertised

  // Freshness & Source Evidence
  publishedAt: string; // ISO UTC timestamp of original publication
  discoveredAt: string; // ISO UTC timestamp when discovered
  lastRecheckedAt: string;
  ageHoursAtDiscovery: number;
  within72Hours: boolean;
  isActive: boolean;

  sourceId: string;
  sourceName: string;
  originalSourceUrl: string;
  sourceHttpStatus: number | null;
  robotsAllowed: boolean;

  // Real Public Contact Information (never invented)
  publicEmail: string | null;
  emailClassification: NexusEmailClassification;
  emailDomain: string | null;
  emailMxVerified: boolean;
  emailEvidenceSource: string | null;
  officialWebsiteUrl: string | null;
  publicContactPageUrl: string | null;
  publicPhone: string | null;

  // Verification & Filtering Audit
  verificationStatus: NexusLeadVerificationStatus;
  verificationNotes: string;
  rejectionReason: string | null;

  // Contact Management (CRM)
  contactStatus: NexusContactStatus;
  contactNotes: string;
  contactCount: number;
  lastContactedAt: string | null;
  outreachHistory: NexusOutreachHistoryItem[];
  suppressed: boolean;
}

export interface NexusSuppressionEntry {
  id: string;
  email: string;
  domain: string | null;
  advertiserName: string | null;
  reason: string;
  leadId: string | null;
  addedAt: string;
}

export interface NexusSearchSourceRecord {
  id: string;
  name: string;
  sourceType: 'free_public_api' | 'free_rss_feed' | 'public_community_api';
  baseUrl: string;
  isFree: true;
  status: 'connected' | 'degraded' | 'error' | 'idle';
  lastCheckedAt: string | null;
  lastCandidatesFound: number;
  lastAcceptedCount: number;
  lastError: string | null;
  note: string;
}

export interface NexusDiscoveryRunLog {
  id: string;
  trigger: 'startup' | 'scheduled_3h' | 'manual_admin' | 'recheck_active';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'success' | 'partial' | 'failed';
  dailyTarget: number;
  sourcesQueried: number;
  rawCandidatesScanned: number;
  acceptedWithin72hCount: number;
  verifiedCount: number;
  partiallyVerifiedCount: number;
  pendingCount: number;
  rejectedExpiredOrOver72hCount: number;
  rejectedIrrelevantOrFakeCount: number;
  duplicatesSkippedCount: number;
  businessEmailsFoundCount: number;
  errors: string[];
}

export interface NexusDashboardStats {
  dailyTarget: number;
  discoveredTodayCount: number;
  totalActiveLeads: number;
  verifiedCount: number;
  partiallyVerifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  expiredCount: number;
  availableBusinessEmailsCount: number;
  verifiedBusinessEmailsCount: number;
  personalEmailsCount: number;
  newOpportunitiesCount: number;
  alreadyContactedCount: number;
  awaitingContactCount: number;
  suppressedCount: number;
  byCountry: Array<{ country: string; count: number }>;
  byCategory: Array<{ category: NexusLeadCategory; label: string; count: number }>;
  byPublicationDate: Array<{ date: string; count: number }>;
}

export interface NexusSchedulerInfo {
  enabled: boolean;
  intervalHours: number;
  dailyTarget: number;
  freshnessWindowHours: number;
  isRunningNow: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastRunStatus: string | null;
  freeSourcesOnlyPolicy: string;
}

export interface NexusClientFinderStore {
  leads: NexusClientLead[];
  suppressionList: NexusSuppressionEntry[];
  sources: NexusSearchSourceRecord[];
  runLogs: NexusDiscoveryRunLog[];
  lastUpdatedAt: string | null;
}

export interface NexusClientFinderApiResponse {
  success: boolean;
  generatedAt: string;
  stats: NexusDashboardStats;
  leads: NexusClientLead[];
  suppressionList: NexusSuppressionEntry[];
  sources: NexusSearchSourceRecord[];
  runLogs: NexusDiscoveryRunLog[];
  schedulerInfo: NexusSchedulerInfo;
}

export interface NexusGmailBatch {
  batchIndex: number;
  totalBatches: number;
  recipients: Array<{
    leadId: string;
    email: string;
    advertiserName: string;
    emailClassification: NexusEmailClassification;
  }>;
  bccList: string[];
  gmailComposeUrl: string;
}

export interface NexusGeneratedMessage {
  templateType: NexusMessageTemplateType;
  subject: string;
  body: string;
  generatedBy: 'deterministic_nexus_assistant' | 'gemini_enhanced';
  privacyNotice: string;
}
