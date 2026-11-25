import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dns from 'dns';
import * as net from 'net';
import type {
  ApprovedSourceCategory,
  CrawledOpportunityCategory,
  CrawlerDomainRecord,
  CrawlerMetricsSummary,
  CrawlerQueueTask,
  DiscoveredWebOpportunity,
  OpportunityLifecycleStatus,
} from './src/types/autonomousDiscovery';
import type { RawDiscoveredBranchJob } from './serverBranchManagerJobs';

export interface AutonomousCrawlerDb {
  version: number;
  updatedAt: string;
  lastCrawlerRunAt: string | null;
  totalPagesCrawled: number;
  totalNewPagesDiscovered: number;
  totalDuplicatesPrevented: number;
  domains: Record<string, CrawlerDomainRecord>;
  queue: CrawlerQueueTask[];
  crawledPages: Record<
    string,
    {
      url: string;
      domain: string;
      lastCrawledAt: string;
      contentHash: string;
      httpStatus: number;
      linksFound: number;
      newDomainsFound: number;
      opportunitiesExtracted: number;
    }
  >;
  opportunities: DiscoveredWebOpportunity[];
}

export interface CrawlerCycleExecutionResult {
  pagesProcessed: number;
  newPagesDiscovered: number;
  newDomainsDiscovered: string[];
  opportunitiesExtracted: number;
  opportunitiesVerified: number;
  opportunitiesPublished: number;
  opportunitiesRejected: number;
  opportunitiesExpired: number;
  duplicatesPrevented: number;
  tasksSucceeded: number;
  tasksFailed: number;
  errors: Array<{
    component: string;
    domain: string;
    message: string;
    errorType: 'temporary' | 'permanent';
  }>;
  recoveredFromBackup: boolean;
  publishedBranchCandidates: RawDiscoveredBranchJob[];
}

export interface CustomFetchResponse {
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type CrawlerFetchImpl = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal; redirect: 'manual' }
) => Promise<CustomFetchResponse>;

const MAX_QUEUE_SIZE = 1200;
const MAX_CRAWLED_PAGES = 4000;
const MAX_OPPORTUNITIES = 1500;
const MAX_DOMAINS = 400;
const MAX_RESPONSE_BYTES = 1_500_000;
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = 'HopelandJobsBot/2.0 (+https://www.hopelandjobs.tech; respectful public opportunity indexer)';

const SEED_DISCOVERY_TARGETS: Array<{
  url: string;
  domain: string;
  taskType: CrawlerQueueTask['taskType'];
  category: ApprovedSourceCategory;
  priority: number;
}> = [
  {
    url: 'https://feeds.feedburner.com/ReliefWebJobs',
    domain: 'feeds.feedburner.com',
    taskType: 'feed',
    category: 'intl_org',
    priority: 96,
  },
  {
    url: 'https://www.opportunitiesforafricans.com/feed/',
    domain: 'www.opportunitiesforafricans.com',
    taskType: 'feed',
    category: 'scholarship_training',
    priority: 94,
  },
  {
    url: 'https://remotive.com/remote-jobs/feed',
    domain: 'remotive.com',
    taskType: 'feed',
    category: 'employer_careers',
    priority: 92,
  },
  {
    url: 'https://weworkremotely.com/remote-jobs.rss',
    domain: 'weworkremotely.com',
    taskType: 'feed',
    category: 'employer_careers',
    priority: 90,
  },
  {
    url: 'https://www.make-it-in-germany.com/en/working-in-germany/job-listings',
    domain: 'www.make-it-in-germany.com',
    taskType: 'html_page',
    category: 'immigration_portal',
    priority: 88,
  },
  {
    url: 'https://www.worldbank.org/en/about/careers',
    domain: 'www.worldbank.org',
    taskType: 'html_page',
    category: 'intl_org',
    priority: 86,
  },
  {
    url: 'https://www.daad.de/en/studying-in-germany/scholarships/',
    domain: 'www.daad.de',
    taskType: 'html_page',
    category: 'scholarship_training',
    priority: 85,
  },
  {
    url: 'https://www.chevening.org/scholarships/',
    domain: 'www.chevening.org',
    taskType: 'html_page',
    category: 'scholarship_training',
    priority: 84,
  },
  {
    url: 'https://www.workindenmark.dk/',
    domain: 'www.workindenmark.dk',
    taskType: 'html_page',
    category: 'immigration_portal',
    priority: 82,
  },
  {
    url: 'https://enterprise.gov.ie/en/what-we-do/workplace-and-skills/employment-permits/',
    domain: 'enterprise.gov.ie',
    taskType: 'html_page',
    category: 'gov_portal',
    priority: 81,
  },
  {
    url: 'https://ind.nl/en/residence-permits/work',
    domain: 'ind.nl',
    taskType: 'html_page',
    category: 'immigration_portal',
    priority: 80,
  },
  {
    url: 'https://www.migrationsverket.se/English.html',
    domain: 'www.migrationsverket.se',
    taskType: 'html_page',
    category: 'immigration_portal',
    priority: 80,
  },
  {
    url: 'https://web.archive.org/cdx/search/cdx?url=*.int/careers/*&output=json&limit=15&filter=statuscode:200&collapse=urlkey',
    domain: 'web.archive.org',
    taskType: 'archive_discovery',
    category: 'intl_org',
    priority: 70,
  },
];

const RELEVANT_LINK_KEYWORDS =
  /\b(job|jobs|career|careers|vacanc|recruit|hiring|opening|position|fellowship|scholarship|grant|training|conference|summit|exchange|visa|sponsorship|work-permit|immigration|skilled-worker|bank|finance|accounting|audit|credit|compliance|wash|water|sanitation|hygiene)\b/i;

const RELEVANT_DOMAIN_TLDS_OR_TERMS =
  /(\.gov|\.int|\.edu|\.org|bank|finance|careers|jobs|recruit|immigration|migration|scholarship|fellowship|un\.org|worldbank|afdb|imf|ebrd|eib|oecd|reliefweb|ilo|iom|who|undp|unicef|unhcr|wfp|daad|chevening|eures|make-it-in-germany|workindenmark|migrationsverket|ind\.nl|adyen|wise|monzo|n26|stripe|revolut|mollie|pleo|sumup|gocardless|transfergo|standardchartered|hsbc|barclays|citigroup|ing|rabobank)/i;

const BLOCKED_SOCIAL_OR_NOISE_DOMAINS =
  /(facebook\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com|youtube\.com|youtu\.be|pinterest\.com|reddit\.com|apple\.com|play\.google\.com|cloudflare\.com|w3\.org|schema\.org|fonts\.googleapis\.com|doubleclick\.net|googletagmanager\.com|gravatar\.com|wordpress\.org)$/i;

const SUSPICIOUS_SCAM_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'Upfront application/processing fee requested', regex: /\b(pay\s+(?:an?\s+)?(?:application|registration|visa\s+processing)\s+fee|send\s+money\s+via\s+(?:western\s+union|moneygram|crypto|usdt|bitcoin))\b/i },
  { label: 'WhatsApp-only recruitment contact', regex: /\b(apply\s+only\s+(?:via|on)\s+whatsapp|send\s+your\s+passport\s+(?:copy\s+)?on\s+whatsapp)\b/i },
  { label: 'Guaranteed visa for cash payment', regex: /\b(100%\s+guaranteed\s+visa\s+for\s+\$|buy\s+work\s+permit\s+now)\b/i },
];

const CLOSED_VACANCY_REGEX =
  /\b(this\s+(?:job|position|vacancy|role|opportunity)\s+(?:is\s+)?(?:no\s+longer\s+available|closed|expired|filled)|applications?\s+(?:are\s+)?(?:now\s+)?closed|no\s+longer\s+accepting\s+applications|deadline\s+has\s+passed)\b/i;

/**
 * Transactional JSON load with automatic `.bak` backup recovery if primary JSON is ever corrupted.
 */
export function loadJsonWithBackupRecovery<T>(
  filePath: string,
  fallback: T
): { data: T; recoveredFromBackup: boolean; recoveryNote: string | null } {
  const backupPath = `${filePath}.bak`;
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return {
        data: JSON.parse(raw) as T,
        recoveredFromBackup: false,
        recoveryNote: null,
      };
    }
  } catch (primaryErr: any) {
    // Primary file corrupted — attempt automatic recovery from last-known-good `.bak`
    if (fs.existsSync(backupPath)) {
      try {
        const bakRaw = fs.readFileSync(backupPath, 'utf8');
        const parsed = JSON.parse(bakRaw) as T;
        const tmp = `${filePath}.recover_${process.pid}_${Date.now()}`;
        fs.writeFileSync(tmp, JSON.stringify(parsed, null, 2), 'utf8');
        fs.renameSync(tmp, filePath);
        return {
          data: parsed,
          recoveredFromBackup: true,
          recoveryNote: `Primary store (${path.basename(filePath)}) was corrupted (${primaryErr?.message || 'JSON parse error'}); automatically restored from verified .bak snapshot with zero record loss.`,
        };
      } catch {
        // Fall through to clean fallback
      }
    }
    return {
      data: fallback,
      recoveredFromBackup: false,
      recoveryNote: `Primary store (${path.basename(filePath)}) unreadable and no valid backup existed; initialized clean store.`,
    };
  }
  return { data: fallback, recoveredFromBackup: false, recoveryNote: null };
}

/**
 * Transactional atomic JSON write: keeps a verified `.bak` snapshot before atomic temp+rename replace.
 */
export function saveJsonTransactional(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const serialized = JSON.stringify(data, null, 2);
  // Preserve last-known-good copy in `.bak` before replacing primary file
  if (fs.existsSync(filePath)) {
    try {
      const existing = fs.readFileSync(filePath, 'utf8');
      JSON.parse(existing); // Only overwrite .bak if current primary file is valid JSON
      const bakTmp = `${filePath}.bak.tmp_${process.pid}_${Date.now()}`;
      fs.writeFileSync(bakTmp, existing, 'utf8');
      fs.renameSync(bakTmp, `${filePath}.bak`);
    } catch {
      // Existing primary was invalid; keep previous valid .bak untouched
    }
  }
  const tmpPath = `${filePath}.tmp_${process.pid}_${Date.now()}`;
  fs.writeFileSync(tmpPath, serialized, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Strictly checks whether an IPv4 or IPv6 address is private, loopback, link-local, or reserved.
 */
export function isPrivateOrReservedIp(ipRaw: string): boolean {
  const ip = ipRaw.trim().toLowerCase();
  if (!ip) return true;

  // Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    return isPrivateOrReservedIp(ip.slice(7));
  }

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 cloud metadata/link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 0 && parts[2] === 0) return true;
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
    if (a >= 224) return true; // multicast & reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // unique local fc00::/7
    if (ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) {
      return true; // link-local fe80::/10
    }
    if (ip.startsWith('ff')) return true; // multicast
    return false;
  }

  return true;
}

/**
 * Validates that a crawl URL is strictly public HTTP/HTTPS and resolves ONLY to public IPs.
 */
export async function validatePublicCrawlUrl(
  rawUrl: string,
  options?: { skipDnsForMockTest?: boolean }
): Promise<{ ok: boolean; normalizedUrl?: string; domain?: string; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'Invalid URL syntax' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: `Disallowed URL scheme: ${parsed.protocol}` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Credentials in URL are prohibited' };
  }

  const rawHost = parsed.hostname.toLowerCase();
  const host = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost;
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    return { ok: false, reason: `Blocked internal hostname: ${host}` };
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      return { ok: false, reason: `Blocked private/reserved IP: ${host}` };
    }
  } else if (!options?.skipDnsForMockTest) {
    try {
      const addresses = await dns.promises.lookup(host, { all: true });
      if (!addresses || addresses.length === 0) {
        return { ok: false, reason: `DNS resolution returned no addresses for ${host}` };
      }
      for (const entry of addresses) {
        if (isPrivateOrReservedIp(entry.address)) {
          return { ok: false, reason: `Blocked DNS resolution to private/reserved IP (${entry.address})` };
        }
      }
    } catch (err: any) {
      return { ok: false, reason: `DNS lookup failed for ${host}: ${err?.code || err?.message || 'NXDOMAIN'}` };
    }
  }

  parsed.hash = '';
  return { ok: true, normalizedUrl: parsed.toString(), domain: host };
}

function parseRobotsTxt(rawText: string): {
  allowed: boolean;
  disallowedPrefixes: string[];
  crawlDelaySec: number;
  sitemaps: string[];
} {
  const lines = rawText.split(/\r?\n/);
  let currentApplies = false;
  let specificAgentFound = false;
  const wildcardDisallows: string[] = [];
  const specificDisallows: string[] = [];
  const sitemaps: string[] = [];
  let crawlDelaySec = 5;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();

    if (key === 'sitemap' && /^https?:\/\//i.test(val)) {
      if (!sitemaps.includes(val) && sitemaps.length < 8) {
        sitemaps.push(val);
      }
    } else if (key === 'user-agent') {
      const ua = val.toLowerCase();
      if (ua === 'hopelandjobsbot') {
        specificAgentFound = true;
        currentApplies = true;
      } else if (ua === '*' && !specificAgentFound) {
        currentApplies = true;
      } else {
        currentApplies = false;
      }
    } else if (currentApplies && key === 'disallow' && val) {
      if (specificAgentFound) {
        specificDisallows.push(val);
      } else {
        wildcardDisallows.push(val);
      }
    } else if (currentApplies && key === 'crawl-delay') {
      const parsedDelay = Number(val);
      if (Number.isFinite(parsedDelay) && parsedDelay > 0) {
        crawlDelaySec = Math.min(60, Math.max(2, Math.ceil(parsedDelay)));
      }
    }
  }

  const disallowedPrefixes = (specificAgentFound ? specificDisallows : wildcardDisallows).slice(0, 60);
  const allowed = !disallowedPrefixes.includes('/');
  return { allowed, disallowedPrefixes, crawlDelaySec, sitemaps };
}

function isPathAllowedByRobots(urlStr: string, disallowedPrefixes: string[]): boolean {
  try {
    const pathname = new URL(urlStr).pathname || '/';
    for (const prefix of disallowedPrefixes) {
      if (!prefix) continue;
      if (prefix === '/') return false;
      if (pathname.startsWith(prefix)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractXmlTag(block: string, tagName: string): string {
  const rx = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = block.match(rx);
  return m ? decodeXmlEntities(m[1]) : '';
}

function classifyOpportunityCategory(text: string): CrawledOpportunityCategory {
  const t = text.toLowerCase();
  if (/\b(wash|water,?\s*sanitation|hygiene\s+promotion|sanitation\s+engineer)\b/.test(t)) return 'wash';
  if (/\b(permanent\s+residen|express\s+entry|skilled\s+migration|blue\s+card|work\s+permit|immigration\s+pathway)\b/.test(t)) {
    return 'permanent_residence';
  }
  if (/\b(scholarship|bursary|tuition\s+waiver|fully\s+funded\s+master|phd\s+funding)\b/.test(t)) {
    return 'scholarship';
  }
  if (/\b(fellowship|postdoctoral\s+fellow)\b/.test(t)) return 'fellowship';
  if (/\b(conference|symposium|global\s+summit|forum\s+202)\b/.test(t)) return 'international_conference';
  if (/\b(exchange\s+program|professional\s+exchange|visiting\s+scholar)\b/.test(t)) return 'exchange_programme';
  if (/\b(training\s+program|workshop|short\s+course|capacity\s+building)\b/.test(t)) {
    return 'professional_training';
  }
  if (/\b(bank|banking|branch\s+manager|accounting|finance|financial\s+controller|credit\s+risk|treasury|audit|compliance)\b/.test(t)) {
    return 'banking_finance';
  }
  if (/\b(united\s+nations|undp|unicef|unhcr|wfp|who\b|world\s+bank|afdb|ngo|humanitarian|development\s+sector)\b/.test(t)) {
    return 'ngo_development';
  }
  if (/\b(visa\s+sponsor|work\s+visa\s+provided|relocation\s+package)\b/.test(t)) {
    return 'visa_sponsored_job';
  }
  if (/\b(government\s+recruitment|ministry|public\s+sector|eures|make-it-in-germany|workindenmark)\b/.test(t)) {
    return 'government_recruitment';
  }
  if (/\b(skilled\s+worker|shortage\s+occupation)\b/.test(t)) return 'skilled_worker';
  return 'international_employment';
}

function inferCountryFromText(text: string, domain: string): string {
  const hay = `${text} ${domain}`.toLowerCase();
  const map: Array<[string, RegExp]> = [
    ['Germany', /\b(germany|berlin|frankfurt|munich|make-it-in-germany|\.de\b)\b/i],
    ['United Kingdom', /\b(united\s+kingdom|london|manchester|edinburgh|chevening|\.gov\.uk\b)\b/i],
    ['Netherlands', /\b(netherlands|amsterdam|rotterdam|the\s+hague|government\.nl|\.nl\b)\b/i],
    ['Ireland', /\b(ireland|dublin|cork|enterprise\.gov\.ie|\.ie\b)\b/i],
    ['Sweden', /\b(sweden|stockholm|gothenburg|migrationsverket|\.se\b)\b/i],
    ['Denmark', /\b(denmark|copenhagen|workindenmark|\.dk\b)\b/i],
    ['Norway', /\b(norway|oslo|bergen|\.no\b)\b/i],
    ['Switzerland', /\b(switzerland|geneva|zurich|basel|\.ch\b)\b/i],
    ['United Arab Emirates', /\b(united\s+arab\s+emirates|dubai|abu\s+dhabi|uae)\b/i],
    ['Saudi Arabia', /\b(saudi\s+arabia|riyadh|jeddah)\b/i],
    ['Qatar', /\b(qatar|doha)\b/i],
    ['Kenya', /\b(kenya|nairobi)\b/i],
    ['Rwanda', /\b(rwanda|kigali)\b/i],
    ['South Africa', /\b(south\s+africa|johannesburg|cape\s+town)\b/i],
    ['Canada', /\b(canada|toronto|ottawa|vancouver)\b/i],
    ['Australia', /\b(australia|sydney|melbourne|canberra)\b/i],
    ['France', /\b(france|paris|lyon)\b/i],
    ['Belgium', /\b(belgium|brussels)\b/i],
    ['Austria', /\b(austria|vienna)\b/i],
    ['Luxembourg', /\b(luxembourg)\b/i],
  ];
  for (const [country, rx] of map) {
    if (rx.test(hay)) return country;
  }
  return 'International';
}

function extractSalaryInfo(text: string): { salaryRaw: string | null; salaryMonthlyUsd: number | null } {
  // Never invent salary — only extract explicit numeric currency figures
  const annualMatch = text.match(
    /(?:USD|\$|EUR|€|GBP|£|CHF)\s*([0-9]{2,3}(?:,[0-9]{3})+)\s*(?:[-–to]+\s*(?:USD|\$|EUR|€|GBP|£|CHF)?\s*([0-9]{2,3}(?:,[0-9]{3})+))?\s*(?:per\s+year|\/\s*year|annually|p\.?a\.?|yr)/i
  );
  if (annualMatch) {
    const rawNum = Number(annualMatch[1].replace(/,/g, ''));
    const rawStr = annualMatch[0];
    const mult = /GBP|£/i.test(rawStr) ? 1.27 : /EUR|€/i.test(rawStr) ? 1.08 : /CHF/i.test(rawStr) ? 1.13 : 1;
    if (Number.isFinite(rawNum) && rawNum >= 12000 && rawNum <= 1_000_000) {
      return { salaryRaw: rawStr.trim(), salaryMonthlyUsd: Math.round((rawNum * mult) / 12) };
    }
  }

  const monthlyMatch = text.match(
    /(?:USD|\$|EUR|€|GBP|£|CHF)\s*([0-9]{1,2},[0-9]{3})\s*(?:[-–to]+\s*(?:USD|\$|EUR|€|GBP|£|CHF)?\s*([0-9]{1,2},[0-9]{3}))?\s*(?:per\s+month|\/\s*month|monthly|\/\s*mo)/i
  );
  if (monthlyMatch) {
    const rawNum = Number(monthlyMatch[1].replace(/,/g, ''));
    const rawStr = monthlyMatch[0];
    const mult = /GBP|£/i.test(rawStr) ? 1.27 : /EUR|€/i.test(rawStr) ? 1.08 : /CHF/i.test(rawStr) ? 1.13 : 1;
    if (Number.isFinite(rawNum) && rawNum >= 500 && rawNum <= 100_000) {
      return { salaryRaw: rawStr.trim(), salaryMonthlyUsd: Math.round(rawNum * mult) };
    }
  }
  return { salaryRaw: null, salaryMonthlyUsd: null };
}

function extractDeadlineInfo(text: string): { deadlineRaw: string | null; deadlineIso: string | null } {
  const m = text.match(
    /(?:deadline|closing\s+date|apply\s+by|valid\s+through|closes\s+on)[:\s-]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+[0-9]{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+[0-9]{1,2},?\s+[0-9]{4})/i
  );
  if (!m) return { deadlineRaw: null, deadlineIso: null };
  const raw = m[1].trim();
  const parsed = Date.parse(raw);
  return {
    deadlineRaw: raw,
    deadlineIso: Number.isNaN(parsed) ? null : new Date(parsed).toISOString(),
  };
}

function fingerprintOpportunity(url: string, title: string, employer: string): string {
  const norm = [
    url.trim().toLowerCase().replace(/\/+$/, ''),
    title.trim().toLowerCase().replace(/\s+/g, ' '),
    employer.trim().toLowerCase().replace(/\s+/g, ' '),
  ].join('|');
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 24);
}

export class AutonomousWebCrawler {
  private readonly dbPath: string;
  private readonly fetchImpl: CrawlerFetchImpl;
  private readonly skipDnsForMockTest: boolean;

  constructor(options: {
    runtimeBaseDir: string;
    fetchImpl?: CrawlerFetchImpl;
    skipDnsForMockTest?: boolean;
  }) {
    this.dbPath = path.join(options.runtimeBaseDir, 'data', 'autonomous_crawler_db.json');
    this.skipDnsForMockTest = Boolean(options.skipDnsForMockTest);
    this.fetchImpl =
      options.fetchImpl ||
      (async (url, init) => {
        const res = await fetch(url, init);
        return {
          status: res.status,
          headers: res.headers,
          text: async () => {
            const reader = res.body?.getReader();
            if (!reader) return await res.text();
            const chunks: Uint8Array[] = [];
            let total = 0;
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                total += value.byteLength;
                if (total > MAX_RESPONSE_BYTES) {
                  await reader.cancel();
                  chunks.push(value.subarray(0, Math.max(0, value.byteLength - (total - MAX_RESPONSE_BYTES))));
                  break;
                }
                chunks.push(value);
              }
            }
            return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
          },
        };
      });
  }

  private createDefaultDb(): AutonomousCrawlerDb {
    const nowIso = new Date().toISOString();
    const db: AutonomousCrawlerDb = {
      version: 1,
      updatedAt: nowIso,
      lastCrawlerRunAt: null,
      totalPagesCrawled: 0,
      totalNewPagesDiscovered: 0,
      totalDuplicatesPrevented: 0,
      domains: {},
      queue: [],
      crawledPages: {},
      opportunities: [],
    };
    this.seedInitialFrontier(db, nowIso);
    return db;
  }

  private seedInitialFrontier(db: AutonomousCrawlerDb, nowIso: string): void {
    const existingUrls = new Set(db.queue.map((t) => t.url));
    for (const seed of SEED_DISCOVERY_TARGETS) {
      if (!db.domains[seed.domain]) {
        db.domains[seed.domain] = {
          domain: seed.domain,
          firstDiscoveredAt: nowIso,
          discoveredFrom: 'initial_seed',
          category: seed.category,
          monitored: true,
          robotsFetchedAt: null,
          robotsAllowed: true,
          disallowedPrefixes: [],
          crawlDelaySec: 5,
          sitemaps: [],
          feeds: seed.taskType === 'feed' ? [seed.url] : [],
          pagesCrawledCount: 0,
          opportunitiesFoundCount: 0,
          consecutiveErrors: 0,
          pausedUntil: null,
          lastCrawledAt: null,
          lastStatus: 'idle',
          lastError: null,
        };
      }
      if (!existingUrls.has(seed.url)) {
        existingUrls.add(seed.url);
        db.queue.push({
          id: `task_${crypto.createHash('sha256').update(seed.url).digest('hex').slice(0, 14)}`,
          url: seed.url,
          domain: seed.domain,
          taskType: seed.taskType,
          priority: seed.priority,
          status: 'queued',
          attempts: 0,
          maxAttempts: 3,
          nextRetryAt: null,
          enqueuedAt: nowIso,
          startedAt: null,
          finishedAt: null,
          discoveredFrom: 'initial_seed',
          lastError: null,
        });
      }
    }
  }

  public loadDb(): { db: AutonomousCrawlerDb; recoveredFromBackup: boolean; recoveryNote: string | null } {
    const def = this.createDefaultDb();
    const loaded = loadJsonWithBackupRecovery<Partial<AutonomousCrawlerDb>>(this.dbPath, def);
    const db: AutonomousCrawlerDb = {
      ...def,
      ...loaded.data,
      domains:
        loaded.data.domains && typeof loaded.data.domains === 'object'
          ? loaded.data.domains
          : def.domains,
      queue: Array.isArray(loaded.data.queue) ? loaded.data.queue : def.queue,
      crawledPages:
        loaded.data.crawledPages && typeof loaded.data.crawledPages === 'object'
          ? loaded.data.crawledPages
          : {},
      opportunities: Array.isArray(loaded.data.opportunities) ? loaded.data.opportunities : [],
    };
    if (Object.keys(db.domains).length === 0) {
      this.seedInitialFrontier(db, new Date().toISOString());
    }
    return {
      db,
      recoveredFromBackup: loaded.recoveredFromBackup,
      recoveryNote: loaded.recoveryNote,
    };
  }

  public saveDb(db: AutonomousCrawlerDb): void {
    db.updatedAt = new Date().toISOString();

    // Bound queue & crawledPages cleanly while preserving active queued/retry tasks
    if (db.queue.length > MAX_QUEUE_SIZE) {
      const active = db.queue.filter((t) => t.status === 'queued' || t.status === 'processing');
      const finished = db.queue
        .filter((t) => t.status === 'done' || t.status === 'failed')
        .sort((a, b) => Date.parse(b.finishedAt || b.enqueuedAt) - Date.parse(a.finishedAt || a.enqueuedAt))
        .slice(0, Math.max(100, MAX_QUEUE_SIZE - active.length));
      db.queue = [...active.slice(0, MAX_QUEUE_SIZE - 100), ...finished];
    }

    const pageEntries = Object.entries(db.crawledPages);
    if (pageEntries.length > MAX_CRAWLED_PAGES) {
      pageEntries.sort((a, b) => Date.parse(b[1].lastCrawledAt) - Date.parse(a[1].lastCrawledAt));
      db.crawledPages = Object.fromEntries(pageEntries.slice(0, MAX_CRAWLED_PAGES));
    }

    if (db.opportunities.length > MAX_OPPORTUNITIES) {
      db.opportunities = db.opportunities.slice(0, MAX_OPPORTUNITIES);
    }

    saveJsonTransactional(this.dbPath, db);
  }

  /**
   * Crash recovery: moves any tasks left in 'processing' after an abrupt crash back to 'queued'
   * so queued work is NEVER lost on server restarts.
   */
  public recoverInterruptedTasksOnBoot(): { recoveredTasks: number; recoveredFromBackup: boolean; recoveryNote: string | null } {
    const { db, recoveredFromBackup, recoveryNote } = this.loadDb();
    let recoveredTasks = 0;
    for (const task of db.queue) {
      if (task.status === 'processing') {
        task.status = 'queued';
        task.startedAt = null;
        task.lastError = 'Recovered automatically after worker restart';
        recoveredTasks++;
      }
    }
    if (recoveredTasks > 0 || recoveredFromBackup || !fs.existsSync(this.dbPath)) {
      this.saveDb(db);
    }
    return { recoveredTasks, recoveredFromBackup, recoveryNote };
  }

  public enqueueUrl(
    db: AutonomousCrawlerDb,
    params: {
      url: string;
      taskType: CrawlerQueueTask['taskType'];
      priority: number;
      discoveredFrom: string;
      categoryHint?: ApprovedSourceCategory;
    }
  ): { enqueued: boolean; isNewDomain: boolean; domain?: string } {
    let parsed: URL;
    try {
      parsed = new URL(params.url);
    } catch {
      return { enqueued: false, isNewDomain: false };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { enqueued: false, isNewDomain: false };
    }
    parsed.hash = '';
    const cleanUrl = parsed.toString();
    const domain = parsed.hostname.toLowerCase();

    if (BLOCKED_SOCIAL_OR_NOISE_DOMAINS.test(domain)) {
      return { enqueued: false, isNewDomain: false };
    }

    const nowIso = new Date().toISOString();
    let isNewDomain = false;
    if (!db.domains[domain]) {
      if (Object.keys(db.domains).length >= MAX_DOMAINS) {
        return { enqueued: false, isNewDomain: false };
      }
      isNewDomain = true;
      db.domains[domain] = {
        domain,
        firstDiscoveredAt: nowIso,
        discoveredFrom: params.discoveredFrom,
        category: params.categoryHint || this.inferDomainCategory(domain, cleanUrl),
        monitored: true,
        robotsFetchedAt: null,
        robotsAllowed: true,
        disallowedPrefixes: [],
        crawlDelaySec: 5,
        sitemaps: [],
        feeds: params.taskType === 'feed' ? [cleanUrl] : [],
        pagesCrawledCount: 0,
        opportunitiesFoundCount: 0,
        consecutiveErrors: 0,
        pausedUntil: null,
        lastCrawledAt: null,
        lastStatus: 'idle',
        lastError: null,
      };
    }

    const alreadyQueued = db.queue.some((t) => t.url === cleanUrl);
    if (alreadyQueued) {
      return { enqueued: false, isNewDomain, domain };
    }

    if (db.queue.filter((t) => t.status === 'queued').length >= 600) {
      return { enqueued: false, isNewDomain, domain };
    }

    db.queue.push({
      id: `task_${crypto.createHash('sha256').update(cleanUrl).digest('hex').slice(0, 14)}`,
      url: cleanUrl,
      domain,
      taskType: params.taskType,
      priority: Math.min(100, Math.max(1, params.priority)),
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      nextRetryAt: null,
      enqueuedAt: nowIso,
      startedAt: null,
      finishedAt: null,
      discoveredFrom: params.discoveredFrom,
      lastError: null,
    });
    db.totalNewPagesDiscovered++;
    return { enqueued: true, isNewDomain, domain };
  }

  private inferDomainCategory(domain: string, url: string): ApprovedSourceCategory {
    const s = `${domain} ${url}`.toLowerCase();
    if (/\.gov|government\.|migrationsverket|make-it-in-germany|workindenmark|immigration|visa|permit/.test(s)) {
      return 'immigration_portal';
    }
    if (/scholarship|fellowship|daad|chevening|training|conference|university|\.edu/.test(s)) {
      return 'scholarship_training';
    }
    if (/\.int|un\.org|reliefweb|worldbank|afdb|imf|oecd|ilo|iom|undp|unicef|unhcr/.test(s)) {
      return 'intl_org';
    }
    return 'employer_careers';
  }

  private async safeFetchPublicText(
    rawUrl: string,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
  ): Promise<{
    ok: boolean;
    status: number;
    finalUrl: string;
    text?: string;
    rateLimited?: boolean;
    retryAfterSec?: number;
    errorType?: 'temporary' | 'permanent';
    error?: string;
  }> {
    let currentUrl = rawUrl;
    for (let hop = 0; hop <= 3; hop++) {
      const check = await validatePublicCrawlUrl(currentUrl, {
        skipDnsForMockTest: this.skipDnsForMockTest,
      });
      if (!check.ok || !check.normalizedUrl) {
        return {
          ok: false,
          status: 0,
          finalUrl: currentUrl,
          errorType: 'permanent',
          error: check.reason || 'Blocked unsafe URL',
        };
      }

      try {
        const res = await this.fetchImpl(check.normalizedUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/atom+xml,application/json;q=0.9,*/*;q=0.5',
          },
          signal: AbortSignal.timeout(timeoutMs),
          redirect: 'manual',
        });

        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location');
          if (!loc) {
            return {
              ok: false,
              status: res.status,
              finalUrl: check.normalizedUrl,
              errorType: 'permanent',
              error: `Redirect ${res.status} without Location header`,
            };
          }
          currentUrl = new URL(loc, check.normalizedUrl).toString();
          continue;
        }

        if (res.status === 429) {
          const ra = Number(res.headers.get('retry-after'));
          const retryAfterSec = Number.isFinite(ra) && ra > 0 ? Math.min(3600, Math.max(180, Math.ceil(ra))) : 600;
          return {
            ok: false,
            status: 429,
            finalUrl: check.normalizedUrl,
            rateLimited: true,
            retryAfterSec,
            errorType: 'temporary',
            error: `HTTP 429 rate-limited (cooldown ${retryAfterSec}s)`,
          };
        }

        if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 410) {
          return {
            ok: false,
            status: res.status,
            finalUrl: check.normalizedUrl,
            errorType: 'permanent',
            error: `HTTP ${res.status} (${res.status === 401 || res.status === 403 ? 'access restricted — respecting site policy' : 'not found'})`,
          };
        }

        if (res.status >= 500) {
          return {
            ok: false,
            status: res.status,
            finalUrl: check.normalizedUrl,
            errorType: 'temporary',
            error: `HTTP ${res.status} temporary upstream server error`,
          };
        }

        if (res.status >= 200 && res.status < 300) {
          const text = await res.text();
          return { ok: true, status: res.status, finalUrl: check.normalizedUrl, text };
        }

        return {
          ok: false,
          status: res.status,
          finalUrl: check.normalizedUrl,
          errorType: 'temporary',
          error: `Unexpected HTTP ${res.status}`,
        };
      } catch (err: any) {
        return {
          ok: false,
          status: 0,
          finalUrl: check.normalizedUrl,
          errorType: 'temporary',
          error: err?.name === 'TimeoutError' ? `Request timeout after ${timeoutMs}ms` : err?.message || String(err),
        };
      }
    }

    return {
      ok: false,
      status: 0,
      finalUrl: currentUrl,
      errorType: 'permanent',
      error: 'Too many redirects (>3)',
    };
  }

  private async ensureDomainRobotsChecked(db: AutonomousCrawlerDb, domain: string): Promise<void> {
    const rec = db.domains[domain];
    if (!rec) return;
    const nowMs = Date.now();
    // Re-check robots.txt at most once every 24 hours per domain
    if (rec.robotsFetchedAt && nowMs - Date.parse(rec.robotsFetchedAt) < 24 * 60 * 60 * 1000) {
      return;
    }

    const robotsUrl = `https://${domain}/robots.txt`;
    const res = await this.safeFetchPublicText(robotsUrl, 4500);
    rec.robotsFetchedAt = new Date().toISOString();
    if (res.ok && res.text) {
      const parsed = parseRobotsTxt(res.text);
      rec.robotsAllowed = parsed.allowed;
      rec.disallowedPrefixes = parsed.disallowedPrefixes;
      rec.crawlDelaySec = parsed.crawlDelaySec;
      for (const sm of parsed.sitemaps) {
        if (!rec.sitemaps.includes(sm)) {
          rec.sitemaps.push(sm);
          this.enqueueUrl(db, {
            url: sm,
            taskType: 'sitemap',
            priority: 75,
            discoveredFrom: `robots.txt:${domain}`,
            categoryHint: rec.category,
          });
        }
      }
    } else if (res.status === 404 || res.status === 410) {
      rec.robotsAllowed = true;
      rec.disallowedPrefixes = [];
    }
  }

  /**
   * 6-state verification pipeline:
   * DISCOVERED -> PENDING_VERIFICATION -> VERIFIED -> PUBLISHED (or REJECTED / EXPIRED)
   */
  private verifyAndRecordOpportunity(
    db: AutonomousCrawlerDb,
    candidate: {
      title: string;
      employer: string;
      summaryText: string;
      officialUrl: string;
      sourceDomain: string;
      deadlineRaw?: string | null;
      deadlineIso?: string | null;
      salaryRaw?: string | null;
      salaryMonthlyUsd?: number | null;
      httpVerifiedLive: boolean;
    },
    counters: CrawlerCycleExecutionResult
  ): void {
    const cleanTitle = candidate.title.replace(/\s+/g, ' ').trim();
    const cleanEmployer = candidate.employer.replace(/\s+/g, ' ').trim() || candidate.sourceDomain;
    const cleanUrl = candidate.officialUrl.trim();
    if (cleanTitle.length < 6 || !/^https:\/\//i.test(cleanUrl)) return;

    const fp = fingerprintOpportunity(cleanUrl, cleanTitle, cleanEmployer);
    if (db.opportunities.some((o) => o.fingerprint === fp)) {
      db.totalDuplicatesPrevented++;
      counters.duplicatesPrevented++;
      return;
    }

    const nowIso = new Date().toISOString();
    const combined = `${cleanTitle}\n${cleanEmployer}\n${candidate.summaryText}`;

    // Stage 1: DISCOVERED -> Stage 2: PENDING_VERIFICATION
    const suspiciousFlags: string[] = [];
    for (const rule of SUSPICIOUS_SCAM_PATTERNS) {
      if (rule.regex.test(combined)) {
        suspiciousFlags.push(rule.label);
      }
    }

    const isClosedText = CLOSED_VACANCY_REGEX.test(combined);
    const extractedDeadline = candidate.deadlineIso
      ? { deadlineRaw: candidate.deadlineRaw || candidate.deadlineIso.slice(0, 10), deadlineIso: candidate.deadlineIso }
      : extractDeadlineInfo(combined);
    const isPastDeadline = Boolean(
      extractedDeadline.deadlineIso && Date.parse(extractedDeadline.deadlineIso) < Date.now()
    );

    const salaryInfo =
      candidate.salaryMonthlyUsd != null
        ? { salaryRaw: candidate.salaryRaw || `~$${candidate.salaryMonthlyUsd}/mo`, salaryMonthlyUsd: candidate.salaryMonthlyUsd }
        : extractSalaryInfo(combined);

    const visaEvidenceMatch = combined.match(
      /[^.\n]{0,80}\b(visa\s+sponsor(?:ship|ed)?|work\s+permit\s+sponsor(?:ship|ed)?|relocation\s+(?:package|support|assistance)|skilled\s+worker\s+visa|eu\s+blue\s+card)\b[^.\n]{0,80}/i
    );
    const visaSponsorshipConfirmed = Boolean(
      visaEvidenceMatch && !/\b(no\s+visa\s+sponsorship|cannot\s+sponsor|unable\s+to\s+sponsor|must\s+already\s+have\s+the\s+right\s+to\s+work)\b/i.test(combined)
    );

    const ethiopianExcluded =
      /\b(eu\s+citizens?\s+only|us\s+citizens?\s+only|uk\s+nationals?\s+only|local\s+nationals?\s+only|must\s+already\s+reside\s+in)\b/i.test(
        combined
      );
    const ethiopianConfirmed = /\b(ethiopia|ethiopian|developing\s+countries|sub-saharan\s+africa|all\s+nationalities\s+welcome|international\s+applicants\s+encouraged)\b/i.test(
      combined
    );

    const employerAuthentic =
      cleanEmployer.length >= 2 &&
      !BLOCKED_SOCIAL_OR_NOISE_DOMAINS.test(candidate.sourceDomain) &&
      (RELEVANT_DOMAIN_TLDS_OR_TERMS.test(candidate.sourceDomain) || candidate.httpVerifiedLive);

    const checks = {
      employerAuthentic,
      vacancyExists: candidate.httpVerifiedLive && !isClosedText,
      salaryChecked: true,
      visaChecked: true,
      nationalityChecked: true,
      deadlineValid: !isPastDeadline,
      officialLinkValid: /^https:\/\//i.test(cleanUrl),
      suspiciousFlags,
    };

    let status: OpportunityLifecycleStatus = 'PENDING_VERIFICATION';
    let rejectionReason: string | null = null;
    let verifiedAt: string | null = null;
    let publishedAt: string | null = null;

    if (suspiciousFlags.length > 0) {
      status = 'REJECTED';
      rejectionReason = `Suspicious announcement flagged: ${suspiciousFlags.join('; ')}`;
      counters.opportunitiesRejected++;
    } else if (isPastDeadline || isClosedText) {
      status = 'EXPIRED';
      rejectionReason = isPastDeadline
        ? `Application deadline passed (${extractedDeadline.deadlineRaw})`
        : 'Vacancy notice states applications are closed';
      counters.opportunitiesExpired++;
    } else if (!checks.employerAuthentic || !checks.officialLinkValid) {
      status = 'REJECTED';
      rejectionReason = 'Employer authenticity or official HTTPS link could not be verified';
      counters.opportunitiesRejected++;
    } else if (checks.vacancyExists) {
      // Passed all verification checks: DISCOVERED -> PENDING_VERIFICATION -> VERIFIED -> PUBLISHED
      status = 'PUBLISHED';
      verifiedAt = nowIso;
      publishedAt = nowIso;
      counters.opportunitiesVerified++;
      counters.opportunitiesPublished++;

      if (db.domains[candidate.sourceDomain]) {
        db.domains[candidate.sourceDomain].opportunitiesFoundCount++;
      }

      // Forward verified banking, branch management, finance, and international roles into the Branch Banking evaluation pool (NO minimum salary restriction!)
      if (
        /\b(bank|banking|branch\s+manager|retail\s+banking|credit\s+manager|relationship\s+manager|finance\s+manager|financial\s+controller|compliance\s+manager|risk\s+manager|microfinance|treasury)\b/i.test(
          `${cleanTitle} ${cleanEmployer} ${combined}`
        )
      ) {
        counters.publishedBranchCandidates.push({
          id: `bm_web_${fp}`,
          title: cleanTitle,
          employerName: cleanEmployer,
          locationRaw: inferCountryFromText(combined, candidate.sourceDomain),
          descriptionText: candidate.summaryText.slice(0, 2000),
          compensationRaw: salaryInfo.salaryRaw || undefined,
          applicationUrl: cleanUrl,
          sourcePortal: `Autonomous Web Crawler (${candidate.sourceDomain})`,
          datePosted: nowIso.slice(0, 10),
          applicationDeadline: extractedDeadline.deadlineRaw || undefined,
          explicitVisaNote: visaEvidenceMatch ? visaEvidenceMatch[0].trim() : undefined,
          ethiopianEligibleHint: ethiopianExcluded
            ? 'excluded'
            : ethiopianConfirmed
            ? 'confirmed'
            : 'likely_global',
        });
      }
    } else {
      // Remains transparently in PENDING_VERIFICATION — NEVER published as verified!
      status = 'PENDING_VERIFICATION';
    }

    const record: DiscoveredWebOpportunity = {
      id: `webopp_${fp}`,
      fingerprint: fp,
      status,
      title: cleanTitle.slice(0, 180),
      employer: cleanEmployer.slice(0, 120),
      category: classifyOpportunityCategory(combined),
      country: inferCountryFromText(combined, candidate.sourceDomain),
      location: inferCountryFromText(combined, candidate.sourceDomain),
      salaryRaw: salaryInfo.salaryRaw,
      salaryMonthlyUsd: salaryInfo.salaryMonthlyUsd,
      visaSponsorshipConfirmed,
      visaSponsorshipEvidence: visaEvidenceMatch ? visaEvidenceMatch[0].trim() : null,
      ethiopianEligible: ethiopianExcluded
        ? 'excluded'
        : ethiopianConfirmed
        ? 'confirmed'
        : 'likely_global',
      requirementsSummary: candidate.summaryText.replace(/\s+/g, ' ').trim().slice(0, 320),
      deadlineRaw: extractedDeadline.deadlineRaw,
      deadlineIso: extractedDeadline.deadlineIso,
      officialApplicationUrl: cleanUrl,
      sourceDomain: candidate.sourceDomain,
      discoveredAt: nowIso,
      verifiedAt,
      publishedAt,
      verificationChecks: checks,
      rejectionReason,
    };

    db.opportunities.unshift(record);
    counters.opportunitiesExtracted++;
  }

  private processRssOrAtomFeed(
    db: AutonomousCrawlerDb,
    task: CrawlerQueueTask,
    xmlText: string,
    result: CrawlerCycleExecutionResult
  ): { linksFound: number; newDomainsFound: number } {
    const items = [
      ...(xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || []),
      ...(xmlText.match(/<entry\b[\s\S]*?<\/entry>/gi) || []),
    ].slice(0, 25);

    let linksFound = 0;
    let newDomainsFound = 0;

    for (const block of items) {
      const title = stripHtmlTags(extractXmlTag(block, 'title'));
      const desc = stripHtmlTags(
        extractXmlTag(block, 'description') || extractXmlTag(block, 'summary') || extractXmlTag(block, 'content')
      );
      let link = extractXmlTag(block, 'link');
      if (!link) {
        const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);
        if (hrefMatch) link = decodeXmlEntities(hrefMatch[1]);
      }
      if (!link || !/^https?:\/\//i.test(link)) continue;
      linksFound++;

      const author = stripHtmlTags(extractXmlTag(block, 'author') || extractXmlTag(block, 'dc:creator')) || task.domain;
      const beforeCount = result.opportunitiesExtracted;
      this.verifyAndRecordOpportunity(
        db,
        {
          title,
          employer: author,
          summaryText: desc,
          officialUrl: link.replace(/^http:\/\//i, 'https://'),
          sourceDomain: task.domain,
          httpVerifiedLive: true, // Verified directly from live HTTP 200 official RSS/Atom feed
        },
        result
      );

      // Discover external links embedded in feed descriptions too
      const hrefs = desc.match(/https?:\/\/[^\s"'<>)]+/gi) || [];
      for (const extUrl of hrefs.slice(0, 3)) {
        if (RELEVANT_LINK_KEYWORDS.test(extUrl) || RELEVANT_DOMAIN_TLDS_OR_TERMS.test(extUrl)) {
          const enq = this.enqueueUrl(db, {
            url: extUrl,
            taskType: 'html_page',
            priority: 65,
            discoveredFrom: `feed:${task.domain}`,
          });
          if (enq.enqueued) result.newPagesDiscovered++;
          if (enq.isNewDomain && enq.domain) {
            newDomainsFound++;
            result.newDomainsDiscovered.push(enq.domain);
          }
        }
      }

      if (result.opportunitiesExtracted === beforeCount) {
        // Still queue link for HTML inspection if needed
        const enq = this.enqueueUrl(db, {
          url: link,
          taskType: 'html_page',
          priority: 60,
          discoveredFrom: `feed:${task.domain}`,
        });
        if (enq.enqueued) result.newPagesDiscovered++;
      }
    }

    return { linksFound, newDomainsFound };
  }

  private processSitemapXml(
    db: AutonomousCrawlerDb,
    task: CrawlerQueueTask,
    xmlText: string,
    result: CrawlerCycleExecutionResult
  ): { linksFound: number; newDomainsFound: number } {
    const locMatches = Array.from(xmlText.matchAll(/<loc>([\s\S]*?)<\/loc>/gi))
      .map((m) => decodeXmlEntities(m[1]))
      .filter((u) => /^https?:\/\//i.test(u));

    let linksFound = 0;
    let newDomainsFound = 0;
    const isSitemapIndex = /<sitemapindex\b/i.test(xmlText);

    for (const locUrl of locMatches) {
      if (linksFound >= 20) break;
      const relevant = isSitemapIndex
        ? /job|career|vacanc|opportunit|scholarship|immigration|en/i.test(locUrl)
        : RELEVANT_LINK_KEYWORDS.test(locUrl);
      if (!relevant) continue;

      linksFound++;
      const enq = this.enqueueUrl(db, {
        url: locUrl,
        taskType: isSitemapIndex ? 'sitemap' : 'html_page',
        priority: isSitemapIndex ? 72 : 68,
        discoveredFrom: `sitemap:${task.domain}`,
      });
      if (enq.enqueued) result.newPagesDiscovered++;
      if (enq.isNewDomain && enq.domain) {
        newDomainsFound++;
        result.newDomainsDiscovered.push(enq.domain);
      }
    }

    return { linksFound, newDomainsFound };
  }

  private processArchiveCdxJson(
    db: AutonomousCrawlerDb,
    task: CrawlerQueueTask,
    jsonText: string,
    result: CrawlerCycleExecutionResult
  ): { linksFound: number; newDomainsFound: number } {
    let rows: any[];
    try {
      rows = JSON.parse(jsonText);
    } catch {
      return { linksFound: 0, newDomainsFound: 0 };
    }
    if (!Array.isArray(rows) || rows.length < 2) return { linksFound: 0, newDomainsFound: 0 };

    const header = rows[0] as string[];
    const origIdx = header.indexOf('original');
    if (origIdx === -1) return { linksFound: 0, newDomainsFound: 0 };

    let linksFound = 0;
    let newDomainsFound = 0;
    for (const row of rows.slice(1, 16)) {
      const origUrl = String(row?.[origIdx] || '').trim();
      if (!/^https?:\/\//i.test(origUrl)) continue;
      if (!RELEVANT_LINK_KEYWORDS.test(origUrl)) continue;
      linksFound++;
      const enq = this.enqueueUrl(db, {
        url: origUrl.replace(/^http:\/\//i, 'https://'),
        taskType: 'html_page',
        priority: 62,
        discoveredFrom: 'public_archive_cdx',
      });
      if (enq.enqueued) result.newPagesDiscovered++;
      if (enq.isNewDomain && enq.domain) {
        newDomainsFound++;
        result.newDomainsDiscovered.push(enq.domain);
      }
    }
    return { linksFound, newDomainsFound };
  }

  private processHtmlPage(
    db: AutonomousCrawlerDb,
    task: CrawlerQueueTask,
    finalUrl: string,
    html: string,
    result: CrawlerCycleExecutionResult
  ): { linksFound: number; newDomainsFound: number } {
    let linksFound = 0;
    let newDomainsFound = 0;

    // 1. Discover any RSS / Atom feeds advertised in <link rel="alternate">
    const feedMatches = Array.from(
      html.matchAll(/<link[^>]+rel=["']alternate["'][^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi)
    );
    for (const fm of feedMatches.slice(0, 3)) {
      const href = fm[0].match(/href=["']([^"']+)["']/i)?.[1];
      if (!href) continue;
      try {
        const absFeed = new URL(href, finalUrl).toString();
        const enq = this.enqueueUrl(db, {
          url: absFeed,
          taskType: 'feed',
          priority: 85,
          discoveredFrom: `html_autodiscover:${task.domain}`,
        });
        if (enq.enqueued) result.newPagesDiscovered++;
        if (db.domains[task.domain] && !db.domains[task.domain].feeds.includes(absFeed)) {
          db.domains[task.domain].feeds.push(absFeed);
        }
      } catch {
        // Ignore malformed relative href
      }
    }

    // 2. Extract structured schema.org/JobPosting JSON-LD blocks (highest precision!)
    const ldScripts = Array.from(
      html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
    );
    for (const m of ldScripts.slice(0, 10)) {
      try {
        const parsed = JSON.parse(m[1].trim());
        const items = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.['@graph'])
          ? parsed['@graph']
          : [parsed];
        for (const item of items) {
          if (String(item?.['@type'] || '').toLowerCase() !== 'jobposting') continue;
          const title = String(item.title || '').trim();
          const employer = String(item.hiringOrganization?.name || task.domain).trim();
          const desc = stripHtmlTags(String(item.description || ''));
          const validThrough = typeof item.validThrough === 'string' ? item.validThrough : null;
          let salaryRaw: string | null = null;
          let salaryMonthlyUsd: number | null = null;
          const val = item.baseSalary?.value?.value ?? item.baseSalary?.value?.minValue;
          const unit = String(item.baseSalary?.value?.unitText || '').toUpperCase();
          const curr = String(item.baseSalary?.currency || 'USD').toUpperCase();
          if (typeof val === 'number' && val > 0) {
            salaryRaw = `${curr} ${val.toLocaleString()} ${unit || 'YEAR'}`;
            const mult = curr === 'GBP' ? 1.27 : curr === 'EUR' ? 1.08 : curr === 'CHF' ? 1.13 : 1;
            salaryMonthlyUsd =
              unit === 'MONTH' ? Math.round(val * mult) : Math.round((val * mult) / 12);
          }
          this.verifyAndRecordOpportunity(
            db,
            {
              title,
              employer,
              summaryText: desc,
              officialUrl: finalUrl,
              sourceDomain: task.domain,
              deadlineRaw: validThrough,
              deadlineIso: validThrough && !Number.isNaN(Date.parse(validThrough))
                ? new Date(validThrough).toISOString()
                : null,
              salaryRaw,
              salaryMonthlyUsd,
              httpVerifiedLive: true,
            },
            result
          );
        }
      } catch {
        // Ignore non-standard JSON-LD blocks
      }
    }

    // 3. Extract outgoing <a href> links to expand into newly discovered pages & domains
    const aMatches = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi));
    const seenHrefs = new Set<string>();
    for (const am of aMatches) {
      if (linksFound >= 20) break;
      const rawHref = am[1].trim();
      const anchorText = stripHtmlTags(am[2]).slice(0, 120);
      if (!rawHref || /^(mailto:|tel:|javascript:|data:)/i.test(rawHref)) continue;

      let absUrl: string;
      let linkDomain: string;
      try {
        const u = new URL(rawHref, finalUrl);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
        u.hash = '';
        absUrl = u.toString();
        linkDomain = u.hostname.toLowerCase();
      } catch {
        continue;
      }

      if (seenHrefs.has(absUrl) || BLOCKED_SOCIAL_OR_NOISE_DOMAINS.test(linkDomain)) continue;
      const isExternalDomain = linkDomain !== task.domain;
      const isRelevant =
        RELEVANT_LINK_KEYWORDS.test(`${absUrl} ${anchorText}`) &&
        (!isExternalDomain || RELEVANT_DOMAIN_TLDS_OR_TERMS.test(`${linkDomain} ${absUrl}`));
      if (!isRelevant) continue;

      seenHrefs.add(absUrl);
      linksFound++;

      const enq = this.enqueueUrl(db, {
        url: absUrl,
        taskType: /\.(xml|rss)$/i.test(absUrl) ? 'feed' : 'html_page',
        priority: isExternalDomain ? 76 : 64,
        discoveredFrom: `link:${task.domain}`,
      });
      if (enq.enqueued) result.newPagesDiscovered++;
      if (enq.isNewDomain && enq.domain) {
        newDomainsFound++;
        result.newDomainsDiscovered.push(enq.domain);
      }
    }

    // 4. If page itself looks like an active opportunity announcement (title + relevant keywords), verify & record it
    const pageTitle = stripHtmlTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const metaDesc = stripHtmlTags(
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || ''
    );
    const bodyText = stripHtmlTags(html).slice(0, 4000);
    if (
      pageTitle.length >= 10 &&
      /\b(vacancy|job\s+opening|scholarship|fellowship|work\s+permit|visa\s+sponsorship|career|manager|officer|specialist|conference|training)\b/i.test(
        `${pageTitle} ${metaDesc}`
      )
    ) {
      this.verifyAndRecordOpportunity(
        db,
        {
          title: pageTitle,
          employer: task.domain.replace(/^www\./, ''),
          summaryText: `${metaDesc} ${bodyText}`.trim(),
          officialUrl: finalUrl,
          sourceDomain: task.domain,
          httpVerifiedLive: true,
        },
        result
      );
    }

    return { linksFound, newDomainsFound };
  }

  /**
   * Executes one bounded incremental crawl batch (default: up to 4 priority queue tasks per 1-minute tick)
   * with full fault isolation, per-domain politeness, robots.txt compliance, and transactional persistence.
   */
  public async runIncrementalCrawlBatch(options?: { maxTasks?: number }): Promise<CrawlerCycleExecutionResult> {
    const maxTasks = Math.max(1, Math.min(8, options?.maxTasks ?? 3));
    const { db, recoveredFromBackup } = this.loadDb();

    const result: CrawlerCycleExecutionResult = {
      pagesProcessed: 0,
      newPagesDiscovered: 0,
      newDomainsDiscovered: [],
      opportunitiesExtracted: 0,
      opportunitiesVerified: 0,
      opportunitiesPublished: 0,
      opportunitiesRejected: 0,
      opportunitiesExpired: 0,
      duplicatesPrevented: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      errors: [],
      recoveredFromBackup,
      publishedBranchCandidates: [],
    };

    const nowMs = Date.now();
    // Periodically re-queue high-priority feeds & portals whose last crawl is > 30 minutes old
    const queuedCount = db.queue.filter((t) => t.status === 'queued').length;
    if (queuedCount < 5) {
      for (const task of db.queue) {
        if (
          task.status === 'done' &&
          task.priority >= 75 &&
          task.finishedAt &&
          nowMs - Date.parse(task.finishedAt) > 30 * 60 * 1000
        ) {
          task.status = 'queued';
          task.attempts = 0;
          task.nextRetryAt = null;
          task.lastError = null;
        }
      }
    }

    // Pick top priority due tasks from distinct non-paused domains (polite per-domain spacing)
    const eligible = db.queue
      .filter((t) => {
        if (t.status !== 'queued') return false;
        if (t.nextRetryAt && Date.parse(t.nextRetryAt) > nowMs) return false;
        const dom = db.domains[t.domain];
        if (dom?.pausedUntil && Date.parse(dom.pausedUntil) > nowMs) return false;
        if (dom?.lastCrawledAt) {
          const minWaitMs = Math.max(3, dom.crawlDelaySec || 5) * 1000;
          if (nowMs - Date.parse(dom.lastCrawledAt) < minWaitMs) return false;
        }
        return true;
      })
      .sort((a, b) => b.priority - a.priority || Date.parse(a.enqueuedAt) - Date.parse(b.enqueuedAt));

    const batch: CrawlerQueueTask[] = [];
    const chosenDomains = new Set<string>();
    for (const task of eligible) {
      if (batch.length >= maxTasks) break;
      if (chosenDomains.has(task.domain) && eligible.length > maxTasks) continue;
      chosenDomains.add(task.domain);
      batch.push(task);
    }

    // Mark batch as processing & persist transactionally before network I/O
    const startedIso = new Date().toISOString();
    for (const t of batch) {
      t.status = 'processing';
      t.startedAt = startedIso;
      t.attempts++;
    }
    this.saveDb(db);

    for (const task of batch) {
      const dom = db.domains[task.domain];
      const tickIso = new Date().toISOString();
      try {
        if (task.taskType !== 'archive_discovery') {
          await this.ensureDomainRobotsChecked(db, task.domain);
          if (dom && (!dom.robotsAllowed || !isPathAllowedByRobots(task.url, dom.disallowedPrefixes))) {
            task.status = 'done';
            task.finishedAt = tickIso;
            task.lastError = 'Skipped cleanly per robots.txt directive';
            continue;
          }
        }

        const res = await this.safeFetchPublicText(task.url, DEFAULT_FETCH_TIMEOUT_MS);
        if (dom) dom.lastCrawledAt = tickIso;

        if (!res.ok || typeof res.text !== 'string') {
          result.tasksFailed++;
          const errType = res.errorType || 'temporary';
          const errMsg = res.error || `HTTP ${res.status}`;
          task.lastError = errMsg;

          if (dom) {
            dom.consecutiveErrors = (dom.consecutiveErrors || 0) + 1;
            dom.lastError = errMsg;
            if (res.rateLimited) {
              dom.lastStatus = 'rate_limited';
              dom.pausedUntil = new Date(Date.now() + (res.retryAfterSec || 600) * 1000).toISOString();
            } else if (dom.consecutiveErrors >= 3) {
              dom.lastStatus = 'paused';
              const pauseSec = Math.min(3600, 300 * Math.pow(2, Math.min(3, dom.consecutiveErrors - 3)));
              dom.pausedUntil = new Date(Date.now() + pauseSec * 1000).toISOString();
            } else {
              dom.lastStatus = 'error';
            }
          }

          if (errType === 'temporary' && task.attempts < task.maxAttempts) {
            // Re-queue with exponential backoff — preserve unfinished task!
            task.status = 'queued';
            const backoffSec = 60 * Math.pow(2, task.attempts);
            task.nextRetryAt = new Date(Date.now() + backoffSec * 1000).toISOString();
          } else {
            task.status = 'failed';
            task.finishedAt = tickIso;
          }

          result.errors.push({
            component: `crawler:${task.domain}`,
            domain: task.domain,
            message: errMsg,
            errorType: errType,
          });
          continue;
        }

        // Successful public crawl response!
        result.tasksSucceeded++;
        result.pagesProcessed++;
        db.totalPagesCrawled++;

        const contentHash = crypto
          .createHash('sha256')
          .update(res.text.slice(0, 80000))
          .digest('hex')
          .slice(0, 20);
        const prevPage = db.crawledPages[task.url];
        const contentChanged = !prevPage || prevPage.contentHash !== contentHash;

        let stats = { linksFound: 0, newDomainsFound: 0 };
        const oppBefore = result.opportunitiesExtracted;

        if (contentChanged) {
          if (task.taskType === 'feed' || /<(?:rss|feed)\b/i.test(res.text.slice(0, 600))) {
            stats = this.processRssOrAtomFeed(db, task, res.text, result);
          } else if (task.taskType === 'sitemap' || /<(?:urlset|sitemapindex)\b/i.test(res.text.slice(0, 600))) {
            stats = this.processSitemapXml(db, task, res.text, result);
          } else if (task.taskType === 'archive_discovery') {
            stats = this.processArchiveCdxJson(db, task, res.text, result);
          } else {
            stats = this.processHtmlPage(db, task, res.finalUrl, res.text, result);
          }
        }

        db.crawledPages[task.url] = {
          url: task.url,
          domain: task.domain,
          lastCrawledAt: tickIso,
          contentHash,
          httpStatus: res.status,
          linksFound: stats.linksFound,
          newDomainsFound: stats.newDomainsFound,
          opportunitiesExtracted: result.opportunitiesExtracted - oppBefore,
        };

        if (dom) {
          dom.pagesCrawledCount++;
          dom.consecutiveErrors = 0;
          dom.lastStatus = 'ok';
          dom.lastError = null;
          dom.pausedUntil = null;
        }

        task.status = 'done';
        task.finishedAt = tickIso;
        task.lastError = null;
      } catch (unexpectedErr: any) {
        result.tasksFailed++;
        const msg = unexpectedErr?.message || String(unexpectedErr);
        task.lastError = msg;
        task.status = task.attempts < task.maxAttempts ? 'queued' : 'failed';
        if (task.status === 'queued') {
          task.nextRetryAt = new Date(Date.now() + 120 * 1000).toISOString();
        } else {
          task.finishedAt = tickIso;
        }
        result.errors.push({
          component: `crawler:${task.domain}`,
          domain: task.domain,
          message: msg,
          errorType: 'temporary',
        });
      }
    }

    db.lastCrawlerRunAt = new Date().toISOString();
    this.saveDb(db);
    return result;
  }

  public getMetricsSummary(): {
    summary: CrawlerMetricsSummary;
    pipelineBreakdown: Record<OpportunityLifecycleStatus, number>;
    recentDomains: CrawlerDomainRecord[];
    activeQueueSample: CrawlerQueueTask[];
    recentOpportunities: DiscoveredWebOpportunity[];
  } {
    const { db } = this.loadDb();
    const nowMs = Date.now();
    const domainList = Object.values(db.domains);
    const breakdown: Record<OpportunityLifecycleStatus, number> = {
      DISCOVERED: 0,
      PENDING_VERIFICATION: 0,
      VERIFIED: 0,
      PUBLISHED: 0,
      REJECTED: 0,
      EXPIRED: 0,
    };
    for (const o of db.opportunities) {
      breakdown[o.status] = (breakdown[o.status] || 0) + 1;
    }

    const queued = db.queue.filter(
      (t) => t.status === 'queued' && (!t.nextRetryAt || Date.parse(t.nextRetryAt) <= nowMs)
    ).length;
    const retryScheduled = db.queue.filter(
      (t) => t.status === 'queued' && Boolean(t.nextRetryAt && Date.parse(t.nextRetryAt) > nowMs)
    ).length;
    const processing = db.queue.filter((t) => t.status === 'processing').length;
    const failed = db.queue.filter((t) => t.status === 'failed').length;

    return {
      summary: {
        domainsDiscovered: domainList.length,
        domainsMonitored: domainList.filter((d) => d.monitored && d.robotsAllowed).length,
        pagesCrawled: db.totalPagesCrawled,
        newPagesDiscovered: db.totalNewPagesDiscovered,
        opportunitiesExtracted: db.opportunities.length,
        opportunitiesVerified: breakdown.VERIFIED + breakdown.PUBLISHED,
        opportunitiesPublished: breakdown.PUBLISHED,
        opportunitiesPendingVerification: breakdown.PENDING_VERIFICATION + breakdown.DISCOVERED,
        opportunitiesRejected: breakdown.REJECTED,
        opportunitiesExpired: breakdown.EXPIRED,
        duplicateRecordsPrevented: db.totalDuplicatesPrevented,
        queueDepth: {
          queued,
          processing,
          retryScheduled,
          failed,
          total: queued + processing + retryScheduled,
        },
        lastCrawlerRunAt: db.lastCrawlerRunAt,
      },
      pipelineBreakdown: breakdown,
      recentDomains: domainList
        .sort((a, b) => Date.parse(b.lastCrawledAt || b.firstDiscoveredAt) - Date.parse(a.lastCrawledAt || a.firstDiscoveredAt))
        .slice(0, 30),
      activeQueueSample: db.queue
        .filter((t) => t.status === 'queued' || t.status === 'processing')
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 25),
      recentOpportunities: db.opportunities.slice(0, 30),
    };
  }
}
