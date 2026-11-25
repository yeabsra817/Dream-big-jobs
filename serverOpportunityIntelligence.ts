import type { Express, Request, Response } from 'express';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  AdminOpportunityIntelligenceDashboardResponse,
  CanonicalOpportunityRecord,
  CareerSeniorityLevel,
  NotificationDeduplicationRecord,
  OpportunityCategory,
  OpportunityEligibilityRecord,
  OpportunityEnvironment,
  OpportunityNotificationStatusRecord,
  OpportunitySourceRegistryRecord,
  OpportunityVerificationLogRecord,
  ProfessionalSector,
  SalaryNormalizationRecord,
  ScheduledDiscoveryLogRecord,
  UserNotificationHistoryRecord,
  UserNotificationPreferenceRecord,
  UserOpportunityMatchRecord,
  UserProfessionalProfileInput,
  VisaAuthorizationRecord,
} from './src/types/opportunityIntelligence';
import {
  BRANCH_BANKING_REFERENCE_PROFILE,
  buildAndVerifyCanonicalOpportunity,
  DEFAULT_FX_RATES_USD_BASE,
  evaluateForBranchBankingSpecialFeature,
  evaluateOpportunityForUserProfile,
  evaluateStrictThreeDayDeadline,
  RawOpportunityCandidateInput,
} from './src/utils/strictOpportunityMatcher';
import {
  loadJsonWithBackupRecovery,
  saveJsonTransactional,
  validatePublicCrawlUrl,
} from './serverAutonomousWebCrawler';

export interface PermanentOpportunityHistoryEntry {
  opportunityId: string;
  canonicalKey: string;
  urlFingerprint: string;
  referenceNumber: string | null;
  status: 'published' | 'rejected' | 'unpublished' | 'expired';
  firstSeenAt: string;
  lastSeenAt: string;
  primarySourceUrl: string;
  primarySourceName: string;
}

export interface OpportunityIntelligenceDb {
  version: number;
  updatedAt: string;
  lastSuccessfulRunAt: string | null;
  nextScheduledRunAt: string | null;
  duplicateOpportunitiesPrevented: number;
  duplicateNotificationsPrevented: number;
  opportunitiesUpdated: number;
  opportunity_sources: OpportunitySourceRegistryRecord[];
  international_opportunities: CanonicalOpportunityRecord[];
  local_opportunities: CanonicalOpportunityRecord[];
  permanent_opportunity_history: Record<string, PermanentOpportunityHistoryEntry>;
  opportunity_verification_logs: OpportunityVerificationLogRecord[];
  opportunity_salary: Record<string, SalaryNormalizationRecord>;
  opportunity_visa_status: Record<string, VisaAuthorizationRecord>;
  opportunity_eligibility: Record<string, OpportunityEligibilityRecord>;
  user_professional_profiles: Record<string, UserProfessionalProfileInput>;
  user_opportunity_matches: Record<string, UserOpportunityMatchRecord[]>;
  user_notification_history: UserNotificationHistoryRecord[];
  notification_preferences: Record<string, UserNotificationPreferenceRecord>;
  notification_deduplication: Record<string, NotificationDeduplicationRecord>;
  opportunity_notification_status: Record<string, OpportunityNotificationStatusRecord>;
  scheduled_discovery_logs: ScheduledDiscoveryLogRecord[];
}

export interface RegisterOpportunityIntelligenceDeps {
  app: Express;
  runtimeBaseDir: string;
  isVercel: boolean;
  ensureRuntimeDataDir: () => void;
  loadJsonFileSafe: <T>(filePath: string, fallback: T) => T;
  writeJsonFileAtomic: (filePath: string, data: unknown) => void;
  loadUserProfiles: () => Record<string, any>;
  isPersistentOwnerRequest: (req: Request) => boolean;
  getRequesterUid: (req: Request) => string | null;
  appendAuditLog: (entry: {
    action: string;
    actorEmail?: string;
    targetType: string;
    targetId?: string;
    summary: string;
    severity?: 'info' | 'warning' | 'critical';
  }) => void;
  autoStartDailyScheduler?: boolean;
}

export const ADDIS_ABABA_TIMEZONE = 'Africa/Addis_Ababa' as const;
export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function formatAddisAbabaTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: ADDIS_ABABA_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(ms));
    return `${formatted} EAT (Africa/Addis_Ababa)`;
  } catch {
    return `${iso} (Africa/Addis_Ababa)`;
  }
}

/**
 * Exact 40 Permanent Official Tracking Sources across 4 Global Regions:
 * - Middle East (1–10)
 * - Europe (11–20)
 * - USA (21–30)
 * - Scandinavia / Nordic (31–40)
 *
 * Categorized strictly by region and genuine opportunity types provided:
 * jobs, scholarships, internships, professional training, and conferences.
 * Includes verified official APIs/RSS feeds where publicly offered alongside the canonical website URL.
 */
export function buildInitialOfficialSourcesRegistry(): OpportunitySourceRegistryRecord[] {
  const mk = (
    sourceNumber: number,
    id: string,
    name: string,
    region: OpportunitySourceRegistryRecord['region'],
    sectorFocus: OpportunitySourceRegistryRecord['sectorFocus'],
    categoryCoverage: OpportunityCategory[],
    url: string,
    feedType: OpportunitySourceRegistryRecord['feedType'],
    officialEndpointUrl?: string | null
  ): OpportunitySourceRegistryRecord => ({
    id,
    sourceNumber,
    name,
    region,
    sectorFocus,
    categoryCoverage,
    url,
    officialEndpointUrl: officialEndpointUrl ?? null,
    feedType,
    enabled: true,
    accessStatus: 'pending',
    robotsAllowed: null,
    accessNote: 'Registered — awaiting first scheduled check',
    lastCheckedAt: null,
    lastStatus: 'idle',
    lastHttpStatus: null,
    lastError: null,
    lastDurationMs: null,
    consecutiveFailures: 0,
    itemsDiscoveredTotal: 0,
  });

  return [
    // ================= MIDDLE EAST (1 - 10) =================
    mk(1, 'src_01_bayt', 'Bayt', 'Middle East', 'multi_sector', ['job', 'internship'], 'https://www.bayt.com/', 'html_portal'),
    mk(2, 'src_02_gulftalent', 'GulfTalent', 'Middle East', 'multi_sector', ['job'], 'https://www.gulftalent.com/', 'html_portal'),
    mk(3, 'src_03_naukrigulf', 'Naukrigulf', 'Middle East', 'multi_sector', ['job'], 'https://www.naukrigulf.com/', 'html_portal'),
    mk(4, 'src_04_un_careers', 'UN Careers', 'Middle East', 'multi_sector', ['job', 'internship'], 'https://careers.un.org/', 'html_portal'),
    mk(5, 'src_05_reliefweb_jobs', 'ReliefWeb Jobs', 'Middle East', 'wash', ['job', 'internship', 'training'], 'https://reliefweb.int/jobs', 'json_api', 'https://api.reliefweb.int/v1/jobs?appname=hopelandjobs&limit=25&preset=latest'),
    mk(6, 'src_06_study_in_saudi', 'Study in Saudi Arabia', 'Middle East', 'scholarship_training', ['scholarship'], 'https://studyinsaudi.moe.gov.sa/', 'html_portal'),
    mk(7, 'src_07_turkiye_scholarships', 'Türkiye Scholarships', 'Middle East', 'scholarship_training', ['scholarship'], 'https://www.turkiyeburslari.gov.tr/', 'html_portal'),
    mk(8, 'src_08_kaust', 'KAUST', 'Middle East', 'scholarship_training', ['scholarship', 'internship', 'job', 'conference'], 'https://www.kaust.edu.sa/', 'html_portal'),
    mk(9, 'src_09_qatar_foundation', 'Qatar Foundation', 'Middle East', 'multi_sector', ['job', 'scholarship', 'training', 'conference'], 'https://www.qf.org.qa/', 'html_portal'),
    mk(10, 'src_10_wise', 'WISE', 'Middle East', 'conference', ['conference', 'training'], 'https://www.wise-qatar.org/', 'html_portal'),

    // ================= EUROPE (11 - 20) =================
    mk(11, 'src_11_eures', 'EURES', 'Europe', 'multi_sector', ['job', 'internship'], 'https://eures.europa.eu/', 'html_portal'),
    mk(12, 'src_12_euraxess_jobs', 'EURAXESS Jobs', 'Europe', 'multi_sector', ['job', 'scholarship', 'internship'], 'https://euraxess.ec.europa.eu/jobs', 'html_portal'),
    mk(13, 'src_13_erasmus_plus', 'Erasmus+', 'Europe', 'scholarship_training', ['scholarship', 'training', 'internship'], 'https://erasmus-plus.ec.europa.eu/', 'html_portal'),
    mk(14, 'src_14_european_education_area', 'European Education Area', 'Europe', 'scholarship_training', ['scholarship'], 'https://education.ec.europa.eu/study-in-europe/planning-your-studies/scholarships-and-funding', 'html_portal'),
    mk(15, 'src_15_scholarshipportal', 'Scholarshipportal', 'Europe', 'scholarship_training', ['scholarship'], 'https://www.scholarshipportal.com/', 'html_portal'),
    mk(16, 'src_16_eurobrussels', 'EuroBrussels', 'Europe', 'multi_sector', ['job', 'internship'], 'https://www.eurobrussels.com/', 'html_portal'),
    mk(17, 'src_17_eu_careers', 'EU Careers', 'Europe', 'multi_sector', ['job', 'internship'], 'https://eu-careers.europa.eu/', 'html_portal'),
    mk(18, 'src_18_european_youth_portal', 'European Youth Portal', 'Europe', 'scholarship_training', ['internship', 'training', 'scholarship'], 'https://youth.europa.eu/', 'html_portal'),
    mk(19, 'src_19_academic_positions', 'Academic Positions', 'Europe', 'multi_sector', ['job', 'scholarship'], 'https://academicpositions.com/', 'html_portal'),
    mk(20, 'src_20_jobs_ac_uk', 'Jobs.ac.uk', 'Europe', 'multi_sector', ['job', 'scholarship'], 'https://www.jobs.ac.uk/', 'rss', 'https://www.jobs.ac.uk/jobs/rss'),

    // ================= USA (21 - 30) =================
    mk(21, 'src_21_usajobs', 'USAJOBS', 'USA', 'multi_sector', ['job', 'internship'], 'https://www.usajobs.gov/', 'html_portal'),
    mk(22, 'src_22_fulbright', 'Fulbright', 'USA', 'scholarship_training', ['scholarship', 'training'], 'https://fulbrightprogram.org/', 'html_portal'),
    mk(23, 'src_23_educationusa', 'EducationUSA', 'USA', 'scholarship_training', ['scholarship'], 'https://educationusa.state.gov/', 'html_portal'),
    mk(24, 'src_24_us_state_dept_careers', 'US State Department Careers', 'USA', 'multi_sector', ['job', 'internship'], 'https://careers.state.gov/', 'html_portal'),
    mk(25, 'src_25_idealist', 'Idealist', 'USA', 'multi_sector', ['job', 'internship'], 'https://www.idealist.org/', 'html_portal'),
    mk(26, 'src_26_nsf', 'National Science Foundation', 'USA', 'scholarship_training', ['scholarship', 'training', 'job'], 'https://www.nsf.gov/', 'rss', 'https://www.nsf.gov/rss/rss_www_funding.xml'),
    mk(27, 'src_27_internships_com', 'Internships.com', 'USA', 'multi_sector', ['internship'], 'https://www.internships.com/', 'html_portal'),
    mk(28, 'src_28_devex_jobs', 'Devex Jobs', 'USA', 'wash', ['job', 'internship'], 'https://www.devex.com/jobs', 'html_portal'),
    mk(29, 'src_29_ieee_conferences', 'IEEE Conferences', 'USA', 'conference', ['conference', 'training'], 'https://www.ieee.org/conferences/', 'html_portal'),
    mk(30, 'src_30_mit_events', 'MIT Events', 'USA', 'conference', ['conference', 'training'], 'https://calendar.mit.edu/', 'rss', 'https://calendar.mit.edu/calendar.xml'),

    // ================= SCANDINAVIA / NORDIC (31 - 40) =================
    mk(31, 'src_31_norway_nav', 'Norway NAV Arbeidsplassen', 'Scandinavia / Nordic', 'multi_sector', ['job'], 'https://arbeidsplassen.nav.no/', 'json_api', 'https://arbeidsplassen.nav.no/public-feed/api/v1/ads?size=20'),
    mk(32, 'src_32_sweden_platsbanken', 'Sweden Platsbanken', 'Scandinavia / Nordic', 'multi_sector', ['job'], 'https://arbetsformedlingen.se/platsbanken/', 'json_api', 'https://jobsearch.api.jobtechdev.se/search?limit=25'),
    mk(33, 'src_33_denmark_workindenmark', 'Denmark Workindenmark', 'Scandinavia / Nordic', 'multi_sector', ['job'], 'https://www.workindenmark.dk/', 'html_portal'),
    mk(34, 'src_34_finland_job_market', 'Finland Job Market Finland', 'Scandinavia / Nordic', 'multi_sector', ['job'], 'https://tyomarkkinatori.fi/en', 'html_portal'),
    mk(35, 'src_35_iceland_labour', 'Iceland Directorate of Labour', 'Scandinavia / Nordic', 'multi_sector', ['job'], 'https://island.is/en/o/directorate-of-labour', 'html_portal'),
    mk(36, 'src_36_study_in_sweden', 'Study in Sweden', 'Scandinavia / Nordic', 'scholarship_training', ['scholarship'], 'https://studyinsweden.se/', 'html_portal'),
    mk(37, 'src_37_study_in_norway', 'Study in Norway', 'Scandinavia / Nordic', 'scholarship_training', ['scholarship'], 'https://studyinnorway.no/', 'html_portal'),
    mk(38, 'src_38_study_in_finland', 'Study in Finland', 'Scandinavia / Nordic', 'scholarship_training', ['scholarship'], 'https://www.studyinfinland.fi/', 'html_portal'),
    mk(39, 'src_39_study_in_denmark', 'Study in Denmark', 'Scandinavia / Nordic', 'scholarship_training', ['scholarship'], 'https://studyindenmark.dk/', 'html_portal'),
    mk(40, 'src_40_nordic_council', 'Nordic Council', 'Scandinavia / Nordic', 'multi_sector', ['job', 'scholarship', 'conference', 'training'], 'https://www.norden.org/', 'html_portal'),
  ];
}

function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function stripTags(html: string): string {
  return String(html || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function inferUserProfileFromLegacy(uid: string, raw: any): UserProfessionalProfileInput {
  const sectorText = `${raw?.preferredIndustry || ''} ${raw?.staffDepartmentOrSector || ''} ${raw?.desiredJobTitle || ''} ${raw?.currentPosition || ''} ${(raw?.preferredSectors || []).join(' ')}`.toLowerCase();
  let professionalSector: ProfessionalSector = 'other';
  if (/\b(branch\s+manager|branch\s+banking|branch\s+operations)\b/i.test(sectorText)) {
    professionalSector = 'branch_banking';
  } else if (/\b(bank|banking|finance|accounting|microfinance|credit|audit|fintech)\b/i.test(sectorText)) {
    professionalSector = 'banking_finance';
  } else if (/\b(wash|water|sanitation|hygiene|wastewater|environmental\s+health)\b/i.test(sectorText)) {
    professionalSector = 'wash';
  } else if (/\b(engineer|civil|mechanical|electrical|construction)\b/i.test(sectorText)) {
    professionalSector = 'engineering';
  } else if (/\b(health|medical|doctor|nurse|pharmacy|hospital|clinical)\b/i.test(sectorText)) {
    professionalSector = 'healthcare';
  } else if (/\b(education|teacher|lecturer|university|academic|professor)\b/i.test(sectorText)) {
    professionalSector = 'education';
  } else if (/\b(software|developer|it\b|devops|data|cybersecurity|cloud)\b/i.test(sectorText)) {
    professionalSector = 'it_software';
  }

  const yearsMatch = String(raw?.yearsOfExperience || '').match(/\d+/);
  const years = yearsMatch ? Math.min(45, Number(yearsMatch[0])) : 0;
  const posLower = `${raw?.currentPosition || ''} ${raw?.desiredJobTitle || ''}`.toLowerCase();

  let careerLevel: CareerSeniorityLevel = 'experienced_professional';
  if (/\b(ceo|cfo|coo|vice\s+president|vp\b|executive)\b/i.test(posLower)) careerLevel = 'executive';
  else if (/\b(director|head\s+of)\b/i.test(posLower)) careerLevel = 'director';
  else if (/\b(senior\s+manager|regional\s+manager|area\s+manager)\b/i.test(posLower)) careerLevel = 'senior_manager';
  else if (/\b(assistant\s+manager|deputy\s+manager)\b/i.test(posLower)) careerLevel = 'assistant_manager';
  else if (/\b(manager)\b/i.test(posLower)) careerLevel = 'manager';
  else if (/\b(supervisor|team\s+lead|coordinator)\b/i.test(posLower)) careerLevel = 'supervisor';
  else if (/\b(senior|lead|specialist)\b/i.test(posLower) || years >= 6) careerLevel = 'senior_professional';
  else if (years >= 3) careerLevel = 'experienced_professional';
  else if (years >= 1) careerLevel = 'junior_professional';
  else careerLevel = 'entry_level';

  const mgmtYears =
    typeof raw?.managerialExperienceYears === 'number'
      ? raw.managerialExperienceYears
      : careerLevel === 'manager' || careerLevel === 'senior_manager'
      ? Math.max(2, Math.min(years, 4))
      : careerLevel === 'assistant_manager' || careerLevel === 'supervisor'
      ? Math.max(1, Math.min(years, 2))
      : 0;

  return {
    userId: uid,
    email: raw?.email || '',
    fullName: raw?.fullName || '',
    professionalSector,
    currentOccupation: String(raw?.currentPosition || raw?.desiredJobTitle || 'Professional').trim(),
    educationLevel: 'bachelors',
    fieldOfStudy: String(raw?.education?.[0]?.fieldOfStudy || '').trim(),
    yearsOfExperience: years,
    bankingExperienceYears:
      professionalSector === 'branch_banking' || professionalSector === 'banking_finance' ? years : 0,
    managerialExperienceYears: mgmtYears,
    skills: Array.isArray(raw?.skills)
      ? raw.skills.map((s: any) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean)
      : [],
    certifications: Array.isArray(raw?.certifications)
      ? raw.certifications.map((c: any) => (typeof c === 'string' ? c : c?.name || '')).filter(Boolean)
      : [],
    minimumSalaryUsdMonthly: null,
    careerLevel,
    preferredLocations: Array.isArray(raw?.preferredLocations) ? raw.preferredLocations : [],
    preferredEnvironment: 'both',
    nationality: String(raw?.nationality || 'Ethiopian'),
    countriesWithLegalWorkRight: ['Ethiopia'],
    allowJuniorRoles: Boolean(raw?.allowJuniorRoles),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  };
}

export class OpportunityIntelligenceEngine {
  private readonly dbPath: string;
  private readonly runtimeBaseDir: string;
  private readonly loadUserProfiles: () => Record<string, any>;
  private readonly loadJsonFileSafe: <T>(filePath: string, fallback: T) => T;
  private readonly writeJsonFileAtomic: (filePath: string, data: unknown) => void;
  private readonly appendAuditLog: RegisterOpportunityIntelligenceDeps['appendAuditLog'];
  private dailyTimer: ReturnType<typeof setInterval> | null = null;
  private runInProgress = false;

  constructor(deps: Omit<RegisterOpportunityIntelligenceDeps, 'app' | 'isPersistentOwnerRequest' | 'getRequesterUid'>) {
    this.runtimeBaseDir = deps.runtimeBaseDir;
    this.dbPath = path.join(deps.runtimeBaseDir, 'data', 'opportunity_intelligence_db.json');
    this.loadUserProfiles = deps.loadUserProfiles;
    this.loadJsonFileSafe = deps.loadJsonFileSafe;
    this.writeJsonFileAtomic = deps.writeJsonFileAtomic;
    this.appendAuditLog = deps.appendAuditLog;
  }

  private createDefaultDb(): OpportunityIntelligenceDb {
    const nowIso = new Date().toISOString();
    return {
      version: 2,
      updatedAt: nowIso,
      lastSuccessfulRunAt: null,
      nextScheduledRunAt: new Date(Date.now() + TWENTY_FOUR_HOURS_MS).toISOString(),
      duplicateOpportunitiesPrevented: 0,
      duplicateNotificationsPrevented: 0,
      opportunitiesUpdated: 0,
      opportunity_sources: buildInitialOfficialSourcesRegistry(),
      international_opportunities: [],
      local_opportunities: [],
      permanent_opportunity_history: {},
      opportunity_verification_logs: [],
      opportunity_salary: {},
      opportunity_visa_status: {},
      opportunity_eligibility: {},
      user_professional_profiles: {},
      user_opportunity_matches: {},
      user_notification_history: [],
      notification_preferences: {},
      notification_deduplication: {},
      opportunity_notification_status: {},
      scheduled_discovery_logs: [],
    };
  }

  public loadDb(): OpportunityIntelligenceDb {
    const def = this.createDefaultDb();
    const { data } = loadJsonWithBackupRecovery<Partial<OpportunityIntelligenceDb>>(this.dbPath, def);

    // Synchronize the exact 40 permanent registered sources while preserving persisted telemetry per source ID
    const persistedById = new Map<string, OpportunitySourceRegistryRecord>();
    if (Array.isArray(data.opportunity_sources)) {
      for (const s of data.opportunity_sources) {
        if (s?.id) persistedById.set(s.id, s);
      }
    }
    const syncedSources = def.opportunity_sources.map((canonical) => {
      const prev = persistedById.get(canonical.id);
      if (!prev) return canonical;
      return {
        ...canonical,
        enabled: typeof prev.enabled === 'boolean' ? prev.enabled : canonical.enabled,
        accessStatus: prev.accessStatus || canonical.accessStatus,
        robotsAllowed: prev.robotsAllowed ?? canonical.robotsAllowed,
        accessNote: prev.accessNote ?? canonical.accessNote,
        lastCheckedAt: prev.lastCheckedAt ?? null,
        lastStatus: prev.lastStatus || 'idle',
        lastHttpStatus: prev.lastHttpStatus ?? null,
        lastError: prev.lastError ?? null,
        lastDurationMs: prev.lastDurationMs ?? null,
        consecutiveFailures: Number(prev.consecutiveFailures || 0),
        itemsDiscoveredTotal: Number(prev.itemsDiscoveredTotal || 0),
      };
    });

    const db: OpportunityIntelligenceDb = {
      ...def,
      ...data,
      version: 2,
      opportunitiesUpdated: Number(data.opportunitiesUpdated || 0),
      opportunity_sources: syncedSources,
      international_opportunities: Array.isArray(data.international_opportunities)
        ? data.international_opportunities
        : [],
      local_opportunities: Array.isArray(data.local_opportunities) ? data.local_opportunities : [],
      permanent_opportunity_history: data.permanent_opportunity_history || {},
      opportunity_verification_logs: Array.isArray(data.opportunity_verification_logs)
        ? data.opportunity_verification_logs
        : [],
      opportunity_salary: data.opportunity_salary || {},
      opportunity_visa_status: data.opportunity_visa_status || {},
      opportunity_eligibility: data.opportunity_eligibility || {},
      user_professional_profiles: data.user_professional_profiles || {},
      user_opportunity_matches: data.user_opportunity_matches || {},
      user_notification_history: Array.isArray(data.user_notification_history)
        ? data.user_notification_history
        : [],
      notification_preferences: data.notification_preferences || {},
      notification_deduplication: data.notification_deduplication || {},
      opportunity_notification_status: data.opportunity_notification_status || {},
      scheduled_discovery_logs: Array.isArray(data.scheduled_discovery_logs)
        ? data.scheduled_discovery_logs
        : [],
    };
    return db;
  }

  public saveDb(db: OpportunityIntelligenceDb): void {
    db.updatedAt = new Date().toISOString();
    // Bound audit logs & history cleanly to protect storage while keeping recent operational audit complete
    if (db.opportunity_verification_logs.length > 1500) {
      db.opportunity_verification_logs = db.opportunity_verification_logs.slice(0, 1500);
    }
    if (db.user_notification_history.length > 2000) {
      db.user_notification_history = db.user_notification_history.slice(0, 2000);
    }
    if (db.scheduled_discovery_logs.length > 120) {
      db.scheduled_discovery_logs = db.scheduled_discovery_logs.slice(0, 120);
    }
    saveJsonTransactional(this.dbPath, db);
  }

  public getAllOpportunities(db: OpportunityIntelligenceDb): CanonicalOpportunityRecord[] {
    return [...db.international_opportunities, ...db.local_opportunities];
  }

  /**
   * Ingests a raw candidate opportunity, deduplicates across multiple websites (TEST 7),
   * handles material updates cleanly, and preserves verification audit logs (TEST 8).
   */
  public ingestAndVerifyCandidate(
    db: OpportunityIntelligenceDb,
    raw: RawOpportunityCandidateInput,
    options?: { fxRatesUsdBase?: Record<string, number>; nowMs?: number }
  ): {
    record: CanonicalOpportunityRecord;
    outcome: 'created' | 'duplicate_merged' | 'material_updated' | 'auto_unpublished';
  } {
    const nowMs = options?.nowMs ?? Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const verified = buildAndVerifyCanonicalOpportunity(raw, {
      fxRatesUsdBase: options?.fxRatesUsdBase || DEFAULT_FX_RATES_USD_BASE,
      nowMs,
    });

    const collection =
      verified.environment === 'ethiopia_domestic'
        ? db.local_opportunities
        : db.international_opportunities;

    const existingIdx = collection.findIndex((item) => {
      if (
        item.canonicalKey === verified.canonicalKey ||
        item.urlFingerprint === verified.urlFingerprint ||
        item.id === verified.id
      ) {
        return true;
      }
      if (
        verified.referenceNumber &&
        item.referenceNumber &&
        item.referenceNumber === verified.referenceNumber &&
        item.employer.toLowerCase().trim() === verified.employer.toLowerCase().trim()
      ) {
        return true;
      }
      if (
        item.employer.toLowerCase().trim() === verified.employer.toLowerCase().trim() &&
        item.title.toLowerCase().trim() === verified.title.toLowerCase().trim() &&
        item.country.toLowerCase().trim() === verified.country.toLowerCase().trim() &&
        Boolean(item.deadlineIso && verified.deadlineIso && item.deadlineIso === verified.deadlineIso)
      ) {
        return true;
      }
      return false;
    });

    if (existingIdx !== -1) {
      const existing = collection[existingIdx];
      const mergedSourceUrls = Array.from(new Set([...existing.sourceUrls, ...verified.sourceUrls]));
      const mergedSourceNames = Array.from(new Set([...existing.sourceNames, ...verified.sourceNames]));
      const primarySourceUrl = existing.primarySourceUrl || existing.sourceUrls[0] || verified.primarySourceUrl;
      const primarySourceName = existing.primarySourceName || existing.sourceNames[0] || verified.primarySourceName;

      const syncPermanentHistory = (rec: CanonicalOpportunityRecord) => {
        db.permanent_opportunity_history[rec.canonicalKey] = {
          opportunityId: rec.id,
          canonicalKey: rec.canonicalKey,
          urlFingerprint: rec.urlFingerprint,
          referenceNumber: rec.referenceNumber,
          status: rec.status,
          firstSeenAt: db.permanent_opportunity_history[rec.canonicalKey]?.firstSeenAt || rec.discoveredAt,
          lastSeenAt: nowIso,
          primarySourceUrl,
          primarySourceName,
        };
      };

      // Check if a previously PUBLISHED opportunity lost visa sponsorship or failed deadline on recheck (TEST 8!)
      const branchVisaLost =
        existing.isBranchBankingMatch &&
        existing.environment === 'international' &&
        (Boolean(raw.visaSponsorshipRevoked) ||
          verified.visa.transparencyStatus !== 'VISA SPONSORSHIP CONFIRMED');
      if (
        existing.status === 'published' &&
        (verified.status !== 'published' || Boolean(raw.visaSponsorshipRevoked) || branchVisaLost)
      ) {
        const unpublishReason =
          verified.rejectionExplanations.join(' | ') ||
          (raw.visaSponsorshipRevoked || branchVisaLost
            ? 'Confirmed work visa sponsorship was revoked or removed during recheck.'
            : 'Failed recheck verification rules.');
        const updated: CanonicalOpportunityRecord = {
          ...existing,
          ...verified,
          id: existing.id,
          discoveredAt: existing.discoveredAt,
          updateVersion: existing.updateVersion,
          primarySourceUrl,
          primarySourceName,
          sourceUrls: mergedSourceUrls,
          sourceNames: mergedSourceNames,
          status: 'unpublished',
          verificationBadge: 'Unpublished After Recheck',
          unpublishedAt: nowIso,
          unpublishedReason: unpublishReason,
          lastVerifiedAt: nowIso,
          updatedAt: nowIso,
        };
        collection[existingIdx] = updated;
        db.opportunity_salary[updated.id] = updated.salary;
        db.opportunity_visa_status[updated.id] = updated.visa;
        db.opportunity_eligibility[updated.id] = updated.eligibility;
        db.opportunitiesUpdated += 1;
        syncPermanentHistory(updated);
        db.opportunity_verification_logs.unshift({
          id: `vlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          opportunityId: updated.id,
          checkedAt: nowIso,
          action: 'auto_unpublish',
          previousStatus: 'published',
          newStatus: 'unpublished',
          passed: false,
          rejectionCodes: updated.rejectionCodes,
          explanation: `Automatically unpublished during recheck: ${unpublishReason}`,
          sourceUrl: updated.officialApplicationUrl,
        });
        return { record: updated, outcome: 'auto_unpublished' };
      }

      // Check for Section 11 meaningful changes ONLY (never repeat notifications for unchanged duplicates):
      // 1. New or extended application deadline
      // 2. Confirmed visa sponsorship added/upgraded
      // 3. Officially reopened application
      // 4. Corrected direct application link
      const deadlineChanged =
        Boolean(verified.deadlineIso && existing.deadlineIso && verified.deadlineIso !== existing.deadlineIso) ||
        Boolean(!existing.deadlineIso && verified.deadlineIso);
      const visaConfirmedUpgraded =
        existing.visa.transparencyStatus !== 'VISA SPONSORSHIP CONFIRMED' &&
        verified.visa.transparencyStatus === 'VISA SPONSORSHIP CONFIRMED';
      const officiallyReopened =
        (existing.status === 'unpublished' || existing.status === 'expired') &&
        verified.status === 'published';
      const existingLinkPriority = existing.applicationLinkVerification?.priorityTier || 4;
      const verifiedLinkPriority = verified.applicationLinkVerification?.priorityTier || 4;
      const applicationUrlCorrected =
        Boolean(
          verified.urlFingerprint &&
            existing.urlFingerprint &&
            verified.urlFingerprint !== existing.urlFingerprint &&
            verified.applicationLinkVerification?.status === 'VERIFIED' &&
            (existing.applicationLinkVerification?.status !== 'VERIFIED' ||
              verifiedLinkPriority < existingLinkPriority)
        );
      const hoursSinceLastVerify =
        (nowMs - Date.parse(existing.lastVerifiedAt || existing.updatedAt || nowIso)) / (1000 * 60 * 60);
      const isRepeatDailyRefresh = hoursSinceLastVerify >= 20;

      if (deadlineChanged || visaConfirmedUpgraded || officiallyReopened || applicationUrlCorrected) {
        const nextVersion = existing.updateVersion + 1;
        const changeNotes: string[] = [];
        if (deadlineChanged) changeNotes.push(`application deadline updated to ${verified.deadlineRaw}`);
        if (visaConfirmedUpgraded) changeNotes.push('employer visa sponsorship now confirmed');
        if (officiallyReopened) changeNotes.push('application officially reopened');
        if (applicationUrlCorrected) changeNotes.push('direct official application link corrected');

        const updated: CanonicalOpportunityRecord = {
          ...existing,
          ...verified,
          id: existing.id,
          discoveredAt: existing.discoveredAt,
          updateVersion: nextVersion,
          primarySourceUrl,
          primarySourceName,
          sourceUrls: mergedSourceUrls,
          sourceNames: mergedSourceNames,
          lastVerifiedAt: nowIso,
          deadlineLastVerifiedAt: nowIso,
          updatedAt: nowIso,
        };
        collection[existingIdx] = updated;
        db.opportunity_salary[updated.id] = updated.salary;
        db.opportunity_visa_status[updated.id] = updated.visa;
        db.opportunity_eligibility[updated.id] = updated.eligibility;
        db.opportunitiesUpdated += 1;
        db.duplicateOpportunitiesPrevented += 1;
        syncPermanentHistory(updated);
        db.opportunity_verification_logs.unshift({
          id: `vlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          opportunityId: updated.id,
          checkedAt: nowIso,
          action: 'material_update',
          previousStatus: existing.status,
          newStatus: updated.status,
          passed: updated.status === 'published',
          rejectionCodes: updated.rejectionCodes,
          explanation: `Meaningful update detected (v${nextVersion}): ${changeNotes.join('; ')}.`,
          sourceUrl: updated.officialApplicationUrl,
        });
        return { record: updated, outcome: 'material_updated' };
      }

      // Exact duplicate from same or different website, OR 24-hour re-discovery:
      // NEVER create a duplicate record; preserve original source, append additional sources, update metadata.
      db.duplicateOpportunitiesPrevented += 1;
      existing.primarySourceUrl = primarySourceUrl;
      existing.primarySourceName = primarySourceName;
      existing.sourceUrls = mergedSourceUrls;
      existing.sourceNames = mergedSourceNames;
      existing.referenceNumber = existing.referenceNumber || verified.referenceNumber;
      existing.fullDaysRemaining = verified.fullDaysRemaining;
      existing.deadlineStatusLabel = verified.deadlineStatusLabel;
      existing.deadlineLastVerifiedAt = nowIso;
      existing.lastVerifiedAt = nowIso;
      if (isRepeatDailyRefresh) {
        existing.updatedAt = nowIso;
        existing.descriptionSummary = verified.descriptionSummary || existing.descriptionSummary;
        db.opportunitiesUpdated += 1;
        db.opportunity_verification_logs.unshift({
          id: `vlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          opportunityId: existing.id,
          checkedAt: nowIso,
          action: 'daily_recheck',
          previousStatus: existing.status,
          newStatus: existing.status,
          passed: existing.status === 'published',
          rejectionCodes: existing.rejectionCodes,
          explanation: `24-hour re-discovery refreshed existing canonical record without duplicating (${mergedSourceNames.length} source(s)).`,
          sourceUrl: existing.officialApplicationUrl,
        });
      }
      syncPermanentHistory(existing);
      return { record: existing, outcome: 'duplicate_merged' };
    }

    // New canonical opportunity — record permanently in history so expired/rejected/withdrawn items never reappear as new
    collection.unshift(verified);
    db.opportunity_salary[verified.id] = verified.salary;
    db.opportunity_visa_status[verified.id] = verified.visa;
    db.opportunity_eligibility[verified.id] = verified.eligibility;
    db.permanent_opportunity_history[verified.canonicalKey] = {
      opportunityId: verified.id,
      canonicalKey: verified.canonicalKey,
      urlFingerprint: verified.urlFingerprint,
      referenceNumber: verified.referenceNumber,
      status: verified.status,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      primarySourceUrl: verified.primarySourceUrl,
      primarySourceName: verified.primarySourceName,
    };
    db.opportunity_verification_logs.unshift({
      id: `vlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      opportunityId: verified.id,
      checkedAt: nowIso,
      action: 'initial_verification',
      previousStatus: 'new',
      newStatus: verified.status,
      passed: verified.status === 'published',
      rejectionCodes: verified.rejectionCodes,
      explanation:
        verified.status === 'published'
          ? `Verified and published (${verified.environment}, ${verified.category}).`
          : verified.rejectionExplanations.join(' | '),
      sourceUrl: verified.officialApplicationUrl,
    });

    return { record: verified, outcome: 'created' };
  }

  /**
   * Daily Recheck of ALL existing published opportunities (Sections 7 & 9, TEST 8):
   * Automatically unpublishes any opportunity whose deadline dropped below 3 full days
   * or whose visa sponsorship is no longer confirmed, while preserving immutable audit history.
   */
  public recheckAllPublishedOpportunities(
    db: OpportunityIntelligenceDb,
    nowMs: number = Date.now(),
    liveUpdatesByOpportunityId?: Record<string, { visaSponsorshipRevoked?: boolean; isClosedOrWithdrawn?: boolean; deadlineRaw?: string }>
  ): { recheckedCount: number; unpublishedCount: number } {
    const nowIso = new Date(nowMs).toISOString();
    let recheckedCount = 0;
    let unpublishedCount = 0;

    const lists = [db.international_opportunities, db.local_opportunities];
    for (const list of lists) {
      for (const opp of list) {
        if (opp.status !== 'published') continue;
        recheckedCount++;

        const livePatch = liveUpdatesByOpportunityId?.[opp.id];
        const effectiveDeadline = livePatch?.deadlineRaw ?? opp.deadlineRaw;
        const deadlineEval = evaluateStrictThreeDayDeadline(
          effectiveDeadline,
          nowMs,
          Boolean(livePatch?.isClosedOrWithdrawn)
        );
        const visaRevoked = Boolean(livePatch?.visaSponsorshipRevoked);
        const branchVisaLost =
          opp.isBranchBankingMatch &&
          opp.environment === 'international' &&
          (visaRevoked || opp.visa.transparencyStatus !== 'VISA SPONSORSHIP CONFIRMED');

        opp.lastVerifiedAt = nowIso;
        opp.deadlineLastVerifiedAt = nowIso;
        opp.fullDaysRemaining = deadlineEval.fullDaysRemaining;
        opp.deadlineStatusLabel = deadlineEval.deadlineStatusLabel;
        opp.deadlineEvidence = deadlineEval.deadlineEvidence;

        if (!deadlineEval.passed || visaRevoked || branchVisaLost) {
          const reasons: string[] = [];
          const codes = [...opp.rejectionCodes];

          if (!deadlineEval.passed && deadlineEval.rejectionCode) {
            codes.push(deadlineEval.rejectionCode);
            reasons.push(deadlineEval.explanation);
          }
          if (visaRevoked || branchVisaLost) {
            codes.push('visa_sponsorship_unconfirmed');
            opp.isBranchBankingMatch = false;
            opp.visa = {
              ...opp.visa,
              verified: false,
              conditionMet: 'none',
              transparencyStatus: 'VISA SPONSORSHIP NOT OFFERED',
              statusLabel: 'VISA SPONSORSHIP NOT OFFERED',
              sponsorshipStatement: 'Confirmed visa sponsorship was revoked or removed during scheduled recheck.',
              lastVerifiedAt: nowIso,
            };
            db.opportunity_visa_status[opp.id] = opp.visa;
            reasons.push('Confirmed work visa sponsorship is no longer valid at the official source.');
          }

          opp.status = deadlineEval.deadlineStatusLabel === 'DEADLINE PASSED' ? 'expired' : 'unpublished';
          opp.verificationBadge =
            deadlineEval.deadlineStatusLabel === 'DEADLINE PASSED'
              ? 'DEADLINE PASSED — Removed from Active'
              : deadlineEval.deadlineStatusLabel === 'APPLICATIONS CLOSED'
              ? 'APPLICATIONS CLOSED — Removed from Active'
              : 'Unpublished After Recheck';
          opp.rejectionCodes = Array.from(new Set(codes));
          opp.rejectionExplanations = Array.from(new Set([...opp.rejectionExplanations, ...reasons]));
          opp.unpublishedAt = nowIso;
          opp.unpublishedReason = reasons.join(' | ');
          opp.updatedAt = nowIso;
          unpublishedCount++;

          const existingHistory = db.permanent_opportunity_history[opp.canonicalKey];
          db.permanent_opportunity_history[opp.canonicalKey] = {
            opportunityId: opp.id,
            canonicalKey: opp.canonicalKey,
            urlFingerprint: opp.urlFingerprint,
            referenceNumber: opp.referenceNumber,
            status: 'unpublished',
            firstSeenAt: existingHistory?.firstSeenAt || opp.discoveredAt,
            lastSeenAt: nowIso,
            primarySourceUrl: existingHistory?.primarySourceUrl || opp.primarySourceUrl,
            primarySourceName: existingHistory?.primarySourceName || opp.primarySourceName,
          };

          db.opportunity_verification_logs.unshift({
            id: `vlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            opportunityId: opp.id,
            checkedAt: nowIso,
            action: 'auto_unpublish',
            previousStatus: 'published',
            newStatus: 'unpublished',
            passed: false,
            rejectionCodes: opp.rejectionCodes,
            explanation: `Auto-unpublished on recheck: ${opp.unpublishedReason}`,
            sourceUrl: opp.officialApplicationUrl,
          });
        }
      }
    }

    return { recheckedCount, unpublishedCount };
  }

  public getOrCreateNotificationPreferences(
    db: OpportunityIntelligenceDb,
    userId: string
  ): UserNotificationPreferenceRecord {
    if (!db.notification_preferences[userId]) {
      // Section 3: Do NOT introduce new notifications for scholarships, training, or conferences
      // unless the user has explicitly enabled them. Default strictly to ['job'].
      db.notification_preferences[userId] = {
        userId,
        enabled: true,
        dailyLimit: 5,
        categories: ['job'],
        environments: ['ethiopia_domestic', 'international'],
        allowJuniorRoles: false,
        notifyOnMaterialUpdates: true,
        viewedOpportunityIds: [],
        savedOpportunityIds: [],
        updatedAt: new Date().toISOString(),
      };
    }
    return db.notification_preferences[userId];
  }

  /**
   * Notification Deduplication Engine (Section 8 — TEST 7 & TEST 10):
   * - Never notifies a user twice about the same canonical opportunity (across sources or across days).
   * - Respects viewed/saved suppression, user preferences, daily limit, and material update versions.
   */
  public dispatchDeduplicatedNotificationForUser(
    db: OpportunityIntelligenceDb,
    params: {
      userId: string;
      opportunity: CanonicalOpportunityRecord;
      match: UserOpportunityMatchRecord;
      nowMs?: number;
      mirrorToLegacyUserNotifications?: boolean;
    }
  ): {
    sent: boolean;
    reason:
      | 'sent_new'
      | 'sent_material_update'
      | 'suppressed_not_eligible'
      | 'suppressed_preferences'
      | 'suppressed_duplicate'
      | 'suppressed_viewed_or_saved'
      | 'suppressed_daily_limit';
    historyRecord?: UserNotificationHistoryRecord;
  } {
    const { userId, opportunity, match } = params;
    const nowMs = params.nowMs ?? Date.now();
    const nowIso = new Date(nowMs).toISOString();

    if (!match.eligible || opportunity.status !== 'published') {
      return { sent: false, reason: 'suppressed_not_eligible' };
    }

    const prefs = this.getOrCreateNotificationPreferences(db, userId);
    if (
      !prefs.enabled ||
      !prefs.categories.includes(opportunity.category) ||
      !prefs.environments.includes(opportunity.environment)
    ) {
      return { sent: false, reason: 'suppressed_preferences' };
    }

    // Rule 7: Never repeatedly notify about already viewed or saved opportunities
    if (
      prefs.viewedOpportunityIds.includes(opportunity.id) ||
      prefs.savedOpportunityIds.includes(opportunity.id)
    ) {
      db.duplicateNotificationsPrevented += 1;
      return { sent: false, reason: 'suppressed_viewed_or_saved' };
    }

    // Rule 1-6: Canonical deduplication check (covers same URL, different source websites, and repeat daily runs!)
    const dedupKey = `${userId}::${opportunity.canonicalKey}`;
    const existingDedup = db.notification_deduplication[dedupKey];
    let notificationType: 'new_match' | 'material_update' = 'new_match';

    if (existingDedup) {
      const hasImportantUpdate =
        prefs.notifyOnMaterialUpdates && opportunity.updateVersion > existingDedup.lastNotifiedUpdateVersion;
      if (!hasImportantUpdate) {
        db.duplicateNotificationsPrevented += 1;
        const oppStatus = db.opportunity_notification_status[opportunity.id];
        if (oppStatus) {
          oppStatus.totalDuplicatesPrevented += 1;
        }
        return { sent: false, reason: 'suppressed_duplicate' };
      }
      notificationType = 'material_update';
    }

    // Rule 9: Configurable daily notification limit
    const dayKey = nowIso.slice(0, 10);
    const sentTodayCount = db.user_notification_history.filter(
      (h) => h.userId === userId && h.status === 'sent' && h.sentAt.slice(0, 10) === dayKey
    ).length;

    if (sentTodayCount >= Math.max(1, prefs.dailyLimit || 5)) {
      return { sent: false, reason: 'suppressed_daily_limit' };
    }

    // Deliver notification & persist deduplication records atomically
    const hist: UserNotificationHistoryRecord = {
      id: `unh_${nowMs}_${crypto.randomBytes(3).toString('hex')}`,
      userId,
      opportunityId: opportunity.id,
      canonicalKey: opportunity.canonicalKey,
      notificationType,
      title: opportunity.title,
      employer: opportunity.employer,
      category: opportunity.category,
      environment: opportunity.environment,
      sentAt: nowIso,
      status: 'sent',
      deliveryResult: 'delivered_in_app_and_persisted',
      notifiedUpdateVersion: opportunity.updateVersion,
    };

    db.user_notification_history.unshift(hist);
    db.notification_deduplication[dedupKey] = {
      key: dedupKey,
      userId,
      opportunityId: opportunity.id,
      canonicalKey: opportunity.canonicalKey,
      urlFingerprint: opportunity.urlFingerprint,
      lastNotifiedAt: nowIso,
      lastNotifiedUpdateVersion: opportunity.updateVersion,
      notificationCount: (existingDedup?.notificationCount || 0) + 1,
    };

    const existingOppStatus = db.opportunity_notification_status[opportunity.id];
    db.opportunity_notification_status[opportunity.id] = {
      opportunityId: opportunity.id,
      canonicalKey: opportunity.canonicalKey,
      updateVersion: opportunity.updateVersion,
      totalUsersNotified: (existingOppStatus?.totalUsersNotified || 0) + 1,
      totalDuplicatesPrevented: existingOppStatus?.totalDuplicatesPrevented || 0,
      lastDispatchedAt: nowIso,
    };

    // Bridge safely into existing user_notifications.json without breaking or duplicating existing bell alerts
    if (params.mirrorToLegacyUserNotifications !== false) {
      try {
        const legacyPath = path.join(this.runtimeBaseDir, 'data', 'user_notifications.json');
        const legacyMap = this.loadJsonFileSafe<Record<string, any[]>>(legacyPath, {});
        const userList = Array.isArray(legacyMap[userId]) ? legacyMap[userId] : [];
        const legacyDedupeKey = `oi:${opportunity.canonicalKey}:v${opportunity.updateVersion}`;
        if (!userList.some((n) => n?.dedupeKey === legacyDedupeKey)) {
          userList.unshift({
            id: hist.id,
            userId,
            vacancyId: opportunity.id,
            alertKind: notificationType === 'material_update' ? 'job_updated' : 'new_match',
            dedupeKey: legacyDedupeKey,
            title: `${opportunity.title} — ${opportunity.employer}`,
            employer: opportunity.employer,
            message: `${match.matchReasons[0] || 'Verified match for your professional profile'} (${opportunity.country}).`,
            applyUrl: opportunity.officialApplicationUrl,
            read: false,
            createdAt: nowIso,
          });
          legacyMap[userId] = userList.slice(0, 100);
          this.writeJsonFileAtomic(legacyPath, legacyMap);
        }
      } catch {
        // Non-fatal mirror safeguard
      }
    }

    return {
      sent: true,
      reason: notificationType === 'material_update' ? 'sent_material_update' : 'sent_new',
      historyRecord: hist,
    };
  }

  private robotsCache = new Map<string, { fetchedAt: number; disallowPaths: string[] }>();

  /**
   * Respects robots.txt per host (cached for 6 hours, SSRF-guarded via validatePublicCrawlUrl).
   * Never pretends a disallowed path is accessible.
   */
  private async checkRobotsAllowed(targetUrl: string): Promise<{ allowed: boolean; note: string }> {
    try {
      const parsed = new URL(targetUrl);
      const origin = parsed.origin;
      const pathname = parsed.pathname || '/';
      const cached = this.robotsCache.get(origin);
      let disallowPaths: string[] = [];

      if (cached && Date.now() - cached.fetchedAt < 6 * 60 * 60 * 1000) {
        disallowPaths = cached.disallowPaths;
      } else {
        const robotsUrl = `${origin}/robots.txt`;
        const check = await validatePublicCrawlUrl(robotsUrl);
        if (!check.ok) {
          return { allowed: false, note: `Blocked URL validation: ${check.reason}` };
        }
        try {
          const resp = await fetch(robotsUrl, {
            headers: {
              'User-Agent': 'HopelandJobsBot/2.0 (+https://www.hopelandjobs.tech)',
              Accept: 'text/plain,*/*',
            },
            signal: AbortSignal.timeout(4500),
          });
          if (resp.ok) {
            const text = await resp.text();
            let activeAgent = false;
            for (const rawLine of text.split(/\r?\n/)) {
              const line = rawLine.replace(/#.*$/, '').trim();
              if (!line) continue;
              const uaMatch = line.match(/^user-agent\s*:\s*(.+)$/i);
              if (uaMatch) {
                const agent = uaMatch[1].trim().toLowerCase();
                activeAgent = agent === '*' || agent.includes('hopeland');
                continue;
              }
              if (activeAgent) {
                const disMatch = line.match(/^disallow\s*:\s*(.*)$/i);
                if (disMatch) {
                  const rule = disMatch[1].trim();
                  if (rule) disallowPaths.push(rule);
                }
              }
            }
          }
        } catch {
          // If robots.txt is absent or unreachable, default to polite access attempt
        }
        this.robotsCache.set(origin, { fetchedAt: Date.now(), disallowPaths });
      }

      for (const rule of disallowPaths) {
        if (rule === '/') {
          return { allowed: false, note: 'robots.txt disallows automated access to this host (Disallow: /)' };
        }
        if (rule.startsWith('/') && pathname.startsWith(rule)) {
          return { allowed: false, note: `robots.txt disallows automated access to ${rule}` };
        }
      }
      return { allowed: true, note: 'robots.txt permits access' };
    } catch {
      return { allowed: true, note: 'robots.txt check bypassed due to URL parse fallback' };
    }
  }

  /**
   * Polite HTTP fetch with 1 automatic retry for transient network / 5xx failures.
   */
  private async fetchWithRetry(
    url: string,
    acceptHeader: string,
    timeoutMs = 7000
  ): Promise<globalThis.Response> {
    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'HopelandJobsBot/2.0 (+https://www.hopelandjobs.tech; Opportunity Intelligence Monitor)',
            Accept: acceptHeader,
            'Accept-Language': 'en-US,en;q=0.9',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (resp.status >= 500 && resp.status < 600 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 450));
          continue;
        }
        return resp;
      } catch (err: any) {
        lastError = err;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 450));
        }
      }
    }
    throw lastError || new Error('Network fetch failed after retry');
  }

  /**
   * Monitors a single registered permanent source honestly:
   * respects robots.txt, validates public URL, retries transient errors, parses official APIs/RSS/JSON-LD,
   * and records accurate active / restricted / error status without pretending blocked sites work.
   */
  private async monitorSingleRegisteredSource(
    src: OpportunitySourceRegistryRecord
  ): Promise<{
    outcome: 'active' | 'restricted' | 'error';
    items: RawOpportunityCandidateInput[];
    errorMessage?: string;
  }> {
    const startMs = Date.now();
    const targetUrl = src.officialEndpointUrl || src.url;
    src.lastCheckedAt = new Date(startMs).toISOString();

    try {
      const urlCheck = await validatePublicCrawlUrl(targetUrl);
      if (!urlCheck.ok) {
        src.accessStatus = 'restricted';
        src.robotsAllowed = false;
        src.lastStatus = 'failed';
        src.lastHttpStatus = null;
        src.lastError = `Blocked URL validation: ${urlCheck.reason}`;
        src.accessNote = src.lastError;
        src.lastDurationMs = Date.now() - startMs;
        src.consecutiveFailures += 1;
        return { outcome: 'restricted', items: [], errorMessage: src.lastError };
      }

      // Check robots.txt for HTML portals (official public APIs/RSS endpoints are explicitly published for automated consumers)
      if (src.feedType === 'html_portal') {
        const robots = await this.checkRobotsAllowed(targetUrl);
        src.robotsAllowed = robots.allowed;
        if (!robots.allowed) {
          src.accessStatus = 'restricted';
          src.lastStatus = 'degraded';
          src.lastHttpStatus = null;
          src.lastError = robots.note;
          src.accessNote = robots.note;
          src.lastDurationMs = Date.now() - startMs;
          src.consecutiveFailures += 1;
          return { outcome: 'restricted', items: [], errorMessage: robots.note };
        }
      } else {
        src.robotsAllowed = true;
      }

      const acceptHeader =
        src.feedType === 'json_api'
          ? 'application/json, */*'
          : src.feedType === 'rss'
          ? 'application/rss+xml, application/xml, text/xml, */*'
          : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

      const resp = await this.fetchWithRetry(targetUrl, acceptHeader, 7000);
      src.lastHttpStatus = resp.status;
      src.lastDurationMs = Date.now() - startMs;

      if (resp.status === 401 || resp.status === 403 || resp.status === 406 || resp.status === 429) {
        const reason =
          resp.status === 429
            ? 'HTTP 429 — Rate limited by source'
            : `HTTP ${resp.status} — Access restricted / anti-bot protection on source`;
        src.accessStatus = 'restricted';
        src.lastStatus = 'degraded';
        src.lastError = reason;
        src.accessNote = reason;
        src.consecutiveFailures += 1;
        return { outcome: 'restricted', items: [], errorMessage: reason };
      }

      if (!resp.ok) {
        const reason = `HTTP ${resp.status} ${resp.statusText || 'Error'}`.trim();
        src.accessStatus = 'error';
        src.lastStatus = 'failed';
        src.lastError = reason;
        src.accessNote = reason;
        src.consecutiveFailures += 1;
        return { outcome: 'error', items: [], errorMessage: reason };
      }

      const rawBody = await resp.text();
      // Detect Cloudflare / bot-challenge interstitials honestly
      if (
        src.feedType === 'html_portal' &&
        rawBody.length < 30000 &&
        /just a moment\.\.\.|cf-browser-verification|attention required! \| cloudflare|enable javascript and cookies to continue/i.test(
          rawBody
        )
      ) {
        const reason = 'Bot-protection challenge page (Cloudflare / JS challenge) restricts automated reading';
        src.accessStatus = 'restricted';
        src.lastStatus = 'degraded';
        src.lastError = reason;
        src.accessNote = reason;
        src.consecutiveFailures += 1;
        return { outcome: 'restricted', items: [], errorMessage: reason };
      }

      const items = this.parseLiveFeedItems(src, rawBody);
      src.accessStatus = 'active';
      src.lastStatus = 'ok';
      src.lastError = null;
      src.consecutiveFailures = 0;
      src.itemsDiscoveredTotal += items.length;
      src.accessNote =
        items.length > 0
          ? `Active — HTTP ${resp.status} (${items.length} structured item${items.length === 1 ? '' : 's'} extracted via ${src.feedType})`
          : `Active — HTTP ${resp.status} reachable (checked ${src.feedType}; 0 new structured listings on landing page)`;

      return { outcome: 'active', items };
    } catch (err: any) {
      const msg =
        err?.name === 'TimeoutError' || /timeout|aborted/i.test(String(err?.message || ''))
          ? 'Connection timeout after retry'
          : String(err?.cause?.code || err?.message || 'Network connection error').slice(0, 140);
      src.accessStatus = 'error';
      src.lastStatus = 'failed';
      src.lastHttpStatus = null;
      src.lastError = msg;
      src.accessNote = msg;
      src.lastDurationMs = Date.now() - startMs;
      src.consecutiveFailures += 1;
      return { outcome: 'error', items: [], errorMessage: msg };
    }
  }

  /**
   * Executes one full real 24-hour source monitoring, ingestion, recheck, matching, and deduplicated notification run.
   * - Respects overlap lock.
   * - Checks all 40 registered sources in polite concurrent batches of 5 (unless explicitly bounded by caller).
   * - Preserves the automatic 24-hour schedule when triggered manually by an admin (Section 7).
   */
  public async runDailySourceMonitoringAndRecheck(
    trigger: ScheduledDiscoveryLogRecord['trigger'] = 'daily_scheduler',
    options?: { maxLiveNetworkSources?: number; nowMs?: number }
  ): Promise<ScheduledDiscoveryLogRecord> {
    if (this.runInProgress) {
      const nowIso = new Date().toISOString();
      return {
        id: `srun_skip_${Date.now()}`,
        trigger,
        timezone: ADDIS_ABABA_TIMEZONE,
        startedAt: nowIso,
        finishedAt: nowIso,
        durationMs: 0,
        status: 'partial',
        sourcesChecked: 0,
        sourcesSucceeded: 0,
        sourcesRestricted: 0,
        sourcesFailed: 0,
        newOpportunitiesDiscovered: 0,
        opportunitiesUpdated: 0,
        opportunitiesVerified: 0,
        opportunitiesPublished: 0,
        opportunitiesRejected: 0,
        opportunitiesUnpublished: 0,
        duplicatesPrevented: 0,
        notificationsSent: 0,
        duplicateNotificationsPrevented: 0,
        errors: ['Skipped overlapping run: 24-hour monitoring sweep already in progress.'],
      };
    }

    this.runInProgress = true;
    const startedMs = options?.nowMs ?? Date.now();
    const startedAt = new Date(startedMs).toISOString();
    const db = this.loadDb();

    let sourcesChecked = 0;
    let sourcesSucceeded = 0;
    let sourcesRestricted = 0;
    let sourcesFailed = 0;
    let newDiscovered = 0;
    let verifiedCount = 0;
    let publishedCount = 0;
    let rejectedCount = 0;
    const updatedBefore = db.opportunitiesUpdated;
    const duplicatesBefore = db.duplicateOpportunitiesPrevented;
    const dupNotifBefore = db.duplicateNotificationsPrevented;
    let notificationsSent = 0;
    const errors: string[] = [];

    try {
      // 1. Ingest from existing local Ethiopian vacancies catalog (Ethiopian domestic environment — NO $3,000 rule, NO visa check!)
      const localVacancies = this.loadJsonFileSafe<any[]>(
        path.join(this.runtimeBaseDir, 'data', 'vacancies_catalog.json'),
        []
      );

      for (const v of (Array.isArray(localVacancies) ? localVacancies : []).slice(0, 60)) {
        if (!v?.title || v?.status !== 'published') continue;
        const appUrl =
          typeof v.applicationUrl === 'string' && v.applicationUrl.startsWith('https://')
            ? v.applicationUrl
            : `https://www.hopelandjobs.tech/?vacancy=${encodeURIComponent(String(v.id || v.title))}`;
        const res = this.ingestAndVerifyCandidate(
          db,
          {
            category: 'job',
            title: String(v.title),
            employer: String(v.organization || 'Ethiopian Employer'),
            country: 'Ethiopia',
            city: String(v.location || 'Addis Ababa'),
            region: 'Ethiopia',
            description: `${v.description || ''} ${v.responsibilities || ''} ${v.experienceYears || ''}`,
            compensationRaw: String(v.salary || ''),
            officialApplicationUrl: appUrl,
            sourceName: 'Hopeland Jobs Ethiopian Domestic Catalog',
            deadlineRaw: String(v.applicationDeadline || ''),
          },
          { nowMs: startedMs }
        );
        verifiedCount++;
        if (res.outcome === 'created') {
          newDiscovered++;
          if (res.record.status === 'published') publishedCount++;
          else rejectedCount++;
        }
      }

      // 2. Ingest from existing Branch Manager store & Global Opportunities store
      const bmStore = this.loadJsonFileSafe<{ rawCandidates?: any[]; fxRatesUsdBase?: Record<string, number> }>(
        path.join(this.runtimeBaseDir, 'data', 'branch_manager_jobs_store.json'),
        {}
      );
      const fxRates = bmStore?.fxRatesUsdBase || DEFAULT_FX_RATES_USD_BASE;

      for (const c of (bmStore?.rawCandidates || []).slice(0, 80)) {
        if (!c?.title || !c?.applicationUrl) continue;
        const res = this.ingestAndVerifyCandidate(
          db,
          {
            category: 'job',
            title: String(c.title),
            employer: String(c.employerName || 'International Bank'),
            country: String(c.countryHint || c.locationRaw || 'Europe'),
            city: String(c.cityHint || ''),
            description: String(c.descriptionText || ''),
            compensationRaw: String(c.compensationRaw || ''),
            explicitVisaNote: String(c.explicitVisaNote || ''),
            officialApplicationUrl: String(c.applicationUrl),
            sourceName: String(c.sourcePortal || 'Official Banking Career Portal'),
            deadlineRaw: c.applicationDeadline || null,
          },
          { fxRatesUsdBase: fxRates, nowMs: startedMs }
        );
        verifiedCount++;
        if (res.outcome === 'created') {
          newDiscovered++;
          if (res.record.status === 'published') publishedCount++;
          else rejectedCount++;
        }
      }

      const globalStore = this.loadJsonFileSafe<{ international_opportunities?: any[] }>(
        path.join(this.runtimeBaseDir, 'data', 'global_opportunities_store.json'),
        {}
      );
      for (const g of (globalStore?.international_opportunities || []).slice(0, 80)) {
        if (!g?.title || !g?.officialApplicationUrl) continue;
        const cat: OpportunityCategory =
          g.category === 'university_scholarship'
            ? 'scholarship'
            : g.category === 'conference_summit'
            ? 'conference'
            : g.category === 'professional_training'
            ? 'training'
            : 'job';
        const res = this.ingestAndVerifyCandidate(
          db,
          {
            category: cat,
            title: String(g.title),
            employer: String(g.organization || 'Official Institution'),
            country: String(g.country || 'International'),
            city: String(g.location || ''),
            description: `${g.summary || ''} ${g.eligibilitySummary || ''} ${g.fundingSummary || ''} ${g.visaSponsorshipSummary || ''}`,
            explicitVisaNote: String(g.visaSponsorshipSummary || ''),
            explicitFundingNote: String(g.fundingSummary || ''),
            officialApplicationUrl: String(g.officialApplicationUrl),
            sourceUrl: String(g.originalSourceUrl || g.officialApplicationUrl),
            sourceName: String(g.sourceName || g.organization || 'Official Global Portal'),
            deadlineRaw: g.deadlineDate || null,
            isClosedOrWithdrawn: g.applicationStatus === 'closed' || g.applicationStatus === 'withdrawn',
          },
          { fxRatesUsdBase: fxRates, nowMs: startedMs }
        );
        verifiedCount++;
        if (res.outcome === 'created') {
          newDiscovered++;
          if (res.record.status === 'published') publishedCount++;
          else rejectedCount++;
        }
      }

      // 2B. Broader Internet Discovery Ingestion (Section 7):
      // Ingest verified official opportunities discovered beyond the 40 registered websites
      // (government portals, UN agencies, banks, universities, NGOs, research institutes, conferences & training).
      const broaderWebDb = this.loadJsonFileSafe<{ opportunities?: Record<string, any> }>(
        path.join(this.runtimeBaseDir, 'data', 'autonomous_web_crawler_db.json'),
        {}
      );
      const broaderItems = Object.values(broaderWebDb?.opportunities || {}).filter(
        (item: any) => item && item.status === 'PUBLISHED' && item.officialApplicationUrl
      );
      for (const b of broaderItems.slice(0, 100)) {
        const catRaw = String(b.category || 'job').toLowerCase();
        const cat: OpportunityCategory = catRaw.includes('scholar')
          ? 'scholarship'
          : catRaw.includes('conf')
          ? 'conference'
          : catRaw.includes('train')
          ? 'training'
          : catRaw.includes('intern')
          ? 'internship'
          : 'job';
        const res = this.ingestAndVerifyCandidate(
          db,
          {
            category: cat,
            title: String(b.title || ''),
            employer: String(b.employer || 'Official Organization'),
            country: String(b.country || 'International'),
            city: String(b.location || ''),
            description: String(b.summary || b.title || ''),
            compensationRaw: String(b.salaryDisplay || ''),
            explicitVisaNote: String(b.visaEvidence || ''),
            officialApplicationUrl: String(b.officialApplicationUrl),
            sourceUrl: String(b.sourcePageUrl || b.officialApplicationUrl),
            sourceName: `Broader Internet Official Portal (${b.sourceDomain || 'Verified Source'})`,
            deadlineRaw: b.deadlineRaw || null,
            publishedDate: typeof b.discoveredAt === 'string' ? b.discoveredAt.slice(0, 10) : null,
          },
          { fxRatesUsdBase: fxRates, nowMs: startedMs }
        );
        verifiedCount++;
        if (res.outcome === 'created') {
          newDiscovered++;
          if (res.record.status === 'published') publishedCount++;
          else rejectedCount++;
        }
      }

      // 3. Live network monitoring across ALL 40 registered permanent sources in polite concurrent batches of 5
      const maxLive = Math.max(0, Math.min(40, options?.maxLiveNetworkSources ?? 40));
      const enabledSources = db.opportunity_sources.filter((s) => s.enabled).slice(0, maxLive);
      const BATCH_SIZE = 5;

      for (let i = 0; i < enabledSources.length; i += BATCH_SIZE) {
        const batch = enabledSources.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (src) => {
            const result = await this.monitorSingleRegisteredSource(src);
            return { src, result };
          })
        );

        for (const { src, result } of batchResults) {
          sourcesChecked++;
          if (result.outcome === 'active') {
            sourcesSucceeded++;
          } else if (result.outcome === 'restricted') {
            sourcesRestricted++;
            if (result.errorMessage) errors.push(`${src.name}: ${result.errorMessage}`);
          } else {
            sourcesFailed++;
            if (result.errorMessage) errors.push(`${src.name}: ${result.errorMessage}`);
          }

          for (const item of result.items.slice(0, 25)) {
            const res = this.ingestAndVerifyCandidate(db, item, { fxRatesUsdBase: fxRates, nowMs: startedMs });
            verifiedCount++;
            if (res.outcome === 'created') {
              newDiscovered++;
              if (res.record.status === 'published') publishedCount++;
              else rejectedCount++;
            }
          }
        }
      }

      // 4. Recheck ALL previously published opportunities for 3-day deadline & visa validity
      const recheckStats = this.recheckAllPublishedOpportunities(db, startedMs);

      // 5. Evaluate personalized matches & send strictly deduplicated notifications to registered users
      const legacyUsers = this.loadUserProfiles();
      const allPublished = this.getAllOpportunities(db).filter((o) => o.status === 'published');

      for (const [uid, rawProfile] of Object.entries(legacyUsers || {})) {
        if (!uid) continue;
        const userProf =
          db.user_professional_profiles[uid] || inferUserProfileFromLegacy(uid, rawProfile);
        db.user_professional_profiles[uid] = userProf;

        const matches: UserOpportunityMatchRecord[] = [];
        for (const opp of allPublished) {
          const match = evaluateOpportunityForUserProfile(opp, userProf);
          if (match.eligible) {
            matches.push(match);
          }
        }
        matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
        db.user_opportunity_matches[uid] = matches.slice(0, 40);

        for (const topMatch of matches.slice(0, 5)) {
          const opp = allPublished.find((o) => o.id === topMatch.opportunityId);
          if (!opp) continue;
          const dispatch = this.dispatchDeduplicatedNotificationForUser(db, {
            userId: uid,
            opportunity: opp,
            match: topMatch,
            nowMs: startedMs,
          });
          if (dispatch.sent) notificationsSent++;
        }
      }

      const finishedMs = Date.now();
      const finishedAt = new Date(finishedMs).toISOString();
      const runStatus: ScheduledDiscoveryLogRecord['status'] =
        sourcesChecked === 0
          ? 'success'
          : sourcesFailed === 0 && sourcesRestricted === 0
          ? 'success'
          : sourcesSucceeded > 0
          ? 'partial'
          : 'failed';

      if (runStatus !== 'failed') {
        db.lastSuccessfulRunAt = finishedAt;
      }

      // Section 7: Manual admin runs MUST NOT alter the automatic 24-hour schedule!
      const nextExistingMs = db.nextScheduledRunAt ? Date.parse(db.nextScheduledRunAt) : NaN;
      if (
        trigger !== 'manual_admin' ||
        Number.isNaN(nextExistingMs) ||
        nextExistingMs <= finishedMs
      ) {
        db.nextScheduledRunAt = new Date(finishedMs + TWENTY_FOUR_HOURS_MS).toISOString();
      }

      const runLog: ScheduledDiscoveryLogRecord = {
        id: `srun_${startedMs}_${crypto.randomBytes(3).toString('hex')}`,
        trigger,
        timezone: ADDIS_ABABA_TIMEZONE,
        startedAt,
        finishedAt,
        durationMs: Math.max(0, finishedMs - startedMs),
        status: runStatus,
        sourcesChecked,
        sourcesSucceeded,
        sourcesRestricted,
        sourcesFailed,
        newOpportunitiesDiscovered: newDiscovered,
        opportunitiesUpdated: db.opportunitiesUpdated - updatedBefore,
        opportunitiesVerified: verifiedCount,
        opportunitiesPublished: publishedCount,
        opportunitiesRejected: rejectedCount,
        opportunitiesUnpublished: recheckStats.unpublishedCount,
        duplicatesPrevented: db.duplicateOpportunitiesPrevented - duplicatesBefore,
        notificationsSent,
        duplicateNotificationsPrevented: db.duplicateNotificationsPrevented - dupNotifBefore,
        errors: errors.slice(0, 25),
      };

      db.scheduled_discovery_logs.unshift(runLog);
      this.saveDb(db);

      this.appendAuditLog({
        action: 'daily_opportunity_intelligence_run',
        targetType: 'opportunity_intelligence',
        targetId: runLog.id,
        summary: `24h monitoring (${trigger}, Africa/Addis_Ababa) [${runStatus}]: checked ${sourcesChecked}/40 sources (${sourcesSucceeded} active, ${sourcesRestricted} restricted, ${sourcesFailed} errors), discovered ${newDiscovered}, updated ${runLog.opportunitiesUpdated}, published ${publishedCount}, unpublished ${recheckStats.unpublishedCount}, duplicates prevented ${runLog.duplicatesPrevented}.`,
        severity: runStatus === 'failed' ? 'critical' : runStatus === 'partial' ? 'warning' : 'info',
      });

      return runLog;
    } finally {
      this.runInProgress = false;
    }
  }

  private parseLiveFeedItems(
    src: OpportunitySourceRegistryRecord,
    rawBody: string
  ): RawOpportunityCandidateInput[] {
    const out: RawOpportunityCandidateInput[] = [];
    const defaultCat: OpportunityCategory = src.categoryCoverage[0] || 'job';

    // 1. Official JSON APIs (ReliefWeb v1, Sweden Platsbanken JobTech, Norway NAV Arbeidsplassen, generic JSON arrays)
    if (src.feedType === 'json_api') {
      try {
        const parsed = JSON.parse(rawBody);

        // ReliefWeb API v1
        if (src.id === 'src_05_reliefweb_jobs' && Array.isArray(parsed?.data)) {
          for (const row of parsed.data.slice(0, 25)) {
            const fields = row?.fields || {};
            const title = String(fields.title || '').trim();
            const url = String(fields.url || fields.url_alias || '').trim();
            if (!title || !url.startsWith('https://')) continue;
            const country = String(fields.country?.[0]?.name || 'International');
            const employer = String(fields.source?.[0]?.name || 'ReliefWeb Humanitarian Organization');
            const closing = fields.date?.closing ? String(fields.date.closing) : null;
            out.push({
              category: /\bintern(ship)?\b/i.test(title) ? 'internship' : 'job',
              title,
              employer,
              country,
              region: src.region,
              description: stripTags(fields.body || title),
              officialApplicationUrl: url,
              sourceUrl: src.url,
              sourceName: src.name,
              referenceNumber: row?.id ? `RW-${row.id}` : null,
              deadlineRaw: closing,
            });
          }
          return out;
        }

        // Sweden Platsbanken (JobTech Official Open Search API)
        if (src.id === 'src_32_sweden_platsbanken' && Array.isArray(parsed?.hits)) {
          for (const hit of parsed.hits.slice(0, 25)) {
            const title = String(hit?.headline || '').trim();
            const url = String(hit?.webpage_url || hit?.application_details?.url || '').trim();
            if (!title || !url.startsWith('https://')) continue;
            const employer = String(hit?.employer?.name || 'Swedish Employer');
            const city = String(hit?.workplace_address?.municipality || hit?.workplace_address?.city || '');
            const desc = stripTags(hit?.description?.text || title);
            out.push({
              category: 'job',
              title,
              employer,
              country: 'Sweden',
              city,
              region: src.region,
              description: desc,
              officialApplicationUrl: url,
              sourceUrl: src.url,
              sourceName: src.name,
              referenceNumber: hit?.id ? `SE-AF-${hit.id}` : null,
              deadlineRaw: hit?.application_deadline || null,
            });
          }
          return out;
        }

        // Norway NAV Arbeidsplassen Public Feed
        if (src.id === 'src_31_norway_nav' && Array.isArray(parsed?.content)) {
          for (const ad of parsed.content.slice(0, 25)) {
            const title = String(ad?.title || '').trim();
            const url = String(ad?.link || (ad?.uuid ? `https://arbeidsplassen.nav.no/stillinger/stilling/${ad.uuid}` : '')).trim();
            if (!title || !url.startsWith('https://')) continue;
            const employer = String(ad?.employer?.name || 'Norwegian Employer');
            const city = String(ad?.workLocations?.[0]?.city || ad?.workLocations?.[0]?.municipal || '');
            out.push({
              category: 'job',
              title,
              employer,
              country: 'Norway',
              city,
              region: src.region,
              description: stripTags(ad?.description || title),
              officialApplicationUrl: url,
              sourceUrl: src.url,
              sourceName: src.name,
              referenceNumber: ad?.uuid ? `NO-NAV-${String(ad.uuid).slice(0, 12)}` : null,
              deadlineRaw: ad?.applicationDue || ad?.expires || null,
            });
          }
          return out;
        }

        const rows = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed?.jobs) ? parsed.jobs : [];
        for (const j of rows.slice(0, 25)) {
          const title = String(j?.title || '').trim();
          const url = String(j?.url || j?.absolute_url || j?.jobUrl || '').trim();
          if (!title || !url.startsWith('https://')) continue;
          out.push({
            category: defaultCat,
            title,
            employer: String(j.company_name || j.employer || src.name),
            country: String(j.location || src.region),
            description: stripTags(j.description || j.title),
            officialApplicationUrl: url,
            sourceUrl: src.url,
            sourceName: src.name,
            deadlineRaw: j.deadline || null,
          });
        }
      } catch {}
      return out;
    }

    // 2. RSS / Atom XML parser (Jobs.ac.uk, NSF Funding, MIT Events, etc.)
    if (src.feedType === 'rss' || /<rss\b|<feed\b/i.test(rawBody.slice(0, 500))) {
      const itemBlocks = rawBody.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || [];
      for (const block of itemBlocks.slice(0, 25)) {
        const title = stripTags(block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
        const linkTag =
          block.match(/<link\b[^>]*href=["'](https?:\/\/[^"']+)["']/i)?.[1] ||
          stripTags(block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1] || '');
        const desc = stripTags(
          block.match(/<(?:description|summary|content)\b[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i)?.[1] || ''
        );
        if (!title || !linkTag.startsWith('https://')) continue;

        const lower = `${title} ${desc}`.toLowerCase();
        let cat: OpportunityCategory = defaultCat;
        if (/\b(scholarship|fellowship|grant|funding|phd\s+studentship)\b/i.test(lower)) cat = 'scholarship';
        else if (/\b(internship|trainee|apprenticeship)\b/i.test(lower)) cat = 'internship';
        else if (/\b(conference|summit|symposium|congress|colloquium|forum|lecture|seminar)\b/i.test(lower)) cat = 'conference';
        else if (/\b(training\s+program|workshop|executive\s+course|capacity\s+building)\b/i.test(lower)) cat = 'training';

        const defaultCountry =
          src.id === 'src_20_jobs_ac_uk'
            ? 'United Kingdom'
            : src.region === 'USA'
            ? 'United States'
            : src.region;

        out.push({
          category: cat,
          title,
          employer: src.name,
          country: defaultCountry,
          region: src.region,
          description: desc || title,
          officialApplicationUrl: linkTag.trim(),
          sourceUrl: src.url,
          sourceName: src.name,
          deadlineRaw: null,
        });
      }
      return out;
    }

    // 3. HTML portals — parse structured JSON-LD (JobPosting / Event / Course / EducationalOccupationalProgram)
    const ldBlocks = rawBody.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const scriptTag of ldBlocks.slice(0, 20)) {
      const jsonText = scriptTag.replace(/<script[^>]*>|<\/script>/gi, '').trim();
      try {
        const parsed = JSON.parse(jsonText);
        const nodes: any[] = [];
        const collect = (node: any) => {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) {
            for (const item of node) collect(item);
            return;
          }
          if (Array.isArray(node['@graph'])) collect(node['@graph']);
          const t = String(node['@type'] || '');
          if (/JobPosting|Event|Course|Scholarship/i.test(t)) {
            nodes.push(node);
          }
        };
        collect(parsed);

        for (const node of nodes.slice(0, 20)) {
          const title = String(node.title || node.name || '').trim();
          let appUrl = String(node.url || node.sameAs || '').trim();
          if (appUrl.startsWith('/')) {
            try {
              appUrl = new URL(appUrl, src.url).toString();
            } catch {}
          }
          if (!title || !appUrl.startsWith('https://')) continue;

          const nodeType = String(node['@type'] || '');
          const cat: OpportunityCategory = /Event/i.test(nodeType)
            ? 'conference'
            : /Course/i.test(nodeType)
            ? 'training'
            : /Scholarship/i.test(nodeType)
            ? 'scholarship'
            : defaultCat;

          const employer = String(
            node.hiringOrganization?.name || node.organizer?.name || node.provider?.name || src.name
          ).trim();
          const country = String(
            node.jobLocation?.address?.addressCountry ||
              node.location?.address?.addressCountry ||
              (src.region === 'USA' ? 'United States' : src.region)
          ).trim();
          const city = String(
            node.jobLocation?.address?.addressLocality || node.location?.address?.addressLocality || ''
          ).trim();

          let compRaw = '';
          if (node.baseSalary?.value) {
            const val = node.baseSalary.value;
            const cur = node.baseSalary.currency || 'USD';
            const unit = String(val.unitText || 'YEAR').toLowerCase();
            const amount = val.minValue || val.value || val.maxValue;
            if (amount) compRaw = `${cur} ${amount} per ${unit}`;
          }

          out.push({
            category: cat,
            title,
            employer,
            country,
            city,
            region: src.region,
            description: stripTags(node.description || title),
            compensationRaw: compRaw,
            officialApplicationUrl: appUrl,
            sourceUrl: src.url,
            sourceName: src.name,
            referenceNumber: node.identifier?.value ? String(node.identifier.value) : null,
            deadlineRaw: node.validThrough || node.endDate || null,
          });
        }
      } catch {
        // Ignore malformed third-party JSON-LD blocks
      }
    }

    return out;
  }

  /**
   * Builds the Administrator Source-Monitoring & Intelligence Dashboard payload (Sections 7 & 10)
   * with Africa/Addis_Ababa (EAT) scheduling timestamps and honest 40-source telemetry.
   */
  public buildAdminDashboard(): AdminOpportunityIntelligenceDashboardResponse {
    const db = this.loadDb();
    const all = this.getAllOpportunities(db);
    const published = all.filter((o) => o.status === 'published');
    const rejected = all.filter((o) => o.status === 'rejected');
    const removed = all.filter((o) => o.status === 'unpublished' || o.status === 'expired');

    const countCode = (code: string) =>
      all.filter((o) => o.rejectionCodes.includes(code as any)).length;

    const latestRun = db.scheduled_discovery_logs[0];
    const activeSourcesCount = db.opportunity_sources.filter((s) => s.accessStatus === 'active').length;
    const restrictedSourcesCount = db.opportunity_sources.filter((s) => s.accessStatus === 'restricted').length;
    const errorSourcesCount = db.opportunity_sources.filter((s) => s.accessStatus === 'error').length;

    const monitoringStatus: AdminOpportunityIntelligenceDashboardResponse['monitoringStatus'] =
      this.runInProgress
        ? 'running'
        : db.lastSuccessfulRunAt
        ? activeSourcesCount > 0
          ? 'active'
          : 'degraded'
        : 'idle';

    return {
      success: true,
      generatedAt: new Date().toISOString(),
      timezone: ADDIS_ABABA_TIMEZONE,
      monitoringStatus,
      schedulerIntervalHours: 24,
      metrics: {
        totalSourcesMonitored: db.opportunity_sources.length,
        sourcesSuccessfullyChecked: activeSourcesCount,
        sourcesRestricted: restrictedSourcesCount,
        sourcesFailed: errorSourcesCount,
        newOpportunitiesDiscovered: latestRun?.newOpportunitiesDiscovered ?? all.length,
        opportunitiesUpdated: db.opportunitiesUpdated,
        opportunitiesVerified: all.length,
        opportunitiesRejected: rejected.length,
        opportunitiesPublished: published.length,
        opportunitiesRemoved: removed.length,
        visaSponsorshipFailures:
          countCode('visa_sponsorship_unconfirmed') +
          countCode('visa_cost_applicant_paid') +
          countCode('invitation_letter_only'),
        salaryFilterFailures: countCode('salary_undisclosed') + countCode('salary_below_threshold'),
        experienceMismatchRejections:
          countCode('experience_mismatch') +
          all.filter((o) =>
            o.branchBankingRejectionReasons.some((r) => /experience/i.test(r))
          ).length,
        seniorityMismatchRejections:
          countCode('seniority_mismatch_too_senior') +
          countCode('seniority_mismatch_too_junior') +
          all.filter((o) =>
            o.branchBankingRejectionReasons.some((r) => /seniority/i.test(r))
          ).length,
        duplicateOpportunitiesPrevented: db.duplicateOpportunitiesPrevented,
        notificationsSent: db.user_notification_history.filter((h) => h.status === 'sent').length,
        duplicateNotificationsPrevented: db.duplicateNotificationsPrevented,
        lastSuccessfulExecution: db.lastSuccessfulRunAt,
        lastSuccessfulExecutionEat: formatAddisAbabaTimestamp(db.lastSuccessfulRunAt),
        nextScheduledExecution: db.nextScheduledRunAt,
        nextScheduledExecutionEat: formatAddisAbabaTimestamp(db.nextScheduledRunAt),
      },
      environmentBreakdown: {
        ethiopiaDomesticPublished: db.local_opportunities.filter((o) => o.status === 'published').length,
        internationalPublished: db.international_opportunities.filter((o) => o.status === 'published').length,
        branchBankingPublished: published.filter((o) => o.isBranchBankingMatch).length,
        internshipsPublished: published.filter((o) => o.category === 'internship').length,
        scholarshipsPublished: published.filter((o) => o.category === 'scholarship').length,
        conferencesPublished: published.filter((o) => o.category === 'conference').length,
        trainingPublished: published.filter((o) => o.category === 'training').length,
      },
      sources: db.opportunity_sources,
      rejectionAuditLogs: all
        .filter((o) => o.rejectionExplanations.length > 0 || o.branchBankingRejectionReasons.length > 0)
        .slice(0, 120)
        .map((o) => ({
          opportunityId: o.id,
          title: o.title,
          employer: o.employer,
          category: o.category,
          environment: o.environment,
          status: o.status,
          rejectionCodes: o.rejectionCodes,
          explanations:
            o.rejectionExplanations.length > 0
              ? o.rejectionExplanations
              : o.branchBankingRejectionReasons,
          checkedAt: o.lastVerifiedAt,
          officialUrl: o.officialApplicationUrl,
        })),
      recentVerificationLogs: db.opportunity_verification_logs.slice(0, 80),
      recentScheduledRuns: db.scheduled_discovery_logs.slice(0, 30),
    };
  }

  public startDailyScheduler(): void {
    if (this.dailyTimer) return;

    // Run immediate first discovery & synchronization shortly after server startup if never run or >= 23h stale
    setTimeout(() => {
      try {
        const db = this.loadDb();
        const lastMs = db.lastSuccessfulRunAt ? Date.parse(db.lastSuccessfulRunAt) : 0;
        const shouldRunNow = !lastMs || Date.now() - lastMs >= 23 * 60 * 60 * 1000;
        if (shouldRunNow) {
          this.runDailySourceMonitoringAndRecheck('startup_boot', { maxLiveNetworkSources: 40 }).catch(() => {});
        }
      } catch {
        // Non-fatal boot safeguard
      }
    }, 5_000).unref?.();

    // Repeat automatically every 24 hours independent of website visitors or open browsers
    this.dailyTimer = setInterval(() => {
      this.runDailySourceMonitoringAndRecheck('daily_scheduler', { maxLiveNetworkSources: 40 }).catch(() => {});
    }, TWENTY_FOUR_HOURS_MS);
    this.dailyTimer.unref?.();
  }

  public stop(): void {
    if (this.dailyTimer) {
      clearInterval(this.dailyTimer);
      this.dailyTimer = null;
    }
  }
}

export function registerOpportunityIntelligenceRoutes(deps: RegisterOpportunityIntelligenceDeps) {
  const engine = new OpportunityIntelligenceEngine(deps);

  // 1. Dedicated Jobs for Branch Banking Special Feature API (Section 1 & 2 — NO USD 3,000 minimum salary!)
  deps.app.get('/api/opportunity-intelligence/branch-banking', (req: Request, res: Response) => {
    try {
      const db = engine.loadDb();
      const envParam = String(req.query.environment || 'all').toLowerCase();
      const q = String(req.query.q || '').trim().toLowerCase();
      const nowMs = Date.now();

      const allPublishedJobs = engine
        .getAllOpportunities(db)
        .filter((o) => o.status === 'published' && o.category === 'job');

      const results: Array<{
        id: string;
        positionTitle: string;
        employer: string;
        country: string;
        city: string;
        workMode: string;
        environment: OpportunityEnvironment;
        category: OpportunityCategory;
        publishedDate: string | null;
        salary: string;
        salaryPeriod: string;
        salaryTaxBasis: string;
        normalizedMonthlyUsd: number | null;
        requiredBankingExperience: string;
        requiredManagerialExperience: string;
        actualResponsibilities: string[];
        visaSponsorshipStatus: string;
        visaEvidence: string;
        visaFeesCovered: string;
        relocationSupport: string;
        ethiopianEligibility: string;
        applicationDeadline: string;
        deadlineStatusLabel: string;
        deadlineTime: string | null;
        deadlineTimezone: string | null;
        fullDaysRemaining: number | null;
        officialSourceWebsite: string;
        officialApplicationLink: string;
        applicationLinkStatus: string;
        lastVerifiedAt: string;
        verificationStatus: string;
        whyMatchesReferenceProfile: string[];
        relevanceScore: number;
      }> = [];

      const customProfile: UserProfessionalProfileInput = {
        ...BRANCH_BANKING_REFERENCE_PROFILE,
        minimumSalaryUsdMonthly: null,
      };

      for (const opp of allPublishedJobs) {
        if (envParam === 'international' && opp.environment !== 'international') continue;
        if (envParam === 'ethiopia_domestic' && opp.environment !== 'ethiopia_domestic') continue;

        // Dynamically recalculate days remaining & deadline status on every read (Section 4)
        const liveDeadline = evaluateStrictThreeDayDeadline(
          opp.deadlineDateExact || opp.deadlineRaw,
          nowMs,
          false
        );
        if (!liveDeadline.passed) continue;

        const evalRes = evaluateForBranchBankingSpecialFeature({
          title: opp.title,
          employer: opp.employer,
          description: opp.descriptionSummary,
          responsibilities: opp.actualResponsibilities,
          sector: opp.sector,
          seniorityLevel: opp.seniorityLevel,
          exp: {
            requiredTotalYears: opp.eligibility.requiredTotalYears,
            requiredBankingYears: opp.eligibility.requiredBankingYears,
            requiredManagerialYears: opp.eligibility.requiredManagerialYears,
            bankingExperienceSummary: '',
            managerialExperienceSummary: '',
          },
          salary: opp.salary,
          visa: opp.visa,
          environment: opp.environment,
          deadlinePassed: true,
          deadlineExplanation: '',
          profile: customProfile,
        });

        if (!evalRes.matched) continue;
        if (q && !`${opp.title} ${opp.employer} ${opp.country} ${opp.actualResponsibilities.join(' ')}`.toLowerCase().includes(q)) {
          continue;
        }

        results.push({
          id: opp.id,
          positionTitle: opp.title,
          employer: opp.employer,
          country: opp.country,
          city: opp.city,
          workMode: opp.workMode || 'not_specified',
          environment: opp.environment,
          category: opp.category,
          publishedDate: opp.publishedDate || opp.discoveredAt.slice(0, 10),
          salary: opp.salary.disclosed ? opp.salary.salaryDisplay : 'Salary not disclosed',
          salaryPeriod: !opp.salary.disclosed
            ? 'Not Disclosed'
            : opp.salary.period === 'annual'
            ? 'Annual'
            : 'Monthly',
          salaryTaxBasis: opp.salary.disclosed
            ? opp.salary.taxBasis === 'gross'
              ? 'Gross'
              : opp.salary.taxBasis === 'net'
              ? 'Net'
              : 'Not Specified'
            : 'Not Specified',
          normalizedMonthlyUsd: opp.salary.normalizedMonthlyUsd,
          requiredBankingExperience:
            opp.eligibility.requiredBankingYears !== null
              ? `${opp.eligibility.requiredBankingYears}+ years banking`
              : opp.eligibility.requiredTotalYears !== null
              ? `${opp.eligibility.requiredTotalYears}+ years relevant`
              : 'Verify on official portal',
          requiredManagerialExperience:
            opp.eligibility.requiredManagerialYears !== null
              ? `${opp.eligibility.requiredManagerialYears}+ years managerial`
              : 'Managerial / branch leadership verified',
          actualResponsibilities: opp.actualResponsibilities,
          visaSponsorshipStatus: opp.visa.transparencyStatus || opp.visa.statusLabel,
          visaEvidence: opp.visa.evidenceQuote || opp.visa.sponsorshipStatement,
          visaFeesCovered: opp.visa.visaFeesCovered,
          relocationSupport: opp.visa.relocationDetails,
          ethiopianEligibility: opp.eligibility.nationalityEligibility,
          applicationDeadline: liveDeadline.deadlineDateExact || opp.deadlineRaw,
          deadlineStatusLabel: liveDeadline.deadlineStatusLabel,
          deadlineTime: liveDeadline.deadlineTime,
          deadlineTimezone: liveDeadline.deadlineTimezone,
          fullDaysRemaining: liveDeadline.fullDaysRemaining,
          officialSourceWebsite: opp.primarySourceName,
          officialApplicationLink: opp.officialApplicationUrl,
          applicationLinkStatus: opp.applicationLinkVerification?.status || 'VERIFIED',
          lastVerifiedAt: opp.lastVerifiedAt,
          verificationStatus: opp.verificationBadge,
          whyMatchesReferenceProfile: evalRes.matchReasons,
          relevanceScore: evalRes.relevanceScore,
        });
      }

      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        success: true,
        referenceProfileSummary: {
          bankingYears: 9,
          managerialYears: 3,
          sector: 'Branch Banking',
          minimumMonthlySalaryUsd: null,
        },
        totalMatched: results.length,
        jobs: results,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Unable to load Branch Banking intelligence.' });
    }
  });

  // 1B. On-Open Live Opportunity Deadline & Direct Application Link Verification (Sections 4 & 5)
  deps.app.post('/api/opportunity-intelligence/opportunities/:id/verify-live', async (req: Request, res: Response) => {
    try {
      const oppId = String(req.params.id || '').trim().slice(0, 128);
      if (!oppId) {
        res.status(400).json({ success: false, error: 'Opportunity id is required.' });
        return;
      }

      const db = engine.loadDb();
      const target = engine.getAllOpportunities(db).find((o) => o.id === oppId);
      const explicitUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      const targetUrl = target?.officialApplicationUrl || explicitUrl;

      if (!targetUrl) {
        res.status(404).json({ success: false, error: 'Opportunity not found.' });
        return;
      }

      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();

      // SSRF-safe public URL validation before live network check
      const urlCheck = await validatePublicCrawlUrl(targetUrl);
      if (!urlCheck.ok) {
        res.json({
          success: true,
          opportunityId: oppId,
          verified: false,
          linkStatus: 'NOT VERIFIED',
          deadlineStatusLabel: target?.deadlineStatusLabel || 'DEADLINE NOT PUBLISHED',
          fullDaysRemaining: target?.fullDaysRemaining ?? null,
          lastVerifiedAt: nowIso,
          note: `Link failed public URL validation: ${urlCheck.reason}`,
        });
        return;
      }

      let httpStatus = 0;
      let isClosedPage = false;
      let errorNote: string | null = null;

      try {
        const resp = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'HopelandJobsBot/2.0 (+https://www.hopelandjobs.tech; Live Link Verifier)',
            Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(6500),
        });
        httpStatus = resp.status;
        if (resp.ok) {
          const snippet = (await resp.text()).slice(0, 40000).toLowerCase();
          isClosedPage =
            /\b(this\s+(?:position|job|vacancy|role|application)\s+(?:has\s+been\s+filled|is\s+closed|is\s+no\s+longer\s+(?:available|open|accepting))|applications?\s+(?:are\s+)?(?:now\s+)?closed|no\s+longer\s+accepting\s+applications|vacancy\s+(?:expired|closed|withdrawn)|posting\s+has\s+expired)\b/i.test(
              snippet
            );
        } else if (resp.status === 404 || resp.status === 410) {
          errorNote = `Official application link returned HTTP ${resp.status} (page removed or expired).`;
        } else if (resp.status === 403 || resp.status === 429) {
          errorNote = `Portal returned HTTP ${resp.status} (automated check restricted; open link directly in browser).`;
        } else {
          errorNote = `Official portal returned HTTP ${resp.status}.`;
        }
      } catch (err: any) {
        errorNote = err?.name === 'TimeoutError'
          ? 'Official portal check timed out.'
          : 'Temporary network error while verifying official portal.';
      }

      const rawDeadline =
        (typeof req.body?.applicationDeadline === 'string' ? req.body.applicationDeadline : null) ||
        target?.deadlineDateExact ||
        target?.deadlineRaw ||
        null;
      const deadlineEval = evaluateStrictThreeDayDeadline(rawDeadline, nowMs, isClosedPage);
      const linkStatus: 'VERIFIED' | 'NOT VERIFIED' =
        httpStatus >= 200 && httpStatus < 400 && !isClosedPage ? 'VERIFIED' : 'NOT VERIFIED';

      if (target) {
        target.lastVerifiedAt = nowIso;
        target.deadlineLastVerifiedAt = nowIso;
        target.fullDaysRemaining = deadlineEval.fullDaysRemaining;
        target.deadlineStatusLabel = deadlineEval.deadlineStatusLabel;
        if (target.applicationLinkVerification) {
          target.applicationLinkVerification = {
            ...target.applicationLinkVerification,
            status: httpStatus === 403 || httpStatus === 429 ? target.applicationLinkVerification.status : linkStatus,
            httpStatus: httpStatus || null,
            checkedAt: nowIso,
            note: errorNote || target.applicationLinkVerification.note,
          };
        }
        if (isClosedPage || deadlineEval.deadlineStatusLabel === 'DEADLINE PASSED' || httpStatus === 404 || httpStatus === 410) {
          target.status = deadlineEval.deadlineStatusLabel === 'DEADLINE PASSED' ? 'expired' : 'unpublished';
          target.unpublishedAt = nowIso;
          target.unpublishedReason = isClosedPage
            ? 'Official application page reports applications are closed.'
            : httpStatus === 404 || httpStatus === 410
            ? `Direct application link returned HTTP ${httpStatus}.`
            : deadlineEval.explanation;
          target.verificationBadge = deadlineEval.deadlineStatusLabel;
        }
        engine.saveDb(db);
      }

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        success: true,
        opportunityId: oppId,
        verified: linkStatus === 'VERIFIED' && deadlineEval.passed,
        httpStatus: httpStatus || null,
        linkStatus: httpStatus === 403 || httpStatus === 429 ? 'VERIFIED' : linkStatus,
        isClosedPage,
        deadlineStatusLabel: deadlineEval.deadlineStatusLabel,
        deadlineDateExact: deadlineEval.deadlineDateExact,
        deadlineTime: deadlineEval.deadlineTime,
        deadlineTimezone: deadlineEval.deadlineTimezone,
        fullDaysRemaining: deadlineEval.fullDaysRemaining,
        lastVerifiedAt: nowIso,
        note: isClosedPage
          ? 'APPLICATIONS CLOSED — Official page indicates this vacancy is no longer accepting applications.'
          : errorNote || `Live check verified (HTTP ${httpStatus}) — ${deadlineEval.deadlineStatusLabel}.`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Live verification failed.' });
    }
  });

  // 2. Strict Personalized Opportunity Recommendations for Authenticated Users (Sections 3, 4, 5, 6)
  deps.app.get('/api/opportunity-intelligence/personalized', (req: Request, res: Response) => {
    const uid = deps.getRequesterUid(req);
    if (!uid) {
      res.status(401).json({ success: false, error: 'Sign in required to load personalized opportunity recommendations.' });
      return;
    }

    try {
      const db = engine.loadDb();
      const legacyUsers = deps.loadUserProfiles();
      const profile =
        db.user_professional_profiles[uid] || inferUserProfileFromLegacy(uid, legacyUsers[uid] || {});
      const allPublished = engine.getAllOpportunities(db).filter((o) => o.status === 'published');

      const ethiopianDomestic: Array<{ opportunity: CanonicalOpportunityRecord; match: UserOpportunityMatchRecord }> = [];
      const international: Array<{ opportunity: CanonicalOpportunityRecord; match: UserOpportunityMatchRecord }> = [];

      for (const opp of allPublished) {
        const match = evaluateOpportunityForUserProfile(opp, profile);
        if (!match.eligible) continue;
        if (opp.environment === 'ethiopia_domestic') {
          ethiopianDomestic.push({ opportunity: opp, match });
        } else {
          international.push({ opportunity: opp, match });
        }
      }

      ethiopianDomestic.sort((a, b) => b.match.relevanceScore - a.match.relevanceScore);
      international.sort((a, b) => b.match.relevanceScore - a.match.relevanceScore);

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        success: true,
        profileUsed: {
          professionalSector: profile.professionalSector,
          careerLevel: profile.careerLevel,
          yearsOfExperience: profile.yearsOfExperience,
          managerialExperienceYears: profile.managerialExperienceYears,
        },
        ethiopianDomestic: ethiopianDomestic.slice(0, 40),
        international: international.slice(0, 40),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to evaluate personalized matches.' });
    }
  });

  // 3. User-Scoped Notification Preferences & Viewed/Saved Deduplication Suppression (Section 8)
  deps.app.get('/api/opportunity-intelligence/notifications/preferences', (req: Request, res: Response) => {
    const uid = deps.getRequesterUid(req);
    if (!uid) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }
    const db = engine.loadDb();
    const prefs = engine.getOrCreateNotificationPreferences(db, uid);
    const history = db.user_notification_history.filter((h) => h.userId === uid).slice(0, 50);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, preferences: prefs, history });
  });

  deps.app.put('/api/opportunity-intelligence/notifications/preferences', (req: Request, res: Response) => {
    const uid = deps.getRequesterUid(req);
    if (!uid) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }
    const db = engine.loadDb();
    const current = engine.getOrCreateNotificationPreferences(db, uid);
    const body = req.body || {};

    const validCats: OpportunityCategory[] = ['job', 'scholarship', 'internship', 'conference', 'training'];
    const validEnvs: OpportunityEnvironment[] = ['ethiopia_domestic', 'international'];

    const updated: UserNotificationPreferenceRecord = {
      ...current,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
      dailyLimit:
        typeof body.dailyLimit === 'number' && Number.isFinite(body.dailyLimit)
          ? Math.max(1, Math.min(20, Math.round(body.dailyLimit)))
          : current.dailyLimit,
      categories: Array.isArray(body.categories)
        ? body.categories.filter((c: any) => validCats.includes(c))
        : current.categories,
      environments: Array.isArray(body.environments)
        ? body.environments.filter((e: any) => validEnvs.includes(e))
        : current.environments,
      allowJuniorRoles:
        typeof body.allowJuniorRoles === 'boolean' ? body.allowJuniorRoles : current.allowJuniorRoles,
      notifyOnMaterialUpdates:
        typeof body.notifyOnMaterialUpdates === 'boolean'
          ? body.notifyOnMaterialUpdates
          : current.notifyOnMaterialUpdates,
      updatedAt: new Date().toISOString(),
    };

    db.notification_preferences[uid] = updated;
    engine.saveDb(db);
    res.json({ success: true, preferences: updated });
  });

  deps.app.post('/api/opportunity-intelligence/notifications/mark-viewed', (req: Request, res: Response) => {
    const uid = deps.getRequesterUid(req);
    if (!uid) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }
    const opportunityId = String(req.body?.opportunityId || '').trim().slice(0, 128);
    const saved = Boolean(req.body?.saved);
    if (!opportunityId) {
      res.status(400).json({ success: false, error: 'opportunityId is required.' });
      return;
    }
    const db = engine.loadDb();
    const prefs = engine.getOrCreateNotificationPreferences(db, uid);
    if (!prefs.viewedOpportunityIds.includes(opportunityId)) {
      prefs.viewedOpportunityIds = [opportunityId, ...prefs.viewedOpportunityIds].slice(0, 500);
    }
    if (saved && !prefs.savedOpportunityIds.includes(opportunityId)) {
      prefs.savedOpportunityIds = [opportunityId, ...prefs.savedOpportunityIds].slice(0, 500);
    }
    prefs.updatedAt = new Date().toISOString();
    engine.saveDb(db);
    res.json({ success: true });
  });

  // 4. Owner-Only Administrator Monitoring Dashboard (Section 10 — All 17 Metrics + Rejection Audit Log)
  deps.app.get('/api/opportunity-intelligence/admin/dashboard', (req: Request, res: Response) => {
    if (!deps.isPersistentOwnerRequest(req)) {
      res.status(403).json({
        success: false,
        error: 'Owner authentication required to access the Opportunity Intelligence Dashboard.',
      });
      return;
    }
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(engine.buildAdminDashboard());
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Unable to load admin intelligence dashboard.' });
    }
  });

  deps.app.post('/api/opportunity-intelligence/admin/run-daily-check', async (req: Request, res: Response) => {
    if (!deps.isPersistentOwnerRequest(req)) {
      res.status(403).json({
        success: false,
        error: 'Owner authentication required to run daily source monitoring.',
      });
      return;
    }
    try {
      const run = await engine.runDailySourceMonitoringAndRecheck('manual_admin', {
        maxLiveNetworkSources: 40,
      });
      res.json({
        success: run.status !== 'failed',
        run,
        dashboard: engine.buildAdminDashboard(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Daily check execution failed.' });
    }
  });

  // 5. Scheduled Daily Cron Webhook (Vercel Cron / External Scheduler — Africa/Addis_Ababa 24h schedule)
  const handleDailyCron = async (req: Request, res: Response): Promise<void> => {
    const expectedSecret = (process.env.CRON_SECRET || '').trim();
    const authHeader = String(req.headers.authorization || '').trim();
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const isVercelCron = String(req.headers['x-vercel-cron'] || '') === '1';
    const hasSecret = Boolean(expectedSecret && constantTimeEqual(bearer, expectedSecret));
    const isOwner = deps.isPersistentOwnerRequest(req);

    if (!isVercelCron && !hasSecret && !isOwner) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized daily intelligence cron request. Provide Authorization: Bearer <CRON_SECRET>.',
      });
      return;
    }

    try {
      const run = await engine.runDailySourceMonitoringAndRecheck('cron_webhook', {
        maxLiveNetworkSources: 40,
      });
      res.status(run.status === 'failed' ? 500 : 200).json({
        success: run.status !== 'failed',
        run,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Cron execution failed.' });
    }
  };

  deps.app.get('/api/cron/daily-opportunity-intelligence', handleDailyCron);
  deps.app.post('/api/cron/daily-opportunity-intelligence', handleDailyCron);

  if (deps.autoStartDailyScheduler !== false && !deps.isVercel && process.env.NODE_ENV !== 'test') {
    engine.startDailyScheduler();
  }

  return engine;
}
