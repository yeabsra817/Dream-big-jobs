export type AutonomousCycleStatus =
  | 'success'
  | 'partial'
  | 'failed'
  | 'skipped_overlap';

export type ApprovedSourceCategory =
  | 'employer_careers'
  | 'intl_org'
  | 'gov_portal'
  | 'immigration_portal'
  | 'scholarship_training';

export type OpportunityLifecycleStatus =
  | 'DISCOVERED'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'EXPIRED';

export type CrawledOpportunityCategory =
  | 'international_employment'
  | 'visa_sponsored_job'
  | 'banking_finance'
  | 'ngo_development'
  | 'wash'
  | 'government_recruitment'
  | 'skilled_worker'
  | 'permanent_residence'
  | 'scholarship'
  | 'fellowship'
  | 'professional_training'
  | 'international_conference'
  | 'exchange_programme';

export interface ApprovedSourceHealth {
  id: string;
  name: string;
  category: ApprovedSourceCategory;
  minPollIntervalSec: number;
  lastPolledAt: string | null;
  nextAllowedPollAt: string | null;
  lastStatus: 'idle' | 'ok' | 'rate_limited' | 'error';
  lastItemCount: number;
  consecutiveErrors: number;
  lastError: string | null;
}

export interface CrawlerDomainRecord {
  domain: string;
  firstDiscoveredAt: string;
  discoveredFrom: string;
  category: ApprovedSourceCategory;
  monitored: boolean;
  robotsFetchedAt: string | null;
  robotsAllowed: boolean;
  disallowedPrefixes: string[];
  crawlDelaySec: number;
  sitemaps: string[];
  feeds: string[];
  pagesCrawledCount: number;
  opportunitiesFoundCount: number;
  consecutiveErrors: number;
  pausedUntil: string | null;
  lastCrawledAt: string | null;
  lastStatus: 'idle' | 'ok' | 'rate_limited' | 'paused' | 'error';
  lastError: string | null;
}

export interface CrawlerQueueTask {
  id: string;
  url: string;
  domain: string;
  taskType: 'sitemap' | 'feed' | 'html_page' | 'archive_discovery';
  priority: number;
  status: 'queued' | 'processing' | 'done' | 'failed';
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  enqueuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  discoveredFrom: string;
  lastError: string | null;
}

export interface DiscoveredWebOpportunity {
  id: string;
  fingerprint: string;
  status: OpportunityLifecycleStatus;
  title: string;
  employer: string;
  category: CrawledOpportunityCategory;
  country: string;
  location: string;
  salaryRaw: string | null;
  salaryMonthlyUsd: number | null;
  visaSponsorshipConfirmed: boolean;
  visaSponsorshipEvidence: string | null;
  ethiopianEligible: 'confirmed' | 'likely_global' | 'not_confirmed' | 'excluded';
  requirementsSummary: string;
  deadlineRaw: string | null;
  deadlineIso: string | null;
  officialApplicationUrl: string;
  sourceDomain: string;
  discoveredAt: string;
  verifiedAt: string | null;
  publishedAt: string | null;
  verificationChecks: {
    employerAuthentic: boolean;
    vacancyExists: boolean;
    salaryChecked: boolean;
    visaChecked: boolean;
    nationalityChecked: boolean;
    deadlineValid: boolean;
    officialLinkValid: boolean;
    suspiciousFlags: string[];
  };
  rejectionReason: string | null;
}

export interface OperationalIncident {
  id: string;
  signature: string;
  component: string;
  errorType: 'temporary' | 'permanent';
  severity: 'warning' | 'critical';
  message: string;
  firstOccurredAt: string;
  lastOccurredAt: string;
  occurrences: number;
  status: 'open' | 'recovering' | 'resolved' | 'escalated';
  recoveryAttempts: number;
  lastRecoveryResult: string | null;
  notifiedAt: string | null;
  resolvedAt: string | null;
}

export interface CrawlerMetricsSummary {
  domainsDiscovered: number;
  domainsMonitored: number;
  pagesCrawled: number;
  newPagesDiscovered: number;
  opportunitiesExtracted: number;
  opportunitiesVerified: number;
  opportunitiesPublished: number;
  opportunitiesPendingVerification: number;
  opportunitiesRejected: number;
  opportunitiesExpired: number;
  duplicateRecordsPrevented: number;
  queueDepth: {
    queued: number;
    processing: number;
    retryScheduled: number;
    failed: number;
    total: number;
  };
  lastCrawlerRunAt: string | null;
}

export interface AutonomousCycleRecord {
  cycleId: string;
  trigger:
    | 'internal_1min_worker'
    | 'external_cron_webhook'
    | 'standalone_worker'
    | 'manual_owner'
    | 'startup_boot';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: AutonomousCycleStatus;
  sourcesPolled: string[];
  candidatesScanned: number;
  newlyDiscovered: number;
  verifiedCount: number;
  rejectedCount: number;
  duplicatesSkipped: number;
  newMatchingCount: number;
  crawlerPagesProcessed?: number;
  crawlerNewDomainsFound?: number;
  crawlerOpportunitiesExtracted?: number;
  error: string | null;
}

export interface AutonomousDiscoveryStatusResponse {
  success: true;
  engineMode: 'continuous_1min_worker' | 'external_1min_scheduler';
  intervalSeconds: number;
  isCurrentlyRunning: boolean;
  workerStartedAt: string;
  lastCycleAt: string | null;
  lastCycleStatus: AutonomousCycleStatus | 'idle';
  lastSuccessfulSearchAt: string | null;
  lastSuccessfulSearchAtEat: string | null;
  lastFailedSearchAt: string | null;
  lastFailedSearchAtEat: string | null;
  nextScheduledSearchAt: string | null;
  nextScheduledSearchAtEat: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  totalCyclesCompleted: number;
  totalSkippedOverlaps: number;
  counts: {
    opportunitiesDiscovered: number;
    opportunitiesVerified: number;
    opportunitiesRejected: number;
    newMatchingOpportunities: number;
    globalVerifiedCount: number;
    globalActiveCount: number;
    prCountriesVerifiedCount: number;
    visa3kVerifiedCount: number;
    visa3kAuditedCount: number;
  };
  sourcesSummary: {
    totalApproved: number;
    healthyCount: number;
    rateLimitedOrDegradedCount: number;
  };
  crawlerSummary?: CrawlerMetricsSummary;
  openIncidentsCount?: number;
  recentCycles: AutonomousCycleRecord[];
}

export interface AdminAutonomousTelemetryResponse {
  success: true;
  generatedAt: string;
  engineStatus: 'healthy' | 'degraded' | 'failing' | 'idle';
  workerStatus: {
    mode: 'continuous_1min_worker' | 'external_1min_scheduler';
    running: boolean;
    intervalSeconds: number;
    pid: number;
    uptimeSeconds: number;
    workerStartedAt: string;
    totalCyclesCompleted: number;
    totalSkippedOverlaps: number;
    consecutiveFailures: number;
    lastPreflightOk: boolean;
    lastPreflightMessage: string | null;
  };
  schedule: {
    lastSuccessfulExecution: string | null;
    lastSuccessfulExecutionEat: string | null;
    lastFailedExecution: string | null;
    lastFailedExecutionEat: string | null;
    nextScheduledExecution: string | null;
    nextScheduledExecutionEat: string | null;
    githubBackupSchedule: string;
  };
  crawler: CrawlerMetricsSummary;
  combinedCounts: AutonomousDiscoveryStatusResponse['counts'];
  pipelineBreakdown: Record<OpportunityLifecycleStatus, number>;
  recentDomains: CrawlerDomainRecord[];
  activeQueueSample: CrawlerQueueTask[];
  recentWebOpportunities: DiscoveredWebOpportunity[];
  incidents: OperationalIncident[];
  recentCycles: AutonomousCycleRecord[];
  sources: ApprovedSourceHealth[];
}

export interface AutonomousNewMatchNotification {
  id: string;
  discoveredAt: string;
  stream: 'visa_3k' | 'global_opportunity' | 'web_crawler';
  title: string;
  employer: string;
  country: string;
  salaryDisplay: string;
  matchScore: number;
  officialUrl: string;
  emailSent: boolean;
}
