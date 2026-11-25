import {
  GlobalOpportunity,
  PermanentResidencyCountryRecord,
} from '../types/globalOpportunities';

export type SevenTierVisaCategory =
  | 'explicit_employer_visa_sponsorship'
  | 'employer_sponsored_work_permit'
  | 'employer_supported_relocation'
  | 'foreign_applicants_accepted'
  | 'international_accepted_sponsorship_unclear'
  | 'local_applicants_only'
  | 'no_sponsorship_info';

export const SEVEN_TIER_VISA_LABELS: Record<SevenTierVisaCategory, string> = {
  explicit_employer_visa_sponsorship: 'Explicit employer visa sponsorship',
  employer_sponsored_work_permit: 'Employer-sponsored work permit',
  employer_supported_relocation: 'Employer-supported relocation',
  foreign_applicants_accepted: 'Foreign applicants explicitly accepted',
  international_accepted_sponsorship_unclear: 'International applicants accepted — Sponsorship not confirmed',
  local_applicants_only: 'Local applicants only',
  no_sponsorship_info: 'Sponsorship not confirmed',
};

export type CareerSpecialtyCategory =
  | 'banking_financial_services'
  | 'finance_accounting'
  | 'risk_compliance'
  | 'credit_microfinance'
  | 'international_ngo_development'
  | 'insurance'
  | 'fintech_digital_finance'
  | 'corporate_operations_management'
  | 'wash_engineering_health'
  | 'general_international';

export const CAREER_SPECIALTY_LABELS: Record<CareerSpecialtyCategory, string> = {
  banking_financial_services: 'Banking & Financial Services',
  finance_accounting: 'Finance & Accounting',
  risk_compliance: 'Risk & Compliance',
  credit_microfinance: 'Credit & Microfinance',
  international_ngo_development: 'International NGOs & Development',
  insurance: 'Insurance',
  fintech_digital_finance: 'Fintech & Digital Financial Services',
  corporate_operations_management: 'Corporate Operations & Management',
  wash_engineering_health: 'WASH & Water Engineering',
  general_international: 'International Skilled Roles',
};

export type InternationalRegionGroup =
  | 'Europe'
  | 'Middle East'
  | 'Asia-Pacific'
  | 'Africa & Other'
  | 'North America'
  | 'Global / Multi-Country';

export interface SalaryBreakdownUsd {
  hasAdvertisedSalary: boolean;
  originalText: string | null;
  currency: string | null;
  estimatedMonthlyUsd: number | null;
  estimatedAnnualUsd: number | null;
  grossOrNet: 'gross' | 'net' | 'not_specified';
  housingAllowance: 'yes' | 'not_confirmed';
  transportationAllowance: 'yes' | 'not_confirmed';
  medicalInsurance: 'yes' | 'not_confirmed';
  relocationAssistance: 'yes' | 'not_confirmed';
  benefitsSummary: string[];
  meetsTargetMinimum: boolean | null;
  isExceptionalPathwayBelowTarget: boolean;
}

export interface VisaVerificationChecklist {
  category: SevenTierVisaCategory;
  displayLabel: string;
  isPriorityTier: boolean; // Categories 1-4
  sponsorshipConfirmed: boolean;
  outsideCountryAllowed: 'yes' | 'no' | 'not_confirmed';
  ethiopianEligible: 'yes' | 'no' | 'not_confirmed';
  employerSponsorsWorkPermit: 'yes' | 'no' | 'not_confirmed';
  relocationAssistanceProvided: 'yes' | 'no' | 'not_confirmed';
  existingWorkPermitRequired: 'yes' | 'no' | 'not_confirmed';
  englishSufficient: 'yes' | 'no' | 'not_confirmed';
  localLanguageMandatory: 'yes' | 'no' | 'not_confirmed';
  familyReunificationPossible: 'yes' | 'no' | 'not_confirmed';
  legitimateContractConfirmed: 'yes' | 'not_confirmed';
}

export interface CareerApplicantProfile {
  profileName: string;
  nationality: string;
  currentResidence: string;
  educationDegree: string;
  educationField: string;
  institution: string;
  totalYearsExperience: number;
  bankingYearsExperience: number;
  managementYearsExperience: number;
  currentPosition: string;
  languages: string[];
  englishOnly: boolean;
  minimumMonthlySalaryUsd: number;
  preferredSalaryRangeUsd: string;
  willingRelocateAloneFirst: boolean;
  familyReunificationImportant: boolean;
  needsEmployerSponsorship: boolean;
  seeksPermanentResidencyPathway: boolean;
  skillsAndResponsibilities: string[];
  preferredRegions: InternationalRegionGroup[];
  extractedFromCv?: boolean;
  cvEvidenceSnippets?: string[];
}

export interface WeightedMatchBreakdown {
  educationScore: number; // max 15
  experienceScore: number; // max 20
  responsibilityScore: number; // max 20
  visaEligibilityScore: number; // max 20
  salaryScore: number; // max 10
  languageScore: number; // max 10
  relocationFamilyScore: number; // max 5
}

export interface WeightedCareerMatchResult {
  totalScore: number; // 0..100
  band: 'Excellent match' | 'Strong match' | 'Possible match' | 'Low match';
  workAuthorizationEligible: boolean;
  cappedDueToWorkAuth: boolean;
  breakdown: WeightedMatchBreakdown;
  matchReasons: string[];
  gapOrMismatchReasons: string[];
  salaryInfo: SalaryBreakdownUsd;
  visaChecklist: VisaVerificationChecklist;
  careerSpecialty: CareerSpecialtyCategory;
  regionGroup: InternationalRegionGroup;
}

/**
 * Primary Test Benchmark Profile (Section 2).
 * Used as an optional one-click benchmark preset — never restricts other applicants.
 */
export const PRIMARY_BENCHMARK_PROFILE: CareerApplicantProfile = {
  profileName: 'Ethiopian Banking & Branch Manager Profile (Benchmark)',
  nationality: 'Ethiopian',
  currentResidence: 'Ethiopia',
  educationDegree: 'BA',
  educationField: 'Accounting and Finance',
  institution: 'Mekelle University',
  totalYearsExperience: 9,
  bankingYearsExperience: 9,
  managementYearsExperience: 3,
  currentPosition: 'Branch Manager',
  languages: ['English'],
  englishOnly: true,
  minimumMonthlySalaryUsd: 3000,
  preferredSalaryRangeUsd: 'USD 3,500–6,000+ / month',
  willingRelocateAloneFirst: true,
  familyReunificationImportant: true,
  needsEmployerSponsorship: true,
  seeksPermanentResidencyPathway: true,
  skillsAndResponsibilities: [
    'Banking operations management',
    'Branch management',
    'Financial management',
    'Accounting and financial reporting',
    'Deposit mobilization',
    'Customer relationship management',
    'Business development',
    'Credit administration',
    'Risk management',
    'Internal controls',
    'Staff supervision',
    'Banking compliance',
    'Digital banking operations',
    'Microfinance and financial inclusion',
  ],
  preferredRegions: ['Europe', 'Middle East', 'Asia-Pacific', 'Africa & Other', 'North America'],
};

// =========================================================================
// REGION & COUNTRY DETECTION (SECTION 4)
// =========================================================================

const EUROPE_COUNTRIES_RX =
  /\b(germany|ireland|netherlands|holland|luxembourg|poland|lithuania|latvia|estonia|romania|croatia|czech republic|czechia|slovakia|slovenia|hungary|bulgaria|sweden|norway|denmark|finland|iceland|belgium|france|spain|portugal|italy|greece|austria|switzerland|united kingdom|\buk\b|england|scotland|cyprus|malta|europe|european union|\beu\b|geneva|zurich|berlin|dublin|amsterdam|london|frankfurt|stockholm|oslo|copenhagen|helsinki|vienna|brussels|paris|madrid|lisbon|warsaw|prague|budapest|bucharest|tallinn|vilnius|riga)\b/i;

const MIDDLE_EAST_COUNTRIES_RX =
  /\b(united arab emirates|\buae\b|dubai|abu dhabi|sharjah|saudi arabia|\bksa\b|riyadh|jeddah|qatar|doha|bahrain|manama|oman|muscat|kuwait|middle east|gcc|gulf)\b/i;

const ASIA_PACIFIC_COUNTRIES_RX =
  /\b(singapore|malaysia|kuala lumpur|japan|tokyo|australia|sydney|melbourne|new zealand|auckland|wellington|asia[\s-]pacific)\b/i;

const NORTH_AMERICA_COUNTRIES_RX =
  /\b(canada|toronto|vancouver|montreal|ottawa|united states|\busa\b|new york|washington|san francisco|north america)\b/i;

const AFRICA_OTHER_RX =
  /\b(mauritius|port louis|south africa|johannesburg|cape town|turkey|türkiye|istanbul|ankara|kenya|nairobi|rwanda|kigali|morocco|egypt|cairo)\b/i;

export function detectInternationalRegion(country: string, location?: string): InternationalRegionGroup {
  const combined = `${country || ''} ${location || ''}`;
  if (EUROPE_COUNTRIES_RX.test(combined)) return 'Europe';
  if (MIDDLE_EAST_COUNTRIES_RX.test(combined)) return 'Middle East';
  if (ASIA_PACIFIC_COUNTRIES_RX.test(combined)) return 'Asia-Pacific';
  if (NORTH_AMERICA_COUNTRIES_RX.test(combined)) return 'North America';
  if (AFRICA_OTHER_RX.test(combined)) return 'Africa & Other';
  return 'Global / Multi-Country';
}

// =========================================================================
// 8 PROFESSIONAL CAREER CATEGORIES (SECTION 3)
// =========================================================================

export function classifyCareerSpecialtyCategory(
  title: string,
  summary: string,
  organization?: string
): CareerSpecialtyCategory {
  const text = `${title || ''} ${summary || ''} ${organization || ''}`.toLowerCase();

  if (
    /\b(wash\b|water\s+(?:and\s+)?sanitation|hygiene|hydrolog|wastewater|water\s+engineer|environmental\s+health)\b/i.test(
      text
    )
  ) {
    return 'wash_engineering_health';
  }
  if (
    /\b(aml\b|anti[\s-]money\s+laundering|kyc\b|know\s+your\s+customer|compliance\s+(?:officer|manager|specialist|head)|operational\s+risk|credit\s+risk|internal\s+control|internal\s+audit|fraud\s+prevention|financial\s+crime)\b/i.test(
      text
    )
  ) {
    return 'risk_compliance';
  }
  if (
    /\b(fintech|digital\s+banking|mobile\s+money|payment\s+operations|merchant\s+acquisition|agent\s+banking|digital\s+financial\s+services)\b/i.test(
      text
    )
  ) {
    return 'fintech_digital_finance';
  }
  if (
    /\b(microfinance|credit\s+manager|credit\s+operations|loan\s+portfolio|lending\s+operations|sme\s+finance|credit\s+administration|loan\s+recovery|portfolio\s+quality|financial\s+inclusion)\b/i.test(
      text
    )
  ) {
    return 'credit_microfinance';
  }
  if (
    /\b(insurance\s+(?:operations|branch|relationship)|claims\s+manager|underwriting\s+officer|actuary|reinsurance)\b/i.test(
      text
    )
  ) {
    return 'insurance';
  }
  if (
    /\b(grants?\s+finance|project\s+finance|partnership\s+finance|unicef|undp|unhcr|who\b|wfp\b|iom\b|ifrc|red\s+cross|oxfam|save\s+the\s+children|world\s+vision|nrc\b|irc\b|ngo|humanitarian|donor\s+compliance)\b/i.test(
      text
    )
  ) {
    return 'international_ngo_development';
  }
  if (
    /\b(branch\s+manager|banking\s+operations|regional\s+banking|retail\s+banking|relationship\s+manager|sme\s+banking|corporate\s+banking|deposit\s+mobilization|commercial\s+banking|financial\s+services\s+manager)\b/i.test(
      text
    )
  ) {
    return 'banking_financial_services';
  }
  if (
    /\b(finance\s+manager|finance\s+and\s+administration|financial\s+controller|senior\s+accountant|financial\s+analyst|fp&a|financial\s+planning|management\s+accountant|treasury|financial\s+reporting|budget\s+and\s+reporting|chartered\s+accountant|auditor|accounting)\b/i.test(
      text
    )
  ) {
    return 'finance_accounting';
  }
  if (
    /\b(business\s+operations|administration\s+manager|regional\s+operations|business\s+development\s+manager|procurement\s+and\s+finance|commercial\s+operations|revenue\s+assurance|customer\s+experience\s+manager|operations\s+manager|operations\s+coordinator)\b/i.test(
      text
    )
  ) {
    return 'corporate_operations_management';
  }
  return 'general_international';
}

// =========================================================================
// 7-TIER VISA SPONSORSHIP & RELOCATION VERIFICATION (SECTION 5)
// =========================================================================

export function classifySevenTierVisaSponsorship(opp: GlobalOpportunity): VisaVerificationChecklist {
  const text = [
    opp.title,
    opp.summary,
    opp.funding?.visaSupportSummary,
    opp.funding?.fundingSummary,
    opp.funding?.evidenceExcerpt,
    opp.sourceEvidenceSnippet,
    opp.verificationNotes,
    (opp.eligibility?.languagesRequired || []).join(' '),
    (opp.eligibility?.eligibleNationalities || []).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const localOnlyRx =
    /\b(local\s+applicants?\s+only|local\s+nationals?\s+only|citizens?\s+or\s+permanent\s+residents?\s+only|must\s+(?:already\s+)?(?:hold|have|possess)\s+(?:the\s+)?(?:legal\s+)?right\s+to\s+work|existing\s+work\s+permit\s+required|no\s+visa\s+sponsorship|cannot\s+sponsor|does\s+not\s+sponsor|will\s+not\s+sponsor|eu\s+citizens?\s+only|national\s+position\s+only)\b/i;

  const explicitVisaSponsorshipRx =
    /\b(explicit(?:ly)?\s+(?:confirm\w*\s+)?visa\s+sponsorship|employer[\s-]sponsored\s+(?:work\s+)?visa|visa\s+sponsorship\s+(?:provided|offered|available|confirmed|included)|we\s+sponsor\s+(?:work\s+)?visas?|skilled\s+worker\s+visa\s+sponsorship|tier\s*2\s+sponsorship|eu\s+blue\s+card\s+sponsorship)\b/i;

  const employerWorkPermitRx =
    /\b(employer[\s-]sponsored\s+work\s+permit|work\s+permit\s+sponsorship|sponsor\w*\s+(?:your\s+)?work\s+permit|critical\s+skills\s+employment\s+permit|recognised\s+sponsor|work\s+permit\s+(?:provided|arranged|supported|assistance))\b/i;

  const relocationRx =
    /\b(relocation\s+(?:package|assistance|support|allowance|covered|provided)|international\s+relocation|installation\s+grant|settling[\s-]in\s+grant)\b/i;

  const foreignAcceptedRx =
    /\b(foreign\s+applicants?\s+(?:welcome|accepted|eligible)|international\s+(?:applicants?|candidates?|staff|recruitment|professionals?)\s+(?:welcome|accepted|eligible|encouraged)|open\s+to\s+all\s+nationalities|applicants?\s+outside\s+(?:the\s+)?country|worldwide\s+applicants?|p-?[1-5]\s+(?:post|level|grade))\b/i;

  const localLangMandatoryRx =
    /\b((?:fluent|native|proficient|mandatory|required|c1|c2|b2)\s+(?:in\s+)?(?:german|french|dutch|arabic|swedish|norwegian|danish|finnish|spanish|italian|portuguese|polish|japanese)|(?:german|french|dutch|arabic|swedish|norwegian|danish|finnish)\s+(?:is\s+)?(?:mandatory|required|essential))\b/i;

  const englishAcceptedRx =
    /\b(english\s+(?:is\s+the\s+working\s+language|only|required|fluent|proficient|working\s+language)|working\s+language\s*:?\s*english|international\s+english[\s-]speaking)\b/i;

  const isLocalOnly = opp.eligibility?.ethiopianEligible === 'excluded' || localOnlyRx.test(text);

  let category: SevenTierVisaCategory = 'no_sponsorship_info';
  if (isLocalOnly || opp.funding?.visaSupportType === 'none') {
    category = 'local_applicants_only';
  } else if (
    opp.funding?.visaSupportType === 'employer_sponsored_visa' ||
    opp.funding?.employmentVisaClassification === 'confirmed_visa_sponsorship' ||
    explicitVisaSponsorshipRx.test(text)
  ) {
    category = 'explicit_employer_visa_sponsorship';
  } else if (
    opp.funding?.employmentVisaClassification === 'work_permit_assistance' ||
    employerWorkPermitRx.test(text)
  ) {
    category = 'employer_sponsored_work_permit';
  } else if (
    opp.funding?.relocationAssistance === 'yes' ||
    opp.funding?.employmentVisaClassification === 'relocation_assistance' ||
    relocationRx.test(text)
  ) {
    category = 'employer_supported_relocation';
  } else if (
    opp.funding?.employmentVisaClassification === 'confirmed_international_recruitment' ||
    foreignAcceptedRx.test(text) ||
    opp.eligibility?.ethiopianEligible === 'confirmed'
  ) {
    category = 'foreign_applicants_accepted';
  } else if (opp.eligibility?.ethiopianEligible === 'likely_global') {
    category = 'international_accepted_sponsorship_unclear';
  } else {
    category = 'no_sponsorship_info';
  }

  const sponsorshipConfirmed =
    category === 'explicit_employer_visa_sponsorship' || category === 'employer_sponsored_work_permit';
  const isPriorityTier =
    category === 'explicit_employer_visa_sponsorship' ||
    category === 'employer_sponsored_work_permit' ||
    category === 'employer_supported_relocation' ||
    category === 'foreign_applicants_accepted';

  const localLanguageMandatory: 'yes' | 'no' | 'not_confirmed' = localLangMandatoryRx.test(text)
    ? 'yes'
    : englishAcceptedRx.test(text) ||
      (opp.eligibility?.languagesRequired || []).some((l) => /^english/i.test(l.trim()))
    ? 'no'
    : 'not_confirmed';

  const englishSufficient: 'yes' | 'no' | 'not_confirmed' =
    localLanguageMandatory === 'yes'
      ? 'no'
      : englishAcceptedRx.test(text) ||
        (opp.eligibility?.languagesRequired || []).some((l) => /english/i.test(l))
      ? 'yes'
      : 'not_confirmed';

  const region = detectInternationalRegion(opp.country, opp.location);
  const familyReunificationPossible: 'yes' | 'no' | 'not_confirmed' =
    category === 'local_applicants_only'
      ? 'no'
      : sponsorshipConfirmed &&
        (region === 'Europe' || region === 'Middle East' || region === 'North America' || region === 'Asia-Pacific')
      ? 'yes'
      : /\b(family\s+(?:reunification|relocation|visa|dependants|dependents|benefits))\b/i.test(text)
      ? 'yes'
      : 'not_confirmed';

  return {
    category,
    displayLabel: SEVEN_TIER_VISA_LABELS[category],
    isPriorityTier,
    sponsorshipConfirmed,
    outsideCountryAllowed: isLocalOnly ? 'no' : isPriorityTier ? 'yes' : 'not_confirmed',
    ethiopianEligible:
      opp.eligibility?.ethiopianEligible === 'excluded' || isLocalOnly
        ? 'no'
        : opp.eligibility?.ethiopianEligible === 'confirmed'
        ? 'yes'
        : 'not_confirmed',
    employerSponsorsWorkPermit: sponsorshipConfirmed ? 'yes' : isLocalOnly ? 'no' : 'not_confirmed',
    relocationAssistanceProvided:
      opp.funding?.relocationAssistance === 'yes' || relocationRx.test(text)
        ? 'yes'
        : opp.funding?.relocationAssistance === 'no'
        ? 'no'
        : 'not_confirmed',
    existingWorkPermitRequired: isLocalOnly ? 'yes' : sponsorshipConfirmed ? 'no' : 'not_confirmed',
    englishSufficient,
    localLanguageMandatory,
    familyReunificationPossible,
    legitimateContractConfirmed:
      opp.organizationAuthentic && opp.hasVerifiedBadge ? 'yes' : 'not_confirmed',
  };
}

// =========================================================================
// USD SALARY NORMALIZATION & BENEFITS EXTRACTION (SECTION 6)
// Never invents missing salary information!
// =========================================================================

const FX_TO_USD: Record<string, number> = {
  USD: 1.0,
  $: 1.0,
  EUR: 1.08,
  '€': 1.08,
  GBP: 1.27,
  '£': 1.27,
  AED: 0.272,
  SAR: 0.266,
  QAR: 0.274,
  KWD: 3.25,
  BHD: 2.65,
  OMR: 2.6,
  CHF: 1.13,
  CAD: 0.73,
  AUD: 0.65,
  NZD: 0.6,
  SGD: 0.74,
  SEK: 0.095,
  NOK: 0.093,
  DKK: 0.145,
  PLN: 0.25,
  JPY: 0.0066,
  MYR: 0.225,
  ZAR: 0.055,
  MUR: 0.022,
};

export function parseAndNormalizeSalaryUsd(
  opp: GlobalOpportunity,
  targetMinMonthlyUsd: number = 3000
): SalaryBreakdownUsd {
  const combined = `${opp.funding?.stipendOrSalary || ''} ${opp.funding?.fundingSummary || ''} ${opp.summary || ''}`;
  const benefitsSummary: string[] = [];

  const housingAllowance = /\b(housing\s+allowance|accommodation\s+(?:provided|allowance|covered)|free\s+housing)\b/i.test(
    combined
  )
    ? 'yes'
    : 'not_confirmed';
  const transportationAllowance = /\b(transport(?:ation)?\s+allowance|commuter\s+allowance|company\s+car|travel\s+allowance)\b/i.test(
    combined
  )
    ? 'yes'
    : 'not_confirmed';
  const medicalInsurance =
    opp.funding?.insuranceCovered === 'yes' ||
    /\b(medical\s+insurance|health\s+insurance|comprehensive\s+healthcare|private\s+medical)\b/i.test(combined)
      ? 'yes'
      : 'not_confirmed';
  const relocationAssistance =
    opp.funding?.relocationAssistance === 'yes' ||
    /\b(relocation\s+(?:package|assistance|allowance|support))\b/i.test(combined)
      ? 'yes'
      : 'not_confirmed';

  if (housingAllowance === 'yes') benefitsSummary.push('Housing allowance');
  if (transportationAllowance === 'yes') benefitsSummary.push('Transportation allowance');
  if (medicalInsurance === 'yes') benefitsSummary.push('Medical insurance');
  if (relocationAssistance === 'yes') benefitsSummary.push('Relocation assistance');

  const grossOrNet: SalaryBreakdownUsd['grossOrNet'] = /\b(net|tax[\s-]free|take[\s-]home)\b/i.test(combined)
    ? 'net'
    : /\b(gross|before\s+tax|pre[\s-]tax)\b/i.test(combined)
    ? 'gross'
    : 'not_specified';

  // Extract genuine numeric salary if explicitly advertised — NEVER invent!
  const salaryRx =
    /\b(USD|EUR|GBP|AED|SAR|QAR|KWD|BHD|OMR|CHF|CAD|AUD|NZD|SGD|SEK|NOK|DKK|PLN|JPY|MYR|ZAR|\$|€|£)\s*([\d,]{3,9}(?:k)?)(?:\s*[-–to]+\s*(?:USD|EUR|GBP|AED|SAR|QAR|KWD|BHD|OMR|CHF|CAD|AUD|NZD|SGD|\$|€|£)?\s*([\d,]{3,9}(?:k)?))?\s*(?:per\s+)?(year|yr|annum|annual|annually|p\.a\.|month|mo|monthly|p\.m\.)?/i;

  const match = combined.match(salaryRx);
  if (!match) {
    return {
      hasAdvertisedSalary: false,
      originalText: opp.funding?.stipendOrSalary || null,
      currency: null,
      estimatedMonthlyUsd: null,
      estimatedAnnualUsd: null,
      grossOrNet,
      housingAllowance,
      transportationAllowance,
      medicalInsurance,
      relocationAssistance,
      benefitsSummary,
      meetsTargetMinimum: null,
      isExceptionalPathwayBelowTarget: false,
    };
  }

  const rawCurr = match[1].toUpperCase();
  const rate = FX_TO_USD[rawCurr] ?? 1.0;
  const parseNum = (s?: string): number | null => {
    if (!s) return null;
    const isK = /k$/i.test(s);
    const cleaned = Number(s.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(cleaned) || cleaned <= 0) return null;
    return isK ? cleaned * 1000 : cleaned;
  };

  const n1 = parseNum(match[2]);
  const n2 = parseNum(match[3]);
  if (!n1) {
    return {
      hasAdvertisedSalary: false,
      originalText: opp.funding?.stipendOrSalary || null,
      currency: null,
      estimatedMonthlyUsd: null,
      estimatedAnnualUsd: null,
      grossOrNet,
      housingAllowance,
      transportationAllowance,
      medicalInsurance,
      relocationAssistance,
      benefitsSummary,
      meetsTargetMinimum: null,
      isExceptionalPathwayBelowTarget: false,
    };
  }

  const representative = n2 && n2 > n1 ? (n1 + n2) / 2 : n1;
  const periodToken = (match[4] || '').toLowerCase();
  const usdValue = representative * rate;

  let estimatedMonthlyUsd: number;
  let estimatedAnnualUsd: number;

  if (/month|mo|p\.m/i.test(periodToken)) {
    estimatedMonthlyUsd = Math.round(usdValue);
    estimatedAnnualUsd = Math.round(usdValue * 12);
  } else if (/year|yr|annum|annual|p\.a/i.test(periodToken)) {
    estimatedAnnualUsd = Math.round(usdValue);
    estimatedMonthlyUsd = Math.round(usdValue / 12);
  } else {
    // Heuristic only when explicit salary figure exists without period unit
    if (usdValue >= 18000) {
      estimatedAnnualUsd = Math.round(usdValue);
      estimatedMonthlyUsd = Math.round(usdValue / 12);
    } else {
      estimatedMonthlyUsd = Math.round(usdValue);
      estimatedAnnualUsd = Math.round(usdValue * 12);
    }
  }

  const currencyLabel =
    rawCurr === '$' ? 'USD' : rawCurr === '€' ? 'EUR' : rawCurr === '£' ? 'GBP' : rawCurr;
  const meetsTargetMinimum = estimatedMonthlyUsd >= targetMinMonthlyUsd;
  const isExceptionalPathwayBelowTarget =
    !meetsTargetMinimum &&
    estimatedMonthlyUsd >= Math.round(targetMinMonthlyUsd * 0.65) &&
    (relocationAssistance === 'yes' ||
      housingAllowance === 'yes' ||
      opp.funding?.visaSupportType === 'employer_sponsored_visa');

  return {
    hasAdvertisedSalary: true,
    originalText: match[0].trim(),
    currency: currencyLabel,
    estimatedMonthlyUsd,
    estimatedAnnualUsd,
    grossOrNet,
    housingAllowance,
    transportationAllowance,
    medicalInsurance,
    relocationAssistance,
    benefitsSummary,
    meetsTargetMinimum,
    isExceptionalPathwayBelowTarget,
  };
}

// =========================================================================
// 100-POINT WEIGHTED PERSONALIZED OPPORTUNITY MATCHING ENGINE (SECTION 10)
// Weights: Education 15% | Experience 20% | Responsibilities 20% |
//          Visa/Eligibility 20% | Salary 10% | Language 10% | Relocation/Family 5%
// =========================================================================

const EDU_LEVEL_ORDER: Record<string, number> = {
  none: 0,
  not_confirmed: 0,
  diploma: 1,
  bachelors: 2,
  masters: 3,
  phd: 4,
};

function inferApplicantEducationRank(degreeText: string): number {
  const s = String(degreeText || '').toLowerCase();
  if (/\b(phd|ph\.d|doctorate|doctoral)\b/.test(s)) return 4;
  if (/\b(master|msc|m\.sc|mba|ma\b|m\.a|mph|llm|postgraduate)\b/.test(s)) return 3;
  if (/\b(bachelor|bsc|b\.sc|ba\b|b\.a|bba|beng|degree|undergraduate)\b/.test(s)) return 2;
  if (/\b(diploma|tvet|associate|certificate)\b/.test(s)) return 1;
  return 0;
}

export function evaluateWeightedCareerMatch(
  opp: GlobalOpportunity,
  profile: CareerApplicantProfile
): WeightedCareerMatchResult {
  const visaChecklist = classifySevenTierVisaSponsorship(opp);
  const salaryInfo = parseAndNormalizeSalaryUsd(opp, profile.minimumMonthlySalaryUsd || 3000);
  const careerSpecialty = classifyCareerSpecialtyCategory(opp.title, opp.summary, opp.organization);
  const regionGroup = detectInternationalRegion(opp.country, opp.location);

  const matchReasons: string[] = [];
  const gapOrMismatchReasons: string[] = [];

  const oppCorpus = [
    opp.title,
    opp.organization,
    opp.summary,
    opp.eligibility?.educationRequirement,
    opp.eligibility?.experienceRequirement,
    ...(opp.eligibility?.requiredSkills || []),
    ...(opp.eligibility?.languagesRequired || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // 1. EDUCATION COMPATIBILITY (Max 15 pts)
  let educationScore = 10;
  const userEduRank = inferApplicantEducationRank(`${profile.educationDegree} ${profile.educationField}`);
  const reqEduRank = EDU_LEVEL_ORDER[opp.eligibility?.minimumEducationLevel || 'not_confirmed'] ?? 0;
  const fieldOverlap =
    profile.educationField &&
    profile.educationField
      .toLowerCase()
      .split(/[\s,/&]+/)
      .filter((w) => w.length >= 4)
      .some((w) => oppCorpus.includes(w));

  if (reqEduRank === 0) {
    educationScore = fieldOverlap ? 14 : 11;
    if (fieldOverlap) matchReasons.push(`Education field (${profile.educationField}) aligns with role domain.`);
  } else if (userEduRank >= reqEduRank) {
    educationScore = fieldOverlap ? 15 : 13;
    matchReasons.push(
      `Education meets requirement (${profile.educationDegree} in ${profile.educationField || 'relevant field'}).`
    );
  } else if (userEduRank === reqEduRank - 1 && profile.totalYearsExperience >= 7) {
    educationScore = 9;
    gapOrMismatchReasons.push(
      `Role lists ${opp.eligibility.minimumEducationLevel.toUpperCase()} preferred/required; strong experience (${profile.totalYearsExperience} yrs) may offset if permitted.`
    );
  } else {
    educationScore = 4;
    gapOrMismatchReasons.push(
      `Education gap: opportunity requires ${opp.eligibility.educationRequirement || opp.eligibility.minimumEducationLevel}.`
    );
  }

  // 2. PROFESSIONAL EXPERIENCE COMPATIBILITY (Max 20 pts)
  let experienceScore = 14;
  const minYears = opp.eligibility?.minimumYearsExperience;
  const isManagementRole = /\b(manager|director|head\s+of|lead|supervisor|controller|regional|branch)\b/i.test(
    opp.title
  );
  if (typeof minYears === 'number' && minYears > 0) {
    if (profile.totalYearsExperience >= minYears) {
      experienceScore = isManagementRole && profile.managementYearsExperience >= 2 ? 20 : 18;
      matchReasons.push(
        `Experience exceeds minimum (${profile.totalYearsExperience} yrs total${
          profile.managementYearsExperience > 0 ? `, ${profile.managementYearsExperience} yrs management` : ''
        } vs ${minYears}+ yrs required).`
      );
    } else if (profile.totalYearsExperience >= Math.max(1, minYears - 2)) {
      experienceScore = 11;
      gapOrMismatchReasons.push(
        `Slightly below stated experience (${profile.totalYearsExperience} yrs vs ${minYears}+ yrs required).`
      );
    } else {
      experienceScore = 4;
      gapOrMismatchReasons.push(
        `Experience gap: requires ${minYears}+ years (profile lists ${profile.totalYearsExperience} years).`
      );
    }
  } else if (isManagementRole && profile.managementYearsExperience >= 2) {
    experienceScore = 19;
    matchReasons.push(`Management track record (${profile.managementYearsExperience} yrs as ${profile.currentPosition}) fits senior/managerial scope.`);
  } else if (profile.totalYearsExperience >= 5) {
    experienceScore = 16;
    matchReasons.push(`Strong ${profile.totalYearsExperience}-year professional track record.`);
  }

  // 3. JOB RESPONSIBILITY COMPATIBILITY (Max 20 pts)
  const profileSkillsCorpus = [
    profile.currentPosition,
    profile.educationField,
    ...(profile.skillsAndResponsibilities || []),
  ]
    .join(' ')
    .toLowerCase();

  const stopWords = new Set(['and', 'the', 'for', 'with', 'management', 'officer', 'senior', 'international']);
  const skillTokens = Array.from(
    new Set(
      profileSkillsCorpus
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !stopWords.has(w))
    )
  );
  const matchedTokens = skillTokens.filter((tok) => oppCorpus.includes(tok));
  const isFinanceBankingProfile = /\b(bank|branch|finance|accounting|credit|microfinance|audit|compliance|risk)\b/i.test(
    profileSkillsCorpus
  );
  const isFinanceBankingOpp =
    opp.isBankingFinance ||
    [
      'banking_financial_services',
      'finance_accounting',
      'risk_compliance',
      'credit_microfinance',
      'insurance',
      'fintech_digital_finance',
      'corporate_operations_management',
    ].includes(careerSpecialty);

  let responsibilityScore = 0;
  if (matchedTokens.length >= 5) {
    responsibilityScore = 20;
    matchReasons.push(`High responsibility match: ${matchedTokens.slice(0, 5).join(', ')}.`);
  } else if (matchedTokens.length >= 3) {
    responsibilityScore = 16;
    matchReasons.push(`Relevant responsibility overlap: ${matchedTokens.slice(0, 4).join(', ')}.`);
  } else if (matchedTokens.length >= 1 || (isFinanceBankingProfile && isFinanceBankingOpp)) {
    responsibilityScore = 11;
    matchReasons.push(`Sector alignment (${CAREER_SPECIALTY_LABELS[careerSpecialty]}).`);
  } else {
    responsibilityScore = 3;
    gapOrMismatchReasons.push(
      `Low direct responsibility overlap with ${profile.currentPosition || 'your background'} (${CAREER_SPECIALTY_LABELS[careerSpecialty]}).`
    );
  }

  // 4. VISA SPONSORSHIP & WORK-AUTHORIZATION ELIGIBILITY (Max 20 pts)
  // Rule from Section 10: Do NOT give a high score if applicant is NOT eligible for country's work authorization!
  let visaEligibilityScore = 8;
  let workAuthorizationEligible = true;

  if (visaChecklist.category === 'local_applicants_only' || visaChecklist.ethiopianEligible === 'no') {
    visaEligibilityScore = 0;
    workAuthorizationEligible = false;
    gapOrMismatchReasons.push(
      'Not eligible for work authorization from Ethiopia: listing requires existing local work permit or restricts to local nationals.'
    );
  } else if (visaChecklist.category === 'explicit_employer_visa_sponsorship') {
    visaEligibilityScore = 20;
    matchReasons.push('Explicit employer visa sponsorship verified.');
  } else if (visaChecklist.category === 'employer_sponsored_work_permit') {
    visaEligibilityScore = 18;
    matchReasons.push('Employer-sponsored work permit verified.');
  } else if (visaChecklist.category === 'employer_supported_relocation') {
    visaEligibilityScore = 15;
    matchReasons.push('Employer-supported international relocation confirmed.');
  } else if (visaChecklist.category === 'foreign_applicants_accepted') {
    visaEligibilityScore = 13;
    matchReasons.push('Foreign / international applicants explicitly accepted.');
  } else {
    visaEligibilityScore = profile.needsEmployerSponsorship ? 6 : 12;
    gapOrMismatchReasons.push('Sponsorship not confirmed — verify employer work permit support before applying.');
  }

  // 5. SALARY COMPATIBILITY (Max 10 pts)
  let salaryScore = 6;
  const minTarget = profile.minimumMonthlySalaryUsd || 3000;
  if (salaryInfo.hasAdvertisedSalary && salaryInfo.estimatedMonthlyUsd !== null) {
    if (salaryInfo.estimatedMonthlyUsd >= minTarget) {
      salaryScore = 10;
      matchReasons.push(
        `Estimated salary (~USD ${salaryInfo.estimatedMonthlyUsd.toLocaleString()}/mo) meets your USD ${minTarget.toLocaleString()}/mo target.`
      );
    } else if (salaryInfo.isExceptionalPathwayBelowTarget) {
      salaryScore = 6;
      gapOrMismatchReasons.push(
        `Salary (~USD ${salaryInfo.estimatedMonthlyUsd.toLocaleString()}/mo) is below USD ${minTarget.toLocaleString()}/mo target, flagged under exceptional relocation/pathway opportunities.`
      );
    } else {
      salaryScore = 2;
      gapOrMismatchReasons.push(
        `Salary (~USD ${salaryInfo.estimatedMonthlyUsd.toLocaleString()}/mo) is below your USD ${minTarget.toLocaleString()}/mo minimum expectation.`
      );
    }
  } else {
    salaryScore = 6; // Neutral when employer does not publish salary (never invent salary!)
  }

  // 6. LANGUAGE COMPATIBILITY (Max 10 pts)
  let languageScore = 8;
  if (profile.englishOnly && visaChecklist.localLanguageMandatory === 'yes') {
    languageScore = 1;
    gapOrMismatchReasons.push('Requires mandatory local language proficiency (profile indicates English only).');
  } else if (visaChecklist.englishSufficient === 'yes') {
    languageScore = 10;
    matchReasons.push('English working language confirmed sufficient.');
  } else {
    languageScore = 7;
  }

  // 7. RELOCATION & FAMILY REUNIFICATION PATHWAY (Max 5 pts)
  let relocationFamilyScore = 3;
  if (visaChecklist.relocationAssistanceProvided === 'yes' && visaChecklist.familyReunificationPossible === 'yes') {
    relocationFamilyScore = 5;
    matchReasons.push('Supports relocation and legal family reunification pathway.');
  } else if (visaChecklist.familyReunificationPossible === 'yes' || visaChecklist.relocationAssistanceProvided === 'yes') {
    relocationFamilyScore = 4;
  } else if (visaChecklist.category === 'local_applicants_only') {
    relocationFamilyScore = 0;
  }

  let rawTotal =
    educationScore +
    experienceScore +
    responsibilityScore +
    visaEligibilityScore +
    salaryScore +
    languageScore +
    relocationFamilyScore;

  let cappedDueToWorkAuth = false;
  if (!workAuthorizationEligible && rawTotal > 45) {
    rawTotal = 45;
    cappedDueToWorkAuth = true;
  }

  const totalScore = Math.max(0, Math.min(100, Math.round(rawTotal)));
  const band: WeightedCareerMatchResult['band'] =
    totalScore >= 90
      ? 'Excellent match'
      : totalScore >= 75
      ? 'Strong match'
      : totalScore >= 60
      ? 'Possible match'
      : 'Low match';

  return {
    totalScore,
    band,
    workAuthorizationEligible,
    cappedDueToWorkAuth,
    breakdown: {
      educationScore,
      experienceScore,
      responsibilityScore,
      visaEligibilityScore,
      salaryScore,
      languageScore,
      relocationFamilyScore,
    },
    matchReasons: matchReasons.slice(0, 6),
    gapOrMismatchReasons: gapOrMismatchReasons.slice(0, 5),
    salaryInfo,
    visaChecklist,
    careerSpecialty,
    regionGroup,
  };
}

// =========================================================================
// GROUNDED CV EXTRACTION (ZERO FABRICATION — ONLY TEXT PRESENT IN CV)
// =========================================================================

export function extractGroundedProfileFromCvText(
  cvText: string,
  overrides: Partial<CareerApplicantProfile> = {}
): CareerApplicantProfile {
  const clean = String(cvText || '').replace(/\r/g, '\n').trim();
  const evidence: string[] = [];

  // Extract years of experience strictly if mentioned in text or inferred from explicit date ranges
  let totalYears = overrides.totalYearsExperience ?? 0;
  const yearsExplicit = clean.match(/\b(\d{1,2})\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional\s+|banking\s+|work\s+|relevant\s+)?experience\b/i);
  if (yearsExplicit) {
    totalYears = Math.min(40, parseInt(yearsExplicit[1], 10));
    evidence.push(`Experience found in CV: "${yearsExplicit[0]}"`);
  } else {
    const yearMatches = Array.from(clean.matchAll(/\b(199\d|20[0-2]\d)\b/g)).map((m) => Number(m[1]));
    if (yearMatches.length >= 2) {
      const minY = Math.min(...yearMatches);
      const maxY = Math.min(new Date().getFullYear(), Math.max(...yearMatches));
      if (maxY - minY >= 1 && maxY - minY <= 35) {
        totalYears = maxY - minY;
        evidence.push(`Employment timeline span detected in CV: ${minY}–${maxY}`);
      }
    }
  }

  // Extract education strictly from CV
  let educationDegree = overrides.educationDegree || '';
  let educationField = overrides.educationField || '';
  const degreeMatch = clean.match(
    /\b(Ph\.?D|Doctorate|Master(?:'s)?|M\.?Sc|MBA|M\.?A|Bachelor(?:'s)?|B\.?Sc|B\.?A|BBA|B\.?Eng|Diploma)\b(?:\.?\s*(?:degree\s*)?(?:in\s+([A-Za-z &/]{3,55})))?/i
  );
  if (degreeMatch) {
    educationDegree = degreeMatch[1].trim();
    if (degreeMatch[2]) {
      educationField = degreeMatch[2].replace(/[\n.,;].*$/, '').trim();
    }
    evidence.push(`Education found in CV: "${degreeMatch[0].trim().slice(0, 90)}"`);
  }

  // Extract explicitly mentioned skills/responsibilities (closed vocabulary check against CV text only)
  const knownCapabilities = [
    'Branch management',
    'Banking operations',
    'Financial management',
    'Accounting and financial reporting',
    'Deposit mobilization',
    'Customer relationship management',
    'Business development',
    'Credit administration',
    'Risk management',
    'Internal controls',
    'Internal audit',
    'Staff supervision',
    'Banking compliance',
    'AML / KYC compliance',
    'Digital banking',
    'Microfinance',
    'Financial inclusion',
    'Treasury management',
    'Financial analysis',
    'Budgeting and forecasting',
    'Grants finance',
    'WASH engineering',
    'Water and sanitation',
    'Project management',
    'Insurance operations',
    'Payment operations',
    'Fintech',
  ];
  const extractedSkills: string[] = [];
  for (const cap of knownCapabilities) {
    const core = cap.split(' ')[0].toLowerCase();
    if (clean.toLowerCase().includes(cap.toLowerCase()) || (core.length >= 5 && clean.toLowerCase().includes(core))) {
      extractedSkills.push(cap);
    }
  }

  // Extract languages explicitly present in CV
  const detectedLangs: string[] = [];
  for (const lang of ['English', 'Amharic', 'French', 'German', 'Arabic', 'Dutch', 'Spanish', 'Swedish', 'Norwegian']) {
    if (new RegExp(`\\b${lang}\\b`, 'i').test(clean)) {
      detectedLangs.push(lang);
    }
  }
  const languages = detectedLangs.length > 0 ? detectedLangs : overrides.languages || ['English'];
  const nonEnglishEuropean = languages.some((l) =>
    ['French', 'German', 'Arabic', 'Dutch', 'Spanish', 'Swedish', 'Norwegian'].includes(l)
  );

  // Extract role title if explicitly mentioned
  const roleMatch = clean.match(
    /\b(Branch Manager|Banking Operations Manager|Finance Manager|Financial Controller|Senior Accountant|Compliance Manager|AML Officer|Credit Manager|Relationship Manager|Risk Manager|WASH Coordinator|Water Engineer|Operations Manager|Business Development Manager)\b/i
  );
  const currentPosition = roleMatch ? roleMatch[1] : overrides.currentPosition || '';
  if (roleMatch) {
    evidence.push(`Role title found in CV: "${roleMatch[1]}"`);
  }

  const isManagerInCv = /\b(branch manager|manager|head of|supervisor|team lead|director)\b/i.test(clean);

  return {
    profileName: overrides.profileName || 'Custom CV Profile',
    nationality: overrides.nationality || (/ethiopia/i.test(clean) ? 'Ethiopian' : 'International'),
    currentResidence: overrides.currentResidence || (/ethiopia|addis ababa|mekelle/i.test(clean) ? 'Ethiopia' : 'Not specified'),
    educationDegree: educationDegree || 'Not specified in CV',
    educationField: educationField || 'Not specified in CV',
    institution: overrides.institution || '',
    totalYearsExperience: totalYears,
    bankingYearsExperience:
      overrides.bankingYearsExperience ?? (/\bbank/i.test(clean) ? totalYears : 0),
    managementYearsExperience:
      overrides.managementYearsExperience ?? (isManagerInCv ? Math.min(totalYears, 3) : 0),
    currentPosition: currentPosition || 'Not specified in CV',
    languages,
    englishOnly: overrides.englishOnly ?? !nonEnglishEuropean,
    minimumMonthlySalaryUsd: overrides.minimumMonthlySalaryUsd ?? 3000,
    preferredSalaryRangeUsd: overrides.preferredSalaryRangeUsd || 'USD 3,000+ / month',
    willingRelocateAloneFirst: overrides.willingRelocateAloneFirst ?? true,
    familyReunificationImportant: overrides.familyReunificationImportant ?? true,
    needsEmployerSponsorship: overrides.needsEmployerSponsorship ?? true,
    seeksPermanentResidencyPathway: overrides.seeksPermanentResidencyPathway ?? true,
    skillsAndResponsibilities:
      overrides.skillsAndResponsibilities && overrides.skillsAndResponsibilities.length > 0
        ? overrides.skillsAndResponsibilities
        : extractedSkills,
    preferredRegions: overrides.preferredRegions || [
      'Europe',
      'Middle East',
      'Asia-Pacific',
      'Africa & Other',
      'North America',
    ],
    extractedFromCv: true,
    cvEvidenceSnippets: evidence,
  };
}

export function scorePrPathwayForCareerProfile(
  pathway: PermanentResidencyCountryRecord,
  profile: CareerApplicantProfile
): {
  fitLevel: 'Strong Pathway Fit' | 'Possible Pathway (Requires Job Offer / Language)' | 'Limited Fit';
  notes: string[];
} {
  const notes: string[] = [];
  const hasDegree = inferApplicantEducationRank(`${profile.educationDegree} ${profile.educationField}`) >= 2;
  const isFinance = /\b(bank|finance|account|audit|credit|compliance|risk)\b/i.test(
    `${profile.educationField} ${profile.currentPosition} ${profile.skillsAndResponsibilities.join(' ')}`
  );

  if (pathway.ethiopianCitizensEligible === 'confirmed') {
    notes.push('Ethiopian citizens can apply from Ethiopia under official rules.');
  }
  if (hasDegree) {
    notes.push(`Degree (${profile.educationDegree} ${profile.educationField}) supports skilled stream assessment.`);
  }
  if (isFinance && (pathway.bankingFinanceOccupations?.length || 0) > 0) {
    notes.push(`Banking/Finance demand documented: ${pathway.bankingFinanceOccupations[0]}.`);
  }
  if (profile.familyReunificationImportant && pathway.familyRelocationOptions) {
    notes.push(`Family reunification: ${pathway.familyRelocationOptions.slice(0, 110)}`);
  }

  const fitLevel =
    pathway.ethiopianCitizensEligible === 'confirmed' && hasDegree && isFinance && (pathway.bankingFinanceOccupations?.length || 0) > 0
      ? 'Strong Pathway Fit'
      : pathway.foreignApplicantsEligible && hasDegree
      ? 'Possible Pathway (Requires Job Offer / Language)'
      : 'Limited Fit';

  return { fitLevel, notes };
}
