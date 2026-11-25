import * as crypto from 'crypto';
import {
  ApplicationLinkVerificationRecord,
  CanonicalOpportunityRecord,
  CareerSeniorityLevel,
  DeadlineStatusLabel,
  OpportunityCategory,
  OpportunityEligibilityRecord,
  OpportunityEnvironment,
  ProfessionalSector,
  RejectionReasonCode,
  SalaryNormalizationRecord,
  SENIORITY_LABELS,
  SENIORITY_RANK,
  UserOpportunityMatchRecord,
  UserProfessionalProfileInput,
  VisaAuthorizationRecord,
  VisaTransparencyStatus,
  WorkModeType,
} from '../types/opportunityIntelligence';

/**
 * Mandatory Reference Profile for the Special Feature: Jobs for Branch Banking (Section 2).
 * NO minimum salary threshold anywhere — user decides!
 */
export const BRANCH_BANKING_REFERENCE_PROFILE: UserProfessionalProfileInput = {
  userId: 'branch_banking_reference',
  professionalSector: 'branch_banking',
  currentOccupation: 'Branch Manager',
  educationLevel: 'bachelors',
  fieldOfStudy: 'Accounting and Finance',
  yearsOfExperience: 9,
  bankingExperienceYears: 9,
  managerialExperienceYears: 3,
  skills: [
    'Branch operations',
    'Banking management',
    'Branch administration',
    'Customer relationship management',
    'Credit operations',
    'Deposit mobilization',
    'Staff supervision',
    'Banking compliance and internal control',
  ],
  certifications: [],
  minimumSalaryUsdMonthly: null,
  careerLevel: 'manager',
  preferredLocations: ['Europe', 'Scandinavia', 'Middle East', 'USA', 'Ethiopia'],
  preferredEnvironment: 'both',
  nationality: 'Ethiopian',
  countriesWithLegalWorkRight: ['Ethiopia'],
  allowJuniorRoles: false,
};

export const MINIMUM_DEADLINE_HOURS = 72;
export const CLOSING_SOON_THRESHOLD_DAYS = 7;

export const DEFAULT_FX_RATES_USD_BASE: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.785,
  CHF: 0.88,
  SEK: 10.65,
  NOK: 10.9,
  DKK: 6.88,
  AED: 3.6725,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.307,
  OMR: 0.385,
  BHD: 0.376,
  CAD: 1.38,
  AUD: 1.53,
  ETB: 126.0,
};

/**
 * 15 Priority Branch Banking Management Titles (Section 2A)
 */
const PRIORITY_BRANCH_BANKING_TITLES: Array<{ label: string; rx: RegExp }> = [
  { label: 'Senior Branch Manager', rx: /\bsenior\s+(?:retail\s+|commercial\s+|bank\s+)?branch\s+manager\b/i },
  { label: 'Area Branch Manager', rx: /\barea\s+(?:bank\s+|retail\s+)?branch\s+manager\b|\barea\s+banking\s+manager\b/i },
  { label: 'Regional Branch Manager', rx: /\bregional\s+(?:bank\s+|retail\s+)?branch\s+manager\b/i },
  { label: 'Branch Operations Manager', rx: /\bbranch\s+operations\s+manager\b/i },
  { label: 'Banking Operations Manager', rx: /\b(?:banking|bank)\s+operations\s+manager\b/i },
  {
    label: 'Banking Operations and Administration Manager',
    rx: /\b(?:banking|branch)\s+operations\s+(?:and|&)\s+admin(?:istration)?\s+manager\b/i,
  },
  { label: 'Branch Manager', rx: /\b(?:retail\s+|commercial\s+|bank\s+|banking\s+)?branch\s+manager\b/i },
  { label: 'Deputy Branch Manager', rx: /\bdeputy\s+(?:bank\s+|retail\s+)?branch\s+manager\b/i },
  { label: 'Assistant Branch Manager', rx: /\bassistant\s+(?:bank\s+|retail\s+)?branch\s+manager\b/i },
  { label: 'Banking Service Manager', rx: /\b(?:banking|branch)\s+service(?:s)?\s+manager\b/i },
  { label: 'Retail Banking Manager', rx: /\bretail\s+banking\s+manager\b/i },
  { label: 'Branch Network Manager', rx: /\bbranch\s+network\s+manager\b/i },
  {
    label: 'Banking Relationship Manager (Managerial)',
    rx: /\b(?:senior\s+|commercial\s+|corporate\s+|retail\s+|sme\s+|banking\s+|bank\s+)?relationship\s+manager\b/i,
  },
  {
    label: 'Banking Business Development Manager',
    rx: /\b(?:banking|bank|retail\s+banking|commercial\s+banking|branch)\s+business\s+development\s+manager\b/i,
  },
  {
    label: 'Banking Management Equivalent',
    rx: /\b(?:sme\s+banking|commercial\s+banking|credit\s+operations|microfinance\s+operations|customer\s+operations|deposit\s+mobilization|financial\s+operations)\s+manager\b/i,
  },
];

const EXECUTIVE_OVER_SENIOR_TITLE_RX =
  /\b(vice\s+president|svp\b|evp\b|avp\b.*executive|\bvp\b|chief\s+[a-z\s]+officer|\bceo\b|\bcfo\b|\bcoo\b|\bcro\b|managing\s+director|executive\s+director|group\s+head\s+of|global\s+head\s+of|country\s+ceo|country\s+head)\b/i;

const JUNIOR_ENTRY_NON_MANAGERIAL_TITLE_RX =
  /\b(customer\s+service\s+representative|csr\b|bank\s+teller|\bteller\b|\bcashier\b|junior\s+banking\s+assistant|banking\s+assistant|entry[- ]level|graduate\s+trainee|management\s+trainee|\bintern\b|\binternship\b|front\s+desk|receptionist|call\s+center\s+agent|contact\s+center\s+agent|data\s+entry\s+clerk|office\s+assistant|clerical\s+officer|junior\s+clerk|administrative\s+assistant)\b/i;

const NON_BANKING_MANAGER_DISQUALIFIER_RX =
  /\b(software|devops|frontend|backend|full[- ]stack|data\s+scien|machine\s+learning|cloud\s+architect|product\s+designer|ux\s+designer|marketing\s+manager|social\s+media\s+manager|brand\s+manager|hotel\s+manager|restaurant\s+manager|store\s+manager|warehouse\s+manager|supply\s+chain\s+manager|construction\s+manager|project\s+manager.*civil|nursing\s+manager|clinic\s+manager|school\s+principal|hr\s+manager|human\s+resources\s+manager|talent\s+acquisition\s+manager|office\s+manager|facilities\s+manager|wash\s+(?:manager|coordinator|officer|engineer)|water\s+and\s+sanitation)\b/i;

const BRANCH_BANKING_RESPONSIBILITY_SIGNALS: Array<{ label: string; rx: RegExp }> = [
  { label: 'Branch operations & daily controls', rx: /\b(branch\s+operations|daily\s+branch|vault\s+control|cash\s+management|teller\s+supervision|branch\s+compliance|core\s+banking)\b/i },
  { label: 'Banking management & P&L / KPI leadership', rx: /\b(branch\s+performance|branch\s+p&l|branch\s+target|branch\s+budget|deposit\s+mobilization|branch\s+growth|portfolio\s+management)\b/i },
  { label: 'Staff supervision & team management', rx: /\b(supervis(?:e|ing)\s+(?:branch\s+)?staff|lead(?:ing)?\s+a\s+team|manage\s+(?:direct\s+reports|branch\s+team|relationship\s+officers|tellers)|people\s+management|performance\s+appraisal)\b/i },
  { label: 'Credit, lending & risk oversight', rx: /\b(credit\s+appraisal|loan\s+portfolio|credit\s+risk|kyc|aml|internal\s+control|regulatory\s+compliance|audit\s+readiness)\b/i },
  { label: 'Managerial customer relationship & business development', rx: /\b(high[- ]value\s+client|commercial\s+clients|sme\s+clients|customer\s+relationship\s+management|client\s+acquisition|business\s+development|retail\s+banking)\b/i },
];

export interface RawOpportunityCandidateInput {
  id?: string;
  category: OpportunityCategory;
  title: string;
  employer: string;
  country: string;
  city?: string;
  region?: string;
  description: string;
  responsibilities?: string[];
  compensationRaw?: string;
  officialApplicationUrl: string;
  sourceUrl?: string;
  sourceName: string;
  referenceNumber?: string | null;
  deadlineRaw?: string | null;
  deadlineTimezone?: string;
  explicitVisaNote?: string;
  explicitFundingNote?: string;
  publishedDate?: string | null;
  openingDateRaw?: string | null;
  isClosedOrWithdrawn?: boolean;
  /** Optional explicit override when rechecking live page updates (e.g., visa sponsorship revoked) */
  visaSponsorshipRevoked?: boolean;
  /** Optional live HTTP verification result for the direct application URL (Section 5) */
  linkCheckOverride?: {
    httpStatus: number | null;
    titleMatched: boolean;
    employerMatched: boolean;
    note?: string;
  };
}

export function extractOpportunityReferenceNumber(text: string): string | null {
  const m = String(text || '').match(
    /\b(?:job\s*(?:id|ref|code|number|#)|req(?:uisition)?\s*(?:id|#|no\.?)|vacancy\s*(?:id|no\.?|ref)|reference\s*(?:no\.?|number|code|#)|ref\s*[:#])\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_-]{2,28})\b/i
  );
  if (!m?.[1]) return null;
  const cleaned = m[1].trim().toUpperCase();
  if (/^(HTTP|HTTPS|WWW|THE|AND|FOR|YES|NOT)$/.test(cleaned)) return null;
  return cleaned;
}

export function normalizeCanonicalText(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|and|for|with|limited|ltd|plc|inc|corp|llc|gmbh|s\.c\.|bank\s+s\.c\.)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeOfficialUrl(rawUrl: string): string {
  try {
    const u = new URL(String(rawUrl || '').trim());
    u.hash = '';
    // Strip common tracking query params so UTM variations collapse to the same URL
    const stripParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source', 'gh_src'];
    for (const p of stripParams) u.searchParams.delete(p);
    return u.toString().replace(/\/+$/, '').toLowerCase();
  } catch {
    return String(rawUrl || '').trim().toLowerCase();
  }
}

/**
 * Generates both a source-URL fingerprint and a cross-source canonical identity
 * so the same job discovered across 3 different websites collapses into ONE opportunity (TEST 7).
 */
export function buildCanonicalOpportunityIdentity(input: {
  category: OpportunityCategory;
  title: string;
  employer: string;
  country: string;
  officialApplicationUrl: string;
}): { canonicalKey: string; urlFingerprint: string; canonicalId: string } {
  const normUrl = normalizeOfficialUrl(input.officialApplicationUrl);
  const urlFingerprint = crypto.createHash('sha256').update(normUrl).digest('hex').slice(0, 24);

  const normEmployer = normalizeCanonicalText(input.employer);
  const normTitle = normalizeCanonicalText(input.title);
  const normCountry = normalizeCanonicalText(input.country || 'global');
  const crossSourceBasis = `${input.category}|${normEmployer}|${normTitle}|${normCountry}`;
  const canonicalKey = crypto.createHash('sha256').update(crossSourceBasis).digest('hex').slice(0, 24);

  return {
    canonicalKey,
    urlFingerprint,
    canonicalId: `opp_${canonicalKey}`,
  };
}

export function detectEnvironment(country: string, city = '', description = ''): OpportunityEnvironment {
  const combined = `${country} ${city}`.toLowerCase();
  if (
    /\b(ethiopia|addis\s+ababa|adama|hawassa|bahir\s+dar|mekelle|dire\s+dawa|gondar|jimma|dessie|bishoftu|shashemene|arbaminch|jigjiga|semera|assosa|gambela|harar)\b/i.test(
      combined
    )
  ) {
    return 'ethiopia_domestic';
  }
  if (!country.trim() && /\b(addis\s+ababa|ethiopian\s+birr|\betb\b)\b/i.test(description)) {
    return 'ethiopia_domestic';
  }
  return 'international';
}

export function detectProfessionalSectors(title: string, employer: string, description: string): {
  primary: ProfessionalSector;
  secondary: ProfessionalSector[];
} {
  const titleAndOrg = `${title} ${employer}`.toLowerCase();
  const full = `${title} ${employer} ${description}`.toLowerCase();
  const scores: Record<ProfessionalSector, number> = {
    branch_banking: 0,
    banking_finance: 0,
    wash: 0,
    engineering: 0,
    healthcare: 0,
    education: 0,
    it_software: 0,
    legal_compliance: 0,
    general_management: 0,
    other: 0,
  };

  // WASH signals (strictly checked first so WASH roles at NGOs/UN never leak into banking)
  if (
    /\b(wash|water,?\s*sanitation\s*(?:and|&)\s*hygiene|water\s+supply|sanitation|hygiene\s+promotion|water\s+engineering|wastewater|environmental\s+health|water\s+resources|humanitarian\s+wash|climate[- ]resilient\s+wash|borehole|fecal\s+sludge|latrine|hydrogeolog)\b/i.test(
      titleAndOrg
    )
  ) {
    scores.wash += 9;
  } else if (
    /\b(wash\s+program|water,?\s*sanitation\s*(?:and|&)\s*hygiene|water\s+supply\s+and\s+sanitation|wastewater\s+treatment|hygiene\s+promotion|humanitarian\s+wash|climate[- ]resilient\s+wash)\b/i.test(
      full
    )
  ) {
    scores.wash += 6;
  }

  // Branch Banking signals
  if (PRIORITY_BRANCH_BANKING_TITLES.some((p) => p.rx.test(title))) {
    scores.branch_banking += 10;
    scores.banking_finance += 6;
  }
  if (
    /\b(branch\s+banking|branch\s+operations|retail\s+banking|branch\s+network|branch\s+management|deposit\s+mobilization|teller\s+supervision|branch\s+administration)\b/i.test(
      full
    )
  ) {
    scores.branch_banking += 5;
  }

  // Broader Banking, Finance, Central Banking, Microfinance & Fintech
  const isFakeBankPhrase = /\b(blood\s+bank|food\s+bank|river\s+bank|water\s+bank|data\s+bank|seed\s+bank)\b/i.test(full);
  if (
    !isFakeBankPhrase &&
    /\b(bank|banking|central\s+bank|commercial\s+bank|microfinance|financial\s+inclusion|digital\s+banking|fintech|financial\s+technology|accounting|finance|financial\s+management|risk\s+management|credit\s+risk|economics|financial\s+regulation|treasury|aml|kyc|audit|lending)\b/i.test(
      titleAndOrg
    )
  ) {
    scores.banking_finance += 8;
  } else if (
    !isFakeBankPhrase &&
    /\b(commercial\s+banking|central\s+banking|microfinance|financial\s+inclusion|financial\s+regulation|banking\s+operations|risk\s+management|credit\s+portfolio)\b/i.test(
      full
    )
  ) {
    scores.banking_finance += 5;
  }

  // Engineering
  if (
    /\b(civil\s+engineer|mechanical\s+engineer|electrical\s+engineer|structural\s+engineer|chemical\s+engineer|industrial\s+engineer|construction\s+engineer|site\s+engineer)\b/i.test(
      titleAndOrg
    )
  ) {
    scores.engineering += 8;
  }

  // Healthcare
  if (
    /\b(physician|medical\s+doctor|registered\s+nurse|pharmacist|midwife|clinical\s+officer|epidemiolog|hospital\s+director|public\s+health\s+specialist|surgeon|dentist)\b/i.test(
      titleAndOrg
    )
  ) {
    scores.healthcare += 8;
  }

  // Education
  if (
    /\b(professor|lecturer|teacher|school\s+principal|academic\s+dean|curriculum\s+specialist|education\s+specialist|pedagog)\b/i.test(
      titleAndOrg
    )
  ) {
    scores.education += 8;
  }

  // IT / Software
  if (
    /\b(software\s+engineer|developer|devops|data\s+scientist|machine\s+learning|cybersecurity|cloud\s+engineer|systems?\s+administrator|frontend|backend|full[- ]stack)\b/i.test(
      titleAndOrg
    )
  ) {
    scores.it_software += 8;
  }

  // Legal / Compliance (only if not already banking compliance)
  if (/\b(attorney|lawyer|legal\s+counsel|solicitor|barrister)\b/i.test(titleAndOrg)) {
    scores.legal_compliance += 7;
  }

  const ordered = (Object.entries(scores) as Array<[ProfessionalSector, number]>)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  if (ordered.length === 0) {
    return { primary: 'other', secondary: [] };
  }

  // Prevent WASH jobs at Development Banks (e.g., World Bank WASH Specialist) from being misclassified as banking
  if (scores.wash >= 8 && !/\b(branch|credit|loan|teller|deposit|finance\s+manager|accounting|banking\s+operations)\b/i.test(title)) {
    const rest = ordered.map(([k]) => k).filter((k) => k !== 'wash');
    return { primary: 'wash', secondary: rest.slice(0, 2) };
  }

  return {
    primary: ordered[0][0],
    secondary: ordered.slice(1, 3).map(([k]) => k),
  };
}

/**
 * Extracts explicit years of total, banking, and managerial experience from description text.
 */
export function extractExperienceRequirements(text: string): {
  requiredTotalYears: number | null;
  requiredBankingYears: number | null;
  requiredManagerialYears: number | null;
  bankingExperienceSummary: string;
  managerialExperienceSummary: string;
} {
  const clean = String(text || '');
  let requiredTotalYears: number | null = null;
  let requiredBankingYears: number | null = null;
  let requiredManagerialYears: number | null = null;

  // Managerial years specifically
  const mgmtMatches = [
    ...clean.matchAll(
      /(\d{1,2})\s*(?:\+|to\s*\d{1,2}|-\s*\d{1,2})?\s*years?\s+(?:of\s+)?(?:progressive\s+|direct\s+|proven\s+|senior\s+)?(?:executive\s+|branch\s+)?(?:managerial|management|leadership|supervisory|people\s+management|branch\s+manager)/gi
    ),
    ...clean.matchAll(
      /(?:managerial|management|leadership|supervisory)\s+experience[^.\n]{0,40}?(\d{1,2})\s*\+?\s*years?/gi
    ),
  ];
  for (const m of mgmtMatches) {
    const val = parseInt(m[1], 10);
    if (!Number.isNaN(val) && val >= 0 && val <= 35) {
      requiredManagerialYears = requiredManagerialYears === null ? val : Math.max(requiredManagerialYears, val);
    }
  }

  // Banking years specifically
  const bankMatches = [
    ...clean.matchAll(
      /(\d{1,2})\s*(?:\+|to\s*\d{1,2}|-\s*\d{1,2})?\s*years?\s+(?:of\s+)?(?:progressive\s+|relevant\s+|proven\s+|senior\s+|executive\s+)?(?:retail\s+|commercial\s+|branch\s+)?(?:banking|financial\s+services|bank\s+operations|microfinance|credit)/gi
    ),
  ];
  for (const m of bankMatches) {
    const val = parseInt(m[1], 10);
    if (!Number.isNaN(val) && val >= 0 && val <= 40) {
      requiredBankingYears = requiredBankingYears === null ? val : Math.max(requiredBankingYears, val);
    }
  }

  // General minimum years
  const genMatches = [
    ...clean.matchAll(
      /(?:at\s+least|minimum\s+(?:of\s+)?|requires?\s+|with\s+)?(\d{1,2})\s*(?:\+|to\s*\d{1,2}|-\s*\d{1,2})?\s*years?\s+(?:of\s+)?(?:relevant|progressive|proven|professional|executive|work|related|experience|in\s+)/gi
    ),
  ];
  for (const m of genMatches) {
    const val = parseInt(m[1], 10);
    if (!Number.isNaN(val) && val >= 0 && val <= 40) {
      requiredTotalYears = requiredTotalYears === null ? val : Math.max(requiredTotalYears, val);
    }
  }

  if (requiredTotalYears === null && requiredBankingYears !== null) {
    requiredTotalYears = requiredBankingYears;
  }

  const bankingExperienceSummary =
    requiredBankingYears !== null
      ? `${requiredBankingYears}+ years of banking experience`
      : requiredTotalYears !== null
      ? `${requiredTotalYears}+ years of relevant experience`
      : 'Not explicitly stated — verify on official portal';

  const managerialExperienceSummary =
    requiredManagerialYears !== null
      ? `${requiredManagerialYears}+ years of managerial / leadership experience`
      : /\b(executive|vice\s+president|svp|evp|managing\s+director)\b/i.test(clean)
      ? 'Senior executive leadership track (10+ years)'
      : /\b(branch\s+manager|operations\s+manager|area\s+manager|regional\s+manager|supervis|manage\s+a\s+team|people\s+management)\b/i.test(
          clean
        )
      ? 'Managerial / team supervision experience required'
      : 'Not explicitly stated';

  return {
    requiredTotalYears,
    requiredBankingYears,
    requiredManagerialYears,
    bankingExperienceSummary,
    managerialExperienceSummary,
  };
}

/**
 * Classifies actual role seniority into the 10 mandatory tiers by combining
 * title, explicit years required, management authority, and responsibilities (Section 2B & 3).
 */
export function classifyRoleSeniority(
  title: string,
  description: string,
  exp: { requiredTotalYears: number | null; requiredBankingYears: number | null; requiredManagerialYears: number | null }
): CareerSeniorityLevel {
  const t = String(title || '').trim();
  const full = `${t}\n${description}`;
  const maxYears = Math.max(exp.requiredTotalYears ?? 0, exp.requiredBankingYears ?? 0);
  const mgmtYears = exp.requiredManagerialYears ?? 0;

  // Executive tier (VP, SVP, EVP, C-suite, Managing Director, or 14+ yrs executive requirement)
  if (
    EXECUTIVE_OVER_SENIOR_TITLE_RX.test(t) ||
    (maxYears >= 14 && /\b(executive|board\s+of\s+directors|c-suite|enterprise[- ]wide|group\s+strategy|vice\s+president)\b/i.test(full))
  ) {
    return 'executive';
  }

  // Director tier
  if (
    /\b(director|head\s+of\s+(?:retail|commercial|banking|operations|finance|wash|programs?))\b/i.test(t) &&
    !/\b(assistant\s+director|deputy\s+branch)\b/i.test(t)
  ) {
    return maxYears >= 14 ? 'executive' : 'director';
  }

  // Strictly non-managerial entry / junior roles
  if (JUNIOR_ENTRY_NON_MANAGERIAL_TITLE_RX.test(t)) {
    if (/\b(intern|trainee|entry[- ]level|fresh\s+graduate|cashier|teller|clerk|receptionist)\b/i.test(t)) {
      return 'entry_level';
    }
    return 'junior_professional';
  }

  // Senior Manager / Regional / Area Branch Manager
  if (
    /\b(senior\s+(?:branch|banking|operations|finance|credit|risk|compliance|relationship|wash)\s+manager|regional\s+branch\s+manager|area\s+branch\s+manager|branch\s+network\s+manager)\b/i.test(
      t
    )
  ) {
    return maxYears >= 13 || mgmtYears >= 8 ? 'director' : 'senior_manager';
  }

  // Deputy / Assistant Manager
  if (/\b(deputy\s+branch\s+manager|assistant\s+(?:branch|banking|operations|finance)\s+manager)\b/i.test(t)) {
    return 'assistant_manager';
  }

  // Manager (verify actual management/leadership responsibility or recognized managerial title)
  if (/\bmanager\b/i.test(t)) {
    if (mgmtYears >= 7 || maxYears >= 13) return 'director';
    if (mgmtYears >= 5 || maxYears >= 10) return 'senior_manager';
    // Watch out for inflated junior titles labeled "Manager" with 0-2 yrs & no team leadership
    if (maxYears > 0 && maxYears <= 2 && !/\b(supervis|manage\s+(?:staff|team)|direct\s+reports|branch\s+p&l)\b/i.test(full)) {
      return 'experienced_professional';
    }
    return 'manager';
  }

  // Supervisor / Team Lead
  if (/\b(supervisor|team\s+lead(?:er)?|unit\s+head|section\s+head|coordinator)\b/i.test(t)) {
    return 'supervisor';
  }

  // Senior Specialist / Officer / Engineer
  if (/\b(senior|lead|principal|specialist|advisor|consultant)\b/i.test(t) || maxYears >= 6) {
    return 'senior_professional';
  }

  // Mid / Experienced Professional
  if (maxYears >= 3 || /\b(officer|analyst|engineer|accountant|auditor)\b/i.test(t)) {
    return 'experienced_professional';
  }

  if (maxYears >= 1) return 'junior_professional';
  return 'entry_level';
}

/**
 * Period-normalized, zero-fabrication salary parser (Section 2C).
 * Distinguishes monthly vs annual, gross vs net, converts via current FX rates,
 * and returns "Not Disclosed" when no verified salary is published.
 */
export function normalizeSalaryRecord(
  opportunityId: string,
  text: string,
  fxRatesUsdBase: Record<string, number> = DEFAULT_FX_RATES_USD_BASE
): SalaryNormalizationRecord {
  const nowIso = new Date().toISOString();
  const clean = String(text || '').replace(/\u00a0/g, ' ');
  const undisclosed: SalaryNormalizationRecord = {
    opportunityId,
    disclosed: false,
    salaryDisplay: 'Salary not disclosed',
    period: 'unknown',
    taxBasis: 'not_specified',
    originalCurrency: null,
    minOriginalAmount: null,
    maxOriginalAmount: null,
    normalizedMonthlyUsd: null,
    normalizedAnnualUsd: null,
    exchangeRateUsed: 'N/A (Salary not disclosed)',
    verifiedAt: nowIso,
  };

  const mapCurrency = (raw: string): string => {
    const u = raw.trim().toUpperCase();
    if (u === '$' || u === 'US$' || u === 'USD') return 'USD';
    if (u === '€' || u === 'EUR') return 'EUR';
    if (u === '£' || u === 'GBP') return 'GBP';
    if (u === 'CHF') return 'CHF';
    if (u === 'SEK') return 'SEK';
    if (u === 'NOK') return 'NOK';
    if (u === 'DKK') return 'DKK';
    if (u === 'AED' || u === 'DHS') return 'AED';
    if (u === 'SAR') return 'SAR';
    if (u === 'QAR') return 'QAR';
    if (u === 'KWD') return 'KWD';
    if (u === 'OMR') return 'OMR';
    if (u === 'BHD') return 'BHD';
    if (u === 'CAD' || u === 'C$') return 'CAD';
    if (u === 'AUD' || u === 'A$') return 'AUD';
    if (u === 'ETB' || u === 'BIRR') return 'ETB';
    return u;
  };

  const parseAmount = (raw: string): number | null => {
    const s = raw.trim().toLowerCase();
    const isK = s.endsWith('k');
    const numeric = Number(s.replace(/k$/, '').replace(/,/g, ''));
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return isK ? numeric * 1000 : numeric;
  };

  const prefixRx =
    /(US\$|\$|€|£|\bUSD\b|\bEUR\b|\bGBP\b|\bCHF\b|\bSEK\b|\bNOK\b|\bDKK\b|\bAED\b|\bSAR\b|\bQAR\b|\bKWD\b|\bOMR\b|\bBHD\b|\bCAD\b|\bAUD\b|\bETB\b)\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?k?)\s*(?:(?:-|–|—|to)\s*(?:US\$|\$|€|£|USD|EUR|GBP|CHF|SEK|NOK|DKK|AED|SAR|QAR|KWD|OMR|BHD|CAD|AUD|ETB)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?k?))?\s*(?:(?:per|\/)\s*(year|yr|annum|month|mo)|annually|annual|monthly|p\.a\.|p\.m\.)?/gi;

  const suffixRx =
    /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?k?)\s*(?:(?:-|–|—|to)\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?k?))?\s*(USD|EUR|GBP|CHF|SEK|NOK|DKK|AED|SAR|QAR|KWD|OMR|BHD|CAD|AUD|ETB)\s*(?:(?:per|\/)\s*(year|yr|annum|month|mo)|annually|annual|monthly|p\.a\.|p\.m\.)?/gi;

  interface CandidateSal {
    currency: string;
    low: number;
    high: number;
    period: 'monthly' | 'annual';
    taxBasis: 'gross' | 'net' | 'not_specified';
    priority: number;
  }
  const found: CandidateSal[] = [];

  const evaluateMatch = (
    idx: number,
    fullMatch: string,
    currRaw: string,
    minRaw: string,
    maxRaw: string | undefined,
    periodRaw: string | undefined
  ) => {
    const start = Math.max(0, idx - 90);
    const end = Math.min(clean.length, idx + fullMatch.length + 90);
    const ctx = clean.slice(start, end);
    const ctxLower = ctx.toLowerCase();

    // Ignore company revenue/funding/grant totals when not explicitly salary
    if (
      /\b(funding|series\s+[a-d]|valuation|revenue|raised|aum|assets\s+under|market\s+cap|transactions?\s+volume|loan\s+size|tuition\s+fee|registration\s+fee)\b/i.test(
        ctxLower
      ) &&
      !/\b(salary|base\s+pay|gross\s+pay|remuneration|compensation|stipend)\b/i.test(ctxLower)
    ) {
      return;
    }

    const hasSalaryCue =
      /\b(salary|compensation|base\s+pay|gross\s+pay|net\s+pay|remuneration|pay\s+range|package|per\s+year|per\s+annum|annually|per\s+month|monthly|\/year|\/yr|\/month|\/mo|p\.a\.|p\.m\.)\b/i.test(
        ctxLower
      );
    if (!hasSalaryCue) return;

    const currency = mapCurrency(currRaw);
    const rate = fxRatesUsdBase[currency] || DEFAULT_FX_RATES_USD_BASE[currency];
    if (!rate) return;

    const v1 = parseAmount(minRaw);
    if (!v1) return;
    const v2 = maxRaw ? parseAmount(maxRaw) || v1 : v1;
    const low = Math.min(v1, v2);
    const high = Math.max(v1, v2);

    // Strictly distinguish monthly vs annual without ever mixing periods!
    let period: 'monthly' | 'annual';
    const joinedPeriod = `${periodRaw || ''} ${fullMatch}`.toLowerCase();
    if (/(month|\/mo\b|p\.m\.|monthly)/i.test(joinedPeriod) || /\b(per\s+month|monthly|\/\s*mo|\/\s*month)\b/i.test(ctxLower)) {
      period = 'monthly';
    } else if (/(year|\/yr\b|annual|annum|p\.a\.)/i.test(joinedPeriod) || /\b(per\s+year|annually|annual|\/\s*yr|\/\s*year|p\.a\.|per\s+annum)\b/i.test(ctxLower)) {
      period = 'annual';
    } else {
      // Conservative USD magnitude inference only when period is omitted
      const approxUsd = low / rate;
      period = approxUsd >= 18000 ? 'annual' : 'monthly';
    }

    const annualUsd = period === 'annual' ? low / rate : (low / rate) * 12;
    if (annualUsd < 1200 || annualUsd > 800000) return;

    const taxBasis: 'gross' | 'net' | 'not_specified' = /\b(net\s+salary|net\s+pay|tax[- ]free|after[- ]tax|take[- ]home)\b/i.test(
      ctxLower
    )
      ? 'net'
      : /\b(gross\s+salary|gross\s+pay|gross\s+base|before\s+tax|pre[- ]tax|base\s+salary)\b/i.test(ctxLower)
      ? 'gross'
      : 'not_specified';

    const priority = /\b(base\s+salary|gross\s+salary|monthly\s+salary|annual\s+salary|salary\s+range)\b/i.test(ctxLower) ? 3 : 2;
    found.push({ currency, low, high, period, taxBasis, priority });
  };

  let m: RegExpExecArray | null;
  while ((m = prefixRx.exec(clean)) !== null) {
    evaluateMatch(m.index, m[0], m[1], m[2], m[3], m[4]);
  }
  while ((m = suffixRx.exec(clean)) !== null) {
    evaluateMatch(m.index, m[0], m[3], m[1], m[2], m[4]);
  }

  if (found.length === 0) return undisclosed;

  found.sort((a, b) => b.priority - a.priority || b.low - a.low);
  const best = found[0];
  const rate = fxRatesUsdBase[best.currency] || DEFAULT_FX_RATES_USD_BASE[best.currency] || 1;

  // Always normalize to BOTH comparable periods (monthly and annual) cleanly
  const normalizedAnnualUsd = Math.round(
    best.period === 'annual' ? best.low / rate : (best.low / rate) * 12
  );
  const normalizedMonthlyUsd = Math.round(normalizedAnnualUsd / 12);

  const periodStr = best.period === 'annual' ? 'Annual' : 'Monthly';
  const taxStr =
    best.taxBasis === 'gross' ? 'Gross' : best.taxBasis === 'net' ? 'Net' : 'Tax basis not specified';
  const rangeStr =
    best.high > best.low
      ? `${best.currency} ${best.low.toLocaleString()}–${best.high.toLocaleString()}`
      : `${best.currency} ${best.low.toLocaleString()}`;

  const salaryDisplay = `${rangeStr} (${periodStr}, ${taxStr}) ≈ USD $${normalizedMonthlyUsd.toLocaleString()}/month ($${normalizedAnnualUsd.toLocaleString()}/year)`;
  const exchangeRateUsed =
    best.currency === 'USD'
      ? '1 USD = 1.0000 USD'
      : `1 ${best.currency} = $${(1 / rate).toFixed(4)} USD`;

  return {
    opportunityId,
    disclosed: true,
    salaryDisplay,
    period: best.period,
    taxBasis: best.taxBasis,
    originalCurrency: best.currency,
    minOriginalAmount: best.low,
    maxOriginalAmount: best.high,
    normalizedMonthlyUsd,
    normalizedAnnualUsd,
    exchangeRateUsed,
    verifiedAt: nowIso,
  };
}

/**
 * Detects work arrangement (Remote / Hybrid / On-Site / Not Specified) for Section 9 separation.
 */
export function detectWorkMode(text: string): WorkModeType {
  const lower = String(text || '').toLowerCase();
  if (/\b(hybrid\s+(?:work|role|position|working|schedule)|partially\s+remote|\d+\s+days?\s+(?:in\s+office|on-?site))\b/i.test(lower)) {
    return 'hybrid';
  }
  if (/\b(fully\s+remote|100%\s+remote|remote[- ]first|work\s+from\s+anywhere|remote\s+(?:work|role|position|worldwide|global)|telecommute)\b/i.test(lower)) {
    return 'remote';
  }
  if (/\b(on[- ]?site|in[- ]?person|branch[- ]based|office[- ]based|relocation\s+to\s+[a-z]+)\b/i.test(lower)) {
    return 'onsite';
  }
  return 'not_specified';
}

/**
 * Evaluates Section 5 Direct Application Link Verification:
 * Priority order:
 *   1. Employer official career portal
 *   2. University / scholarship provider official portal
 *   3. Official government portal
 *   4. Authorized recruitment platform explicitly linked by the organization
 * Rejects search-result URLs, generic homepages without a vacancy path, non-HTTPS URLs, and dead links.
 */
export function evaluateDirectApplicationLink(params: {
  url: string;
  sourceUrl?: string;
  title?: string;
  category: OpportunityCategory;
  employer?: string;
  checkedAtIso?: string;
  linkCheckOverride?: {
    httpStatus: number | null;
    finalUrl?: string;
    titleMatched?: boolean;
    employerMatched?: boolean;
    isClosedText?: boolean;
    errorMessage?: string;
    note?: string;
  };
}): ApplicationLinkVerificationRecord {
  const nowIso = params.checkedAtIso || new Date().toISOString();
  const rawUrl = String(params.url || '').trim();

  if (!rawUrl || !/^https:\/\//i.test(rawUrl)) {
    return {
      status: 'NOT VERIFIED',
      priorityTier: 0,
      priorityLabel: 'Invalid or non-HTTPS link',
      directApplicationUrl: rawUrl,
      httpStatus: params.linkCheckOverride?.httpStatus ?? null,
      titleMatched: false,
      employerMatched: false,
      isGenericHomepage: false,
      isSearchResultUrl: false,
      checkedAt: nowIso,
      note: 'Direct application URL must be a valid HTTPS link to the official application page.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      status: 'NOT VERIFIED',
      priorityTier: 0,
      priorityLabel: 'Malformed URL',
      directApplicationUrl: rawUrl,
      httpStatus: null,
      titleMatched: false,
      employerMatched: false,
      isGenericHomepage: false,
      isSearchResultUrl: false,
      checkedAt: nowIso,
      note: 'Application link URL could not be parsed.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const search = parsed.search.toLowerCase();

  // Reject search-result pages, query-only pages, and broken tracking redirects
  const isSearchPage =
    /\/(search|results|find-jobs|job-search|browse-jobs)\b/i.test(pathname) ||
    /([?&](q|query|keyword|keywords|search|s|k)=)/i.test(search) ||
    /\b(google\.|bing\.com|duckduckgo\.com|yahoo\.com)\b/i.test(host);

  if (isSearchPage) {
    return {
      status: 'NOT VERIFIED',
      priorityTier: 0,
      priorityLabel: 'Rejected search-result URL',
      directApplicationUrl: rawUrl,
      httpStatus: params.linkCheckOverride?.httpStatus ?? null,
      titleMatched: false,
      employerMatched: false,
      isGenericHomepage: false,
      isSearchResultUrl: true,
      checkedAt: nowIso,
      note: 'Rejected search-result URL — must link directly to the specific official opportunity application page.',
    };
  }

  // Reject bare generic homepages (e.g., https://www.bayt.com/ or https://www.daad.de/en/)
  const segments = pathname.split('/').filter(Boolean);
  const genericRootOnly =
    segments.length === 0 ||
    (segments.length === 1 && /^(en|de|fr|ar|sv|no|da|home|index|index\.html|jobs|careers|scholarships|opportunities|about)$/i.test(segments[0])) ||
    (segments.length === 2 && /^(en|de|fr|ar|sv|no|da)$/i.test(segments[0]) && /^(home|jobs|careers|scholarships|opportunities|events|courses)$/i.test(segments[1]));

  if (genericRootOnly && !parsed.search) {
    return {
      status: 'NOT VERIFIED',
      priorityTier: 0,
      priorityLabel: 'Rejected generic homepage URL',
      directApplicationUrl: rawUrl,
      httpStatus: params.linkCheckOverride?.httpStatus ?? null,
      titleMatched: false,
      employerMatched: false,
      isGenericHomepage: true,
      isSearchResultUrl: false,
      checkedAt: nowIso,
      note: 'Rejected generic homepage URL — direct link to the specific opportunity application page is required.',
    };
  }

  // Check live HTTP check override if supplied (on-open or 24h verification)
  if (params.linkCheckOverride) {
    const code = params.linkCheckOverride.httpStatus;
    if (params.linkCheckOverride.isClosedText) {
      return {
        status: 'NOT VERIFIED',
        priorityTier: 0,
        priorityLabel: 'Official page reports vacancy closed',
        directApplicationUrl: rawUrl,
        httpStatus: code,
        titleMatched: Boolean(params.linkCheckOverride.titleMatched),
        employerMatched: Boolean(params.linkCheckOverride.employerMatched),
        isGenericHomepage: false,
        isSearchResultUrl: false,
        checkedAt: nowIso,
        note: 'Official application page states that applications are closed or the position is filled.',
      };
    }
    if (code !== null && (code >= 400 || code === 0)) {
      return {
        status: 'NOT VERIFIED',
        priorityTier: 0,
        priorityLabel: 'Broken or unreachable link',
        directApplicationUrl: rawUrl,
        httpStatus: code || null,
        titleMatched: false,
        employerMatched: false,
        isGenericHomepage: false,
        isSearchResultUrl: false,
        checkedAt: nowIso,
        note:
          params.linkCheckOverride.errorMessage ||
          params.linkCheckOverride.note ||
          `Direct application link returned HTTP ${code} and cannot be published as verified active.`,
      };
    }
  }

  // Priority classification (Section 5: 1 Employer -> 2 University/Scholarship -> 3 Official Gov -> 4 Authorized Recruitment Platform)
  let priorityTier: 1 | 2 | 3 | 4 = 1;
  let priorityLabel = 'Priority 1: Employer Official Career Portal';

  const isGov =
    /\.(gov|govt|gouv|gob)(\.[a-z]{2})?$/i.test(host) ||
    /\b(usajobs\.gov|nsf\.gov|nih\.gov|europa\.eu|eures\.europa\.eu|nav\.no|arbetsformedlingen\.se|jobnet\.dk|make-it-in-germany\.com|studyinsaudi\.moe\.gov\.sa|turkiyeburslari\.gov\.tr|careers\.un\.org|undp\.org|who\.int|worldbank\.org|afdb\.org)\b/i.test(
      host
    );

  const isUniversityOrScholarship =
    /\.(edu|ac\.[a-z]{2})$/i.test(host) ||
    /\b(daad\.de|chevening\.org|fulbrightonline\.org|scholarship|fellowship|studyinsweden\.se|studyinnorway\.no|studyindenmark\.dk|mit\.edu|harvard\.edu|ox\.ac\.uk|cam\.ac\.uk|ethiopian-scholarships)\b/i.test(
      host
    );

  const isAuthorizedPlatform =
    /\b(bayt\.com|gulftalent\.com|naukrigulf\.com|reliefweb\.int|jobs\.ac\.uk|indeed\.com|monster\.com|glassdoor\.com|stepstone\.de|academicpositions\.com|thehub\.io|finn\.no|jobindex\.dk|thelocal\.se|arbeitnow\.com|ethiojobs\.net|dereja\.com|effoysira\.com|greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|icims\.com|taleo\.net)\b/i.test(
      host
    );

  if (isAuthorizedPlatform) {
    if (/\b(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|icims\.com|taleo\.net)\b/i.test(host)) {
      priorityTier = 1;
      priorityLabel = 'Priority 1: Employer Official Application Portal (ATS)';
    } else {
      priorityTier = 4;
      priorityLabel = 'Priority 4: Authorized Recruitment / Official Listing Platform';
    }
  } else if (isUniversityOrScholarship || params.category === 'scholarship') {
    priorityTier = 2;
    priorityLabel = 'Priority 2: University / Scholarship Provider Official Portal';
  } else if (isGov) {
    priorityTier = 3;
    priorityLabel = 'Priority 3: Official Government / International Agency Portal';
  } else {
    priorityTier = 1;
    priorityLabel = 'Priority 1: Employer Official Career Portal';
  }

  return {
    status: 'VERIFIED',
    priorityTier,
    priorityLabel,
    directApplicationUrl: rawUrl,
    httpStatus: params.linkCheckOverride?.httpStatus ?? 200,
    titleMatched: params.linkCheckOverride?.titleMatched ?? true,
    employerMatched: params.linkCheckOverride?.employerMatched ?? true,
    isGenericHomepage: false,
    isSearchResultUrl: false,
    checkedAt: nowIso,
    note: params.linkCheckOverride?.note || priorityLabel,
  };
}

/**
 * Evaluates Section 4 Strict Application Deadline Verification.
 * - Never invents or estimates deadlines.
 * - Returns one of the exact 6 mandatory statuses:
 *   OPEN — ACCEPTING APPLICATIONS | CLOSING SOON | DEADLINE PASSED | APPLICATIONS CLOSED | DEADLINE NOT PUBLISHED | NOT YET OPEN
 * - Extracts closing time and timezone when published.
 * - Rejects past-deadline or closed vacancies from active publication.
 */
export function evaluateStrictThreeDayDeadline(
  rawDeadline: string | null | undefined,
  nowMs: number = Date.now(),
  isClosedOrWithdrawn = false,
  openingDateRaw?: string | null
): {
  passed: boolean;
  deadlineIso: string | null;
  deadlineDateExact: string | null;
  deadlineTime: string | null;
  deadlineTimezone: string | null;
  deadlineStatusLabel: DeadlineStatusLabel;
  deadlineEvidence: string;
  fullDaysRemaining: number | null;
  rejectionCode: RejectionReasonCode | null;
  explanation: string;
} {
  if (isClosedOrWithdrawn) {
    return {
      passed: false,
      deadlineIso: null,
      deadlineDateExact: null,
      deadlineTime: null,
      deadlineTimezone: null,
      deadlineStatusLabel: 'APPLICATIONS CLOSED',
      deadlineEvidence: 'Official source reports that applications are closed or withdrawn.',
      fullDaysRemaining: 0,
      rejectionCode: 'closed_or_withdrawn',
      explanation: 'APPLICATIONS CLOSED — Opportunity is marked closed or withdrawn at the official source.',
    };
  }

  // Check if opportunity is NOT YET OPEN based on official opening date
  const openRaw = String(openingDateRaw || '').trim();
  if (openRaw) {
    const openNorm = /^\d{4}-\d{2}-\d{2}$/.test(openRaw) ? `${openRaw}T00:00:00Z` : openRaw;
    const openMs = Date.parse(openNorm);
    if (!Number.isNaN(openMs) && openMs > nowMs) {
      const daysUntilOpen = Math.ceil((openMs - nowMs) / (1000 * 60 * 60 * 24));
      return {
        passed: false,
        deadlineIso: null,
        deadlineDateExact: null,
        deadlineTime: null,
        deadlineTimezone: null,
        deadlineStatusLabel: 'NOT YET OPEN',
        deadlineEvidence: `Official application window opens on ${openRaw} (in ${daysUntilOpen} day(s)).`,
        fullDaysRemaining: null,
        rejectionCode: 'closed_or_withdrawn',
        explanation: `NOT YET OPEN — Official application portal opens on ${openRaw}.`,
      };
    }
  }

  const raw = String(rawDeadline || '').trim();
  const inlineOpenMatch = raw.match(/\b(?:applications?\s+)?opens?\s+(?:on\s+)?(\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})\b/i);
  if (inlineOpenMatch || /\bnot\s+yet\s+open\b/i.test(raw)) {
    const inlineDateStr = inlineOpenMatch?.[1] || '';
    const inlineNorm = /^\d{4}-\d{2}-\d{2}$/.test(inlineDateStr) ? `${inlineDateStr}T00:00:00Z` : inlineDateStr;
    const inlineMs = inlineNorm ? Date.parse(inlineNorm) : NaN;
    if (Number.isNaN(inlineMs) || inlineMs > nowMs) {
      return {
        passed: false,
        deadlineIso: null,
        deadlineDateExact: null,
        deadlineTime: null,
        deadlineTimezone: null,
        deadlineStatusLabel: 'NOT YET OPEN',
        deadlineEvidence: inlineDateStr
          ? `Official application window opens on ${inlineDateStr}.`
          : `Official listing reports "${raw}" (not yet open).`,
        fullDaysRemaining: null,
        rejectionCode: 'closed_or_withdrawn',
        explanation: `NOT YET OPEN — ${raw}.`,
      };
    }
  }
  if (
    !raw ||
    /^(rolling|ongoing|open|open\s+until\s+filled|not\s+stated|not\s+published|deadline\s+not\s+published|until\s+filled|tbd|n\/a)$/i.test(
      raw
    )
  ) {
    return {
      passed: true,
      deadlineIso: null,
      deadlineDateExact: null,
      deadlineTime: null,
      deadlineTimezone: null,
      deadlineStatusLabel: 'DEADLINE NOT PUBLISHED',
      deadlineEvidence: raw
        ? `Official source states "${raw}" (exact closing date not published).`
        : 'Exact closing date not published on the official listing.',
      fullDaysRemaining: null,
      rejectionCode: null,
      explanation: 'DEADLINE NOT PUBLISHED — Official listing verified active without a fixed closing date.',
    };
  }

  // Extract explicit time and timezone if published in the deadline string
  const timeMatch = raw.match(/\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM))?)\b/i);
  const tzMatch = raw.match(/\b(UTC(?:[+-]\d{1,2}(?::\d{2})?)?|GMT(?:[+-]\d{1,2})?|EAT|CET|CEST|EST|EDT|PST|PDT|BST|GST|AST|CAT|SAST)\b/i);
  const deadlineTime = timeMatch ? timeMatch[1].trim() : null;
  const deadlineTimezone = tzMatch ? tzMatch[1].trim().toUpperCase() : raw.endsWith('Z') ? 'UTC' : null;

  let targetMs = NaN;
  let exactDate: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    exactDate = raw;
    targetMs = Date.parse(`${raw}T23:59:59Z`);
  } else {
    targetMs = Date.parse(raw);
    if (!Number.isNaN(targetMs)) {
      exactDate = new Date(targetMs).toISOString().slice(0, 10);
    }
  }

  if (Number.isNaN(targetMs)) {
    return {
      passed: true,
      deadlineIso: null,
      deadlineDateExact: null,
      deadlineTime,
      deadlineTimezone,
      deadlineStatusLabel: 'DEADLINE NOT PUBLISHED',
      deadlineEvidence: `Unparseable official deadline text: "${raw}" — verify exact date on official portal.`,
      fullDaysRemaining: null,
      rejectionCode: null,
      explanation: 'DEADLINE NOT PUBLISHED — Official date text could not be parsed cleanly without guessing.',
    };
  }

  const diffMs = targetMs - nowMs;
  const hoursRemaining = diffMs / (1000 * 60 * 60);
  const fullDaysRemaining = Math.max(0, Math.floor(hoursRemaining / 24));
  const deadlineIso = new Date(targetMs).toISOString();

  if (diffMs <= 0) {
    return {
      passed: false,
      deadlineIso,
      deadlineDateExact: exactDate,
      deadlineTime,
      deadlineTimezone,
      deadlineStatusLabel: 'DEADLINE PASSED',
      deadlineEvidence: `Official deadline (${raw}) passed on ${exactDate || deadlineIso}.`,
      fullDaysRemaining: 0,
      rejectionCode: 'deadline_expired',
      explanation: `DEADLINE PASSED — Official deadline (${raw}) has already passed.`,
    };
  }

  // Closing soon threshold: <= 7 days remaining (while still open — never hide valid open opportunities > 72h,
  // and flag <= 7 days clearly as CLOSING SOON; enforce 72h minimum only if strictly under 3 days? Wait:
  // Section 4 says: "Never display past-deadline or closed vacancies as open. Show: OPEN — ACCEPTING APPLICATIONS, CLOSING SOON..."
  // Keep < 72h check as closing_soon if caller allows or reject under 72h? Let's check existing tests:
  // test-opportunity-intelligence-master tests that < 3 days is rejected with deadline_under_three_days!
  // AND opportunities with 3..7 days remaining are ACTIVE with label CLOSING SOON, > 7 days are OPEN — ACCEPTING APPLICATIONS!
  if (hoursRemaining < MINIMUM_DEADLINE_HOURS) {
    return {
      passed: false,
      deadlineIso,
      deadlineDateExact: exactDate,
      deadlineTime,
      deadlineTimezone,
      deadlineStatusLabel: 'CLOSING SOON',
      deadlineEvidence: `Official deadline (${raw}) has only ${fullDaysRemaining} full day(s) (${Math.round(hoursRemaining)}h) remaining.`,
      fullDaysRemaining,
      rejectionCode: 'deadline_under_three_days',
      explanation: `CLOSING SOON — Only ${fullDaysRemaining} full day(s) (${Math.round(hoursRemaining)}h) remaining before official deadline (${raw}); minimum 3 full days (72h) required for new recommendations.`,
    };
  }

  const isClosingSoon = fullDaysRemaining <= 7;
  const label: DeadlineStatusLabel = isClosingSoon ? 'CLOSING SOON' : 'OPEN — ACCEPTING APPLICATIONS';

  return {
    passed: true,
    deadlineIso,
    deadlineDateExact: exactDate,
    deadlineTime,
    deadlineTimezone,
    deadlineStatusLabel: label,
    deadlineEvidence: `Official closing date ${exactDate || raw}${deadlineTime ? ` at ${deadlineTime}` : ''}${deadlineTimezone ? ` (${deadlineTimezone})` : ''}.`,
    fullDaysRemaining,
    rejectionCode: null,
    explanation: `${label} — ${fullDaysRemaining} full days remaining before official deadline (${exactDate || raw}).`,
  };
}

/**
 * Section 3 Visa Sponsorship Transparency & Work Authorization Evaluator.
 * - Separates Ethiopian domestic opportunities clearly ("Visa sponsorship not applicable — domestic opportunity").
 * - For international opportunities, assigns ONE of the exact 4 statuses:
 *     1. VISA SPONSORSHIP CONFIRMED
 *     2. VISA SPONSORSHIP NOT OFFERED
 *     3. VISA SPONSORSHIP NOT SPECIFIED
 *     4. VISA SPONSORSHIP REQUIRES CONFIRMATION
 * - NEVER confuses "International applicants welcome", "Relocation assistance", "Work permit sponsorship",
 *   "Visa sponsorship", or historical employer sponsorship of other roles.
 */
export function evaluateVisaAndAuthorization(params: {
  opportunityId: string;
  category: OpportunityCategory;
  environment: OpportunityEnvironment;
  country: string;
  text: string;
  sourceUrl?: string;
  userLegalWorkCountries?: string[];
  visaSponsorshipRevoked?: boolean;
}): VisaAuthorizationRecord {
  const nowIso = new Date().toISOString();
  const clean = String(params.text || '');
  const lower = clean.toLowerCase();
  const evidenceSourceUrl = params.sourceUrl || null;

  if (params.environment === 'ethiopia_domestic') {
    return {
      opportunityId: params.opportunityId,
      environment: 'ethiopia_domestic',
      conditionMet: 'domestic_not_required',
      transparencyStatus: 'Visa sponsorship not applicable — domestic opportunity',
      verified: true,
      visaSponsored: false,
      workPermitSponsored: false,
      internationalApplicantsWelcome: false,
      visaFeesCovered: 'not_confirmed',
      relocationSupport: 'not_confirmed',
      relocationDetails: 'Ethiopian domestic role — international work visa sponsorship not applicable.',
      invitationLetterOnly: false,
      touristEntryRejected: false,
      sponsorshipStatement: 'Visa sponsorship not applicable — domestic opportunity in Ethiopia.',
      evidenceQuote: 'Domestic opportunity located in Ethiopia.',
      evidenceSourceUrl,
      statusLabel: 'Visa sponsorship not applicable — domestic opportunity',
      lastVerifiedAt: nowIso,
    };
  }

  if (params.visaSponsorshipRevoked) {
    return {
      opportunityId: params.opportunityId,
      environment: 'international',
      conditionMet: 'none',
      transparencyStatus: 'VISA SPONSORSHIP NOT OFFERED',
      verified: false,
      visaSponsored: false,
      workPermitSponsored: false,
      internationalApplicantsWelcome: false,
      visaFeesCovered: 'no',
      relocationSupport: 'no',
      relocationDetails: 'Previously confirmed sponsorship was revoked/removed at the official source.',
      invitationLetterOnly: false,
      touristEntryRejected: false,
      sponsorshipStatement: 'Work visa sponsorship revoked or no longer confirmed at official source.',
      evidenceQuote: 'Official listing updated to remove or revoke visa sponsorship.',
      evidenceSourceUrl,
      statusLabel: 'VISA SPONSORSHIP NOT OFFERED',
      lastVerifiedAt: nowIso,
    };
  }

  const touristOnlyRx =
    /\b(tourist\s+visa[- ]free|visa[- ]free\s+entry\s+for\s+tourism|visit\s+visa\s+only|tourist\s+visa\s+on\s+arrival|permission\s+to\s+apply\s+for\s+a\s+visa|apply\s+for\s+a\s+visa\s+independently|self[- ]sponsored\s+visa\s+application)\b/i;
  const touristEntryRejected = touristOnlyRx.test(lower);

  const negationMatch = clean.match(
    /[^.\n]{0,80}\b(no\s+visa\s+sponsorship|cannot\s+sponsor|unable\s+to\s+sponsor|do\s+not\s+sponsor|does\s+not\s+sponsor|will\s+not\s+sponsor|not\s+able\s+to\s+sponsor|without\s+visa\s+sponsorship|sponsorship\s+(?:is\s+)?not\s+(?:available|offered|provided)|must\s+already\s+have\s+(?:the\s+)?right\s+to\s+work|existing\s+work\s+authorization\s+required|local\s+citizens?\s+only|no\s+longer\s+sponsoring)\b[^.\n]{0,100}/i
  );

  const applicantPaysVisaRx =
    /\b(visa\s+(?:fees?|costs?)\s+(?:are\s+)?(?:the\s+)?(?:applicant['’]?s|participant['’]?s|your)\s+responsibility|applicants?\s+(?:must\s+)?pay\s+(?:for\s+)?(?:their\s+own\s+)?visa|self[- ]funded\s+visa|visa\s+costs?\s+not\s+covered|does\s+not\s+cover\s+visa)\b/i;

  const invitationOnlyRx =
    /\b(invitation\s+letter\s+only|only\s+(?:an?\s+)?invitation\s+letter|provide\s+an?\s+invitation\s+letter\s+for\s+visa|visa\s+support\s+letter\s+only)\b/i;

  const visaFeesCoveredRx =
    /\b(visa\s+(?:fees?|application\s+fees?|costs?)\s+(?:are\s+)?(?:fully\s+)?(?:covered|reimbursed|paid|funded|included)|fully\s+funded\s+including\s+visa|covers?\s+(?:all\s+)?(?:travel,?\s+|accommodation,?\s+)?visa\s+(?:fees?|costs?)|visa\s+sponsorship\s+and\s+visa\s+fees?\s+covered)\b/i;

  const internationalWelcomeMatch = clean.match(
    /[^.\n]{0,70}\b(international\s+applicants?\s+(?:are\s+)?welcome|open\s+to\s+international\s+(?:applicants|candidates)|global\s+applicants?\s+welcome|candidates?\s+from\s+all\s+nationalities)\b[^.\n]{0,90}/i
  );
  const internationalApplicantsWelcome = Boolean(internationalWelcomeMatch);

  // Ambiguous / requires confirmation phrases: historical sponsorship, "may consider", "case-by-case", relocation only
  const requiresConfirmationMatch = clean.match(
    /[^.\n]{0,80}\b(visa\s+sponsorship\s+(?:may\s+be|might\s+be|could\s+be)\s+(?:considered|available|provided)|case[- ]by[- ]case\s+sponsorship|previously\s+sponsored|licensed\s+sponsor\s+(?:register|holder)|has\s+sponsored\s+other\s+roles|subject\s+to\s+visa\s+eligibility|visa\s+assistance\s+may\s+be\s+discussed)\b[^.\n]{0,100}/i
  );

  const relocMatch = clean.match(
    /[^.\n]{0,90}\b(relocation\s+(?:package|support|assistance|allowance|covered|provided)|flight\s+tickets?\s+(?:covered|provided)|airfare\s+covered|housing\s+allowance|mobilization\s+allowance)\b[^.\n]{0,110}/i
  );
  const relocationSupport: 'yes' | 'no' | 'not_confirmed' = relocMatch ? 'yes' : 'not_confirmed';
  const relocationDetails = relocMatch
    ? relocMatch[0].replace(/\s+/g, ' ').trim().slice(0, 220)
    : 'Not explicitly specified';

  // Scholarships, Training, Conferences
  if (params.category !== 'job' && params.category !== 'internship') {
    const hasVisaFeesCovered = visaFeesCoveredRx.test(lower);
    const hasOfficialVisaSponsorship =
      /\b(visa\s+sponsorship\s+(?:is\s+)?(?:provided|included|covered|offered|confirmed)|sponsor(?:s|ing)?\s+(?:your\s+)?(?:student|training|conference|j-1|schengen|uk)\s+visa|official\s+visa\s+sponsorship)\b/i.test(
        lower
      );
    const isApplicantPaid = applicantPaysVisaRx.test(lower);
    const isInvitationOnly = invitationOnlyRx.test(lower) && !hasVisaFeesCovered && !hasOfficialVisaSponsorship;

    if (negationMatch || isApplicantPaid) {
      return {
        opportunityId: params.opportunityId,
        environment: 'international',
        conditionMet: 'none',
        transparencyStatus: 'VISA SPONSORSHIP NOT OFFERED',
        verified: false,
        visaSponsored: false,
        workPermitSponsored: false,
        internationalApplicantsWelcome,
        visaFeesCovered: 'no',
        relocationSupport,
        relocationDetails,
        invitationLetterOnly: isInvitationOnly,
        touristEntryRejected,
        sponsorshipStatement: isApplicantPaid
          ? 'Visa costs are the applicant’s responsibility.'
          : negationMatch![0].replace(/\s+/g, ' ').trim().slice(0, 240),
        evidenceQuote: (negationMatch?.[0] || 'Visa fees not covered by organizer.').replace(/\s+/g, ' ').trim().slice(0, 220),
        evidenceSourceUrl,
        statusLabel: 'VISA SPONSORSHIP NOT OFFERED',
        lastVerifiedAt: nowIso,
      };
    }

    if (isInvitationOnly) {
      return {
        opportunityId: params.opportunityId,
        environment: 'international',
        conditionMet: 'none',
        transparencyStatus: 'VISA SPONSORSHIP REQUIRES CONFIRMATION',
        verified: false,
        visaSponsored: false,
        workPermitSponsored: false,
        internationalApplicantsWelcome,
        visaFeesCovered: 'not_confirmed',
        relocationSupport,
        relocationDetails,
        invitationLetterOnly: true,
        touristEntryRejected,
        sponsorshipStatement: 'Invitation letter only — organizer does not confirm visa sponsorship or visa fee coverage.',
        evidenceQuote: 'Invitation letter only mentioned without visa fee coverage.',
        evidenceSourceUrl,
        statusLabel: 'VISA SPONSORSHIP REQUIRES CONFIRMATION',
        lastVerifiedAt: nowIso,
      };
    }

    if (hasVisaFeesCovered || hasOfficialVisaSponsorship) {
      const matchSnippet =
        clean.match(visaFeesCoveredRx)?.[0] ||
        clean.match(/\b[^.\n]{0,80}visa\s+sponsorship[^.\n]{0,90}/i)?.[0] ||
        'Confirmed official visa sponsorship / visa fee coverage.';

      return {
        opportunityId: params.opportunityId,
        environment: 'international',
        conditionMet: 'A_employer_work_visa',
        transparencyStatus: 'VISA SPONSORSHIP CONFIRMED',
        verified: true,
        visaSponsored: true,
        workPermitSponsored: false,
        internationalApplicantsWelcome,
        visaFeesCovered: hasVisaFeesCovered ? 'yes' : 'not_confirmed',
        relocationSupport,
        relocationDetails,
        invitationLetterOnly: false,
        touristEntryRejected: false,
        sponsorshipStatement: matchSnippet.replace(/\s+/g, ' ').trim().slice(0, 240),
        evidenceQuote: matchSnippet.replace(/\s+/g, ' ').trim().slice(0, 220),
        evidenceSourceUrl,
        statusLabel: 'VISA SPONSORSHIP CONFIRMED',
        lastVerifiedAt: nowIso,
      };
    }

    const reqConf = Boolean(requiresConfirmationMatch || internationalApplicantsWelcome || relocMatch);
    return {
      opportunityId: params.opportunityId,
      environment: 'international',
      conditionMet: 'none',
      transparencyStatus: reqConf ? 'VISA SPONSORSHIP REQUIRES CONFIRMATION' : 'VISA SPONSORSHIP NOT SPECIFIED',
      verified: false,
      visaSponsored: false,
      workPermitSponsored: false,
      internationalApplicantsWelcome,
      visaFeesCovered: 'not_confirmed',
      relocationSupport,
      relocationDetails,
      invitationLetterOnly: false,
      touristEntryRejected,
      sponsorshipStatement: reqConf
        ? 'International applicants or relocation mentioned, but official visa sponsorship requires direct confirmation with the organizer.'
        : 'Official listing does not specify visa sponsorship terms.',
      evidenceQuote: (requiresConfirmationMatch?.[0] || internationalWelcomeMatch?.[0] || relocMatch?.[0] || 'No visa sponsorship statement found on official page.')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 220),
      evidenceSourceUrl,
      statusLabel: reqConf ? 'VISA SPONSORSHIP REQUIRES CONFIRMATION' : 'VISA SPONSORSHIP NOT SPECIFIED',
      lastVerifiedAt: nowIso,
    };
  }

  // International Jobs & Internships
  const legalCountries = (params.userLegalWorkCountries || []).map((c) => c.toLowerCase().trim()).filter(Boolean);
  const countryLower = String(params.country || '').toLowerCase().trim();
  const hasConditionC =
    Boolean(countryLower) &&
    legalCountries.some((c) => countryLower.includes(c) || c.includes(countryLower)) &&
    !touristEntryRejected;

  if (negationMatch) {
    if (hasConditionC) {
      return {
        opportunityId: params.opportunityId,
        environment: 'international',
        conditionMet: 'C_legal_right_no_sponsorship',
        transparencyStatus: 'VISA SPONSORSHIP NOT OFFERED',
        verified: true,
        visaSponsored: false,
        workPermitSponsored: false,
        internationalApplicantsWelcome,
        visaFeesCovered: 'no',
        relocationSupport,
        relocationDetails,
        invitationLetterOnly: false,
        touristEntryRejected: false,
        sponsorshipStatement: `Employer does not offer visa sponsorship, but applicant holds confirmed legal work authorization in ${params.country}.`,
        evidenceQuote: negationMatch[0].replace(/\s+/g, ' ').trim().slice(0, 220),
        evidenceSourceUrl,
        statusLabel: 'VISA SPONSORSHIP NOT OFFERED',
        lastVerifiedAt: nowIso,
      };
    }
    return {
      opportunityId: params.opportunityId,
      environment: 'international',
      conditionMet: 'none',
      transparencyStatus: 'VISA SPONSORSHIP NOT OFFERED',
      verified: false,
      visaSponsored: false,
      workPermitSponsored: false,
      internationalApplicantsWelcome,
      visaFeesCovered: 'no',
      relocationSupport,
      relocationDetails,
      invitationLetterOnly: false,
      touristEntryRejected,
      sponsorshipStatement: negationMatch[0].replace(/\s+/g, ' ').trim().slice(0, 240),
      evidenceQuote: negationMatch[0].replace(/\s+/g, ' ').trim().slice(0, 220),
      evidenceSourceUrl,
      statusLabel: 'VISA SPONSORSHIP NOT OFFERED',
      lastVerifiedAt: nowIso,
    };
  }

  // Explicitly distinguish confirmed employer work visa sponsorship vs work permit sponsorship
  const condAMatch = clean.match(
    /[^.\n]{0,100}\b((?:we|employer|company|bank|[a-z]+)\s+(?:offer|offers|provide|provides|can\s+provide|support|supports)\s+(?:full\s+)?(?:[a-z-]+\s+)?(?:employment\s+|work\s+|skilled\s+worker\s+|work\s+permit\s+(?:and|&|\/)\s+)?visa\s+sponsorship|(?:we|employer|company|organization|bank)\s+(?:will\s+)?sponsor(?:s|ing)?\s+(?:your\s+)?(?:[a-z-]+\s+){0,3}(?:work|employment|skilled\s+worker)\s+visa|employer[- ]sponsored\s+(?:work\s+)?visa|(?:work|employment|skilled\s+worker|residence|uae|uk|eu|swedish|german|dutch|danish|norwegian|qatar|saudi)\s+(?:work\s+)?visa\s+sponsorship|work\s+permit\s+(?:and|&|\/)\s+visa\s+sponsorship|visa\s+sponsorship\s+(?:is\s+)?(?:available|provided|offered|included|confirmed)|full\s+visa\s+sponsorship|g-4\s+visa|h-1b\s+sponsorship|iqama\s+sponsorship|employment\s+visa\s+sponsored)\b[^.\n]{0,120}/i
  );

  const condBMatch = clean.match(
    /[^.\n]{0,100}\b(work\s+permit\s+(?:(?:and|&|\/)\s+(?:visa|immigration)\s+)?sponsorship|immigration\s+sponsorship|eu\s+blue\s+card\s+sponsorship|sponsor(?:s|ing)?\s+(?:your\s+)?(?:[a-z-]+\s+)?work\s+permit|residence\s+and\s+work\s+permit\s+sponsored|company\s+sponsors?\s+(?:work\s+permit|employment\s+pass)|provides?\s+(?:[a-z-]+\s+)?work\s+permit\s+sponsorship)\b[^.\n]{0,120}/i
  );

  // Never classify as VISA SPONSORSHIP CONFIRMED if only past sponsorship or "may be considered" is mentioned without explicit role sponsorship
  const pastOrConditionalOnly = Boolean(requiresConfirmationMatch) && !condAMatch && !condBMatch;

  if (condAMatch && !touristEntryRejected) {
    const quote = condAMatch[0].replace(/\s+/g, ' ').trim().slice(0, 240);
    return {
      opportunityId: params.opportunityId,
      environment: 'international',
      conditionMet: 'A_employer_work_visa',
      transparencyStatus: 'VISA SPONSORSHIP CONFIRMED',
      verified: true,
      visaSponsored: true,
      workPermitSponsored: Boolean(condBMatch),
      internationalApplicantsWelcome,
      visaFeesCovered: visaFeesCoveredRx.test(lower) ? 'yes' : applicantPaysVisaRx.test(lower) ? 'no' : 'not_confirmed',
      relocationSupport,
      relocationDetails,
      invitationLetterOnly: false,
      touristEntryRejected: false,
      sponsorshipStatement: quote,
      evidenceQuote: quote,
      evidenceSourceUrl,
      statusLabel: 'VISA SPONSORSHIP CONFIRMED',
      lastVerifiedAt: nowIso,
    };
  }

  if (condBMatch && !touristEntryRejected) {
    const quote = condBMatch[0].replace(/\s+/g, ' ').trim().slice(0, 240);
    return {
      opportunityId: params.opportunityId,
      environment: 'international',
      conditionMet: 'B_work_permit_immigration',
      transparencyStatus: 'VISA SPONSORSHIP CONFIRMED',
      verified: true,
      visaSponsored: false,
      workPermitSponsored: true,
      internationalApplicantsWelcome,
      visaFeesCovered: visaFeesCoveredRx.test(lower) ? 'yes' : applicantPaysVisaRx.test(lower) ? 'no' : 'not_confirmed',
      relocationSupport,
      relocationDetails,
      invitationLetterOnly: false,
      touristEntryRejected: false,
      sponsorshipStatement: `Work permit sponsorship confirmed (distinct from general relocation): ${quote}`,
      evidenceQuote: quote,
      evidenceSourceUrl,
      statusLabel: 'VISA SPONSORSHIP CONFIRMED',
      lastVerifiedAt: nowIso,
    };
  }

  if (hasConditionC) {
    return {
      opportunityId: params.opportunityId,
      environment: 'international',
      conditionMet: 'C_legal_right_no_sponsorship',
      transparencyStatus: 'VISA SPONSORSHIP NOT SPECIFIED',
      verified: true,
      visaSponsored: false,
      workPermitSponsored: false,
      internationalApplicantsWelcome,
      visaFeesCovered: 'not_confirmed',
      relocationSupport,
      relocationDetails,
      invitationLetterOnly: false,
      touristEntryRejected: false,
      sponsorshipStatement: `Visa sponsorship not specified by employer; applicant holds confirmed legal work right in ${params.country}.`,
      evidenceQuote: 'No explicit visa sponsorship statement on employer listing.',
      evidenceSourceUrl,
      statusLabel: 'VISA SPONSORSHIP NOT SPECIFIED',
      lastVerifiedAt: nowIso,
    };
  }

  // Distinguish REQUIRES CONFIRMATION (ambiguous, conditional, historical sponsorship, relocation-only, or "international applicants welcome")
  // vs NOT SPECIFIED (listing is completely silent on visa sponsorship)
  if (pastOrConditionalOnly || internationalApplicantsWelcome || relocMatch || touristEntryRejected) {
    const snippet =
      requiresConfirmationMatch?.[0] ||
      internationalWelcomeMatch?.[0] ||
      relocMatch?.[0] ||
      (touristEntryRejected
        ? 'Tourist visa-free entry is NOT legal work authorization.'
        : 'Visa sponsorship terms require direct employer confirmation.');

    return {
      opportunityId: params.opportunityId,
      environment: 'international',
      conditionMet: 'none',
      transparencyStatus: 'VISA SPONSORSHIP REQUIRES CONFIRMATION',
      verified: false,
      visaSponsored: false,
      workPermitSponsored: false,
      internationalApplicantsWelcome,
      visaFeesCovered: 'not_confirmed',
      relocationSupport,
      relocationDetails,
      invitationLetterOnly: invitationOnlyRx.test(lower),
      touristEntryRejected,
      sponsorshipStatement: touristEntryRejected
        ? 'Tourist visa-free entry is NOT legal work authorization — employer visa sponsorship requires confirmation.'
        : internationalApplicantsWelcome && !requiresConfirmationMatch
        ? 'Listing states "international applicants welcome" without confirming work visa sponsorship — confirm directly with employer.'
        : relocMatch && !requiresConfirmationMatch
        ? 'Relocation assistance mentioned without explicit work visa sponsorship confirmation — confirm directly with employer.'
        : 'Employer visa sponsorship for this specific role requires direct confirmation (never assumed from general or past sponsorship).',
      evidenceQuote: snippet.replace(/\s+/g, ' ').trim().slice(0, 220),
      evidenceSourceUrl,
      statusLabel: 'VISA SPONSORSHIP REQUIRES CONFIRMATION',
      lastVerifiedAt: nowIso,
    };
  }

  return {
    opportunityId: params.opportunityId,
    environment: 'international',
    conditionMet: 'none',
    transparencyStatus: 'VISA SPONSORSHIP NOT SPECIFIED',
    verified: false,
    visaSponsored: false,
    workPermitSponsored: false,
    internationalApplicantsWelcome: false,
    visaFeesCovered: 'not_confirmed',
    relocationSupport,
    relocationDetails,
    invitationLetterOnly: invitationOnlyRx.test(lower),
    touristEntryRejected: false,
    sponsorshipStatement: 'Official listing does not specify whether employer work visa sponsorship is provided.',
    evidenceQuote: 'No visa sponsorship statement published on the official job announcement.',
    evidenceSourceUrl,
    statusLabel: 'VISA SPONSORSHIP NOT SPECIFIED',
    lastVerifiedAt: nowIso,
  };
}

function extractResponsibilitiesList(responsibilities: string[] | undefined, description: string): string[] {
  if (Array.isArray(responsibilities) && responsibilities.filter((r) => r.trim().length >= 12).length > 0) {
    return responsibilities.map((r) => r.trim()).filter(Boolean).slice(0, 6);
  }
  const sentences = String(description || '')
    .split(/[\n•▪▸]+|(?<=\.)\s+/)
    .map((s) => s.replace(/^[\s\-–*0-9.)]+/, '').trim())
    .filter((s) => s.length >= 24 && s.length <= 220);
  const actionLines = sentences.filter((s) =>
    /^(lead|manage|oversee|supervise|drive|ensure|develop|prepare|monitor|coordinate|review|build|deliver|maintain|support|own|design|execute|implement|control|analyze|report|establish|direct|grow)/i.test(
      s
    )
  );
  if (actionLines.length >= 2) return actionLines.slice(0, 5);
  return sentences.slice(0, 4);
}

/**
 * Evaluates whether a job strictly satisfies the Jobs for Branch Banking Special Feature (Section 2).
 * Reference profile: 9 yrs branch banking, 3 yrs managerial/above-managerial.
 * NO USD 3,000 minimum salary threshold! For international roles, explicit VISA SPONSORSHIP CONFIRMED is required.
 */
export function evaluateForBranchBankingSpecialFeature(params: {
  title: string;
  employer: string;
  description: string;
  responsibilities: string[];
  sector: ProfessionalSector;
  seniorityLevel: CareerSeniorityLevel;
  exp: ReturnType<typeof extractExperienceRequirements>;
  salary: SalaryNormalizationRecord;
  visa: VisaAuthorizationRecord;
  environment: OpportunityEnvironment;
  deadlinePassed: boolean;
  deadlineExplanation: string;
  profile?: UserProfessionalProfileInput;
}): {
  matched: boolean;
  relevanceScore: number;
  matchReasons: string[];
  rejectionCodes: RejectionReasonCode[];
  rejectionReasons: string[];
} {
  const ref = params.profile || BRANCH_BANKING_REFERENCE_PROFILE;
  const bankingYears = ref.bankingExperienceYears ?? ref.yearsOfExperience ?? 9;
  const mgmtYears = ref.managerialExperienceYears ?? 3;

  const matchReasons: string[] = [];
  const rejectionCodes: RejectionReasonCode[] = [];
  const rejectionReasons: string[] = [];

  const title = String(params.title || '').trim();
  const full = `${title}\n${params.employer}\n${params.description}\n${params.responsibilities.join('\n')}`;

  if (!params.deadlinePassed) {
    rejectionCodes.push('deadline_expired');
    rejectionReasons.push(params.deadlineExplanation);
  }

  // 1. Strict Sector & Non-Banking Disqualification (never match just because "Manager" appears!)
  if (NON_BANKING_MANAGER_DISQUALIFIER_RX.test(title) || params.sector === 'wash') {
    rejectionCodes.push('industry_mismatch');
    rejectionReasons.push(
      `Position "${title}" is outside branch banking / banking management (detected sector: ${params.sector}).`
    );
  }

  // 2. Strict Seniority Check — Reject Executive / VP & Reject Junior / Teller / CSR!
  if (
    params.seniorityLevel === 'executive' ||
    EXECUTIVE_OVER_SENIOR_TITLE_RX.test(title) ||
    (params.exp.requiredTotalYears !== null && params.exp.requiredTotalYears >= bankingYears + 4) ||
    (params.exp.requiredBankingYears !== null && params.exp.requiredBankingYears >= bankingYears + 4)
  ) {
    rejectionCodes.push('seniority_mismatch_too_senior');
    rejectionReasons.push(
      `Unsuitable seniority match: "${title}" is an Executive/VP-level role (${
        params.exp.requiredTotalYears ? `${params.exp.requiredTotalYears}+ years required` : SENIORITY_LABELS[params.seniorityLevel]
      }) that substantially exceeds the ${bankingYears}-year banking / ${mgmtYears}-year branch management reference profile.`
    );
  }

  if (
    JUNIOR_ENTRY_NON_MANAGERIAL_TITLE_RX.test(title) ||
    params.seniorityLevel === 'entry_level' ||
    params.seniorityLevel === 'junior_professional'
  ) {
    rejectionCodes.push('seniority_mismatch_too_junior');
    rejectionReasons.push(
      `Unsuitable professional and seniority match: "${title}" is a non-managerial / entry-to-junior role (${SENIORITY_LABELS[params.seniorityLevel]}), unsuitable for a Branch Manager with ${bankingYears} years banking and ${mgmtYears} years managerial experience.`
    );
  }

  // 3. Branch Banking Responsibility & Title Suitability
  const matchedTitleDef = PRIORITY_BRANCH_BANKING_TITLES.find((p) => p.rx.test(title));
  const matchedRespSignals = BRANCH_BANKING_RESPONSIBILITY_SIGNALS.filter((s) => s.rx.test(full)).map((s) => s.label);
  const isBankingSector = params.sector === 'branch_banking' || params.sector === 'banking_finance';

  if (!isBankingSector) {
    if (!rejectionCodes.includes('industry_mismatch')) {
      rejectionCodes.push('industry_mismatch');
      rejectionReasons.push(`Role sector (${params.sector}) does not align with Branch Banking / Banking Management.`);
    }
  } else if (!matchedTitleDef && matchedRespSignals.length < 2) {
    rejectionCodes.push('experience_mismatch');
    rejectionReasons.push(
      `Actual responsibilities do not sufficiently demonstrate branch banking operations, administration, or banking leadership authority.`
    );
  }

  // Managerial experience ceiling check
  if (params.exp.requiredManagerialYears !== null && params.exp.requiredManagerialYears > mgmtYears + 4) {
    rejectionCodes.push('experience_mismatch');
    rejectionReasons.push(
      `Requires ${params.exp.requiredManagerialYears}+ years of managerial experience, exceeding the reference profile (${mgmtYears} years managerial experience).`
    );
  }

  // 4. NO USD 3,000 SALARY FILTER ANYWHERE (Section 1 & 2) — Display salary transparently; never reject based on compensation!

  // 5. International Branch Banking Visa Sponsorship Gate (Section 2 & 3):
  // For international roles in the dedicated Branch Banking section, explicit VISA SPONSORSHIP CONFIRMED is required.
  if (
    params.environment === 'international' &&
    params.visa.transparencyStatus !== 'VISA SPONSORSHIP CONFIRMED'
  ) {
    rejectionCodes.push('visa_sponsorship_unconfirmed');
    rejectionReasons.push(params.visa.sponsorshipStatement);
  }

  if (rejectionCodes.length > 0) {
    return {
      matched: false,
      relevanceScore: 0,
      matchReasons: [],
      rejectionCodes: Array.from(new Set(rejectionCodes)),
      rejectionReasons: Array.from(new Set(rejectionReasons)),
    };
  }

  // Compute transparent relevance score based on actual professional suitability
  let score = 60;
  if (matchedTitleDef) {
    score += 16;
    matchReasons.push(`Direct branch banking leadership match: ${matchedTitleDef.label}.`);
  } else {
    score += 10;
    matchReasons.push('Equivalent banking management responsibilities verified from job description.');
  }

  if (matchedRespSignals.length > 0) {
    score += Math.min(12, matchedRespSignals.length * 3);
    matchReasons.push(`Core managerial responsibilities aligned: ${matchedRespSignals.slice(0, 3).join('; ')}.`);
  }

  if (params.exp.requiredBankingYears !== null && bankingYears >= params.exp.requiredBankingYears) {
    score += 6;
    matchReasons.push(
      `${bankingYears} years banking experience satisfies the stated ${params.exp.requiredBankingYears}+ years requirement.`
    );
  } else {
    matchReasons.push(`Matches ${bankingYears}-year branch banking & ${mgmtYears}-year managerial experience profile.`);
    score += 4;
  }

  if (params.environment === 'international') {
    score += 5;
    matchReasons.push(`Confirmed employer visa sponsorship: ${params.visa.transparencyStatus}.`);
  } else {
    matchReasons.push('Ethiopian domestic branch banking opportunity — Visa sponsorship not applicable.');
  }

  return {
    matched: true,
    relevanceScore: Math.min(99, Math.max(60, score)),
    matchReasons,
    rejectionCodes: [],
    rejectionReasons: [],
  };
}

/**
 * Evaluates a raw opportunity candidate into a verified CanonicalOpportunityRecord
 * enforcing global publication rules (3-day deadline, visa/work authorization,
 * Banking/WASH restriction for scholarships/training/conferences, and Branch Banking analysis).
 */
export function buildAndVerifyCanonicalOpportunity(
  raw: RawOpportunityCandidateInput,
  options?: {
    fxRatesUsdBase?: Record<string, number>;
    nowMs?: number;
  }
): CanonicalOpportunityRecord {
  const nowMs = options?.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const fxRates = options?.fxRatesUsdBase || DEFAULT_FX_RATES_USD_BASE;

  const { canonicalKey, urlFingerprint, canonicalId } = buildCanonicalOpportunityIdentity({
    category: raw.category,
    title: raw.title,
    employer: raw.employer,
    country: raw.country,
    officialApplicationUrl: raw.officialApplicationUrl,
  });

  const environment = detectEnvironment(raw.country, raw.city || '', raw.description);
  const fullText = `${raw.title}\n${raw.employer}\n${raw.compensationRaw || ''}\n${raw.explicitVisaNote || ''}\n${raw.explicitFundingNote || ''}\n${raw.description}`;
  const sectors = detectProfessionalSectors(raw.title, raw.employer, raw.description);
  const exp = extractExperienceRequirements(fullText);
  const seniorityLevel = classifyRoleSeniority(raw.title, raw.description, exp);
  const actualResponsibilities = extractResponsibilitiesList(raw.responsibilities, raw.description);
  const workMode = detectWorkMode(`${raw.title} ${raw.city || ''} ${raw.description}`);

  const salary = normalizeSalaryRecord(canonicalId, `${raw.compensationRaw || ''}\n${raw.description}`, fxRates);
  const visa = evaluateVisaAndAuthorization({
    opportunityId: canonicalId,
    category: raw.category,
    environment,
    country: raw.country,
    text: fullText,
    sourceUrl: raw.officialApplicationUrl || raw.sourceUrl || undefined,
    visaSponsorshipRevoked: raw.visaSponsorshipRevoked,
  });
  const deadlineEval = evaluateStrictThreeDayDeadline(
    raw.deadlineRaw,
    nowMs,
    Boolean(raw.isClosedOrWithdrawn),
    raw.openingDateRaw
  );
  const applicationLinkVerification = evaluateDirectApplicationLink({
    url: raw.officialApplicationUrl,
    title: raw.title,
    employer: raw.employer,
    category: raw.category,
    checkedAtIso: nowIso,
    linkCheckOverride: raw.linkCheckOverride,
  });

  const rejectionCodes: RejectionReasonCode[] = [];
  const rejectionExplanations: string[] = [];

  // 1. Strict Direct Application Link Verification (Section 5)
  if (applicationLinkVerification.status !== 'VERIFIED') {
    rejectionCodes.push('invalid_official_url');
    rejectionExplanations.push(`NOT VERIFIED: ${applicationLinkVerification.note}`);
  }

  // 2. Strict Deadline & Closed Vacancy Verification (Section 4)
  // Never display DEADLINE PASSED or APPLICATIONS CLOSED opportunities as open!
  if (!deadlineEval.passed && deadlineEval.rejectionCode) {
    rejectionCodes.push(deadlineEval.rejectionCode);
    rejectionExplanations.push(deadlineEval.explanation);
  }

  // 3. Section 3 Visa Sponsorship Transparency Rule:
  // - For OTHER international jobs, scholarships, conferences, training:
  //   Show ALL sponsorship statuses transparently (VISA SPONSORSHIP CONFIRMED / NOT OFFERED / NOT SPECIFIED / REQUIRES CONFIRMATION)
  //   so the user decides! Never hide or reject general opportunities solely for salary or unstated sponsorship.
  // - For the dedicated Branch Banking international section (`isBranchBankingMatch`), confirmed sponsorship is strictly enforced below.

  // Evaluate special Branch Banking feature suitability (Section 2: NO $3,000 salary gate; requires confirmed visa sponsorship for international)
  const branchEval =
    raw.category === 'job'
      ? evaluateForBranchBankingSpecialFeature({
          title: raw.title,
          employer: raw.employer,
          description: raw.description,
          responsibilities: actualResponsibilities,
          sector: sectors.primary,
          seniorityLevel,
          exp,
          salary,
          visa,
          environment,
          deadlinePassed: deadlineEval.passed && applicationLinkVerification.status === 'VERIFIED',
          deadlineExplanation:
            applicationLinkVerification.status !== 'VERIFIED'
              ? applicationLinkVerification.note
              : deadlineEval.explanation,
        })
      : {
          matched: false,
          relevanceScore: 0,
          matchReasons: [],
          rejectionCodes: [] as RejectionReasonCode[],
          rejectionReasons: [] as string[],
        };

  const lowerFull = fullText.toLowerCase();
  // Section 8 accurate funding classification — NEVER describe a partially funded opportunity as fully funded!
  const detectAccurateFundingCoverage = (): string => {
    const partialRx =
      /\b(partial(?:ly)?\s+funded|\d{1,2}%\s+(?:tuition|fee|scholarship|grant)|tuition\s+(?:fee\s+)?waiver|partial\s+tuition|partial\s+scholarship|partial\s+grant)\b/i;
    if (raw.explicitFundingNote && raw.explicitFundingNote.trim()) {
      const explicit = raw.explicitFundingNote.trim();
      if (partialRx.test(explicit)) return `Partially Funded (${explicit})`;
      if (/\bself[- ]funded\b/i.test(explicit)) return 'Self-Funded';
      return explicit;
    }
    if (partialRx.test(lowerFull)) {
      return 'Partially Funded';
    }
    if (/\b(self[- ]funded|fee[- ]paying|registration\s+fee\s+required)\b/i.test(lowerFull)) {
      return 'Self-Funded';
    }
    if (/\b(fully\s+funded|full\s+scholarship|all\s+expenses\s+paid|full\s+tuition\s+and\s+(?:living\s+)?stipend)\b/i.test(lowerFull)) {
      return 'Fully Funded (verified in official text)';
    }
    return raw.category === 'job' ? salary.salaryDisplay : 'Funding not specified — verify on official portal';
  };

  const eligibility: OpportunityEligibilityRecord = {
    opportunityId: canonicalId,
    category: raw.category,
    sector: sectors.primary,
    secondarySectors: sectors.secondary,
    seniorityLevel,
    requiredBankingYears: exp.requiredBankingYears,
    requiredManagerialYears: exp.requiredManagerialYears,
    requiredTotalYears: exp.requiredTotalYears,
    educationRequirement:
      fullText.match(/[^.\n]{0,40}\b(phd|doctorate|master['’]?s|mba|bachelor['’]?s|university\s+degree|diploma)\b[^.\n]{0,70}/i)?.[0]
        ?.replace(/\s+/g, ' ')
        .trim() || 'Verify education requirements on official portal',
    individualApplicationAllowed: /\b(nominated\s+only|institutional\s+nomination\s+required|no\s+direct\s+individual\s+applications)\b/i.test(
      lowerFull
    )
      ? 'no'
      : /\b(apply\s+online|individual\s+applications?\s+(?:welcome|accepted)|apply\s+directly)\b/i.test(lowerFull)
      ? 'yes'
      : 'not_confirmed',
    universityRecommendationRequired: /\b(university\s+(?:recommendation|nomination|endorsement))\b/i.test(lowerFull)
      ? 'yes'
      : 'not_confirmed',
    companyRecommendationRequired: /\b((?:employer|company|organization)\s+(?:recommendation|nomination|endorsement))\b/i.test(
      lowerFull
    )
      ? 'yes'
      : 'not_confirmed',
    fundingCoverage: detectAccurateFundingCoverage(),
    visaCostsCoverageNote:
      visa.visaFeesCovered === 'yes'
        ? 'Visa application fees confirmed covered'
        : visa.visaFeesCovered === 'no'
        ? 'Visa costs are applicant responsibility'
        : visa.sponsorshipStatement,
    nationalityEligibility:
      environment === 'ethiopia_domestic'
        ? 'Ethiopian domestic applicants'
        : /\b(ethiopia|african\s+nationals|developing\s+countries|all\s+nationalities|international\s+applicants)\b/i.test(
            lowerFull
          )
        ? 'Open to Ethiopian & international applicants'
        : 'Verify Ethiopian applicant eligibility on official portal',
    verifiedAt: nowIso,
  };

  const isExpired = rejectionCodes.includes('deadline_expired') || rejectionCodes.includes('closed_or_withdrawn');
  const status = rejectionCodes.length === 0 ? 'published' : isExpired ? 'expired' : 'rejected';

  const verificationBadge =
    status === 'published'
      ? environment === 'international'
        ? `VERIFIED · ${visa.transparencyStatus}`
        : 'VERIFIED · Ethiopian Domestic Opportunity'
      : status === 'expired'
      ? deadlineEval.deadlineStatusLabel
      : 'NOT VERIFIED';

  const referenceNumber =
    (raw.referenceNumber && String(raw.referenceNumber).trim().toUpperCase()) ||
    extractOpportunityReferenceNumber(`${raw.title}\n${raw.description}\n${raw.officialApplicationUrl}`);
  const primarySourceUrl = String(raw.sourceUrl || raw.officialApplicationUrl).trim();
  const primarySourceName = String(raw.sourceName || raw.employer).trim();

  return {
    id: canonicalId,
    canonicalKey,
    urlFingerprint,
    referenceNumber,
    updateVersion: 1,
    category: raw.category,
    environment,
    title: raw.title.trim(),
    employer: raw.employer.trim(),
    country: raw.country.trim() || (environment === 'ethiopia_domestic' ? 'Ethiopia' : 'International'),
    city: (raw.city || '').trim(),
    region: (raw.region || (environment === 'ethiopia_domestic' ? 'Ethiopia' : 'International')).trim(),
    workMode,
    sector: sectors.primary,
    secondarySectors: sectors.secondary,
    seniorityLevel,
    actualResponsibilities,
    descriptionSummary: String(raw.description || '').replace(/\s+/g, ' ').trim().slice(0, 420),
    publishedDate: raw.publishedDate || null,
    officialApplicationUrl: raw.officialApplicationUrl.trim(),
    applicationLinkVerification,
    primarySourceUrl,
    primarySourceName,
    sourceUrls: Array.from(new Set([primarySourceUrl].filter(Boolean))),
    sourceNames: Array.from(new Set([primarySourceName].filter(Boolean))),
    deadlineRaw: String(raw.deadlineRaw || 'Deadline not published').trim(),
    deadlineDateExact: deadlineEval.deadlineDateExact,
    deadlineTime: deadlineEval.deadlineTime,
    deadlineTimezone: deadlineEval.deadlineTimezone,
    deadlineIso: deadlineEval.deadlineIso,
    deadlineStatusLabel: deadlineEval.deadlineStatusLabel,
    deadlineLastVerifiedAt: nowIso,
    deadlineEvidence: deadlineEval.deadlineEvidence,
    fullDaysRemaining: deadlineEval.fullDaysRemaining,
    salary,
    visa,
    eligibility,
    status,
    verificationBadge,
    rejectionCodes: Array.from(new Set(rejectionCodes)),
    rejectionExplanations: Array.from(new Set(rejectionExplanations)),
    isBranchBankingMatch: branchEval.matched,
    branchBankingRelevanceScore: branchEval.relevanceScore,
    branchBankingMatchReasons: branchEval.matchReasons,
    branchBankingRejectionReasons: branchEval.rejectionReasons,
    discoveredAt: nowIso,
    lastVerifiedAt: nowIso,
    updatedAt: nowIso,
    unpublishedAt: null,
    unpublishedReason: null,
  };
}

/**
 * Strict Industry Compatibility Matrix (Section 3):
 * Prevents cross-domain leakage (e.g., Banking users never get WASH jobs; WASH users never get Banking jobs).
 */
export function areSectorsCompatible(
  userSector: ProfessionalSector,
  oppPrimary: ProfessionalSector,
  oppSecondary: ProfessionalSector[]
): boolean {
  if (userSector === oppPrimary) return true;
  if (userSector === 'branch_banking') {
    return oppPrimary === 'banking_finance' || oppPrimary === 'branch_banking';
  }
  if (userSector === 'banking_finance') {
    return oppPrimary === 'branch_banking' || oppPrimary === 'banking_finance';
  }
  if (userSector === 'wash') {
    return oppPrimary === 'wash' || oppSecondary.includes('wash');
  }
  if (userSector === 'engineering') {
    return oppPrimary === 'engineering' || (oppPrimary === 'wash' && oppSecondary.includes('engineering'));
  }
  if (userSector === 'healthcare') {
    return oppPrimary === 'healthcare';
  }
  if (userSector === 'education') {
    return oppPrimary === 'education';
  }
  if (userSector === 'it_software') {
    return oppPrimary === 'it_software';
  }
  if (userSector === 'legal_compliance') {
    return oppPrimary === 'legal_compliance';
  }
  return oppSecondary.includes(userSector);
}

/**
 * Universal Strict Personalized Recommendation Engine for ALL Registered Users (Sections 3, 4, 5, 6).
 */
export function evaluateOpportunityForUserProfile(
  opportunity: CanonicalOpportunityRecord,
  profile: UserProfessionalProfileInput
): UserOpportunityMatchRecord {
  const nowIso = new Date().toISOString();
  const matchReasons: string[] = [];
  const rejectionCodes: RejectionReasonCode[] = [];
  const rejectionExplanations: string[] = [];

  // 0. Opportunity itself must be published (except Condition C re-evaluation when user holds legal work right)
  const hasLegalWorkRight =
    opportunity.environment === 'international' &&
    opportunity.category === 'job' &&
    (profile.countriesWithLegalWorkRight || []).some(
      (c) => c.toLowerCase().trim() === opportunity.country.toLowerCase().trim()
    );

  if (opportunity.status !== 'published') {
    const onlyFailedVisa =
      opportunity.rejectionCodes.length === 1 && opportunity.rejectionCodes[0] === 'visa_sponsorship_unconfirmed';
    if (!(onlyFailedVisa && hasLegalWorkRight)) {
      return {
        id: `match_${profile.userId}_${opportunity.id}`,
        userId: profile.userId,
        opportunityId: opportunity.id,
        environment: opportunity.environment,
        category: opportunity.category,
        eligible: false,
        relevanceScore: 0,
        matchReasons: [],
        rejectionCodes: [...opportunity.rejectionCodes],
        rejectionExplanations: [...opportunity.rejectionExplanations],
        evaluatedAt: nowIso,
      };
    }
  }

  // 1. Environment preference check
  if (
    profile.preferredEnvironment !== 'both' &&
    profile.preferredEnvironment !== opportunity.environment
  ) {
    rejectionCodes.push('industry_mismatch');
    rejectionExplanations.push(
      `Opportunity environment (${opportunity.environment}) does not match user preference (${profile.preferredEnvironment}).`
    );
  }

  // 2. Strict Industry Isolation (Section 3)
  if (!areSectorsCompatible(profile.professionalSector, opportunity.sector, opportunity.secondarySectors)) {
    rejectionCodes.push('industry_mismatch');
    rejectionExplanations.push(
      `Industry mismatch: Opportunity sector (${opportunity.sector}) does not match user sector (${profile.professionalSector}).`
    );
  }

  // 3. Strict 10-Tier Seniority Matching (Jobs only — scholarships/conferences/training evaluate professional relevance & eligibility)
  if (opportunity.category === 'job') {
    const userRank = SENIORITY_RANK[profile.careerLevel] || 4;
    const oppRank = SENIORITY_RANK[opportunity.seniorityLevel] || 4;

    // Reject executive/substantially more senior roles
    if (oppRank > userRank + 1 || (opportunity.seniorityLevel === 'executive' && profile.careerLevel !== 'executive' && profile.careerLevel !== 'director')) {
      rejectionCodes.push('seniority_mismatch_too_senior');
      rejectionExplanations.push(
        `Seniority mismatch: "${opportunity.title}" (${SENIORITY_LABELS[opportunity.seniorityLevel]}) substantially exceeds user career level (${SENIORITY_LABELS[profile.careerLevel]}).`
      );
    }

    // Reject entry/junior roles for senior/managerial professionals unless explicitly requested
    const isUserSeniorOrManager = userRank >= SENIORITY_RANK.senior_professional;
    const isOppJuniorOrEntry = oppRank <= SENIORITY_RANK.junior_professional;
    if (isUserSeniorOrManager && isOppJuniorOrEntry && !profile.allowJuniorRoles) {
      rejectionCodes.push('seniority_mismatch_too_junior');
      rejectionExplanations.push(
        `Seniority mismatch: "${opportunity.title}" (${SENIORITY_LABELS[opportunity.seniorityLevel]}) is below user's ${SENIORITY_LABELS[profile.careerLevel]} level.`
      );
    } else if (userRank >= SENIORITY_RANK.manager && oppRank < SENIORITY_RANK.supervisor && !profile.allowJuniorRoles) {
      rejectionCodes.push('seniority_mismatch_too_junior');
      rejectionExplanations.push(
        `Seniority mismatch: Managerial user (${SENIORITY_LABELS[profile.careerLevel]}) should not receive non-supervisory/individual-contributor junior roles (${SENIORITY_LABELS[opportunity.seniorityLevel]}).`
      );
    }

    // 4. Required Experience Years Matching
    const reqYears = opportunity.eligibility.requiredTotalYears ?? opportunity.eligibility.requiredBankingYears;
    if (reqYears !== null && reqYears > profile.yearsOfExperience + 3) {
      rejectionCodes.push('experience_mismatch');
      rejectionExplanations.push(
        `Experience mismatch: Role requires ${reqYears}+ years while user profile has ${profile.yearsOfExperience} years.`
      );
    }
    const reqMgmt = opportunity.eligibility.requiredManagerialYears;
    if (reqMgmt !== null && reqMgmt > profile.managerialExperienceYears + 3) {
      rejectionCodes.push('experience_mismatch');
      rejectionExplanations.push(
        `Managerial experience mismatch: Role requires ${reqMgmt}+ managerial years while user profile has ${profile.managerialExperienceYears} years.`
      );
    }

    // 5. Branch Banking Reference Profile (Section 2: NO $3,000 salary filter; confirmed sponsorship required for international!)
    if (profile.professionalSector === 'branch_banking') {
      const branchCheck = evaluateForBranchBankingSpecialFeature({
        title: opportunity.title,
        employer: opportunity.employer,
        description: opportunity.descriptionSummary,
        responsibilities: opportunity.actualResponsibilities,
        sector: opportunity.sector,
        seniorityLevel: opportunity.seniorityLevel,
        exp: {
          requiredTotalYears: opportunity.eligibility.requiredTotalYears,
          requiredBankingYears: opportunity.eligibility.requiredBankingYears,
          requiredManagerialYears: opportunity.eligibility.requiredManagerialYears,
          bankingExperienceSummary: '',
          managerialExperienceSummary: '',
        },
        salary: opportunity.salary,
        visa: hasLegalWorkRight
          ? {
              ...opportunity.visa,
              verified: true,
              transparencyStatus: 'VISA SPONSORSHIP CONFIRMED',
              conditionMet: 'C_legal_right_no_sponsorship',
            }
          : opportunity.visa,
        environment: opportunity.environment,
        deadlinePassed: true,
        deadlineExplanation: '',
        profile,
      });
      if (!branchCheck.matched) {
        for (const c of branchCheck.rejectionCodes) rejectionCodes.push(c);
        for (const r of branchCheck.rejectionReasons) rejectionExplanations.push(r);
      }
    }
    // Note (Section 1): Never automatically reject ANY job for salary below $3,000 or undisclosed salary!
  }

  if (rejectionCodes.length > 0) {
    return {
      id: `match_${profile.userId}_${opportunity.id}`,
      userId: profile.userId,
      opportunityId: opportunity.id,
      environment: opportunity.environment,
      category: opportunity.category,
      eligible: false,
      relevanceScore: 0,
      matchReasons: [],
      rejectionCodes: Array.from(new Set(rejectionCodes)),
      rejectionExplanations: Array.from(new Set(rejectionExplanations)),
      evaluatedAt: nowIso,
    };
  }

  // Score verified eligible match
  let score = 62;
  matchReasons.push(`Direct sector match (${opportunity.sector}) aligned with ${profile.currentOccupation || profile.professionalSector}.`);
  score += 12;

  if (opportunity.category === 'job') {
    matchReasons.push(`Seniority fit: ${SENIORITY_LABELS[opportunity.seniorityLevel]} matches your ${SENIORITY_LABELS[profile.careerLevel]} career level.`);
    score += 10;
  } else {
    matchReasons.push(`Verified ${opportunity.category} opportunity with confirmed visa/funding transparency.`);
    score += 10;
  }

  // Skill overlap boost
  const oppLower = `${opportunity.title} ${opportunity.descriptionSummary} ${opportunity.actualResponsibilities.join(' ')}`.toLowerCase();
  const matchedSkills = (profile.skills || []).filter((sk) => {
    const tokens = sk.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
    return tokens.some((t) => oppLower.includes(t));
  });
  if (matchedSkills.length > 0) {
    matchReasons.push(`Matched skills: ${matchedSkills.slice(0, 4).join(', ')}.`);
    score += Math.min(10, matchedSkills.length * 3);
  }

  if (opportunity.environment === 'international') {
    matchReasons.push(
      hasLegalWorkRight
        ? `Condition C: Confirmed legal right to work in ${opportunity.country}.`
        : opportunity.visa.statusLabel
    );
    score += 4;
  } else {
    matchReasons.push('Ethiopian domestic opportunity matched under local career rules.');
    score += 4;
  }

  return {
    id: `match_${profile.userId}_${opportunity.id}`,
    userId: profile.userId,
    opportunityId: opportunity.id,
    environment: opportunity.environment,
    category: opportunity.category,
    eligible: true,
    relevanceScore: Math.min(99, score),
    matchReasons,
    rejectionCodes: [],
    rejectionExplanations: [],
    evaluatedAt: nowIso,
  };
}
