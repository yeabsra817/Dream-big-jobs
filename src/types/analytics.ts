export type AnalyticsPeriod = 'today' | 'yesterday' | 'last7' | 'last30' | 'last90' | 'all';

export interface AnalyticsEvent {
  id: string;
  visitorId: string;
  userId?: string;
  sessionId: string;
  eventType:
    | 'page_view'
    | 'vacancy_view'
    | 'category_view'
    | 'location_view'
    | 'click_apply_link'
    | 'share_telegram'
    | 'click_telegram_link'
    | 'search'
    | 'view_search_results'
    | 'select_search_result'
    | 'search_no_results'
    | 'filter_change'
    | 'sort_change'
    | 'job_application'
    | 'job_seeker_login'
    | 'job_seeker_register'
    | 'profile_update'
    | 'cv_upload'
    | 'ai_assist';
  path: string;
  title?: string;
  jobId?: string;
  jobTitle?: string;
  organization?: string;
  category?: string;
  applyUrl?: string;
  applyMethod?: string;
  searchTerm?: string;
  resultsCount?: number;
  hasResults?: boolean;
  itemRank?: number;
  filterType?: string;
  filterValue?: string;
  sortBy?: string;
  channel?: string;
  source: 'direct' | 'google' | 'telegram' | 'facebook' | 'referral' | 'other';
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  country?: string;
  city?: string;
  timestamp: string; // ISO format
  isInternal: boolean;
}

export interface CustomerVisitCountSummary {
  visitorsToday: number;
  visitorsYesterday: number;
  visitorsLast7: number;
  visitorsLast30: number;
  activeNow: number;
  totalUniqueVisits: number;
  totalPageViews: number;
  signedInCustomerVisits: number;
  telegramReferrals: number;
  aiInteractionsCount: number;
  lastUpdated: string;
}

export interface CustomerVisitAiInsight {
  headline: string;
  visitTrendSummary: string;
  audienceBehavior: string;
  conversionOpportunity: string;
  recommendedActions: string[];
  modelUsed: string;
  generatedAt: string;
}

export interface ConversionFunnelStage {
  stage: string;
  count: number;
  conversionRate: number; // % from top of funnel
  dropoffRate: number; // % dropped from previous stage
  description: string;
}

export interface EngagedTrafficSource {
  source: string;
  visitors: number;
  sessions: number;
  engagedVisitors: number; // >= 2 pageviews or clicked apply
  engagementRate: number; // %
  percentage: number;
  utmCampaigns: Array<{
    campaign: string;
    visitors: number;
    clicks: number;
  }>;
}

export interface EmployerRanking {
  organization: string;
  totalViews: number;
  totalApplyClicks: number;
  vacanciesCount: number;
  ctr: number;
}

export interface UnderperformingVacancy {
  jobId: string;
  title: string;
  organization: string;
  category: string;
  views: number;
  applyClicks: number;
  ctr: number;
  opportunityReason: string;
}

export interface SearchConsoleMetrics {
  status: 'CONNECTED' | 'NOT CONFIGURED' | 'NOT TESTED' | 'BLOCKED';
  propertyUrl: string;
  lastSyncTime?: string;
  impressions: number;
  clicks: number;
  ctr: number; // percentage
  averagePosition: number;
  topQueries: Array<{
    query: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;
  indexedPages: number;
  pagesWithIssues: number;
  indexingIssues: Array<{
    url: string;
    issue: string;
    detectedDate: string;
  }>;
}

export interface HealthDiagnosticItem {
  id: string;
  name: string;
  category: 'links' | 'server' | 'performance' | 'mobile' | 'database';
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT TESTED';
  metric: string;
  lastChecked: string;
  details: string;
}

export interface SmartAlertItem {
  id: string;
  title: string;
  type: 'traffic_spike' | 'traffic_drop' | 'broken_link' | 'error_rate' | 'analytics_failure' | 'ctr_drop';
  severity: 'low' | 'medium' | 'high';
  status: 'ALERT' | 'NORMAL' | 'PASS' | 'FAIL';
  triggerCondition: string;
  currentValue: string;
  detectedAt: string;
  recommendedAction: string;
  affectedItemsCount?: number;
  affectedItemIds?: string[];
  actionTab?: 'analytics' | 'health' | 'vacancies' | 'settings' | 'alerts';
  actionLabel?: string;
  dismissed?: boolean;
}

export interface BusinessIntelligenceMetrics {
  actualEmployerRevenueEtb: number;
  actualCvServiceRevenueEtb: number;
  actualTrainingRevenueEtb: number;
  totalCollectedRevenueEtb: number;
  employerInquiriesCount: number;
  candidateRegistrationCount: number;
  activeAdCampaignsCount: number;
  currency: string;
  lastUpdated: string;
  verifiedInquiries: Array<{
    id: string;
    companyName: string;
    contactPerson: string;
    serviceType: string;
    date: string;
    status: 'pending' | 'responded' | 'closed';
  }>;
  growthOpportunities: Array<{
    category: string;
    reason: string;
    potentialImpact: 'High' | 'Medium' | 'Low';
  }>;
}

export interface AiBusinessAnalystReport {
  id: string;
  generatedAt: string;
  period: AnalyticsPeriod;
  modelUsed: string;
  isInsufficientData: boolean;
  performanceSummary: string;
  growthAnalysis: string;
  acquisitionAnalysis: string;
  categoryAndJobInsights: string;
  engagementAndClickPerformance: string;
  trafficSourceAssessment: string;
  identifiedProblems: string[];
  strategicRecommendations: string[];
}

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  dateRangeLabel: string;
  uniqueVisitors: number;
  totalInteractions: number;
  totalSessions: number;
  totalPageViews: number;
  totalSearches: number;
  popularSearchTerms: Array<{
    term: string;
    count: number;
    resultsAverage: number;
  }>;
  telegramReferralsCount: number;
  newVisitors: number;
  returningVisitors: number;
  activeUsersLast30Min: number;
  visitorsToday: number;
  visitorsYesterday: number;
  visitorsLast7: number;
  visitorsLast30: number;
  lastUpdated: string;
  status: 'CONNECTED' | 'NOT CONFIGURED' | 'LOADING' | 'DATA TEMPORARILY UNAVAILABLE' | 'NO DATA YET';
  provider: string;
  gaMeasurementId?: string;
  internalExclusionStatus: 'ACTIVE' | 'NOT CONFIGURED' | 'PAUSED';
  dailyStats: Array<{
    date: string;
    visitors: number;
    sessions: number;
    pageViews: number;
  }>;
  trafficSources: EngagedTrafficSource[];
  topVacancies: Array<{
    jobId: string;
    title: string;
    organization: string;
    category?: string;
    views: number;
    applyClicks: number;
    ctr: number;
  }>;
  topEmployers: EmployerRanking[];
  underperformingVacancies: UnderperformingVacancy[];
  topCategories: Array<{
    category: string;
    views: number;
  }>;
  deviceBreakdown: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  funnel: ConversionFunnelStage[];
  healthDiagnostics: HealthDiagnosticItem[];
  smartAlerts: SmartAlertItem[];
  searchConsole: SearchConsoleMetrics;
  businessIntelligence: BusinessIntelligenceMetrics;
}
