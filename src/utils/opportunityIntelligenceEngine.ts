import { JobSeekerProfile } from '../types/jobSeeker';
import {
  ApplicationLifecycleStatus,
  FundingTransparencyCategory,
  GlobalOpportunity,
  GlobalOpportunityCategory,
  GlobalVerificationStatus,
  OpportunityDeadlineRecord,
  OpportunityEligibilityRecord,
  OpportunityFundingRecord,
  RequirementBooleanStatus,
  SectorTag,
  UserOpportunityRecommendationRecord,
} from '../types/globalOpportunities';

export const MINIMUM_FULL_DAYS_REMAINING = 3;
export const MINIMUM_HOURS_REMAINING = MINIMUM_FULL_DAYS_REMAINING * 24; // 72 full hours
export const CLOSING_SOON_MAX_DAYS = 7;

export interface DeadlineEvaluationResult {
  valid: boolean;
  deadlineUtcIso: string | null;
  deadlineTimezone: string;
  fullDaysRemaining: number;
  hoursRemaining: number;
  meetsMinimumThreeFullDays: boolean;
  isClosingSoon: boolean;
  isExpired: boolean;
  rejectionReason: string | null;
}

const KNOWN_TIMEZONE_OFFSETS_MINUTES: Record<string, number> = {
  UTC: 0,
  GMT: 0,
  'Africa/Addis_Ababa': 180, // EAT UTC+3
  EAT: 180,
  'Africa/Nairobi': 180,
  'Europe/London': 0,
  'Europe/Geneva': 60,
  'Europe/Berlin': 60,
  'Europe/Paris': 60,
  CET: 60,
  CEST: 120,
  'America/New_York': -300,
  EST: -300,
  EDT: -240,
  'America/Chicago': -360,
  'America/Los_Angeles': -480,
  PST: -480,
  PDT: -420,
  'Asia/Dubai': 240,
  'Asia/Tokyo': 540,
  'Asia/Singapore': 480,
};

function getTimezoneOffsetMinutes(tz: string, referenceDate: Date): number {
  const trimmed = (tz || 'UTC').trim();
  if (trimmed in KNOWN_TIMEZONE_OFFSETS_MINUTES) {
    return KNOWN_TIMEZONE_OFFSETS_MINUTES[trimmed];
  }
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: trimmed,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(referenceDate);
    const map: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        map[part.type] = Number(part.value);
      }
    }
    const asUtc = Date.UTC(
      map.year,
      (map.month || 1) - 1,
      map.day || 1,
      map.hour === 24 ? 0 : map.hour || 0,
      map.minute || 0,
      map.second || 0
    );
    return Math.round((asUtc - referenceDate.getTime()) / 60000);
  } catch {
    return 0;
  }
}

/**
 * Parses an official deadline string with strict timezone awareness.
 * Date-only strings (e.g. "2026-12-31") are interpreted as 23:59:59 in the target timezone.
 * Never invents a deadline if missing, "rolling", "ongoing", or unparseable.
 */
export function parseDeadlineWithTimezone(
  rawDeadline: string | null | undefined,
  timezone: string = 'UTC'
): { utcDate: Date | null; resolvedTimezone: string } {
  const cleaned = String(rawDeadline || '').trim();
  if (!cleaned) return { utcDate: null, resolvedTimezone: timezone || 'UTC' };

  const lower = cleaned.toLowerCase();
  if (
    lower === 'not confirmed' ||
    lower === 'not specified' ||
    lower === 'rolling' ||
    lower === 'ongoing' ||
    lower === 'open until filled' ||
    lower === 'tbd' ||
    lower === 'n/a'
  ) {
    return { utcDate: null, resolvedTimezone: timezone || 'UTC' };
  }

  const tz = (timezone || 'UTC').trim() || 'UTC';

  // Case 1: Full ISO timestamp with explicit offset or Z
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(cleaned)) {
    const parsed = new Date(cleaned);
    if (!Number.isNaN(parsed.getTime())) {
      return { utcDate: parsed, resolvedTimezone: tz };
    }
  }

  // Case 2: Date-only YYYY-MM-DD -> 23:59:59 in the specified timezone
  const ymdMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const approxUtc = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
      const offsetMins = getTimezoneOffsetMinutes(tz, approxUtc);
      const exactUtcMs = Date.UTC(year, month - 1, day, 23, 59, 59) - offsetMins * 60 * 1000;
      return { utcDate: new Date(exactUtcMs), resolvedTimezone: tz };
    }
  }

  // Case 3: Local date-time without offset YYYY-MM-DD[T ]HH:mm(:ss)?
  const ymdTimeMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (ymdTimeMatch) {
    const year = Number(ymdTimeMatch[1]);
    const month = Number(ymdTimeMatch[2]);
    const day = Number(ymdTimeMatch[3]);
    const hour = Number(ymdTimeMatch[4]);
    const minute = Number(ymdTimeMatch[5]);
    const second = Number(ymdTimeMatch[6] || '0');
    const approxUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const offsetMins = getTimezoneOffsetMinutes(tz, approxUtc);
    const exactUtcMs = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMins * 60 * 1000;
    return { utcDate: new Date(exactUtcMs), resolvedTimezone: tz };
  }

  // Case 4: Natural date strings like "15 December 2026" or "Dec 15, 2026"
  const hasExplicitTime = /\d{1,2}:\d{2}/.test(cleaned);
  const parsedNatural = new Date(cleaned);
  if (!Number.isNaN(parsedNatural.getTime()) && parsedNatural.getUTCFullYear() >= 2020) {
    if (!hasExplicitTime) {
      const y = parsedNatural.getUTCFullYear();
      const m = parsedNatural.getUTCMonth();
      const d = parsedNatural.getUTCDate();
      const approxUtc = new Date(Date.UTC(y, m, d, 23, 59, 59));
      const offsetMins = getTimezoneOffsetMinutes(tz, approxUtc);
      const exactUtcMs = Date.UTC(y, m, d, 23, 59, 59) - offsetMins * 60 * 1000;
      return { utcDate: new Date(exactUtcMs), resolvedTimezone: tz };
    }
    return { utcDate: parsedNatural, resolvedTimezone: tz };
  }

  return { utcDate: null, resolvedTimezone: tz };
}

/**
 * Enforces the Mandatory 3-Full-Days (>= 72 hours) Deadline Rule.
 * Opportunities with < 3 full days remaining or missing/expired deadlines are strictly rejected.
 */
export function evaluateOpportunityDeadline(
  rawDeadline: string | null | undefined,
  timezone: string = 'UTC',
  nowMs: number = Date.now()
): DeadlineEvaluationResult {
  const { utcDate, resolvedTimezone } = parseDeadlineWithTimezone(rawDeadline, timezone);

  if (!utcDate) {
    return {
      valid: false,
      deadlineUtcIso: null,
      deadlineTimezone: resolvedTimezone,
      fullDaysRemaining: 0,
      hoursRemaining: 0,
      meetsMinimumThreeFullDays: false,
      isClosingSoon: false,
      isExpired: false,
      rejectionReason: 'Official deadline could not be verified or is missing.',
    };
  }

  const diffMs = utcDate.getTime() - nowMs;
  const hoursRemaining = diffMs / (1000 * 60 * 60);
  const fullDaysRemaining = Math.floor(hoursRemaining / 24);

  if (diffMs <= 0) {
    return {
      valid: true,
      deadlineUtcIso: utcDate.toISOString(),
      deadlineTimezone: resolvedTimezone,
      fullDaysRemaining: 0,
      hoursRemaining: Math.max(0, Math.round(hoursRemaining * 10) / 10),
      meetsMinimumThreeFullDays: false,
      isClosingSoon: false,
      isExpired: true,
      rejectionReason: 'Opportunity deadline has already passed (Expired).',
    };
  }

  const meetsMinimumThreeFullDays = hoursRemaining >= MINIMUM_HOURS_REMAINING;
  const isClosingSoon = meetsMinimumThreeFullDays && fullDaysRemaining <= CLOSING_SOON_MAX_DAYS;

  return {
    valid: true,
    deadlineUtcIso: utcDate.toISOString(),
    deadlineTimezone: resolvedTimezone,
    fullDaysRemaining,
    hoursRemaining: Math.round(hoursRemaining * 10) / 10,
    meetsMinimumThreeFullDays,
    isClosingSoon,
    isExpired: false,
    rejectionReason: meetsMinimumThreeFullDays
      ? null
      : `Less than ${MINIMUM_FULL_DAYS_REMAINING} full days remaining (${Math.floor(hoursRemaining)}h left). Excluded by mandatory 3-day rule.`,
  };
}

/**
 * Generates a stable deduplication fingerprint from title, organization, and canonical official URL.
 */
export function computeOpportunityFingerprint(
  title: string,
  organization: string,
  officialApplicationUrl: string
): string {
  const norm = (s: string) =>
    String(s || '')
      .toLowerCase()
      .replace(/https?:\/\/(www\.)?/g, '')
      .replace(/[?#].*$/, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const urlNorm = norm(officialApplicationUrl);
  const titleNorm = norm(title).slice(0, 80);
  const orgNorm = norm(organization).slice(0, 50);
  return `${orgNorm}|${titleNorm}|${urlNorm}`.slice(0, 220);
}

/**
 * Strictly classifies funding and visa support without ever confusing an invitation letter
 * with visa sponsorship or free visa coverage.
 */
export function classifyFundingAndVisaTransparency(input: {
  fundingSummary?: string;
  visaSummary?: string;
  fullText?: string;
  tuitionCovered?: OpportunityFundingRecord['tuitionCovered'];
  airfareCovered?: OpportunityFundingRecord['airfareCovered'];
  accommodationCovered?: OpportunityFundingRecord['accommodationCovered'];
  relocationAssistance?: OpportunityFundingRecord['relocationAssistance'];
  applicationFee?: string;
  stipendOrSalary?: string;
}): Omit<OpportunityFundingRecord, 'id' | 'opportunityId' | 'verifiedAt'> {
  const fundingText = `${input.fundingSummary || ''} ${input.fullText || ''}`.toLowerCase();
  const visaText = `${input.visaSummary || ''} ${input.fullText || ''}`.toLowerCase();

  const tags = new Set<FundingTransparencyCategory>();

  const explicitFullFunded =
    /\b(fully[\s-]funded|full[\s-]scholarship|100%\s*(funded|scholarship|covered)|all[\s-]expenses[\s-]paid|full[\s-]funding)\b/i.test(
      fundingText
    );
  const explicitSelfFunded =
    /\b(self[\s-]funded|participant[\s-]funded|no[\s-]funding|at\s+own\s+expense|registration\s+fee\s+required)\b/i.test(
      fundingText
    );

  const tuitionCovered: OpportunityFundingRecord['tuitionCovered'] =
    input.tuitionCovered ||
    (explicitFullFunded || /\b(full\s+tuition|tuition[\s-]free|tuition\s+waiver|tuition\s+covered)\b/i.test(fundingText)
      ? 'yes'
      : /\bpartial\s+tuition\b/i.test(fundingText)
      ? 'partial'
      : explicitSelfFunded
      ? 'no'
      : 'not_confirmed');

  const airfareCovered: OpportunityFundingRecord['airfareCovered'] =
    input.airfareCovered ||
    (/\b(round[\s-]trip\s+airfare|airfare\s+covered|flight\s+tickets?\s+covered|travel\s+grant|travel\s+allowance|return\s+flight|air\s+ticket)\b/i.test(
      fundingText
    )
      ? 'yes'
      : /\bpartial\s+travel\b/i.test(fundingText)
      ? 'partial'
      : /\b(no\s+travel|travel\s+not\s+covered|own\s+travel)\b/i.test(fundingText)
      ? 'no'
      : 'not_confirmed');

  const accommodationCovered: OpportunityFundingRecord['accommodationCovered'] =
    input.accommodationCovered ||
    (/\b(accommodation\s+covered|housing\s+provided|hotel\s+covered|lodging\s+provided|living\s+allowance|full\s+board|monthly\s+stipend)\b/i.test(
      fundingText
    )
      ? 'yes'
      : /\bpartial\s+accommodation\b/i.test(fundingText)
      ? 'partial'
      : /\b(accommodation\s+not\s+covered|own\s+accommodation)\b/i.test(fundingText)
      ? 'no'
      : 'not_confirmed');

  // Strict Visa Sponsor vs Invitation Letter distinction
  const hasEmployerSponsoredVisa =
    /\b(employer[\s-]sponsored\s+(?:work\s+)?visas?|work\s+visa\s+sponsorship|visa\s+sponsorship\s+(provided|available|offered)|work\s+permit\s+sponsorship|we\s+sponsor\s+work\s+visas?)\b/i.test(
      visaText
    ) && !/\b(no\s+visa\s+sponsorship|cannot\s+sponsor|does\s+not\s+sponsor|without\s+visa\s+sponsorship)\b/i.test(visaText);

  const hasVisaFeesFunded =
    /\b(visa\s+fees?\s+(covered|paid|reimbursed|funded)|reimbursement\s+of\s+visa\s+fees?)\b/i.test(visaText);

  const hasInvitationLetterOnly =
    /\b(invitation\s+letter|visa\s+support\s+letter|letter\s+of\s+invitation)\b/i.test(visaText) &&
    !hasEmployerSponsoredVisa &&
    !hasVisaFeesFunded;

  const hasVisaAssistanceOnly =
    (/\b(visa\s+assistance|visa\s+guidance|support\s+with\s+visa\s+application)\b/i.test(visaText) ||
      hasInvitationLetterOnly) &&
    !hasEmployerSponsoredVisa &&
    !hasVisaFeesFunded;

  const hasNoVisaSupport =
    /\b(no\s+visa\s+sponsorship|must\s+have\s+right\s+to\s+work|already\s+authorized\s+to\s+work|national\s+position\s+only)\b/i.test(
      visaText
    );

  let visaSupportType: OpportunityFundingRecord['visaSupportType'] = 'not_confirmed';
  let visaSupportSummary = 'Not Confirmed';

  if (hasEmployerSponsoredVisa) {
    visaSupportType = 'employer_sponsored_visa';
    visaSupportSummary = 'Employer-sponsored work visa / permit confirmed';
    tags.add('Employer-sponsored visa');
  } else if (hasVisaFeesFunded) {
    visaSupportType = 'visa_fees_funded';
    visaSupportSummary = 'Visa fee coverage confirmed (check official rules)';
    tags.add('Visa fees funded');
  } else if (hasInvitationLetterOnly) {
    visaSupportType = 'invitation_letter_only';
    visaSupportSummary = 'Invitation letter / visa application assistance only (NOT visa sponsorship)';
    tags.add('Visa application assistance only');
  } else if (hasVisaAssistanceOnly) {
    visaSupportType = 'visa_assistance_only';
    visaSupportSummary = 'Visa application assistance only (no sponsorship or fee coverage confirmed)';
    tags.add('Visa application assistance only');
  } else if (hasNoVisaSupport) {
    visaSupportType = 'none';
    visaSupportSummary = 'No visa sponsorship confirmed';
  }

  if (explicitFullFunded && !explicitSelfFunded) tags.add('Fully funded');
  if (tuitionCovered === 'yes') tags.add('Tuition funded');
  if (airfareCovered === 'yes') tags.add('Travel funded');
  if (accommodationCovered === 'yes') tags.add('Accommodation funded');
  if (explicitSelfFunded && !explicitFullFunded) tags.add('Self-funded');

  let fundingLevel: OpportunityFundingRecord['fundingLevel'] = 'not_confirmed';
  if (explicitFullFunded && !explicitSelfFunded) {
    fundingLevel = 'fully_funded';
  } else if (
    tuitionCovered === 'yes' ||
    tuitionCovered === 'partial' ||
    airfareCovered === 'yes' ||
    accommodationCovered === 'yes' ||
    hasVisaFeesFunded
  ) {
    fundingLevel = 'partially_funded';
  } else if (explicitSelfFunded) {
    fundingLevel = 'self_funded';
  }

  if (tags.size === 0) {
    tags.add('Funding Not Confirmed');
  }

  const relocationAssistance: OpportunityFundingRecord['relocationAssistance'] =
    input.relocationAssistance ||
    (/\b(relocation\s+(package|assistance|allowance|support|covered)|installation\s+grant)\b/i.test(fundingText)
      ? 'yes'
      : 'not_confirmed');

  const fundingSummary =
    input.fundingSummary?.trim() ||
    (fundingLevel === 'fully_funded'
      ? 'Fully funded (verify exact inclusions on official portal)'
      : fundingLevel === 'partially_funded'
      ? `Partially funded (${Array.from(tags).join(', ')})`
      : fundingLevel === 'self_funded'
      ? 'Self-funded'
      : 'Funding Not Confirmed');

  return {
    fundingLevel,
    fundingSummary,
    transparencyTags: Array.from(tags),
    tuitionCovered,
    airfareCovered,
    accommodationCovered,
    visaSupportType,
    visaSupportSummary,
    relocationAssistance,
    applicationFee: input.applicationFee?.trim() || 'Not Confirmed',
    stipendOrSalary: input.stipendOrSalary?.trim() || undefined,
  };
}

/**
 * Computes exact verification status and Verified Badge eligibility.
 * Strict rule: ONLY opportunities that pass live official URL verification + >= 3 full days rule
 * can receive the Verified badge.
 */
export function computeVerificationOutcome(params: {
  urlVerified: boolean;
  organizationAuthentic: boolean;
  applicationStatus: ApplicationLifecycleStatus;
  deadlineEval: DeadlineEvaluationResult;
  funding: Pick<OpportunityFundingRecord, 'fundingLevel' | 'visaSupportType'>;
  eligibility: Pick<OpportunityEligibilityRecord, 'ethiopianEligible'>;
  category: GlobalOpportunityCategory;
}): {
  verificationStatus: GlobalVerificationStatus;
  hasVerifiedBadge: boolean;
  isPubliclyDisplayable: boolean;
} {
  const { urlVerified, organizationAuthentic, applicationStatus, deadlineEval, funding, eligibility, category } = params;

  if (
    applicationStatus === 'expired' ||
    applicationStatus === 'closed' ||
    applicationStatus === 'withdrawn' ||
    deadlineEval.isExpired
  ) {
    return {
      verificationStatus: 'Expired',
      hasVerifiedBadge: false,
      isPubliclyDisplayable: false,
    };
  }

  if (!urlVerified || !organizationAuthentic || !deadlineEval.valid) {
    return {
      verificationStatus: 'Unverified',
      hasVerifiedBadge: false,
      isPubliclyDisplayable: false,
    };
  }

  // Mandatory 3-Full-Days Rule: never display if < 3 full days remain
  if (!deadlineEval.meetsMinimumThreeFullDays) {
    return {
      verificationStatus: 'Expired',
      hasVerifiedBadge: false,
      isPubliclyDisplayable: false,
    };
  }

  // Determine exact display status among required labels
  let verificationStatus: GlobalVerificationStatus = 'Verified and Open';

  if (deadlineEval.isClosingSoon) {
    verificationStatus = 'Closing Soon';
  } else if (funding.visaSupportType === 'employer_sponsored_visa') {
    verificationStatus = 'Visa Sponsored';
  } else if (funding.fundingLevel === 'fully_funded') {
    verificationStatus = 'Fully Funded';
  } else if (funding.fundingLevel === 'partially_funded') {
    verificationStatus = 'Partially Funded';
  } else if (eligibility.ethiopianEligible === 'not_confirmed') {
    verificationStatus = 'Eligibility Not Confirmed';
  } else if (
    (category === 'university_scholarship' ||
      category === 'professional_training' ||
      category === 'conference_summit') &&
    funding.fundingLevel === 'not_confirmed'
  ) {
    verificationStatus = 'Funding Not Confirmed';
  }

  return {
    verificationStatus,
    hasVerifiedBadge: true,
    isPubliclyDisplayable: true,
  };
}

/**
 * Checks whether an opportunity is eligible for active display on the website right now.
 * Re-evaluates the deadline against `nowMs` so stale records are immediately hidden.
 */
export function isOpportunityActiveAndDisplayable(
  opp: GlobalOpportunity,
  nowMs: number = Date.now()
): boolean {
  if (!opp.hasVerifiedBadge) return false;
  if (
    opp.applicationStatus === 'closed' ||
    opp.applicationStatus === 'expired' ||
    opp.applicationStatus === 'withdrawn'
  ) {
    return false;
  }
  if (opp.verificationStatus === 'Expired' || opp.verificationStatus === 'Unverified') {
    return false;
  }
  if (opp.eligibility.ethiopianEligible === 'excluded') {
    return false;
  }
  const deadlineCheck = evaluateOpportunityDeadline(
    opp.deadline.deadlineUtcIso || opp.deadline.deadlineDateRaw,
    opp.deadline.deadlineTimezone,
    nowMs
  );
  return deadlineCheck.valid && !deadlineCheck.isExpired && deadlineCheck.meetsMinimumThreeFullDays;
}

// =========================================================================
// SECTOR & DOMAIN TAXONOMY CLASSIFIERS
// =========================================================================

const WASH_KEYWORDS = [
  'wash',
  'water supply',
  'water and sanitation',
  'water, sanitation',
  'sanitation',
  'hygiene',
  'wastewater',
  'water resources',
  'water engineering',
  'water engineer',
  'hydrology',
  'hydrogeology',
  'environmental health',
  'hydraulic',
  'borehole',
  'fecal sludge',
  'clean water',
  'drinking water',
  'wateraid',
  'water.org',
  'un-habitat',
  'climate-resilient wash',
  'humanitarian wash',
  'public health engineering',
];

const BANKING_FINANCE_KEYWORDS = [
  'bank',
  'banking',
  'central bank',
  'digital banking',
  'fintech',
  'financial technology',
  'microfinance',
  'financial inclusion',
  'risk management',
  'financial regulation',
  'credit risk',
  'treasury',
  'accounting',
  'audit',
  'auditor',
  'finance',
  'financial analyst',
  'investment',
  'economics',
  'economist',
  'monetary policy',
  'insurance',
  'actuary',
  'capital market',
  'imf',
  'world bank',
  'african development bank',
  'afdb',
  'ifc',
];

const TECH_AI_KEYWORDS = [
  'artificial intelligence',
  'machine learning',
  'software',
  'developer',
  'data science',
  'data analyst',
  'cybersecurity',
  'cloud',
  'information technology',
  'computer science',
  'digital transformation',
  'devops',
  'ai ',
  'technology',
];

const DEVELOPMENT_HUMANITARIAN_KEYWORDS = [
  'humanitarian',
  'international development',
  'sustainable development',
  'sdg',
  'unicef',
  'undp',
  'unhcr',
  'iom',
  'irc',
  'world vision',
  'save the children',
  'ifrc',
  'red cross',
  'oxfam',
  'refugee',
  'community development',
  'ngo',
  'donor',
  'grant',
  'monitoring and evaluation',
  'm&e',
  'protection officer',
  'livelihoods',
];

export function detectSectorsFromText(text: string): {
  sectors: SectorTag[];
  isWash: boolean;
  isBankingFinance: boolean;
} {
  const lower = ` ${String(text || '').toLowerCase()} `;
  const sectors = new Set<SectorTag>();

  const hasAny = (list: string[]) => list.some((kw) => lower.includes(kw));

  const isWash = hasAny(WASH_KEYWORDS);
  const isBankingFinance = hasAny(BANKING_FINANCE_KEYWORDS);

  if (isWash) sectors.add('wash');
  if (isBankingFinance) sectors.add('banking_finance');
  if (hasAny(TECH_AI_KEYWORDS)) sectors.add('technology_ai');
  if (hasAny(DEVELOPMENT_HUMANITARIAN_KEYWORDS)) {
    sectors.add('international_development');
    if (/\b(humanitarian|refugee|emergency|relief|unhcr|iom|irc|ifrc|red cross|unicef)\b/i.test(lower)) {
      sectors.add('humanitarian');
    }
  }
  if (/\b(engineer|engineering|civil|mechanical|electrical|infrastructure|hydraulic)\b/i.test(lower)) {
    sectors.add('engineering');
  }
  if (/\b(public health|healthcare|medical|epidemiology|nutrition|who|clinic|doctor|nurse)\b/i.test(lower)) {
    sectors.add('healthcare_public_health');
  }
  if (/\b(climate|environment|renewable|sustainability|green|carbon|biodiversity)\b/i.test(lower)) {
    sectors.add('climate_environment');
  }
  if (/\b(entrepreneur|startup|business|sme|trade|commerce|innovation)\b/i.test(lower)) {
    sectors.add('entrepreneurship_business');
  }
  if (/\b(leadership|project management|governance|policy|fellowship|executive)\b/i.test(lower)) {
    sectors.add('leadership_management');
  }
  if (/\b(scholarship|university|masters|master's|phd|doctoral|academic|research|tuition)\b/i.test(lower)) {
    sectors.add('academic_research');
  }

  return {
    sectors: Array.from(sectors),
    isWash,
    isBankingFinance,
  };
}

// =========================================================================
// PERSONALIZED ELIGIBILITY & RECOMMENDATION ENGINE
// =========================================================================

const EDUCATION_RANK: Record<OpportunityEligibilityRecord['minimumEducationLevel'], number> = {
  none: 0,
  not_confirmed: 0,
  diploma: 1,
  bachelors: 2,
  masters: 3,
  phd: 4,
};

export function extractProfileYearsOfExperience(profile: JobSeekerProfile): number {
  if (profile.noExperience === true) return 0;

  const raw = String(profile.yearsOfExperience || '');
  const rangeMatch = raw.match(/(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    return Math.max(Number(rangeMatch[1]), Number(rangeMatch[2]));
  }
  const singleMatch = raw.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    return Number(singleMatch[1]);
  }

  // Fallback: sum experience items if dates exist
  if (Array.isArray(profile.experience) && profile.experience.length > 0) {
    let totalMonths = 0;
    const now = new Date();
    for (const exp of profile.experience) {
      const start = exp.startDate ? new Date(exp.startDate) : null;
      const end = exp.isCurrent ? now : exp.endDate ? new Date(exp.endDate) : null;
      if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        const months = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4));
        totalMonths += months;
      }
    }
    if (totalMonths > 0) return Math.round((totalMonths / 12) * 10) / 10;
  }

  return 0;
}

export function extractProfileHighestEducationLevel(
  profile: JobSeekerProfile
): OpportunityEligibilityRecord['minimumEducationLevel'] {
  if (!Array.isArray(profile.education) || profile.education.length === 0) {
    return 'not_confirmed';
  }
  let highest: OpportunityEligibilityRecord['minimumEducationLevel'] = 'diploma';
  for (const ed of profile.education) {
    const q = `${ed.qualification || ''} ${ed.fieldOfStudy || ''}`.toLowerCase();
    if (/\b(phd|ph\.d|doctorate|doctoral)\b/.test(q)) {
      highest = 'phd';
    } else if (
      EDUCATION_RANK[highest] < EDUCATION_RANK.masters &&
      /\b(master|msc|m\.sc|mba|ma\b|m\.a|mph|llm|postgraduate)\b/.test(q)
    ) {
      highest = 'masters';
    } else if (
      EDUCATION_RANK[highest] < EDUCATION_RANK.bachelors &&
      /\b(bachelor|bsc|b\.sc|ba\b|b\.a|bba|beng|b\.eng|degree|undergraduate|llb)\b/.test(q)
    ) {
      highest = 'bachelors';
    }
  }
  return highest;
}

function buildProfileCorpus(profile: JobSeekerProfile): string {
  const parts: string[] = [
    profile.desiredJobTitle || '',
    profile.currentPosition || '',
    profile.preferredIndustry || '',
    profile.customProfessionOrCategory || '',
    profile.staffDepartmentOrSector || '',
    profile.bio || '',
    ...(profile.preferredSectors || []),
    ...(profile.skills || []),
    ...(profile.areasOfExpertise || []),
    ...(profile.professionalInterests || []),
    ...(profile.previousPositions || []),
    ...(profile.additionalRequirements || []),
    ...(profile.certifications || []).map((c) => `${c.name} ${c.issuingOrganization}`),
    ...(profile.education || []).map((e) => `${e.qualification} ${e.fieldOfStudy} ${e.institution}`),
    ...(profile.experience || []).map((x) => `${x.jobTitle} ${x.companyName} ${x.responsibilities}`),
  ];
  return parts.join(' ').toLowerCase();
}

function extractMeaningfulKeywords(text: string): string[] {
  const stopWords = new Set([
    'and',
    'the',
    'for',
    'with',
    'from',
    'that',
    'this',
    'have',
    'will',
    'your',
    'about',
    'into',
    'over',
    'under',
    'more',
    'most',
    'other',
    'work',
    'working',
    'experience',
    'years',
    'year',
    'role',
    'position',
    'officer',
    'specialist',
    'manager',
    'program',
    'programme',
    'international',
    'global',
    'ethiopia',
    'ethiopian',
  ]);
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));
  return Array.from(new Set(tokens));
}

/**
 * Evaluates strict eligibility and computes personalized match score & transparent reasons
 * for a registered HopelandJobs user.
 * NEVER recommends opportunities where the user fails mandatory eligibility conditions.
 */
export function evaluateOpportunityForUser(
  opportunity: GlobalOpportunity,
  profile: JobSeekerProfile,
  nowMs: number = Date.now()
): UserOpportunityRecommendationRecord {
  const disqualificationReasons: string[] = [];
  const matchReasons: string[] = [];
  const matchedSectors: string[] = [];

  // Gate 0: Active & >= 3 full days deadline gate
  if (!isOpportunityActiveAndDisplayable(opportunity, nowMs)) {
    disqualificationReasons.push('Opportunity is closed, unverified, or has fewer than 3 full days remaining.');
  }

  // Gate 1: Nationality Eligibility (HopelandJobs users default to Ethiopian nationality unless explicitly international)
  if (opportunity.eligibility.ethiopianEligible === 'excluded') {
    disqualificationReasons.push(
      `Nationality restriction: ${opportunity.eligibility.eligibleNationalities.join(', ') || 'Not open to Ethiopian applicants'}.`
    );
  }

  // Gate 2: Mandatory Years of Experience
  const userYears = extractProfileYearsOfExperience(profile);
  const minYears = opportunity.eligibility.minimumYearsExperience;
  if (typeof minYears === 'number' && minYears > 0 && userYears < minYears) {
    disqualificationReasons.push(
      `Requires at least ${minYears} year${minYears > 1 ? 's' : ''} of experience (profile shows ${userYears} year${userYears === 1 ? '' : 's'}).`
    );
  }

  // Gate 3: Mandatory Education Level (when user has recorded education)
  const userEdu = extractProfileHighestEducationLevel(profile);
  const reqEdu = opportunity.eligibility.minimumEducationLevel;
  if (
    reqEdu !== 'none' &&
    reqEdu !== 'not_confirmed' &&
    userEdu !== 'not_confirmed' &&
    EDUCATION_RANK[userEdu] < EDUCATION_RANK[reqEdu]
  ) {
    disqualificationReasons.push(
      `Requires minimum ${reqEdu.toUpperCase()} qualification (profile lists ${userEdu.toUpperCase()}).`
    );
  }

  // Gate 4: Mandatory Institutional / University / Company Nomination Gate
  if (
    (opportunity.category === 'university_scholarship' &&
      opportunity.eligibility.universityRecommendationRequired === 'required' &&
      opportunity.eligibility.directIndividualApplicationAllowed === 'no') ||
    ((opportunity.category === 'professional_training' || opportunity.category === 'conference_summit') &&
      opportunity.eligibility.companyRecommendationRequired === 'required' &&
      opportunity.eligibility.directIndividualApplicationAllowed === 'no') ||
    (opportunity.eligibility.institutionalNominationRequired === 'required' &&
      opportunity.eligibility.directIndividualApplicationAllowed === 'no')
  ) {
    disqualificationReasons.push(
      'Requires mandatory institutional/university/company nomination rather than direct individual application.'
    );
  }

  const profileCorpus = buildProfileCorpus(profile);
  const profileDetected = detectSectorsFromText(profileCorpus);

  let score = 0;

  // Sector alignment (high weight for Banking & Finance, WASH, Dev, Tech, Engineering, Health)
  const sharedSectors = opportunity.sectors.filter((s) => profileDetected.sectors.includes(s));
  if (sharedSectors.length > 0) {
    score += Math.min(40, 22 + (sharedSectors.length - 1) * 10);
    const labelMap: Record<SectorTag, string> = {
      banking_finance: 'Banking & Finance',
      wash: 'WASH (Water, Sanitation & Hygiene)',
      technology_ai: 'Technology & AI',
      international_development: 'International Development',
      humanitarian: 'Humanitarian Operations',
      engineering: 'Engineering & Water Infrastructure',
      healthcare_public_health: 'Public Health & Healthcare',
      climate_environment: 'Climate & Environmental Health',
      entrepreneurship_business: 'Business & Entrepreneurship',
      leadership_management: 'Leadership & Project Management',
      academic_research: 'Academic & Research',
    };
    for (const s of sharedSectors) {
      matchedSectors.push(labelMap[s]);
    }
    matchReasons.push(`Matches your sector background in ${matchedSectors.slice(0, 3).join(', ')}`);
  }

  // Direct WASH specialty boost
  if (opportunity.isWashDedicated && profileDetected.isWash) {
    score += 15;
    matchReasons.push('Direct alignment with your WASH / Water & Sanitation profile');
  }

  // Direct Banking & Finance specialty boost
  if (opportunity.isBankingFinance && profileDetected.isBankingFinance) {
    score += 15;
    matchReasons.push('Direct alignment with your Banking, Microfinance & Finance specialization');
  }

  // Skill & Keyword overlap
  const oppText = `${opportunity.title} ${opportunity.summary} ${opportunity.eligibility.requiredSkills.join(' ')} ${opportunity.organization}`;
  const oppKeywords = extractMeaningfulKeywords(oppText);
  const profileKeywords = new Set(extractMeaningfulKeywords(profileCorpus));
  const overlappingKeywords = oppKeywords.filter((kw) => profileKeywords.has(kw));
  if (overlappingKeywords.length > 0) {
    score += Math.min(25, overlappingKeywords.length * 5);
    matchReasons.push(`Matches skills & focus areas: ${overlappingKeywords.slice(0, 4).join(', ')}`);
  }

  // Experience & Education fit confirmation
  if (typeof minYears === 'number' && minYears > 0 && userYears >= minYears) {
    score += 10;
    matchReasons.push(`You meet the experience requirement (${userYears} yrs vs ${minYears}+ yrs required)`);
  } else if (minYears === 0 || opportunity.eligibility.careerLevel === 'entry') {
    score += 6;
    matchReasons.push('Open to entry-level and early-career professionals');
  }

  if (reqEdu !== 'none' && reqEdu !== 'not_confirmed' && userEdu !== 'not_confirmed' && EDUCATION_RANK[userEdu] >= EDUCATION_RANK[reqEdu]) {
    score += 8;
    matchReasons.push(`Education requirement satisfied (${opportunity.eligibility.educationRequirement})`);
  }

  // Funding & Visa quality bonuses for Ethiopian applicants
  if (opportunity.eligibility.ethiopianEligible === 'confirmed') {
    score += 8;
    matchReasons.push('Confirmed eligible for Ethiopian applicants');
  }
  if (opportunity.funding.fundingLevel === 'fully_funded') {
    score += 8;
    matchReasons.push('Confirmed Fully Funded program');
  } else if (opportunity.funding.visaSupportType === 'employer_sponsored_visa') {
    score += 8;
    matchReasons.push('Employer-sponsored work visa confirmed');
  }

  if (
    opportunity.eligibility.directIndividualApplicationAllowed === 'yes' &&
    opportunity.eligibility.universityRecommendationRequired !== 'required' &&
    opportunity.eligibility.companyRecommendationRequired !== 'required'
  ) {
    score += 5;
    matchReasons.push('Accepts direct individual applications without mandatory institutional nomination');
  }

  // Preferred country / remote preference match
  const prefLoc = String(profile.preferredWorkLocation || '').toLowerCase();
  if (prefLoc && prefLoc !== 'any location' && opportunity.country.toLowerCase().includes(prefLoc)) {
    score += 8;
    matchReasons.push(`Located in your preferred destination (${opportunity.country})`);
  }

  const boundedScore = disqualificationReasons.length > 0 ? 0 : Math.min(100, Math.max(0, Math.round(score)));
  const eligible = disqualificationReasons.length === 0 && boundedScore >= 25;

  const eligibilitySummary =
    disqualificationReasons.length > 0
      ? `Not eligible: ${disqualificationReasons[0]}`
      : eligible
      ? 'Meets verified eligibility criteria for your profile'
      : 'Eligible, lower direct sector match with current profile';

  return {
    id: `rec_${profile.uid}_${opportunity.id}`.slice(0, 128),
    userId: profile.uid,
    opportunityId: opportunity.id,
    matchScore: boundedScore,
    eligible,
    matchReasons: matchReasons.slice(0, 5),
    eligibilitySummary,
    matchedSectors,
    disqualificationReasons,
    generatedAt: new Date(nowMs).toISOString(),
  };
}

export function recommendOpportunitiesForUser(
  opportunities: GlobalOpportunity[],
  profile: JobSeekerProfile | null | undefined,
  nowMs: number = Date.now()
): Array<{ opportunity: GlobalOpportunity; recommendation: UserOpportunityRecommendationRecord }> {
  if (!profile || !profile.uid) return [];

  const results: Array<{ opportunity: GlobalOpportunity; recommendation: UserOpportunityRecommendationRecord }> = [];

  for (const opp of opportunities) {
    if (!isOpportunityActiveAndDisplayable(opp, nowMs)) continue;
    const rec = evaluateOpportunityForUser(opp, profile, nowMs);
    if (rec.eligible && rec.disqualificationReasons.length === 0) {
      results.push({ opportunity: opp, recommendation: rec });
    }
  }

  return results.sort((a, b) => b.recommendation.matchScore - a.recommendation.matchScore);
}

/**
 * Formats recommendation/nomination requirement cleanly for cards & detail views.
 */
export function formatRecommendationSummary(elig: OpportunityEligibilityRecord): string {
  const parts: string[] = [];
  if (elig.universityRecommendationRequired === 'required') parts.push('University rec. required');
  else if (elig.universityRecommendationRequired === 'not_required') parts.push('No university rec.');

  if (elig.companyRecommendationRequired === 'required') parts.push('Company rec. required');
  else if (elig.companyRecommendationRequired === 'not_required') parts.push('No company rec.');

  if (elig.institutionalNominationRequired === 'required') parts.push('Institutional nomination required');
  else if (elig.institutionalNominationRequired === 'not_required' && elig.directIndividualApplicationAllowed === 'yes') {
    parts.push('Direct individual application');
  }

  if (parts.length === 0) {
    return elig.directIndividualApplicationAllowed === 'yes'
      ? 'Direct individual application'
      : 'Not Confirmed';
  }
  return parts.join(' · ');
}
