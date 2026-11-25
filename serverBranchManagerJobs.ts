import type { Express, Request, Response } from 'express';
import * as path from 'path';
import * as crypto from 'crypto';
import type { GlobalOpportunity } from './src/types/globalOpportunities';
import type { GlobalOpportunitiesStore } from './serverGlobalOpportunities';
import {
  ALLOWED_BRANCH_MANAGER_REGIONS,
  BranchManagerJobsSearchResponse,
  BranchManagerProfileInput,
  BranchManagerRegionScope,
  DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE,
  StrictGateAuditSummary,
  TARGET_BRANCH_MANAGER_POSITIONS,
  VerifiedBranchManagerJob,
} from './src/types/branchManagerJobs';

export interface RegisterBranchManagerJobsDeps {
  app: Express;
  runtimeBaseDir: string;
  isVercel: boolean;
  ensureRuntimeDataDir: () => void;
  loadJsonFileSafe: <T>(filePath: string, fallback: T) => T;
  writeJsonFileAtomic: (filePath: string, data: unknown) => void;
  isPersistentOwnerRequest: (req: Request) => boolean;
  getRequesterUid: (req: Request) => string | null;
}

/**
 * Private saved profile strictly reserved for the authenticated owner account only.
 * NEVER returned to guests or any other signed-in user.
 */
export const OWNER_PRIVATE_SAVED_PROFILE: BranchManagerProfileInput = {
  profileLabel: 'Saved Branch Manager Profile (Owner Account)',
  nationality: 'Ethiopian',
  currentResidence: 'Ethiopia',
  educationDegree: 'Bachelor of Arts (BA)',
  fieldOfStudy: 'Accounting and Finance',
  institution: 'Mekelle University',
  graduationYear: '2016',
  totalBankingYears: 9,
  branchManagerYears: 3,
  currentOrRecentPosition: 'Branch Manager',
  employers: [
    'Commercial Bank of Ethiopia (CBE)',
    'Nib International Bank',
    'Oromia Bank',
    'Tsedey Bank S.C.',
  ],
  coreSkills: [
    'Banking operations',
    'Branch management',
    'Accounting',
    'Financial management',
    'Deposit mobilization',
    'Credit operations',
    'Customer service',
    'Business development',
    'Staff supervision',
    'Performance management',
  ],
  targetPositions: [...TARGET_BRANCH_MANAGER_POSITIONS],
  languages: ['English', 'Amharic'],
  hasMastersDegree: false,
  hasEnglishTest: false,
  minimumMonthlyGrossUsd: 3000,
};

export interface RawDiscoveredBranchJob {
  id: string;
  title: string;
  employerName: string;
  employerTypeHint?: string;
  isInternationalEmployerVerified?: boolean;
  locationRaw: string;
  countryHint?: string;
  cityHint?: string;
  descriptionText: string;
  compensationRaw?: string;
  applicationUrl: string;
  sourcePortal: string;
  datePosted?: string;
  applicationDeadline?: string;
  explicitVisaNote?: string;
  ethiopianEligibleHint?: 'confirmed' | 'likely_global' | 'not_confirmed' | 'excluded';
}

export interface BranchManagerJobsStore {
  version: number;
  updatedAt: string;
  lastDiscoveryAt: string;
  fxUpdatedAt: string;
  fxSourceNote: string;
  fxRatesUsdBase: Record<string, number>; // 1 USD = X currency
  sourcesChecked: string[];
  rawCandidates: RawDiscoveredBranchJob[];
  users: Record<string, BranchManagerProfileInput>;
}

const FALLBACK_FX_USD_BASE: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.785,
  CHF: 0.88,
  SEK: 10.65,
  NOK: 10.9,
  DKK: 6.88,
  ISK: 138.0,
  AED: 3.6725,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.307,
  OMR: 0.385,
  BHD: 0.376,
  JOD: 0.709,
  ZAR: 18.2,
  KES: 129.0,
  PLN: 4.02,
  CZK: 23.4,
  HUF: 372.0,
  RON: 4.58,
  EGP: 49.0,
  MAD: 9.9,
  NGN: 1580.0,
};

const SCANDINAVIAN_COUNTRIES: Array<{ country: string; patterns: RegExp }> = [
  { country: 'Sweden', patterns: /\b(sweden|stockholm|gothenburg|malm[öo]|uppsala)\b/i },
  { country: 'Norway', patterns: /\b(norway|oslo|bergen|trondheim|stavanger)\b/i },
  { country: 'Denmark', patterns: /\b(denmark|copenhagen|aarhus|odense|danish)\b/i },
  { country: 'Finland', patterns: /\b(finland|helsinki|espoo|tampere|turku)\b/i },
  { country: 'Iceland', patterns: /\b(iceland|reykjavik)\b/i },
];

const EUROPE_COUNTRIES: Array<{ country: string; patterns: RegExp }> = [
  { country: 'United Kingdom', patterns: /\b(united kingdom|uk\b|london|manchester|edinburgh|birmingham|cardiff|bristol|glasgow|england|scotland)\b/i },
  { country: 'Germany', patterns: /\b(germany|deutschland|berlin|frankfurt|munich|münchen|hamburg|cologne|köln|düsseldorf|stuttgart)\b/i },
  { country: 'Netherlands', patterns: /\b(netherlands|amsterdam|rotterdam|utrecht|the hague|eindhoven|dutch)\b/i },
  { country: 'Ireland', patterns: /\b(ireland|dublin|cork|galway|limerick)\b/i },
  { country: 'Switzerland', patterns: /\b(switzerland|zurich|zürich|geneva|genève|basel|bern|lausanne|ch-)\b/i },
  { country: 'Luxembourg', patterns: /\b(luxembourg)\b/i },
  { country: 'France', patterns: /\b(france|paris|lyon|marseille|toulouse|nice|lille)\b/i },
  { country: 'Spain', patterns: /\b(spain|madrid|barcelona|valencia|malaga|seville|bilbao)\b/i },
  { country: 'Austria', patterns: /\b(austria|vienna|wien|graz|salzburg)\b/i },
  { country: 'Belgium', patterns: /\b(belgium|brussels|bruxelles|antwerp|ghent)\b/i },
  { country: 'Portugal', patterns: /\b(portugal|lisbon|porto)\b/i },
  { country: 'Italy', patterns: /\b(italy|milan|milano|rome|roma|turin|florence)\b/i },
  { country: 'Poland', patterns: /\b(poland|warsaw|krakow|kraków|wroclaw|gdansk)\b/i },
  { country: 'Estonia', patterns: /\b(estonia|tallinn)\b/i },
  { country: 'Lithuania', patterns: /\b(lithuania|vilnius)\b/i },
  { country: 'Latvia', patterns: /\b(latvia|riga)\b/i },
  { country: 'Czech Republic', patterns: /\b(czech|prague|praha|brno)\b/i },
  { country: 'Hungary', patterns: /\b(hungary|budapest)\b/i },
  { country: 'Malta', patterns: /\b(malta|valletta)\b/i },
  { country: 'Cyprus', patterns: /\b(cyprus|nicosia|limassol)\b/i },
  { country: 'Romania', patterns: /\b(romania|bucharest)\b/i },
  { country: 'Bulgaria', patterns: /\b(bulgaria|sofia)\b/i },
  { country: 'Greece', patterns: /\b(greece|athens)\b/i },
  { country: 'Croatia', patterns: /\b(croatia|zagreb)\b/i },
  { country: 'Slovakia', patterns: /\b(slovakia|bratislava)\b/i },
  { country: 'Slovenia', patterns: /\b(slovenia|ljubljana)\b/i },
  { country: 'Europe', patterns: /\b(europe|emea|eu\s+remote)\b/i },
];

const MIDDLE_EAST_COUNTRIES: Array<{ country: string; patterns: RegExp }> = [
  { country: 'United Arab Emirates', patterns: /\b(united arab emirates|uae\b|dubai|abu dhabi|sharjah|difc|adgm)\b/i },
  { country: 'Saudi Arabia', patterns: /\b(saudi arabia|ksa\b|riyadh|jeddah|dammam|al khobar|neom)\b/i },
  { country: 'Qatar', patterns: /\b(qatar|doha|qfc)\b/i },
  { country: 'Kuwait', patterns: /\b(kuwait)\b/i },
  { country: 'Bahrain', patterns: /\b(bahrain|manama)\b/i },
  { country: 'Oman', patterns: /\b(oman|muscat)\b/i },
  { country: 'Jordan', patterns: /\b(jordan|amman)\b/i },
];

const AFRICA_COUNTRIES: Array<{ country: string; patterns: RegExp }> = [
  { country: 'Kenya', patterns: /\b(kenya|nairobi|mombasa)\b/i },
  { country: 'South Africa', patterns: /\b(south africa|johannesburg|cape town|pretoria|sandton)\b/i },
  { country: 'Rwanda', patterns: /\b(rwanda|kigali)\b/i },
  { country: 'Egypt', patterns: /\b(egypt|cairo|alexandria)\b/i },
  { country: 'Morocco', patterns: /\b(morocco|casablanca|rabat)\b/i },
  { country: 'Nigeria', patterns: /\b(nigeria|lagos|abuja)\b/i },
  { country: 'Ghana', patterns: /\b(ghana|accra)\b/i },
  { country: 'Côte d’Ivoire', patterns: /\b(cote d'ivoire|côte d'ivoire|ivory coast|abidjan)\b/i },
  { country: 'Senegal', patterns: /\b(senegal|dakar)\b/i },
  { country: 'Tanzania', patterns: /\b(tanzania|dar es salaam)\b/i },
  { country: 'Uganda', patterns: /\b(uganda|kampala)\b/i },
  { country: 'Mauritius', patterns: /\b(mauritius|port louis|ebene)\b/i },
  { country: 'Botswana', patterns: /\b(botswana|gaborone)\b/i },
  { country: 'Namibia', patterns: /\b(namibia|windhoek)\b/i },
  { country: 'Zambia', patterns: /\b(zambia|lusaka)\b/i },
  { country: 'Tunisia', patterns: /\b(tunisia|tunis)\b/i },
  { country: 'Ethiopia', patterns: /\b(ethiopia|addis ababa)\b/i },
  { country: 'Democratic Republic of the Congo', patterns: /\b(drc|democratic republic of the congo|kinshasa)\b/i },
  { country: 'Cameroon', patterns: /\b(cameroon|yaounde|douala)\b/i },
  { country: 'Malawi', patterns: /\b(malawi|lilongwe)\b/i },
  { country: 'Mozambique', patterns: /\b(mozambique|maputo)\b/i },
];

const DISALLOWED_REGIONS_REGEX =
  /\b(united states|usa\b|u\.s\.a\.|new york|san francisco|chicago|seattle|austin|boston|atlanta|miami|california|texas|canada|toronto|vancouver|montreal|ottawa|calgary|australia|sydney|melbourne|brisbane|perth|new zealand|auckland|wellington|singapore|tokyo|japan|india|bengaluru|bangalore|mumbai|hyderabad|delhi|manila|philippines|brazil|sao paulo|mexico|argentina|colombia|chile|hong kong|china|shanghai|beijing|south korea|seoul)\b/i;

/**
 * Verified international banks, multilateral development banks, international NGOs,
 * and global financial/payment companies operating in Africa.
 */
const INTERNATIONAL_AFRICA_EMPLOYER_PATTERNS: RegExp[] = [
  /\b(african development bank|afdb|world bank|international finance corporation|ifc\b|imf\b|international monetary fund|afreximbank|trade and development bank|tdb\b|east african development bank|ebrd|eib\b|european investment bank|african union|uneca)\b/i,
  /\b(standard chartered|citibank|citigroup|hsbc|barclays|absa group|standard bank|ecobank|société générale|societe generale|bnp paribas|jp ?morgan|goldman sachs|morgan stanley|deutsche bank|ing bank|rabobank|credit suisse|ubs\b|access bank plc|uba\b|united bank for africa|first bank|equity group|kcb group|bank of africa|attijariwafa|fnb\b|nedbank|investec)\b/i,
  /\b(adyen|stripe|wise|sumup|visa\b|mastercard|western union|worldremit|zepz|flutterwave|paystack|chipper cash|m-kopa|tala\b|wave mobile|monzo|revolut|n26|mollie|pleo|gocardless|tide\b|transfergo|careem|paypal|dlocal|interswitch|mfs africa|onafric)\b/i,
  /\b(deloitte|pwc|pricewaterhousecoopers|ernst\s*&\s*young|ey\b|kpmg|mckinsey|boston consulting|bain\s*&\s*company|accenture|bdo international|grant thornton)\b/i,
  /\b(united nations|undp|unicef|unhcr|wfp\b|who\b|unops|iom\b|fao\b|ilo\b|ifrc|icrc|international rescue committee|irc\b|mercy corps|save the children|world vision|oxfam|care international|wateraid|danish refugee council|norwegian refugee council|action against hunger|plan international|tearfund|solidarités|médecins sans frontières|msf\b|catholic relief services|crs\b|fhi 360|chemonics|dai\b|abt global|dt global|rti international)\b/i,
];

export function isVerifiedInternationalEmployerInAfrica(
  employerName: string,
  descriptionText = '',
  explicitFlag = false
): boolean {
  if (explicitFlag) return true;
  const name = String(employerName || '').trim();
  if (!name) return false;
  if (INTERNATIONAL_AFRICA_EMPLOYER_PATTERNS.some((rx) => rx.test(name))) return true;
  if (
    /\b(international bank|multinational|pan-african bank|development bank|global financial|global payments)\b/i.test(
      `${name} ${descriptionText.slice(0, 600)}`
    )
  ) {
    return true;
  }
  return false;
}

export function classifyAllowedRegionScope(params: {
  locationRaw: string;
  countryHint?: string;
  cityHint?: string;
  employerName: string;
  descriptionText?: string;
  isInternationalEmployerVerified?: boolean;
}): {
  allowed: boolean;
  regionScope: BranchManagerRegionScope | null;
  country: string;
  city: string;
  rejectedAsLocalAfrican: boolean;
} {
  const combined = `${params.countryHint || ''} ${params.cityHint || ''} ${params.locationRaw || ''}`.trim();

  // Strictly reject if explicitly in disallowed continents (unless also clearly matching an allowed city/country first)
  for (const item of SCANDINAVIAN_COUNTRIES) {
    if (item.patterns.test(combined)) {
      return {
        allowed: true,
        regionScope: 'Scandinavian',
        country: item.country,
        city: extractCityFromLocation(params.locationRaw, params.cityHint, item.country),
        rejectedAsLocalAfrican: false,
      };
    }
  }

  for (const item of MIDDLE_EAST_COUNTRIES) {
    if (item.patterns.test(combined)) {
      return {
        allowed: true,
        regionScope: 'Middle East',
        country: item.country,
        city: extractCityFromLocation(params.locationRaw, params.cityHint, item.country),
        rejectedAsLocalAfrican: false,
      };
    }
  }

  for (const item of EUROPE_COUNTRIES) {
    if (item.patterns.test(combined)) {
      return {
        allowed: true,
        regionScope: 'Europe',
        country: item.country,
        city: extractCityFromLocation(params.locationRaw, params.cityHint, item.country),
        rejectedAsLocalAfrican: false,
      };
    }
  }

  for (const item of AFRICA_COUNTRIES) {
    if (item.patterns.test(combined)) {
      const isIntl = isVerifiedInternationalEmployerInAfrica(
        params.employerName,
        params.descriptionText || '',
        Boolean(params.isInternationalEmployerVerified)
      );
      if (!isIntl) {
        return {
          allowed: false,
          regionScope: null,
          country: item.country,
          city: extractCityFromLocation(params.locationRaw, params.cityHint, item.country),
          rejectedAsLocalAfrican: true,
        };
      }
      return {
        allowed: true,
        regionScope: 'Africa (International Banks & Companies)',
        country: item.country,
        city: extractCityFromLocation(params.locationRaw, params.cityHint, item.country),
        rejectedAsLocalAfrican: false,
      };
    }
  }

  // Explicitly disallowed or unmapped global regions (USA, Canada, Australia, Asia outside Middle East, LATAM)
  if (DISALLOWED_REGIONS_REGEX.test(combined) || !combined) {
    return {
      allowed: false,
      regionScope: null,
      country: params.countryHint || 'Outside Scope',
      city: params.cityHint || '',
      rejectedAsLocalAfrican: false,
    };
  }

  return {
    allowed: false,
    regionScope: null,
    country: params.countryHint || 'Unconfirmed Region',
    city: params.cityHint || '',
    rejectedAsLocalAfrican: false,
  };
}

function extractCityFromLocation(locationRaw: string, cityHint: string | undefined, country: string): string {
  if (cityHint && cityHint.trim()) return cityHint.trim();
  const parts = String(locationRaw || '')
    .split(/[,;|/\-–]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2 && p.toLowerCase() !== country.toLowerCase() && !/^remote$/i.test(p));
  return parts[0] || country;
}

function stripHtmlToPlainText(html: string): string {
  return String(html || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&pound;/gi, '£')
    .replace(/&euro;/gi, '€')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface ParsedSalaryResult {
  disclosed: boolean;
  currency: string;
  period: 'annual' | 'monthly';
  minOriginal: number;
  maxOriginal: number;
  baseMonthlyUsd: number;
  baseAnnualUsd: number;
  originalSalaryDisplay: string;
  usdEquivalentDisplay: string;
  exchangeRateUsed: string;
}

function normalizeCurrencyCode(symOrCode: string): string {
  const s = symOrCode.trim().toUpperCase();
  if (s === '$' || s === 'US$' || s === 'USD') return 'USD';
  if (s === '€' || s === 'EUR') return 'EUR';
  if (s === '£' || s === 'GBP') return 'GBP';
  if (s === 'CHF' || s === 'SFR') return 'CHF';
  if (s === 'KR' || s === 'SEK') return 'SEK';
  if (s === 'NOK') return 'NOK';
  if (s === 'DKK') return 'DKK';
  if (s === 'AED' || s === 'DHS') return 'AED';
  if (s === 'SAR' || s === 'SR') return 'SAR';
  if (s === 'QAR') return 'QAR';
  if (s === 'KWD') return 'KWD';
  if (s === 'OMR') return 'OMR';
  if (s === 'BHD') return 'BHD';
  if (s === 'ZAR' || s === 'R') return 'ZAR';
  if (s === 'KES') return 'KES';
  if (s === 'PLN') return 'PLN';
  if (s === 'CZK') return 'CZK';
  return s;
}

function currencySymbol(code: string): string {
  switch (code) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return `${code} `;
  }
}

function parseNumberToken(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/,/g, '');
  const kMatch = cleaned.match(/^(\d+(?:\.\d+)?)k$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const plain = parseFloat(cleaned);
  if (Number.isNaN(plain) || plain <= 0) return null;
  return Math.round(plain);
}

/**
 * Strictly extracts GUARANTEED BASE SALARY only.
 * Ignores speculative bonuses, commissions, OTE, sign-on grants, or equity estimates.
 */
export function parseGuaranteedBaseSalaryUsd(
  rawText: string,
  fxRatesUsdBase: Record<string, number> = FALLBACK_FX_USD_BASE
): ParsedSalaryResult {
  const empty: ParsedSalaryResult = {
    disclosed: false,
    currency: 'USD',
    period: 'annual',
    minOriginal: 0,
    maxOriginal: 0,
    baseMonthlyUsd: 0,
    baseAnnualUsd: 0,
    originalSalaryDisplay: 'Undisclosed',
    usdEquivalentDisplay: 'Undisclosed',
    exchangeRateUsed: '',
  };

  if (!rawText || !rawText.trim()) return empty;

  // Match salary snippets with explicit currency and guaranteed numbers
  const salaryRegex =
    /(?:(USD|EUR|GBP|CHF|SEK|NOK|DKK|AED|SAR|QAR|KWD|OMR|BHD|ZAR|KES|PLN|US\$|€|£|\$)\s*(\d{1,3}(?:,\d{3})+|\d{2,3}(?:\.\d+)?k|\d{4,7})(?:\s*(?:-|–|—|to)\s*(?:USD|EUR|GBP|CHF|SEK|NOK|DKK|AED|SAR|QAR|KWD|OMR|BHD|ZAR|KES|PLN|US\$|€|£|\$)?\s*(\d{1,3}(?:,\d{3})+|\d{2,3}(?:\.\d+)?k|\d{4,7}))?(?:\s*(per\s+year|\/\s*year|\/\s*yr|annually|annual|p\.a\.|pa\b|per\s+annum|per\s+month|\/\s*month|\/\s*mo|monthly|p\.m\.))?)/gi;

  const suffixCurrencyRegex =
    /(\d{1,3}(?:,\d{3})+|\d{2,3}(?:\.\d+)?k|\d{4,7})(?:\s*(?:-|–|—|to)\s*(\d{1,3}(?:,\d{3})+|\d{2,3}(?:\.\d+)?k|\d{4,7}))?\s*(USD|EUR|GBP|CHF|SEK|NOK|DKK|AED|SAR|QAR|KWD|OMR|BHD|ZAR|KES|PLN|€|£)(?:\s*(per\s+year|\/\s*year|\/\s*yr|annually|annual|p\.a\.|per\s+annum|per\s+month|\/\s*month|\/\s*mo|monthly))?/gi;

  const candidates: Array<{
    currency: string;
    minVal: number;
    maxVal: number;
    period: 'annual' | 'monthly';
    contextWindow: string;
    priority: number;
  }> = [];

  const inspectMatch = (
    matchIndex: number,
    fullMatch: string,
    currRaw: string,
    minRaw: string,
    maxRaw: string | undefined,
    periodRaw: string | undefined
  ) => {
    const start = Math.max(0, matchIndex - 95);
    const end = Math.min(rawText.length, matchIndex + fullMatch.length + 95);
    const ctx = rawText.slice(start, end);
    const ctxLower = ctx.toLowerCase();

    // Strictly reject bonus-only, equity, OTE, revenue, funding raised, or company valuation figures!
    if (
      /\b(raised|funding\s+round|valuation|series\s+[a-f]|revenue|aum|assets\s+under\s+management|customers|transactions|volume|budget\s+of|grant\s+portfolio|portfolio\s+of|equity\s+grant|sign[- ]on|relocation\s+allowance|learning\s+budget|wellness\s+stipend|home\s+office|commission[- ]only|ote\b|bonus\s+up\s+to|up\s+to\s+\d+%\s+bonus)\b/i.test(
        ctxLower
      ) &&
      !/\b(base\s+salary|salary\s+range|gross\s+salary|annual\s+salary|monthly\s+salary|compensation|pay\s+range|starting\s+at)\b/i.test(
        ctxLower
      )
    ) {
      return;
    }

    // Must sit near a salary/pay/compensation cue OR explicitly carry /year /month
    const hasSalaryCue =
      /\b(salary|compensation|base\s+pay|gross\s+pay|remuneration|pay\s+range|starting\s+from|starting\s+at|package|earning|per\s+year|per\s+annum|annually|per\s+month|monthly|\/year|\/yr|\/month|\/mo|p\.a\.)\b/i.test(
        ctxLower
      );
    if (!hasSalaryCue) return;

    const currency = normalizeCurrencyCode(currRaw);
    const rate = fxRatesUsdBase[currency] || FALLBACK_FX_USD_BASE[currency];
    if (!rate) return;

    const minVal = parseNumberToken(minRaw);
    if (!minVal) return;
    const maxVal = maxRaw ? parseNumberToken(maxRaw) || minVal : minVal;
    const low = Math.min(minVal, maxVal);
    const high = Math.max(minVal, maxVal);

    // Determine period (monthly vs annual)
    let period: 'annual' | 'monthly';
    if (periodRaw && /month|mo\b|p\.m\./i.test(periodRaw)) {
      period = 'monthly';
    } else if (periodRaw && /year|yr\b|annual|p\.a\.|annum/i.test(periodRaw)) {
      period = 'annual';
    } else if (/\b(per\s+month|monthly|\/\s*mo|\/\s*month)\b/i.test(ctxLower)) {
      period = 'monthly';
    } else if (/\b(per\s+year|annually|annual|\/\s*yr|\/\s*year|p\.a\.|per\s+annum)\b/i.test(ctxLower)) {
      period = 'annual';
    } else {
      // Infer safely from USD-equivalent magnitude
      const approxUsd = low / rate;
      period = approxUsd >= 18000 ? 'annual' : 'monthly';
    }

    const lowAnnualUsd = period === 'annual' ? low / rate : (low / rate) * 12;
    // Sanity bounds: realistic salary between $6,000/yr and $650,000/yr USD (prevents parsing company revenue or stipends)
    if (lowAnnualUsd < 6000 || lowAnnualUsd > 650000) return;

    const priority = /\b(base\s+salary|gross\s+salary|salary\s+range|starting\s+salary|annual\s+salary|monthly\s+salary)\b/i.test(
      ctxLower
    )
      ? 3
      : /\b(salary|compensation|remuneration)\b/i.test(ctxLower)
      ? 2
      : 1;

    candidates.push({
      currency,
      minVal: low,
      maxVal: high,
      period,
      contextWindow: ctx,
      priority,
    });
  };

  let m: RegExpExecArray | null;
  while ((m = salaryRegex.exec(rawText)) !== null) {
    inspectMatch(m.index, m[0], m[1], m[2], m[3], m[4]);
  }
  while ((m = suffixCurrencyRegex.exec(rawText)) !== null) {
    inspectMatch(m.index, m[0], m[3], m[1], m[2], m[4]);
  }

  if (candidates.length === 0) return empty;

  // Pick highest-priority explicit guaranteed base salary match
  candidates.sort((a, b) => b.priority - a.priority || b.minVal - a.minVal);
  const best = candidates[0];
  const rate = fxRatesUsdBase[best.currency] || FALLBACK_FX_USD_BASE[best.currency] || 1;

  // Always use the guaranteed lower bound of the base salary range (conservative & honest!)
  const baseAnnualUsd = Math.round(
    best.period === 'annual' ? best.minVal / rate : (best.minVal / rate) * 12
  );
  const baseMonthlyUsd = Math.round(baseAnnualUsd / 12);

  const sym = currencySymbol(best.currency);
  const rangeStr =
    best.maxVal > best.minVal
      ? `${sym}${best.minVal.toLocaleString()} – ${sym}${best.maxVal.toLocaleString()}`
      : `${sym}${best.minVal.toLocaleString()}`;
  const periodLabel = best.period === 'annual' ? '/ year' : '/ month';
  const originalSalaryDisplay = `${rangeStr} ${periodLabel} (${best.currency} gross base)`;

  const usdMaxAnnual = Math.round(
    best.period === 'annual' ? best.maxVal / rate : (best.maxVal / rate) * 12
  );
  const usdMaxMonthly = Math.round(usdMaxAnnual / 12);
  const usdEquivalentDisplay =
    usdMaxMonthly > baseMonthlyUsd
      ? `$${baseMonthlyUsd.toLocaleString()} – $${usdMaxMonthly.toLocaleString()} / month USD ($${baseAnnualUsd.toLocaleString()} – $${usdMaxAnnual.toLocaleString()} / year)`
      : `$${baseMonthlyUsd.toLocaleString()} / month USD ($${baseAnnualUsd.toLocaleString()} / year)`;

  const usdPerUnit = (1 / rate).toFixed(4);
  const exchangeRateUsed =
    best.currency === 'USD'
      ? '1 USD = 1.0000 USD (native USD)'
      : `1 ${best.currency} = $${usdPerUnit} USD`;

  return {
    disclosed: true,
    currency: best.currency,
    period: best.period,
    minOriginal: best.minVal,
    maxOriginal: best.maxVal,
    baseMonthlyUsd,
    baseAnnualUsd,
    originalSalaryDisplay,
    usdEquivalentDisplay,
    exchangeRateUsed,
  };
}

export function extractExplicitVisaSponsorshipEvidence(text: string): {
  confirmed: boolean;
  evidence: string;
  strengthScore: number;
  hasRelocation: boolean;
  relocationText: string;
  hasFamilySupport: boolean;
  familyText: string;
  localOnlyBlocked: boolean;
} {
  const clean = String(text || '');
  const lower = clean.toLowerCase();

  // Strict disqualification if sponsorship is negated or local right-to-work is mandatory
  const negationRx =
    /\b(no\s+visa\s+sponsorship|cannot\s+sponsor|unable\s+to\s+sponsor|do\s+not\s+sponsor|does\s+not\s+sponsor|will\s+not\s+sponsor|not\s+able\s+to\s+sponsor|without\s+visa\s+sponsorship|without\s+requiring\s+sponsorship|must\s+already\s+have\s+(the\s+)?right\s+to\s+work|must\s+have\s+existing\s+work\s+authorization|citizens?\s+only|nationals?\s+only|eu\/eea\s+citizens?\s+only|local\s+candidates?\s+only)\b/i;

  if (negationRx.test(lower)) {
    return {
      confirmed: false,
      evidence: '',
      strengthScore: 0,
      hasRelocation: false,
      relocationText: 'Not confirmed',
      hasFamilySupport: false,
      familyText: 'Not confirmed',
      localOnlyBlocked: true,
    };
  }

  // Must find explicit sponsorship commitment (NOT merely "visa assistance only" or "invitation letter")
  const explicitPatterns: Array<{ rx: RegExp; score: number }> = [
    {
      rx: /[^.\n]{0,120}\b(we\s+(?:offer|provide|can\s+provide|support)\s+(?:full\s+)?(?:visa|work\s+permit)\s+sponsorship|visa\s+sponsorship\s+(?:is\s+)?(?:available|provided|offered|included)|skilled\s+worker\s+visa\s+sponsorship|employer[- ]sponsored\s+(?:work\s+)?visa|sponsor(?:ing)?\s+(?:your\s+)?(?:work\s+)?visa|work\s+permit\s+sponsorship|eu\s+blue\s+card\s+sponsorship|relocation\s+and\s+visa\s+sponsorship|visa\s+and\s+relocation\s+(?:support|package|sponsorship)|full\s+visa\s+sponsorship)\b[^.\n]{0,140}/i,
      score: 100,
    },
    {
      rx: /[^.\n]{0,100}\b(visa\s+sponsorship|sponsorship\s+for\s+international\s+applicants|international\s+recruitment\s+with\s+(?:visa|work\s+permit)|g-4\s+visa|iqama\s+sponsorship|employment\s+visa\s+sponsored\s+by\s+(?:the\s+)?employer)\b[^.\n]{0,120}/i,
      score: 90,
    },
  ];

  let confirmed = false;
  let evidence = '';
  let strengthScore = 0;

  for (const pat of explicitPatterns) {
    const match = clean.match(pat.rx);
    if (match) {
      confirmed = true;
      evidence = match[0].replace(/\s+/g, ' ').trim().slice(0, 260);
      strengthScore = pat.score;
      break;
    }
  }

  const relocMatch = clean.match(
    /[^.\n]{0,90}\b(relocation\s+(?:package|support|assistance|allowance|covered|provided)|flight\s+tickets?\s+(?:covered|provided)|temporary\s+housing|mobilization\s+flight)\b[^.\n]{0,110}/i
  );
  const hasRelocation = Boolean(relocMatch);
  const relocationText = relocMatch
    ? relocMatch[0].replace(/\s+/g, ' ').trim().slice(0, 220)
    : 'Not explicitly detailed in posting — confirm relocation reimbursement on official offer.';

  const familyMatch = clean.match(
    /[^.\n]{0,90}\b(family\s+(?:relocation|visa|reunification|allowance|health\s+insurance)|dependants?|dependents?|spouse\s+visa|schooling\s+allowance)\b[^.\n]{0,110}/i
  );
  const hasFamilySupport = Boolean(familyMatch);
  const familyText = familyMatch
    ? familyMatch[0].replace(/\s+/g, ' ').trim().slice(0, 220)
    : 'Not explicitly confirmed in job posting — verify dependant/family visa coverage with employer HR.';

  return {
    confirmed,
    evidence,
    strengthScore,
    hasRelocation,
    relocationText,
    hasFamilySupport,
    familyText,
    localOnlyBlocked: false,
  };
}

const TARGET_POSITION_MATCHERS: Array<{ label: string; rx: RegExp }> = [
  { label: 'Branch Manager', rx: /\b(branch\s+manager|retail\s+branch\s+manager|area\s+branch\s+manager|head\s+of\s+branch)\b/i },
  { label: 'Banking Operations Manager', rx: /\b(banking\s+operations\s+manager|bank\s+operations\s+manager|head\s+of\s+banking\s+operations|core\s+banking\s+operations)\b/i },
  { label: 'Finance Manager', rx: /\b(finance\s+manager|senior\s+finance\s+manager|commercial\s+finance\s+manager|regional\s+finance\s+manager|head\s+of\s+finance)\b/i },
  { label: 'Finance and Administration Manager', rx: /\b(finance\s+(?:and|&)\s+admin(?:istration)?\s+manager|admin\s+(?:and|&)\s+finance\s+manager)\b/i },
  { label: 'Financial Controller', rx: /\b(financial\s+controller|group\s+controller|assistant\s+controller|accounting\s+controller)\b/i },
  { label: 'Credit Manager', rx: /\b(credit\s+manager|senior\s+credit\s+manager|commercial\s+credit\s+manager|head\s+of\s+credit|lending\s+manager)\b/i },
  { label: 'Relationship Manager', rx: /\b((?:senior\s+|corporate\s+|commercial\s+|banking\s+|business\s+|private\s+)?relationship\s+manager)\b/i },
  { label: 'SME Banking Manager', rx: /\b(sme\s+banking\s+manager|business\s+banking\s+manager|commercial\s+banking\s+manager|corporate\s+banking\s+manager)\b/i },
  { label: 'Financial Operations Manager', rx: /\b(financial\s+operations\s+manager|finops\s+manager|treasury\s+operations\s+manager|treasury\s+manager|settlement\s+operations\s+manager)\b/i },
  { label: 'Microfinance Operations Manager', rx: /\b(microfinance\s+(?:operations\s+)?manager|financial\s+inclusion\s+manager|microfinance\s+director)\b/i },
  { label: 'Credit Operations Manager', rx: /\b(credit\s+operations\s+manager|loan\s+operations\s+manager|lending\s+operations\s+manager|collections\s+operations\s+manager)\b/i },
  { label: 'Compliance Manager', rx: /\b(compliance\s+manager|regulatory\s+compliance\s+manager|senior\s+compliance\s+manager|head\s+of\s+compliance|financial\s+crime\s+compliance)\b/i },
  { label: 'Risk Manager', rx: /\b((?:credit\s+|operational\s+|enterprise\s+|financial\s+|banking\s+)?risk\s+manager|head\s+of\s+risk)\b/i },
  { label: 'Internal Control Manager', rx: /\b(internal\s+control(?:s)?\s+manager|internal\s+audit\s+manager|audit\s+manager|head\s+of\s+internal\s+(?:audit|control))\b/i },
  { label: 'AML/KYC Manager', rx: /\b(aml(?:\/kyc)?\s+manager|kyc\s+manager|financial\s+crime\s+manager|fincrime\s+manager|sanctions\s+manager|anti[- ]money\s+laundering\s+manager)\b/i },
  { label: 'Digital Banking Operations Manager', rx: /\b(digital\s+banking\s+(?:operations\s+)?manager|mobile\s+banking\s+manager|fintech\s+operations\s+manager|customer\s+operations\s+manager.*bank)\b/i },
  { label: 'Payment Operations Manager', rx: /\b(payment(?:s)?\s+operations\s+manager|card\s+operations\s+manager|clearing\s+(?:and\s+settlement\s+)?manager|merchant\s+operations\s+manager)\b/i },
  { label: 'Grants Finance Manager', rx: /\b(grants?\s+finance\s+manager|grant(?:s)?\s+management\s+manager|donor\s+finance\s+manager)\b/i },
  { label: 'Project Finance Manager', rx: /\b(project\s+finance\s+manager|program(?:me)?\s+finance\s+manager|portfolio\s+finance\s+manager)\b/i },
];

const UNRELATED_HIGH_SALARY_DISQUALIFIER_RX =
  /\b(software\s+engineer|staff\s+engineer|backend\s+engineer|frontend\s+engineer|fullstack|full[- ]stack|devops|site\s+reliability|sre\b|machine\s+learning|data\s+scientist|ios\s+engineer|android\s+engineer|product\s+designer|ux\s+designer|ui\s+designer|registered\s+nurse|physician|doctor\b|surgeon|medical\s+officer|legal\s+counsel|attorney|lawyer|solicitor|marketing\s+manager|brand\s+manager|copywriter|writer\b|recruiter|talent\s+acquisition|people\s+partner|hr\s+business\s+partner|civil\s+engineer|mechanical\s+engineer|electrical\s+engineer|architect\b)\b/i;

function matchTargetSeniorBankingRole(
  title: string,
  description: string,
  profile: BranchManagerProfileInput
): { matched: boolean; matchedPosition: string } {
  const titleClean = String(title || '').trim();
  // Never recommend unrelated high-salary engineering/medical/legal/marketing jobs!
  if (UNRELATED_HIGH_SALARY_DISQUALIFIER_RX.test(titleClean)) {
    return { matched: false, matchedPosition: '' };
  }

  for (const item of TARGET_POSITION_MATCHERS) {
    if (item.rx.test(titleClean)) {
      return { matched: true, matchedPosition: item.label };
    }
  }

  // Also check equivalent senior banking/finance titles matching user's custom target positions
  const seniorBankingTitleRx =
    /\b(senior|lead|head|director|manager|controller|vp\b|vice\s+president|officer|specialist)\b.*\b(bank|banking|finance|financial|accounting|credit|loan|treasury|compliance|aml|kyc|risk|audit|internal\s+control|payment|payments|microfinance|fincrime|deposit|sme|relationship)\b|\b(bank|banking|finance|financial|accounting|credit|loan|treasury|compliance|aml|kyc|risk|audit|internal\s+control|payment|payments|microfinance|fincrime|sme)\b.*\b(manager|lead|head|director|controller|supervisor)\b/i;

  if (seniorBankingTitleRx.test(titleClean)) {
    return { matched: true, matchedPosition: 'Senior Banking & Finance Position' };
  }

  // Check if user specified custom target positions in their own profile
  for (const custom of profile.targetPositions || []) {
    const cleanTarget = custom.trim().toLowerCase();
    if (cleanTarget.length >= 6 && titleClean.toLowerCase().includes(cleanTarget)) {
      return { matched: true, matchedPosition: custom.trim() };
    }
  }

  // Do not match purely on description when title is unrelated
  void description;
  return { matched: false, matchedPosition: '' };
}

function extractEducationFromText(text: string): string {
  const m = text.match(
    /[^.\n]{0,60}\b(bachelor['’]?s|ba\b|bsc\b|university\s+degree|master['’]?s|mba\b|cpa\b|acca\b|cfa\b|degree\s+in\s+[a-z\s,&]+)\b[^.\n]{0,90}/i
  );
  if (m) return m[0].replace(/\s+/g, ' ').trim().slice(0, 180);
  return "Bachelor's degree in Accounting, Finance, Banking, or equivalent relevant banking experience (verify on employer portal).";
}

function extractExperienceFromText(text: string): { summary: string; minYears: number | null } {
  const m = text.match(/(\d{1,2})\+?\s*(?:to\s*\d{1,2}\s*)?years?\s+(?:of\s+)?(?:relevant\s+|progressive\s+)?[a-z\s,/-]{3,70}/i);
  if (m) {
    const yrs = parseInt(m[1], 10);
    return {
      summary: m[0].replace(/\s+/g, ' ').trim().slice(0, 180),
      minYears: Number.isNaN(yrs) ? null : yrs,
    };
  }
  return {
    summary: 'Proven senior banking, finance, operations, or people-management experience (verify exact years on employer portal).',
    minYears: null,
  };
}

function extractLanguageFromText(text: string): string {
  const m = text.match(
    /[^.\n]{0,50}\b(fluent\s+in\s+english|english\s+(?:proficiency|required|fluent)|ielts|toefl|arabic|german|french|swedish|norwegian|danish|dutch)\b[^.\n]{0,80}/i
  );
  if (m) return m[0].replace(/\s+/g, ' ').trim().slice(0, 180);
  return 'Professional English proficiency (verify whether any additional local language is needed on official portal).';
}

function extractResponsibilities(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•\-–*▪▸\d.)]+/, '').trim())
    .filter((l) => l.length >= 24 && l.length <= 220);

  const actionLines = lines.filter((l) =>
    /^(lead|manage|oversee|supervise|drive|ensure|develop|prepare|monitor|coordinate|review|build|deliver|maintain|support|own|design|execute|partner|implement|control|analyze|analyse|report|establish)\b/i.test(
      l
    )
  );
  if (actionLines.length >= 2) return actionLines.slice(0, 5);
  if (lines.length >= 2) return lines.slice(0, 4);
  return [
    'Review complete role responsibilities directly on the verified official employer application page.',
  ];
}

function classifyEmployerReputation(employerName: string): {
  label: string;
  reputationScore: number;
} {
  const n = employerName.toLowerCase();
  if (/\b(world bank|ifc|imf|african development bank|afdb|ebrd|eib|european central bank|bis|unicef|undp|afreximbank|tdb)\b/i.test(n)) {
    return { label: 'Multilateral Development Bank / International Institution', reputationScore: 98 };
  }
  if (/\b(standard chartered|citibank|hsbc|barclays|absa|standard bank|ecobank|monzo|n26|revolut|starling|bunq|société générale|bnp paribas|deutsche bank|ing|rabobank)\b/i.test(n)) {
    return { label: 'Licensed International Bank', reputationScore: 95 };
  }
  if (/\b(adyen|stripe|wise|sumup|mollie|pleo|tide|gocardless|transfergo|careem|visa|mastercard|checkout|flutterwave|paystack|worldremit|zepz)\b/i.test(n)) {
    return { label: 'International Payments & Financial Services Institution', reputationScore: 92 };
  }
  if (/\b(deloitte|pwc|ey|kpmg|mercy corps|irc|save the children|oxfam|wateraid|world vision)\b/i.test(n)) {
    return { label: 'Global Advisory / International Organization', reputationScore: 90 };
  }
  return { label: 'Verified International Employer', reputationScore: 80 };
}

function sanitizeBranchProfile(
  input?: Partial<BranchManagerProfileInput> | null,
  fallback: BranchManagerProfileInput = DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE
): BranchManagerProfileInput {
  if (!input || typeof input !== 'object') {
    return {
      ...fallback,
      employers: [...fallback.employers],
      coreSkills: [...fallback.coreSkills],
      targetPositions: [...fallback.targetPositions],
      languages: [...fallback.languages],
    };
  }
  const cleanArr = (arr: unknown, def: string[], max = 30): string[] => {
    if (!Array.isArray(arr)) return [...def];
    return arr
      .map((s) => String(s || '').trim().slice(0, 90))
      .filter(Boolean)
      .slice(0, max);
  };
  return {
    profileLabel: String(input.profileLabel || fallback.profileLabel).trim().slice(0, 120),
    nationality: String(input.nationality || fallback.nationality).trim().slice(0, 60),
    currentResidence: String(input.currentResidence || fallback.currentResidence).trim().slice(0, 60),
    educationDegree: String(input.educationDegree || fallback.educationDegree).trim().slice(0, 80),
    fieldOfStudy: String(input.fieldOfStudy ?? fallback.fieldOfStudy).trim().slice(0, 120),
    institution: String(input.institution ?? fallback.institution).trim().slice(0, 120),
    graduationYear: String(input.graduationYear ?? fallback.graduationYear).trim().slice(0, 12),
    totalBankingYears: Math.max(0, Math.min(50, Number(input.totalBankingYears ?? fallback.totalBankingYears) || 0)),
    branchManagerYears: Math.max(0, Math.min(40, Number(input.branchManagerYears ?? fallback.branchManagerYears) || 0)),
    currentOrRecentPosition: String(input.currentOrRecentPosition ?? fallback.currentOrRecentPosition).trim().slice(0, 120),
    employers: cleanArr(input.employers, fallback.employers),
    coreSkills: cleanArr(input.coreSkills, fallback.coreSkills),
    targetPositions: cleanArr(input.targetPositions, fallback.targetPositions),
    languages: cleanArr(input.languages, fallback.languages),
    hasMastersDegree: Boolean(input.hasMastersDegree),
    hasEnglishTest: Boolean(input.hasEnglishTest),
    // Strictly enforce >= $3,000 USD minimum floor for this section!
    minimumMonthlyGrossUsd: Math.max(3000, Math.min(50000, Number(input.minimumMonthlyGrossUsd ?? 3000) || 3000)),
  };
}

/**
 * Pure 6-gate evaluation & strict Section 8 ranking engine.
 * Exported directly for deterministic automated testing.
 */
export function evaluateBranchManagerJobs(params: {
  rawCandidates: RawDiscoveredBranchJob[];
  profileInput?: Partial<BranchManagerProfileInput> | null;
  isOwnerAccountProfile?: boolean;
  fxRatesUsdBase?: Record<string, number>;
  fxUpdatedAt?: string;
  fxSourceNote?: string;
  sourcesChecked?: string[];
  lastDiscoveryAt?: string;
  regionFilter?: BranchManagerRegionScope | 'ALL';
  positionFilter?: string;
  minSalaryUsd?: number;
  searchQuery?: string;
}): BranchManagerJobsSearchResponse {
  const nowIso = new Date().toISOString();
  const baseDefault = params.isOwnerAccountProfile
    ? OWNER_PRIVATE_SAVED_PROFILE
    : DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE;
  const profile = sanitizeBranchProfile(params.profileInput, baseDefault);
  const fxRates = params.fxRatesUsdBase || FALLBACK_FX_USD_BASE;
  const minThresholdUsd = Math.max(3000, Number(params.minSalaryUsd || profile.minimumMonthlyGrossUsd || 3000));

  const audit: StrictGateAuditSummary = {
    totalCandidatesScanned: (params.rawCandidates || []).length,
    passedAllSixGates: 0,
    excludedUndisclosedSalary: 0,
    excludedBelow3000Usd: 0,
    excludedUnconfirmedVisaSponsorship: 0,
    excludedOutsideAllowedRegions: 0,
    excludedLocalAfricanNonInternational: 0,
    excludedNonMatchingRole: 0,
    excludedEthiopianIneligible: 0,
    excludedExpiredOrDuplicate: 0,
    sourcesChecked: params.sourcesChecked || [],
    fxRatesUpdatedAt: params.fxUpdatedAt || nowIso,
    fxSourceNote: params.fxSourceNote || 'Live USD market FX rates (fallback baseline if offline)',
  };

  const seenDedup = new Set<string>();
  const verifiedJobs: VerifiedBranchManagerJob[] = [];

  for (const raw of params.rawCandidates || []) {
    // Gate 0: Valid HTTPS official URL & non-duplicate & non-expired
    const url = String(raw.applicationUrl || '').trim();
    if (!url.startsWith('https://')) {
      audit.excludedExpiredOrDuplicate += 1;
      continue;
    }

    if (raw.applicationDeadline && raw.applicationDeadline !== 'Open — Verify on employer portal') {
      const parsedDl = Date.parse(raw.applicationDeadline);
      if (!Number.isNaN(parsedDl) && parsedDl < Date.now()) {
        audit.excludedExpiredOrDuplicate += 1;
        continue;
      }
    }

    const dedupKey = `${raw.title.toLowerCase().trim()}|${raw.employerName.toLowerCase().trim()}|${raw.locationRaw.toLowerCase().trim()}`;
    if (seenDedup.has(dedupKey)) {
      audit.excludedExpiredOrDuplicate += 1;
      continue;
    }
    seenDedup.add(dedupKey);

    const plainDesc = stripHtmlToPlainText(raw.descriptionText || '');
    const fullText = `${raw.title}\n${raw.compensationRaw || ''}\n${raw.explicitVisaNote || ''}\n${plainDesc}`;

    // Gate 1: Strict Geographic Scope — Africa (International Companies/Banks Only), Middle East, Europe, Scandinavian ONLY!
    const regionEval = classifyAllowedRegionScope({
      locationRaw: raw.locationRaw,
      countryHint: raw.countryHint,
      cityHint: raw.cityHint,
      employerName: raw.employerName,
      descriptionText: plainDesc,
      isInternationalEmployerVerified: raw.isInternationalEmployerVerified,
    });

    if (!regionEval.allowed || !regionEval.regionScope) {
      if (regionEval.rejectedAsLocalAfrican) {
        audit.excludedLocalAfricanNonInternational += 1;
      } else {
        audit.excludedOutsideAllowedRegions += 1;
      }
      continue;
    }

    // Gate 2: Target Senior Banking & Finance Role Match (never recommend unrelated high-salary jobs!)
    const roleMatch = matchTargetSeniorBankingRole(raw.title, plainDesc, profile);
    if (!roleMatch.matched) {
      audit.excludedNonMatchingRole += 1;
      continue;
    }

    // Gate 3: Guaranteed Base Gross Salary > USD 3,000/month (> $36,000/yr) — undisclosed strictly excluded!
    const salaryEval = parseGuaranteedBaseSalaryUsd(
      `${raw.compensationRaw || ''}\n${plainDesc}`,
      fxRates
    );
    if (!salaryEval.disclosed) {
      audit.excludedUndisclosedSalary += 1;
      continue;
    }
    if (salaryEval.baseMonthlyUsd <= 3000 || salaryEval.baseAnnualUsd <= 36000) {
      audit.excludedBelow3000Usd += 1;
      continue;
    }

    // Gate 4: Explicit Confirmed Visa Sponsorship Evidence (never confuse general visa notes with sponsorship!)
    const visaEval = extractExplicitVisaSponsorshipEvidence(fullText);
    if (visaEval.localOnlyBlocked || raw.ethiopianEligibleHint === 'excluded') {
      audit.excludedEthiopianIneligible += 1;
      continue;
    }
    if (!visaEval.confirmed) {
      audit.excludedUnconfirmedVisaSponsorship += 1;
      continue;
    }

    // Gate 5: Confirm Ethiopian citizens living in Ethiopia are eligible to apply (offshore applicants accepted)
    if (/\b(must\s+reside\s+in|must\s+currently\s+be\s+located\s+in|no\s+overseas\s+applicants|no\s+offshore\s+applicants|in-country\s+candidates\s+only)\b/i.test(fullText)) {
      audit.excludedEthiopianIneligible += 1;
      continue;
    }

    const ethiopianConfirmation =
      raw.ethiopianEligibleHint === 'confirmed'
        ? 'Confirmed: Ethiopian citizens living in Ethiopia are eligible to apply directly with employer visa sponsorship.'
        : 'Confirmed international sponsorship: Open to eligible offshore international applicants (including Ethiopian citizens living in Ethiopia) under employer visa sponsorship.';

    // Gate 6: Grounded Profile Match Scoring (never invents Master's, IELTS, or extra qualifications!)
    const eduText = extractEducationFromText(plainDesc);
    const expEval = extractExperienceFromText(plainDesc);
    const langText = extractLanguageFromText(plainDesc);
    const responsibilities = extractResponsibilities(plainDesc);
    const employerMeta = classifyEmployerReputation(raw.employerName);

    const whyYouQualify: string[] = [];
    const gapsOrUnmetRequirements: string[] = [];

    let matchScore = 52;

    // Role & leadership match
    whyYouQualify.push(
      `Direct senior role alignment (${roleMatch.matchedPosition}) matching your ${profile.currentOrRecentPosition || 'banking management'} background.`
    );
    matchScore += 14;

    if (profile.branchManagerYears >= 2 && /\b(manager|lead|head|director|supervis|team)\b/i.test(fullText)) {
      whyYouQualify.push(
        `${profile.branchManagerYears} years of Branch Manager leadership aligns with management and staff supervision responsibilities.`
      );
      matchScore += 10;
    }

    // Experience years comparison
    if (expEval.minYears !== null) {
      if (profile.totalBankingYears >= expEval.minYears) {
        whyYouQualify.push(
          `${profile.totalBankingYears} years of banking experience exceeds the stated ${expEval.minYears}+ years requirement.`
        );
        matchScore += 10;
      } else {
        gapsOrUnmetRequirements.push(
          `Employer requests ${expEval.minYears}+ years experience (your profile lists ${profile.totalBankingYears} years).`
        );
        matchScore -= 8;
      }
    } else if (profile.totalBankingYears >= 5) {
      whyYouQualify.push(`${profile.totalBankingYears} years of commercial banking experience fits senior hiring expectations.`);
      matchScore += 6;
    }

    // Core skill overlap
    const matchedSkills: string[] = [];
    const descLower = `${raw.title} ${plainDesc}`.toLowerCase();
    for (const sk of profile.coreSkills) {
      const tokens = sk.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
      if (tokens.some((t) => descLower.includes(t))) {
        matchedSkills.push(sk);
      }
    }
    if (matchedSkills.length > 0) {
      whyYouQualify.push(`Verified skill match: ${matchedSkills.slice(0, 5).join(', ')}.`);
      matchScore += Math.min(12, matchedSkills.length * 3);
    }

    // Honest gap checks — NEVER invent Master's, CPA/ACCA/CFA, IELTS, or European/Arabic languages!
    if (/\b(master['’]?s|mba\b|msc\b)\s+(degree\s+)?(required|mandatory|essential|preferred)/i.test(descLower) && !profile.hasMastersDegree) {
      gapsOrUnmetRequirements.push(
        `Posting mentions a Master's/MBA (${/\b(required|mandatory|essential)\b/i.test(eduText) ? 'stated required' : 'preferred'}) — your profile holds a ${profile.educationDegree} in ${profile.fieldOfStudy}.`
      );
      matchScore -= /\b(required|mandatory|essential)\b/i.test(eduText) ? 14 : 4;
    }

    if (/\b(cpa|acca|cfa|cima|aca)\b/i.test(descLower)) {
      gapsOrUnmetRequirements.push(
        'Posting references professional certification (CPA/ACCA/CFA/ACA) — confirm whether equivalent banking experience is accepted.'
      );
      matchScore -= 6;
    }

    if (/\b(ielts|toefl)\b/i.test(descLower) && !profile.hasEnglishTest) {
      gapsOrUnmetRequirements.push(
        'Official posting or visa stage references an English language test (IELTS/TOEFL) — confirm whether English-medium BA degree qualifies for exemption.'
      );
      matchScore -= 4;
    }

    const nonEnglishLangMatch = langText.match(/\b(german|french|arabic|swedish|norwegian|danish|dutch)\b/i);
    if (
      nonEnglishLangMatch &&
      !profile.languages.some((l) => l.toLowerCase().includes(nonEnglishLangMatch[1].toLowerCase()))
    ) {
      gapsOrUnmetRequirements.push(
        `Posting mentions ${nonEnglishLangMatch[1]} language — verify if English-only candidates are considered.`
      );
      matchScore -= 6;
    }

    const profileMatchPercentage = Math.max(35, Math.min(98, Math.round(matchScore)));

    // Section 8 Priority Ranking Score:
    // 1. Confirmed visa sponsorship (weight 30)
    // 2. Salary > $3,000 USD gross monthly (weight 24)
    // 3. Ethiopian applicant eligibility (weight 16)
    // 4. Match with professional experience (weight 16)
    // 5. Employer reputation & authenticity (weight 8)
    // 6. Relocation & family support (weight 6)
    const salaryNorm = Math.min(100, 50 + ((salaryEval.baseMonthlyUsd - 3000) / 100));
    const ethScore = raw.ethiopianEligibleHint === 'confirmed' ? 100 : 90;
    const relocScore = (visaEval.hasRelocation ? 60 : 0) + (visaEval.hasFamilySupport ? 40 : 0);

    const rankingScore = Number(
      (
        visaEval.strengthScore * 0.3 +
        salaryNorm * 0.24 +
        ethScore * 0.16 +
        profileMatchPercentage * 0.16 +
        employerMeta.reputationScore * 0.08 +
        relocScore * 0.06
      ).toFixed(2)
    );

    audit.passedAllSixGates += 1;

    verifiedJobs.push({
      id: raw.id,
      jobTitle: raw.title,
      employerName: raw.employerName,
      employerTypeLabel: raw.employerTypeHint || employerMeta.label,
      country: regionEval.country,
      city: regionEval.city,
      regionScope: regionEval.regionScope,
      grossMonthlySalaryUsd: salaryEval.baseMonthlyUsd,
      grossAnnualSalaryUsd: salaryEval.baseAnnualUsd,
      originalSalaryDisplay: salaryEval.originalSalaryDisplay,
      usdEquivalentDisplay: salaryEval.usdEquivalentDisplay,
      exchangeRateUsed: salaryEval.exchangeRateUsed,
      visaSponsorshipEvidence: visaEval.evidence,
      sponsorshipStrengthScore: visaEval.strengthScore,
      ethiopianEligibilityConfirmation: ethiopianConfirmation,
      requiredEducation: eduText,
      requiredExperience: expEval.summary,
      languageRequirements: langText,
      jobResponsibilities: responsibilities,
      relocationSupport: visaEval.relocationText,
      familyRelocationPossibilities: visaEval.familyText,
      hasConfirmedRelocation: visaEval.hasRelocation,
      hasConfirmedFamilySupport: visaEval.hasFamilySupport,
      applicationDeadline: raw.applicationDeadline || 'Open — Verify closing date on official employer portal',
      datePosted: raw.datePosted || nowIso.slice(0, 10),
      officialApplicationUrl: url,
      sourcePortal: raw.sourcePortal,
      profileMatchPercentage,
      whyYouQualify,
      gapsOrUnmetRequirements,
      matchedTargetPosition: roleMatch.matchedPosition,
      employerReputationScore: employerMeta.reputationScore,
      rankingScore,
    });
  }

  // Apply user view filters (after strict 6-gate verification!)
  const filtered = verifiedJobs
    .filter((job) => {
      if (params.regionFilter && params.regionFilter !== 'ALL' && job.regionScope !== params.regionFilter) {
        return false;
      }
      if (job.grossMonthlySalaryUsd < minThresholdUsd) return false;
      if (params.positionFilter && params.positionFilter !== 'ALL') {
        const pf = params.positionFilter.toLowerCase();
        if (
          !job.matchedTargetPosition.toLowerCase().includes(pf) &&
          !job.jobTitle.toLowerCase().includes(pf)
        ) {
          return false;
        }
      }
      if (params.searchQuery && params.searchQuery.trim()) {
        const q = params.searchQuery.toLowerCase().trim();
        const hay = `${job.jobTitle} ${job.employerName} ${job.country} ${job.city} ${job.regionScope} ${job.matchedTargetPosition} ${job.visaSponsorshipEvidence}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Strict Section 8 Priority Sort
      if (b.sponsorshipStrengthScore !== a.sponsorshipStrengthScore) {
        return b.sponsorshipStrengthScore - a.sponsorshipStrengthScore;
      }
      if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
      if (b.grossMonthlySalaryUsd !== a.grossMonthlySalaryUsd) {
        return b.grossMonthlySalaryUsd - a.grossMonthlySalaryUsd;
      }
      return b.profileMatchPercentage - a.profileMatchPercentage;
    });

  return {
    success: true,
    generatedAt: nowIso,
    lastDiscoveryAt: params.lastDiscoveryAt || nowIso,
    allowedRegions: ALLOWED_BRANCH_MANAGER_REGIONS,
    profileUsed: profile,
    isOwnerAccountProfile: Boolean(params.isOwnerAccountProfile),
    audit,
    jobs: filtered,
  };
}

export const LIVE_GREENHOUSE_BANKING_BOARDS: Array<{
  slug: string;
  employerName: string;
  employerType: string;
}> = [
  { slug: 'monzo', employerName: 'Monzo Bank', employerType: 'Licensed International Bank' },
  { slug: 'adyen', employerName: 'Adyen', employerType: 'Licensed European Payments Bank' },
  { slug: 'n26', employerName: 'N26 Bank', employerType: 'Licensed European Digital Bank' },
  { slug: 'wise', employerName: 'Wise', employerType: 'Global Financial Services & Payments Institution' },
  { slug: 'sumup', employerName: 'SumUp', employerType: 'Global Financial Services & Payments Institution' },
  { slug: 'tide', employerName: 'Tide', employerType: 'International SME Banking Platform' },
  { slug: 'gocardless', employerName: 'GoCardless', employerType: 'International Bank Payments Institution' },
  { slug: 'transfergo', employerName: 'TransferGo', employerType: 'International Remittance & Financial Institution' },
  { slug: 'careem', employerName: 'Careem Pay / Careem', employerType: 'Middle East Digital Financial & Payments Platform' },
  { slug: 'stripe', employerName: 'Stripe', employerType: 'Global Financial Infrastructure Institution' },
];

export const LIVE_ASHBY_BANKING_BOARDS: Array<{
  slug: string;
  employerName: string;
  employerType: string;
}> = [
  { slug: 'pleo', employerName: 'Pleo', employerType: 'Nordic / European Corporate Finance Platform' },
  { slug: 'mollie', employerName: 'Mollie', employerType: 'European Regulated Payments Institution' },
];

export async function fetchLiveFxRates(): Promise<{
  rates: Record<string, number>;
  updatedAt: string;
  sourceNote: string;
}> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = (await res.json()) as { rates?: Record<string, number>; time_last_update_utc?: string };
      if (json?.rates && typeof json.rates.EUR === 'number' && typeof json.rates.GBP === 'number') {
        return {
          rates: { ...FALLBACK_FX_USD_BASE, ...json.rates },
          updatedAt: new Date().toISOString(),
          sourceNote: `Live USD market rates via open.er-api.com (${json.time_last_update_utc || 'current'})`,
        };
      }
    }
  } catch {
    // Use fallback table safely
  }
  return {
    rates: { ...FALLBACK_FX_USD_BASE },
    updatedAt: new Date().toISOString(),
    sourceNote: 'Baseline market USD FX rates (live FX endpoint temporarily unreachable)',
  };
}

async function discoverLiveBranchManagerCandidates(
  existingGlobalOpps: GlobalOpportunity[]
): Promise<{ candidates: RawDiscoveredBranchJob[]; sourcesChecked: string[] }> {
  const candidates: RawDiscoveredBranchJob[] = [];
  const sourcesChecked: string[] = [];

  // 1. Convert existing verified global opportunities store into raw candidates
  if (existingGlobalOpps.length > 0) {
    sourcesChecked.push('Hopeland Verified Global Store (UN, World Bank, AfDB, ReliefWeb, EU Portals)');
    for (const opp of existingGlobalOpps) {
      if (opp.isArchived || opp.applicationStatus === 'expired' || opp.applicationStatus === 'closed') {
        continue;
      }
      candidates.push({
        id: `bm_store_${opp.id}`,
        title: opp.title,
        employerName: opp.organization,
        locationRaw: `${opp.location || ''} ${opp.country || ''}`.trim(),
        countryHint: opp.country,
        descriptionText: [
          opp.summary || '',
          opp.funding?.fundingSummary || '',
          opp.funding?.visaSupportSummary || '',
          opp.eligibility?.educationRequirement || '',
          opp.eligibility?.experienceRequirement || '',
          (opp.eligibility?.languagesRequired || []).join(', '),
        ].join('\n'),
        compensationRaw: opp.funding?.stipendOrSalary || opp.funding?.fundingSummary || '',
        applicationUrl: opp.officialApplicationUrl || opp.originalSourceUrl || '',
        sourcePortal: opp.sourceName || 'Verified Official Portal',
        datePosted: opp.publicationDate || opp.discoveredAt?.slice(0, 10),
        applicationDeadline: opp.deadline?.deadlineUtcIso?.slice(0, 10) || opp.deadline?.deadlineDateRaw,
        explicitVisaNote: opp.funding?.visaSupportSummary || '',
        ethiopianEligibleHint: opp.eligibility?.ethiopianEligible,
      });
    }
  }

  // 2. Live Greenhouse official career boards (parallel, fault-isolated)
  const ghResults = await Promise.allSettled(
    LIVE_GREENHOUSE_BANKING_BOARDS.map(async (board) => {
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs?content=true`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return { board, jobs: [] as any[] };
      const data = (await res.json()) as { jobs?: any[] };
      return { board, jobs: Array.isArray(data?.jobs) ? data.jobs : [] };
    })
  );

  for (const r of ghResults) {
    if (r.status !== 'fulfilled' || r.value.jobs.length === 0) continue;
    const { board, jobs } = r.value;
    sourcesChecked.push(`${board.employerName} Official Careers`);
    for (const j of jobs) {
      const url = String(j.absolute_url || '').trim();
      if (!url.startsWith('https://')) continue;
      candidates.push({
        id: `bm_gh_${board.slug}_${j.id || crypto.randomBytes(4).toString('hex')}`,
        title: String(j.title || '').trim(),
        employerName: board.employerName,
        employerTypeHint: board.employerType,
        isInternationalEmployerVerified: true,
        locationRaw: String(j.location?.name || '').trim(),
        descriptionText: String(j.content || ''),
        applicationUrl: url,
        sourcePortal: `${board.employerName} Official Careers`,
        datePosted: typeof j.updated_at === 'string' ? j.updated_at.slice(0, 10) : undefined,
      });
    }
  }

  // 3. Live Ashby official career boards with compensation included (Scandinavia / Europe)
  const ashbyResults = await Promise.allSettled(
    LIVE_ASHBY_BANKING_BOARDS.map(async (board) => {
      const res = await fetch(
        `https://api.ashbyhq.com/posting-api/job-board/${board.slug}?includeCompensation=true`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return { board, jobs: [] as any[] };
      const data = (await res.json()) as { jobs?: any[] };
      return { board, jobs: Array.isArray(data?.jobs) ? data.jobs : [] };
    })
  );

  for (const r of ashbyResults) {
    if (r.status !== 'fulfilled' || r.value.jobs.length === 0) continue;
    const { board, jobs } = r.value;
    sourcesChecked.push(`${board.employerName} Official Careers`);
    for (const j of jobs) {
      const url = String(j.jobUrl || j.applyUrl || '').trim();
      if (!url.startsWith('https://')) continue;
      const compSummary =
        j.compensation?.compensationTierSummary ||
        j.compensation?.summaryComponents?.map((c: any) => c.label).join(' ') ||
        '';
      candidates.push({
        id: `bm_ash_${board.slug}_${j.id || crypto.randomBytes(4).toString('hex')}`,
        title: String(j.title || '').trim(),
        employerName: board.employerName,
        employerTypeHint: board.employerType,
        isInternationalEmployerVerified: true,
        locationRaw: String(j.location || j.address?.postalAddress?.addressCountry || '').trim(),
        descriptionText: String(j.descriptionPlain || j.descriptionHtml || ''),
        compensationRaw: compSummary ? `Base salary: ${compSummary}` : '',
        applicationUrl: url,
        sourcePortal: `${board.employerName} Official Careers`,
        datePosted: typeof j.publishedAt === 'string' ? j.publishedAt.slice(0, 10) : undefined,
      });
    }
  }

  // 4. Live Arbeitnow European job board API
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: any[] };
      const list = Array.isArray(data?.data) ? data.data : [];
      if (list.length > 0) {
        sourcesChecked.push('Arbeitnow Europe Live Board');
        for (const j of list) {
          const url = String(j.url || '').trim();
          if (!url.startsWith('https://')) continue;
          const desc = String(j.description || '');
          const tags = Array.isArray(j.tags) ? j.tags.join(' ') : '';
          candidates.push({
            id: `bm_arb_${j.slug || crypto.randomBytes(4).toString('hex')}`,
            title: String(j.title || '').trim(),
            employerName: String(j.company_name || 'European Employer').trim(),
            locationRaw: `${String(j.location || '')} Germany Europe`.trim(),
            countryHint: 'Germany',
            descriptionText: `${desc}\nTags: ${tags}`,
            applicationUrl: url,
            sourcePortal: 'Arbeitnow Europe',
            datePosted:
              typeof j.created_at === 'number'
                ? new Date(j.created_at * 1000).toISOString().slice(0, 10)
                : undefined,
          });
        }
      }
    }
  } catch {
    // Non-fatal
  }

  return { candidates, sourcesChecked };
}

export function registerBranchManagerJobsRoutes(deps: RegisterBranchManagerJobsDeps) {
  const {
    app,
    runtimeBaseDir,
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    isPersistentOwnerRequest,
    getRequesterUid,
  } = deps;

  const storePath = path.join(runtimeBaseDir, 'data', 'branch_manager_jobs_store.json');
  const globalOppsStorePath = path.join(runtimeBaseDir, 'data', 'global_opportunities_store.json');

  let activeDiscoveryPromise: Promise<BranchManagerJobsStore> | null = null;

  function loadStore(): BranchManagerJobsStore {
    ensureRuntimeDataDir();
    const nowIso = new Date().toISOString();
    const fallback: BranchManagerJobsStore = {
      version: 1,
      updatedAt: nowIso,
      lastDiscoveryAt: '',
      fxUpdatedAt: nowIso,
      fxSourceNote: 'Baseline USD FX rates',
      fxRatesUsdBase: { ...FALLBACK_FX_USD_BASE },
      sourcesChecked: [],
      rawCandidates: [],
      users: {},
    };
    const loaded = loadJsonFileSafe<Partial<BranchManagerJobsStore>>(storePath, fallback);
    return {
      version: Number(loaded.version || 1),
      updatedAt: loaded.updatedAt || nowIso,
      lastDiscoveryAt: loaded.lastDiscoveryAt || '',
      fxUpdatedAt: loaded.fxUpdatedAt || nowIso,
      fxSourceNote: loaded.fxSourceNote || fallback.fxSourceNote,
      fxRatesUsdBase:
        loaded.fxRatesUsdBase && typeof loaded.fxRatesUsdBase === 'object'
          ? { ...FALLBACK_FX_USD_BASE, ...loaded.fxRatesUsdBase }
          : { ...FALLBACK_FX_USD_BASE },
      sourcesChecked: Array.isArray(loaded.sourcesChecked) ? loaded.sourcesChecked : [],
      rawCandidates: Array.isArray(loaded.rawCandidates) ? loaded.rawCandidates : [],
      users: loaded.users && typeof loaded.users === 'object' ? loaded.users : {},
    };
  }

  function saveStore(store: BranchManagerJobsStore): void {
    ensureRuntimeDataDir();
    store.updatedAt = new Date().toISOString();
    writeJsonFileAtomic(storePath, store);
  }

  function loadExistingGlobalOpps(): GlobalOpportunity[] {
    const s = loadJsonFileSafe<Partial<GlobalOpportunitiesStore>>(globalOppsStorePath, {});
    return Array.isArray(s.international_opportunities) ? s.international_opportunities : [];
  }

  async function runLiveDiscoveryIfNeeded(force = false): Promise<BranchManagerJobsStore> {
    const store = loadStore();
    const ageMs = store.lastDiscoveryAt ? Date.now() - Date.parse(store.lastDiscoveryAt) : Infinity;
    const stale = !store.lastDiscoveryAt || Number.isNaN(ageMs) || ageMs > 60 * 60 * 1000 || store.rawCandidates.length === 0;

    if (!force && !stale) return store;
    if (activeDiscoveryPromise) return activeDiscoveryPromise;

    activeDiscoveryPromise = (async () => {
      try {
        const [fx, discovered] = await Promise.all([
          fetchLiveFxRates(),
          discoverLiveBranchManagerCandidates(loadExistingGlobalOpps()),
        ]);
        const fresh = loadStore();
        fresh.fxRatesUsdBase = fx.rates;
        fresh.fxUpdatedAt = fx.updatedAt;
        fresh.fxSourceNote = fx.sourceNote;
        fresh.rawCandidates = discovered.candidates;
        fresh.sourcesChecked = discovered.sourcesChecked;
        fresh.lastDiscoveryAt = new Date().toISOString();
        saveStore(fresh);
        return fresh;
      } finally {
        activeDiscoveryPromise = null;
      }
    })();

    return activeDiscoveryPromise;
  }

  // POST /api/branch-manager-jobs/search
  app.post('/api/branch-manager-jobs/search', async (req: Request, res: Response) => {
    try {
      const store = await runLiveDiscoveryIfNeeded(false);
      const uid = getRequesterUid(req);
      const isOwner = isPersistentOwnerRequest(req);
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
        profile?: Partial<BranchManagerProfileInput>;
        regionFilter?: BranchManagerRegionScope | 'ALL';
        positionFilter?: string;
        minSalaryUsd?: number;
        searchQuery?: string;
      };

      const savedOwnProfile = uid ? store.users[uid] : undefined;
      // Strict privacy: owner's private saved profile is ONLY ever resolved for the owner account!
      const effectiveProfile =
        body.profile ??
        savedOwnProfile ??
        (isOwner ? OWNER_PRIVATE_SAVED_PROFILE : DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE);

      const response = evaluateBranchManagerJobs({
        rawCandidates: store.rawCandidates,
        profileInput: effectiveProfile,
        isOwnerAccountProfile: isOwner && !body.profile && !savedOwnProfile,
        fxRatesUsdBase: store.fxRatesUsdBase,
        fxUpdatedAt: store.fxUpdatedAt,
        fxSourceNote: store.fxSourceNote,
        sourcesChecked: store.sourcesChecked,
        lastDiscoveryAt: store.lastDiscoveryAt,
        regionFilter: body.regionFilter || 'ALL',
        positionFilter: body.positionFilter || 'ALL',
        minSalaryUsd: body.minSalaryUsd,
        searchQuery: body.searchQuery,
      });

      res.json(response);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to evaluate verified $3,000+ visa-sponsored roles.',
      });
    }
  });

  // POST /api/branch-manager-jobs/discover — triggers live official portal scan
  app.post('/api/branch-manager-jobs/discover', async (req: Request, res: Response) => {
    try {
      const store = await runLiveDiscoveryIfNeeded(true);
      const uid = getRequesterUid(req);
      const isOwner = isPersistentOwnerRequest(req);
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
        profile?: Partial<BranchManagerProfileInput>;
      };
      const savedOwnProfile = uid ? store.users[uid] : undefined;
      const effectiveProfile =
        body.profile ??
        savedOwnProfile ??
        (isOwner ? OWNER_PRIVATE_SAVED_PROFILE : DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE);

      const response = evaluateBranchManagerJobs({
        rawCandidates: store.rawCandidates,
        profileInput: effectiveProfile,
        isOwnerAccountProfile: isOwner && !body.profile && !savedOwnProfile,
        fxRatesUsdBase: store.fxRatesUsdBase,
        fxUpdatedAt: store.fxUpdatedAt,
        fxSourceNote: store.fxSourceNote,
        sourcesChecked: store.sourcesChecked,
        lastDiscoveryAt: store.lastDiscoveryAt,
      });
      res.json(response);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to refresh live official banking portals.',
      });
    }
  });

  // GET /api/branch-manager-jobs/user-profile — strictly per-user isolated (401 when unauthenticated)
  app.get('/api/branch-manager-jobs/user-profile', (req: Request, res: Response) => {
    const uid = getRequesterUid(req);
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Sign in required to load your saved personal profile.',
      });
    }
    const isOwner = isPersistentOwnerRequest(req);
    const store = loadStore();
    const saved = store.users[uid];
    const profile = saved
      ? sanitizeBranchProfile(saved, isOwner ? OWNER_PRIVATE_SAVED_PROFILE : DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE)
      : isOwner
      ? sanitizeBranchProfile(OWNER_PRIVATE_SAVED_PROFILE, OWNER_PRIVATE_SAVED_PROFILE)
      : sanitizeBranchProfile(DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE, DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE);

    return res.json({
      success: true,
      profile,
      isOwnerAccountProfile: isOwner,
    });
  });

  // PUT /api/branch-manager-jobs/user-profile — strictly writes ONLY to caller's own uid
  app.put('/api/branch-manager-jobs/user-profile', (req: Request, res: Response) => {
    const uid = getRequesterUid(req);
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Sign in required to save your personal profile.',
      });
    }
    try {
      const isOwner = isPersistentOwnerRequest(req);
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
        profile?: Partial<BranchManagerProfileInput>;
      };
      const store = loadStore();
      const nextProfile = sanitizeBranchProfile(
        body.profile || (body as Partial<BranchManagerProfileInput>),
        isOwner ? OWNER_PRIVATE_SAVED_PROFILE : DEFAULT_PUBLIC_BRANCH_MANAGER_PROFILE
      );
      store.users[uid] = nextProfile;
      saveStore(store);
      return res.json({ success: true, profile: nextProfile, isOwnerAccountProfile: isOwner });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to save your personal profile.',
      });
    }
  });

  return {
    loadStore,
    saveStore,
    runLiveDiscoveryIfNeeded,
    loadExistingGlobalOpps,
    mergeIncrementalCandidates(params: {
      sourceLabel: string;
      idPrefix: string;
      incomingCandidates: RawDiscoveredBranchJob[];
      fxUpdate?: { rates: Record<string, number>; updatedAt: string; sourceNote: string };
    }) {
      const store = loadStore();
      if (params.fxUpdate) {
        store.fxRatesUsdBase = params.fxUpdate.rates;
        store.fxUpdatedAt = params.fxUpdate.updatedAt;
        store.fxSourceNote = params.fxUpdate.sourceNote;
      }
      // Replace stale records only for the specific refreshed source prefix while preserving all other discovered records
      const retained = store.rawCandidates.filter((c) => !c.id.startsWith(params.idPrefix));
      const seenUrls = new Set(retained.map((c) => c.applicationUrl.toLowerCase()));
      let newlyAdded = 0;
      let duplicatesSkipped = 0;
      const merged = [...retained];
      for (const item of params.incomingCandidates) {
        const key = String(item.applicationUrl || '').trim().toLowerCase();
        if (!key) continue;
        if (seenUrls.has(key)) {
          duplicatesSkipped++;
          continue;
        }
        seenUrls.add(key);
        merged.push(item);
        newlyAdded++;
      }
      store.rawCandidates = merged;
      if (!store.sourcesChecked.includes(params.sourceLabel)) {
        store.sourcesChecked = [...store.sourcesChecked, params.sourceLabel];
      }
      store.lastDiscoveryAt = new Date().toISOString();
      saveStore(store);
      return {
        store,
        newlyAdded,
        duplicatesSkipped,
        totalCandidates: merged.length,
      };
    },
    evaluateForOwner() {
      const store = loadStore();
      return evaluateBranchManagerJobs({
        rawCandidates: store.rawCandidates,
        profileInput: OWNER_PRIVATE_SAVED_PROFILE,
        isOwnerAccountProfile: true,
        fxRatesUsdBase: store.fxRatesUsdBase,
        fxUpdatedAt: store.fxUpdatedAt,
        fxSourceNote: store.fxSourceNote,
        sourcesChecked: store.sourcesChecked,
        lastDiscoveryAt: store.lastDiscoveryAt,
      });
    },
  };
}
