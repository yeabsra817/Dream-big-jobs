import {
  NexusClientLead,
  NexusContactStatus,
  NexusEmailClassification,
  NexusGeneratedMessage,
  NexusGmailBatch,
  NexusLeadCategory,
  NexusMessageTemplateType,
  NexusSuppressionEntry,
} from '../types/nexusClientFinder';

export const NEXUS_FRESHNESS_WINDOW_HOURS = 72;
export const NEXUS_DAILY_TARGET = 300;
export const NEXUS_GMAIL_MAX_BCC_PER_BATCH = 25;

export const NEXUS_CATEGORY_LABELS: Record<NexusLeadCategory, string> = {
  person_looking_for_web_developer: 'Person looking for a website developer',
  company_looking_for_web_developer: 'Company looking for a website developer',
  ecommerce_website_request: 'E-commerce website request',
  wordpress_website_request: 'WordPress website request',
  business_website_creation: 'Business website creation',
  website_redesign_improvement: 'Website redesign or improvement',
  landing_page_development: 'Landing page development',
  web_application_development: 'Web application development',
  website_maintenance: 'Website maintenance',
  other_it_projects: 'Other relevant IT projects',
};

export const NEXUS_CONTACT_STATUS_LABELS: Record<NexusContactStatus, string> = {
  new: 'New',
  selected: 'Selected',
  ready_to_contact: 'Ready to contact',
  contacted: 'Contacted',
  replied: 'Replied',
  interested: 'Interested',
  negotiating: 'Negotiating',
  project_won: 'Project won',
  not_interested: 'Not interested',
  do_not_contact: 'Do not contact',
};

export const NEXUS_EMAIL_CLASSIFICATION_LABELS: Record<NexusEmailClassification, string> = {
  verified_business_email: 'Verified Business Email',
  unverified_business_email: 'Unverified Business Email',
  personal_email: 'Personal Email (Verify Consent)',
  no_public_email: 'No Public Email Found',
};

export const FREE_PERSONAL_EMAIL_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'ymail.com',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'gmx.com',
  'gmx.de',
  'web.de',
  'mail.com',
  'yandex.com',
  'fastmail.com',
  'tutanota.com',
]);

const DISPOSABLE_OR_PLACEHOLDER_DOMAINS = new Set<string>([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'localhost',
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'yopmail.com',
  'sentry.io',
  'wixpress.com',
  'schema.org',
  'w3.org',
  'freelancer.com',
  'remotive.com',
  'arbeitnow.com',
  'remoteok.com',
  'weworkremotely.com',
  'himalayas.app',
  'wordpress.org',
  'wordpress.net',
]);

interface PriorityCountryRule {
  country: string;
  regionGroup: NexusClientLead['regionGroup'];
  patterns: RegExp;
  cities?: Array<{ name: string; pattern: RegExp }>;
}

const PRIORITY_COUNTRY_RULES: PriorityCountryRule[] = [
  {
    country: 'United Arab Emirates',
    regionGroup: 'GCC / Middle East',
    patterns: /\b(united arab emirates|uae|u\.a\.e\.|dubai|abu dhabi|sharjah|ajman|ras al khaimah)\b/i,
    cities: [
      { name: 'Dubai', pattern: /\bdubai\b/i },
      { name: 'Abu Dhabi', pattern: /\babu dhabi\b/i },
      { name: 'Sharjah', pattern: /\bsharjah\b/i },
    ],
  },
  {
    country: 'Saudi Arabia',
    regionGroup: 'GCC / Middle East',
    patterns: /\b(saudi arabia|ksa|riyadh|jeddah|dammam|khobar|mecca|medina)\b/i,
    cities: [
      { name: 'Riyadh', pattern: /\briyadh\b/i },
      { name: 'Jeddah', pattern: /\bjeddah\b/i },
      { name: 'Dammam', pattern: /\bdammam\b/i },
    ],
  },
  {
    country: 'Qatar',
    regionGroup: 'GCC / Middle East',
    patterns: /\b(qatar|doha|lusail|al wakrah)\b/i,
    cities: [{ name: 'Doha', pattern: /\bdoha\b/i }],
  },
  {
    country: 'Kuwait',
    regionGroup: 'GCC / Middle East',
    patterns: /\b(kuwait|kuwait city|salmiya|hawalli)\b/i,
    cities: [{ name: 'Kuwait City', pattern: /\bkuwait city\b/i }],
  },
  {
    country: 'Bahrain',
    regionGroup: 'GCC / Middle East',
    patterns: /\b(bahrain|manama|muharraq)\b/i,
    cities: [{ name: 'Manama', pattern: /\bmanama\b/i }],
  },
  {
    country: 'Oman',
    regionGroup: 'GCC / Middle East',
    patterns: /\b(oman|muscat|salalah|sohar)\b/i,
    cities: [{ name: 'Muscat', pattern: /\bmuscat\b/i }],
  },
  {
    country: 'United Kingdom',
    regionGroup: 'Europe',
    patterns: /\b(united kingdom|uk|u\.k\.|england|scotland|wales|london|manchester|birmingham|edinburgh|bristol|leeds|glasgow)\b/i,
    cities: [
      { name: 'London', pattern: /\blondon\b/i },
      { name: 'Manchester', pattern: /\bmanchester\b/i },
      { name: 'Birmingham', pattern: /\bbirmingham\b/i },
      { name: 'Edinburgh', pattern: /\bedinburgh\b/i },
    ],
  },
  {
    country: 'Germany',
    regionGroup: 'Europe',
    patterns: /\b(germany|deutschland|berlin|munich|münchen|frankfurt|hamburg|cologne|köln|stuttgart|düsseldorf)\b/i,
    cities: [
      { name: 'Berlin', pattern: /\bberlin\b/i },
      { name: 'Munich', pattern: /\b(munich|münchen)\b/i },
      { name: 'Frankfurt', pattern: /\bfrankfurt\b/i },
      { name: 'Hamburg', pattern: /\bhamburg\b/i },
    ],
  },
  {
    country: 'France',
    regionGroup: 'Europe',
    patterns: /\b(france|paris|lyon|marseille|toulouse|nice|bordeaux|lille)\b/i,
    cities: [
      { name: 'Paris', pattern: /\bparis\b/i },
      { name: 'Lyon', pattern: /\blyon\b/i },
    ],
  },
  {
    country: 'Netherlands',
    regionGroup: 'Europe',
    patterns: /\b(netherlands|holland|amsterdam|rotterdam|utrecht|eindhoven|the hague)\b/i,
    cities: [
      { name: 'Amsterdam', pattern: /\bamsterdam\b/i },
      { name: 'Rotterdam', pattern: /\brotterdam\b/i },
      { name: 'Utrecht', pattern: /\butrecht\b/i },
    ],
  },
  {
    country: 'Ireland',
    regionGroup: 'Europe',
    patterns: /\b(ireland|dublin|cork|galway|limerick)\b/i,
    cities: [
      { name: 'Dublin', pattern: /\bdublin\b/i },
      { name: 'Cork', pattern: /\bcork\b/i },
    ],
  },
  {
    country: 'Sweden',
    regionGroup: 'Europe',
    patterns: /\b(sweden|stockholm|gothenburg|malmö|malmo)\b/i,
    cities: [{ name: 'Stockholm', pattern: /\bstockholm\b/i }],
  },
  {
    country: 'Norway',
    regionGroup: 'Europe',
    patterns: /\b(norway|oslo|bergen|trondheim|stavanger)\b/i,
    cities: [{ name: 'Oslo', pattern: /\boslo\b/i }],
  },
  {
    country: 'Denmark',
    regionGroup: 'Europe',
    patterns: /\b(denmark|copenhagen|aarhus|odense)\b/i,
    cities: [{ name: 'Copenhagen', pattern: /\bcopenhagen\b/i }],
  },
  {
    country: 'Switzerland',
    regionGroup: 'Europe',
    patterns: /\b(switzerland|zurich|zürich|geneva|basel|bern|lausanne)\b/i,
    cities: [
      { name: 'Zurich', pattern: /\b(zurich|zürich)\b/i },
      { name: 'Geneva', pattern: /\bgeneva\b/i },
    ],
  },
  {
    country: 'Spain',
    regionGroup: 'Europe',
    patterns: /\b(spain|madrid|barcelona|valencia|seville)\b/i,
    cities: [
      { name: 'Madrid', pattern: /\bmadrid\b/i },
      { name: 'Barcelona', pattern: /\bbarcelona\b/i },
    ],
  },
  {
    country: 'Italy',
    regionGroup: 'Europe',
    patterns: /\b(italy|milan|milano|rome|roma|turin)\b/i,
    cities: [
      { name: 'Milan', pattern: /\b(milan|milano)\b/i },
      { name: 'Rome', pattern: /\b(rome|roma)\b/i },
    ],
  },
  {
    country: 'Austria',
    regionGroup: 'Europe',
    patterns: /\b(austria|vienna|wien|graz|salzburg)\b/i,
    cities: [{ name: 'Vienna', pattern: /\b(vienna|wien)\b/i }],
  },
  {
    country: 'Belgium',
    regionGroup: 'Europe',
    patterns: /\b(belgium|brussels|antwerp|ghent)\b/i,
    cities: [{ name: 'Brussels', pattern: /\bbrussels\b/i }],
  },
  {
    country: 'Finland',
    regionGroup: 'Europe',
    patterns: /\b(finland|helsinki|espoo|tampere)\b/i,
    cities: [{ name: 'Helsinki', pattern: /\bhelsinki\b/i }],
  },
  {
    country: 'Poland',
    regionGroup: 'Europe',
    patterns: /\b(poland|warsaw|krakow|kraków|wroclaw)\b/i,
    cities: [{ name: 'Warsaw', pattern: /\bwarsaw\b/i }],
  },
  {
    country: 'Portugal',
    regionGroup: 'Europe',
    patterns: /\b(portugal|lisbon|porto)\b/i,
    cities: [{ name: 'Lisbon', pattern: /\blisbon\b/i }],
  },
  {
    country: 'United States',
    regionGroup: 'North America & Oceania',
    patterns: /\b(united states|usa|u\.s\.a\.|u\.s\.|new york|san francisco|los angeles|austin|chicago|seattle|miami|boston|dallas|california|texas|florida)\b/i,
    cities: [
      { name: 'New York', pattern: /\bnew york\b/i },
      { name: 'San Francisco', pattern: /\bsan francisco\b/i },
      { name: 'Austin', pattern: /\baustin\b/i },
      { name: 'Los Angeles', pattern: /\blos angeles\b/i },
      { name: 'Miami', pattern: /\bmiami\b/i },
    ],
  },
  {
    country: 'Canada',
    regionGroup: 'North America & Oceania',
    patterns: /\b(canada|toronto|vancouver|montreal|calgary|ottawa|ontario|british columbia)\b/i,
    cities: [
      { name: 'Toronto', pattern: /\btoronto\b/i },
      { name: 'Vancouver', pattern: /\bvancouver\b/i },
      { name: 'Montreal', pattern: /\bmontreal\b/i },
    ],
  },
  {
    country: 'Australia',
    regionGroup: 'North America & Oceania',
    patterns: /\b(australia|sydney|melbourne|brisbane|perth|adelaide)\b/i,
    cities: [
      { name: 'Sydney', pattern: /\bsydney\b/i },
      { name: 'Melbourne', pattern: /\bmelbourne\b/i },
      { name: 'Brisbane', pattern: /\bbrisbane\b/i },
    ],
  },
];

/**
 * Evaluates strict 72-hour publication freshness.
 * Rejects missing, unparseable, future-corrupted, or older-than-72h publication dates.
 */
export function evaluate72HourFreshness(
  publishedAtInput: string | number | null | undefined,
  nowMs: number = Date.now()
): {
  valid: boolean;
  publishedAtIso: string | null;
  ageHours: number;
  within72Hours: boolean;
  reason: string | null;
} {
  if (publishedAtInput === null || publishedAtInput === undefined || publishedAtInput === '') {
    return {
      valid: false,
      publishedAtIso: null,
      ageHours: Infinity,
      within72Hours: false,
      reason: 'Rejected: Missing original publication date.',
    };
  }

  let tsMs = NaN;
  if (typeof publishedAtInput === 'number') {
    tsMs = publishedAtInput < 1e12 ? publishedAtInput * 1000 : publishedAtInput;
  } else {
    const trimmed = String(publishedAtInput).trim();
    if (/^\d{9,13}$/.test(trimmed)) {
      const n = Number(trimmed);
      tsMs = n < 1e12 ? n * 1000 : n;
    } else {
      tsMs = Date.parse(trimmed);
    }
  }

  if (!Number.isFinite(tsMs) || tsMs <= 0) {
    return {
      valid: false,
      publishedAtIso: null,
      ageHours: Infinity,
      within72Hours: false,
      reason: 'Rejected: Unparseable original publication timestamp.',
    };
  }

  // Allow slight clock drift up to +2h in case of publisher timezone offset
  if (tsMs > nowMs + 2 * 3600 * 1000) {
    return {
      valid: false,
      publishedAtIso: new Date(tsMs).toISOString(),
      ageHours: 0,
      within72Hours: false,
      reason: 'Rejected: Invalid future publication timestamp.',
    };
  }

  const ageHours = Math.max(0, Number(((nowMs - tsMs) / (3600 * 1000)).toFixed(1)));
  const within72Hours = ageHours <= NEXUS_FRESHNESS_WINDOW_HOURS;

  return {
    valid: true,
    publishedAtIso: new Date(tsMs).toISOString(),
    ageHours,
    within72Hours,
    reason: within72Hours
      ? null
      : `Rejected: Published ${ageHours}h ago (exceeds strict 72-hour freshness window).`,
  };
}

/**
 * Checks whether a public posting is genuinely relevant to Nexus IT Solutions
 * (website development, web design, e-commerce, WordPress, redesign, landing pages, web apps, IT projects).
 */
export function evaluateWebItRelevance(
  title: string,
  description: string
): { relevant: boolean; matchedKeywords: string[]; rejectionReason: string | null } {
  const combined = `${title || ''} ${description || ''}`.toLowerCase();

  // Exclude obvious scam / spam / unrelated postings
  if (
    /\b(crypto\s+airdrop|forex\s+signals|get\s+rich|mlm|adult\s+content|casino\s+link|gambling\s+backlinks|click\s+farm|fake\s+reviews|buy\s+followers|essay\s+writing|homework\s+help|video\s+tutorial\s+only|youtube\s+thumbnail)\b/i.test(
      combined
    )
  ) {
    return {
      relevant: false,
      matchedKeywords: [],
      rejectionReason: 'Rejected: Spam, misleading, or non-development listing.',
    };
  }

  // Exclude self-promotion by developers looking for work ("For Hire")
  if (/^\s*\[?\s*for\s+hire\s*\]?/i.test(title) || /\bi\s+am\s+available\s+for\s+hire\b/i.test(title)) {
    return {
      relevant: false,
      matchedKeywords: [],
      rejectionReason: 'Rejected: Developer self-promotion ("[For Hire]") rather than a client request.',
    };
  }

  const keywordChecks: Array<[string, RegExp]> = [
    ['Website Development', /\b(website\s+dev|web\s+dev|build\s+(?:a\s+|my\s+|our\s+)?website|create\s+(?:a\s+|my\s+|our\s+)?website|need\s+(?:a\s+|new\s+)?website|looking\s+for\s+(?:a\s+)?web(?:site)?\s+developer|custom\s+website)\b/i],
    ['Web Design / UI-UX', /\b(web\s+design|website\s+design|figma\s+to\s+(?:html|react|wordpress|webflow)|webflow|framer\s+website|ui\/ux\s+website)\b/i],
    ['E-Commerce / Online Store', /\b(e-?commerce|online\s+store|shopify|woocommerce|magento|prestashop|opencart|stripe\s+checkout|online\s+shop)\b/i],
    ['WordPress / CMS', /\b(wordpress|elementor|divi|wp\s+developer|woocommerce|wordpress\s+theme|wordpress\s+plugin|wordpress\s+site)\b/i],
    ['Website Redesign', /\b(website\s+redesign|redesign\s+(?:my|our|existing)\s+website|revamp\s+(?:my|our)?\s*website|modernize\s+website|improve\s+website)\b/i],
    ['Landing Page', /\b(landing\s+page|sales\s+page|lead\s+generation\s+page|conversion\s+page)\b/i],
    ['Web Application / SaaS', /\b(web\s+app(?:lication)?|saas\s+(?:app|platform|portal)|full[\s-]?stack\s+(?:developer|engineer)|front[\s-]?end\s+(?:developer|engineer)|react\s+(?:developer|app)|next\.?js|node\.?js|laravel|django|portal\s+development|booking\s+system|crm\s+web)\b/i],
    ['Website Maintenance / SEO Tech', /\b(website\s+maintenance|site\s+maintenance|fix\s+(?:my|our)?\s*website|wordpress\s+maintenance|website\s+speed|core\s+web\s+vitals|website\s+migration)\b/i],
    ['IT / Software Project', /\b(api\s+integration|custom\s+software|cloud\s+portal|cms\s+development|mobile\s+and\s+web)\b/i],
  ];

  const matchedKeywords: string[] = [];
  for (const [label, rx] of keywordChecks) {
    if (rx.test(combined)) matchedKeywords.push(label);
  }

  if (matchedKeywords.length === 0) {
    return {
      relevant: false,
      matchedKeywords: [],
      rejectionReason: 'Rejected: Not relevant to website development, web design, e-commerce, WordPress, web apps, or IT services.',
    };
  }

  return { relevant: true, matchedKeywords, rejectionReason: null };
}

/**
 * Classifies an opportunity into one of the 10 mandatory Nexus Client Finder categories.
 */
export function classifyNexusLeadCategory(
  title: string,
  description: string,
  advertiserType: 'person' | 'company' | 'unknown'
): NexusLeadCategory {
  const text = `${title || ''} ${description || ''}`.toLowerCase();

  if (/\b(e-?commerce|online\s+store|online\s+shop|shopify|woocommerce|magento|prestashop|marketplace\s+store)\b/i.test(text)) {
    return 'ecommerce_website_request';
  }
  if (/\b(wordpress|elementor|divi|wp\s+theme|wp\s+plugin|wp\s+site|wp\s+developer)\b/i.test(text)) {
    return 'wordpress_website_request';
  }
  if (/\b(redesign|revamp|rebrand\s+website|modernize\s+(?:our|my)?\s*website|rebuild\s+(?:our|my)?\s*website|improve\s+(?:our|my)?\s*website)\b/i.test(text)) {
    return 'website_redesign_improvement';
  }
  if (/\b(landing\s+page|squeeze\s+page|sales\s+funnel\s+page|product\s+launch\s+page)\b/i.test(text)) {
    return 'landing_page_development';
  }
  if (/\b(website\s+maintenance|site\s+maintenance|ongoing\s+website\s+support|fix\s+(?:bugs?\s+on\s+)?(?:my|our)\s+website|website\s+speed\s+optimization|website\s+security\s+update)\b/i.test(text)) {
    return 'website_maintenance';
  }
  if (/\b(web\s+app(?:lication)?|saas|dashboard\s+app|booking\s+platform|client\s+portal|react|next\.?js|vue|angular|full[\s-]?stack|laravel|django|node\.?js)\b/i.test(text)) {
    return 'web_application_development';
  }
  if (/\b(business\s+website|company\s+website|corporate\s+website|agency\s+website|clinic\s+website|restaurant\s+website|real\s+estate\s+website|law\s+firm\s+website)\b/i.test(text)) {
    return 'business_website_creation';
  }
  if (/\b(website|web\s+developer|web\s+designer|web\s+site)\b/i.test(text)) {
    return advertiserType === 'person'
      ? 'person_looking_for_web_developer'
      : 'company_looking_for_web_developer';
  }
  return 'other_it_projects';
}

/**
 * Infers priority country, region group, and city from explicit location metadata + ad text.
 */
export function detectPriorityCountryAndCity(
  rawLocation: string,
  title: string,
  description: string
): {
  country: string;
  city: string;
  regionGroup: NexusClientLead['regionGroup'];
  isPriorityMarket: boolean;
} {
  const combined = `${rawLocation || ''} ${title || ''} ${description || ''}`;
  for (const rule of PRIORITY_COUNTRY_RULES) {
    if (rule.patterns.test(combined)) {
      let city = 'Not specified';
      if (rule.cities) {
        const hit = rule.cities.find((c) => c.pattern.test(combined));
        if (hit) city = hit.name;
      }
      return {
        country: rule.country,
        city,
        regionGroup: rule.regionGroup,
        isPriorityMarket: true,
      };
    }
  }

  if (/\b(europe|eu\b|emea|schengen)\b/i.test(combined)) {
    return {
      country: 'Europe (Multi-Country)',
      city: 'Remote / EU',
      regionGroup: 'Europe',
      isPriorityMarket: true,
    };
  }
  if (/\b(middle\s+east|gcc|gulf)\b/i.test(combined)) {
    return {
      country: 'Middle East / GCC',
      city: 'Regional',
      regionGroup: 'GCC / Middle East',
      isPriorityMarket: true,
    };
  }

  return {
    country: rawLocation && rawLocation.trim().length > 1 ? rawLocation.trim().slice(0, 60) : 'International / Remote',
    city: 'Remote / Not specified',
    regionGroup: 'Global / Remote',
    isPriorityMarket: false,
  };
}

/**
 * Strict email validation and classification (NEVER invents emails; NEVER marks personal emails as business).
 */
export function extractAndClassifyPublicEmails(
  rawText: string,
  officialWebsiteUrl?: string | null,
  mxVerifiedDomains?: Set<string>
): {
  email: string | null;
  classification: NexusEmailClassification;
  domain: string | null;
  mxVerified: boolean;
} {
  const matches = String(rawText || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}/g) || [];
  const uniqueClean: string[] = [];
  const seen = new Set<string>();

  for (const m of matches) {
    const email = m.trim().toLowerCase().replace(/[.,;:)>\]]+$/, '');
    if (!email || seen.has(email)) continue;
    const parts = email.split('@');
    if (parts.length !== 2) continue;
    const [localPart, domain] = parts;
    if (!localPart || localPart.length > 64 || !domain || domain.length > 120) continue;
    if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(domain)) continue;
    if (/^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|bounce)/i.test(localPart)) continue;
    if (DISPOSABLE_OR_PLACEHOLDER_DOMAINS.has(domain)) continue;
    seen.add(email);
    uniqueClean.push(email);
  }

  if (uniqueClean.length === 0) {
    return {
      email: null,
      classification: 'no_public_email',
      domain: null,
      mxVerified: false,
    };
  }

  let websiteHost = '';
  if (officialWebsiteUrl) {
    try {
      websiteHost = new URL(officialWebsiteUrl).hostname.toLowerCase().replace(/^www\./, '');
    } catch {}
  }

  // Prefer corporate domain emails over personal emails if multiple public emails appear
  const sorted = [...uniqueClean].sort((a, b) => {
    const domA = a.split('@')[1];
    const domB = b.split('@')[1];
    const persA = FREE_PERSONAL_EMAIL_DOMAINS.has(domA) ? 1 : 0;
    const persB = FREE_PERSONAL_EMAIL_DOMAINS.has(domB) ? 1 : 0;
    if (persA !== persB) return persA - persB;
    const matchA = websiteHost && (domA === websiteHost || domA.endsWith(`.${websiteHost}`)) ? 0 : 1;
    const matchB = websiteHost && (domB === websiteHost || domB.endsWith(`.${websiteHost}`)) ? 0 : 1;
    return matchA - matchB;
  });

  const chosen = sorted[0];
  const domain = chosen.split('@')[1];
  const isPersonal = FREE_PERSONAL_EMAIL_DOMAINS.has(domain);
  const mxVerified = Boolean(mxVerifiedDomains && mxVerifiedDomains.has(domain));
  const matchesOfficialWebsite = Boolean(
    websiteHost && (domain === websiteHost || domain.endsWith(`.${websiteHost}`))
  );

  if (isPersonal) {
    return {
      email: chosen,
      classification: 'personal_email',
      domain,
      mxVerified,
    };
  }

  if (mxVerified || matchesOfficialWebsite) {
    return {
      email: chosen,
      classification: 'verified_business_email',
      domain,
      mxVerified,
    };
  }

  return {
    email: chosen,
    classification: 'unverified_business_email',
    domain,
    mxVerified: false,
  };
}

/**
 * Extracts public business phone numbers ONLY when explicitly present in the public listing or contact page.
 */
export function extractPublicPhoneFromText(rawText: string): string | null {
  const match = String(rawText || '').match(
    /(?:\+|00)(?:971|966|974|965|973|968|44|49|33|31|353|46|47|45|41|34|39|43|32|358|48|351|1|61)[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,4}\d{2,5}/
  );
  if (!match) return null;
  const cleaned = match[0].trim();
  const digitCount = cleaned.replace(/\D/g, '').length;
  return digitCount >= 9 && digitCount <= 15 ? cleaned : null;
}

/**
 * Computes canonical deduplication fingerprint across different public sources.
 */
export function computeNexusLeadFingerprint(
  title: string,
  advertiserName: string,
  originalSourceUrl: string,
  publicEmail?: string | null
): string {
  const norm = (s: string) =>
    String(s || '')
      .toLowerCase()
      .replace(/https?:\/\/(www\.)?/g, '')
      .replace(/[?#].*$/, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const urlKey = norm(originalSourceUrl);
  const titleKey = norm(title).slice(0, 80);
  const advKey = norm(advertiserName).slice(0, 48);
  const emailKey = publicEmail ? publicEmail.trim().toLowerCase() : '';
  return `${advKey}|${titleKey}|${emailKey || urlKey}`.slice(0, 220);
}

/**
 * Checks whether an email or advertiser domain is on the permanent Do-Not-Contact suppression list.
 */
export function isEmailSuppressed(
  email: string | null | undefined,
  suppressionList: NexusSuppressionEntry[]
): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  const dom = clean.split('@')[1] || '';
  return suppressionList.some((entry) => {
    if (entry.email && entry.email.toLowerCase() === clean) return true;
    if (
      entry.domain &&
      dom &&
      !FREE_PERSONAL_EMAIL_DOMAINS.has(dom) &&
      entry.domain.toLowerCase() === dom
    ) {
      return true;
    }
    return false;
  });
}

/**
 * Generates a short, natural, non-deceptive outreach proposal for Nexus IT Solutions
 * directly grounded in the actual scraped advertisement and requirements.
 * NEVER fabricates prior contact or past experience with the recipient.
 */
export function generateNexusProposalMessage(
  lead: Pick<
    NexusClientLead,
    | 'title'
    | 'advertiserName'
    | 'country'
    | 'category'
    | 'originalAdText'
    | 'projectRequirements'
    | 'estimatedBudget'
    | 'emailClassification'
  >,
  templateType: NexusMessageTemplateType
): NexusGeneratedMessage {
  const greetingName =
    lead.advertiserName &&
    !/^(individual client|client|unknown|public advertiser|anonymous)/i.test(lead.advertiserName)
      ? lead.advertiserName
      : 'Team';

  const topReqs =
    lead.projectRequirements && lead.projectRequirements.length > 0
      ? lead.projectRequirements.slice(0, 3).join(', ')
      : lead.title;

  const shortTitle = lead.title.length > 72 ? `${lead.title.slice(0, 69)}...` : lead.title;

  let subject = '';
  let body = '';

  switch (templateType) {
    case 'ecommerce_development':
      subject = `E-Commerce Development Support for "${shortTitle}" — Nexus IT Solutions`;
      body = `Hello ${greetingName},\n\nI saw your recent public listing regarding "${lead.title}".\n\nAt Nexus IT Solutions, we build fast, conversion-focused e-commerce websites (Shopify, WooCommerce, and custom online stores) with secure checkout, mobile optimization, and clear product management.\n\nBased on what you shared (${topReqs}), we can help deliver a clean storefront tailored to your workflow and timeline. If you are still reviewing options, I would be glad to share a short scope breakdown and estimated timeline.\n\nBest regards,\nNexus IT Solutions`;
      break;

    case 'business_website':
      subject = `Business Website Proposal for ${greetingName} — Nexus IT Solutions`;
      body = `Hello ${greetingName},\n\nI came across your recent announcement about "${lead.title}".\n\nNexus IT Solutions specializes in modern, responsive business websites built for clarity, fast loading speed, and lead generation. Looking at your requirements (${topReqs}), we can structure a clean, easy-to-manage website aligned with your brand.\n\nWould you like me to send over a brief outline of deliverables and pricing options?\n\nBest regards,\nNexus IT Solutions`;
      break;

    case 'website_redesign':
      subject = `Website Redesign Proposal — "${shortTitle}"`;
      body = `Hello ${greetingName},\n\nI noticed your recent request regarding "${lead.title}".\n\nAt Nexus IT Solutions, we redesign and modernize existing websites to improve mobile usability, loading performance, visual credibility, and conversion rates—without disrupting your live business operations.\n\nSpecifically for your goals (${topReqs}), I can put together a concise redesign plan and timeline if you are still taking proposals.\n\nBest regards,\nNexus IT Solutions`;
      break;

    case 'follow_up':
      subject = `Following up on "${shortTitle}" — Nexus IT Solutions`;
      body = `Hello ${greetingName},\n\nI am writing to follow up briefly regarding your recent public request for "${lead.title}".\n\nIf you are still looking for a reliable web development partner to handle ${topReqs}, Nexus IT Solutions would be happy to share a concise scope and timeline tailored to your goals. If you have already filled this need, please let me know and I will close my notes.\n\nBest regards,\nNexus IT Solutions`;
      break;

    case 'website_development':
    default:
      subject = `Web Development Support for "${shortTitle}" — Nexus IT Solutions`;
      body = `Hello ${greetingName},\n\nI saw your recent public post about "${lead.title}".\n\nAt Nexus IT Solutions, we design and build custom websites, WordPress platforms, and web applications focused on reliability, speed, and clean user experience. From your stated requirements (${topReqs}), we can help take this project from structure to launch with transparent milestones.\n\nIf the project is still open, please reply with any additional details and I will send a clear, no-obligation proposal.\n\nBest regards,\nNexus IT Solutions`;
      break;
  }

  const privacyNotice =
    lead.emailClassification === 'personal_email'
      ? 'Compliance Notice: This contact uses a personal email address. Confirm lawful basis and consent under applicable privacy/electronic marketing laws (e.g., GDPR, PECR, CAN-SPAM, UAE PDPL) before contacting.'
      : 'Human Review Required: Review and personalize this draft before clicking Send inside Gmail. Nexus IT Solutions never sends automated unsolicited emails.';

  return {
    templateType,
    subject,
    body,
    generatedBy: 'deterministic_nexus_assistant',
    privacyNotice,
  };
}

/**
 * Builds a standard Gmail Web Compose URL for a SINGLE client (never sends automatically).
 */
export function buildSingleClientGmailComposeUrl(params: {
  recipientEmail: string;
  subject: string;
  body: string;
}): string {
  const qs = new URLSearchParams();
  qs.set('view', 'cm');
  qs.set('fs', '1');
  if (params.recipientEmail) qs.set('to', params.recipientEmail.trim());
  if (params.subject) qs.set('su', params.subject);
  if (params.body) qs.set('body', params.body);
  return `https://mail.google.com/mail/?${qs.toString()}`;
}

/**
 * Builds privacy-safe BCC-only Gmail Compose batches for MULTIPLE selected leads.
 * - Uses BCC ONLY (never `to` or `cc`) so recipients NEVER see one another's email addresses.
 * - Splits into manageable batches (max 25 per batch) and NEVER silently discards selected recipients.
 * - Never sends automatically.
 */
export function buildBulkBccGmailBatches(params: {
  leads: NexusClientLead[];
  subject: string;
  body: string;
  suppressionList: NexusSuppressionEntry[];
  maxPerBatch?: number;
  allowAlreadyContacted?: boolean;
}): {
  batches: NexusGmailBatch[];
  includedCount: number;
  excludedNoEmail: NexusClientLead[];
  excludedSuppressed: NexusClientLead[];
  excludedAlreadyContacted: NexusClientLead[];
} {
  const maxPerBatch = Math.max(1, Math.min(50, params.maxPerBatch || NEXUS_GMAIL_MAX_BCC_PER_BATCH));
  const excludedNoEmail: NexusClientLead[] = [];
  const excludedSuppressed: NexusClientLead[] = [];
  const excludedAlreadyContacted: NexusClientLead[] = [];
  const eligible: Array<{
    leadId: string;
    email: string;
    advertiserName: string;
    emailClassification: NexusEmailClassification;
  }> = [];
  const seenEmails = new Set<string>();

  for (const lead of params.leads) {
    if (!lead.publicEmail) {
      excludedNoEmail.push(lead);
      continue;
    }
    if (lead.suppressed || lead.contactStatus === 'do_not_contact' || isEmailSuppressed(lead.publicEmail, params.suppressionList)) {
      excludedSuppressed.push(lead);
      continue;
    }
    if (!params.allowAlreadyContacted && (lead.contactCount > 0 || lead.contactStatus === 'contacted')) {
      excludedAlreadyContacted.push(lead);
      continue;
    }
    const cleanEmail = lead.publicEmail.trim().toLowerCase();
    if (seenEmails.has(cleanEmail)) continue;
    seenEmails.add(cleanEmail);
    eligible.push({
      leadId: lead.id,
      email: cleanEmail,
      advertiserName: lead.advertiserName,
      emailClassification: lead.emailClassification,
    });
  }

  const totalBatches = eligible.length === 0 ? 0 : Math.ceil(eligible.length / maxPerBatch);
  const batches: NexusGmailBatch[] = [];

  for (let i = 0; i < eligible.length; i += maxPerBatch) {
    const slice = eligible.slice(i, i + maxPerBatch);
    const bccList = slice.map((r) => r.email);
    const qs = new URLSearchParams();
    qs.set('view', 'cm');
    qs.set('fs', '1');
    // Strictly BCC so recipients NEVER see each other's emails
    qs.set('bcc', bccList.join(','));
    if (params.subject) qs.set('su', params.subject);
    if (params.body) qs.set('body', params.body);

    batches.push({
      batchIndex: Math.floor(i / maxPerBatch) + 1,
      totalBatches,
      recipients: slice,
      bccList,
      gmailComposeUrl: `https://mail.google.com/mail/?${qs.toString()}`,
    });
  }

  return {
    batches,
    includedCount: eligible.length,
    excludedNoEmail,
    excludedSuppressed,
    excludedAlreadyContacted,
  };
}

/**
 * Generates RFC-4180 CSV export for Gmail Mail Merge / Sheets workflow.
 */
export function buildSelectedLeadsCsv(
  leads: NexusClientLead[],
  templateType: NexusMessageTemplateType = 'website_development'
): string {
  const escapeCsv = (val: string | null | undefined) => {
    const s = String(val ?? '');
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const headers = [
    'Email',
    'Email_Classification',
    'Advertiser_Name',
    'Country',
    'City',
    'Category',
    'Published_At_UTC',
    'Budget_If_Advertised',
    'Contact_Status',
    'Proposed_Subject',
    'Personalized_Message',
    'Official_Website',
    'Original_Source_URL',
  ];

  const rows = leads.map((lead) => {
    const draft = generateNexusProposalMessage(lead, templateType);
    return [
      lead.publicEmail || '',
      NEXUS_EMAIL_CLASSIFICATION_LABELS[lead.emailClassification],
      lead.advertiserName,
      lead.country,
      lead.city,
      lead.categoryLabel,
      lead.publishedAt,
      lead.estimatedBudget || '',
      NEXUS_CONTACT_STATUS_LABELS[lead.contactStatus],
      draft.subject,
      draft.body,
      lead.officialWebsiteUrl || '',
      lead.originalSourceUrl,
    ]
      .map(escapeCsv)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}
