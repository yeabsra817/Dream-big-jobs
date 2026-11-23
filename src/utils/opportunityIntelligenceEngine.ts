import { JobSeekerProfile } from '../types/jobSeeker';
import {
  ApplicationLifecycleStatus,
  CanonicalVerificationTier,
  EmploymentVisaClassification,
  FundingTransparencyCategory,
  GlobalDiscoveryDepartment,
  GlobalOpportunity,
  GlobalOpportunityCategory,
  GlobalVerificationStatus,
  OpportunityDeadlineRecord,
  OpportunityEligibilityRecord,
  OpportunityFundingRecord,
  PermanentResidencyAssessmentResult,
  PermanentResidencyCountryRecord,
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
  const visaText = `${input.visaSummary || ''} ${input.fundingSummary || ''} ${input.fullText || ''}`.toLowerCase();

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

  // Strict Visa Sponsorship / Visa Fee Coverage vs Invitation Letter / Visa-Free / Self-Paid distinction
  const hasContradictorySelfPaidOrWithdrawnVisa =
    /\b(no\s+visa\s+sponsorship|cannot\s+sponsor|does\s+not\s+sponsor|will\s+not\s+sponsor|no\s+longer\s+(?:able\s+to\s+)?sponsor|without\s+visa\s+sponsorship|visa\s+(?:or\s+work\s+permit\s+)?sponsorship\s+(?:is\s+|has\s+been\s+|was\s+)?(?:no\s+longer\s+available|no\s+longer\s+offered|not\s+available|not\s+offered|withdrawn|discontinued|revoked|suspended)|applicants?\s+(?:must|are\s+responsible\s+to|should)\s+(?:pay|cover|bear)\s+(?:their\s+own\s+)?visa|visa\s+(?:application\s+)?fees?\s+(?:are\s+)?(?:not\s+covered|not\s+included|excluded|at\s+own\s+expense|paid\s+by\s+(?:the\s+)?applicant|self[\s-]funded)|responsible\s+for\s+(?:their\s+own\s+)?visa\s+(?:costs?|fees?)|must\s+have\s+right\s+to\s+work|already\s+authorized\s+to\s+work|national\s+position\s+only)\b/i.test(
      visaText
    );

  const hasVisaFreeEntryOnly =
    /\b(visa[\s-]free\s+(?:entry|access|travel|country)|no\s+visa\s+required\s+for\s+entry|visa\s+on\s+arrival)\b/i.test(
      visaText
    );

  const hasEmployerSponsoredVisa =
    !hasContradictorySelfPaidOrWithdrawnVisa &&
    /\b(employer[\s-]sponsored\s+(?:work\s+)?visas?|work\s+visa\s+sponsorship|work\s+permit\s+sponsorship|visa\s+sponsorship\s+(?:provided|available|offered|included|confirmed)|we\s+sponsor\s+(?:work\s+)?visas?|sponsors?\s+work\s+(?:visas?|permits?)|full\s+work\s+visa\s+sponsorship|company[\s-]sponsored\s+(?:work\s+)?visa|tier\s*2\s+sponsorship|skilled\s+worker\s+visa\s+sponsorship)\b/i.test(
      visaText
    );

  const hasVisaFeesFunded =
    !hasContradictorySelfPaidOrWithdrawnVisa &&
    /\b(visa\s+(?:application\s+)?(?:fees?|costs?|expenses?)\s+(?:are\s+|will\s+be\s+)?(?:fully\s+)?(?:covered|paid|reimbursed|funded|waived\s+and\s+covered)|reimbursement\s+of\s+visa\s+(?:application\s+)?(?:fees?|costs?)|covers?\s+(?:all\s+)?visa\s+(?:application\s+)?(?:fees?|costs?|expenses?)|visa\s+fee\s+reimbursement|visa\s+cost\s+coverage|includes?\s+visa\s+(?:fees?|costs?|sponsorship)|visa\s+sponsorship\s+and\s+fees?\s+covered)\b/i.test(
      visaText
    );

  const hasInvitationLetterOnly =
    /\b(invitation\s+letter|visa\s+support\s+letter|letter\s+of\s+invitation)\b/i.test(visaText) &&
    !hasEmployerSponsoredVisa &&
    !hasVisaFeesFunded;

  const hasVisaAssistanceOnly =
    (/\b(visa\s+assistance|visa\s+guidance|support\s+with\s+visa\s+application)\b/i.test(visaText) ||
      hasInvitationLetterOnly) &&
    !hasEmployerSponsoredVisa &&
    !hasVisaFeesFunded;

  let visaSupportType: OpportunityFundingRecord['visaSupportType'] = 'not_confirmed';
  let visaSupportSummary = 'Not Confirmed';

  if (hasContradictorySelfPaidOrWithdrawnVisa) {
    visaSupportType = 'none';
    visaSupportSummary = 'Rejected: No visa sponsorship / applicant must pay own visa fees / sponsorship withdrawn';
  } else if (hasEmployerSponsoredVisa) {
    visaSupportType = 'employer_sponsored_visa';
    visaSupportSummary = 'Employer-sponsored work visa / permit officially confirmed';
    tags.add('Employer-sponsored visa');
  } else if (hasVisaFeesFunded) {
    visaSupportType = 'visa_fees_funded';
    visaSupportSummary = 'Official visa application fee coverage confirmed';
    tags.add('Visa fees funded');
  } else if (hasVisaFreeEntryOnly) {
    visaSupportType = 'visa_free_not_sponsorship';
    visaSupportSummary = 'Visa-free entry mentioned (NOT visa sponsorship or visa fee coverage)';
  } else if (hasInvitationLetterOnly) {
    visaSupportType = 'invitation_letter_only';
    visaSupportSummary = 'Invitation letter only (does NOT qualify — no visa sponsorship or fee coverage)';
    tags.add('Visa application assistance only');
  } else if (hasVisaAssistanceOnly) {
    visaSupportType = 'visa_assistance_only';
    visaSupportSummary = 'Visa application assistance without fee coverage (does NOT qualify)';
    tags.add('Visa application assistance only');
  }

  if (explicitFullFunded && !explicitSelfFunded) tags.add('Fully funded');
  if (tuitionCovered === 'yes') tags.add('Tuition funded');
  if (airfareCovered === 'yes') tags.add('Travel funded');
  if (accommodationCovered === 'yes') tags.add('Accommodation funded');
  if (explicitSelfFunded && !explicitFullFunded) tags.add('Self-funded');

  const insuranceCovered: OpportunityFundingRecord['insuranceCovered'] =
    /\b(health\s+insurance|medical\s+insurance|insurance\s+covered|insurance\s+provided)\b/i.test(fundingText)
      ? 'yes'
      : 'not_confirmed';

  const livingAllowanceCovered: OpportunityFundingRecord['livingAllowanceCovered'] =
    /\b(living\s+allowance|monthly\s+stipend|subsistence\s+allowance|per\s+diem|stipend\s+provided|living\s+expenses\s+covered)\b/i.test(
      fundingText
    )
      ? 'yes'
      : 'not_confirmed';

  const explicitFreeNoFee =
    !explicitFullFunded &&
    !explicitSelfFunded &&
    /\b(free\s+of\s+charge|free\s+to\s+attend|free\s+course|free\s+training|no\s+tuition\s+fee|no\s+registration\s+fee|tuition[\s-]free)\b/i.test(
      fundingText
    );

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
  } else if (explicitFreeNoFee) {
    fundingLevel = 'free';
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

  const employmentVisa = classifyEmploymentVisaStatus({
    visaSummary: input.visaSummary,
    fundingSummary: input.fundingSummary,
    fullText: input.fullText,
    visaSupportType,
    relocationAssistance,
  });

  const fundingSummary =
    input.fundingSummary?.trim() ||
    (fundingLevel === 'fully_funded'
      ? 'Fully funded (verify exact inclusions on official portal)'
      : fundingLevel === 'partially_funded'
      ? `Partially funded (${Array.from(tags).join(', ')})`
      : fundingLevel === 'free'
      ? 'Free participation (travel/accommodation not confirmed)'
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
    insuranceCovered,
    livingAllowanceCovered,
    visaSupportType,
    employmentVisaClassification: employmentVisa.classification,
    employmentVisaLabel: employmentVisa.label,
    visaSupportSummary,
    relocationAssistance,
    applicationFee: input.applicationFee?.trim() || 'Not Confirmed',
    stipendOrSalary: input.stipendOrSalary?.trim() || undefined,
  };
}

export const EMPLOYMENT_VISA_LABELS: Record<EmploymentVisaClassification, string> = {
  confirmed_visa_sponsorship: 'Confirmed visa sponsorship',
  confirmed_international_recruitment: 'Confirmed international recruitment',
  relocation_assistance: 'Relocation assistance',
  work_permit_assistance: 'Work permit assistance',
  no_sponsorship_stated: 'No sponsorship stated',
  not_eligible_international: 'Not eligible for international applicants',
};

/**
 * Strictly classifies employment visa/sponsorship evidence into the 6 official tiers.
 * Never labels a job as confirmed visa sponsorship without reliable textual evidence.
 */
export function classifyEmploymentVisaStatus(input: {
  visaSummary?: string;
  fundingSummary?: string;
  fullText?: string;
  visaSupportType?: OpportunityFundingRecord['visaSupportType'];
  relocationAssistance?: OpportunityFundingRecord['relocationAssistance'];
  ethiopianEligible?: OpportunityEligibilityRecord['ethiopianEligible'];
}): { classification: EmploymentVisaClassification; label: string } {
  const corpus = `${input.visaSummary || ''} ${input.fundingSummary || ''} ${input.fullText || ''}`.toLowerCase();

  const isLocalOrNationalOnly =
    input.ethiopianEligible === 'excluded' ||
    /\b(national\s+position\s+only|local\s+nationals?\s+only|open\s+only\s+to\s+citizens\s+of|host\s+country\s+nationals?\s+only|must\s+(?:already\s+)?have\s+(?:the\s+)?right\s+to\s+work|already\s+authorized\s+to\s+work|citizens?\s+or\s+permanent\s+residents?\s+only|no\s+visa\s+sponsorship|cannot\s+sponsor|does\s+not\s+sponsor|will\s+not\s+sponsor|no\s+longer\s+(?:able\s+to\s+)?sponsor|visa\s+(?:or\s+work\s+permit\s+)?sponsorship\s+(?:is\s+|has\s+been\s+|was\s+)?(?:no\s+longer\s+available|not\s+available|withdrawn|discontinued|revoked))\b/i.test(
      corpus
    );

  if (isLocalOrNationalOnly || input.visaSupportType === 'none') {
    return {
      classification: 'not_eligible_international',
      label: EMPLOYMENT_VISA_LABELS.not_eligible_international,
    };
  }

  if (
    input.visaSupportType === 'employer_sponsored_visa' ||
    /\b(employer[\s-]sponsored\s+(?:work\s+)?visas?|work\s+visa\s+sponsorship|work\s+permit\s+sponsorship|visa\s+sponsorship\s+(?:provided|available|offered|included|confirmed)|we\s+sponsor\s+(?:work\s+)?visas?|sponsors?\s+work\s+(?:visas?|permits?)|tier\s*2\s+sponsorship|skilled\s+worker\s+visa\s+sponsorship)\b/i.test(
      corpus
    )
  ) {
    return {
      classification: 'confirmed_visa_sponsorship',
      label: EMPLOYMENT_VISA_LABELS.confirmed_visa_sponsorship,
    };
  }

  if (
    /\b(work\s+permit\s+(?:assistance|support|arranged|facilitated|processing)|assist(?:ance)?\s+with\s+(?:obtaining\s+)?(?:a\s+)?work\s+permit)\b/i.test(
      corpus
    )
  ) {
    return {
      classification: 'work_permit_assistance',
      label: EMPLOYMENT_VISA_LABELS.work_permit_assistance,
    };
  }

  if (
    input.relocationAssistance === 'yes' ||
    /\b(relocation\s+(?:package|assistance|allowance|support|covered|benefits?)|installation\s+grant|settling[\s-]in\s+grant)\b/i.test(
      corpus
    )
  ) {
    return {
      classification: 'relocation_assistance',
      label: EMPLOYMENT_VISA_LABELS.relocation_assistance,
    };
  }

  if (
    /\b(international\s+(?:staff|position|recruitment|applicants?|candidates?|hiring|professionals?|vacancy|contract|post)|open\s+to\s+all\s+nationalities|applicants?\s+of\s+all\s+nationalities|p-?[1-5]\s+(?:level|grade|post)|un\s+international\s+professional|expatriate\s+(?:contract|package|position))\b/i.test(
      corpus
    )
  ) {
    return {
      classification: 'confirmed_international_recruitment',
      label: EMPLOYMENT_VISA_LABELS.confirmed_international_recruitment,
    };
  }

  return {
    classification: 'no_sponsorship_stated',
    label: EMPLOYMENT_VISA_LABELS.no_sponsorship_stated,
  };
}

export function classifyOpportunityDepartment(
  inputOrCategory:
    | GlobalOpportunityCategory
    | {
        category: GlobalOpportunityCategory;
        isBankingFinance?: boolean;
        isWashDedicated?: boolean;
      },
  isBankingFinanceArg?: boolean,
  isWashDedicatedArg?: boolean
): GlobalDiscoveryDepartment {
  const category = typeof inputOrCategory === 'string' ? inputOrCategory : inputOrCategory.category;
  const isBankingFinance =
    typeof inputOrCategory === 'string' ? Boolean(isBankingFinanceArg) : Boolean(inputOrCategory.isBankingFinance);
  const isWashDedicated =
    typeof inputOrCategory === 'string' ? Boolean(isWashDedicatedArg) : Boolean(inputOrCategory.isWashDedicated);

  if (category === 'university_scholarship') return 'banking_wash_scholarships';
  if (category === 'professional_training') return 'banking_wash_training';
  if (category === 'conference_summit') return 'banking_wash_conferences';
  if (category === 'wash_opportunity' || (isWashDedicated && !isBankingFinance)) {
    return 'wash_jobs';
  }
  return 'banking_finance_jobs';
}

/**
 * MANDATORY VISA SPONSORSHIP & VISA-COST COVERAGE FILTER
 * - Employment (international_job, wash_opportunity): MUST explicitly confirm employer-sponsored work visa / permit.
 * - Scholarships, Training, Conferences: MUST explicitly confirm visa application fee coverage or visa sponsorship.
 * - Strictly rejects invitation letter only, visa assistance without fee coverage, visa-free entry,
 *   self-paid visa fees, unspecified visa funding, withdrawn sponsorship, or source contradictions.
 */
export function evaluateMandatoryVisaCompliance(
  category: GlobalOpportunityCategory,
  funding: Pick<OpportunityFundingRecord, 'visaSupportType' | 'visaSupportSummary' | 'evidenceExcerpt'>,
  officialSourceText?: string
): { passed: boolean; reason: string | null } {
  const combinedText = `${funding.visaSupportSummary || ''} ${funding.evidenceExcerpt || ''} ${officialSourceText || ''}`;

  // Reject immediately if official source text contradicts claimed visa coverage or indicates withdrawal
  if (
    /\b(no\s+visa\s+sponsorship|cannot\s+sponsor|does\s+not\s+sponsor|will\s+not\s+sponsor|no\s+longer\s+(?:able\s+to\s+)?sponsor|visa\s+(?:or\s+work\s+permit\s+)?sponsorship\s+(?:is\s+|has\s+been\s+|was\s+)?(?:no\s+longer\s+available|no\s+longer\s+offered|not\s+available|not\s+offered|withdrawn|discontinued|revoked|suspended)|applicants?\s+(?:must|are\s+responsible\s+to|should)\s+(?:pay|cover|bear)\s+(?:their\s+own\s+)?visa|visa\s+(?:application\s+)?fees?\s+(?:are\s+)?(?:not\s+covered|not\s+included|excluded|at\s+own\s+expense|paid\s+by\s+(?:the\s+)?applicant)|responsible\s+for\s+(?:their\s+own\s+)?visa\s+(?:costs?|fees?))\b/i.test(
      combinedText
    )
  ) {
    return {
      passed: false,
      reason:
        'Rejected (Visa Rule): Official source states applicants must pay their own visa fees, no visa sponsorship is offered, or sponsorship was withdrawn.',
    };
  }

  const isEmployment = category === 'international_job' || category === 'wash_opportunity';

  if (funding.visaSupportType === 'visa_free_not_sponsorship') {
    return {
      passed: false,
      reason:
        'Rejected (Visa Rule): Visa-free entry does not qualify as official employer work visa sponsorship or visa fee coverage.',
    };
  }

  if (funding.visaSupportType === 'invitation_letter_only') {
    return {
      passed: false,
      reason:
        'Rejected (Visa Rule): An invitation letter alone does not qualify — official visa fee coverage or visa sponsorship is required.',
    };
  }

  if (funding.visaSupportType === 'visa_assistance_only') {
    return {
      passed: false,
      reason:
        'Rejected (Visa Rule): Visa application assistance without confirmed visa fee coverage does not qualify.',
    };
  }

  if (funding.visaSupportType === 'none') {
    return {
      passed: false,
      reason:
        'Rejected (Visa Rule): No visa sponsorship or visa fee coverage confirmed (or applicants must pay own visa costs).',
    };
  }

  if (isEmployment) {
    if (funding.visaSupportType === 'employer_sponsored_visa') {
      return { passed: true, reason: null };
    }
    return {
      passed: false,
      reason:
        'Rejected (Visa Rule): Employment opportunity does not explicitly confirm employer-sponsored work visa or work permit sponsorship from official recruitment documentation.',
    };
  }

  // Scholarships, Professional Training, International Conferences
  if (
    funding.visaSupportType === 'visa_fees_funded' ||
    funding.visaSupportType === 'employer_sponsored_visa'
  ) {
    return { passed: true, reason: null };
  }

  return {
    passed: false,
    reason:
      'Rejected (Visa Rule): Sponsoring institution or organizer does not explicitly confirm visa application fee coverage or visa sponsorship.',
  };
}

/**
 * STRICT PROFESSIONAL RESTRICTION FILTER
 * - Scholarships, Professional Training, and Conferences MUST serve Banking & Finance OR WASH professionals exclusively.
 * - International Jobs retain all existing professional categories (while still passing the mandatory visa sponsorship gate).
 */
export function evaluateProfessionalRestrictionCompliance(
  category: GlobalOpportunityCategory,
  input: {
    title?: string;
    summary?: string;
    organization?: string;
    sectors?: SectorTag[];
    isBankingFinance?: boolean;
    isWashDedicated?: boolean;
  }
): { passed: boolean; domain: 'banking_finance' | 'wash' | 'both' | 'international_job_allowed' | 'restricted'; reason: string | null } {
  if (category === 'international_job' || category === 'wash_opportunity') {
    return { passed: true, domain: 'international_job_allowed', reason: null };
  }

  const text = `${input.title || ''} ${input.summary || ''} ${input.organization || ''}`;
  const detected = detectSectorsFromText(text);
  const isBanking =
    Boolean(input.isBankingFinance) ||
    Boolean(input.sectors?.includes('banking_finance')) ||
    detected.isBankingFinance;
  const isWash =
    Boolean(input.isWashDedicated) ||
    Boolean(input.sectors?.includes('wash')) ||
    detected.isWash;

  if (isBanking && isWash) return { passed: true, domain: 'both', reason: null };
  if (isBanking) return { passed: true, domain: 'banking_finance', reason: null };
  if (isWash) return { passed: true, domain: 'wash', reason: null };

  const label =
    category === 'university_scholarship'
      ? 'Scholarship'
      : category === 'professional_training'
      ? 'Professional Training'
      : 'Conference / Summit';

  return {
    passed: false,
    domain: 'restricted',
    reason: `Rejected (Professional Restriction): ${label} is outside the permitted Banking & Finance and WASH professional domains.`,
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
  funding: Pick<OpportunityFundingRecord, 'fundingLevel' | 'visaSupportType' | 'visaSupportSummary'> &
    Partial<Pick<OpportunityFundingRecord, 'evidenceExcerpt' | 'employmentVisaClassification' | 'relocationAssistance'>>;
  eligibility: Pick<OpportunityEligibilityRecord, 'ethiopianEligible'>;
  category: GlobalOpportunityCategory;
  title?: string;
  summary?: string;
  organization?: string;
  sectors?: SectorTag[];
  isBankingFinance?: boolean;
  isWashDedicated?: boolean;
  officialSourceText?: string;
  strictVisaOnly?: boolean;
}): {
  verificationStatus: GlobalVerificationStatus;
  verificationTier: CanonicalVerificationTier;
  hasVerifiedBadge: boolean;
  isPubliclyDisplayable: boolean;
  visaCompliancePassed: boolean;
  professionalRestrictionPassed: boolean;
  rejectionCategory: 'visa' | 'professional_restriction' | 'deadline' | 'broken_link' | 'withdrawn' | 'eligibility' | 'authenticity' | null;
  rejectionReason: string | null;
} {
  const { urlVerified, organizationAuthentic, applicationStatus, deadlineEval, funding, eligibility, category } = params;

  const visaCheck = evaluateMandatoryVisaCompliance(category, funding, params.officialSourceText);
  const profCheck = evaluateProfessionalRestrictionCompliance(category, {
    title: params.title,
    summary: params.summary,
    organization: params.organization,
    sectors: params.sectors,
    isBankingFinance: params.isBankingFinance,
    isWashDedicated: params.isWashDedicated,
  });

  // Also ensure global job departments focus on Banking & Finance OR WASH
  const isBankingOrWashJob =
    category === 'wash_opportunity' ||
    Boolean(params.isBankingFinance) ||
    Boolean(params.isWashDedicated) ||
    Boolean(params.sectors?.includes('banking_finance')) ||
    Boolean(params.sectors?.includes('wash')) ||
    detectSectorsFromText(`${params.title || ''} ${params.summary || ''} ${params.organization || ''}`).isBankingFinance ||
    detectSectorsFromText(`${params.title || ''} ${params.summary || ''} ${params.organization || ''}`).isWash;

  if (
    applicationStatus === 'expired' ||
    applicationStatus === 'closed' ||
    applicationStatus === 'withdrawn' ||
    deadlineEval.isExpired
  ) {
    return {
      verificationStatus: 'Expired',
      verificationTier: 'EXPIRED',
      hasVerifiedBadge: false,
      isPubliclyDisplayable: false,
      visaCompliancePassed: visaCheck.passed,
      professionalRestrictionPassed: profCheck.passed,
      rejectionCategory: applicationStatus === 'withdrawn' || applicationStatus === 'closed' ? 'withdrawn' : 'deadline',
      rejectionReason: deadlineEval.rejectionReason || `Opportunity is ${applicationStatus}.`,
    };
  }

  if (!urlVerified || !organizationAuthentic) {
    return {
      verificationStatus: 'Unverified',
      verificationTier: !organizationAuthentic ? 'REJECTED / POTENTIAL SCAM' : 'PENDING VERIFICATION',
      hasVerifiedBadge: false,
      isPubliclyDisplayable: false,
      visaCompliancePassed: visaCheck.passed,
      professionalRestrictionPassed: profCheck.passed,
      rejectionCategory: !organizationAuthentic ? 'authenticity' : 'broken_link',
      rejectionReason: !organizationAuthentic
        ? 'Rejected: Unofficial domain or organization authenticity could not be verified.'
        : 'Pending verification: Official application URL could not be verified live.',
    };
  }

  if (!deadlineEval.valid || !deadlineEval.meetsMinimumThreeFullDays) {
    return {
      verificationStatus: 'Expired',
      verificationTier: 'EXPIRED',
      hasVerifiedBadge: false,
      isPubliclyDisplayable: false,
      visaCompliancePassed: visaCheck.passed,
      professionalRestrictionPassed: profCheck.passed,
      rejectionCategory: 'deadline',
      rejectionReason: deadlineEval.rejectionReason || 'Opportunity has fewer than 3 full days remaining.',
    };
  }

  if (
    eligibility.ethiopianEligible === 'excluded' ||
    funding.employmentVisaClassification === 'not_eligible_international' ||
    funding.visaSupportType === 'none'
  ) {
    return {
      verificationStatus: 'Unverified',
      verificationTier: 'REJECTED / POTENTIAL SCAM',
      hasVerifiedBadge: false,
      isPubliclyDisplayable: false,
      visaCompliancePassed: false,
      professionalRestrictionPassed: profCheck.passed,
      rejectionCategory: 'eligibility',
      rejectionReason:
        'Excluded: Not eligible for international/Ethiopian applicants or explicitly states no visa sponsorship.',
    };
  }

  // Enforce Banking & Finance / WASH professional scope
  if (!profCheck.passed) {
    return {
      verificationStatus: 'Unverified',
      verificationTier: 'REJECTED / POTENTIAL SCAM',
      hasVerifiedBadge: false,
      isPubliclyDisplayable: false,
      visaCompliancePassed: visaCheck.passed,
      professionalRestrictionPassed: false,
      rejectionCategory: 'professional_restriction',
      rejectionReason: profCheck.reason,
    };
  }

  if ((category === 'international_job' || category === 'wash_opportunity') && !isBankingOrWashJob) {
    return {
      verificationStatus: 'Unverified',
      verificationTier: 'REJECTED / POTENTIAL SCAM',
      hasVerifiedBadge: false,
      isPubliclyDisplayable: false,
      visaCompliancePassed: visaCheck.passed,
      professionalRestrictionPassed: false,
      rejectionCategory: 'professional_restriction',
      rejectionReason:
        'Rejected (Department Scope): Global employment discovery is focused exclusively on Banking & Finance and WASH.',
    };
  }

  // If caller explicitly requires strict visa-only pass (or visa was explicitly invitation-letter/visa-free/assistance-only when strictVisaOnly is requested)
  if (params.strictVisaOnly && !visaCheck.passed) {
    return {
      verificationStatus: 'Unverified',
      verificationTier: 'REJECTED / POTENTIAL SCAM',
      hasVerifiedBadge: false,
      isPubliclyDisplayable: false,
      visaCompliancePassed: false,
      professionalRestrictionPassed: true,
      rejectionCategory: 'visa',
      rejectionReason: visaCheck.reason,
    };
  }

  // Transparent distinction between VERIFIED vs PARTIALLY VERIFIED
  const empVisaClass =
    funding.employmentVisaClassification ||
    classifyEmploymentVisaStatus({
      visaSummary: funding.visaSupportSummary,
      fullText: params.officialSourceText,
      visaSupportType: funding.visaSupportType,
      relocationAssistance: funding.relocationAssistance,
      ethiopianEligible: eligibility.ethiopianEligible,
    }).classification;

  const isEmployment = category === 'international_job' || category === 'wash_opportunity';

  const hasStrongVerificationEvidence = isEmployment
    ? empVisaClass === 'confirmed_visa_sponsorship' ||
      empVisaClass === 'confirmed_international_recruitment' ||
      empVisaClass === 'relocation_assistance' ||
      empVisaClass === 'work_permit_assistance'
    : visaCheck.passed ||
      funding.fundingLevel === 'fully_funded' ||
      funding.fundingLevel === 'partially_funded' ||
      funding.fundingLevel === 'free';

  const verificationTier: CanonicalVerificationTier = hasStrongVerificationEvidence
    ? 'VERIFIED'
    : 'PARTIALLY VERIFIED';

  // Determine exact display status without EVER exaggerating visa sponsorship or full funding
  let verificationStatus: GlobalVerificationStatus = 'Verified and Open';

  if (deadlineEval.isClosingSoon) {
    verificationStatus = 'Closing Soon';
  } else if (funding.visaSupportType === 'employer_sponsored_visa' && empVisaClass === 'confirmed_visa_sponsorship') {
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
    verificationTier,
    hasVerifiedBadge: true,
    isPubliclyDisplayable: true,
    visaCompliancePassed: visaCheck.passed,
    professionalRestrictionPassed: true,
    rejectionCategory: null,
    rejectionReason: null,
  };
}

/**
 * Checks whether an opportunity is eligible for active display on the website right now.
 * Enforces verified official source, non-archived status, Banking & WASH scope,
 * international eligibility, and the >= 3 full days deadline gate.
 */
export function isOpportunityActiveAndDisplayable(
  opp: GlobalOpportunity,
  nowMs: number = Date.now()
): boolean {
  if (!opp.hasVerifiedBadge) return false;
  if (opp.isArchived === true) return false;
  if (
    opp.verificationTier === 'EXPIRED' ||
    opp.verificationTier === 'REJECTED / POTENTIAL SCAM' ||
    opp.verificationTier === 'PENDING VERIFICATION'
  ) {
    return false;
  }
  if (
    opp.applicationStatus === 'closed' ||
    opp.applicationStatus === 'expired' ||
    opp.applicationStatus === 'withdrawn' ||
    opp.applicationStatus === 'rejected' ||
    opp.applicationStatus === 'unverified'
  ) {
    return false;
  }
  if (opp.verificationStatus === 'Expired' || opp.verificationStatus === 'Unverified') {
    return false;
  }
  if (
    opp.eligibility.ethiopianEligible === 'excluded' ||
    opp.funding.employmentVisaClassification === 'not_eligible_international' ||
    opp.funding.visaSupportType === 'none'
  ) {
    return false;
  }
  // Enforce Banking & WASH scope across the 5 global opportunity departments
  const profCheck = evaluateProfessionalRestrictionCompliance(opp.category, opp);
  if (!profCheck.passed) {
    return false;
  }
  const isBankingOrWash =
    opp.isBankingFinance ||
    opp.isWashDedicated ||
    opp.sectors.includes('banking_finance') ||
    opp.sectors.includes('wash');
  if (!isBankingOrWash) {
    return false;
  }
  const deadlineCheck = evaluateOpportunityDeadline(
    opp.deadline.deadlineUtcIso || opp.deadline.deadlineDateRaw,
    opp.deadline.deadlineTimezone,
    nowMs
  );
  return deadlineCheck.valid && !deadlineCheck.isExpired && deadlineCheck.meetsMinimumThreeFullDays;
}

/**
 * Separate, honest eligibility assessment for Permanent Residency & Labour Shortage pathways.
 * NEVER claims guaranteed qualification or that a labour shortage automatically grants PR.
 */
export function evaluatePermanentResidencyEligibility(
  pathway: PermanentResidencyCountryRecord,
  profile: JobSeekerProfile | null | undefined
): PermanentResidencyAssessmentResult {
  const disclaimer =
    'Official Verification Notice: This assessment checks general alignment only. A labour shortage occupation does NOT automatically grant permanent residency. Final eligibility must be confirmed directly on the official government immigration portal.';

  if (!profile) {
    return {
      pathwayId: pathway.id,
      country: pathway.country,
      programName: pathway.programName,
      pathwayClassification: pathway.pathwayClassification,
      readinessStatus: 'Partial Fit — Additional Requirements Needed',
      matchedCriteria: ['Open to eligible foreign skilled applicants subject to official points/sponsorship rules.'],
      missingOrUnverifiedCriteria: [
        'Sign in and complete your education, occupation, years of experience, and language details for a personalized pathway check.',
      ],
      disclaimer,
    };
  }

  const matchedCriteria: string[] = [];
  const missingOrUnverifiedCriteria: string[] = [];

  // 1. Occupation alignment (Banking/Finance, WASH/Water, Engineering, Healthcare, IT, Construction, Trades, etc.)
  const profileCorpus = [
    profile.desiredJobTitle,
    profile.currentPosition,
    profile.preferredIndustry,
    profile.customProfessionOrCategory,
    ...(profile.skills || []),
    ...(profile.areasOfExpertise || []),
    ...(profile.education || []).map((e) => `${e.qualification} ${e.fieldOfStudy}`),
    ...(profile.experience || []).map((x) => `${x.jobTitle} ${x.responsibilities}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const allPathwayOccupations = [
    ...pathway.bankingFinanceOccupations,
    ...pathway.washWaterOccupations,
    ...pathway.professionalOccupationsInDemand,
    ...pathway.labourOccupationsInDemand,
  ];

  const matchedOccupations = allPathwayOccupations.filter((occ) => {
    const tokens = occ
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !['officer', 'worker', 'manager', 'specialist', 'services'].includes(t));
    return tokens.some((t) => profileCorpus.includes(t));
  });

  if (matchedOccupations.length > 0) {
    matchedCriteria.push(
      `Occupation aligns with listed demand areas: ${matchedOccupations.slice(0, 3).join(', ')}.`
    );
  } else {
    missingOrUnverifiedCriteria.push(
      `Your profile occupation does not yet clearly match listed occupations on ${pathway.country}'s official shortage list.`
    );
  }

  // 2. Education check
  const eduText = (profile.education || [])
    .map((e) => `${e.qualification} ${e.fieldOfStudy}`)
    .join(' ')
    .toLowerCase();
  const hasDegree = /\b(bachelor|bsc|ba|master|msc|mba|phd|doctorate|degree)\b/i.test(eduText);
  const hasDiplomaOrTrade = /\b(diploma|tvet|certificate|trade|vocational|associate)\b/i.test(eduText);
  if (hasDegree) {
    matchedCriteria.push('University degree documented (verify formal credential assessment with official authority).');
  } else if (hasDiplomaOrTrade && pathway.labourOccupationsInDemand.length > 0) {
    matchedCriteria.push('Vocational/diploma qualification documented (check specific skilled-trade/labour stream criteria).');
  } else {
    missingOrUnverifiedCriteria.push(`Education requirement must be verified: ${pathway.educationRequirement}`);
  }

  // 3. Experience check
  const yearsMatch = String(profile.yearsOfExperience || '').match(/\d+/);
  const yearsExp = yearsMatch ? parseInt(yearsMatch[0], 10) : 0;
  if (yearsExp >= 2) {
    matchedCriteria.push(`${yearsExp}+ years of work experience listed.`);
  } else {
    missingOrUnverifiedCriteria.push(`Experience requirement must be verified: ${pathway.experienceRequirement}`);
  }

  // 4. Mandatory official government prerequisites always flagged honestly
  missingOrUnverifiedCriteria.push(`Official language test required: ${pathway.languageRequirement}`);
  if (pathway.skillsAssessmentRequired && !/^not\s+required$/i.test(pathway.skillsAssessmentRequired)) {
    missingOrUnverifiedCriteria.push(`Skills/credential assessment: ${pathway.skillsAssessmentRequired}`);
  }
  if (pathway.pathwayClassification !== 'direct_pr') {
    missingOrUnverifiedCriteria.push(
      `Employer job offer / sponsorship check: ${pathway.employerSponsorshipOptions}`
    );
  }

  const readinessStatus: PermanentResidencyAssessmentResult['readinessStatus'] =
    matchedOccupations.length > 0 && (hasDegree || hasDiplomaOrTrade) && yearsExp >= 2
      ? 'Potentially Eligible — Verify Official Criteria'
      : matchedCriteria.length >= 2
      ? 'Partial Fit — Additional Requirements Needed'
      : 'Not Currently Matched';

  return {
    pathwayId: pathway.id,
    country: pathway.country,
    programName: pathway.programName,
    pathwayClassification: pathway.pathwayClassification,
    readinessStatus,
    matchedCriteria,
    missingOrUnverifiedCriteria,
    disclaimer,
  };
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

  // Gate 5: STRICT PROFESSIONAL SECTOR MATCHING
  // Never recommend Banking & Finance programs to non-Banking professionals,
  // and never recommend WASH programs to non-WASH professionals.
  const isRestrictedCategory =
    opportunity.category === 'university_scholarship' ||
    opportunity.category === 'professional_training' ||
    opportunity.category === 'conference_summit';

  const oppIsBankingOnly =
    (opportunity.isBankingFinance || opportunity.sectors.includes('banking_finance')) &&
    !(opportunity.isWashDedicated || opportunity.sectors.includes('wash'));
  const oppIsWashOnly =
    (opportunity.isWashDedicated || opportunity.sectors.includes('wash')) &&
    !(opportunity.isBankingFinance || opportunity.sectors.includes('banking_finance'));

  if (isRestrictedCategory) {
    if (oppIsBankingOnly && !profileDetected.isBankingFinance) {
      disqualificationReasons.push(
        'Strict professional match: Banking & Finance scholarships, trainings, and conferences are only recommended to users with verified Banking, Finance, Accounting, Economics, Microfinance, or FinTech qualifications/experience.'
      );
    } else if (oppIsWashOnly && !profileDetected.isWash) {
      disqualificationReasons.push(
        'Strict professional match: WASH scholarships, trainings, and conferences are only recommended to users with verified Water, Sanitation, Hygiene, Water Engineering, or Environmental Health qualifications/experience.'
      );
    } else if (!profileDetected.isBankingFinance && !profileDetected.isWash) {
      disqualificationReasons.push(
        'Strict professional match: Your profile does not list Banking/Finance or WASH qualifications or experience required for this program.'
      );
    }
  } else {
    // For International Jobs, also prevent recommending completely unrelated professions
    const hasSectorOverlap = opportunity.sectors.some((s) => profileDetected.sectors.includes(s));
    const oppTitleKeywords = extractMeaningfulKeywords(`${opportunity.title} ${opportunity.eligibility.requiredSkills.join(' ')}`);
    const userKeywords = new Set(extractMeaningfulKeywords(profileCorpus));
    const directSkillMatchCount = oppTitleKeywords.filter((kw) => userKeywords.has(kw)).length;
    if (!hasSectorOverlap && directSkillMatchCount < 2) {
      disqualificationReasons.push(
        'Strict professional match: Role sector, occupation, and required skills do not match your professional profile.'
      );
    }
  }

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

  // Skill, Certification & Keyword overlap
  const oppText = `${opportunity.title} ${opportunity.summary} ${opportunity.eligibility.requiredSkills.join(' ')} ${opportunity.organization}`;
  const oppKeywords = extractMeaningfulKeywords(oppText);
  const profileKeywords = new Set(extractMeaningfulKeywords(profileCorpus));
  const overlappingKeywords = oppKeywords.filter((kw) => profileKeywords.has(kw));
  if (overlappingKeywords.length > 0) {
    score += Math.min(25, overlappingKeywords.length * 5);
    matchReasons.push(`Matches skills & qualifications: ${overlappingKeywords.slice(0, 4).join(', ')}`);
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
  }
  if (opportunity.funding.visaSupportType === 'employer_sponsored_visa') {
    score += 8;
    matchReasons.push('Employer-sponsored work visa officially confirmed');
  } else if (opportunity.funding.visaSupportType === 'visa_fees_funded') {
    score += 8;
    matchReasons.push('Official visa application fee coverage confirmed');
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
  const eligible = disqualificationReasons.length === 0 && boundedScore >= 30;

  const eligibilitySummary =
    disqualificationReasons.length > 0
      ? `Not eligible: ${disqualificationReasons[0]}`
      : eligible
      ? 'Meets verified visa, sector, and eligibility criteria for your profile'
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
