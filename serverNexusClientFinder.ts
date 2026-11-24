import type { Express, Request, Response } from 'express';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';
import {
  NexusClientFinderApiResponse,
  NexusClientFinderStore,
  NexusClientLead,
  NexusContactStatus,
  NexusDashboardStats,
  NexusDiscoveryRunLog,
  NexusLeadCategory,
  NexusLeadVerificationStatus,
  NexusMessageTemplateType,
  NexusOutreachHistoryItem,
  NexusSchedulerInfo,
  NexusSearchSourceRecord,
  NexusSuppressionEntry,
} from './src/types/nexusClientFinder';
import {
  NEXUS_CATEGORY_LABELS,
  NEXUS_CONTACT_STATUS_LABELS,
  NEXUS_DAILY_TARGET,
  NEXUS_FRESHNESS_WINDOW_HOURS,
  FREE_PERSONAL_EMAIL_DOMAINS,
  classifyNexusLeadCategory,
  computeNexusLeadFingerprint,
  detectPriorityCountryAndCity,
  evaluate72HourFreshness,
  evaluateWebItRelevance,
  extractAndClassifyPublicEmails,
  extractPublicPhoneFromText,
  generateNexusProposalMessage,
  isEmailSuppressed,
} from './src/utils/nexusClientFinderEngine';

export interface RegisterNexusClientFinderDeps {
  app: Express;
  runtimeBaseDir: string;
  isVercel: boolean;
  ensureRuntimeDataDir: () => void;
  loadJsonFileSafe: <T>(filePath: string, fallback: T) => T;
  writeJsonFileAtomic: (filePath: string, data: any) => void;
  isPersistentOwnerRequest: (req: Request) => boolean;
  getRequesterEmail: (req: Request) => string | null;
  appendAuditLog: (entry: any) => void;
  getAiClient: () => Promise<any>;
}

interface RawCandidateOpportunity {
  sourceId: string;
  sourceName: string;
  title: string;
  advertiserName: string;
  advertiserType: 'person' | 'company' | 'unknown';
  rawLocation: string;
  rawText: string;
  estimatedBudget: string | null;
  publishedAt: string | number | null;
  originalSourceUrl: string;
  officialWebsiteUrl?: string | null;
  sourceVerifiedDirectly?: boolean;
  sourceHttpStatus?: number | null;
}

const VALID_CONTACT_STATUSES = new Set<NexusContactStatus>([
  'new',
  'selected',
  'ready_to_contact',
  'contacted',
  'replied',
  'interested',
  'negotiating',
  'project_won',
  'not_interested',
  'do_not_contact',
]);

const VALID_TEMPLATE_TYPES = new Set<NexusMessageTemplateType>([
  'website_development',
  'ecommerce_development',
  'business_website',
  'website_redesign',
  'follow_up',
]);

const SCHEDULER_INTERVAL_HOURS = 3;
const SCHEDULER_INTERVAL_MS = SCHEDULER_INTERVAL_HOURS * 60 * 60 * 1000;
const USER_AGENT = 'NexusClientFinderBot/1.0 (+https://hopelandjobs.tech; Public-Opportunity-Discovery)';

const DEFAULT_FREE_SOURCES: NexusSearchSourceRecord[] = [
  {
    id: 'freelancer_public_api',
    name: 'Freelancer.com Public Active Projects API',
    sourceType: 'free_public_api',
    baseUrl: 'https://www.freelancer.com/api/projects/0.1/projects/active/',
    isFree: true,
    status: 'idle',
    lastCheckedAt: null,
    lastCandidatesFound: 0,
    lastAcceptedCount: 0,
    lastError: null,
    note: '100% free public project listings filtered for priority GCC, Europe, USA, Canada & Australia markets.',
  },
  {
    id: 'wordpress_jobs_rss',
    name: 'WordPress.org Official Jobs RSS',
    sourceType: 'free_rss_feed',
    baseUrl: 'https://jobs.wordpress.net/feed/',
    isFree: true,
    status: 'idle',
    lastCheckedAt: null,
    lastCandidatesFound: 0,
    lastAcceptedCount: 0,
    lastError: null,
    note: '100% free official WordPress client and agency project feed.',
  },
  {
    id: 'himalayas_public_api',
    name: 'Himalayas Public Opportunities API',
    sourceType: 'free_public_api',
    baseUrl: 'https://himalayas.app/jobs/api',
    isFree: true,
    status: 'idle',
    lastCheckedAt: null,
    lastCandidatesFound: 0,
    lastAcceptedCount: 0,
    lastError: null,
    note: '100% free public remote tech & web engineering announcements.',
  },
  {
    id: 'arbeitnow_europe_api',
    name: 'Arbeitnow European Public Board API',
    sourceType: 'free_public_api',
    baseUrl: 'https://www.arbeitnow.com/api/job-board-api',
    isFree: true,
    status: 'idle',
    lastCheckedAt: null,
    lastCandidatesFound: 0,
    lastAcceptedCount: 0,
    lastError: null,
    note: '100% free public European technology & web development opportunities.',
  },
  {
    id: 'remotive_public_api',
    name: 'Remotive Official Public API',
    sourceType: 'free_public_api',
    baseUrl: 'https://remotive.com/api/remote-jobs',
    isFree: true,
    status: 'idle',
    lastCheckedAt: null,
    lastCandidatesFound: 0,
    lastAcceptedCount: 0,
    lastError: null,
    note: '100% free public software, web development & web design listings.',
  },
  {
    id: 'weworkremotely_rss',
    name: 'We Work Remotely Official RSS Feeds',
    sourceType: 'free_rss_feed',
    baseUrl: 'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
    isFree: true,
    status: 'idle',
    lastCheckedAt: null,
    lastCandidatesFound: 0,
    lastAcceptedCount: 0,
    lastError: null,
    note: '100% free public front-end, full-stack & design RSS feeds.',
  },
  {
    id: 'remoteok_public_api',
    name: 'RemoteOK Public JSON Feed',
    sourceType: 'free_public_api',
    baseUrl: 'https://remoteok.com/api',
    isFree: true,
    status: 'idle',
    lastCheckedAt: null,
    lastCandidatesFound: 0,
    lastAcceptedCount: 0,
    lastError: null,
    note: '100% free public web development and digital product listings.',
  },
  {
    id: 'hn_algolia_public_api',
    name: 'Hacker News Official Public Community API',
    sourceType: 'public_community_api',
    baseUrl: 'https://hn.algolia.com/api/v1/search_by_date',
    isFree: true,
    status: 'idle',
    lastCheckedAt: null,
    lastCandidatesFound: 0,
    lastAcceptedCount: 0,
    lastError: null,
    note: '100% free public founder/company posts often containing public business emails and websites.',
  },
];

// ============================================================================
// SSRF-SAFE PUBLIC NETWORKING, ROBOTS.TXT, AND DNS MX VERIFICATION
// ============================================================================

const robotsCache = new Map<string, { fetchedAt: number; disallowPaths: string[] }>();
const mxCache = new Map<string, { checkedAt: number; hasMx: boolean }>();

function isPrivateOrBlockedIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (net.isIPv4(v4)) {
    const parts = v4.split('.').map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  return false;
}

async function validatePublicSafeUrl(rawUrl: string): Promise<URL | null> {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === 'metadata.google.internal'
    ) {
      return null;
    }
    if (net.isIP(host)) {
      if (isPrivateOrBlockedIp(host)) return null;
      return parsed;
    }
    try {
      const resolved = await dns.lookup(host, { all: true });
      if (!resolved.length) return null;
      if (resolved.some((r) => isPrivateOrBlockedIp(r.address))) return null;
    } catch {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function safePublicFetch(
  rawUrl: string,
  options: { timeoutMs?: number; accept?: string } = {}
): Promise<{ ok: boolean; status: number; text: string; finalUrl: string } | null> {
  const safeUrl = await validatePublicSafeUrl(rawUrl);
  if (!safeUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 9000);
  try {
    const resp = await fetch(safeUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: options.accept || 'application/json, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
      },
    });
    // Ensure final redirected URL is also public/safe
    if (resp.url && resp.url !== safeUrl.toString()) {
      const finalCheck = await validatePublicSafeUrl(resp.url);
      if (!finalCheck) return null;
    }
    const text = (await resp.text()).slice(0, 350_000);
    return {
      ok: resp.ok,
      status: resp.status,
      text,
      finalUrl: resp.url || safeUrl.toString(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function isRobotsAllowed(rawUrl: string): Promise<boolean> {
  try {
    const parsed = await validatePublicSafeUrl(rawUrl);
    if (!parsed) return false;
    const origin = parsed.origin;
    const now = Date.now();
    let cached = robotsCache.get(origin);
    if (!cached || now - cached.fetchedAt > 6 * 3600 * 1000) {
      const disallowPaths: string[] = [];
      const resp = await safePublicFetch(`${origin}/robots.txt`, {
        timeoutMs: 4500,
        accept: 'text/plain,*/*',
      });
      if (resp && resp.ok && resp.text) {
        const lines = resp.text.split(/\r?\n/);
        let appliesToAll = false;
        for (const rawLine of lines) {
          const line = rawLine.split('#')[0].trim();
          if (!line) continue;
          const uaMatch = line.match(/^user-agent:\s*(.+)$/i);
          if (uaMatch) {
            const ua = uaMatch[1].trim().toLowerCase();
            appliesToAll = ua === '*' || ua.includes('nexusclientfinderbot');
            continue;
          }
          if (appliesToAll) {
            const disMatch = line.match(/^disallow:\s*(.*)$/i);
            if (disMatch) {
              const p = disMatch[1].trim();
              if (p) disallowPaths.push(p);
            }
          }
        }
      }
      cached = { fetchedAt: now, disallowPaths };
      robotsCache.set(origin, cached);
    }

    const reqPath = parsed.pathname || '/';
    for (const dis of cached.disallowPaths) {
      if (dis === '/') return false;
      if (reqPath.startsWith(dis)) return false;
    }
    return true;
  } catch {
    return true;
  }
}

async function verifyDomainHasMx(domain: string): Promise<boolean> {
  const clean = domain.trim().toLowerCase();
  if (!clean || !clean.includes('.')) return false;
  const now = Date.now();
  const cached = mxCache.get(clean);
  if (cached && now - cached.checkedAt < 12 * 3600 * 1000) {
    return cached.hasMx;
  }
  try {
    const records = await Promise.race([
      dns.resolveMx(clean),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('MX timeout')), 3500)),
    ]);
    const hasMx = Array.isArray(records) && records.length > 0;
    mxCache.set(clean, { checkedAt: now, hasMx });
    return hasMx;
  } catch {
    mxCache.set(clean, { checkedAt: now, hasMx: false });
    return false;
  }
}

// ============================================================================
// TEXT & HTML HELPERS
// ============================================================================

function stripHtmlToPlainText(input: string): string {
  return String(input || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractXmlTag(block: string, tag: string): string {
  const rx = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(rx);
  return m ? stripHtmlToPlainText(m[1]) : '';
}

function extractProjectRequirements(title: string, description: string, matchedKeywords: string[]): string[] {
  const reqs: string[] = [...matchedKeywords];
  const text = `${title} ${description}`;
  const techChecks: Array<[string, RegExp]> = [
    ['Shopify', /\bshopify\b/i],
    ['WooCommerce', /\bwoocommerce\b/i],
    ['WordPress', /\bwordpress\b/i],
    ['Elementor', /\belementor\b/i],
    ['Webflow', /\bwebflow\b/i],
    ['React / Next.js', /\b(react|next\.?js)\b/i],
    ['Node.js / TypeScript', /\b(node\.?js|typescript)\b/i],
    ['Laravel / PHP', /\b(laravel|php)\b/i],
    ['Figma to Code', /\bfigma\b/i],
    ['SEO & Speed Optimization', /\b(seo|page\s*speed|core\s*web\s*vitals)\b/i],
    ['Payment Gateway / Checkout', /\b(stripe|paypal|checkout|payment\s+gateway)\b/i],
    ['Responsive Mobile UI', /\b(responsive|mobile[\s-]first|mobile\s+friendly)\b/i],
    ['Multi-language / Arabic-English', /\b(arabic|bilingual|multilingual|rtl)\b/i],
  ];
  for (const [label, rx] of techChecks) {
    if (rx.test(text) && !reqs.includes(label)) {
      reqs.push(label);
    }
  }
  return reqs.slice(0, 6);
}

const PLATFORM_HOSTS_TO_IGNORE_AS_COMPANY_SITE = new Set<string>([
  'freelancer.com',
  'www.freelancer.com',
  'jobs.wordpress.net',
  'wordpress.org',
  'himalayas.app',
  'arbeitnow.com',
  'www.arbeitnow.com',
  'remotive.com',
  'weworkremotely.com',
  'remoteok.com',
  'news.ycombinator.com',
  'github.com',
  'linkedin.com',
  'www.linkedin.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'youtube.com',
  't.me',
  'docs.google.com',
  'forms.gle',
  'calendly.com',
  'bit.ly',
  'tinyurl.com',
  'lever.co',
  'greenhouse.io',
  'ashbyhq.com',
  'workable.com',
]);

function extractExternalCompanyWebsiteFromText(rawText: string, emailDomain?: string | null): string | null {
  const urlMatches = String(rawText || '').match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s"'<>)]*)?/g) || [];
  for (const raw of urlMatches) {
    const cleaned = raw.replace(/[.,;:)>\]]+$/, '');
    try {
      const parsed = new URL(cleaned);
      const host = parsed.hostname.toLowerCase();
      if (PLATFORM_HOSTS_TO_IGNORE_AS_COMPANY_SITE.has(host)) continue;
      if (/\.(png|jpg|jpeg|gif|svg|pdf|zip)$/i.test(parsed.pathname)) continue;
      return `${parsed.protocol}//${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
    } catch {}
  }

  if (emailDomain && !FREE_PERSONAL_EMAIL_DOMAINS.has(emailDomain.toLowerCase()) && !PLATFORM_HOSTS_TO_IGNORE_AS_COMPANY_SITE.has(emailDomain.toLowerCase())) {
    return `https://${emailDomain.toLowerCase()}`;
  }
  return null;
}

// ============================================================================
// 8 VERIFIED 100% FREE PUBLIC SOURCE CONNECTORS
// ============================================================================

async function fetchFreelancerPublicProjects(): Promise<{ candidates: RawCandidateOpportunity[]; error: string | null }> {
  const queries = [
    'website development',
    'wordpress website',
    'ecommerce shopify woocommerce',
    'website redesign landing page',
  ];
  const priorityCountryParams = [
    'ae', 'sa', 'qa', 'kw', 'bh', 'om',
    'gb', 'de', 'fr', 'nl', 'ie', 'se', 'no', 'dk',
    'us', 'ca', 'au',
  ]
    .map((c) => `countries[]=${c}`)
    .join('&');

  const candidates: RawCandidateOpportunity[] = [];
  const seenIds = new Set<number>();
  const errors: string[] = [];

  for (const q of queries) {
    const url = `https://www.freelancer.com/api/projects/0.1/projects/active/?query=${encodeURIComponent(
      q
    )}&limit=30&full_description=true&user_details=true&${priorityCountryParams}`;
    const resp = await safePublicFetch(url, { timeoutMs: 9000, accept: 'application/json' });
    if (!resp || !resp.ok) {
      errors.push(`Freelancer query "${q}" failed (${resp?.status ?? 'network'})`);
      continue;
    }
    try {
      const json = JSON.parse(resp.text);
      const projects = json?.result?.projects || [];
      const usersMap = json?.result?.users || {};
      for (const p of projects) {
        if (!p || !p.id || seenIds.has(p.id)) continue;
        seenIds.add(p.id);
        const owner = p.owner_id ? usersMap[String(p.owner_id)] : null;
        const countryName = owner?.location?.country?.name || '';
        const cityName = owner?.location?.city || '';
        const rawLocation = [cityName, countryName].filter(Boolean).join(', ');
        const minB = p?.budget?.minimum;
        const maxB = p?.budget?.maximum;
        const curr = p?.currency?.code || 'USD';
        const estimatedBudget =
          minB || maxB
            ? `${curr} ${minB ?? ''}${minB && maxB ? ' - ' : ''}${maxB ?? ''}`.trim()
            : null;
        const seoUrl = p.seo_url ? `https://www.freelancer.com/projects/${p.seo_url}` : `https://www.freelancer.com/projects/${p.id}`;
        const advertiserName =
          owner?.company ||
          owner?.public_name ||
          owner?.username ||
          'Public Client Advertiser';

        candidates.push({
          sourceId: 'freelancer_public_api',
          sourceName: 'Freelancer.com Public Projects',
          title: String(p.title || '').trim(),
          advertiserName: String(advertiserName).trim(),
          advertiserType: owner?.company ? 'company' : 'person',
          rawLocation,
          rawText: stripHtmlToPlainText(p.description || p.preview_description || p.title || ''),
          estimatedBudget,
          publishedAt: p.time_submitted || p.submitdate || null,
          originalSourceUrl: seoUrl,
          sourceVerifiedDirectly: true,
          sourceHttpStatus: resp.status,
        });
      }
    } catch (err: any) {
      errors.push(`Freelancer JSON parse error: ${err?.message || 'unknown'}`);
    }
  }

  return {
    candidates,
    error: candidates.length === 0 && errors.length > 0 ? errors.join('; ') : null,
  };
}

async function fetchWordPressJobsRss(): Promise<{ candidates: RawCandidateOpportunity[]; error: string | null }> {
  const resp = await safePublicFetch('https://jobs.wordpress.net/feed/', {
    timeoutMs: 9000,
    accept: 'application/rss+xml, application/xml, text/xml',
  });
  if (!resp || !resp.ok) {
    return { candidates: [], error: `WordPress Jobs RSS returned ${resp?.status ?? 'network error'}` };
  }
  const items = resp.text.match(/<item>[\s\S]*?<\/item>/gi) || [];
  const candidates: RawCandidateOpportunity[] = [];
  for (const item of items) {
    const title = extractXmlTag(item, 'title');
    const link = extractXmlTag(item, 'link');
    const pubDate = extractXmlTag(item, 'pubDate');
    const description = extractXmlTag(item, 'content:encoded') || extractXmlTag(item, 'description');
    const creator = extractXmlTag(item, 'dc:creator') || 'WordPress Project Poster';
    if (!title || !link) continue;
    const budgetMatch = description.match(/(?:budget|rate|pay|compensation)\s*[:\-]?\s*(\$|€|£|USD|EUR|GBP|AED)\s?[\d,]+(?:\s*[-–to]+\s*(?:\$|€|£|USD|EUR|GBP|AED)?\s?[\d,]+)?/i);
    candidates.push({
      sourceId: 'wordpress_jobs_rss',
      sourceName: 'WordPress.org Official Jobs',
      title,
      advertiserName: creator,
      advertiserType: 'company',
      rawLocation: '',
      rawText: description,
      estimatedBudget: budgetMatch ? budgetMatch[0].slice(0, 60) : null,
      publishedAt: pubDate || null,
      originalSourceUrl: link,
      sourceVerifiedDirectly: true,
      sourceHttpStatus: resp.status,
    });
  }
  return { candidates, error: null };
}

async function fetchHimalayasPublicApi(): Promise<{ candidates: RawCandidateOpportunity[]; error: string | null }> {
  const resp = await safePublicFetch('https://himalayas.app/jobs/api?limit=60', {
    timeoutMs: 9000,
    accept: 'application/json',
  });
  if (!resp || !resp.ok) {
    return { candidates: [], error: `Himalayas API returned ${resp?.status ?? 'network error'}` };
  }
  try {
    const json = JSON.parse(resp.text);
    const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
    const candidates: RawCandidateOpportunity[] = jobs.map((j: any) => {
      const loc = Array.isArray(j.locationRestrictions) && j.locationRestrictions.length > 0
        ? j.locationRestrictions.join(', ')
        : 'Remote / International';
      const budget =
        j.minSalary || j.maxSalary
          ? `${j.currency || 'USD'} ${j.minSalary ?? ''}${j.minSalary && j.maxSalary ? ' - ' : ''}${j.maxSalary ?? ''}`.trim()
          : null;
      return {
        sourceId: 'himalayas_public_api',
        sourceName: 'Himalayas Public Board',
        title: String(j.title || '').trim(),
        advertiserName: String(j.companyName || 'Company Advertiser').trim(),
        advertiserType: 'company',
        rawLocation: loc,
        rawText: stripHtmlToPlainText(j.description || j.excerpt || ''),
        estimatedBudget: budget,
        publishedAt: j.pubDate || null,
        originalSourceUrl: String(j.guid || j.applicationLink || '').trim(),
        officialWebsiteUrl: typeof j.applicationLink === 'string' ? j.applicationLink : null,
        sourceVerifiedDirectly: true,
        sourceHttpStatus: resp.status,
      };
    }).filter((c: RawCandidateOpportunity) => Boolean(c.title && c.originalSourceUrl));
    return { candidates, error: null };
  } catch (err: any) {
    return { candidates: [], error: `Himalayas JSON parse error: ${err?.message || 'unknown'}` };
  }
}

async function fetchArbeitnowEuropeApi(): Promise<{ candidates: RawCandidateOpportunity[]; error: string | null }> {
  const resp = await safePublicFetch('https://www.arbeitnow.com/api/job-board-api', {
    timeoutMs: 9000,
    accept: 'application/json',
  });
  if (!resp || !resp.ok) {
    return { candidates: [], error: `Arbeitnow API returned ${resp?.status ?? 'network error'}` };
  }
  try {
    const json = JSON.parse(resp.text);
    const data = Array.isArray(json?.data) ? json.data : [];
    const candidates: RawCandidateOpportunity[] = data.slice(0, 80).map((j: any) => ({
      sourceId: 'arbeitnow_europe_api',
      sourceName: 'Arbeitnow Europe Public Board',
      title: String(j.title || '').trim(),
      advertiserName: String(j.company_name || 'European Company').trim(),
      advertiserType: 'company',
      rawLocation: String(j.location || 'Germany / Europe').trim(),
      rawText: stripHtmlToPlainText(j.description || ''),
      estimatedBudget: null,
      publishedAt: j.created_at || null,
      originalSourceUrl: String(j.url || '').trim(),
      sourceVerifiedDirectly: true,
      sourceHttpStatus: resp.status,
    })).filter((c: RawCandidateOpportunity) => Boolean(c.title && c.originalSourceUrl));
    return { candidates, error: null };
  } catch (err: any) {
    return { candidates: [], error: `Arbeitnow JSON parse error: ${err?.message || 'unknown'}` };
  }
}

async function fetchRemotivePublicApi(): Promise<{ candidates: RawCandidateOpportunity[]; error: string | null }> {
  const urls = [
    'https://remotive.com/api/remote-jobs?category=software-dev&limit=40',
    'https://remotive.com/api/remote-jobs?category=design&limit=25',
  ];
  const candidates: RawCandidateOpportunity[] = [];
  const errors: string[] = [];

  for (const url of urls) {
    const resp = await safePublicFetch(url, { timeoutMs: 9000, accept: 'application/json' });
    if (!resp || !resp.ok) {
      errors.push(`Remotive returned ${resp?.status ?? 'network error'}`);
      continue;
    }
    try {
      const json = JSON.parse(resp.text);
      const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
      for (const j of jobs) {
        if (!j?.title || !j?.url) continue;
        candidates.push({
          sourceId: 'remotive_public_api',
          sourceName: 'Remotive Public Listings',
          title: String(j.title).trim(),
          advertiserName: String(j.company_name || 'Company Advertiser').trim(),
          advertiserType: 'company',
          rawLocation: String(j.candidate_required_location || '').trim(),
          rawText: stripHtmlToPlainText(j.description || ''),
          estimatedBudget: j.salary ? String(j.salary).trim().slice(0, 60) : null,
          publishedAt: j.publication_date || null,
          originalSourceUrl: String(j.url).trim(),
          sourceVerifiedDirectly: true,
          sourceHttpStatus: resp.status,
        });
      }
    } catch (err: any) {
      errors.push(`Remotive parse error: ${err?.message || 'unknown'}`);
    }
  }
  return { candidates, error: candidates.length === 0 && errors.length ? errors.join('; ') : null };
}

async function fetchWeWorkRemotelyRss(): Promise<{ candidates: RawCandidateOpportunity[]; error: string | null }> {
  const feeds = [
    'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
    'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
    'https://weworkremotely.com/categories/remote-design-jobs.rss',
  ];
  const candidates: RawCandidateOpportunity[] = [];
  const errors: string[] = [];

  for (const feedUrl of feeds) {
    const resp = await safePublicFetch(feedUrl, {
      timeoutMs: 9000,
      accept: 'application/rss+xml, application/xml, text/xml',
    });
    if (!resp || !resp.ok) {
      errors.push(`WeWorkRemotely RSS returned ${resp?.status ?? 'network error'}`);
      continue;
    }
    const items = resp.text.match(/<item>[\s\S]*?<\/item>/gi) || [];
    for (const item of items.slice(0, 25)) {
      const rawTitle = extractXmlTag(item, 'title');
      const link = extractXmlTag(item, 'link');
      const pubDate = extractXmlTag(item, 'pubDate');
      const description = extractXmlTag(item, 'description');
      const region = extractXmlTag(item, 'region');
      if (!rawTitle || !link) continue;
      let advertiserName = 'Company Advertiser';
      let cleanTitle = rawTitle;
      if (rawTitle.includes(':')) {
        const idx = rawTitle.indexOf(':');
        advertiserName = rawTitle.slice(0, idx).trim() || advertiserName;
        cleanTitle = rawTitle.slice(idx + 1).trim() || rawTitle;
      }
      candidates.push({
        sourceId: 'weworkremotely_rss',
        sourceName: 'We Work Remotely RSS',
        title: cleanTitle,
        advertiserName,
        advertiserType: 'company',
        rawLocation: region || '',
        rawText: description,
        estimatedBudget: null,
        publishedAt: pubDate || null,
        originalSourceUrl: link,
        sourceVerifiedDirectly: true,
        sourceHttpStatus: resp.status,
      });
    }
  }
  return { candidates, error: candidates.length === 0 && errors.length ? errors.join('; ') : null };
}

async function fetchRemoteOkApi(): Promise<{ candidates: RawCandidateOpportunity[]; error: string | null }> {
  const resp = await safePublicFetch('https://remoteok.com/api', {
    timeoutMs: 9000,
    accept: 'application/json',
  });
  if (!resp || !resp.ok) {
    return { candidates: [], error: `RemoteOK API returned ${resp?.status ?? 'network error'}` };
  }
  try {
    const json = JSON.parse(resp.text);
    const rows = Array.isArray(json) ? json.slice(1, 60) : [];
    const candidates: RawCandidateOpportunity[] = rows
      .filter((r: any) => r && r.position && (r.url || r.apply_url))
      .map((r: any) => {
        const budget =
          r.salary_min || r.salary_max
            ? `USD ${r.salary_min ?? ''}${r.salary_min && r.salary_max ? ' - ' : ''}${r.salary_max ?? ''}`.trim()
            : null;
        return {
          sourceId: 'remoteok_public_api',
          sourceName: 'RemoteOK Public API',
          title: String(r.position).trim(),
          advertiserName: String(r.company || 'Company Advertiser').trim(),
          advertiserType: 'company',
          rawLocation: String(r.location || '').trim(),
          rawText: stripHtmlToPlainText(r.description || ''),
          estimatedBudget: budget,
          publishedAt: r.date || r.epoch || null,
          originalSourceUrl: String(r.url || r.apply_url).trim(),
          officialWebsiteUrl: typeof r.apply_url === 'string' && !r.apply_url.includes('remoteok.com') ? r.apply_url : null,
          sourceVerifiedDirectly: true,
          sourceHttpStatus: resp.status,
        };
      });
    return { candidates, error: null };
  } catch (err: any) {
    return { candidates: [], error: `RemoteOK parse error: ${err?.message || 'unknown'}` };
  }
}

async function fetchHackerNewsPublicCommunity(): Promise<{ candidates: RawCandidateOpportunity[]; error: string | null }> {
  const minEpochSec = Math.floor((Date.now() - NEXUS_FRESHNESS_WINDOW_HOURS * 3600 * 1000) / 1000);
  const queries = [
    'hiring web developer website',
    'need website wordpress shopify ecommerce',
  ];
  const candidates: RawCandidateOpportunity[] = [];
  const seenIds = new Set<string>();
  const errors: string[] = [];

  for (const q of queries) {
    const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(
      q
    )}&tags=(comment,story)&numericFilters=created_at_i>${minEpochSec}&hitsPerPage=35`;
    const resp = await safePublicFetch(url, { timeoutMs: 9000, accept: 'application/json' });
    if (!resp || !resp.ok) {
      errors.push(`HN Algolia query "${q}" failed (${resp?.status ?? 'network'})`);
      continue;
    }
    try {
      const json = JSON.parse(resp.text);
      const hits = Array.isArray(json?.hits) ? json.hits : [];
      for (const hit of hits) {
        const oid = String(hit.objectID || '');
        if (!oid || seenIds.has(oid)) continue;
        seenIds.add(oid);
        const body = stripHtmlToPlainText(hit.comment_text || hit.story_text || '');
        const rawTitle = String(hit.title || hit.story_title || '').trim();
        // Only treat as client/hiring request when explicit need/hiring intent exists
        const combined = `${rawTitle} ${body}`;
        if (!/\b(hiring|looking\s+for|need\s+a|seeking|freelance|contractor|build\s+(?:a|our)\s+website|web\s+developer|redesign|wordpress|shopify|e-?commerce)\b/i.test(combined)) {
          continue;
        }
        const firstLine = body.split('\n')[0]?.trim() || '';
        const computedTitle =
          rawTitle && rawTitle.length >= 12
            ? rawTitle
            : firstLine.slice(0, 110) || 'Public Web / IT Project Request';
        const advertiserName =
          firstLine.includes('|')
            ? firstLine.split('|')[0].trim().slice(0, 50)
            : String(hit.author || 'Public Community Advertiser');

        candidates.push({
          sourceId: 'hn_algolia_public_api',
          sourceName: 'Hacker News Public Community',
          title: computedTitle,
          advertiserName,
          advertiserType: /\b(inc|ltd|llc|gmbh|studio|labs|io|company|team|we\s+are)\b/i.test(body) ? 'company' : 'person',
          rawLocation: firstLine.slice(0, 120),
          rawText: body,
          estimatedBudget: null,
          publishedAt: hit.created_at || hit.created_at_i || null,
          originalSourceUrl: `https://news.ycombinator.com/item?id=${oid}`,
          sourceVerifiedDirectly: true,
          sourceHttpStatus: resp.status,
        });
      }
    } catch (err: any) {
      errors.push(`HN Algolia parse error: ${err?.message || 'unknown'}`);
    }
  }
  return { candidates, error: candidates.length === 0 && errors.length ? errors.join('; ') : null };
}

// ============================================================================
// CONTACT ENRICHMENT (ROBOTS-RESPECTING, ZERO FABRICATION, DNS MX CHECK)
// ============================================================================

async function enrichPublicContactAndVerifyUrl(
  candidate: RawCandidateOpportunity,
  options: { allowDeepWebsiteContactLookup: boolean }
): Promise<{
  publicEmail: string | null;
  emailClassification: NexusClientLead['emailClassification'];
  emailDomain: string | null;
  emailMxVerified: boolean;
  emailEvidenceSource: string | null;
  officialWebsiteUrl: string | null;
  publicContactPageUrl: string | null;
  publicPhone: string | null;
  sourceHttpStatus: number | null;
  robotsAllowed: boolean;
  isActive: boolean;
  verificationStatus: NexusLeadVerificationStatus;
  verificationNotes: string;
  attemptedDeepLookup: boolean;
}> {
  let combinedContactText = `${candidate.title}\n${candidate.rawText}`;
  let officialWebsiteUrl =
    candidate.officialWebsiteUrl || extractExternalCompanyWebsiteFromText(candidate.rawText, null);
  let publicContactPageUrl: string | null = null;
  let emailEvidenceSource: string | null = null;
  let sourceHttpStatus = candidate.sourceHttpStatus ?? null;
  let robotsAllowed = true;
  let isActive = true;

  // Step 1: Check initial text from original public listing
  let initialExtract = extractAndClassifyPublicEmails(combinedContactText, officialWebsiteUrl);
  if (initialExtract.email) {
    emailEvidenceSource = `Original public listing (${candidate.sourceName})`;
    if (!officialWebsiteUrl && initialExtract.domain) {
      officialWebsiteUrl = extractExternalCompanyWebsiteFromText('', initialExtract.domain);
    }
  }

  // Step 2: If no email found yet AND we have a real external company website, politely check its public homepage & /contact page (respecting robots.txt)
  let attemptedDeepLookup = false;
  if (!initialExtract.email && options.allowDeepWebsiteContactLookup && officialWebsiteUrl) {
    attemptedDeepLookup = true;
    try {
      const siteUrl = await validatePublicSafeUrl(officialWebsiteUrl);
      if (siteUrl && !PLATFORM_HOSTS_TO_IGNORE_AS_COMPANY_SITE.has(siteUrl.hostname.toLowerCase())) {
        const homeAllowed = await isRobotsAllowed(siteUrl.toString());
        if (homeAllowed) {
          const homeResp = await safePublicFetch(siteUrl.toString(), {
            timeoutMs: 2800,
            accept: 'text/html,application/xhtml+xml',
          });
          if (homeResp && homeResp.ok && homeResp.text) {
            const plainHome = stripHtmlToPlainText(homeResp.text);
            const fromHome = extractAndClassifyPublicEmails(homeResp.text + '\n' + plainHome, siteUrl.origin);
            if (fromHome.email) {
              initialExtract = fromHome;
              combinedContactText += '\n' + plainHome;
              publicContactPageUrl = homeResp.finalUrl;
              emailEvidenceSource = `Official public website (${homeResp.finalUrl})`;
            } else {
              // Check /contact page politely
              const contactUrl = `${siteUrl.origin}/contact`;
              const contactAllowed = await isRobotsAllowed(contactUrl);
              if (contactAllowed) {
                const contactResp = await safePublicFetch(contactUrl, {
                  timeoutMs: 2500,
                  accept: 'text/html,application/xhtml+xml',
                });
                if (contactResp && contactResp.ok && contactResp.text) {
                  const plainContact = stripHtmlToPlainText(contactResp.text);
                  const fromContact = extractAndClassifyPublicEmails(contactResp.text + '\n' + plainContact, siteUrl.origin);
                  if (fromContact.email) {
                    initialExtract = fromContact;
                    combinedContactText += '\n' + plainContact;
                    publicContactPageUrl = contactResp.finalUrl;
                    emailEvidenceSource = `Official company contact page (${contactResp.finalUrl})`;
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      // Never fail discovery if an external company site is slow or offline
    }
  }

  // Step 3: Verify DNS MX record for any discovered email domain
  const mxVerifiedDomains = new Set<string>();
  if (initialExtract.domain) {
    const hasMx = await verifyDomainHasMx(initialExtract.domain);
    if (hasMx) mxVerifiedDomains.add(initialExtract.domain);
  }

  // Re-classify with live DNS MX truth
  const finalEmail = extractAndClassifyPublicEmails(
    initialExtract.email || '',
    officialWebsiteUrl,
    mxVerifiedDomains
  );
  const publicPhone = extractPublicPhoneFromText(combinedContactText);

  // Determine honest verification status
  let verificationStatus: NexusLeadVerificationStatus = 'partially_verified';
  let verificationNotes = '';

  if (sourceHttpStatus && sourceHttpStatus >= 200 && sourceHttpStatus < 400) {
    if (finalEmail.classification === 'verified_business_email') {
      verificationStatus = 'verified';
      verificationNotes = `Original public source active (HTTP ${sourceHttpStatus}) within 72h; public business email verified via DNS MX/domain match.`;
    } else if (finalEmail.email) {
      verificationStatus = 'verified';
      verificationNotes = `Original public source active (HTTP ${sourceHttpStatus}) within 72h; public contact email extracted (${finalEmail.classification}).`;
    } else {
      verificationStatus = 'partially_verified';
      verificationNotes = `Original public source active (HTTP ${sourceHttpStatus}) within 72h; no public email posted on listing (use original source link to contact directly).`;
    }
  } else {
    verificationStatus = 'pending';
    verificationNotes = 'Discovered within 72h; awaiting next live URL verification check.';
  }

  return {
    publicEmail: finalEmail.email,
    emailClassification: finalEmail.classification,
    emailDomain: finalEmail.domain,
    emailMxVerified: finalEmail.mxVerified,
    emailEvidenceSource: finalEmail.email ? emailEvidenceSource : null,
    officialWebsiteUrl,
    publicContactPageUrl,
    publicPhone,
    sourceHttpStatus,
    robotsAllowed,
    isActive,
    verificationStatus,
    verificationNotes,
    attemptedDeepLookup,
  };
}

// ============================================================================
// MAIN ROUTE REGISTRATION & ISOLATED SCHEDULER
// ============================================================================

export function registerNexusClientFinderRoutes(deps: RegisterNexusClientFinderDeps) {
  const {
    app,
    runtimeBaseDir,
    isVercel,
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    isPersistentOwnerRequest,
    getRequesterEmail,
    appendAuditLog,
    getAiClient,
  } = deps;

  const STORE_PATH = path.join(runtimeBaseDir, 'data', 'nexus_client_finder_store.json');

  let isDiscoveryRunning = false;
  let lastRunAt: string | null = null;
  let nextRunAt: string | null = null;
  let lastRunStatus: string | null = null;

  function loadStore(): NexusClientFinderStore {
    ensureRuntimeDataDir();
    const fallback: NexusClientFinderStore = {
      leads: [],
      suppressionList: [],
      sources: DEFAULT_FREE_SOURCES.map((s) => ({ ...s })),
      runLogs: [],
      lastUpdatedAt: null,
    };
    const loaded = loadJsonFileSafe<Partial<NexusClientFinderStore>>(STORE_PATH, fallback);
    const mergedSources = DEFAULT_FREE_SOURCES.map((def) => {
      const existing = Array.isArray(loaded.sources) ? loaded.sources.find((s) => s.id === def.id) : null;
      return existing ? { ...def, ...existing, isFree: true as const } : { ...def };
    });
    return {
      leads: Array.isArray(loaded.leads) ? loaded.leads : [],
      suppressionList: Array.isArray(loaded.suppressionList) ? loaded.suppressionList : [],
      sources: mergedSources,
      runLogs: Array.isArray(loaded.runLogs) ? loaded.runLogs : [],
      lastUpdatedAt: loaded.lastUpdatedAt || null,
    };
  }

  function saveStore(store: NexusClientFinderStore) {
    ensureRuntimeDataDir();
    store.lastUpdatedAt = new Date().toISOString();
    // Keep reasonable archive cap while never discarding contacted/won/interested leads
    if (store.leads.length > 1500) {
      const protectedLeads = store.leads.filter((l) => l.contactStatus !== 'new' || l.contactCount > 0);
      const freshNew = store.leads
        .filter((l) => l.contactStatus === 'new' && l.contactCount === 0)
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
        .slice(0, Math.max(400, 1500 - protectedLeads.length));
      store.leads = [...protectedLeads, ...freshNew];
    }
    if (store.runLogs.length > 50) {
      store.runLogs = store.runLogs.slice(0, 50);
    }
    writeJsonFileAtomic(STORE_PATH, store);
  }

  function requireOwnerAdmin(req: Request, res: Response): boolean {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Nexus IT Solutions Global Client Finder is strictly restricted to Admin / Developer access only.',
      });
      return false;
    }
    return true;
  }

  function refreshLeadFreshnessAndSuppression(store: NexusClientFinderStore): void {
    const nowMs = Date.now();
    for (const lead of store.leads) {
      const f = evaluate72HourFreshness(lead.publishedAt, nowMs);
      lead.within72Hours = f.within72Hours;
      if (!f.within72Hours && lead.verificationStatus !== 'rejected') {
        lead.verificationStatus = 'expired';
        lead.isActive = false;
      }
      lead.suppressed =
        lead.contactStatus === 'do_not_contact' ||
        isEmailSuppressed(lead.publicEmail, store.suppressionList);
    }
  }

  function computeDashboardStats(store: NexusClientFinderStore): NexusDashboardStats {
    const now = new Date();
    const todayPrefix = now.toISOString().slice(0, 10);

    const activeLeads = store.leads.filter(
      (l) => l.within72Hours && l.isActive && l.verificationStatus !== 'rejected' && l.verificationStatus !== 'expired'
    );
    const discoveredTodayCount = activeLeads.filter((l) => l.discoveredAt.startsWith(todayPrefix)).length;
    const verifiedCount = activeLeads.filter((l) => l.verificationStatus === 'verified').length;
    const partiallyVerifiedCount = activeLeads.filter((l) => l.verificationStatus === 'partially_verified').length;
    const pendingCount = activeLeads.filter((l) => l.verificationStatus === 'pending').length;
    const expiredCount = store.leads.filter((l) => l.verificationStatus === 'expired' || !l.within72Hours).length;
    const latestRun = store.runLogs[0];
    const rejectedCount =
      store.leads.filter((l) => l.verificationStatus === 'rejected').length +
      (latestRun ? latestRun.rejectedExpiredOrOver72hCount + latestRun.rejectedIrrelevantOrFakeCount : 0);

    const verifiedBusinessEmailsCount = activeLeads.filter(
      (l) => l.emailClassification === 'verified_business_email'
    ).length;
    const availableBusinessEmailsCount = activeLeads.filter(
      (l) => l.emailClassification === 'verified_business_email' || l.emailClassification === 'unverified_business_email'
    ).length;
    const personalEmailsCount = activeLeads.filter((l) => l.emailClassification === 'personal_email').length;

    const newOpportunitiesCount = activeLeads.filter((l) => l.contactStatus === 'new').length;
    const alreadyContactedCount = activeLeads.filter(
      (l) =>
        l.contactCount > 0 ||
        ['contacted', 'replied', 'interested', 'negotiating', 'project_won'].includes(l.contactStatus)
    ).length;
    const awaitingContactCount = activeLeads.filter(
      (l) =>
        !l.suppressed &&
        l.contactCount === 0 &&
        ['new', 'selected', 'ready_to_contact'].includes(l.contactStatus)
    ).length;

    const countryMap = new Map<string, number>();
    const categoryMap = new Map<NexusLeadCategory, number>();
    const dateMap = new Map<string, number>();

    for (const l of activeLeads) {
      countryMap.set(l.country, (countryMap.get(l.country) || 0) + 1);
      categoryMap.set(l.category, (categoryMap.get(l.category) || 0) + 1);
      const pubDay = (l.publishedAt || '').slice(0, 10) || 'Unknown';
      dateMap.set(pubDay, (dateMap.get(pubDay) || 0) + 1);
    }

    const byCountry = Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    const byCategory = (Object.keys(NEXUS_CATEGORY_LABELS) as NexusLeadCategory[])
      .map((category) => ({
        category,
        label: NEXUS_CATEGORY_LABELS[category],
        count: categoryMap.get(category) || 0,
      }))
      .sort((a, b) => b.count - a.count);

    const byPublicationDate = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      dailyTarget: NEXUS_DAILY_TARGET,
      discoveredTodayCount,
      totalActiveLeads: activeLeads.length,
      verifiedCount,
      partiallyVerifiedCount,
      pendingCount,
      rejectedCount,
      expiredCount,
      availableBusinessEmailsCount,
      verifiedBusinessEmailsCount,
      personalEmailsCount,
      newOpportunitiesCount,
      alreadyContactedCount,
      awaitingContactCount,
      suppressedCount: store.suppressionList.length,
      byCountry,
      byCategory,
      byPublicationDate,
    };
  }

  function getSchedulerInfo(): NexusSchedulerInfo {
    return {
      enabled: !isVercel,
      intervalHours: SCHEDULER_INTERVAL_HOURS,
      dailyTarget: NEXUS_DAILY_TARGET,
      freshnessWindowHours: NEXUS_FRESHNESS_WINDOW_HOURS,
      isRunningNow: isDiscoveryRunning,
      lastRunAt,
      nextRunAt,
      lastRunStatus,
      freeSourcesOnlyPolicy:
        '100% Free Public Sources Only (zero paid APIs, zero paid lead databases, zero scraping subscriptions, strict robots.txt & 72h freshness enforcement).',
    };
  }

  async function runLiveFreeDiscovery(
    trigger: NexusDiscoveryRunLog['trigger']
  ): Promise<{ store: NexusClientFinderStore; runLog: NexusDiscoveryRunLog }> {
    if (isDiscoveryRunning) {
      const current = loadStore();
      return {
        store: current,
        runLog: current.runLogs[0] || {
          id: `run-${Date.now()}`,
          trigger,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          status: 'partial',
          dailyTarget: NEXUS_DAILY_TARGET,
          sourcesQueried: 0,
          rawCandidatesScanned: 0,
          acceptedWithin72hCount: 0,
          verifiedCount: 0,
          partiallyVerifiedCount: 0,
          pendingCount: 0,
          rejectedExpiredOrOver72hCount: 0,
          rejectedIrrelevantOrFakeCount: 0,
          duplicatesSkippedCount: 0,
          businessEmailsFoundCount: 0,
          errors: ['Discovery run is already in progress.'],
        },
      };
    }

    isDiscoveryRunning = true;
    const startedMs = Date.now();
    const startedAt = new Date(startedMs).toISOString();
    const store = loadStore();
    refreshLeadFreshnessAndSuppression(store);

    const existingFingerprints = new Set<string>(store.leads.map((l) => l.fingerprint));
    const existingUrls = new Set<string>(store.leads.map((l) => l.originalSourceUrl.toLowerCase()));

    const connectorTasks: Array<{
      sourceId: string;
      fn: () => Promise<{ candidates: RawCandidateOpportunity[]; error: string | null }>;
    }> = [
      { sourceId: 'freelancer_public_api', fn: fetchFreelancerPublicProjects },
      { sourceId: 'wordpress_jobs_rss', fn: fetchWordPressJobsRss },
      { sourceId: 'himalayas_public_api', fn: fetchHimalayasPublicApi },
      { sourceId: 'arbeitnow_europe_api', fn: fetchArbeitnowEuropeApi },
      { sourceId: 'remotive_public_api', fn: fetchRemotivePublicApi },
      { sourceId: 'weworkremotely_rss', fn: fetchWeWorkRemotelyRss },
      { sourceId: 'remoteok_public_api', fn: fetchRemoteOkApi },
      { sourceId: 'hn_algolia_public_api', fn: fetchHackerNewsPublicCommunity },
    ];

    const results = await Promise.allSettled(connectorTasks.map((t) => t.fn()));
    const allCandidates: RawCandidateOpportunity[] = [];
    const errors: string[] = [];
    const perSourceScanned = new Map<string, number>();
    const perSourceAccepted = new Map<string, number>();

    results.forEach((res, idx) => {
      const sourceId = connectorTasks[idx].sourceId;
      const sourceRecord = store.sources.find((s) => s.id === sourceId);
      const checkedIso = new Date().toISOString();

      if (res.status === 'fulfilled') {
        const { candidates, error } = res.value;
        perSourceScanned.set(sourceId, candidates.length);
        allCandidates.push(...candidates);
        if (error) errors.push(`${sourceId}: ${error}`);
        if (sourceRecord) {
          sourceRecord.lastCheckedAt = checkedIso;
          sourceRecord.lastCandidatesFound = candidates.length;
          sourceRecord.lastError = error;
          sourceRecord.status = error ? (candidates.length > 0 ? 'degraded' : 'error') : 'connected';
        }
      } else {
        const errMsg = res.reason?.message || 'Connector exception';
        errors.push(`${sourceId}: ${errMsg}`);
        if (sourceRecord) {
          sourceRecord.lastCheckedAt = checkedIso;
          sourceRecord.lastCandidatesFound = 0;
          sourceRecord.lastAcceptedCount = 0;
          sourceRecord.lastError = errMsg;
          sourceRecord.status = 'error';
        }
      }
    });

    let rawCandidatesScanned = allCandidates.length;
    let acceptedWithin72hCount = 0;
    let verifiedCount = 0;
    let partiallyVerifiedCount = 0;
    let pendingCount = 0;
    let rejectedExpiredOrOver72hCount = 0;
    let rejectedIrrelevantOrFakeCount = 0;
    let duplicatesSkippedCount = 0;
    let businessEmailsFoundCount = 0;

    // Prioritize candidates from priority countries and with fresher timestamps
    const preFiltered: Array<{
      candidate: RawCandidateOpportunity;
      freshness: ReturnType<typeof evaluate72HourFreshness>;
      relevance: ReturnType<typeof evaluateWebItRelevance>;
      geo: ReturnType<typeof detectPriorityCountryAndCity>;
    }> = [];

    const nowMs = Date.now();
    for (const candidate of allCandidates) {
      if (!candidate.title || !candidate.originalSourceUrl) {
        rejectedIrrelevantOrFakeCount++;
        continue;
      }

      // 1. STRICT 72-HOUR FRESHNESS FILTER
      const freshness = evaluate72HourFreshness(candidate.publishedAt, nowMs);
      if (!freshness.valid || !freshness.within72Hours || !freshness.publishedAtIso) {
        rejectedExpiredOrOver72hCount++;
        continue;
      }

      // 2. WEB / IT RELEVANCE & ANTI-SPAM FILTER
      const relevance = evaluateWebItRelevance(candidate.title, candidate.rawText);
      if (!relevance.relevant) {
        rejectedIrrelevantOrFakeCount++;
        continue;
      }

      // 3. COUNTRY / REGION DETECTION
      const geo = detectPriorityCountryAndCity(candidate.rawLocation, candidate.title, candidate.rawText);
      preFiltered.push({ candidate, freshness, relevance, geo });
    }

    // Sort: priority markets first, then newest first
    preFiltered.sort((a, b) => {
      if (a.geo.isPriorityMarket !== b.geo.isPriorityMarket) {
        return a.geo.isPriorityMarket ? -1 : 1;
      }
      return a.freshness.ageHours - b.freshness.ageHours;
    });

    // Respect daily target ceiling (never fabricate to reach 300)
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const alreadyTodayCount = store.leads.filter(
      (l) => l.discoveredAt.startsWith(todayPrefix) && l.within72Hours && l.isActive
    ).length;
    const remainingDailyBudget = Math.max(0, NEXUS_DAILY_TARGET - alreadyTodayCount);

    // Deduplicate against existing store before enrichment
    const uniqueToEnrich: typeof preFiltered = [];
    for (const item of preFiltered) {
      if (uniqueToEnrich.length >= remainingDailyBudget && remainingDailyBudget > 0) break;
      const { candidate } = item;
      const urlLower = candidate.originalSourceUrl.toLowerCase();
      const prelimFp = computeNexusLeadFingerprint(
        candidate.title,
        candidate.advertiserName,
        candidate.originalSourceUrl
      );
      if (existingUrls.has(urlLower) || existingFingerprints.has(prelimFp)) {
        duplicatesSkippedCount++;
        continue;
      }
      existingUrls.add(urlLower);
      existingFingerprints.add(prelimFp);
      uniqueToEnrich.push(item);
    }

    let deepSiteLookupsAttempted = 0;
    const MAX_DEEP_SITE_LOOKUPS_PER_RUN = 8;
    const enrichDeadlineMs = Date.now() + 18_000;
    const CONCURRENCY = 6;

    for (let i = 0; i < uniqueToEnrich.length; i += CONCURRENCY) {
      const batch = uniqueToEnrich.slice(i, i + CONCURRENCY);
      const enrichedBatch = await Promise.all(
        batch.map(async (item) => {
          const allowDeep =
            deepSiteLookupsAttempted < MAX_DEEP_SITE_LOOKUPS_PER_RUN && Date.now() < enrichDeadlineMs;
          if (allowDeep) deepSiteLookupsAttempted++;
          const contactInfo = await enrichPublicContactAndVerifyUrl(item.candidate, {
            allowDeepWebsiteContactLookup: allowDeep,
          });
          return { item, contactInfo };
        })
      );

      for (const { item, contactInfo } of enrichedBatch) {
        const { candidate, freshness, relevance, geo } = item;
        const finalFp = computeNexusLeadFingerprint(
          candidate.title,
          candidate.advertiserName,
          candidate.originalSourceUrl,
          contactInfo.publicEmail
        );
        if (contactInfo.publicEmail && existingFingerprints.has(finalFp)) {
          duplicatesSkippedCount++;
          continue;
        }
        existingFingerprints.add(finalFp);

        const category = classifyNexusLeadCategory(
          candidate.title,
          candidate.rawText,
          candidate.advertiserType
        );
        const requirements = extractProjectRequirements(
          candidate.title,
          candidate.rawText,
          relevance.matchedKeywords
        );

        const suppressed = isEmailSuppressed(contactInfo.publicEmail, store.suppressionList);
        const nowIso = new Date().toISOString();

        const newLead: NexusClientLead = {
          id: `nxl-${crypto.randomBytes(6).toString('hex')}`,
          fingerprint: finalFp,
          title: candidate.title.slice(0, 180),
          advertiserName: candidate.advertiserName.slice(0, 100),
          advertiserType: candidate.advertiserType,
          country: geo.country,
          regionGroup: geo.regionGroup,
          city: geo.city,
          category,
          categoryLabel: NEXUS_CATEGORY_LABELS[category],
          originalAdText: candidate.rawText.slice(0, 1400),
          projectRequirements: requirements,
          estimatedBudget: candidate.estimatedBudget,
          publishedAt: freshness.publishedAtIso!,
          discoveredAt: nowIso,
          lastRecheckedAt: nowIso,
          ageHoursAtDiscovery: freshness.ageHours,
          within72Hours: true,
          isActive: contactInfo.isActive,
          sourceId: candidate.sourceId,
          sourceName: candidate.sourceName,
          originalSourceUrl: candidate.originalSourceUrl,
          sourceHttpStatus: contactInfo.sourceHttpStatus,
          robotsAllowed: contactInfo.robotsAllowed,
          publicEmail: contactInfo.publicEmail,
          emailClassification: contactInfo.emailClassification,
          emailDomain: contactInfo.emailDomain,
          emailMxVerified: contactInfo.emailMxVerified,
          emailEvidenceSource: contactInfo.emailEvidenceSource,
          officialWebsiteUrl: contactInfo.officialWebsiteUrl,
          publicContactPageUrl: contactInfo.publicContactPageUrl,
          publicPhone: contactInfo.publicPhone,
          verificationStatus: contactInfo.verificationStatus,
          verificationNotes: contactInfo.verificationNotes,
          rejectionReason: null,
          contactStatus: suppressed ? 'do_not_contact' : 'new',
          contactNotes: '',
          contactCount: 0,
          lastContactedAt: null,
          outreachHistory: [],
          suppressed,
        };

        store.leads.unshift(newLead);

        acceptedWithin72hCount++;
        perSourceAccepted.set(candidate.sourceId, (perSourceAccepted.get(candidate.sourceId) || 0) + 1);
        if (newLead.verificationStatus === 'verified') verifiedCount++;
        else if (newLead.verificationStatus === 'partially_verified') partiallyVerifiedCount++;
        else pendingCount++;

        if (
          newLead.emailClassification === 'verified_business_email' ||
          newLead.emailClassification === 'unverified_business_email'
        ) {
          businessEmailsFoundCount++;
        }
      }
    }

    // Update per-source accepted count
    for (const src of store.sources) {
      src.lastAcceptedCount = perSourceAccepted.get(src.id) || 0;
    }

    const finishedMs = Date.now();
    const runStatus: NexusDiscoveryRunLog['status'] =
      errors.length === 0 ? 'success' : acceptedWithin72hCount > 0 || rawCandidatesScanned > 0 ? 'partial' : 'failed';

    const runLog: NexusDiscoveryRunLog = {
      id: `nxl-run-${finishedMs}`,
      trigger,
      startedAt,
      finishedAt: new Date(finishedMs).toISOString(),
      durationMs: finishedMs - startedMs,
      status: runStatus,
      dailyTarget: NEXUS_DAILY_TARGET,
      sourcesQueried: connectorTasks.length,
      rawCandidatesScanned,
      acceptedWithin72hCount,
      verifiedCount,
      partiallyVerifiedCount,
      pendingCount,
      rejectedExpiredOrOver72hCount,
      rejectedIrrelevantOrFakeCount,
      duplicatesSkippedCount,
      businessEmailsFoundCount,
      errors,
    };

    store.runLogs.unshift(runLog);
    saveStore(store);

    lastRunAt = runLog.finishedAt;
    lastRunStatus = runLog.status;
    nextRunAt = !isVercel ? new Date(Date.now() + SCHEDULER_INTERVAL_MS).toISOString() : null;
    isDiscoveryRunning = false;

    return { store, runLog };
  }

  async function recheckActiveStoredLeads(): Promise<{
    store: NexusClientFinderStore;
    checkedCount: number;
    expiredOrInactiveCount: number;
  }> {
    const store = loadStore();
    refreshLeadFreshnessAndSuppression(store);

    const candidatesToRecheck = store.leads
      .filter((l) => l.within72Hours && l.isActive)
      .slice(0, 25);

    let checkedCount = 0;
    let expiredOrInactiveCount = 0;
    const nowIso = new Date().toISOString();

    for (const lead of candidatesToRecheck) {
      const f = evaluate72HourFreshness(lead.publishedAt);
      lead.lastRecheckedAt = nowIso;
      checkedCount++;
      if (!f.within72Hours) {
        lead.within72Hours = false;
        lead.isActive = false;
        lead.verificationStatus = 'expired';
        lead.verificationNotes = `Expired: Published ${f.ageHours}h ago (exceeded 72-hour freshness limit).`;
        expiredOrInactiveCount++;
        continue;
      }

      const allowed = await isRobotsAllowed(lead.originalSourceUrl);
      lead.robotsAllowed = allowed;
      if (allowed) {
        const resp = await safePublicFetch(lead.originalSourceUrl, { timeoutMs: 5000 });
        if (resp) {
          lead.sourceHttpStatus = resp.status;
          if (resp.status === 404 || resp.status === 410) {
            lead.isActive = false;
            lead.verificationStatus = 'expired';
            lead.verificationNotes = `Marked inactive during recheck: original source returned HTTP ${resp.status}.`;
            expiredOrInactiveCount++;
          } else if (resp.ok) {
            lead.isActive = true;
            if (lead.verificationStatus === 'pending') {
              lead.verificationStatus = lead.publicEmail ? 'verified' : 'partially_verified';
            }
          }
        }
      }
    }

    saveStore(store);
    return { store, checkedCount, expiredOrInactiveCount };
  }

  // ============================================================================
  // ADMIN-ONLY API ROUTES (STRICTLY ISOLATED UNDER /api/admin/nexus-client-finder/*)
  // ============================================================================

  app.get('/api/admin/nexus-client-finder/dashboard', (req: Request, res: Response) => {
    if (!requireOwnerAdmin(req, res)) return;
    try {
      const store = loadStore();
      refreshLeadFreshnessAndSuppression(store);

      const search = String(req.query.search || '').trim().toLowerCase();
      const country = String(req.query.country || '').trim();
      const category = String(req.query.category || '').trim();
      const verificationStatus = String(req.query.verificationStatus || '').trim();
      const emailClassification = String(req.query.emailClassification || '').trim();
      const contactStatus = String(req.query.contactStatus || '').trim();
      const includeExpired = String(req.query.includeExpired || 'false') === 'true';
      const sortBy = String(req.query.sortBy || 'newest');

      let filtered = store.leads.filter((lead) => {
        if (!includeExpired && (!lead.within72Hours || !lead.isActive || lead.verificationStatus === 'expired')) {
          return false;
        }
        if (country && country !== 'all' && lead.country !== country) return false;
        if (category && category !== 'all' && lead.category !== category) return false;
        if (verificationStatus && verificationStatus !== 'all' && lead.verificationStatus !== verificationStatus) {
          return false;
        }
        if (emailClassification && emailClassification !== 'all' && lead.emailClassification !== emailClassification) {
          return false;
        }
        if (contactStatus && contactStatus !== 'all' && lead.contactStatus !== contactStatus) return false;
        if (search) {
          const hay = [
            lead.title,
            lead.advertiserName,
            lead.country,
            lead.city,
            lead.categoryLabel,
            lead.originalAdText,
            lead.publicEmail || '',
            lead.sourceName,
            ...(lead.projectRequirements || []),
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });

      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'oldest') return Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
        if (sortBy === 'verified_email_first') {
          const rank = (c: NexusClientLead['emailClassification']) =>
            c === 'verified_business_email' ? 0 : c === 'unverified_business_email' ? 1 : c === 'personal_email' ? 2 : 3;
          const diff = rank(a.emailClassification) - rank(b.emailClassification);
          return diff !== 0 ? diff : Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
        }
        if (sortBy === 'country') return a.country.localeCompare(b.country);
        return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      });

      const payload: NexusClientFinderApiResponse = {
        success: true,
        generatedAt: new Date().toISOString(),
        stats: computeDashboardStats(store),
        leads: filtered,
        suppressionList: store.suppressionList,
        sources: store.sources,
        runLogs: store.runLogs.slice(0, 20),
        schedulerInfo: getSchedulerInfo(),
      };
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to load Nexus Client Finder dashboard.' });
    }
  });

  app.post('/api/admin/nexus-client-finder/run-discovery', async (req: Request, res: Response) => {
    if (!requireOwnerAdmin(req, res)) return;
    try {
      const { store, runLog } = await runLiveFreeDiscovery('manual_admin');
      appendAuditLog({
        action: 'nexus_client_finder_manual_discovery',
        actor: getRequesterEmail(req) || 'admin',
        details: `Scanned ${runLog.rawCandidatesScanned} public listings, accepted ${runLog.acceptedWithin72hCount} within 72h.`,
      });
      res.json({
        success: true,
        runLog,
        stats: computeDashboardStats(store),
        sources: store.sources,
        schedulerInfo: getSchedulerInfo(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Live free discovery failed.' });
    }
  });

  app.post('/api/admin/nexus-client-finder/recheck-active', async (req: Request, res: Response) => {
    if (!requireOwnerAdmin(req, res)) return;
    try {
      const result = await recheckActiveStoredLeads();
      res.json({
        success: true,
        checkedCount: result.checkedCount,
        expiredOrInactiveCount: result.expiredOrInactiveCount,
        stats: computeDashboardStats(result.store),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Recheck failed.' });
    }
  });

  app.patch('/api/admin/nexus-client-finder/leads/:id/status', (req: Request, res: Response) => {
    if (!requireOwnerAdmin(req, res)) return;
    try {
      const leadId = String(req.params.id || '').trim();
      const nextStatus = String(req.body?.contactStatus || '').trim() as NexusContactStatus;
      const contactNotes = typeof req.body?.contactNotes === 'string' ? req.body.contactNotes.slice(0, 1200) : undefined;

      if (!leadId) {
        res.status(400).json({ success: false, error: 'Missing lead ID.' });
        return;
      }
      if (nextStatus && !VALID_CONTACT_STATUSES.has(nextStatus)) {
        res.status(400).json({ success: false, error: 'Invalid contact status value.' });
        return;
      }

      const store = loadStore();
      const lead = store.leads.find((l) => l.id === leadId);
      if (!lead) {
        res.status(404).json({ success: false, error: 'Lead not found.' });
        return;
      }

      if (nextStatus) {
        lead.contactStatus = nextStatus;
      }
      if (contactNotes !== undefined) {
        lead.contactNotes = contactNotes;
      }

      // Automatically enforce permanent suppression list when marked Do Not Contact
      if (nextStatus === 'do_not_contact') {
        lead.suppressed = true;
        if (lead.publicEmail && !isEmailSuppressed(lead.publicEmail, store.suppressionList)) {
          const dom = lead.publicEmail.split('@')[1]?.toLowerCase() || null;
          store.suppressionList.unshift({
            id: `sup-${crypto.randomBytes(5).toString('hex')}`,
            email: lead.publicEmail.toLowerCase(),
            domain: dom && !FREE_PERSONAL_EMAIL_DOMAINS.has(dom) ? dom : null,
            advertiserName: lead.advertiserName,
            reason: contactNotes || 'Marked Do Not Contact from Nexus Client Finder dashboard',
            leadId: lead.id,
            addedAt: new Date().toISOString(),
          });
        }
      }

      saveStore(store);
      res.json({
        success: true,
        lead,
        stats: computeDashboardStats(store),
        suppressionList: store.suppressionList,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Status update failed.' });
    }
  });

  app.post('/api/admin/nexus-client-finder/leads/bulk-status', (req: Request, res: Response) => {
    if (!requireOwnerAdmin(req, res)) return;
    try {
      const leadIds: string[] = Array.isArray(req.body?.leadIds)
        ? req.body.leadIds.map((x: any) => String(x || '').trim()).filter(Boolean)
        : [];
      const nextStatus = String(req.body?.contactStatus || '').trim() as NexusContactStatus;
      if (leadIds.length === 0 || !VALID_CONTACT_STATUSES.has(nextStatus)) {
        res.status(400).json({ success: false, error: 'Provide leadIds[] and a valid contactStatus.' });
        return;
      }

      const store = loadStore();
      const idSet = new Set(leadIds);
      let updatedCount = 0;

      for (const lead of store.leads) {
        if (!idSet.has(lead.id)) continue;
        lead.contactStatus = nextStatus;
        updatedCount++;
        if (nextStatus === 'do_not_contact') {
          lead.suppressed = true;
          if (lead.publicEmail && !isEmailSuppressed(lead.publicEmail, store.suppressionList)) {
            const dom = lead.publicEmail.split('@')[1]?.toLowerCase() || null;
            store.suppressionList.unshift({
              id: `sup-${crypto.randomBytes(5).toString('hex')}`,
              email: lead.publicEmail.toLowerCase(),
              domain: dom && !FREE_PERSONAL_EMAIL_DOMAINS.has(dom) ? dom : null,
              advertiserName: lead.advertiserName,
              reason: 'Bulk marked Do Not Contact',
              leadId: lead.id,
              addedAt: new Date().toISOString(),
            });
          }
        }
      }

      saveStore(store);
      res.json({
        success: true,
        updatedCount,
        stats: computeDashboardStats(store),
        suppressionList: store.suppressionList,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Bulk status update failed.' });
    }
  });

  app.post('/api/admin/nexus-client-finder/leads/record-outreach', (req: Request, res: Response) => {
    if (!requireOwnerAdmin(req, res)) return;
    try {
      const leadIds: string[] = Array.isArray(req.body?.leadIds)
        ? req.body.leadIds.map((x: any) => String(x || '').trim()).filter(Boolean)
        : [];
      const modeRaw = String(req.body?.mode || 'single_gmail');
      const mode: NexusOutreachHistoryItem['mode'] =
        modeRaw === 'bulk_bcc_gmail' || modeRaw === 'individual_personalized' ? modeRaw : 'single_gmail';
      const subject = String(req.body?.subject || '').slice(0, 240);
      const templateRaw = String(req.body?.templateType || 'website_development') as NexusMessageTemplateType;
      const templateType: NexusMessageTemplateType = VALID_TEMPLATE_TYPES.has(templateRaw)
        ? templateRaw
        : 'website_development';
      const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 400) : undefined;

      if (leadIds.length === 0) {
        res.status(400).json({ success: false, error: 'Provide leadIds[] to record Gmail outreach.' });
        return;
      }

      const store = loadStore();
      const idSet = new Set(leadIds);
      const nowIso = new Date().toISOString();
      let recordedCount = 0;
      let skippedSuppressedCount = 0;

      for (const lead of store.leads) {
        if (!idSet.has(lead.id)) continue;
        if (lead.suppressed || lead.contactStatus === 'do_not_contact' || isEmailSuppressed(lead.publicEmail, store.suppressionList)) {
          skippedSuppressedCount++;
          continue;
        }
        lead.contactCount = (lead.contactCount || 0) + 1;
        lead.lastContactedAt = nowIso;
        if (['new', 'selected', 'ready_to_contact'].includes(lead.contactStatus)) {
          lead.contactStatus = 'contacted';
        }
        lead.outreachHistory = [
          {
            id: `out-${crypto.randomBytes(4).toString('hex')}`,
            sentAt: nowIso,
            mode,
            recipientEmail: lead.publicEmail || 'manual-source-contact',
            subject: subject || `Nexus IT Solutions outreach (${lead.title.slice(0, 60)})`,
            templateType,
            note,
          },
          ...(lead.outreachHistory || []),
        ].slice(0, 25);
        recordedCount++;
      }

      saveStore(store);
      res.json({
        success: true,
        recordedCount,
        skippedSuppressedCount,
        stats: computeDashboardStats(store),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to record outreach.' });
    }
  });

  app.post('/api/admin/nexus-client-finder/message-draft', async (req: Request, res: Response) => {
    if (!requireOwnerAdmin(req, res)) return;
    try {
      const leadId = String(req.body?.leadId || '').trim();
      const templateRaw = String(req.body?.templateType || 'website_development') as NexusMessageTemplateType;
      const templateType: NexusMessageTemplateType = VALID_TEMPLATE_TYPES.has(templateRaw)
        ? templateRaw
        : 'website_development';
      const useOptionalAiPolish = Boolean(req.body?.useAiPolish);

      const store = loadStore();
      const lead = store.leads.find((l) => l.id === leadId);
      if (!lead) {
        res.status(404).json({ success: false, error: 'Lead not found.' });
        return;
      }

      // 100% Free deterministic assistant always works with zero paid API dependency
      const baseDraft = generateNexusProposalMessage(lead, templateType);

      if (useOptionalAiPolish) {
        try {
          const ai = await getAiClient();
          if (ai && ai.models && typeof ai.models.generateContent === 'function') {
            const prompt = [
              'You are writing a short, honest, professional first-contact business email on behalf of NEXUS IT SOLUTIONS.',
              'RULES:',
              '- Reference ONLY facts present in the advertisement below.',
              '- NEVER claim prior phone calls, previous emails, or false familiarity.',
              '- Keep it under 135 words, clear, polite, non-spammy, and natural.',
              '- Return strictly JSON with keys "subject" and "body".',
              `Template Type: ${templateType}`,
              `Advertiser: ${lead.advertiserName}`,
              `Country: ${lead.country}`,
              `Listing Title: ${lead.title}`,
              `Requirements: ${lead.projectRequirements.join(', ')}`,
              `Listing Excerpt: ${lead.originalAdText.slice(0, 600)}`,
            ].join('\n');

            const resp = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: { responseMimeType: 'application/json' },
            });
            const text = typeof resp?.text === 'string' ? resp.text : '';
            const parsed = JSON.parse(text);
            if (parsed?.subject && parsed?.body) {
              res.json({
                success: true,
                draft: {
                  ...baseDraft,
                  subject: String(parsed.subject).trim().slice(0, 180),
                  body: String(parsed.body).trim().slice(0, 2200),
                  generatedBy: 'gemini_enhanced',
                },
              });
              return;
            }
          }
        } catch {
          // Seamless zero-cost fallback to deterministic Nexus IT Solutions assistant
        }
      }

      res.json({ success: true, draft: baseDraft });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to generate message draft.' });
    }
  });

  app.post('/api/admin/nexus-client-finder/suppression', (req: Request, res: Response) => {
    if (!requireOwnerAdmin(req, res)) return;
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const domainInput = String(req.body?.domain || '').trim().toLowerCase().replace(/^@/, '');
      const reason = String(req.body?.reason || 'Added manually to permanent Do Not Contact list').trim().slice(0, 300);

      if (!email && !domainInput) {
        res.status(400).json({ success: false, error: 'Provide an email address or company domain to suppress.' });
        return;
      }

      const store = loadStore();
      const derivedDomain =
        domainInput ||
        (email.includes('@') && !FREE_PERSONAL_EMAIL_DOMAINS.has(email.split('@')[1])
          ? email.split('@')[1]
          : null);

      const alreadyExists = store.suppressionList.some(
        (s) => (email && s.email === email) || (derivedDomain && s.domain === derivedDomain)
      );
      if (!alreadyExists) {
        const entry: NexusSuppressionEntry = {
          id: `sup-${crypto.randomBytes(5).toString('hex')}`,
          email,
          domain: derivedDomain,
          advertiserName: req.body?.advertiserName ? String(req.body.advertiserName).slice(0, 100) : null,
          reason,
          leadId: req.body?.leadId ? String(req.body.leadId).slice(0, 60) : null,
          addedAt: new Date().toISOString(),
        };
        store.suppressionList.unshift(entry);
      }

      refreshLeadFreshnessAndSuppression(store);
      saveStore(store);

      res.json({
        success: true,
        suppressionList: store.suppressionList,
        stats: computeDashboardStats(store),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to add suppression entry.' });
    }
  });

  app.delete('/api/admin/nexus-client-finder/suppression/:id', (req: Request, res: Response) => {
    if (!requireOwnerAdmin(req, res)) return;
    try {
      const id = String(req.params.id || '').trim();
      const store = loadStore();
      const before = store.suppressionList.length;
      store.suppressionList = store.suppressionList.filter((s) => s.id !== id);
      if (store.suppressionList.length === before) {
        res.status(404).json({ success: false, error: 'Suppression entry not found.' });
        return;
      }
      refreshLeadFreshnessAndSuppression(store);
      saveStore(store);
      res.json({
        success: true,
        suppressionList: store.suppressionList,
        stats: computeDashboardStats(store),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to delete suppression entry.' });
    }
  });

  // ============================================================================
  // AUTOMATIC RECURRING BACKGROUND SCHEDULER (EVERY 3 HOURS, NON-BLOCKING)
  // ============================================================================

  if (!isVercel) {
    nextRunAt = new Date(Date.now() + SCHEDULER_INTERVAL_MS).toISOString();
    const timer = setInterval(() => {
      runLiveFreeDiscovery('scheduled_3h').catch((err) => {
        console.error('[NexusClientFinder] Scheduled 3h discovery error:', err?.message || err);
      });
    }, SCHEDULER_INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
  }

  return {
    runLiveFreeDiscovery,
    recheckActiveStoredLeads,
    loadStore,
  };
}
