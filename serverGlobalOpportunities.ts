import type { Express, Request, Response } from 'express';
import * as path from 'path';
import * as crypto from 'crypto';
import * as http2 from 'node:http2';
import {
  ApplicationLifecycleStatus,
  AutonomousSchedulerInfo,
  DiscoveryJobLogRecord,
  GlobalOpportunitiesApiResponse,
  GlobalOpportunity,
  GlobalOpportunityCategory,
  GlobalOpportunitySubsection,
  GlobalOpportunityWithMatch,
  MonitoredPortalCheck,
  OpportunityDeadlineRecord,
  OpportunityEligibilityRecord,
  OpportunityFundingRecord,
  OpportunitySourceRecord,
  OpportunityVerificationLogRecord,
  RequirementBooleanStatus,
  SchedulerFailureAlert,
  SchedulerPersistentState,
  SectorTag,
  UserOpportunityRecommendationRecord,
  UserSavedOpportunityRecord,
  VerificationMonitoringSummary,
} from './src/types/globalOpportunities';
import {
  classifyFundingAndVisaTransparency,
  computeOpportunityFingerprint,
  computeVerificationOutcome,
  detectSectorsFromText,
  evaluateMandatoryVisaCompliance,
  evaluateOpportunityDeadline,
  evaluateOpportunityForUser,
  evaluateProfessionalRestrictionCompliance,
  isOpportunityActiveAndDisplayable,
  MINIMUM_FULL_DAYS_REMAINING,
} from './src/utils/opportunityIntelligenceEngine';

export interface GlobalOpportunitiesStore {
  version: number;
  updatedAt: string;
  international_opportunities: GlobalOpportunity[];
  opportunity_sources: OpportunitySourceRecord[];
  opportunity_verification_logs: OpportunityVerificationLogRecord[];
  opportunity_funding: OpportunityFundingRecord[];
  opportunity_eligibility: OpportunityEligibilityRecord[];
  opportunity_deadlines: OpportunityDeadlineRecord[];
  user_saved_opportunities: UserSavedOpportunityRecord[];
  user_opportunity_recommendations: UserOpportunityRecommendationRecord[];
  discovery_job_logs: DiscoveryJobLogRecord[];
  scheduler_state?: SchedulerPersistentState;
}

interface RegisterGlobalOpportunitiesDeps {
  app: Express;
  runtimeBaseDir: string;
  isVercel: boolean;
  ensureRuntimeDataDir: () => void;
  loadJsonFileSafe: <T>(filePath: string, fallback: T) => T;
  writeJsonFileAtomic: (filePath: string, data: any) => void;
  loadUserProfiles: () => Record<string, any>;
  isPersistentOwnerRequest: (req: Request) => boolean;
  getRequesterUid: (req: Request) => string | null;
  getRequesterEmail: (req: Request) => string | null;
  appendAuditLog: (entry: any) => void;
  getAiClient: () => Promise<any>;
}

const BLOCKED_UNOFFICIAL_DOMAINS = [
  'opportunitiescorners.com',
  'scholarshippositions.com',
  'afterschoolafrica.com',
  'opportunitydesk.org',
  'opportunitiesforyouth.org',
  'youthop.com',
  'scholars4dev.com',
  'brightscholarship.com',
  'blogspot.com',
  'wordpress.com',
  'medium.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  't.me',
  'telegram.me',
  'whatsapp.com',
  'youtu.be',
  'youtube.com',
  'x.com',
  'twitter.com',
  'linkedin.com',
];

const TRUSTED_OFFICIAL_HOST_PATTERNS: RegExp[] = [
  /\.gov(\.[a-z]{2})?$/i,
  /\.edu(\.[a-z]{2})?$/i,
  /\.ac\.[a-z]{2}$/i,
  /\.int$/i,
  /(^|\.)un\.org$/i,
  /(^|\.)unicef\.org$/i,
  /(^|\.)who\.int$/i,
  /(^|\.)unhabitat\.org$/i,
  /(^|\.)undp\.org$/i,
  /(^|\.)unhcr\.org$/i,
  /(^|\.)iom\.int$/i,
  /(^|\.)worldbank\.org$/i,
  /(^|\.)imf\.org$/i,
  /(^|\.)afdb\.org$/i,
  /(^|\.)ifc\.org$/i,
  /(^|\.)bis\.org$/i,
  /(^|\.)afi-global\.org$/i,
  /(^|\.)wateraid\.org$/i,
  /(^|\.)water\.org$/i,
  /(^|\.)rescue\.org$/i,
  /(^|\.)wvi\.org$/i,
  /(^|\.)savethechildren\.(org|net)$/i,
  /(^|\.)ifrc\.org$/i,
  /(^|\.)icrc\.org$/i,
  /(^|\.)oxfam\.org$/i,
  /(^|\.)actionagainsthunger\.org$/i,
  /(^|\.)drc\.ngo$/i,
  /(^|\.)reliefweb\.int$/i,
  /(^|\.)siwi\.org$/i,
  /(^|\.)iwa-network\.org$/i,
  /(^|\.)sanitationandwaterforall\.org$/i,
  /(^|\.)daad\.de$/i,
  /(^|\.)chevening\.org$/i,
  /(^|\.)mastercardfdn\.org$/i,
  /(^|\.)fulbrightonline\.org$/i,
  /(^|\.)erasmus-plus\.ec\.europa\.eu$/i,
  /(^|\.)europa\.eu$/i,
  /(^|\.)oecd\.org$/i,
  /(^|\.)wto\.org$/i,
  /(^|\.)ilo\.org$/i,
  /(^|\.)fao\.org$/i,
  /(^|\.)wfp\.org$/i,
  /(^|\.)unesco\.org$/i,
  /(^|\.)unep\.org$/i,
  /(^|\.)unops\.org$/i,
  /(^|\.)eib\.org$/i,
  /(^|\.)ebrd\.com$/i,
  /(^|\.)adb\.org$/i,
  /(^|\.)au\.int$/i,
  /(^|\.)eca\.org$/i,
  /(^|\.)uneca\.org$/i,
];

const WASH_TARGET_ORGS = [
  'unicef',
  'world health organization',
  'who',
  'un-habitat',
  'undp',
  'world bank',
  'african development bank',
  'afdb',
  'international organization for migration',
  'iom',
  'international rescue committee',
  'irc',
  'wateraid',
  'water.org',
  'world vision',
  'save the children',
  'ifrc',
  'red cross',
  'red crescent',
  'oxfam',
  'action against hunger',
  'danish refugee council',
  'norwegian refugee council',
  'care international',
  'snv',
  'siwi',
  'unhcr',
];

/**
 * Strict SSRF & Official URL guard.
 * Blocks non-HTTPS protocols, private/loopback/link-local IPs, and unofficial aggregator/blog hosts.
 */
export function validateOfficialExternalUrl(rawUrl: string): {
  valid: boolean;
  isOfficialDomain: boolean;
  hostname: string;
  normalizedUrl: string;
  reason?: string;
} {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed || trimmed.length > 1000) {
    return { valid: false, isOfficialDomain: false, hostname: '', normalizedUrl: '', reason: 'Missing or oversized URL' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, isOfficialDomain: false, hostname: '', normalizedUrl: '', reason: 'Malformed URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, isOfficialDomain: false, hostname: parsed.hostname, normalizedUrl: '', reason: 'Only HTTPS official URLs are permitted' };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '::1' ||
    host.startsWith('[') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^0\./.test(host) ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return { valid: false, isOfficialDomain: false, hostname: host, normalizedUrl: '', reason: 'Blocked private, loopback, or raw-IP host (SSRF protection)' };
  }

  if (BLOCKED_UNOFFICIAL_DOMAINS.some((bad) => host === bad || host.endsWith(`.${bad}`))) {
    return { valid: false, isOfficialDomain: false, hostname: host, normalizedUrl: parsed.toString(), reason: 'Unofficial aggregator or social media domain blocked' };
  }

  const isTrustedPattern = TRUSTED_OFFICIAL_HOST_PATTERNS.some((re) => re.test(host));
  const isOfficialTld = /\.(org|int|gov|edu|ngo)$/i.test(host) || /\.ac\.[a-z]{2}$/i.test(host) || /\.gov\.[a-z]{2}$/i.test(host);

  return {
    valid: true,
    isOfficialDomain: isTrustedPattern || isOfficialTld || host.split('.').length >= 2,
    hostname: host,
    normalizedUrl: parsed.toString(),
  };
}

// Per-origin robots.txt cache (TTL 15 minutes)
const robotsCache = new Map<string, { checkedAt: number; disallowedPrefixes: string[] }>();

async function isAllowedByRobotsTxt(targetUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(targetUrl);
    const origin = parsed.origin;
    const now = Date.now();
    const cached = robotsCache.get(origin);

    let disallowedPrefixes: string[] = [];
    if (cached && now - cached.checkedAt < 15 * 60 * 1000) {
      disallowedPrefixes = cached.disallowedPrefixes;
    } else {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      try {
        const resp = await fetch(`${origin}/robots.txt`, {
          method: 'GET',
          headers: { 'User-Agent': 'HopelandJobsBot/1.0 (+https://hopelandjobs.tech)' },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (resp.ok) {
          const text = await resp.text();
          let inStarBlock = false;
          for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.replace(/#.*$/, '').trim();
            if (!line) continue;
            if (/^user-agent:\s*\*/i.test(line)) {
              inStarBlock = true;
            } else if (/^user-agent:/i.test(line)) {
              inStarBlock = false;
            } else if (inStarBlock && /^disallow:/i.test(line)) {
              const rule = line.replace(/^disallow:\s*/i, '').trim();
              if (rule) disallowedPrefixes.push(rule);
            }
          }
        }
      } catch {
        clearTimeout(timer);
      }
      robotsCache.set(origin, { checkedAt: now, disallowedPrefixes });
    }

    const pathname = parsed.pathname || '/';
    for (const prefix of disallowedPrefixes) {
      if (prefix === '/') return false;
      if (prefix && pathname.startsWith(prefix)) return false;
    }
    return true;
  } catch {
    return true;
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries: number = 2,
  timeoutMs: number = 8500
): Promise<globalThis.Response> {
  let lastErr: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if ((resp.status === 429 || resp.status >= 500) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
        continue;
      }
      return resp;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr || new Error('Network request failed');
}

async function fetchTextViaHttp2(
  targetUrl: string,
  timeoutMs: number = 9000,
  redirectDepth: number = 0
): Promise<{ status: number; body: string; finalUrl: string }> {
  const urlCheck = validateOfficialExternalUrl(targetUrl);
  if (!urlCheck.valid) {
    throw new Error(urlCheck.reason || 'Unsafe URL blocked');
  }
  const parsed = new URL(urlCheck.normalizedUrl);

  return new Promise((resolve, reject) => {
    let settled = false;
    const client = http2.connect(parsed.origin);

    const finish = (err: Error | null, result?: { status: number; body: string; finalUrl: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        client.close();
      } catch {}
      if (err) reject(err);
      else resolve(result!);
    };

    const timer = setTimeout(() => {
      finish(new Error('HTTP/2 request timed out'));
    }, timeoutMs);

    client.on('error', (err) => {
      finish(err instanceof Error ? err : new Error(String(err)));
    });

    const req = client.request({
      ':path': `${parsed.pathname}${parsed.search}`,
      ':method': 'GET',
      'user-agent': 'curl/8.5.0',
      accept: '*/*',
    });

    let status = 0;
    let locationHeader = '';
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const MAX_BYTES = 1_500_000;

    req.on('response', (headers) => {
      status = Number(headers[':status'] || 0);
      const loc = headers['location'] as string | string[] | undefined;
      if (typeof loc === 'string') locationHeader = loc;
      else if (Array.isArray(loc) && loc.length > 0) locationHeader = String(loc[0]);
    });

    req.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (totalBytes + buf.length <= MAX_BYTES) {
        chunks.push(buf);
        totalBytes += buf.length;
      }
    });

    req.on('end', () => {
      if ([301, 302, 303, 307, 308].includes(status) && locationHeader && redirectDepth < 2) {
        try {
          const nextUrl = new URL(locationHeader, parsed.origin).toString();
          clearTimeout(timer);
          settled = true;
          try {
            client.close();
          } catch {}
          fetchTextViaHttp2(nextUrl, timeoutMs, redirectDepth + 1).then(resolve).catch(reject);
          return;
        } catch {
          // Fall through and return raw redirect status
        }
      }
      const body = Buffer.concat(chunks).toString('utf8');
      finish(null, { status, body, finalUrl: parsed.toString() });
    });

    req.on('error', (err) => {
      finish(err instanceof Error ? err : new Error(String(err)));
    });

    req.end();
  });
}

function stripHtmlToText(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RawCandidateOpportunity {
  title: string;
  organization: string;
  organizationType: GlobalOpportunity['organizationType'];
  category: GlobalOpportunityCategory;
  country: string;
  location: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  originalSourceUrl: string;
  officialApplicationUrl: string;
  deadlineDateRaw: string;
  deadlineTimezone?: string;
  startDate?: string;
  fundingSummary?: string;
  visaSummary?: string;
  applicationFee?: string;
  stipendOrSalary?: string;
  eligibleNationalities?: string[];
  ethiopianEligible?: OpportunityEligibilityRecord['ethiopianEligible'];
  educationRequirement?: string;
  minimumEducationLevel?: OpportunityEligibilityRecord['minimumEducationLevel'];
  experienceRequirement?: string;
  minimumYearsExperience?: number | null;
  careerLevel?: OpportunityEligibilityRecord['careerLevel'];
  requiredSkills?: string[];
  languagesRequired?: string[];
  universityRecommendationRequired?: RequirementBooleanStatus;
  companyRecommendationRequired?: RequirementBooleanStatus;
  institutionalNominationRequired?: RequirementBooleanStatus;
  directIndividualApplicationAllowed?: OpportunityEligibilityRecord['directIndividualApplicationAllowed'];
  fullText?: string;
  preVerifiedByOfficialApi?: boolean;
}

function parseMinimumYearsFromText(text: string): number | null {
  const lower = String(text || '').toLowerCase();
  if (/\b(0[\s-]+years?|no\s+experience\s+required|fresh\s+graduate|entry[\s-]level)\b/.test(lower)) {
    return 0;
  }
  const m = lower.match(/(?:minimum|at\s+least|min\.?)?\s*(\d{1,2})\s*(?:\+|plus)?\s*(?:to\s+\d+\s*)?years?\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?experience/);
  if (m) return Number(m[1]);
  const bandMatch = lower.match(/\b(\d{1,2})\s*[-–]\s*\d{1,2}\s*years?\b/);
  if (bandMatch) return Number(bandMatch[1]);
  return null;
}

function parseMinEducationFromText(text: string): OpportunityEligibilityRecord['minimumEducationLevel'] {
  const lower = String(text || '').toLowerCase();
  if (/\b(phd|ph\.d|doctoral\s+degree|doctorate)\b/.test(lower)) return 'phd';
  if (/\b(master'?s|msc|m\.sc|mba|advanced\s+university\s+degree|postgraduate\s+degree)\b/.test(lower)) return 'masters';
  if (/\b(bachelor'?s|bsc|b\.sc|ba\s+degree|university\s+degree|first[\s-]level\s+university\s+degree|undergraduate\s+degree)\b/.test(lower)) return 'bachelors';
  if (/\b(diploma|associate\s+degree|tvet)\b/.test(lower)) return 'diploma';
  return 'not_confirmed';
}

function inferOrganizationType(orgName: string, hostname: string): GlobalOpportunity['organizationType'] {
  const combined = `${orgName} ${hostname}`.toLowerCase();
  if (/\b(unicef|who|undp|unhcr|un-habitat|unep|unesco|unops|wfp|fao|ilo|iom|united nations)\b/.test(combined) || /\.int$/.test(hostname)) {
    return 'un_agency';
  }
  if (/\b(world bank|african development bank|afdb|imf|ifc|eib|ebrd|adb|central bank|bank)\b/.test(combined)) {
    return 'multilateral_bank';
  }
  if (/\b(wateraid|water\.org|rescue committee|irc|world vision|save the children|ifrc|red cross|oxfam|action against hunger|drc|nrc|care)\b/.test(combined)) {
    return 'international_ngo';
  }
  if (/\b(university|college|institute|school of)\b/.test(combined) || /\.edu(\.[a-z]{2})?$/.test(hostname) || /\.ac\.[a-z]{2}$/.test(hostname)) {
    return 'university';
  }
  if (/\b(ministry|government|agency|commission|authority|embassy)\b/.test(combined) || /\.gov(\.[a-z]{2})?$/.test(hostname)) {
    return 'government_agency';
  }
  if (/\b(summit|forum|conference|congress|symposium|week)\b/.test(combined)) {
    return 'conference_organizer';
  }
  return 'other';
}

type SearchProviderKey = 'reliefweb' | 'direct_websites' | 'gemini' | 'tavily' | 'brave';

export const ETHIOPIA_TIMEZONE = 'Africa/Addis_Ababa' as const;
export const ETHIOPIA_UTC_OFFSET_HOURS = 3; // Ethiopia permanently observes EAT (UTC+3), no DST
export const ETHIOPIA_SCHEDULE_HOURS = [0, 6, 12, 18] as const;
export const ETHIOPIA_SCHEDULE_LABELS = ['00:00', '06:00', '12:00', '18:00'];
// Exact UTC cron for 00:00, 06:00, 12:00, 18:00 Africa/Addis_Ababa (UTC+3): 21:00, 03:00, 09:00, 15:00 UTC
export const ETHIOPIA_CRON_EXPRESSION_UTC = '0 3,9,15,21 * * *';

export function formatEthiopiaDateTime(input: string | number | Date | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const eatMs = d.getTime() + ETHIOPIA_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  const eat = new Date(eatMs);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(eat.getUTCDate()).padStart(2, '0');
  const mon = months[eat.getUTCMonth()];
  const yr = eat.getUTCFullYear();
  const hh = String(eat.getUTCHours()).padStart(2, '0');
  const mm = String(eat.getUTCMinutes()).padStart(2, '0');
  const ss = String(eat.getUTCSeconds()).padStart(2, '0');
  return `${day} ${mon} ${yr}, ${hh}:${mm}:${ss} EAT (Africa/Addis_Ababa)`;
}

export function getNextEthiopiaScheduleSlot(nowMs: number = Date.now()): {
  utcMs: number;
  utcIso: string;
  eatFormatted: string;
  slotLabelEat: string;
  msUntilNext: number;
} {
  const offsetMs = ETHIOPIA_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  const eatNow = new Date(nowMs + offsetMs);
  const y = eatNow.getUTCFullYear();
  const m = eatNow.getUTCMonth();
  const d = eatNow.getUTCDate();

  // Check today's 4 slots in EAT (00:00, 06:00, 12:00, 18:00) plus tomorrow's 00:00 EAT
  const candidates: Array<{ hour: number; dayOffset: number }> = [
    { hour: 0, dayOffset: 0 },
    { hour: 6, dayOffset: 0 },
    { hour: 12, dayOffset: 0 },
    { hour: 18, dayOffset: 0 },
    { hour: 0, dayOffset: 1 },
  ];

  for (const c of candidates) {
    const slotEatAsUtcMs = Date.UTC(y, m, d + c.dayOffset, c.hour, 0, 0, 0);
    const slotRealUtcMs = slotEatAsUtcMs - offsetMs;
    // Always pick strictly future slot (>= 1 second ahead to avoid double-triggering on boundary)
    if (slotRealUtcMs > nowMs + 1000) {
      const slotLabel = `${String(c.hour).padStart(2, '0')}:00 Africa/Addis_Ababa`;
      return {
        utcMs: slotRealUtcMs,
        utcIso: new Date(slotRealUtcMs).toISOString(),
        eatFormatted: formatEthiopiaDateTime(slotRealUtcMs) || slotLabel,
        slotLabelEat: slotLabel,
        msUntilNext: slotRealUtcMs - nowMs,
      };
    }
  }

  // Fallback (mathematically unreachable because tomorrow 00:00 is always > nowMs)
  const fallbackMs = nowMs + 6 * 60 * 60 * 1000;
  return {
    utcMs: fallbackMs,
    utcIso: new Date(fallbackMs).toISOString(),
    eatFormatted: formatEthiopiaDateTime(fallbackMs) || new Date(fallbackMs).toISOString(),
    slotLabelEat: '00:00 Africa/Addis_Ababa',
    msUntilNext: 6 * 60 * 60 * 1000,
  };
}

export function getDiscoveryIntervalMinutes(): number {
  const raw = process.env.DISCOVERY_INTERVAL_MINUTES;
  if (raw === undefined || String(raw).trim() === '') return 360; // Default: every 6 hours
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 360;
  return Math.max(10, Math.min(Math.round(parsed), 1440));
}

export function getEnabledSearchProviders(): Set<SearchProviderKey> {
  const raw = String(process.env.OPPORTUNITY_SEARCH_PROVIDERS || 'auto').trim().toLowerCase();
  if (!raw || raw === 'auto' || raw === 'all') {
    return new Set<SearchProviderKey>(['reliefweb', 'direct_websites', 'gemini', 'tavily', 'brave']);
  }
  const allowed: SearchProviderKey[] = ['reliefweb', 'direct_websites', 'gemini', 'tavily', 'brave'];
  const parsed = raw
    .split(',')
    .map((p) => p.trim() as SearchProviderKey)
    .filter((p) => allowed.includes(p));
  return new Set<SearchProviderKey>(parsed);
}

function buildInitialSourcesCatalog(): OpportunitySourceRecord[] {
  const enabledProviders = getEnabledSearchProviders();

  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY?.trim() &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );
  const hasTavilyKey = Boolean(
    process.env.TAVILY_API_KEY?.trim() &&
      process.env.TAVILY_API_KEY !== 'MY_TAVILY_API_KEY'
  );
  const hasBraveKey = Boolean(
    process.env.BRAVE_SEARCH_API_KEY?.trim() &&
      process.env.BRAVE_SEARCH_API_KEY !== 'MY_BRAVE_SEARCH_API_KEY'
  );

  const reliefwebEnabled = enabledProviders.has('reliefweb');
  const directWebsitesEnabled = enabledProviders.has('direct_websites');
  const geminiEnabled = enabledProviders.has('gemini');
  const tavilyEnabled = enabledProviders.has('tavily');
  const braveEnabled = enabledProviders.has('brave');

  return [
    {
      id: 'reliefweb_jobs_wash_intl',
      name: 'ReliefWeb Official UN & INGO Recruitment Feeds (WASH, Banking & Finance, International Jobs)',
      providerType: 'official_api',
      organizationGroup: 'United Nations OCHA, UNICEF, WHO, UNDP, IOM, IRC, WaterAid, World Vision, Save the Children, IFRC',
      baseUrl: 'https://reliefweb.int/jobs/rss.xml',
      categoriesCovered: ['wash_opportunity', 'international_job'],
      sectorsCovered: ['wash', 'banking_finance', 'humanitarian', 'international_development', 'healthcare_public_health', 'engineering'],
      configured: reliefwebEnabled,
      requiresCredentials: false,
      isOptional: false,
      disabledByConfig: !reliefwebEnabled,
      pricingNote: 'Free official public feed (no API key required). Runs automatically every 30 minutes.',
      requiredEnvVars: [],
      status: reliefwebEnabled ? 'connected' : 'disabled',
      lastPolledAt: null,
      lastSuccessAt: null,
      lastItemCount: 0,
      lastError: reliefwebEnabled ? null : 'Disabled via OPPORTUNITY_SEARCH_PROVIDERS.',
    },
    {
      id: 'reliefweb_training_conferences',
      name: 'ReliefWeb Official Training, Fellowships, Scholarships & Conferences Feeds',
      providerType: 'official_api',
      organizationGroup: 'United Nations OCHA & Official Global Training / Conference Partners',
      baseUrl: 'https://reliefweb.int/training/rss.xml',
      categoriesCovered: ['professional_training', 'conference_summit', 'wash_opportunity', 'university_scholarship'],
      sectorsCovered: ['wash', 'banking_finance', 'humanitarian', 'international_development', 'climate_environment', 'healthcare_public_health', 'leadership_management'],
      configured: reliefwebEnabled,
      requiresCredentials: false,
      isOptional: false,
      disabledByConfig: !reliefwebEnabled,
      pricingNote: 'Free official public feed (no API key required). Runs automatically every 30 minutes.',
      requiredEnvVars: [],
      status: reliefwebEnabled ? 'connected' : 'disabled',
      lastPolledAt: null,
      lastSuccessAt: null,
      lastItemCount: 0,
      lastError: reliefwebEnabled ? null : 'Disabled via OPPORTUNITY_SEARCH_PROVIDERS.',
    },
    {
      id: 'official_direct_website_monitor',
      name: 'Direct Official Institutional Website Monitor (BIS, World Bank, AFI, EIB, DAAD, Chevening, Mastercard Fdn, World Water Week, UNICEF, WHO, UNITAR)',
      providerType: 'direct_website_monitor',
      organizationGroup: 'Official Multilateral Banks, Universities, UN Agencies, Government Scholarship & WASH Portals',
      baseUrl: 'https://www.bis.org/events/index.htm',
      categoriesCovered: ['international_job', 'university_scholarship', 'professional_training', 'conference_summit', 'wash_opportunity'],
      sectorsCovered: ['banking_finance', 'wash', 'international_development', 'healthcare_public_health', 'leadership_management'],
      configured: directWebsitesEnabled,
      requiresCredentials: false,
      isOptional: false,
      disabledByConfig: !directWebsitesEnabled,
      pricingNote: 'Free direct monitoring of 11 verified official portals (respects robots.txt; no API key required).',
      requiredEnvVars: [],
      status: directWebsitesEnabled ? 'connected' : 'disabled',
      lastPolledAt: null,
      lastSuccessAt: null,
      lastItemCount: 0,
      lastError: directWebsitesEnabled ? null : 'Disabled via OPPORTUNITY_SEARCH_PROVIDERS.',
    },
    {
      id: 'gemini_official_search_grounding',
      name: 'Gemini with Native Google Search Grounding (Scholarships, Banking & Finance, WASH, Trainings, Conferences)',
      providerType: 'gemini_search_grounding',
      organizationGroup: 'Global Official Universities, Multilateral Banks, UN & Government Portals',
      baseUrl: 'https://generativelanguage.googleapis.com',
      categoriesCovered: ['international_job', 'university_scholarship', 'professional_training', 'conference_summit', 'wash_opportunity'],
      sectorsCovered: ['banking_finance', 'wash', 'technology_ai', 'international_development', 'engineering', 'entrepreneurship_business', 'leadership_management'],
      configured: geminiEnabled && hasGeminiKey,
      requiresCredentials: true,
      isOptional: true,
      disabledByConfig: !geminiEnabled,
      pricingNote: 'Recommended live web search (no Custom Search API required). Includes free monthly grounding allowance; paid tier billed per 1,000 grounded queries.',
      requiredEnvVars: ['GEMINI_API_KEY'],
      status: !geminiEnabled ? 'disabled' : hasGeminiKey ? 'connected' : 'optional_unconfigured',
      lastPolledAt: null,
      lastSuccessAt: null,
      lastItemCount: 0,
      lastError: !geminiEnabled
        ? 'Disabled via OPPORTUNITY_SEARCH_PROVIDERS.'
        : hasGeminiKey
        ? null
        : 'Optional: Configure GEMINI_API_KEY in server environment to enable live Gemini Google Search grounding.',
    },
    {
      id: 'tavily_web_search_api',
      name: 'Tavily Live Web Search API (Optional Multi-Sector Discovery Fallback)',
      providerType: 'tavily_search_api',
      organizationGroup: 'Tavily Live Search (Filtered to Official Institutional Domains)',
      baseUrl: 'https://api.tavily.com/search',
      categoriesCovered: ['international_job', 'university_scholarship', 'professional_training', 'conference_summit', 'wash_opportunity'],
      sectorsCovered: ['banking_finance', 'wash', 'technology_ai', 'international_development', 'engineering'],
      configured: tavilyEnabled && hasTavilyKey,
      requiresCredentials: true,
      isOptional: true,
      disabledByConfig: !tavilyEnabled,
      pricingNote: 'Optional provider: 1,000 free search credits/month (no credit card required); pay-as-you-go $0.008/credit thereafter.',
      requiredEnvVars: ['TAVILY_API_KEY'],
      status: !tavilyEnabled ? 'disabled' : hasTavilyKey ? 'connected' : 'optional_unconfigured',
      lastPolledAt: null,
      lastSuccessAt: null,
      lastItemCount: 0,
      lastError: !tavilyEnabled
        ? 'Disabled via OPPORTUNITY_SEARCH_PROVIDERS.'
        : hasTavilyKey
        ? null
        : 'Optional: Add TAVILY_API_KEY to enable additional live web discovery (website works without it).',
    },
    {
      id: 'brave_web_search_api',
      name: 'Brave Live Web Search API (Optional Independent Index Fallback)',
      providerType: 'brave_search_api',
      organizationGroup: 'Brave Search Independent Web Index (Official Domains Only)',
      baseUrl: 'https://api.search.brave.com/res/v1/web/search',
      categoriesCovered: ['international_job', 'university_scholarship', 'professional_training', 'conference_summit', 'wash_opportunity'],
      sectorsCovered: ['banking_finance', 'wash', 'technology_ai', 'international_development', 'engineering'],
      configured: braveEnabled && hasBraveKey,
      requiresCredentials: true,
      isOptional: true,
      disabledByConfig: !braveEnabled,
      pricingNote: 'Optional provider: $5/month free credit (~1,000 queries/month; card required on signup), $5 per 1,000 queries thereafter.',
      requiredEnvVars: ['BRAVE_SEARCH_API_KEY'],
      status: !braveEnabled ? 'disabled' : hasBraveKey ? 'connected' : 'optional_unconfigured',
      lastPolledAt: null,
      lastSuccessAt: null,
      lastItemCount: 0,
      lastError: !braveEnabled
        ? 'Disabled via OPPORTUNITY_SEARCH_PROVIDERS.'
        : hasBraveKey
        ? null
        : 'Optional: Add BRAVE_SEARCH_API_KEY to enable Brave Search fallback (website works without it).',
    },
  ];
}

// =========================================================================
// LIVE OFFICIAL SOURCE CONNECTORS (ZERO FAKE DATA)
// =========================================================================

function decodeXmlEntities(input: string): string {
  return String(input || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

interface ParsedReliefWebRssItem {
  title: string;
  link: string;
  country: string;
  organization: string;
  closingDate: string;
  registrationDeadline: string;
  startDate: string;
  descriptionHtml: string;
  descriptionText: string;
}

function parseReliefWebRssXml(xml: string): ParsedReliefWebRssItem[] {
  const items: ParsedReliefWebRssItem[] = [];
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  for (const rawItem of itemMatches) {
    const extractTag = (tag: string): string => {
      const m = rawItem.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? decodeXmlEntities(m[1]).trim() : '';
    };

    const title = extractTag('title');
    const link = extractTag('link');
    const descHtml = extractTag('description');
    if (!title || !link) continue;

    const extractDivLabel = (cssClass: string, prefix: string): string => {
      const m = descHtml.match(new RegExp(`<div class="${cssClass}">\\s*${prefix}\\s*([^<]+)<\\/div>`, 'i'));
      return m ? m[1].trim() : '';
    };

    const country = extractDivLabel('tag country', 'Country:');
    const organization = extractDivLabel('tag source', 'Organization:');
    const closingDate = extractDivLabel('date closing', 'Closing date:');
    const registrationDeadline = extractDivLabel('date registration', 'Registration deadline:');
    const startDate = extractDivLabel('date start', 'Start date:');
    const descriptionText = stripHtmlToText(descHtml);

    items.push({
      title,
      link,
      country,
      organization,
      closingDate,
      registrationDeadline,
      startDate,
      descriptionHtml: descHtml,
      descriptionText,
    });
  }

  return items;
}

async function fetchReliefWebJobs(_appname: string): Promise<{ candidates: RawCandidateOpportunity[]; error?: string }> {
  try {
    const feeds = [
      {
        label: 'WASH',
        url: 'https://reliefweb.int/jobs/rss.xml?advanced-search=%28T4604%29',
        limit: 16,
      },
      {
        label: 'BankingFinance',
        url: 'https://reliefweb.int/jobs/rss.xml?search=finance+OR+banking+OR+grant+OR+microfinance',
        limit: 14,
      },
      {
        label: 'GeneralIntl',
        url: 'https://reliefweb.int/jobs/rss.xml',
        limit: 14,
      },
    ];

    const candidates: RawCandidateOpportunity[] = [];
    const seenLinks = new Set<string>();
    const errors: string[] = [];

    for (const feed of feeds) {
      let xml = '';
      let status = 0;
      try {
        const h2 = await fetchTextViaHttp2(feed.url, 10000);
        status = h2.status;
        xml = h2.body;
      } catch {
        const resp = await fetchWithRetry(
          feed.url,
          {
            method: 'GET',
            headers: {
              'User-Agent': 'HopelandJobs/1.0 (+https://hopelandjobs.tech)',
              Accept: '*/*',
            },
          },
          1,
          9000
        );
        status = resp.status;
        if (resp.ok) xml = await resp.text();
      }

      if (status < 200 || status >= 300 || !xml) {
        errors.push(`ReliefWeb ${feed.label} RSS returned HTTP ${status}`);
        continue;
      }

      const parsedItems = parseReliefWebRssXml(xml).slice(0, feed.limit);

      for (const item of parsedItems) {
        if (seenLinks.has(item.link)) continue;
        seenLinks.add(item.link);

        const closingDate = item.closingDate.trim();
        if (!closingDate) continue; // Never invent missing deadline

        const orgName = item.organization || 'International Organization';
        const countryName = item.country || 'International';
        const combinedText = `${item.title} ${orgName} ${item.descriptionText}`;

        const sectorDetect = detectSectorsFromText(combinedText);
        const isWashOrg = WASH_TARGET_ORGS.some((o) => orgName.toLowerCase().includes(o));
        const isWash = feed.label === 'WASH' || sectorDetect.isWash || (isWashOrg && /\b(water|sanitation|hygiene|wash)\b/i.test(combinedText));

        const minYears = parseMinimumYearsFromText(item.descriptionText);
        let careerLevel: OpportunityEligibilityRecord['careerLevel'] = 'not_confirmed';
        if (/\bintern(ship)?\b/i.test(item.title)) careerLevel = 'internship';
        else if (/\bfellow(ship)?\b/i.test(item.title)) careerLevel = 'fellowship';
        else if (minYears === 0) careerLevel = 'entry';
        else if (typeof minYears === 'number' && minYears >= 7) careerLevel = 'management';
        else if (typeof minYears === 'number' && minYears >= 3) careerLevel = 'mid';
        else careerLevel = 'technical';

        const lowerCombined = combinedText.toLowerCase();
        let ethiopianEligible: OpportunityEligibilityRecord['ethiopianEligible'] = 'likely_global';
        const eligibleNationalities: string[] = [];
        if (/\bethiopia(n)?\b/i.test(countryName) || /\bopen to ethiopian/i.test(lowerCombined)) {
          ethiopianEligible = 'confirmed';
          eligibleNationalities.push('Ethiopian citizens');
        } else if (
          /\b(national\s+position\s+only|nationals\s+of\s+[a-z]+\s+only|open\s+only\s+to\s+citizens\s+of|must\s+be\s+a\s+citizen\s+of\s+(?!ethiopia)|local\s+nationals\s+only)\b/i.test(
            lowerCombined
          )
        ) {
          ethiopianEligible = 'excluded';
          eligibleNationalities.push(`Host country nationals only (${countryName})`);
        } else if (/\b(international\s+(position|staff|recruitment|applicants)|all\s+nationalities)\b/i.test(lowerCombined)) {
          ethiopianEligible = 'confirmed';
          eligibleNationalities.push('All nationalities (including Ethiopian citizens)');
        } else {
          eligibleNationalities.push('International applicants (verify nationality criteria on official page)');
        }

        const minEdu = parseMinEducationFromText(item.descriptionText);

        candidates.push({
          title: item.title,
          organization: orgName,
          organizationType: inferOrganizationType(orgName, 'reliefweb.int'),
          category: isWash ? 'wash_opportunity' : 'international_job',
          country: countryName,
          location: countryName,
          summary: item.descriptionText.slice(0, 420) || `${item.title} with ${orgName} in ${countryName}.`,
          sourceId: 'reliefweb_jobs_wash_intl',
          sourceName: feed.label === 'WASH' ? 'ReliefWeb Official WASH Jobs Feed' : 'ReliefWeb Official UN & INGO Jobs Feed',
          originalSourceUrl: item.link,
          officialApplicationUrl: item.link,
          deadlineDateRaw: closingDate,
          deadlineTimezone: 'UTC',
          startDate: item.startDate || 'Not Confirmed',
          applicationFee: 'None (Official UN/NGO recruitment)',
          eligibleNationalities,
          ethiopianEligible,
          educationRequirement:
            minEdu === 'phd'
              ? 'Doctoral degree (PhD) or equivalent'
              : minEdu === 'masters'
              ? "Master's degree or equivalent (see official page)"
              : minEdu === 'bachelors'
              ? "Bachelor's degree in relevant field (see official page)"
              : 'See official vacancy requirements',
          minimumEducationLevel: minEdu,
          experienceRequirement: minYears !== null ? `Minimum ${minYears} year(s)` : 'See official vacancy requirements',
          minimumYearsExperience: minYears,
          careerLevel,
          requiredSkills: isWash
            ? ['WASH', 'Water & Sanitation', 'Hygiene']
            : sectorDetect.isBankingFinance
            ? ['Finance', 'Grant & Risk Management', 'Accounting']
            : ['International Development', 'Project Management'],
          languagesRequired: /\bfrench\b/i.test(lowerCombined) ? ['English', 'French'] : ['English'],
          universityRecommendationRequired: 'not_required',
          companyRecommendationRequired: 'not_required',
          institutionalNominationRequired: 'not_required',
          directIndividualApplicationAllowed: 'yes',
          fullText: combinedText.slice(0, 5000),
          preVerifiedByOfficialApi: true,
        });
      }
    }

    return { candidates, error: errors.length && candidates.length === 0 ? errors.join('; ') : undefined };
  } catch (err: any) {
    return { candidates: [], error: `ReliefWeb Jobs feed error: ${err?.message || String(err)}` };
  }
}

async function fetchReliefWebTrainings(_appname: string): Promise<{ candidates: RawCandidateOpportunity[]; error?: string }> {
  try {
    const feeds = [
      {
        label: 'ConferencesFellowships',
        url: 'https://reliefweb.int/training/rss.xml?search=conference+OR+summit+OR+forum+OR+scholarship+OR+fellowship',
        limit: 14,
      },
      {
        label: 'WashFinanceTraining',
        url: 'https://reliefweb.int/training/rss.xml?search=water+OR+sanitation+OR+wash+OR+finance+OR+banking',
        limit: 14,
      },
      {
        label: 'GeneralTraining',
        url: 'https://reliefweb.int/training/rss.xml',
        limit: 12,
      },
    ];

    const candidates: RawCandidateOpportunity[] = [];
    const seenLinks = new Set<string>();
    const errors: string[] = [];

    for (const feed of feeds) {
      let xml = '';
      let status = 0;
      try {
        const h2 = await fetchTextViaHttp2(feed.url, 10000);
        status = h2.status;
        xml = h2.body;
      } catch {
        try {
          const resp = await fetchWithRetry(
            feed.url,
            {
              method: 'GET',
              headers: {
                'User-Agent': 'HopelandJobs/1.0 (+https://hopelandjobs.tech)',
                Accept: '*/*',
              },
            },
            1,
            9000
          );
          status = resp.status;
          if (resp.ok) xml = await resp.text();
        } catch (err: any) {
          errors.push(`ReliefWeb ${feed.label} RSS error: ${err?.message || String(err)}`);
          continue;
        }
      }

      if (status < 200 || status >= 300 || !xml) {
        errors.push(`ReliefWeb ${feed.label} RSS returned HTTP ${status}`);
        continue;
      }

      const parsedItems = parseReliefWebRssXml(xml).slice(0, feed.limit);

      for (const item of parsedItems) {
        if (seenLinks.has(item.link)) continue;
        seenLinks.add(item.link);

        const closingDate = (item.registrationDeadline || item.closingDate || item.startDate || '').trim();
        if (!closingDate) continue;

        const orgName = item.organization || 'International Training Provider';
        const countryName = item.country || (/\bonline\b/i.test(item.descriptionText) ? 'Online / Global' : 'International');
        const combinedText = `${item.title} ${orgName} ${item.descriptionText}`;

        const isConference = /\b(conference|summit|forum|symposium|congress|colloquium)\b/i.test(combinedText);
        const isScholarship = /\b(scholarship|fellowship\s+grant|full\s+tuition)\b/i.test(item.title);
        const sectorDetect = detectSectorsFromText(combinedText);

        const category: GlobalOpportunityCategory = isConference
          ? 'conference_summit'
          : isScholarship
          ? 'university_scholarship'
          : sectorDetect.isWash && /\bfellowship\b/i.test(item.title)
          ? 'wash_opportunity'
          : 'professional_training';

        const isFree = /\b(free\s+of\s+charge|no\s+fee|fully[\s-]funded|tuition[\s-]free|free\s+course|free\s+training|scholarship\s+available)\b/i.test(
          combinedText
        );
        const isFeeBased = /\b(course\s+fee|tuition\s+fee|registration\s+fee|usd\s*\d+|eur\s*\d+|\$\s*\d+)\b/i.test(
          combinedText
        );

        const fundingSummary = isFree
          ? 'Free / Funded program (verify travel/accommodation coverage on official page)'
          : isFeeBased
          ? 'Fee-based / Self-funded (check official page for partial waivers)'
          : 'Funding Not Confirmed';

        const requiresCompanyNom = /\b(company\s+nomination\s+required|employer\s+nomination\s+mandatory|must\s+be\s+nominated\s+by\s+their\s+organization)\b/i.test(
          combinedText
        );
        const minEdu = parseMinEducationFromText(item.descriptionText);
        const minYears = parseMinimumYearsFromText(item.descriptionText);

        candidates.push({
          title: item.title,
          organization: orgName,
          organizationType: inferOrganizationType(orgName, 'reliefweb.int'),
          category,
          country: countryName,
          location: countryName,
          summary: item.descriptionText.slice(0, 420) || `${item.title} organized by ${orgName}.`,
          sourceId: 'reliefweb_training_conferences',
          sourceName: isConference
            ? 'ReliefWeb Official Conferences & Forums Feed'
            : 'ReliefWeb Official Training & Fellowships Feed',
          originalSourceUrl: item.link,
          officialApplicationUrl: item.link,
          deadlineDateRaw: closingDate,
          deadlineTimezone: 'UTC',
          startDate: item.startDate || 'Not Confirmed',
          fundingSummary,
          applicationFee: isFree ? 'None (Free)' : isFeeBased ? 'Fee-based (see official page)' : 'Not Confirmed',
          eligibleNationalities: ['All nationalities (including Ethiopian applicants)'],
          ethiopianEligible: 'confirmed',
          educationRequirement:
            minEdu !== 'not_confirmed'
              ? `${minEdu.toUpperCase()} or relevant background (see official page)`
              : 'Relevant professional or academic background (see official page)',
          minimumEducationLevel: minEdu,
          experienceRequirement: minYears !== null ? `${minYears}+ years` : 'Open to qualified practitioners',
          minimumYearsExperience: minYears,
          careerLevel: 'all_levels',
          requiredSkills: sectorDetect.isWash
            ? ['WASH', 'Water & Sanitation', 'Public Health']
            : sectorDetect.isBankingFinance
            ? ['Finance', 'Banking', 'Risk Management']
            : ['Professional Development', 'Humanitarian Leadership'],
          languagesRequired: ['English'],
          universityRecommendationRequired: 'not_required',
          companyRecommendationRequired: requiresCompanyNom ? 'required' : 'not_required',
          institutionalNominationRequired: requiresCompanyNom ? 'required' : 'not_required',
          directIndividualApplicationAllowed: requiresCompanyNom ? 'no' : 'yes',
          fullText: combinedText.slice(0, 5000),
          preVerifiedByOfficialApi: true,
        });
      }
    }

    return { candidates, error: errors.length && candidates.length === 0 ? errors.join('; ') : undefined };
  } catch (err: any) {
    return { candidates: [], error: `ReliefWeb Training feed error: ${err?.message || String(err)}` };
  }
}

function extractVerifiableDeadlineFromSnippet(text: string): string | null {
  const s = String(text || '');
  const m =
    s.match(/(?:deadline|closing\s+date|apply\s+by|applications?\s+close|due\s+date|register\s+by)[:\s-]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+202\d|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+202\d|202\d-\d{2}-\d{2})/i) ||
    s.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+202\d|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+202\d|202\d-\d{2}-\d{2})\b/i);
  return m ? m[1].trim() : null;
}

const LIVE_SEARCH_QUERIES: Array<{ q: string; category: GlobalOpportunityCategory; label: string }> = [
  {
    label: 'Fully Funded Scholarships',
    q: 'fully funded scholarship Ethiopian applicants direct application deadline 2026 OR 2027 (site:.edu OR site:.gov OR site:.org OR site:.de)',
    category: 'university_scholarship',
  },
  {
    label: 'Banking & Finance Jobs',
    q: 'international banking finance job visa sponsorship OR multilateral bank World Bank IMF AfDB deadline 2026 OR 2027',
    category: 'international_job',
  },
  {
    label: 'WASH Jobs & Fellowships',
    q: 'WASH water sanitation hygiene job OR fellowship UNICEF WHO WaterAid IRC UNDP deadline 2026 OR 2027',
    category: 'wash_opportunity',
  },
  {
    label: 'International Professional Training',
    q: 'fully funded international professional training banking microfinance OR WASH water sanitation deadline 2026 OR 2027',
    category: 'professional_training',
  },
  {
    label: 'Fully Funded Conferences',
    q: 'fully funded international conference OR summit banking finance OR WASH water security OR climate change application deadline 2026 OR 2027',
    category: 'conference_summit',
  },
];

async function fetchFromTavilySearch(): Promise<{ candidates: RawCandidateOpportunity[]; error?: string; configured: boolean }> {
  const apiKey = (process.env.TAVILY_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_TAVILY_API_KEY') {
    return { candidates: [], configured: false };
  }

  const candidates: RawCandidateOpportunity[] = [];
  const errors: string[] = [];
  const seenUrls = new Set<string>();

  for (const item of LIVE_SEARCH_QUERIES) {
    try {
      const resp = await fetchWithRetry(
        'https://api.tavily.com/search',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query: item.q,
            search_depth: 'basic',
            max_results: 6,
            include_raw_content: false,
          }),
        },
        1,
        8500
      );

      if (!resp.ok) {
        errors.push(`Tavily (${item.label}) HTTP ${resp.status}`);
        continue;
      }

      const data: any = await resp.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      for (const r of results) {
        const link = String(r.url || '').trim();
        const check = validateOfficialExternalUrl(link);
        if (!check.valid || !check.isOfficialDomain || seenUrls.has(check.normalizedUrl)) continue;
        seenUrls.add(check.normalizedUrl);

        const title = String(r.title || '').trim();
        const snippet = String(r.content || '').trim();
        const deadlineRaw = extractVerifiableDeadlineFromSnippet(`${title} ${snippet}`);
        if (!deadlineRaw) continue; // Never invent missing deadline

        const orgName = check.hostname.replace(/^www\./, '');
        candidates.push({
          title,
          organization: orgName,
          organizationType: inferOrganizationType(title, check.hostname),
          category: item.category,
          country: 'International',
          location: 'International',
          summary: snippet.slice(0, 420),
          sourceId: 'tavily_web_search_api',
          sourceName: `Official Portal via Tavily Live Search (${item.label})`,
          originalSourceUrl: check.normalizedUrl,
          officialApplicationUrl: check.normalizedUrl,
          deadlineDateRaw: deadlineRaw,
          deadlineTimezone: 'UTC',
          fullText: `${title} ${snippet}`,
          preVerifiedByOfficialApi: false,
        });
      }
    } catch (err: any) {
      errors.push(`Tavily (${item.label}): ${err?.message || String(err)}`);
    }
  }

  return { candidates, configured: true, error: errors.length && candidates.length === 0 ? errors.join('; ') : undefined };
}

async function fetchFromBraveSearch(): Promise<{ candidates: RawCandidateOpportunity[]; error?: string; configured: boolean }> {
  const apiKey = (process.env.BRAVE_SEARCH_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_BRAVE_SEARCH_API_KEY') {
    return { candidates: [], configured: false };
  }

  const candidates: RawCandidateOpportunity[] = [];
  const errors: string[] = [];
  const seenUrls = new Set<string>();

  for (const item of LIVE_SEARCH_QUERIES) {
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(item.q)}&count=6`;
      const resp = await fetchWithRetry(
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': apiKey,
          },
        },
        1,
        8500
      );

      if (!resp.ok) {
        errors.push(`Brave Search (${item.label}) HTTP ${resp.status}`);
        continue;
      }

      const data: any = await resp.json();
      const results = Array.isArray(data?.web?.results) ? data.web.results : [];
      for (const r of results) {
        const link = String(r.url || '').trim();
        const check = validateOfficialExternalUrl(link);
        if (!check.valid || !check.isOfficialDomain || seenUrls.has(check.normalizedUrl)) continue;
        seenUrls.add(check.normalizedUrl);

        const title = String(r.title || '').trim();
        const snippet = String(r.description || '').trim();
        const deadlineRaw = extractVerifiableDeadlineFromSnippet(`${title} ${snippet}`);
        if (!deadlineRaw) continue; // Never invent missing deadline

        const orgName = check.hostname.replace(/^www\./, '');
        candidates.push({
          title,
          organization: orgName,
          organizationType: inferOrganizationType(title, check.hostname),
          category: item.category,
          country: 'International',
          location: 'International',
          summary: snippet.slice(0, 420),
          sourceId: 'brave_web_search_api',
          sourceName: `Official Portal via Brave Live Search (${item.label})`,
          originalSourceUrl: check.normalizedUrl,
          officialApplicationUrl: check.normalizedUrl,
          deadlineDateRaw: deadlineRaw,
          deadlineTimezone: 'UTC',
          fullText: `${title} ${snippet}`,
          preVerifiedByOfficialApi: false,
        });
      }
    } catch (err: any) {
      errors.push(`Brave Search (${item.label}): ${err?.message || String(err)}`);
    }
  }

  return { candidates, configured: true, error: errors.length && candidates.length === 0 ? errors.join('; ') : undefined };
}

interface OfficialDirectPortalConfig {
  id: string;
  name: string;
  organization: string;
  organizationGroup: string;
  organizationType: GlobalOpportunity['organizationType'];
  url: string;
  defaultCategory: GlobalOpportunityCategory;
  country: string;
  parserMode: 'bis_events' | 'rss_or_html' | 'jsonld_or_html';
}

export const OFFICIAL_DIRECT_PORTALS: OfficialDirectPortalConfig[] = [
  {
    id: 'bis_events',
    name: 'Bank for International Settlements (BIS) Events & Central Banking Conferences',
    organization: 'Bank for International Settlements (BIS)',
    organizationGroup: 'Multilateral Central Bank Institution',
    organizationType: 'multilateral_bank',
    url: 'https://www.bis.org/events/index.htm',
    defaultCategory: 'conference_summit',
    country: 'Switzerland / International',
    parserMode: 'bis_events',
  },
  {
    id: 'afi_events_feed',
    name: 'Alliance for Financial Inclusion (AFI) Banking & Microfinance Events',
    organization: 'Alliance for Financial Inclusion (AFI)',
    organizationGroup: 'Global Financial Inclusion & Banking Network',
    organizationType: 'financial_institution',
    url: 'https://www.afi-global.org/events/feed/',
    defaultCategory: 'conference_summit',
    country: 'International',
    parserMode: 'rss_or_html',
  },
  {
    id: 'worldbank_events',
    name: 'World Bank Official Global Events & Forums',
    organization: 'World Bank Group',
    organizationGroup: 'Multilateral Development Bank',
    organizationType: 'multilateral_bank',
    url: 'https://www.worldbank.org/en/events',
    defaultCategory: 'conference_summit',
    country: 'International',
    parserMode: 'jsonld_or_html',
  },
  {
    id: 'eib_careers',
    name: 'European Investment Bank (EIB) Official Careers',
    organization: 'European Investment Bank (EIB)',
    organizationGroup: 'Multilateral Development Bank',
    organizationType: 'multilateral_bank',
    url: 'https://www.eib.org/en/about/careers/index.htm',
    defaultCategory: 'international_job',
    country: 'Luxembourg / International',
    parserMode: 'jsonld_or_html',
  },
  {
    id: 'daad_scholarships',
    name: 'DAAD Official German Government Scholarships',
    organization: 'DAAD (German Academic Exchange Service)',
    organizationGroup: 'Official Government Scholarship Portal',
    organizationType: 'government_agency',
    url: 'https://www.daad.de/en/studying-in-germany/scholarships/daad-scholarships/',
    defaultCategory: 'university_scholarship',
    country: 'Germany',
    parserMode: 'jsonld_or_html',
  },
  {
    id: 'chevening_scholarships',
    name: 'UK Government Chevening Scholarships Portal',
    organization: 'Chevening (UK FCDO)',
    organizationGroup: 'Official Government Scholarship Portal',
    organizationType: 'government_agency',
    url: 'https://www.chevening.org/scholarships/',
    defaultCategory: 'university_scholarship',
    country: 'United Kingdom',
    parserMode: 'jsonld_or_html',
  },
  {
    id: 'mastercard_scholars',
    name: 'Mastercard Foundation Scholars Program',
    organization: 'Mastercard Foundation',
    organizationGroup: 'Official Global University Scholarship Partner',
    organizationType: 'university',
    url: 'https://www.mastercardfdn.org/all/scholars/',
    defaultCategory: 'university_scholarship',
    country: 'International',
    parserMode: 'jsonld_or_html',
  },
  {
    id: 'world_water_week',
    name: 'SIWI Stockholm World Water Week (WASH Conference & Summit)',
    organization: 'Stockholm International Water Institute (SIWI)',
    organizationGroup: 'Official WASH & Water Security Portal',
    organizationType: 'conference_organizer',
    url: 'https://www.worldwaterweek.org/',
    defaultCategory: 'conference_summit',
    country: 'Sweden / Online',
    parserMode: 'jsonld_or_html',
  },
  {
    id: 'unicef_careers',
    name: 'UNICEF Official Global Careers Portal',
    organization: 'UNICEF',
    organizationGroup: 'United Nations Agency (WASH & Humanitarian)',
    organizationType: 'un_agency',
    url: 'https://www.unicef.org/careers/',
    defaultCategory: 'wash_opportunity',
    country: 'International',
    parserMode: 'jsonld_or_html',
  },
  {
    id: 'who_careers',
    name: 'World Health Organization (WHO) Official Careers Portal',
    organization: 'World Health Organization (WHO)',
    organizationGroup: 'United Nations Agency (Public Health & WASH)',
    organizationType: 'un_agency',
    url: 'https://www.who.int/careers',
    defaultCategory: 'wash_opportunity',
    country: 'International',
    parserMode: 'jsonld_or_html',
  },
  {
    id: 'unitar_courses',
    name: 'UN Institute for Training and Research (UNITAR) Official Courses',
    organization: 'UNITAR (United Nations)',
    organizationGroup: 'United Nations Official Professional Training Portal',
    organizationType: 'un_agency',
    url: 'https://www.unitar.org/courses',
    defaultCategory: 'professional_training',
    country: 'International / Online',
    parserMode: 'jsonld_or_html',
  },
];

function extractJsonLdOpportunitiesFromHtml(
  html: string,
  portal: OfficialDirectPortalConfig
): RawCandidateOpportunity[] {
  const results: RawCandidateOpportunity[] = [];
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];

  const visitNode = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visitNode);
      return;
    }
    if (Array.isArray(node['@graph'])) {
      node['@graph'].forEach(visitNode);
    }
    if (Array.isArray(node.itemListElement)) {
      node.itemListElement.forEach((el: any) => visitNode(el?.item || el));
    }

    const rawType = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '');
    if (!/\b(Event|JobPosting|Course|EducationalOccupationalProgram|Grant)\b/i.test(rawType)) {
      return;
    }

    const title = decodeXmlEntities(String(node.name || node.title || '').trim());
    const rawLink = String(node.url || node.sameAs || portal.url).trim();
    const rawDeadline = String(node.validThrough || node.applicationDeadline || node.endDate || node.startDate || '').trim();
    if (!title || title.length < 8 || !rawDeadline) return;

    let resolvedUrl = rawLink;
    try {
      resolvedUrl = new URL(rawLink, portal.url).toString();
    } catch {
      resolvedUrl = portal.url;
    }
    const urlCheck = validateOfficialExternalUrl(resolvedUrl);
    if (!urlCheck.valid || !urlCheck.isOfficialDomain) return;

    const desc = stripHtmlToText(String(node.description || '')).slice(0, 420);
    const country =
      String(node?.location?.address?.addressCountry || node?.jobLocation?.address?.addressCountry || portal.country).trim() ||
      portal.country;

    const category: GlobalOpportunityCategory = /JobPosting/i.test(rawType)
      ? portal.defaultCategory === 'wash_opportunity'
        ? 'wash_opportunity'
        : 'international_job'
      : /Event/i.test(rawType)
      ? 'conference_summit'
      : /Course/i.test(rawType)
      ? 'professional_training'
      : portal.defaultCategory;

    results.push({
      title,
      organization: portal.organization,
      organizationType: portal.organizationType,
      category,
      country,
      location: String(node?.location?.name || country),
      summary: desc || `${title} published on the official ${portal.organization} portal.`,
      sourceId: 'official_direct_website_monitor',
      sourceName: `Direct Official Monitor: ${portal.name}`,
      originalSourceUrl: portal.url,
      officialApplicationUrl: urlCheck.normalizedUrl,
      deadlineDateRaw: rawDeadline,
      deadlineTimezone: 'UTC',
      startDate: String(node.startDate || 'Not Confirmed'),
      fundingSummary: 'Funding Not Confirmed',
      eligibleNationalities: ['All nationalities (verify eligibility on official portal)'],
      ethiopianEligible: 'likely_global',
      directIndividualApplicationAllowed: 'yes',
      fullText: `${title} ${portal.organization} ${desc}`,
      preVerifiedByOfficialApi: false,
    });
  };

  for (const scriptTag of scripts.slice(0, 12)) {
    const inner = scriptTag.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    if (!inner) continue;
    try {
      visitNode(JSON.parse(inner));
    } catch {
      // Ignore non-JSON script blocks
    }
  }

  return results;
}

function extractBisEventCardsFromHtml(html: string, portal: OfficialDirectPortalConfig): RawCandidateOpportunity[] {
  const results: RawCandidateOpportunity[] = [];
  const cardMatches = html.match(/<a[^>]+href="([^"]*\/events\/[^"]+)"[^>]*class="card-link"[^>]*>[\s\S]*?<\/a>/gi) || [];

  for (const card of cardMatches.slice(0, 12)) {
    const hrefMatch = card.match(/href="([^"]+)"/i);
    const dateMatch = card.match(/<span[^>]+class="[^"]*card-date[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const titleMatch = card.match(/<h[3-6][^>]+class="[^"]*card-heading[^"]*"[^>]*>([\s\S]*?)<\/h[3-6]>/i);
    if (!hrefMatch || !dateMatch || !titleMatch) continue;

    const title = decodeXmlEntities(stripHtmlToText(titleMatch[1])).trim();
    const dateStr = stripHtmlToText(dateMatch[1]).trim();
    if (!title || !dateStr) continue;

    let resolvedUrl = '';
    try {
      resolvedUrl = new URL(hrefMatch[1], portal.url).toString();
    } catch {
      continue;
    }
    const urlCheck = validateOfficialExternalUrl(resolvedUrl);
    if (!urlCheck.valid || !urlCheck.isOfficialDomain) continue;

    const isTraining = /\b(seminar|workshop|course|training|tutorial)\b/i.test(title);
    results.push({
      title,
      organization: portal.organization,
      organizationType: 'multilateral_bank',
      category: isTraining ? 'professional_training' : 'conference_summit',
      country: 'Switzerland / International',
      location: 'Basel / International (see official BIS event page)',
      summary: `Official Bank for International Settlements (BIS) banking, finance, and central banking event scheduled for ${dateStr}. Verify registration criteria on the official BIS page.`,
      sourceId: 'official_direct_website_monitor',
      sourceName: `Direct Official Monitor: ${portal.name}`,
      originalSourceUrl: portal.url,
      officialApplicationUrl: urlCheck.normalizedUrl,
      deadlineDateRaw: dateStr,
      deadlineTimezone: 'Europe/Zurich',
      startDate: dateStr,
      fundingSummary: 'Funding Not Confirmed',
      applicationFee: 'Not Confirmed',
      eligibleNationalities: ['Central bank, financial regulation & banking professionals (verify on official BIS page)'],
      ethiopianEligible: 'likely_global',
      educationRequirement: 'Banking, Finance, Economics or Statistics background (see official page)',
      experienceRequirement: 'See official BIS event participation rules',
      requiredSkills: ['Central Banking', 'Financial Regulation', 'Banking & Finance', 'Risk Management'],
      languagesRequired: ['English'],
      universityRecommendationRequired: 'not_required',
      companyRecommendationRequired: 'not_confirmed',
      institutionalNominationRequired: 'not_confirmed',
      directIndividualApplicationAllowed: 'not_confirmed',
      fullText: `${title} Bank for International Settlements central banking financial regulation conference seminar`,
      preVerifiedByOfficialApi: false,
    });
  }

  return results;
}

function extractGenericRssOpportunities(xml: string, portal: OfficialDirectPortalConfig): RawCandidateOpportunity[] {
  const results: RawCandidateOpportunity[] = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const rawItem of items.slice(0, 10)) {
    const extractTag = (tag: string): string => {
      const m = rawItem.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? decodeXmlEntities(m[1]).trim() : '';
    };
    const title = extractTag('title');
    const link = extractTag('link');
    const desc = stripHtmlToText(extractTag('description'));
    if (!title || !link) continue;
    const deadlineRaw = extractVerifiableDeadlineFromSnippet(`${title} ${desc}`);
    if (!deadlineRaw) continue; // Never invent missing deadline
    const urlCheck = validateOfficialExternalUrl(link);
    if (!urlCheck.valid || !urlCheck.isOfficialDomain) continue;

    results.push({
      title,
      organization: portal.organization,
      organizationType: portal.organizationType,
      category: portal.defaultCategory,
      country: portal.country,
      location: portal.country,
      summary: desc.slice(0, 420) || `${title} published on ${portal.organization}.`,
      sourceId: 'official_direct_website_monitor',
      sourceName: `Direct Official Monitor: ${portal.name}`,
      originalSourceUrl: portal.url,
      officialApplicationUrl: urlCheck.normalizedUrl,
      deadlineDateRaw: deadlineRaw,
      deadlineTimezone: 'UTC',
      fundingSummary: 'Funding Not Confirmed',
      eligibleNationalities: ['All nationalities (verify on official portal)'],
      ethiopianEligible: 'likely_global',
      fullText: `${title} ${portal.organization} ${desc}`,
      preVerifiedByOfficialApi: false,
    });
  }
  return results;
}

async function fetchFromDirectOfficialWebsites(): Promise<{
  candidates: RawCandidateOpportunity[];
  portalChecks: MonitoredPortalCheck[];
  error?: string;
}> {
  const candidates: RawCandidateOpportunity[] = [];
  const portalChecks: MonitoredPortalCheck[] = [];
  const errors: string[] = [];
  const seenUrls = new Set<string>();

  await Promise.all(
    OFFICIAL_DIRECT_PORTALS.map(async (portal) => {
      const checkedAt = new Date().toISOString();
      const urlCheck = validateOfficialExternalUrl(portal.url);
      if (!urlCheck.valid || !urlCheck.isOfficialDomain) {
        portalChecks.push({
          name: portal.name,
          url: portal.url,
          organizationGroup: portal.organizationGroup,
          httpStatus: null,
          robotsAllowed: false,
          itemsFound: 0,
          checkedAt,
        });
        return;
      }

      const robotsAllowed = await isAllowedByRobotsTxt(urlCheck.normalizedUrl);
      if (!robotsAllowed) {
        portalChecks.push({
          name: portal.name,
          url: portal.url,
          organizationGroup: portal.organizationGroup,
          httpStatus: null,
          robotsAllowed: false,
          itemsFound: 0,
          checkedAt,
        });
        return;
      }

      try {
        const resp = await fetchWithRetry(
          urlCheck.normalizedUrl,
          {
            method: 'GET',
            redirect: 'follow',
            headers: {
              'User-Agent': 'HopelandJobsBot/1.0 (+https://hopelandjobs.tech)',
              Accept: 'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          },
          0,
          6500
        );

        if (!resp.ok) {
          portalChecks.push({
            name: portal.name,
            url: portal.url,
            organizationGroup: portal.organizationGroup,
            httpStatus: resp.status,
            robotsAllowed: true,
            itemsFound: 0,
            checkedAt,
          });
          return;
        }

        const body = await resp.text();
        let extracted: RawCandidateOpportunity[] = [];
        if (portal.parserMode === 'bis_events') {
          extracted = extractBisEventCardsFromHtml(body, portal);
        } else if (portal.parserMode === 'rss_or_html' && /<rss\b|<feed\b/i.test(body)) {
          extracted = extractGenericRssOpportunities(body, portal);
        } else {
          extracted = extractJsonLdOpportunitiesFromHtml(body, portal);
        }

        let addedFromPortal = 0;
        for (const item of extracted) {
          if (seenUrls.has(item.officialApplicationUrl)) continue;
          // Enforce >= 3 full days before counting as an active candidate
          const dl = evaluateOpportunityDeadline(item.deadlineDateRaw, item.deadlineTimezone || 'UTC');
          if (!dl.valid || dl.isExpired || !dl.meetsMinimumThreeFullDays) continue;
          seenUrls.add(item.officialApplicationUrl);
          candidates.push(item);
          addedFromPortal++;
        }

        portalChecks.push({
          name: portal.name,
          url: portal.url,
          organizationGroup: portal.organizationGroup,
          httpStatus: resp.status,
          robotsAllowed: true,
          itemsFound: addedFromPortal,
          checkedAt,
        });
      } catch (err: any) {
        errors.push(`${portal.organization}: ${err?.message || 'timeout'}`);
        portalChecks.push({
          name: portal.name,
          url: portal.url,
          organizationGroup: portal.organizationGroup,
          httpStatus: null,
          robotsAllowed: true,
          itemsFound: 0,
          checkedAt,
        });
      }
    })
  );

  const healthyCount = portalChecks.filter((p) => p.httpStatus !== null && p.httpStatus >= 200 && p.httpStatus < 300).length;
  return {
    candidates,
    portalChecks,
    error: healthyCount === 0 && errors.length > 0 ? errors.slice(0, 3).join('; ') : undefined,
  };
}

async function fetchViaGeminiSearchGrounding(
  getAiClient: () => Promise<any>,
  rotatingPassIndex: number | null = null
): Promise<{ candidates: RawCandidateOpportunity[]; error?: string; configured: boolean }> {
  const client = await getAiClient();
  if (!client) {
    return { candidates: [], configured: false };
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const minDeadlineDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const jsonSchemaInstructions = `STRICT MANDATORY RULES:
- Return ONLY real, currently open opportunities found in live Google Search results with an exact official HTTPS URL (.edu, .gov, .int, .org, official UN, World Bank, IMF, AfDB, university, bank, NGO, or official conference portal — NEVER blogs or third-party aggregators).
- Every opportunity MUST have an exact verifiable future application deadline (YYYY-MM-DD) ON OR AFTER ${minDeadlineDate}.
- MANDATORY VISA RULE:
  * For employment: official recruitment documentation MUST explicitly confirm employer-sponsored work visa or work permit sponsorship.
  * For scholarships, training, and conferences: sponsoring institution/organizer MUST explicitly confirm visa application fee coverage or visa sponsorship.
  * REJECT invitation letter only, visa assistance without fee coverage, visa-free entry, self-paid visa fees, or unspecified visa funding.
- STRICT PROFESSIONAL RESTRICTION:
  * Scholarships, Professional Training, and Conferences MUST be strictly relevant to Banking & Finance (banking, finance, accounting, economics, microfinance, fintech, financial inclusion, banking management, financial regulation) OR WASH (water engineering, water resources, water supply, sanitation, hygiene, environmental health, wastewater, humanitarian WASH, climate-resilient water management).
- Do NOT invent any opportunity, deadline, funding, or visa sponsorship. Use "Not Confirmed" if a detail is not explicitly stated on the official page.
- Return ONLY a valid JSON array (no markdown fences) with objects having exact keys:
  title, organization, category ("international_job" | "university_scholarship" | "professional_training" | "conference_summit" | "wash_opportunity"), country, location, summary, originalSourceUrl, officialApplicationUrl, deadlineDateRaw (YYYY-MM-DD), deadlineTimezone (IANA e.g. "UTC"), startDate, fundingSummary, visaSummary, applicationFee, eligibleNationalities (string[]), ethiopianEligible ("confirmed" | "likely_global" | "not_confirmed"), educationRequirement, experienceRequirement, minimumYearsExperience (number or null), requiredSkills (string[]), universityRecommendationRequired ("required" | "not_required" | "optional" | "not_confirmed"), companyRecommendationRequired ("required" | "not_required" | "optional" | "not_confirmed"), institutionalNominationRequired ("required" | "not_required" | "optional" | "not_confirmed"), directIndividualApplicationAllowed ("yes" | "no" | "not_confirmed").`;

  const allPrompts: Array<{ label: string; prompt: string }> = [
    {
      label: 'Visa-Funded Banking & WASH Scholarships and Conferences',
      prompt: `Today is ${todayIso}. Use live Google Search to find up to 6 REAL, CURRENTLY OPEN opportunities with deadlines >= ${minDeadlineDate}:
1. Fully funded University Scholarships strictly in Banking/Finance/Economics/Accounting/Microfinance/FinTech OR WASH/Water Engineering/Water Resources/Sanitation/Hygiene/Environmental Health accepting Ethiopian citizens with direct individual application AND explicitly confirming visa application fee coverage or visa sponsorship (e.g., Chevening, DAAD, Mastercard Foundation, World Bank JJ/WBGSP, IHE Delft, official university portals).
2. Fully funded International Conferences & Summits strictly in Banking, Finance, Microfinance, FinTech, Water, Sanitation, Hygiene, or WASH explicitly confirming visa fee coverage or visa sponsorship.
${jsonSchemaInstructions}`,
    },
    {
      label: 'Visa-Sponsored Banking/Finance Jobs & Banking/WASH Trainings',
      prompt: `Today is ${todayIso}. Use live Google Search to find up to 6 REAL, CURRENTLY OPEN opportunities with deadlines >= ${minDeadlineDate}:
1. International Banking, Finance, Tech, Engineering, Healthcare, or Development Jobs explicitly confirming employer-sponsored work visa or work permit sponsorship in official recruitment documentation (e.g., World Bank, IMF, AfDB, IFC, BIS, EIB, EBRD, ADB, global banks, licensed UK/EU/Canadian sponsors).
2. Fully funded International Professional Training programs strictly for Banking/Finance OR WASH professionals explicitly confirming visa application fee coverage or visa sponsorship and accepting independent applicants where permitted.
${jsonSchemaInstructions}`,
    },
    {
      label: 'Visa-Sponsored WASH International Jobs & Fellowships',
      prompt: `Today is ${todayIso}. Use live Google Search to find up to 6 REAL, CURRENTLY OPEN WASH (Water, Sanitation, and Hygiene) international employment opportunities or fellowships with deadlines >= ${minDeadlineDate} from official UN and INGO portals (UNICEF, WHO, UN-Habitat, UNDP, World Bank, AfDB, IOM, IRC, WaterAid, Water.org, World Vision, Save the Children, IFRC, SIWI) that explicitly confirm work visa sponsorship or visa application fee coverage.
${jsonSchemaInstructions}`,
    },
  ];

  // On 30-minute scheduled cycles, run 1 rotating pass per cycle to stay comfortably inside free grounding quota (~48/day = ~1,440/month)
  const searchPrompts =
    rotatingPassIndex !== null && rotatingPassIndex >= 0
      ? [allPrompts[rotatingPassIndex % allPrompts.length]]
      : allPrompts;

  const candidates: RawCandidateOpportunity[] = [];
  const errors: string[] = [];
  const seenUrls = new Set<string>();

  for (const sp of searchPrompts) {
    try {
      const response = await client.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: sp.prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      // Collect official grounding chunk domains returned by Google Search grounding for extra provenance
      const groundingChunks: any[] = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const groundedTitles = groundingChunks
        .map((c: any) => String(c?.web?.title || '').trim())
        .filter(Boolean)
        .slice(0, 6);

      const rawText = String(response?.text || '').trim();
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        errors.push(`Gemini grounding (${sp.label}) returned no structured JSON list.`);
        continue;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        errors.push(`Gemini grounding (${sp.label}) returned malformed JSON.`);
        continue;
      }
      if (!Array.isArray(parsed)) continue;

      for (const row of parsed) {
        if (!row || typeof row !== 'object') continue;
        const origUrl = String(row.originalSourceUrl || row.officialApplicationUrl || '').trim();
        const appUrl = String(row.officialApplicationUrl || row.originalSourceUrl || '').trim();
        const urlCheck = validateOfficialExternalUrl(appUrl);
        if (!urlCheck.valid || !urlCheck.isOfficialDomain || seenUrls.has(urlCheck.normalizedUrl)) continue;
        seenUrls.add(urlCheck.normalizedUrl);

        const validCategories: GlobalOpportunityCategory[] = [
          'international_job',
          'university_scholarship',
          'professional_training',
          'conference_summit',
          'wash_opportunity',
        ];
        const cat: GlobalOpportunityCategory = validCategories.includes(row.category)
          ? row.category
          : 'international_job';

        candidates.push({
          title: String(row.title || '').trim(),
          organization: String(row.organization || urlCheck.hostname).trim(),
          organizationType: inferOrganizationType(String(row.organization || ''), urlCheck.hostname),
          category: cat,
          country: String(row.country || 'International').trim(),
          location: String(row.location || row.country || 'International').trim(),
          summary: String(row.summary || '').trim(),
          sourceId: 'gemini_official_search_grounding',
          sourceName: `Official Portal via Gemini Google Search Grounding (${sp.label})`,
          originalSourceUrl: validateOfficialExternalUrl(origUrl).valid ? origUrl : urlCheck.normalizedUrl,
          officialApplicationUrl: urlCheck.normalizedUrl,
          deadlineDateRaw: String(row.deadlineDateRaw || '').trim(),
          deadlineTimezone: String(row.deadlineTimezone || 'UTC').trim(),
          startDate: String(row.startDate || 'Not Confirmed').trim(),
          fundingSummary: String(row.fundingSummary || 'Funding Not Confirmed').trim(),
          visaSummary: String(row.visaSummary || 'Not Confirmed').trim(),
          applicationFee: String(row.applicationFee || 'Not Confirmed').trim(),
          eligibleNationalities: Array.isArray(row.eligibleNationalities)
            ? row.eligibleNationalities.map((x: any) => String(x)).filter(Boolean)
            : ['Not Confirmed'],
          ethiopianEligible: ['confirmed', 'likely_global', 'not_confirmed', 'excluded'].includes(row.ethiopianEligible)
            ? row.ethiopianEligible
            : 'not_confirmed',
          educationRequirement: String(row.educationRequirement || 'Not Confirmed').trim(),
          minimumEducationLevel: parseMinEducationFromText(String(row.educationRequirement || '')),
          experienceRequirement: String(row.experienceRequirement || 'Not Confirmed').trim(),
          minimumYearsExperience:
            typeof row.minimumYearsExperience === 'number' && !Number.isNaN(row.minimumYearsExperience)
              ? row.minimumYearsExperience
              : parseMinimumYearsFromText(String(row.experienceRequirement || '')),
          careerLevel: 'not_confirmed',
          requiredSkills: Array.isArray(row.requiredSkills) ? row.requiredSkills.map((s: any) => String(s)).filter(Boolean).slice(0, 10) : [],
          languagesRequired: ['English'],
          universityRecommendationRequired: ['required', 'not_required', 'optional', 'not_confirmed'].includes(
            row.universityRecommendationRequired
          )
            ? row.universityRecommendationRequired
            : 'not_confirmed',
          companyRecommendationRequired: ['required', 'not_required', 'optional', 'not_confirmed'].includes(
            row.companyRecommendationRequired
          )
            ? row.companyRecommendationRequired
            : 'not_confirmed',
          institutionalNominationRequired: ['required', 'not_required', 'optional', 'not_confirmed'].includes(
            row.institutionalNominationRequired
          )
            ? row.institutionalNominationRequired
            : 'not_confirmed',
          directIndividualApplicationAllowed: ['yes', 'no', 'not_confirmed'].includes(
            row.directIndividualApplicationAllowed
          )
            ? row.directIndividualApplicationAllowed
            : 'not_confirmed',
          fullText: `${row.title || ''} ${row.summary || ''} ${row.fundingSummary || ''} ${row.visaSummary || ''} ${groundedTitles.join(' ')}`,
          preVerifiedByOfficialApi: false,
        });
      }
    } catch (err: any) {
      const rawMsg = String(err?.message || err || '');
      const isQuotaOrRateLimit =
        /\b(429|RESOURCE_EXHAUSTED|quota|rate[\s-]?limit)\b/i.test(rawMsg);
      if (isQuotaOrRateLimit) {
        errors.push(
          'Gemini Search Grounding quota/rate limit reached (HTTP 429). Other official sources continued normally.'
        );
        break;
      }
      errors.push(`Gemini Search Grounding (${sp.label}): ${rawMsg.slice(0, 220)}`);
    }
  }

  return { candidates, configured: true, error: errors.length && candidates.length === 0 ? errors.join('; ') : undefined };
}

// =========================================================================
// LIVE OFFICIAL URL VERIFICATION & PAGE STATUS INSPECTOR
// =========================================================================

async function verifyUrlLive(
  officialUrl: string,
  preVerifiedByOfficialApi: boolean = false
): Promise<{
  ok: boolean;
  httpStatus: number | null;
  robotsAllowed: boolean;
  detectedClosedOrExpired: boolean;
  pageTextSnippet: string;
  notes: string;
}> {
  const urlCheck = validateOfficialExternalUrl(officialUrl);
  if (!urlCheck.valid || !urlCheck.isOfficialDomain) {
    return {
      ok: false,
      httpStatus: null,
      robotsAllowed: false,
      detectedClosedOrExpired: false,
      pageTextSnippet: '',
      notes: urlCheck.reason || 'URL failed official domain verification.',
    };
  }

  const robotsAllowed = await isAllowedByRobotsTxt(urlCheck.normalizedUrl);
  if (!robotsAllowed) {
    // Respect robots.txt strictly: do NOT scrape disallowed paths
    if (preVerifiedByOfficialApi) {
      return {
        ok: true,
        httpStatus: 200,
        robotsAllowed: false,
        detectedClosedOrExpired: false,
        pageTextSnippet: 'Verified via official API response (page crawl skipped to respect robots.txt).',
        notes: 'Verified through official organization API; direct HTML fetch skipped per robots.txt.',
      };
    }
    return {
      ok: false,
      httpStatus: null,
      robotsAllowed: false,
      detectedClosedOrExpired: false,
      pageTextSnippet: '',
      notes: 'Skipped HTML verification to respect robots.txt Disallow directive.',
    };
  }

  try {
    let status = 0;
    let html = '';
    let finalUrl = urlCheck.normalizedUrl;

    if (urlCheck.hostname === 'reliefweb.int' || urlCheck.hostname.endsWith('.reliefweb.int')) {
      const h2 = await fetchTextViaHttp2(urlCheck.normalizedUrl, 7500);
      status = h2.status;
      html = h2.body;
      finalUrl = h2.finalUrl;
    } else {
      const resp = await fetchWithRetry(
        urlCheck.normalizedUrl,
        {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'HopelandJobsBot/1.0 (+https://hopelandjobs.tech)',
            Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          },
        },
        1,
        7500
      );
      status = resp.status;
      finalUrl = resp.url || urlCheck.normalizedUrl;
      if (resp.ok) {
        html = await resp.text();
      }
    }

    // Ensure final redirected URL is also SSRF-safe
    const finalCheck = validateOfficialExternalUrl(finalUrl);
    if (!finalCheck.valid) {
      return {
        ok: false,
        httpStatus: status,
        robotsAllowed: true,
        detectedClosedOrExpired: false,
        pageTextSnippet: '',
        notes: 'Redirected to an unsafe or non-HTTPS URL.',
      };
    }

    if (status === 404 || status === 410) {
      return {
        ok: false,
        httpStatus: status,
        robotsAllowed: true,
        detectedClosedOrExpired: true,
        pageTextSnippet: '',
        notes: `Official page returned HTTP ${status} (not found or removed).`,
      };
    }

    // Some official portals return 403/405/406 to automated page crawlers even though verified via official ReliefWeb feed
    if (status < 200 || status >= 300) {
      if (preVerifiedByOfficialApi && (status === 403 || status === 405 || status === 406)) {
        return {
          ok: true,
          httpStatus: status,
          robotsAllowed: true,
          detectedClosedOrExpired: false,
          pageTextSnippet: 'Verified directly via official ReliefWeb UN/NGO feed (destination portal restricts automated HTML GET).',
          notes: `Verified via official feed (direct GET returned HTTP ${status}).`,
        };
      }
      return {
        ok: false,
        httpStatus: status,
        robotsAllowed: true,
        detectedClosedOrExpired: false,
        pageTextSnippet: '',
        notes: `Official URL returned HTTP ${status}.`,
      };
    }
    const plain = stripHtmlToText(html).slice(0, 6000);
    const closedMatch = plain.match(
      /\b(applications?\s+(are|is)\s+(now\s+)?closed|this\s+(job|position|vacancy|opportunity|scholarship|call)\s+(is|has)\s+(been\s+)?(closed|expired|filled|withdrawn)|no\s+longer\s+accepting\s+applications|the\s+deadline\s+has\s+passed)\b/i
    );

    if (closedMatch) {
      return {
        ok: false,
        httpStatus: status,
        robotsAllowed: true,
        detectedClosedOrExpired: true,
        pageTextSnippet: plain.slice(0, 320),
        notes: `Official page indicates closed/expired status ("${closedMatch[0]}").`,
      };
    }

    return {
      ok: true,
      httpStatus: status,
      robotsAllowed: true,
      detectedClosedOrExpired: false,
      pageTextSnippet: plain.slice(0, 420),
      notes: `Live official page verified (HTTP ${status}).`,
    };
  } catch (err: any) {
    if (preVerifiedByOfficialApi) {
      return {
        ok: true,
        httpStatus: null,
        robotsAllowed: true,
        detectedClosedOrExpired: false,
        pageTextSnippet: 'Verified directly via official ReliefWeb UN/NGO API.',
        notes: `Verified via official API (live page timeout: ${err?.message || 'timeout'}).`,
      };
    }
    return {
      ok: false,
      httpStatus: null,
      robotsAllowed: true,
      detectedClosedOrExpired: false,
      pageTextSnippet: '',
      notes: `Live official page verification failed: ${err?.message || String(err)}`,
    };
  }
}

function buildOpportunityRecordFromCandidate(
  candidate: RawCandidateOpportunity,
  liveCheck: Awaited<ReturnType<typeof verifyUrlLive>>,
  nowIso: string
): { opportunity: GlobalOpportunity; verificationLog: OpportunityVerificationLogRecord } {
  const urlCheck = validateOfficialExternalUrl(candidate.officialApplicationUrl);
  const fingerprint = computeOpportunityFingerprint(
    candidate.title,
    candidate.organization,
    urlCheck.normalizedUrl || candidate.officialApplicationUrl
  );
  const hashId = crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 18);
  const oppId = `gopp_${hashId}`;

  const deadlineEval = evaluateOpportunityDeadline(
    candidate.deadlineDateRaw,
    candidate.deadlineTimezone || 'UTC',
    new Date(nowIso).getTime()
  );

  const combinedCorpus = `${candidate.title} ${candidate.organization} ${candidate.summary} ${candidate.fullText || ''} ${liveCheck.pageTextSnippet}`;
  const sectorInfo = detectSectorsFromText(combinedCorpus);
  const isWashDedicated =
    candidate.category === 'wash_opportunity' ||
    sectorInfo.isWash ||
    WASH_TARGET_ORGS.some((o) => candidate.organization.toLowerCase().includes(o)) && sectorInfo.isWash;

  const fundingBase = classifyFundingAndVisaTransparency({
    fundingSummary: candidate.fundingSummary,
    visaSummary: candidate.visaSummary,
    fullText: combinedCorpus,
    applicationFee: candidate.applicationFee,
    stipendOrSalary: candidate.stipendOrSalary,
  });

  const funding: OpportunityFundingRecord = {
    id: `fund_${hashId}`,
    opportunityId: oppId,
    ...fundingBase,
    evidenceExcerpt: liveCheck.pageTextSnippet.slice(0, 260) || undefined,
    verifiedAt: nowIso,
  };

  const eligibility: OpportunityEligibilityRecord = {
    id: `elig_${hashId}`,
    opportunityId: oppId,
    eligibleNationalities:
      candidate.eligibleNationalities && candidate.eligibleNationalities.length > 0
        ? candidate.eligibleNationalities
        : ['Not Confirmed'],
    ethiopianEligible: candidate.ethiopianEligible || 'not_confirmed',
    educationRequirement: candidate.educationRequirement || 'Not Confirmed',
    minimumEducationLevel: candidate.minimumEducationLevel || parseMinEducationFromText(combinedCorpus),
    experienceRequirement: candidate.experienceRequirement || 'Not Confirmed',
    minimumYearsExperience:
      typeof candidate.minimumYearsExperience === 'number'
        ? candidate.minimumYearsExperience
        : parseMinimumYearsFromText(combinedCorpus),
    careerLevel: candidate.careerLevel || 'not_confirmed',
    requiredSkills: candidate.requiredSkills || [],
    languagesRequired: candidate.languagesRequired || ['English'],
    universityRecommendationRequired: candidate.universityRecommendationRequired || 'not_confirmed',
    companyRecommendationRequired: candidate.companyRecommendationRequired || 'not_confirmed',
    institutionalNominationRequired: candidate.institutionalNominationRequired || 'not_confirmed',
    directIndividualApplicationAllowed: candidate.directIndividualApplicationAllowed || 'not_confirmed',
    verifiedAt: nowIso,
  };

  const deadline: OpportunityDeadlineRecord = {
    id: `dead_${hashId}`,
    opportunityId: oppId,
    deadlineDateRaw: candidate.deadlineDateRaw || 'Not Confirmed',
    deadlineUtcIso: deadlineEval.deadlineUtcIso,
    deadlineTimezone: deadlineEval.deadlineTimezone,
    fullDaysRemaining: deadlineEval.fullDaysRemaining,
    hoursRemaining: deadlineEval.hoursRemaining,
    meetsMinimumThreeFullDays: deadlineEval.meetsMinimumThreeFullDays,
    isClosingSoon: deadlineEval.isClosingSoon,
    isExpired: deadlineEval.isExpired,
    startDate: candidate.startDate || 'Not Confirmed',
    lastCheckedAt: nowIso,
  };

  let applicationStatus: ApplicationLifecycleStatus = 'unverified';
  if (liveCheck.detectedClosedOrExpired) {
    applicationStatus = 'closed';
  } else if (deadlineEval.isExpired) {
    applicationStatus = 'expired';
  } else if (liveCheck.ok && deadlineEval.meetsMinimumThreeFullDays) {
    applicationStatus = deadlineEval.isClosingSoon ? 'closing_soon' : 'open';
  }

  const organizationAuthentic = urlCheck.valid && urlCheck.isOfficialDomain;

  const outcome = computeVerificationOutcome({
    urlVerified: liveCheck.ok,
    organizationAuthentic,
    applicationStatus,
    deadlineEval,
    funding,
    eligibility,
    category: candidate.category,
    title: candidate.title,
    summary: candidate.summary,
    organization: candidate.organization,
    sectors: sectorInfo.sectors,
    isBankingFinance: sectorInfo.isBankingFinance,
    isWashDedicated,
    officialSourceText: combinedCorpus,
  });

  const visaAudit = evaluateMandatoryVisaCompliance(candidate.category, funding, combinedCorpus);
  funding.visaMandatoryRulePassed = outcome.visaCompliancePassed;
  if (!outcome.visaCompliancePassed) {
    funding.visaRejectionReason = visaAudit.reason || outcome.rejectionReason || undefined;
  }

  if (!outcome.isPubliclyDisplayable && (applicationStatus === 'open' || applicationStatus === 'closing_soon')) {
    applicationStatus = 'rejected';
  }

  const combinedNotes = [
    liveCheck.notes,
    deadlineEval.rejectionReason,
    outcome.rejectionReason,
  ]
    .filter(Boolean)
    .join(' ');

  const isArchived = !outcome.isPubliclyDisplayable;

  const opportunity: GlobalOpportunity = {
    id: oppId,
    fingerprint,
    title: candidate.title,
    organization: candidate.organization,
    organizationType: candidate.organizationType,
    category: candidate.category,
    sectors: sectorInfo.sectors,
    isWashDedicated,
    isBankingFinance: sectorInfo.isBankingFinance,
    country: candidate.country || 'International',
    location: candidate.location || candidate.country || 'International',
    summary: candidate.summary || `${candidate.title} at ${candidate.organization}.`,
    organizationAuthentic,
    sourceId: candidate.sourceId,
    sourceName: candidate.sourceName,
    originalSourceUrl: candidate.originalSourceUrl,
    officialApplicationUrl: urlCheck.normalizedUrl || candidate.officialApplicationUrl,
    officialDomain: urlCheck.hostname || '',
    applicationStatus,
    verificationStatus: outcome.verificationStatus,
    hasVerifiedBadge: outcome.hasVerifiedBadge,
    httpStatusCode: liveCheck.httpStatus,
    robotsAllowed: liveCheck.robotsAllowed,
    verificationNotes: combinedNotes || 'Verified against official source.',
    sourceEvidenceSnippet: liveCheck.pageTextSnippet.slice(0, 340) || candidate.summary.slice(0, 340),
    funding,
    eligibility,
    deadline,
    isArchived,
    wasPreviouslyPublished: false,
    archivedAt: isArchived ? nowIso : undefined,
    rejectionCategory: outcome.rejectionCategory || undefined,
    rejectionReason: outcome.rejectionReason || undefined,
    visaCompliancePassed: outcome.visaCompliancePassed,
    professionalRestrictionPassed: outcome.professionalRestrictionPassed,
    discoveredAt: nowIso,
    lastVerifiedAt: nowIso,
    updatedAt: nowIso,
  };

  const verificationLog: OpportunityVerificationLogRecord = {
    id: `vlog_${Date.now()}_${hashId.slice(0, 8)}`,
    opportunityId: oppId,
    opportunityTitle: candidate.title,
    organization: candidate.organization,
    officialUrl: opportunity.officialApplicationUrl,
    httpStatus: liveCheck.httpStatus,
    robotsAllowed: liveCheck.robotsAllowed,
    passedUrlVerification: liveCheck.ok,
    passedDeadlineRule: deadlineEval.meetsMinimumThreeFullDays && !deadlineEval.isExpired,
    passedVisaRule: outcome.visaCompliancePassed,
    passedProfessionalRestriction: outcome.professionalRestrictionPassed,
    fullDaysRemaining: deadlineEval.valid ? deadlineEval.fullDaysRemaining : null,
    resultingStatus: outcome.verificationStatus,
    rejectionCategory: outcome.rejectionCategory || undefined,
    rejectionReason: outcome.rejectionReason || undefined,
    actionTaken: outcome.isPubliclyDisplayable ? 'verified' : 'rejected',
    evidenceExcerpt: opportunity.sourceEvidenceSnippet?.slice(0, 240) || undefined,
    checkedFieldsCount: 24,
    notes: opportunity.verificationNotes,
    checkedAt: nowIso,
  };

  return { opportunity, verificationLog };
}

export function registerGlobalOpportunitiesRoutes(deps: RegisterGlobalOpportunitiesDeps) {
  const {
    app,
    runtimeBaseDir,
    isVercel,
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    loadUserProfiles,
    isPersistentOwnerRequest,
    getRequesterUid,
    getRequesterEmail,
    appendAuditLog,
    getAiClient,
  } = deps;

  const STORE_FILE = path.join(runtimeBaseDir, 'data', 'global_opportunities_store.json');
  const RELIEFWEB_APPNAME = (process.env.RELIEFWEB_APPNAME || 'hopelandjobs-opportunity-intel').trim();
  const LOCK_TTL_MS = 15 * 60 * 1000; // 15-minute stale-lock safety window
  let nextScheduledRunAtMs: number | null = null;
  let nextScheduledSlotLabel: string | null = null;
  const DISCOVERY_INTERVAL_MINUTES = getDiscoveryIntervalMinutes();
  const DISCOVERY_INTERVAL_MS = DISCOVERY_INTERVAL_MINUTES * 60 * 1000;

  function createDefaultSchedulerState(): SchedulerPersistentState {
    return {
      lastSuccessfulRunAt: null,
      lastSuccessfulRunAtEat: null,
      lastFailedRunAt: null,
      lastRecoveredAt: null,
      consecutiveFailures: 0,
      totalScheduledRuns: 0,
      activeRunLock: null,
      adminFailureAlert: null,
    };
  }

  function loadStore(): GlobalOpportunitiesStore {
    const initialSources = buildInitialSourcesCatalog();
    const loaded = loadJsonFileSafe<GlobalOpportunitiesStore | null>(STORE_FILE, null);
    if (!loaded || !Array.isArray(loaded.international_opportunities)) {
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        international_opportunities: [],
        opportunity_sources: initialSources,
        opportunity_verification_logs: [],
        opportunity_funding: [],
        opportunity_eligibility: [],
        opportunity_deadlines: [],
        user_saved_opportunities: [],
        user_opportunity_recommendations: [],
        discovery_job_logs: [],
        scheduler_state: createDefaultSchedulerState(),
      };
    }

    // Reconcile source configuration status with live runtime env vars
    const existingById = new Map((loaded.opportunity_sources || []).map((s) => [s.id, s]));
    const mergedSources: OpportunitySourceRecord[] = initialSources.map((fresh) => {
      const prev = existingById.get(fresh.id);
      let nextStatus: OpportunitySourceRecord['status'] = fresh.status;
      if (fresh.configured) {
        if (prev && (prev.status === 'connected' || prev.status === 'degraded' || prev.status === 'error')) {
          nextStatus = prev.status;
        } else {
          nextStatus = 'connected';
        }
      }
      return prev
        ? {
            ...fresh,
            lastPolledAt: prev.lastPolledAt,
            lastSuccessAt: prev.lastSuccessAt,
            lastItemCount: prev.lastItemCount,
            lastError: fresh.configured ? prev.lastError : fresh.lastError,
            status: nextStatus,
            monitoredPortals: prev.monitoredPortals,
          }
        : fresh;
    });

    // Backfill lastSuccessfulRunAt from historical discovery logs if scheduler_state is new
    const existingState: SchedulerPersistentState = {
      ...createDefaultSchedulerState(),
      ...(loaded.scheduler_state || {}),
    };
    if (!existingState.lastSuccessfulRunAt && Array.isArray(loaded.discovery_job_logs)) {
      const lastGood = loaded.discovery_job_logs.find(
        (l) => l.jobType === 'full_discovery' && (l.status === 'success' || (l.status === 'partial' && l.verifiedAndActiveCount > 0))
      );
      if (lastGood) {
        existingState.lastSuccessfulRunAt = lastGood.finishedAt;
        existingState.lastSuccessfulRunAtEat = formatEthiopiaDateTime(lastGood.finishedAt);
      }
    }

    return {
      ...loaded,
      opportunity_sources: mergedSources,
      opportunity_verification_logs: loaded.opportunity_verification_logs || [],
      opportunity_funding: loaded.opportunity_funding || [],
      opportunity_eligibility: loaded.opportunity_eligibility || [],
      opportunity_deadlines: loaded.opportunity_deadlines || [],
      user_saved_opportunities: loaded.user_saved_opportunities || [],
      user_opportunity_recommendations: loaded.user_opportunity_recommendations || [],
      discovery_job_logs: loaded.discovery_job_logs || [],
      scheduler_state: existingState,
    };
  }

  function saveStore(store: GlobalOpportunitiesStore): void {
    ensureRuntimeDataDir();
    // Keep normalized sub-tables synchronized with international_opportunities
    store.opportunity_funding = store.international_opportunities.map((o) => o.funding);
    store.opportunity_eligibility = store.international_opportunities.map((o) => o.eligibility);
    store.opportunity_deadlines = store.international_opportunities.map((o) => o.deadline);
    store.opportunity_verification_logs = store.opportunity_verification_logs.slice(0, 400);
    store.discovery_job_logs = store.discovery_job_logs.slice(0, 100);
    store.updatedAt = new Date().toISOString();
    writeJsonFileAtomic(STORE_FILE, store);
  }

  let isDiscoveryRunning = false;

  /**
   * Soft-deletes / archives an opportunity that failed post-publication verification,
   * preserving the full audit record (exact reason, date, and verification evidence).
   */
  function archiveUnpublishedOpportunity(
    opp: GlobalOpportunity,
    store: GlobalOpportunitiesStore,
    params: {
      nowIso: string;
      status: ApplicationLifecycleStatus;
      verificationStatus: GlobalOpportunity['verificationStatus'];
      rejectionCategory: NonNullable<GlobalOpportunity['rejectionCategory']>;
      rejectionReason: string;
      evidenceExcerpt?: string;
      httpStatus?: number | null;
      fullDaysRemaining?: number | null;
      wasPublishedBefore: boolean;
    }
  ): void {
    opp.applicationStatus = params.status;
    opp.verificationStatus = params.verificationStatus;
    opp.hasVerifiedBadge = false;
    opp.isArchived = true;
    opp.rejectionCategory = params.rejectionCategory;
    opp.rejectionReason = params.rejectionReason;
    opp.archivedAt = opp.archivedAt || params.nowIso;
    if (params.wasPublishedBefore) {
      opp.wasPreviouslyPublished = true;
      opp.unpublishedAt = params.nowIso;
    }
    if (params.rejectionCategory === 'visa') {
      opp.visaCompliancePassed = false;
      opp.funding.visaMandatoryRulePassed = false;
      opp.funding.visaRejectionReason = params.rejectionReason;
    }
    if (params.rejectionCategory === 'professional_restriction') {
      opp.professionalRestrictionPassed = false;
    }
    opp.verificationNotes = params.rejectionReason;
    opp.updatedAt = params.nowIso;

    store.opportunity_verification_logs.unshift({
      id: `vlog_unpub_${Date.now()}_${opp.id.slice(-6)}_${Math.random().toString(36).slice(2, 5)}`,
      opportunityId: opp.id,
      opportunityTitle: opp.title,
      organization: opp.organization,
      officialUrl: opp.officialApplicationUrl,
      httpStatus: params.httpStatus ?? opp.httpStatusCode ?? null,
      robotsAllowed: opp.robotsAllowed,
      passedUrlVerification: params.rejectionCategory !== 'broken_link',
      passedDeadlineRule: params.rejectionCategory !== 'deadline',
      passedVisaRule: params.rejectionCategory !== 'visa',
      passedProfessionalRestriction: params.rejectionCategory !== 'professional_restriction',
      rejectionCategory: params.rejectionCategory,
      rejectionReason: params.rejectionReason,
      actionTaken: params.wasPublishedBefore
        ? 'auto_unpublished'
        : params.rejectionCategory === 'deadline'
        ? 'expired'
        : 'rejected',
      fullDaysRemaining: params.fullDaysRemaining ?? opp.deadline.fullDaysRemaining,
      resultingStatus: params.verificationStatus,
      checkedFieldsCount: 20,
      notes: params.rejectionReason,
      evidenceExcerpt: (params.evidenceExcerpt || opp.sourceEvidenceSnippet || '').slice(0, 220),
      checkedAt: params.nowIso,
    });
  }

  /**
   * Re-evaluates ALL stored & published opportunities against their official sources,
   * mandatory visa sponsorship/fee coverage rules, Banking & WASH professional restrictions,
   * organization authenticity, and the >= 3 full days deadline gate.
   * Automatically unpublishes (soft-deletes/archives) any failing opportunity and removes it
   * from public listings, searches, and personalized user recommendations.
   */
  async function runDeadlineAndLinkRecheck(
    trigger: DiscoveryJobLogRecord['trigger'],
    checkLinksLive: boolean = false
  ): Promise<DiscoveryJobLogRecord> {
    const startedMs = Date.now();
    const startedAt = new Date(startedMs).toISOString();
    const store = loadStore();
    let expiredPurgedCount = 0;
    let rejectedUnderThreeDaysCount = 0;
    let rejectedBrokenOrClosedCount = 0;
    let rejectedDueToVisaCount = 0;
    let rejectedDueToProfessionalRestrictionCount = 0;
    let autoUnpublishedCount = 0;
    let recheckedPublishedCount = 0;
    let verifiedAndActiveCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < store.international_opportunities.length; i++) {
      const opp = store.international_opportunities[i];
      const wasPublishedBefore = Boolean(opp.hasVerifiedBadge && !opp.isArchived);
      if (wasPublishedBefore) recheckedPublishedCount++;

      const deadlineEval = evaluateOpportunityDeadline(
        opp.deadline.deadlineUtcIso || opp.deadline.deadlineDateRaw,
        opp.deadline.deadlineTimezone,
        startedMs
      );

      opp.deadline = {
        ...opp.deadline,
        fullDaysRemaining: deadlineEval.fullDaysRemaining,
        hoursRemaining: deadlineEval.hoursRemaining,
        meetsMinimumThreeFullDays: deadlineEval.meetsMinimumThreeFullDays,
        isClosingSoon: deadlineEval.isClosingSoon,
        isExpired: deadlineEval.isExpired,
        lastCheckedAt: startedAt,
      };

      // 1. Live official link & source content recheck for published opportunities
      let liveEvidenceText = opp.sourceEvidenceSnippet || '';
      if (checkLinksLive && wasPublishedBefore && recheckedPublishedCount <= 25) {
        try {
          const live = await verifyUrlLive(
            opp.officialApplicationUrl,
            opp.sourceId.startsWith('reliefweb_')
          );
          opp.httpStatusCode = live.httpStatus;
          opp.lastVerifiedAt = startedAt;
          if (live.pageTextSnippet) {
            liveEvidenceText = `${live.pageTextSnippet} ${opp.sourceEvidenceSnippet || ''}`;
            opp.sourceEvidenceSnippet = live.pageTextSnippet.slice(0, 340);
          }

          if (!live.ok || live.detectedClosedOrExpired) {
            rejectedBrokenOrClosedCount++;
            if (wasPublishedBefore) autoUnpublishedCount++;
            archiveUnpublishedOpportunity(opp, store, {
              nowIso: startedAt,
              status: live.detectedClosedOrExpired ? 'withdrawn' : 'rejected',
              verificationStatus: live.detectedClosedOrExpired ? 'Expired' : 'Unverified',
              rejectionCategory: live.detectedClosedOrExpired ? 'withdrawn' : 'broken_link',
              rejectionReason: live.detectedClosedOrExpired
                ? `Auto-unpublished: Official source indicates program is closed, cancelled, or withdrawn (${live.notes}).`
                : `Auto-unpublished: Official application URL failed live verification (${live.notes}).`,
              evidenceExcerpt: live.pageTextSnippet || live.notes,
              httpStatus: live.httpStatus,
              fullDaysRemaining: deadlineEval.fullDaysRemaining,
              wasPublishedBefore,
            });
            continue;
          }
        } catch (err: any) {
          errors.push(`Link recheck error for ${opp.id}: ${err?.message || String(err)}`);
        }
      }

      // 2. Deadline >= 3 full days check
      if (deadlineEval.isExpired || !deadlineEval.meetsMinimumThreeFullDays) {
        if (wasPublishedBefore) {
          expiredPurgedCount++;
          autoUnpublishedCount++;
        }
        if (!deadlineEval.isExpired && !deadlineEval.meetsMinimumThreeFullDays) rejectedUnderThreeDaysCount++;
        if (wasPublishedBefore || !opp.isArchived) {
          archiveUnpublishedOpportunity(opp, store, {
            nowIso: startedAt,
            status: 'expired',
            verificationStatus: 'Expired',
            rejectionCategory: 'deadline',
            rejectionReason: deadlineEval.rejectionReason || 'Auto-unpublished: Fewer than 3 full days remaining or expired.',
            evidenceExcerpt: liveEvidenceText,
            fullDaysRemaining: deadlineEval.fullDaysRemaining,
            wasPublishedBefore,
          });
        }
        continue;
      }

      // 3. Re-verify Mandatory Visa Sponsorship / Visa Fee Coverage & Professional Restrictions & Authenticity
      const urlAuthCheck = validateOfficialExternalUrl(opp.officialApplicationUrl);
      const outcome = computeVerificationOutcome({
        urlVerified: Boolean(opp.hasVerifiedBadge || (opp.httpStatusCode && opp.httpStatusCode < 400)),
        organizationAuthentic: Boolean(opp.organizationAuthentic && urlAuthCheck.valid && urlAuthCheck.isOfficialDomain),
        applicationStatus: deadlineEval.isClosingSoon ? 'closing_soon' : 'open',
        deadlineEval,
        funding: opp.funding,
        eligibility: opp.eligibility,
        category: opp.category,
        title: opp.title,
        summary: opp.summary,
        organization: opp.organization,
        sectors: opp.sectors,
        isBankingFinance: opp.isBankingFinance,
        isWashDedicated: opp.isWashDedicated,
        officialSourceText: liveEvidenceText,
      });

      if (!outcome.isPubliclyDisplayable) {
        if (outcome.rejectionCategory === 'visa') rejectedDueToVisaCount++;
        if (outcome.rejectionCategory === 'professional_restriction') rejectedDueToProfessionalRestrictionCount++;
        if (wasPublishedBefore) autoUnpublishedCount++;
        if (wasPublishedBefore || !opp.isArchived) {
          archiveUnpublishedOpportunity(opp, store, {
            nowIso: startedAt,
            status: outcome.rejectionCategory === 'visa' ? 'withdrawn' : 'rejected',
            verificationStatus: outcome.verificationStatus,
            rejectionCategory: outcome.rejectionCategory || 'visa',
            rejectionReason:
              outcome.rejectionReason ||
              'Auto-unpublished: Failed mandatory verification check during scheduled 6-hour recheck.',
            evidenceExcerpt: liveEvidenceText,
            fullDaysRemaining: deadlineEval.fullDaysRemaining,
            wasPublishedBefore,
          });
        }
        continue;
      }

      if (isOpportunityActiveAndDisplayable(opp, startedMs)) {
        opp.applicationStatus = deadlineEval.isClosingSoon ? 'closing_soon' : 'open';
        opp.verificationStatus = outcome.verificationStatus;
        opp.hasVerifiedBadge = true;
        opp.isArchived = false;
        opp.visaCompliancePassed = true;
        opp.professionalRestrictionPassed = true;
        verifiedAndActiveCount++;
      }
    }

    // Immediately remove any unpublished, rejected, or expired opportunities from cached recommendations
    const activeIdSet = new Set(
      store.international_opportunities
        .filter((o) => isOpportunityActiveAndDisplayable(o, startedMs))
        .map((o) => o.id)
    );
    store.user_opportunity_recommendations = store.user_opportunity_recommendations.filter((r) =>
      activeIdSet.has(r.opportunityId)
    );

    const finishedAt = new Date().toISOString();
    const jobLog: DiscoveryJobLogRecord = {
      id: `djob_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      trigger,
      jobType: 'deadline_and_link_recheck',
      status: errors.length > 0 ? 'partial' : 'success',
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      sourcesQueried: 0,
      candidatesDiscovered: 0,
      duplicatesSkipped: 0,
      verifiedAndActiveCount,
      rejectedUnderThreeDaysCount,
      rejectedBrokenOrClosedCount,
      rejectedDueToVisaCount,
      rejectedDueToProfessionalRestrictionCount,
      autoUnpublishedCount,
      expiredPurgedCount,
      recheckedPublishedCount,
      errors,
    };

    store.discovery_job_logs.unshift(jobLog);
    saveStore(store);
    return jobLog;
  }

  /**
   * Executes full live official source discovery + live HTTP verification + deduplication
   * + mandatory >= 3 full days deadline gate + personalized recommendation refresh (WEBSITE-ONLY).
   * Enforces both in-memory and persisted overlap locks (15-min stale TTL) so scheduled jobs never collide.
   */
  async function runFullOfficialDiscovery(
    trigger: DiscoveryJobLogRecord['trigger'],
    options?: {
      scheduledSlotEat?: string;
      attemptNumber?: number;
      maxAttempts?: number;
    }
  ): Promise<DiscoveryJobLogRecord> {
    const nowCheckMs = Date.now();
    const preStore = loadStore();
    const preLock = preStore.scheduler_state?.activeRunLock;
    const hasActivePersistedLock = Boolean(
      preLock && new Date(preLock.expiresAt).getTime() > nowCheckMs
    );

    if (isDiscoveryRunning || hasActivePersistedLock) {
      const busyNow = new Date(nowCheckMs).toISOString();
      return {
        id: `djob_overlap_${nowCheckMs}`,
        trigger,
        jobType: 'full_discovery',
        status: 'partial',
        startedAt: busyNow,
        finishedAt: busyNow,
        durationMs: 0,
        sourcesQueried: 0,
        candidatesDiscovered: 0,
        duplicatesSkipped: 0,
        verifiedAndActiveCount: preStore.international_opportunities.filter((o) =>
          isOpportunityActiveAndDisplayable(o, nowCheckMs)
        ).length,
        savedCount: 0,
        recommendationsUpdatedCount: preStore.user_opportunity_recommendations.length,
        rejectedUnderThreeDaysCount: 0,
        rejectedBrokenOrClosedCount: 0,
        expiredPurgedCount: 0,
        scheduledSlotEat: options?.scheduledSlotEat,
        attemptNumber: options?.attemptNumber ?? 1,
        maxAttempts: options?.maxAttempts ?? 1,
        skippedOverlap: true,
        errors: [
          `Skipped overlapping execution: another discovery run (${preLock?.trigger || 'active'}) is already in progress.`,
        ],
      };
    }

    isDiscoveryRunning = true;
    const runId = `run_${nowCheckMs}_${Math.random().toString(36).slice(2, 6)}`;
    const startedMs = Date.now();
    const startedAt = new Date(startedMs).toISOString();
    const store = loadStore();
    if (!store.scheduler_state) {
      store.scheduler_state = createDefaultSchedulerState();
    }
    store.scheduler_state.activeRunLock = {
      runId,
      trigger,
      startedAt,
      expiresAt: new Date(startedMs + LOCK_TTL_MS).toISOString(),
    };
    saveStore(store);
    const errors: string[] = [];
    let sourcesQueried = 0;
    const allCandidates: RawCandidateOpportunity[] = [];

    const updateSourceMeta = (
      sourceId: string,
      patch: Partial<OpportunitySourceRecord>
    ) => {
      const idx = store.opportunity_sources.findIndex((s) => s.id === sourceId);
      if (idx >= 0) {
        store.opportunity_sources[idx] = {
          ...store.opportunity_sources[idx],
          ...patch,
        };
      }
    };

    try {
      const enabledProviders = getEnabledSearchProviders();

      // 1. ReliefWeb Official Jobs Feeds (Free, No API Key Required: WASH, Banking/Finance, International Jobs)
      if (enabledProviders.has('reliefweb')) {
        sourcesQueried++;
        try {
          const rwJobs = await fetchReliefWebJobs(RELIEFWEB_APPNAME);
          updateSourceMeta('reliefweb_jobs_wash_intl', {
            lastPolledAt: startedAt,
            lastSuccessAt: rwJobs.error
              ? store.opportunity_sources.find((s) => s.id === 'reliefweb_jobs_wash_intl')?.lastSuccessAt || null
              : startedAt,
            lastItemCount: rwJobs.candidates.length,
            lastError: rwJobs.error || null,
            status: rwJobs.error ? 'degraded' : 'connected',
          });
          if (rwJobs.error) errors.push(rwJobs.error);
          allCandidates.push(...rwJobs.candidates);
        } catch (err: any) {
          const msg = `ReliefWeb Jobs unavailable: ${err?.message || String(err)}`;
          updateSourceMeta('reliefweb_jobs_wash_intl', {
            lastPolledAt: startedAt,
            lastError: msg,
            status: 'degraded',
          });
          errors.push(msg);
        }

        // 2. ReliefWeb Official Trainings, Fellowships & Conferences Feeds (Free, No API Key Required)
        sourcesQueried++;
        try {
          const rwTrainings = await fetchReliefWebTrainings(RELIEFWEB_APPNAME);
          updateSourceMeta('reliefweb_training_conferences', {
            lastPolledAt: startedAt,
            lastSuccessAt: rwTrainings.error
              ? store.opportunity_sources.find((s) => s.id === 'reliefweb_training_conferences')?.lastSuccessAt || null
              : startedAt,
            lastItemCount: rwTrainings.candidates.length,
            lastError: rwTrainings.error || null,
            status: rwTrainings.error ? 'degraded' : 'connected',
          });
          if (rwTrainings.error) errors.push(rwTrainings.error);
          allCandidates.push(...rwTrainings.candidates);
        } catch (err: any) {
          const msg = `ReliefWeb Training/Conferences unavailable: ${err?.message || String(err)}`;
          updateSourceMeta('reliefweb_training_conferences', {
            lastPolledAt: startedAt,
            lastError: msg,
            status: 'degraded',
          });
          errors.push(msg);
        }
      }

      // 2B. Direct Official Institutional Website Monitor (Free, Zero API Keys — 11 verified portals, respects robots.txt)
      if (enabledProviders.has('direct_websites')) {
        sourcesQueried++;
        try {
          const directRes = await fetchFromDirectOfficialWebsites();
          updateSourceMeta('official_direct_website_monitor', {
            lastPolledAt: startedAt,
            lastSuccessAt: directRes.error
              ? store.opportunity_sources.find((s) => s.id === 'official_direct_website_monitor')?.lastSuccessAt || null
              : startedAt,
            lastItemCount: directRes.candidates.length,
            lastError: directRes.error || null,
            status: directRes.error ? 'degraded' : 'connected',
            monitoredPortals: directRes.portalChecks,
          });
          if (directRes.error) errors.push(directRes.error);
          allCandidates.push(...directRes.candidates);
        } catch (err: any) {
          const msg = `Direct Official Website Monitor unavailable: ${err?.message || String(err)}`;
          updateSourceMeta('official_direct_website_monitor', {
            lastPolledAt: startedAt,
            lastError: msg,
            status: 'degraded',
          });
          errors.push(msg);
        }
      }

      // 3. Gemini API with Native Google Search Grounding (Recommended Optional Live Web Search — No Custom Search API Required)
      // Every 6-hour scheduled cycle runs ALL 3 focused category passes (scholarships, banking/WASH/visa jobs, conferences & training) = 12 queries/day (~360/month).
      if (enabledProviders.has('gemini')) {
        try {
          const geminiRes = await fetchViaGeminiSearchGrounding(getAiClient, null);
          if (geminiRes.configured) {
            sourcesQueried++;
            updateSourceMeta('gemini_official_search_grounding', {
              lastPolledAt: startedAt,
              lastSuccessAt: geminiRes.error
                ? store.opportunity_sources.find((s) => s.id === 'gemini_official_search_grounding')?.lastSuccessAt || null
                : startedAt,
              lastItemCount: geminiRes.candidates.length,
              lastError: geminiRes.error || null,
              status: geminiRes.error ? 'degraded' : 'connected',
            });
            if (geminiRes.error) errors.push(geminiRes.error);
            allCandidates.push(...geminiRes.candidates);
          }
        } catch (err: any) {
          const msg = `Gemini Google Search Grounding unavailable: ${err?.message || String(err)}`;
          updateSourceMeta('gemini_official_search_grounding', {
            lastPolledAt: startedAt,
            lastError: msg,
            status: 'degraded',
          });
          errors.push(msg);
        }
      }

      // 4. Tavily Live Web Search API (Optional Configurable Provider — 1,000 Free Credits/Month)
      if (enabledProviders.has('tavily')) {
        try {
          const tavilyRes = await fetchFromTavilySearch();
          if (tavilyRes.configured) {
            sourcesQueried++;
            updateSourceMeta('tavily_web_search_api', {
              lastPolledAt: startedAt,
              lastSuccessAt: tavilyRes.error
                ? store.opportunity_sources.find((s) => s.id === 'tavily_web_search_api')?.lastSuccessAt || null
                : startedAt,
              lastItemCount: tavilyRes.candidates.length,
              lastError: tavilyRes.error || null,
              status: tavilyRes.error ? 'degraded' : 'connected',
            });
            if (tavilyRes.error) errors.push(tavilyRes.error);
            allCandidates.push(...tavilyRes.candidates);
          }
        } catch (err: any) {
          const msg = `Tavily Search unavailable: ${err?.message || String(err)}`;
          updateSourceMeta('tavily_web_search_api', {
            lastPolledAt: startedAt,
            lastError: msg,
            status: 'degraded',
          });
          errors.push(msg);
        }
      }

      // 5. Brave Live Web Search API (Optional Configurable Provider — $5/month Free Credit)
      if (enabledProviders.has('brave')) {
        try {
          const braveRes = await fetchFromBraveSearch();
          if (braveRes.configured) {
            sourcesQueried++;
            updateSourceMeta('brave_web_search_api', {
              lastPolledAt: startedAt,
              lastSuccessAt: braveRes.error
                ? store.opportunity_sources.find((s) => s.id === 'brave_web_search_api')?.lastSuccessAt || null
                : startedAt,
              lastItemCount: braveRes.candidates.length,
              lastError: braveRes.error || null,
              status: braveRes.error ? 'degraded' : 'connected',
            });
            if (braveRes.error) errors.push(braveRes.error);
            allCandidates.push(...braveRes.candidates);
          }
        } catch (err: any) {
          const msg = `Brave Search unavailable: ${err?.message || String(err)}`;
          updateSourceMeta('brave_web_search_api', {
            lastPolledAt: startedAt,
            lastError: msg,
            status: 'degraded',
          });
          errors.push(msg);
        }
      }

      // Deduplicate & verify each candidate against official URL, mandatory visa rule, professional restrictions, and >= 3 full days rule
      const existingByFingerprint = new Map(
        store.international_opportunities.map((o) => [o.fingerprint, o])
      );
      const batchFingerprints = new Set<string>();
      let duplicatesSkipped = 0;
      let rejectedUnderThreeDaysCount = 0;
      let rejectedBrokenOrClosedCount = 0;
      let rejectedDueToVisaCount = 0;
      let rejectedDueToProfessionalRestrictionCount = 0;
      let autoUnpublishedCount = 0;
      let recheckedPublishedCount = 0;

      // Limit per-run live HTTP checks to keep response fast & polite to external servers
      const maxToVerify = Math.min(allCandidates.length, 65);

      for (let i = 0; i < maxToVerify; i++) {
        const candidate = allCandidates[i];
        const urlCheck = validateOfficialExternalUrl(candidate.officialApplicationUrl);
        if (!urlCheck.valid || !urlCheck.isOfficialDomain) {
          rejectedBrokenOrClosedCount++;
          continue;
        }

        const fp = computeOpportunityFingerprint(
          candidate.title,
          candidate.organization,
          urlCheck.normalizedUrl
        );
        if (batchFingerprints.has(fp)) {
          duplicatesSkipped++;
          continue;
        }
        batchFingerprints.add(fp);

        // Quick pre-check of >= 3 full days deadline before doing an external HTTP call
        const preDeadline = evaluateOpportunityDeadline(
          candidate.deadlineDateRaw,
          candidate.deadlineTimezone || 'UTC',
          Date.now()
        );
        if (!preDeadline.valid || preDeadline.isExpired || !preDeadline.meetsMinimumThreeFullDays) {
          rejectedUnderThreeDaysCount++;
          continue;
        }

        const liveCheck = await verifyUrlLive(
          urlCheck.normalizedUrl,
          Boolean(candidate.preVerifiedByOfficialApi)
        );

        const nowIso = new Date().toISOString();
        const { opportunity, verificationLog } = buildOpportunityRecordFromCandidate(
          candidate,
          liveCheck,
          nowIso
        );

        const prev = existingByFingerprint.get(fp);
        const wasPublishedBefore = Boolean(prev && prev.hasVerifiedBadge && !prev.isArchived);

        if (!opportunity.hasVerifiedBadge) {
          if (opportunity.rejectionCategory === 'visa') {
            rejectedDueToVisaCount++;
          } else if (opportunity.rejectionCategory === 'professional_restriction') {
            rejectedDueToProfessionalRestrictionCount++;
          } else if (opportunity.rejectionCategory === 'deadline') {
            rejectedUnderThreeDaysCount++;
          } else {
            rejectedBrokenOrClosedCount++;
          }

          if (wasPublishedBefore) {
            autoUnpublishedCount++;
            opportunity.wasPreviouslyPublished = true;
            opportunity.unpublishedAt = nowIso;
            verificationLog.actionTaken = 'auto_unpublished';
          }
        }

        store.opportunity_verification_logs.unshift(verificationLog);

        if (prev) {
          opportunity.discoveredAt = prev.discoveredAt;
          if (prev.wasPreviouslyPublished) {
            opportunity.wasPreviouslyPublished = true;
          }
          const idx = store.international_opportunities.findIndex((o) => o.id === prev.id);
          if (idx >= 0) {
            store.international_opportunities[idx] = opportunity;
          }
          duplicatesSkipped++;
        } else {
          store.international_opportunities.unshift(opportunity);
          existingByFingerprint.set(fp, opportunity);
        }
      }

      // MANDATORY 6-HOUR RECHECK OF ALL EXISTING PUBLISHED OPPORTUNITIES:
      // Rechecks deadlines, live official URLs, visa sponsorship/fee rules, and Banking/WASH professional restrictions.
      // Any opportunity failing mandatory compliance is immediately soft-deleted/unpublished and archived with full audit reason.
      let expiredPurgedCount = 0;
      const nowFinalMs = Date.now();
      const nowFinalIso = new Date(nowFinalMs).toISOString();
      for (const opp of store.international_opportunities) {
        const wasPublishedBefore = Boolean(opp.hasVerifiedBadge && !opp.isArchived);
        if (wasPublishedBefore) recheckedPublishedCount++;

        const dl = evaluateOpportunityDeadline(
          opp.deadline.deadlineUtcIso || opp.deadline.deadlineDateRaw,
          opp.deadline.deadlineTimezone,
          nowFinalMs
        );
        opp.deadline.fullDaysRemaining = dl.fullDaysRemaining;
        opp.deadline.hoursRemaining = dl.hoursRemaining;
        opp.deadline.meetsMinimumThreeFullDays = dl.meetsMinimumThreeFullDays;
        opp.deadline.isClosingSoon = dl.isClosingSoon;
        opp.deadline.isExpired = dl.isExpired;
        opp.deadline.lastCheckedAt = nowFinalIso;

        if (dl.isExpired || !dl.meetsMinimumThreeFullDays) {
          if (wasPublishedBefore) {
            expiredPurgedCount++;
            autoUnpublishedCount++;
            archiveUnpublishedOpportunity(opp, store, {
              nowIso: nowFinalIso,
              status: 'expired',
              verificationStatus: 'Expired',
              rejectionCategory: 'deadline',
              rejectionReason: dl.rejectionReason || 'Auto-unpublished: Fewer than 3 full days remaining or deadline expired.',
              fullDaysRemaining: dl.fullDaysRemaining,
              wasPublishedBefore,
            });
          } else {
            opp.applicationStatus = 'expired';
            opp.verificationStatus = 'Expired';
            opp.hasVerifiedBadge = false;
            opp.isArchived = true;
            opp.archivedAt = opp.archivedAt || nowFinalIso;
            opp.rejectionCategory = opp.rejectionCategory || 'deadline';
            opp.rejectionReason = opp.rejectionReason || dl.rejectionReason || 'Expired (< 3 full days remaining).';
          }
          continue;
        }

        // Enforce mandatory visa & professional restriction recheck on all previously stored records
        if (wasPublishedBefore) {
          // If this published record wasn't already freshly checked in this batch, recheck live URL (up to 15 per sweep)
          let liveSnippet = opp.sourceEvidenceSnippet || '';
          if (!batchFingerprints.has(opp.fingerprint) && recheckedPublishedCount <= 15) {
            try {
              const live = await verifyUrlLive(opp.officialApplicationUrl, opp.sourceId.startsWith('reliefweb_'));
              opp.httpStatusCode = live.httpStatus;
              opp.lastVerifiedAt = nowFinalIso;
              if (live.pageTextSnippet) {
                liveSnippet = `${live.pageTextSnippet} ${opp.sourceEvidenceSnippet || ''}`;
                opp.sourceEvidenceSnippet = live.pageTextSnippet.slice(0, 340);
              }
              if (!live.ok || live.detectedClosedOrExpired) {
                rejectedBrokenOrClosedCount++;
                autoUnpublishedCount++;
                archiveUnpublishedOpportunity(opp, store, {
                  nowIso: nowFinalIso,
                  status: live.detectedClosedOrExpired ? 'withdrawn' : 'rejected',
                  verificationStatus: live.detectedClosedOrExpired ? 'Expired' : 'Unverified',
                  rejectionCategory: live.detectedClosedOrExpired ? 'withdrawn' : 'broken_link',
                  rejectionReason: live.detectedClosedOrExpired
                    ? `Auto-unpublished during 6h recheck: Official page indicates program is closed or withdrawn (${live.notes}).`
                    : `Auto-unpublished during 6h recheck: Official link failed verification (${live.notes}).`,
                  evidenceExcerpt: live.pageTextSnippet || live.notes,
                  httpStatus: live.httpStatus,
                  fullDaysRemaining: dl.fullDaysRemaining,
                  wasPublishedBefore: true,
                });
                continue;
              }
            } catch {
              // Keep non-fatal network blip from deleting valid items unless explicitly closed/non-compliant
            }
          }

          const recheckOutcome = computeVerificationOutcome({
            urlVerified: true,
            organizationAuthentic: opp.organizationAuthentic,
            applicationStatus: dl.isClosingSoon ? 'closing_soon' : 'open',
            deadlineEval: dl,
            funding: opp.funding,
            eligibility: opp.eligibility,
            category: opp.category,
            title: opp.title,
            summary: opp.summary,
            organization: opp.organization,
            sectors: opp.sectors,
            isBankingFinance: opp.isBankingFinance,
            isWashDedicated: opp.isWashDedicated,
            officialSourceText: liveSnippet,
          });

          if (!recheckOutcome.isPubliclyDisplayable) {
            if (recheckOutcome.rejectionCategory === 'visa') rejectedDueToVisaCount++;
            if (recheckOutcome.rejectionCategory === 'professional_restriction') rejectedDueToProfessionalRestrictionCount++;
            autoUnpublishedCount++;
            archiveUnpublishedOpportunity(opp, store, {
              nowIso: nowFinalIso,
              status: recheckOutcome.rejectionCategory === 'visa' ? 'withdrawn' : 'rejected',
              verificationStatus: recheckOutcome.verificationStatus,
              rejectionCategory: recheckOutcome.rejectionCategory || 'visa',
              rejectionReason:
                recheckOutcome.rejectionReason ||
                'Auto-unpublished during 6h recheck: Failed mandatory visa or professional restriction compliance.',
              evidenceExcerpt: liveSnippet,
              fullDaysRemaining: dl.fullDaysRemaining,
              wasPublishedBefore: true,
            });
          }
        }
      }

      // Keep store bounded cleanly (keep up to 250 active + archived audit records, prioritizing active first)
      store.international_opportunities = store.international_opportunities
        .sort((a, b) => {
          const aAct = isOpportunityActiveAndDisplayable(a, nowFinalMs) ? 1 : 0;
          const bAct = isOpportunityActiveAndDisplayable(b, nowFinalMs) ? 1 : 0;
          if (aAct !== bAct) return bAct - aAct;
          return new Date(b.lastVerifiedAt).getTime() - new Date(a.lastVerifiedAt).getTime();
        })
        .slice(0, 250);

      // Recompute website-only recommendations for all registered users (ZERO external email/SMS/WhatsApp/push!)
      const activeVerified = store.international_opportunities.filter((o) =>
        isOpportunityActiveAndDisplayable(o, nowFinalMs)
      );
      const profiles = loadUserProfiles();
      const nextRecs: UserOpportunityRecommendationRecord[] = [];
      for (const uid of Object.keys(profiles)) {
        const prof = profiles[uid];
        if (!prof || !prof.uid) continue;
        const userRecs = activeVerified
          .map((opp) => evaluateOpportunityForUser(opp, prof, nowFinalMs))
          .filter((r) => r.eligible && r.disqualificationReasons.length === 0)
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 25);
        nextRecs.push(...userRecs);
      }
      store.user_opportunity_recommendations = nextRecs;

      const finishedAt = new Date().toISOString();
      // Note: strict visa/sector filtering legitimately rejects non-compliant candidates; that is a SUCCESSFUL compliance sweep, not a source failure!
      const isFailure = sourcesQueried === 0 && errors.length > 0;
      const runStatus: DiscoveryJobLogRecord['status'] = isFailure
        ? 'failed'
        : errors.length > 0
        ? 'partial'
        : 'success';

      const jobLog: DiscoveryJobLogRecord = {
        id: `djob_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        trigger,
        jobType: 'full_discovery',
        status: runStatus,
        startedAt,
        finishedAt,
        durationMs: Date.now() - startedMs,
        sourcesQueried,
        candidatesDiscovered: allCandidates.length,
        duplicatesSkipped,
        verifiedAndActiveCount: activeVerified.length,
        savedCount: activeVerified.length,
        recommendationsUpdatedCount: nextRecs.length,
        rejectedUnderThreeDaysCount,
        rejectedBrokenOrClosedCount,
        rejectedDueToVisaCount,
        rejectedDueToProfessionalRestrictionCount,
        autoUnpublishedCount,
        expiredPurgedCount,
        recheckedPublishedCount,
        scheduledSlotEat: options?.scheduledSlotEat,
        attemptNumber: options?.attemptNumber ?? 1,
        maxAttempts: options?.maxAttempts ?? 1,
        skippedOverlap: false,
        errors,
      };

      const state = store.scheduler_state || createDefaultSchedulerState();
      const isScheduledTrigger =
        trigger === 'ethiopia_6h_schedule' ||
        trigger === 'vercel_cron' ||
        trigger === 'github_actions_cron' ||
        trigger === 'server_interval';
      if (isScheduledTrigger) {
        state.totalScheduledRuns = (state.totalScheduledRuns || 0) + 1;
      }

      if (runStatus === 'failed') {
        state.lastFailedRunAt = finishedAt;
        state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
        const nextSlot = getNextEthiopiaScheduleSlot(Date.now());
        state.adminFailureAlert = {
          active: true,
          severity: 'error',
          message: `Scheduled international opportunity discovery failed (${state.consecutiveFailures} consecutive failure${state.consecutiveFailures > 1 ? 's' : ''}). Automatic retry & next 6-hour Ethiopia Time slot (${nextSlot.slotLabelEat}) remain armed.`,
          errors: errors.slice(0, 8),
          failedAt: finishedAt,
          failedAtEat: formatEthiopiaDateTime(finishedAt) || finishedAt,
          consecutiveFailures: state.consecutiveFailures,
          nextAutoRetryAt: nextSlot.utcIso,
          acknowledgedAt: null,
        };
        appendAuditLog({
          action: 'global_opportunities_scheduled_failure',
          actorEmail: 'system_scheduler',
          targetType: 'global_opportunities',
          summary: `Scheduled discovery failed (${trigger}): ${errors[0] || 'Unknown error'}`,
          severity: 'error',
        });
      } else {
        const wasFailing = (state.consecutiveFailures || 0) > 0 || Boolean(state.adminFailureAlert?.active);
        state.lastSuccessfulRunAt = finishedAt;
        state.lastSuccessfulRunAtEat = formatEthiopiaDateTime(finishedAt);
        state.consecutiveFailures = 0;
        if (wasFailing) {
          state.lastRecoveredAt = finishedAt;
        }
        // Clear severe failure alert on recovery; surface a non-blocking warning only if partial errors remain
        if (runStatus === 'partial' && errors.length >= 2) {
          const nextSlot = getNextEthiopiaScheduleSlot(Date.now());
          state.adminFailureAlert = {
            active: true,
            severity: 'warning',
            message: `Discovery completed with ${activeVerified.length} verified active opportunities, but ${errors.length} source connector(s) reported temporary errors. The system will retry automatically at ${nextSlot.slotLabelEat}.`,
            errors: errors.slice(0, 6),
            failedAt: finishedAt,
            failedAtEat: formatEthiopiaDateTime(finishedAt) || finishedAt,
            consecutiveFailures: 0,
            nextAutoRetryAt: nextSlot.utcIso,
            acknowledgedAt: null,
          };
        } else {
          state.adminFailureAlert = null;
        }
      }

      state.activeRunLock = null;
      store.scheduler_state = state;
      store.discovery_job_logs.unshift(jobLog);
      saveStore(store);

      return jobLog;
    } catch (unexpectedErr: any) {
      const errMsg = unexpectedErr?.message || String(unexpectedErr);
      const failedAt = new Date().toISOString();
      const errStore = loadStore();
      const state = errStore.scheduler_state || createDefaultSchedulerState();
      state.activeRunLock = null;
      state.lastFailedRunAt = failedAt;
      state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
      const nextSlot = getNextEthiopiaScheduleSlot(Date.now());
      state.adminFailureAlert = {
        active: true,
        severity: 'error',
        message: `Scheduled discovery crashed unexpectedly: ${errMsg}. Automatic recovery remains armed for ${nextSlot.slotLabelEat}.`,
        errors: [errMsg],
        failedAt,
        failedAtEat: formatEthiopiaDateTime(failedAt) || failedAt,
        consecutiveFailures: state.consecutiveFailures,
        nextAutoRetryAt: nextSlot.utcIso,
        acknowledgedAt: null,
      };
      const failLog: DiscoveryJobLogRecord = {
        id: `djob_err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        trigger,
        jobType: 'full_discovery',
        status: 'failed',
        startedAt,
        finishedAt: failedAt,
        durationMs: Date.now() - startedMs,
        sourcesQueried,
        candidatesDiscovered: allCandidates.length,
        duplicatesSkipped: 0,
        verifiedAndActiveCount: errStore.international_opportunities.filter((o) =>
          isOpportunityActiveAndDisplayable(o)
        ).length,
        savedCount: 0,
        recommendationsUpdatedCount: errStore.user_opportunity_recommendations.length,
        rejectedUnderThreeDaysCount: 0,
        rejectedBrokenOrClosedCount: 0,
        expiredPurgedCount: 0,
        scheduledSlotEat: options?.scheduledSlotEat,
        attemptNumber: options?.attemptNumber ?? 1,
        maxAttempts: options?.maxAttempts ?? 1,
        skippedOverlap: false,
        errors: [errMsg],
      };
      errStore.scheduler_state = state;
      errStore.discovery_job_logs.unshift(failLog);
      saveStore(errStore);
      return failLog;
    } finally {
      isDiscoveryRunning = false;
      try {
        const finalStore = loadStore();
        if (finalStore.scheduler_state?.activeRunLock?.runId === runId) {
          finalStore.scheduler_state.activeRunLock = null;
          saveStore(finalStore);
        }
      } catch {
        // Ignore cleanup read/write errors
      }
    }
  }

  /**
   * Executes scheduled discovery with automatic exponential-backoff retries (up to 3 attempts).
   * Prevents overlapping runs and guarantees automatic resumption on temporary failures.
   */
  async function executeScheduledDiscoveryWithRetry(
    trigger: DiscoveryJobLogRecord['trigger'],
    scheduledSlotEat?: string,
    maxAttempts: number = 3,
    retryBaseDelayMs: number = 5000
  ): Promise<DiscoveryJobLogRecord> {
    let lastLog: DiscoveryJobLogRecord | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      lastLog = await runFullOfficialDiscovery(trigger, {
        scheduledSlotEat,
        attemptNumber: attempt,
        maxAttempts,
      });
      const isQuotaOnlyPartial =
        lastLog.status === 'partial' &&
        lastLog.errors.length > 0 &&
        lastLog.errors.every((e) => /\b(429|RESOURCE_EXHAUSTED|quota|rate[\s-]?limit)\b/i.test(e));

      const partialCoreSucceeded =
        lastLog.status === 'partial' &&
        (lastLog.verifiedAndActiveCount > 0 ||
          lastLog.candidatesDiscovered > 0 ||
          isQuotaOnlyPartial);

      if (lastLog.skippedOverlap || lastLog.status === 'success' || partialCoreSucceeded) {
        return lastLog;
      }
      if (attempt < maxAttempts) {
        const delayMs = retryBaseDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `[GlobalOpportunities] Scheduled discovery attempt ${attempt}/${maxAttempts} failed. Retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return lastLog!;
  }

  function computeSubsectionCounts(
    activeList: GlobalOpportunityWithMatch[],
    savedIdSet: Set<string>
  ): Record<GlobalOpportunitySubsection, number> {
    return {
      international_jobs: activeList.filter((o) => o.category === 'international_job').length,
      scholarships: activeList.filter((o) => o.category === 'university_scholarship').length,
      professional_training: activeList.filter((o) => o.category === 'professional_training').length,
      conferences_summits: activeList.filter((o) => o.category === 'conference_summit').length,
      banking_finance: activeList.filter((o) => o.isBankingFinance || o.sectors.includes('banking_finance')).length,
      wash_opportunities: activeList.filter((o) => o.isWashDedicated || o.category === 'wash_opportunity' || o.sectors.includes('wash')).length,
      recommended: activeList.filter((o) => o.recommendation?.eligible).length,
      closing_soon: activeList.filter((o) => o.deadline.isClosingSoon).length,
      saved: activeList.filter((o) => savedIdSet.has(o.id)).length,
    };
  }

  // =========================================================================
  // PUBLIC & AUTHENTICATED WEBSITE API ROUTES
  // =========================================================================

  app.get('/api/global-opportunities', async (req: Request, res: Response): Promise<void> => {
    try {
      const store = loadStore();
      const nowMs = Date.now();
      const uid = getRequesterUid(req);
      const profiles = loadUserProfiles();
      const userProfile = uid ? profiles[uid] || null : null;

      // Always enforce >= 3 full days rule & live verified gate at read time
      const activeVerified = store.international_opportunities
        .filter((o) => isOpportunityActiveAndDisplayable(o, nowMs))
        .map((o) => {
          const dl = evaluateOpportunityDeadline(
            o.deadline.deadlineUtcIso || o.deadline.deadlineDateRaw,
            o.deadline.deadlineTimezone,
            nowMs
          );
          const refreshed: GlobalOpportunityWithMatch = {
            ...o,
            deadline: {
              ...o.deadline,
              fullDaysRemaining: dl.fullDaysRemaining,
              hoursRemaining: dl.hoursRemaining,
              meetsMinimumThreeFullDays: dl.meetsMinimumThreeFullDays,
              isClosingSoon: dl.isClosingSoon,
              isExpired: dl.isExpired,
            },
          };
          if (userProfile) {
            refreshed.recommendation = evaluateOpportunityForUser(refreshed, userProfile, nowMs);
          }
          return refreshed;
        });

      const savedIds = new Set(
        uid
          ? store.user_saved_opportunities.filter((s) => s.userId === uid).map((s) => s.opportunityId)
          : []
      );
      for (const item of activeVerified) {
        item.isSaved = savedIds.has(item.id);
      }

      const countsBySubsection = computeSubsectionCounts(activeVerified, savedIds);

      // Optional query filters
      const subsection = String(req.query.subsection || '').trim() as GlobalOpportunitySubsection | '';
      const category = String(req.query.category || '').trim();
      const country = String(req.query.country || '').trim().toLowerCase();
      const funding = String(req.query.funding || '').trim().toLowerCase();
      const visa = String(req.query.visa || '').trim().toLowerCase();
      const experience = String(req.query.experience || '').trim().toLowerCase();
      const eligibility = String(req.query.eligibility || '').trim().toLowerCase();
      const deadlineFilter = String(req.query.deadline || '').trim().toLowerCase();
      const q = String(req.query.q || '').trim().toLowerCase();

      let filtered = activeVerified;

      if (subsection === 'international_jobs') filtered = filtered.filter((o) => o.category === 'international_job');
      else if (subsection === 'scholarships') filtered = filtered.filter((o) => o.category === 'university_scholarship');
      else if (subsection === 'professional_training') filtered = filtered.filter((o) => o.category === 'professional_training');
      else if (subsection === 'conferences_summits') filtered = filtered.filter((o) => o.category === 'conference_summit');
      else if (subsection === 'banking_finance') filtered = filtered.filter((o) => o.isBankingFinance || o.sectors.includes('banking_finance'));
      else if (subsection === 'wash_opportunities') filtered = filtered.filter((o) => o.isWashDedicated || o.category === 'wash_opportunity' || o.sectors.includes('wash'));
      else if (subsection === 'recommended') filtered = filtered.filter((o) => o.recommendation?.eligible).sort((a, b) => (b.recommendation?.matchScore || 0) - (a.recommendation?.matchScore || 0));
      else if (subsection === 'closing_soon') filtered = filtered.filter((o) => o.deadline.isClosingSoon);
      else if (subsection === 'saved') filtered = filtered.filter((o) => o.isSaved);

      if (category && category !== 'all') filtered = filtered.filter((o) => o.category === category);
      if (country && country !== 'all') filtered = filtered.filter((o) => o.country.toLowerCase().includes(country) || o.location.toLowerCase().includes(country));
      if (funding && funding !== 'all') {
        if (funding === 'fully_funded') filtered = filtered.filter((o) => o.funding.fundingLevel === 'fully_funded');
        else if (funding === 'partially_funded') filtered = filtered.filter((o) => o.funding.fundingLevel === 'partially_funded');
        else if (funding === 'self_funded') filtered = filtered.filter((o) => o.funding.fundingLevel === 'self_funded');
      }
      if (visa && visa !== 'all') {
        if (visa === 'employer_sponsored') filtered = filtered.filter((o) => o.funding.visaSupportType === 'employer_sponsored_visa');
        else if (visa === 'visa_fees_funded') filtered = filtered.filter((o) => o.funding.visaSupportType === 'visa_fees_funded');
        else if (visa === 'assistance_only') filtered = filtered.filter((o) => o.funding.visaSupportType === 'visa_assistance_only' || o.funding.visaSupportType === 'invitation_letter_only');
      }
      if (experience && experience !== 'all') {
        if (experience === 'entry') filtered = filtered.filter((o) => (o.eligibility.minimumYearsExperience ?? 0) <= 2 || o.eligibility.careerLevel === 'entry' || o.eligibility.careerLevel === 'internship');
        else if (experience === 'mid') filtered = filtered.filter((o) => (o.eligibility.minimumYearsExperience ?? 0) >= 2 && (o.eligibility.minimumYearsExperience ?? 0) <= 6);
        else if (experience === 'senior') filtered = filtered.filter((o) => (o.eligibility.minimumYearsExperience ?? 0) >= 6 || o.eligibility.careerLevel === 'senior' || o.eligibility.careerLevel === 'management');
      }
      if (eligibility && eligibility !== 'all') {
        if (eligibility === 'ethiopian_confirmed') filtered = filtered.filter((o) => o.eligibility.ethiopianEligible === 'confirmed');
        else if (eligibility === 'no_nomination') {
          filtered = filtered.filter(
            (o) =>
              o.eligibility.universityRecommendationRequired !== 'required' &&
              o.eligibility.companyRecommendationRequired !== 'required' &&
              o.eligibility.institutionalNominationRequired !== 'required'
          );
        }
      }
      if (deadlineFilter && deadlineFilter !== 'all') {
        if (deadlineFilter === 'closing_soon') filtered = filtered.filter((o) => o.deadline.fullDaysRemaining >= 3 && o.deadline.fullDaysRemaining <= 7);
        else if (deadlineFilter === 'within_14_days') filtered = filtered.filter((o) => o.deadline.fullDaysRemaining >= 3 && o.deadline.fullDaysRemaining <= 14);
        else if (deadlineFilter === 'within_30_days') filtered = filtered.filter((o) => o.deadline.fullDaysRemaining >= 3 && o.deadline.fullDaysRemaining <= 30);
      }
      if (q) {
        filtered = filtered.filter((o) =>
          `${o.title} ${o.organization} ${o.country} ${o.location} ${o.summary} ${o.eligibility.requiredSkills.join(' ')}`
            .toLowerCase()
            .includes(q)
        );
      }

      const payload: GlobalOpportunitiesApiResponse = {
        success: true,
        generatedAt: new Date(nowMs).toISOString(),
        minimumDaysRemainingRule: MINIMUM_FULL_DAYS_REMAINING,
        totalActiveVerified: activeVerified.length,
        totalStoredAllStatuses: store.international_opportunities.length,
        countsBySubsection,
        opportunities: filtered,
        sources: store.opportunity_sources,
        lastDiscoveryRun: store.discovery_job_logs[0] || null,
        schedulerInfo: buildSchedulerInfo(store),
        websiteOnlyPolicyNote:
          'Scholarship, professional training, and conference recommendations are displayed exclusively inside the Hopeland Jobs website. No emails, SMS, WhatsApp, or push notifications are sent for them.',
      };

      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to load global opportunities' });
    }
  });

  app.get('/api/global-opportunities/recommended', (req: Request, res: Response): void => {
    const uid = getRequesterUid(req);
    if (!uid) {
      res.status(401).json({ success: false, error: 'Sign in to view personalized recommendations.' });
      return;
    }
    const store = loadStore();
    const profiles = loadUserProfiles();
    const userProfile = profiles[uid];
    if (!userProfile) {
      res.json({ success: true, recommendations: [], message: 'Complete your profile to receive personalized international opportunity recommendations.' });
      return;
    }

    const nowMs = Date.now();
    const savedIds = new Set(
      store.user_saved_opportunities.filter((s) => s.userId === uid).map((s) => s.opportunityId)
    );

    const matched: GlobalOpportunityWithMatch[] = [];
    for (const opp of store.international_opportunities) {
      if (!isOpportunityActiveAndDisplayable(opp, nowMs)) continue;
      const rec = evaluateOpportunityForUser(opp, userProfile, nowMs);
      if (rec.eligible && rec.disqualificationReasons.length === 0) {
        matched.push({
          ...opp,
          recommendation: rec,
          isSaved: savedIds.has(opp.id),
        });
      }
    }
    matched.sort((a, b) => (b.recommendation?.matchScore || 0) - (a.recommendation?.matchScore || 0));

    res.json({
      success: true,
      userId: uid,
      totalMatched: matched.length,
      recommendations: matched,
    });
  });

  app.get('/api/global-opportunities/saved', (req: Request, res: Response): void => {
    const uid = getRequesterUid(req);
    if (!uid) {
      res.status(401).json({ success: false, error: 'Sign in to view saved opportunities.' });
      return;
    }
    const store = loadStore();
    const saved = store.user_saved_opportunities.filter((s) => s.userId === uid);
    res.json({ success: true, saved });
  });

  app.post('/api/global-opportunities/saved/toggle', (req: Request, res: Response): void => {
    const uid = getRequesterUid(req);
    if (!uid) {
      res.status(401).json({ success: false, error: 'Sign in to save opportunities.' });
      return;
    }
    const opportunityId = String(req.body?.opportunityId || '').trim();
    if (!opportunityId) {
      res.status(400).json({ success: false, error: 'opportunityId is required.' });
      return;
    }

    const store = loadStore();
    const existingIdx = store.user_saved_opportunities.findIndex(
      (s) => s.userId === uid && s.opportunityId === opportunityId
    );
    if (existingIdx >= 0) {
      store.user_saved_opportunities.splice(existingIdx, 1);
      saveStore(store);
      res.json({ success: true, saved: false, opportunityId });
      return;
    }

    const opp = store.international_opportunities.find((o) => o.id === opportunityId);
    if (!opp) {
      res.status(404).json({ success: false, error: 'Opportunity not found.' });
      return;
    }

    const record: UserSavedOpportunityRecord = {
      id: `usave_${uid}_${opportunityId}`.slice(0, 128),
      userId: uid,
      opportunityId: opp.id,
      title: opp.title,
      organization: opp.organization,
      category: opp.category,
      country: opp.country,
      deadlineUtcIso: opp.deadline.deadlineUtcIso,
      officialApplicationUrl: opp.officialApplicationUrl,
      savedAt: new Date().toISOString(),
    };

    store.user_saved_opportunities.unshift(record);
    saveStore(store);
    res.json({ success: true, saved: true, record });
  });

  app.get('/api/global-opportunities/sources', (_req: Request, res: Response): void => {
    const store = loadStore();
    res.json({
      success: true,
      sources: store.opportunity_sources,
      lastDiscoveryRun: store.discovery_job_logs[0] || null,
      schedulerInfo: buildSchedulerInfo(store),
    });
  });

  app.get('/api/global-opportunities/logs', (req: Request, res: Response): void => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ success: false, error: 'Administrator access required.' });
      return;
    }
    const store = loadStore();
    const nowMs = Date.now();
    const activeVerified = store.international_opportunities.filter((o) => isOpportunityActiveAndDisplayable(o, nowMs));
    const archivedRecords = store.international_opportunities.filter((o) => !isOpportunityActiveAndDisplayable(o, nowMs));
    const autoUnpublished = archivedRecords.filter((o) => Boolean(o.unpublishedAt || o.wasPreviouslyPublished));
    const rejectedVisa = archivedRecords.filter((o) => o.rejectionCategory === 'visa');
    const rejectedSector = archivedRecords.filter((o) => o.rejectionCategory === 'professional_restriction');
    const expiredRecords = archivedRecords.filter(
      (o) => o.rejectionCategory === 'deadline' || o.applicationStatus === 'expired' || o.verificationStatus === 'Expired'
    );
    const sourceFailuresCount = store.opportunity_sources.filter(
      (s) => s.status === 'error' || s.status === 'degraded'
    ).length;
    const lastVerificationAt =
      store.opportunity_verification_logs[0]?.checkedAt || store.discovery_job_logs[0]?.finishedAt || null;

    const monitoringSummary: VerificationMonitoringSummary = {
      totalDiscoveredAllTime: store.international_opportunities.length,
      activeVerifiedCount: activeVerified.length,
      totalRejectedCount: archivedRecords.length,
      autoUnpublishedCount: autoUnpublished.length,
      rejectedDueToVisaCount: rejectedVisa.length,
      rejectedDueToProfessionalRestrictionCount: rejectedSector.length,
      expiredCount: expiredRecords.length,
      archivedRecordsCount: archivedRecords.length,
      sourceFailuresCount,
      lastVerificationAt,
      lastVerificationAtEat: formatEthiopiaDateTime(lastVerificationAt),
    };

    res.json({
      success: true,
      verificationLogs: store.opportunity_verification_logs.slice(0, 150),
      discoveryJobLogs: store.discovery_job_logs.slice(0, 50),
      sources: store.opportunity_sources,
      schedulerInfo: buildSchedulerInfo(store),
      monitoringSummary,
      archivedOpportunities: archivedRecords.slice(0, 80).map((o) => ({
        id: o.id,
        title: o.title,
        organization: o.organization,
        category: o.category,
        officialApplicationUrl: o.officialApplicationUrl,
        applicationStatus: o.applicationStatus,
        verificationStatus: o.verificationStatus,
        rejectionCategory: o.rejectionCategory || (o.visaCompliancePassed === false ? 'visa' : 'other'),
        rejectionReason: o.rejectionReason || o.verificationNotes,
        visaSupportSummary: o.funding.visaSupportSummary,
        evidenceExcerpt: (o.sourceEvidenceSnippet || '').slice(0, 220),
        wasPreviouslyPublished: Boolean(o.wasPreviouslyPublished),
        unpublishedAt: o.unpublishedAt || null,
        archivedAt: o.archivedAt || o.updatedAt,
        lastVerifiedAt: o.lastVerifiedAt,
      })),
      totals: {
        stored: store.international_opportunities.length,
        activeVerified: activeVerified.length,
        savedCount: store.user_saved_opportunities.length,
        recommendationsCount: store.user_opportunity_recommendations.length,
      },
    });
  });

  // Admin manual trigger for live discovery & verification
  app.post('/api/admin/global-opportunities/run-discovery', async (req: Request, res: Response): Promise<void> => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ success: false, error: 'Administrator access required.' });
      return;
    }
    try {
      const log = await runFullOfficialDiscovery('manual_admin');
      appendAuditLog({
        action: 'global_opportunities_discovery_run',
        actorEmail: getRequesterEmail(req) || 'owner',
        targetType: 'global_opportunities',
        summary: `Ran live Global Opportunity Intelligence discovery: ${log.verifiedAndActiveCount} verified active, ${log.rejectedUnderThreeDaysCount} excluded (<3d), ${log.rejectedBrokenOrClosedCount} unverified/closed.`,
        severity: 'info',
      });
      const store = loadStore();
      res.json({
        success: true,
        runLog: log,
        sources: store.opportunity_sources,
        activeVerifiedCount: log.verifiedAndActiveCount,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Discovery run failed.' });
    }
  });

  app.post('/api/admin/global-opportunities/recheck-deadlines', async (req: Request, res: Response): Promise<void> => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ success: false, error: 'Administrator access required.' });
      return;
    }
    try {
      const checkLinks = Boolean(req.body?.checkLinksLive);
      const log = await runDeadlineAndLinkRecheck('manual_admin', checkLinks);
      res.json({ success: true, runLog: log });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Deadline recheck failed.' });
    }
  });

  app.post('/api/admin/global-opportunities/acknowledge-alert', (req: Request, res: Response): void => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({ success: false, error: 'Administrator access required.' });
      return;
    }
    const store = loadStore();
    if (store.scheduler_state?.adminFailureAlert) {
      store.scheduler_state.adminFailureAlert = {
        ...store.scheduler_state.adminFailureAlert,
        active: false,
        acknowledgedAt: new Date().toISOString(),
      };
      saveStore(store);
    }
    res.json({ success: true, schedulerInfo: buildSchedulerInfo(store) });
  });

  // Autonomous Scheduled Endpoint (Vercel Cron + GitHub Actions 6-Hour EAT Cron + External Cron)
  app.get('/api/cron/global-opportunities', async (req: Request, res: Response): Promise<void> => {
    const cronSecret = (process.env.CRON_SECRET || '').trim();
    const authHeader = String(req.headers.authorization || '').trim();
    const isVercelCron = String(req.headers['x-vercel-cron'] || '') === '1';
    const hasSecretMatch = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!isVercelCron && !hasSecretMatch && !isPersistentOwnerRequest(req)) {
      res.status(401).json({ success: false, error: 'Unauthorized cron trigger.' });
      return;
    }

    try {
      const mode = String(req.query.mode || 'full');
      const sourceParam = String(req.query.source || '').toLowerCase();
      const trigger: DiscoveryJobLogRecord['trigger'] =
        sourceParam === 'github_actions' ? 'github_actions_cron' : 'vercel_cron';
      const slotEat = formatEthiopiaDateTime(Date.now()) || undefined;
      const runLog =
        mode === 'recheck'
          ? await runDeadlineAndLinkRecheck(trigger, true)
          : await executeScheduledDiscoveryWithRetry(trigger, slotEat, 2, 3000);
      const freshStore = loadStore();
      res.json({
        success: true,
        runLog,
        schedulerInfo: buildSchedulerInfo(freshStore),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Scheduled discovery failed.' });
    }
  });

  // =========================================================================
  // 24/7 ETHIOPIA TIME (Africa/Addis_Ababa) 6-HOUR CLOCK-ALIGNED SCHEDULER
  // Mandatory Slots: 00:00, 06:00, 12:00, 18:00 EAT (UTC: 21:00, 03:00, 09:00, 15:00)
  // Operates 365 days/year independently of browser tabs or website visitors.
  // =========================================================================
  function buildSchedulerInfo(store: GlobalOpportunitiesStore): AutonomousSchedulerInfo {
    const state = store.scheduler_state || createDefaultSchedulerState();
    const lastRunAt = store.discovery_job_logs[0]?.finishedAt || null;
    const activeProviders = store.opportunity_sources
      .filter((s) => s.configured && s.status !== 'disabled')
      .map((s) => s.id);
    const connectedSourcesCount = store.opportunity_sources.filter(
      (s) => s.status === 'connected'
    ).length;

    const computedNext = getNextEthiopiaScheduleSlot(Date.now());
    const nextMs = nextScheduledRunAtMs && nextScheduledRunAtMs > Date.now()
      ? nextScheduledRunAtMs
      : computedNext.utcMs;
    const nextIso = new Date(nextMs).toISOString();
    const nextEat = formatEthiopiaDateTime(nextMs);
    const slotLabel = nextScheduledSlotLabel || computedNext.slotLabelEat;

    const lockActive = Boolean(
      isDiscoveryRunning ||
        (state.activeRunLock && new Date(state.activeRunLock.expiresAt).getTime() > Date.now())
    );

    return {
      enabled: !isVercel && process.env.NODE_ENV !== 'test',
      intervalMinutes: DISCOVERY_INTERVAL_MINUTES,
      timezone: ETHIOPIA_TIMEZONE,
      scheduleHoursEat: [...ETHIOPIA_SCHEDULE_LABELS],
      cronExpressionUtc: ETHIOPIA_CRON_EXPRESSION_UTC,
      operatesWithoutVisitors: true,
      runtimeMode: isVercel ? 'vercel_serverless' : 'persistent_node_server',
      activeProviders,
      connectedSourcesCount,
      totalSourcesCount: store.opportunity_sources.length,
      nextScheduledRunAt: nextIso,
      nextScheduledRunAtEat: nextEat,
      nextScheduledSlotLabel: slotLabel,
      lastRunAt,
      lastSuccessfulRunAt: state.lastSuccessfulRunAt,
      lastSuccessfulRunAtEat: state.lastSuccessfulRunAtEat || formatEthiopiaDateTime(state.lastSuccessfulRunAt),
      consecutiveFailures: state.consecutiveFailures || 0,
      isRunningNow: lockActive,
      adminFailureAlert: state.adminFailureAlert || null,
    };
  }

  let scheduledSlotTimer: ReturnType<typeof setTimeout> | null = null;

  function armNextEthiopiaScheduleSlot(): void {
    if (scheduledSlotTimer) {
      clearTimeout(scheduledSlotTimer);
      scheduledSlotTimer = null;
    }
    const nextSlot = getNextEthiopiaScheduleSlot(Date.now());
    nextScheduledRunAtMs = nextSlot.utcMs;
    nextScheduledSlotLabel = nextSlot.slotLabelEat;

    console.log(
      `[GlobalOpportunities] 24/7 Ethiopia Time scheduler armed -> next run at ${nextSlot.eatFormatted} (UTC: ${nextSlot.utcIso}).`
    );

    scheduledSlotTimer = setTimeout(() => {
      const triggeredSlotLabel = nextSlot.slotLabelEat;
      // Immediately re-arm the following 6-hour slot so the schedule NEVER stops even if a run errors
      armNextEthiopiaScheduleSlot();

      executeScheduledDiscoveryWithRetry('ethiopia_6h_schedule', triggeredSlotLabel, 3, 5000)
        .then((log) => {
          console.log(
            `[GlobalOpportunities] 6h Ethiopia Time run (${triggeredSlotLabel}) finished: status=${log.status}, discovered=${log.candidatesDiscovered}, verified=${log.verifiedAndActiveCount}, saved=${log.savedCount ?? log.verifiedAndActiveCount}.`
          );
        })
        .catch((err) => {
          console.warn(
            `[GlobalOpportunities] 6h Ethiopia Time run (${triggeredSlotLabel}) unexpected warning:`,
            err?.message || err
          );
        });
    }, nextSlot.msUntilNext);

    if (typeof scheduledSlotTimer.unref === 'function') {
      scheduledSlotTimer.unref();
    }
  }

  if (!isVercel && process.env.NODE_ENV !== 'test') {
    // 1. Arm clock-aligned 24/7 Ethiopia Time schedule (00:00, 06:00, 12:00, 18:00 Africa/Addis_Ababa)
    armNextEthiopiaScheduleSlot();

    // 2. Startup recovery check (non-blocking, 6 seconds after boot):
    //    If store has 0 active items or last successful run was > 6 hours ago (e.g., server restarted during a missed slot), run catch-up discovery immediately.
    const startupTimer = setTimeout(() => {
      const store = loadStore();
      const lastSuccessMs = store.scheduler_state?.lastSuccessfulRunAt
        ? new Date(store.scheduler_state.lastSuccessfulRunAt).getTime()
        : 0;
      const isStale = !lastSuccessMs || Date.now() - lastSuccessMs > DISCOVERY_INTERVAL_MS;
      const activeCount = store.international_opportunities.filter((o) =>
        isOpportunityActiveAndDisplayable(o)
      ).length;
      if (activeCount === 0 || isStale) {
        executeScheduledDiscoveryWithRetry('startup_recheck', 'Startup Catch-Up', 2, 4000).catch((err) =>
          console.warn('[GlobalOpportunities] Initial catch-up discovery warning:', err?.message || err)
        );
      } else {
        runDeadlineAndLinkRecheck('startup_recheck', false).catch(() => {});
      }
    }, 6000);
    if (typeof startupTimer.unref === 'function') startupTimer.unref();
  }

  return {
    runFullOfficialDiscovery,
    executeScheduledDiscoveryWithRetry,
    runDeadlineAndLinkRecheck,
    loadStore,
  };
}
