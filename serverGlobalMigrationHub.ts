import type { Express, Request, Response } from 'express';
import * as path from 'path';
import * as crypto from 'crypto';
import type { GlobalOpportunity } from './src/types/globalOpportunities';
import type { GlobalOpportunitiesStore } from './serverGlobalOpportunities';
import {
  OFFICIAL_GOVERNMENT_PR_SEEDS,
  PR_OFFICIAL_DISCLAIMER,
} from './serverPermanentResidency';
import {
  isOpportunityActiveAndDisplayable,
  evaluateOpportunityDeadline,
} from './src/utils/opportunityIntelligenceEngine';
import { detectInternationalRegion } from './src/utils/internationalCareerIntelligence';
import {
  ChangeHistoryEvent,
  CostAffordabilitySummary,
  CountryRecommendationIntel,
  DEFAULT_GENERAL_MIGRATION_PROFILE,
  EligibilityClassification,
  EvaluatedMigrationOpportunity,
  GlobalMigrationHubEvaluationResponse,
  MigrationProfileInput,
  OfficialImmigration13PointRecord,
  RequirementPresence,
  UserApplicationTrackerItem,
  UserMigrationWorkspace,
} from './src/types/globalMigrationHub';

export interface RegisterGlobalMigrationHubDeps {
  app: Express;
  runtimeBaseDir: string;
  isVercel: boolean;
  ensureRuntimeDataDir: () => void;
  loadJsonFileSafe: <T>(filePath: string, fallback: T) => T;
  writeJsonFileAtomic: (filePath: string, data: unknown) => void;
  getRequesterUid: (req: Request) => string | null;
}

interface OpportunitySnapshotEntry {
  id: string;
  title: string;
  deadline: string;
  salaryOrFunding: string;
  firstSeenAt: string;
  lastUpdatedAt: string;
  fingerprint: string;
}

interface GlobalMigrationHubStore {
  version: number;
  updatedAt: string;
  lastRefreshAt: string;
  nextRefreshAt: string;
  users: Record<string, UserMigrationWorkspace>;
  opportunitySnapshot: Record<string, OpportunitySnapshotEntry>;
  changeHistory: ChangeHistoryEvent[];
}

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes continuous monitoring

const PRIORITY_RELOCATION_COUNTRIES: Record<string, string> = {
  'Saudi Arabia':
    'High employer-sponsored recruitment for commercial banking, fintech, audit, and operations managers; employers typically cover work visa, iqama, and relocation flights, making upfront cost realistic for budgets under $500.',
  'United Arab Emirates':
    'Major international banking and financial hub actively recruiting experienced commercial bankers, risk/compliance specialists, and operations leaders with employer-paid residency visas and relocation packages.',
  UAE:
    'Major international banking and financial hub actively recruiting experienced commercial bankers, risk/compliance specialists, and operations leaders with employer-paid residency visas and relocation packages.',
  Qatar:
    'Recruits foreign banking, finance, and operations specialists through employer-sponsored work visas where relocation and visa costs are typically borne by the hiring institution.',
  Oman:
    'Regional Gulf financial institutions occasionally hire experienced credit, compliance, and operations officers with employer-sponsored work permits.',
  Kuwait:
    'Gulf financial and corporate employers sponsor qualified foreign accounting, treasury, and banking operations professionals under employer-funded work visas.',
};

const PRIORITY_SETTLEMENT_COUNTRIES: Record<string, string> = {
  Germany:
    'Active shortage of finance, audit, engineering, and skilled professionals; EU Blue Card and Skilled Worker Visa provide legal routes from Ethiopia to permanent residence in 21–36 months with family reunification.',
  Canada:
    'Structured points-based Express Entry and Provincial Nominee Programs (PNP) open to Ethiopian citizens for Financial Auditors, Accountants, Banking Managers, and WASH Engineers, leading directly to Permanent Residence.',
  Australia:
    'Skilled Independent (189), Nominated (190), and Employer-Sponsored (482 → 186) pathways explicitly list Accountants, Auditors, Finance Managers, and Civil/Water Engineers with clear PR transition.',
  'New Zealand':
    'Green List Tier 1 offers Straight-to-Residence PR for External/Internal Auditors and Water/Environmental Engineers with an accredited employer job offer.',
  Ireland:
    'Critical Skills Employment Permit covers qualified finance, accounting, risk, and engineering roles with direct Stamp 4 long-term residency after 2 years and immediate spouse work rights.',
  'United Kingdom':
    'Skilled Worker Visa via licensed sponsors covers financial managers, accountants, compliance, and engineering specialists, leading to Indefinite Leave to Remain (PR) after 5 years.',
  Netherlands:
    'Highly Skilled Migrant Permit via IND-recognized sponsors processes rapidly (2–4 weeks) with no mandatory Dutch language test for English-speaking finance/fintech employers; PR after 5 years.',
  Sweden:
    'Employer-sponsored work permits for finance, IT, and engineering professionals allow immediate family accompaniment and permanent residency eligibility after 4 years of work.',
  Norway:
    'Skilled Worker Permit open to university-educated professionals with a Norwegian job offer; leads to permanent residence after 3 years of continuous residence.',
  Finland:
    'Specialist Residence Permit for skilled professionals and development/engineering talent with fast-track processing and PR after 4 years.',
  Denmark:
    'Pay Limit & Positive List schemes allow qualified foreign finance, audit, and engineering professionals to obtain work residence leading to permanent residency.',
  Switzerland:
    'Major base for international organizations, development banks, and global WASH agencies (Geneva/Basel) offering employer-sponsored B permits and international staff contracts.',
  Austria:
    'Red-White-Red Card points system for Very Highly Qualified and Shortage Occupations leading to permanent settlement.',
  Luxembourg:
    'European banking, microfinance, and investment-fund hub recruiting English-speaking international finance, audit, and compliance specialists under the EU Blue Card.',
  Singapore:
    'Global banking and fintech hub using the Employment Pass (COMPASS framework) for experienced finance and digital banking specialists.',
  Japan:
    'Highly Skilled Professional (HSP) visa offers accelerated permanent residence in 1–3 years for experienced corporate and finance professionals.',
  'United States':
    'Home to World Bank Group, IMF, IFC, UN headquarters, and major global banks offering G-4 international organization visas and H-1B / EB-2 employment pathways.',
  Kenya:
    'East African regional hub for international banks, microfinance networks, UN agencies, and WASH NGOs with accessible regional relocation for Ethiopian professionals.',
  Rwanda:
    'Growing Kigali International Financial Centre and African development hub offering accessible work permits and regional banking/microfinance roles.',
  'South Africa':
    'Critical Skills Work Visa lists auditors, financial specialists, and water engineers with path to permanent residence after 5 years.',
};

function normalizeCountryKey(country: string): string {
  const c = String(country || '').trim();
  if (/^uae$/i.test(c) || /united arab emirates/i.test(c)) return 'United Arab Emirates';
  if (/^uk$/i.test(c) || /united kingdom/i.test(c)) return 'United Kingdom';
  if (/^usa$/i.test(c) || /^u\.s\.a\.?$/i.test(c) || /united states/i.test(c)) return 'United States';
  if (/^ksa$/i.test(c) || /saudi arabia/i.test(c)) return 'Saudi Arabia';
  return c || 'International';
}

function sanitizeProfile(input?: Partial<MigrationProfileInput> | null): MigrationProfileInput {
  const base = DEFAULT_GENERAL_MIGRATION_PROFILE;
  if (!input || typeof input !== 'object') {
    return { ...base, coreSkills: [...base.coreSkills], targetSectors: [...base.targetSectors] };
  }
  const cleanList = (arr: unknown, maxItems = 25): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => String(item || '').trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, maxItems);
  };
  return {
    profileLabel: String(input.profileLabel || base.profileLabel || '').trim().slice(0, 120),
    nationality: String(input.nationality || base.nationality).trim().slice(0, 60),
    currentResidence: String(input.currentResidence || base.currentResidence).trim().slice(0, 60),
    highestEducation: String(input.highestEducation || base.highestEducation).trim().slice(0, 80),
    fieldOfStudy: String(input.fieldOfStudy ?? base.fieldOfStudy).trim().slice(0, 120),
    graduationYear: String(input.graduationYear ?? '').trim().slice(0, 12),
    totalExperienceYears: Math.max(0, Math.min(50, Number(input.totalExperienceYears ?? base.totalExperienceYears) || 0)),
    managementExperienceYears: Math.max(
      0,
      Math.min(40, Number(input.managementExperienceYears ?? base.managementExperienceYears) || 0)
    ),
    currentOrRecentRole: String(input.currentOrRecentRole ?? base.currentOrRecentRole).trim().slice(0, 120),
    hasMastersDegree: Boolean(input.hasMastersDegree),
    hasEnglishTest: Boolean(input.hasEnglishTest),
    englishTestDetails: String(input.englishTestDetails ?? base.englishTestDetails ?? '').trim().slice(0, 120),
    otherLanguages: String(input.otherLanguages ?? base.otherLanguages ?? '').trim().slice(0, 140),
    maxUpfrontBudgetUsd: Math.max(0, Math.min(100000, Number(input.maxUpfrontBudgetUsd ?? 500) || 0)),
    coreSkills: cleanList(input.coreSkills),
    targetSectors: cleanList(input.targetSectors),
    familyRelocationNeeded: Boolean(input.familyRelocationNeeded),
    willingToRelocateInitiallyAlone: input.willingToRelocateInitiallyAlone !== false,
  };
}

function sanitizeSelectedCountries(countries: unknown): string[] {
  if (!Array.isArray(countries)) return [];
  const unique = new Set<string>();
  for (const raw of countries) {
    const norm = normalizeCountryKey(String(raw || '').trim().slice(0, 60));
    if (norm && norm !== 'International') unique.add(norm);
  }
  return Array.from(unique).slice(0, 25);
}

function sanitizeTrackerItems(items: unknown): UserApplicationTrackerItem[] {
  if (!Array.isArray(items)) return [];
  const allowedStages = new Set(['Researching', 'Preparing Documents', 'Applied', 'Interview', 'Offer', 'Closed']);
  const out: UserApplicationTrackerItem[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const opportunityId = String(rec.opportunityId || '').trim().slice(0, 140);
    if (!opportunityId || seen.has(opportunityId)) continue;
    seen.add(opportunityId);
    const stageRaw = String(rec.stage || 'Researching');
    const stage = (allowedStages.has(stageRaw) ? stageRaw : 'Researching') as UserApplicationTrackerItem['stage'];
    out.push({
      opportunityId,
      title: String(rec.title || 'Opportunity').trim().slice(0, 180),
      employerOrInstitution: String(rec.employerOrInstitution || '').trim().slice(0, 140),
      country: String(rec.country || '').trim().slice(0, 80),
      officialUrl: String(rec.officialUrl || '').trim().slice(0, 400),
      stage,
      notes: String(rec.notes || '').trim().slice(0, 1000),
      updatedAt: String(rec.updatedAt || new Date().toISOString()),
    });
    if (out.length >= 150) break;
  }
  return out;
}

function detectWashOpportunity(opp: GlobalOpportunity): boolean {
  if (opp.isWashDedicated || opp.category === 'wash_opportunity' || opp.department === 'wash_jobs') {
    return true;
  }
  if ((opp.sectors || []).includes('wash')) return true;
  const hay = `${opp.title} ${opp.organization} ${opp.summary || ''}`.toLowerCase();
  return /\b(wash|water supply|sanitation|hygiene|hydrolog|wastewater|faecal sludge|wateraid|un-ihe|siwi|world water)\b/i.test(hay);
}

function detectScholarshipOrTraining(opp: GlobalOpportunity): boolean {
  return (
    opp.category === 'university_scholarship' ||
    opp.category === 'professional_training' ||
    opp.category === 'conference_summit' ||
    opp.department === 'banking_wash_scholarships' ||
    opp.department === 'banking_wash_training' ||
    opp.department === 'banking_wash_conferences'
  );
}

function detectMastersRequirement(opp: GlobalOpportunity): RequirementPresence {
  const minEdu = opp.eligibility?.minimumEducationLevel;
  const text = `${opp.eligibility?.educationRequirement || ''} ${opp.summary || ''}`.toLowerCase();
  if (minEdu === 'masters' || minEdu === 'phd') {
    if (/or\s+(bachelor|ba\b|bsc\b|equivalent\s+experience)/i.test(text)) {
      return 'No';
    }
    return 'Yes';
  }
  if (/(master['’]?s|msc|mba|postgraduate|phd|doctorate)\s+(degree\s+)?(is\s+)?(required|mandatory|essential|must hold|minimum)/i.test(text)) {
    if (/or\s+(bachelor|ba\b|bsc\b|equivalent\s+experience)/i.test(text)) {
      return 'No';
    }
    return 'Yes';
  }
  if (minEdu === 'bachelors' || minEdu === 'diploma' || minEdu === 'none') {
    return 'No';
  }
  if (/bachelor|undergraduate|ba\b|bsc\b|first university degree|no master/i.test(text)) {
    return 'No';
  }
  if (/master|msc|mba/i.test(text)) {
    return 'Verify';
  }
  return 'No';
}

function detectEnglishTestRequirement(opp: GlobalOpportunity): RequirementPresence {
  const langs = (opp.eligibility?.languagesRequired || []).join(' ');
  const text = `${langs} ${opp.summary || ''} ${opp.verificationNotes || ''}`.toLowerCase();
  if (/(ielts|toefl|pte|celpip|oet).{0,50}(required|mandatory|must submit|minimum score|band)/i.test(text)) {
    return 'Yes';
  }
  if (/no\s+(ielts|toefl|english test)|ielts\s+not\s+required|exempt|english\s+working\s+proficiency/i.test(text)) {
    return 'No';
  }
  if (/(ielts|toefl|german\s+b1|german\s+b2|french\s+b2|local\s+language\s+required)/i.test(text)) {
    return 'Verify';
  }
  return 'No';
}

function detectMinimumExperienceYears(opp: GlobalOpportunity): number | null {
  if (typeof opp.eligibility?.minimumYearsExperience === 'number') {
    return opp.eligibility.minimumYearsExperience;
  }
  const text = `${opp.eligibility?.experienceRequirement || ''} ${opp.summary || ''}`;
  const match = text.match(/(\d{1,2})\+?\s*(?:to\s*\d{1,2}\s*)?years?\b/i);
  if (match) {
    const parsed = Number(match[1]);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 30) return parsed;
  }
  return null;
}

function detectLocalCitizenRestriction(opp: GlobalOpportunity): boolean {
  if (opp.eligibility?.ethiopianEligible === 'excluded') return true;
  if (opp.funding?.employmentVisaClassification === 'not_eligible_international') return true;
  const text = `${(opp.eligibility?.eligibleNationalities || []).join(' ')} ${opp.funding?.visaSupportSummary || ''} ${opp.summary || ''}`.toLowerCase();
  if (
    /(citizens?\s+only|nationals?\s+only|must\s+already\s+have\s+work\s+authorization|no\s+visa\s+sponsorship|unable\s+to\s+sponsor|local\s+candidates?\s+only|eu\/eea\s+citizens?\s+only)/i.test(
      text
    )
  ) {
    return true;
  }
  return false;
}

function buildCostBreakdown(
  opp: GlobalOpportunity,
  isScholarshipOrTraining: boolean,
  maxUpfrontBudgetUsd: number
): CostAffordabilitySummary {
  const funding = opp.funding;
  const text = `${funding?.fundingSummary || ''} ${funding?.visaSupportSummary || ''} ${funding?.stipendOrSalary || ''} ${funding?.applicationFee || ''} ${opp.summary || ''}`.toLowerCase();

  const isFullyFunded =
    funding?.fundingLevel === 'fully_funded' ||
    funding?.fundingLevel === 'free' ||
    opp.verificationStatus === 'Fully Funded' ||
    /fully funded|full scholarship|full sponsorship|travel.*accommodation.*covered|airfare.*covered|all expenses/i.test(text);

  const employerPaidRelocation =
    funding?.visaSupportType === 'employer_sponsored_visa' ||
    funding?.visaSupportType === 'visa_fees_funded' ||
    funding?.relocationAssistance === 'yes' ||
    funding?.employmentVisaClassification === 'confirmed_visa_sponsorship' ||
    funding?.employmentVisaClassification === 'relocation_assistance' ||
    /employer[- ]sponsored|relocation\s+(package|assistance|allowance|covered)|visa\s+sponsorship|iqama|g-4\s+visa|international\s+staff/i.test(
      text
    );

  const proofOfFundsRequired = /proof\s+of\s+funds|settlement\s+funds|blocked\s+account|bank\s+statement\s+showing/i.test(text);

  const appFeeRaw = String(funding?.applicationFee || '').toLowerCase();
  const applicationFeeStatus: CostAffordabilitySummary['applicationFeeStatus'] =
    appFeeRaw.includes('none') || appFeeRaw.includes('free') || appFeeRaw === '$0'
      ? 'Free application'
      : /government\s+fee|application\s+fee|\$\d+/.test(appFeeRaw)
      ? 'Government application fee'
      : isScholarshipOrTraining
      ? 'Free application'
      : 'Free application';

  let whoPaysSummary = 'Verify expense coverage directly on the official employer/institution portal.';
  if (isFullyFunded) {
    whoPaysSummary =
      funding?.fundingSummary ||
      'Sponsor/Government-funded: tuition, travel, and/or stipend covered per official programme terms.';
  } else if (employerPaidRelocation) {
    whoPaysSummary =
      funding?.visaSupportSummary ||
      'Employer-sponsored recruitment: employer initiates work visa/permit; confirm flight, housing, and medical reimbursement terms in your official offer.';
  }

  let applicantPaidCosts = 'Passport, document notarization/attestation, and any unstated local travel costs.';
  if (proofOfFundsRequired) {
    applicantPaidCosts = 'Requires verifiable settlement/proof of funds plus official visa/credential evaluation fees.';
  } else if (isFullyFunded) {
    applicantPaidCosts = 'Free online application; verify whether passport or local visa transit fees apply.';
  }

  let withinUserBudget: 'Yes' | 'Verify' | 'No' = 'Verify';
  let budgetNote = `Compare official upfront expenses against your $${maxUpfrontBudgetUsd.toLocaleString()} budget before applying.`;
  if (proofOfFundsRequired && maxUpfrontBudgetUsd < 2500) {
    withinUserBudget = 'No';
    budgetNote = `Proof of settlement funds likely exceeds your $${maxUpfrontBudgetUsd.toLocaleString()} upfront budget unless covered by a confirmed sponsor.`;
  } else if (funding?.fundingLevel === 'self_funded' && maxUpfrontBudgetUsd < 2000) {
    withinUserBudget = 'No';
    budgetNote = `Self-funded listing likely exceeds your $${maxUpfrontBudgetUsd.toLocaleString()} budget.`;
  } else if (isFullyFunded || (employerPaidRelocation && !proofOfFundsRequired)) {
    withinUserBudget = 'Yes';
    budgetNote = `Free online application with employer/sponsor support — realistic within a $${maxUpfrontBudgetUsd.toLocaleString()} initial budget (confirm relocation reimbursement before signing).`;
  }

  return {
    applicationFeeStatus,
    whoPaysSummary,
    employerPaidRelocation,
    governmentFunded: isFullyFunded,
    applicantPaidCosts,
    proofOfFundsRequired,
    proofOfFundsDetails: proofOfFundsRequired
      ? 'Official proof of financial means/settlement funds is referenced; verify exact threshold on the official portal.'
      : 'No personal settlement proof-of-funds requirement stated for employer-sponsored or fully funded intake (verify during visa stage).',
    withinUserBudget,
    budgetNote,
  };
}

function formatCategoryLabel(cat: GlobalOpportunity['category']): string {
  switch (cat) {
    case 'international_job':
      return 'International Job';
    case 'university_scholarship':
      return 'Scholarship';
    case 'professional_training':
      return 'Professional Training';
    case 'conference_summit':
      return 'Conference / Summit';
    case 'wash_opportunity':
      return 'WASH Opportunity';
    default:
      return 'International Opportunity';
  }
}

function evaluateSingleOpportunity(
  opp: GlobalOpportunity,
  profile: MigrationProfileInput,
  selectedCountrySet: Set<string>,
  changeStatus: 'new' | 'updated' | 'unchanged',
  firstSeenAt?: string
): EvaluatedMigrationOpportunity {
  const country = normalizeCountryKey(opp.country || 'International');
  const region = detectInternationalRegion(country, opp.location || '');
  const isWash = detectWashOpportunity(opp);
  const isScholarshipOrTraining = detectScholarshipOrTraining(opp);
  const mastersRequired = detectMastersRequirement(opp);
  const englishTestRequired = detectEnglishTestRequirement(opp);
  const localRestricted = detectLocalCitizenRestriction(opp);
  const minYears = detectMinimumExperienceYears(opp);
  const costBreakdown = buildCostBreakdown(opp, isScholarshipOrTraining, profile.maxUpfrontBudgetUsd);

  const deadlineRaw = opp.deadline?.deadlineDateRaw || opp.deadline?.deadlineUtcIso || '';
  const deadlineEval = evaluateOpportunityDeadline(deadlineRaw, opp.deadline?.deadlineTimezone || 'UTC');
  const isInSelectedCountry = selectedCountrySet.has(country.toLowerCase());
  const isInRecommendedCountry =
    Boolean(PRIORITY_RELOCATION_COUNTRIES[country]) ||
    Boolean(PRIORITY_SETTLEMENT_COUNTRIES[country]);

  // Domain & skill relevance analysis
  const oppHay = [
    opp.title,
    opp.organization,
    opp.category,
    opp.department || '',
    opp.summary || '',
    opp.eligibility?.educationRequirement || '',
    opp.eligibility?.experienceRequirement || '',
    ...(opp.eligibility?.requiredSkills || []),
    ...(opp.sectors || []),
  ]
    .join(' ')
    .toLowerCase();

  const profileTerms = [
    profile.fieldOfStudy,
    profile.currentOrRecentRole,
    ...profile.coreSkills,
    ...profile.targetSectors,
  ]
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length >= 3);

  const bankingFinanceSignals =
    /\b(bank|banking|branch|finance|financial|accounting|accountant|audit|auditor|credit|loan|risk|compliance|aml|microfinance|treasury|fintech|digital financial|deposit|internal control|investment|operations manager|relationship manager|corporate finance)\b/i;
  const userIsBankingFinance = bankingFinanceSignals.test(profileTerms.join(' '));
  const oppIsBankingFinance =
    Boolean(opp.isBankingFinance) ||
    (opp.sectors || []).includes('banking_finance') ||
    bankingFinanceSignals.test(oppHay);

  const userWantsWash = profileTerms.some((t) =>
    /\b(wash|water|sanitation|hygiene|civil|environmental|public health)\b/i.test(t)
  );

  let matchedSkillHits = 0;
  for (const term of profileTerms) {
    const tokens = term.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    if (tokens.length > 0 && tokens.some((tok) => oppHay.includes(tok))) {
      matchedSkillHits += 1;
    }
  }

  // Strictly determine if user can apply from Ethiopia
  let canApplyFromEthiopia: EvaluatedMigrationOpportunity['canApplyFromEthiopia'] = 'Verify';
  if (localRestricted) {
    canApplyFromEthiopia = 'No';
  } else if (
    opp.eligibility?.ethiopianEligible === 'confirmed' ||
    opp.eligibility?.ethiopianEligible === 'likely_global' ||
    opp.funding?.visaSupportType === 'employer_sponsored_visa' ||
    opp.funding?.fundingLevel === 'fully_funded'
  ) {
    canApplyFromEthiopia = 'Yes';
  }

  // Honest Eligibility Classification (Section 11)
  // Rule: NEVER automatically exclude if Master's or IELTS is merely unconfirmed/optional!
  const disqualifiers: string[] = [];
  const confirmationNeededItems: string[] = [];
  const positiveMatches: string[] = [];

  if (localRestricted) {
    disqualifiers.push('Requires existing local work authorization or restricts foreign/Ethiopian offshore applicants.');
  } else if (canApplyFromEthiopia === 'Yes') {
    positiveMatches.push('Open to international/Ethiopian applicants applying from Ethiopia.');
  } else {
    confirmationNeededItems.push('Confirm offshore application eligibility for Ethiopian nationals on the official portal.');
  }

  if (mastersRequired === 'Yes' && !profile.hasMastersDegree) {
    disqualifiers.push("Published notice states a Master's or postgraduate degree is mandatory.");
  } else if (mastersRequired === 'Verify' && !profile.hasMastersDegree) {
    confirmationNeededItems.push("Confirm whether a Bachelor's degree + years of experience is accepted in lieu of a Master's.");
  } else {
    positiveMatches.push(
      `Education aligns (${profile.highestEducation}${profile.fieldOfStudy ? ` in ${profile.fieldOfStudy}` : ''}).`
    );
  }

  if (englishTestRequired === 'Yes' && !profile.hasEnglishTest) {
    confirmationNeededItems.push(
      'Official listing mentions IELTS/TOEFL or language test — verify if English-medium degree or work experience qualifies for an exemption.'
    );
  } else if (englishTestRequired === 'Verify' && !profile.hasEnglishTest) {
    confirmationNeededItems.push(
      'Confirm whether formal English/local language certification is required at application or visa stage.'
    );
  }

  if (minYears !== null) {
    if (profile.totalExperienceYears >= minYears) {
      positiveMatches.push(`${profile.totalExperienceYears} yrs experience meets the stated ${minYears}+ yrs requirement.`);
    } else if (profile.totalExperienceYears + 2 >= minYears) {
      confirmationNeededItems.push(
        `Listed experience is ${minYears}+ years (your profile lists ${profile.totalExperienceYears} years).`
      );
    } else {
      disqualifiers.push(
        `Requires ${minYears}+ years of experience (profile currently lists ${profile.totalExperienceYears} years).`
      );
    }
  }

  let domainAligned = false;
  if (isWash && !userWantsWash && userIsBankingFinance) {
    if (/\b(finance|accounting|accountant|audit|grants|budget|financial)\b/i.test(oppHay)) {
      domainAligned = true;
      positiveMatches.push('Finance/accounting role within an international WASH organization.');
    } else {
      disqualifiers.push(
        'Technical WASH/water engineering specialization outside your stated banking/finance profile (shown separately in WASH tab).'
      );
    }
  } else if (oppIsBankingFinance && userIsBankingFinance) {
    domainAligned = true;
    positiveMatches.push('Direct alignment with Banking, Finance, Accounting, or Management experience.');
  } else if (matchedSkillHits >= 2 || profileTerms.length === 0) {
    domainAligned = true;
    if (matchedSkillHits >= 2) {
      positiveMatches.push(`Matches ${matchedSkillHits} core skills/sector keywords from your profile.`);
    }
  } else if (isScholarshipOrTraining) {
    domainAligned =
      matchedSkillHits >= 1 || /leadership|management|development|finance|public|policy|professional/i.test(oppHay);
    if (!domainAligned) {
      confirmationNeededItems.push('Confirm field-of-study eligibility for your academic & professional background.');
    }
  } else {
    confirmationNeededItems.push('Role focus partially overlaps your profile — verify detailed duties on the official notice.');
  }

  if (costBreakdown.withinUserBudget === 'No') {
    confirmationNeededItems.push(costBreakdown.budgetNote);
  } else if (costBreakdown.withinUserBudget === 'Yes') {
    positiveMatches.push('Free online application with employer/sponsor funding aligned with your upfront budget.');
  }

  let eligibilityClassification: EligibilityClassification;
  if (disqualifiers.length > 0) {
    eligibilityClassification = 'NOT ELIGIBLE';
  } else if (domainAligned && canApplyFromEthiopia === 'Yes' && confirmationNeededItems.length === 0) {
    eligibilityClassification = 'HIGHLY SUITABLE';
  } else if (
    domainAligned &&
    canApplyFromEthiopia === 'Yes' &&
    confirmationNeededItems.length <= 1 &&
    costBreakdown.withinUserBudget !== 'No'
  ) {
    eligibilityClassification = 'HIGHLY SUITABLE';
  } else {
    eligibilityClassification = 'POTENTIALLY SUITABLE';
  }

  let score = 50;
  if (eligibilityClassification === 'HIGHLY SUITABLE') score += 32;
  else if (eligibilityClassification === 'POTENTIALLY SUITABLE') score += 12;
  else score -= 35;

  if (domainAligned) score += 10;
  if (costBreakdown.withinUserBudget === 'Yes') score += 8;
  if (isInSelectedCountry) score += 6;
  if (profile.managementExperienceYears >= 2 && /\b(manager|lead|head|director|supervisor|branch)\b/i.test(oppHay)) {
    score += 5;
  }
  score = Math.max(5, Math.min(99, score));

  const suitabilityExplanation =
    eligibilityClassification === 'NOT ELIGIBLE'
      ? `Not eligible: ${disqualifiers.join(' ')}`
      : eligibilityClassification === 'HIGHLY SUITABLE'
      ? `${positiveMatches.slice(0, 3).join(' ')}${confirmationNeededItems.length > 0 ? ` Note to confirm: ${confirmationNeededItems[0]}` : ''}`
      : `${positiveMatches.slice(0, 2).join(' ')} Needs confirmation: ${confirmationNeededItems.join(' ')}`.trim();

  const noNominationBarrier =
    opp.eligibility?.universityRecommendationRequired !== 'required' &&
    opp.eligibility?.institutionalNominationRequired !== 'required';

  const valuesExperienceOverGpa =
    isScholarshipOrTraining &&
    noNominationBarrier &&
    !/minimum\s+gpa\s+(3\.[5-9]|4\.0)|university\s+nomination\s+required/i.test(oppHay) &&
    (mastersRequired !== 'Yes' || /leadership|mid-career|professional|fellowship|experience|executive/i.test(oppHay));

  const primarySector = isWash
    ? 'WASH (Water, Sanitation & Hygiene)'
    : oppIsBankingFinance
    ? 'Banking, Finance & Accounting'
    : (opp.sectors?.[0] || formatCategoryLabel(opp.category)).replace(/_/g, ' ');

  const nationalitiesText = (opp.eligibility?.eligibleNationalities || []).join(', ');
  const languagesText = (opp.eligibility?.languagesRequired || []).join(', ');

  return {
    id: opp.id,
    title: opp.title,
    employerOrInstitution: opp.organization,
    country,
    region,
    sector: primarySector,
    category: formatCategoryLabel(opp.category),
    salaryOrFunding:
      opp.funding?.stipendOrSalary ||
      opp.funding?.fundingSummary ||
      'Verify official compensation/funding terms on employer portal',
    nationalityEligibility:
      opp.eligibility?.ethiopianEligible === 'confirmed'
        ? `Ethiopian citizens & international applicants confirmed eligible${nationalitiesText ? ` (${nationalitiesText})` : ''}`
        : localRestricted
        ? 'Restricted to local citizens / existing work permit holders'
        : nationalitiesText || 'International applicants — verify Ethiopian eligibility on official notice',
    educationRequirement:
      opp.eligibility?.educationRequirement ||
      (mastersRequired === 'Yes'
        ? "Master's degree stated as required"
        : "Bachelor's degree or equivalent professional qualification"),
    experienceRequirement:
      opp.eligibility?.experienceRequirement ||
      (minYears !== null
        ? `${minYears}+ years relevant professional experience`
        : 'Relevant professional experience (verify years on official portal)'),
    languageRequirement:
      languagesText ||
      (englishTestRequired === 'Yes'
        ? 'English proficiency test (IELTS/TOEFL) referenced — confirm exemptions'
        : 'Professional working English (no IELTS/TOEFL stated in summary — confirm on portal)'),
    visaOrImmigrationRoute:
      opp.funding?.visaSupportSummary ||
      opp.funding?.employmentVisaLabel ||
      'Confirm work permit / visa sponsorship pathway directly with employer',
    costBreakdown,
    familyRelocationOptions:
      opp.funding?.relocationAssistance === 'yes'
        ? 'Relocation assistance available — confirm spouse/children dependant visa terms in the official offer.'
        : 'Verify dependant visa & family reunification terms on the official employer or government immigration portal.',
    deadline: deadlineRaw || 'Verify on official portal',
    deadlineDisplay:
      opp.deadline?.deadlineUtcIso?.slice(0, 10) ||
      deadlineRaw ||
      'Verify on official portal',
    daysRemaining:
      typeof opp.deadline?.fullDaysRemaining === 'number'
        ? opp.deadline.fullDaysRemaining
        : typeof deadlineEval.fullDaysRemaining === 'number'
        ? deadlineEval.fullDaysRemaining
        : null,
    eligibilityClassification,
    suitabilityScore: score,
    suitabilityExplanation,
    confirmationNeededItems,
    officialSource: opp.sourceName || opp.organization,
    sourceDomain: opp.officialDomain || '',
    directOfficialLink: opp.officialApplicationUrl || opp.originalSourceUrl || '',
    canApplyFromEthiopia,
    matchesUserProfile: eligibilityClassification !== 'NOT ELIGIBLE',
    isWashOpportunity: isWash,
    isScholarshipOrTraining,
    valuesExperienceOverGpa,
    isInSelectedCountry,
    isInRecommendedCountry,
    mastersRequired,
    englishTestRequired,
    changeStatus,
    firstSeenAt,
    verifiedAt: opp.lastVerifiedAt || opp.updatedAt,
  };
}

function build13PointImmigrationRecords(
  profile: MigrationProfileInput,
  selectedCountrySet: Set<string>
): OfficialImmigration13PointRecord[] {
  const userIsBankingFinance = /\b(bank|finance|accounting|audit|credit|risk|microfinance|branch|treasury)\b/i.test(
    `${profile.fieldOfStudy} ${profile.currentOrRecentRole} ${profile.coreSkills.join(' ')}`
  );

  // Saudi Arabia and UAE explicitly included as employer-sponsored work visas (clearly marked Temporary Work Visa — NOT PR!)
  const gulfEmployerSponsoredRoutes: OfficialImmigration13PointRecord[] = [
    {
      id: 'mig_saudi_arabia_work_visa',
      country: 'Saudi Arabia',
      region: 'Middle East',
      programName: 'Employer-Sponsored Work Visa (Iqama) & Skilled Professional Recruitment (Qiwa / MHRSD)',
      officialAuthority: 'Ministry of Human Resources and Social Development (MHRSD) & Ministry of Foreign Affairs (MOFA)',
      officialUrl: 'https://www.hrsd.gov.sa/en',
      shortageListUrl: 'https://www.qiwa.sa/en',
      pathwayCategory: 'Temporary Work Visa (No Direct PR)',
      isRecommendedByResearch: true,
      isSelectedByUser: selectedCountrySet.has('saudi arabia'),
      whyRecommended: PRIORITY_RELOCATION_COUNTRIES['Saudi Arabia'],
      eligibilityClassification:
        userIsBankingFinance && profile.totalExperienceYears >= 3 ? 'HIGHLY SUITABLE' : 'POTENTIALLY SUITABLE',
      suitabilityNote:
        'Strong match for experienced commercial bankers, credit/risk specialists, accountants, and managers because licensed employers typically sponsor the visa and cover relocation flights — realistic under a $500 upfront budget. Important: This is a renewable work residency (Iqama), NOT permanent residency.',
      budgetAlert: `Realistic for your $${profile.maxUpfrontBudgetUsd.toLocaleString()} budget: employer legally bears work visa & Iqama fees under Saudi Labour Law; confirm flight and housing allowance in your written offer.`,
      withinUserBudget: 'Yes',
      q1_canEthiopianApplyFromEthiopia:
        'Yes. Ethiopian citizens living in Ethiopia can apply directly to Saudi banks, fintechs, audit firms, and corporates; once hired, the employer issues an electronic work visa processed through the Saudi Embassy in Addis Ababa.',
      q2_educationRequired:
        "Bachelor's degree (attested by Ethiopian Ministry of Foreign Affairs & Saudi Embassy authentication) matching the sponsored job title. No Master's degree required for most banking/accounting roles.",
      q3_experienceRequired:
        'Typically 3–8+ years of verified professional experience (commercial banking & branch management experience is competitive for mid-to-senior roles).',
      q4_jobOfferNecessary: 'Yes — a signed job offer and electronic visa authorization from a licensed Saudi employer is mandatory.',
      q5_languageTestRequired:
        'No IELTS or TOEFL required for the work visa. Business English is standard in international banks and Big-4 audit firms; Arabic is an advantage for local retail branches.',
      q6_financialProofRequired: 'No personal settlement proof-of-funds requirement for employer-sponsored work visas.',
      q7_officialFees:
        'Work visa issuance, Iqama residency permit, and work permit levies are legally paid by the sponsoring employer; applicant typically only covers local degree attestation/medical check if not reimbursed.',
      q8_whoPaysExpenses:
        'Under Saudi Labour Law, the employer must pay recruitment fees, residence permit (Iqama) issuance/renewal, and return ticket; many banks also include mobilization flight and initial housing allowance.',
      q9_canRelocateInitiallyAlone:
        'Yes — relocating alone first is the standard, most affordable approach while completing probation and setting up housing.',
      q10_familyReunificationRules:
        'Once your Iqama is issued and salary/profession threshold is met, you can apply for a Family Residence Visa for spouse and children via Absher/MOFA (monthly dependent levy applies — verify current rate on official portal).',
      q11_leadsToPermanentResidence:
        'No — standard employer-sponsored work visas (Iqama) are renewable temporary residence permits and do NOT automatically lead to permanent residency or citizenship. (Saudi Premium Residency exists separately under strict high-income/investment/exceptional-talent criteria.)',
      q12_estimatedTimeline:
        'Typically 4–10 weeks after receiving a signed job offer (degree attestation, medical exam, visa stamping in Addis Ababa).',
      q13_officialProcedureAndLink:
        'Apply directly on official Saudi bank/employer career portals -> sign offer -> employer obtains visa block via MHRSD/Qiwa -> attest BA degree & complete GAMCA medical -> embassy visa stamping. Official portal: https://www.hrsd.gov.sa/en',
    },
    {
      id: 'mig_uae_employment_visa',
      country: 'United Arab Emirates',
      region: 'Middle East',
      programName: 'UAE Standard Employment Residence Visa & Green Visa (Skilled Employees)',
      officialAuthority: 'Federal Authority for Identity, Citizenship, Customs & Port Security (ICP) & MOHRE',
      officialUrl:
        'https://u.ae/en/information-and-services/visa-and-emirates-id/residence-visas/residence-visa-for-working-in-the-uae',
      shortageListUrl: 'https://www.mohre.gov.ae/en/home.aspx',
      pathwayCategory: 'Temporary Work Visa (No Direct PR)',
      isRecommendedByResearch: true,
      isSelectedByUser: selectedCountrySet.has('united arab emirates'),
      whyRecommended: PRIORITY_RELOCATION_COUNTRIES['United Arab Emirates'],
      eligibilityClassification:
        userIsBankingFinance && profile.totalExperienceYears >= 3 ? 'HIGHLY SUITABLE' : 'POTENTIALLY SUITABLE',
      suitabilityNote:
        'Strong career and savings stepping stone for banking operations, compliance, accounting, and branch/relationship managers. UAE law prohibits employers from charging recruitment/visa fees to employees. Important: This is a renewable 2–5 year residence visa, NOT permanent residency.',
      budgetAlert: `Realistic for your $${profile.maxUpfrontBudgetUsd.toLocaleString()} budget: UAE Federal Labour Law requires the employer to pay recruitment & employment visa costs (verify relocation flight & degree attestation reimbursement in your offer).`,
      withinUserBudget: 'Yes',
      q1_canEthiopianApplyFromEthiopia:
        'Yes. Ethiopian citizens can apply online from Ethiopia to UAE banks, DIFC/ADGM financial institutions, audit firms, and multinational corporates; employer sponsors the entry permit.',
      q2_educationRequired:
        "Attested Bachelor's degree in Accounting, Finance, Business, or related field for MoHRE Skill Level 1–2 roles. No Master's degree required.",
      q3_experienceRequired: 'Typically 3–7+ years of relevant banking, finance, audit, or operations experience.',
      q4_jobOfferNecessary:
        'Yes — a verified employment contract from a UAE-registered employer is required for the Standard Work Visa (or skilled contract meeting salary threshold for 5-year Green Visa).',
      q5_languageTestRequired:
        'No IELTS or TOEFL required for UAE employment visas. Strong English communication is required by international banks and DIFC/ADGM employers.',
      q6_financialProofRequired: 'No personal proof of settlement funds required for employer-sponsored employment visas.',
      q7_officialFees:
        'Under UAE labour regulations, employment visa, work permit, and Emirates ID onboarding costs for employees are borne by the employer; confirm any degree attestation costs.',
      q8_whoPaysExpenses:
        'Employer pays work permit, visa issuance, and health insurance; many international banks in Dubai/Abu Dhabi also provide joining flight ticket and temporary relocation allowance.',
      q9_canRelocateInitiallyAlone:
        'Yes — moving alone first to complete Emirates ID, bank account, and tenancy contract (Ejari) before sponsoring family is standard practice.',
      q10_familyReunificationRules:
        'Residents earning at least AED 4,000/month (or AED 3,000 + employer accommodation) with a valid tenancy contract can sponsor spouse and children on family residence visas via ICP/GDRFA.',
      q11_leadsToPermanentResidence:
        'No — standard employment visas (2 years) and Green Visas (5 years) are renewable temporary residence permits, NOT permanent residency or citizenship. (10-year Golden Visa is renewable long-term residency for specific high-salary/specialized criteria, still distinct from citizenship.)',
      q12_estimatedTimeline: 'Typically 3–6 weeks from signed offer letter to entry permit issuance.',
      q13_officialProcedureAndLink:
        'Apply directly on UAE bank/corporate career pages -> pass interviews -> employer secures MOHRE work permit & ICP entry permit -> complete degree attestation -> travel and complete Emirates ID. Official portal: https://u.ae/en/information-and-services/visa-and-emirates-id/residence-visas/residence-visa-for-working-in-the-uae',
    },
  ];

  const mappedSeeds: OfficialImmigration13PointRecord[] = OFFICIAL_GOVERNMENT_PR_SEEDS.map((seed) => {
    const country = normalizeCountryKey(seed.country);
    const isSelectedByUser = selectedCountrySet.has(country.toLowerCase());
    const isRecommendedByResearch =
      Boolean(PRIORITY_SETTLEMENT_COUNTRIES[country]) || Boolean(PRIORITY_RELOCATION_COUNTRIES[country]);

    const pathwayCategory: OfficialImmigration13PointRecord['pathwayCategory'] =
      seed.pathwayClassification === 'direct_pr'
        ? 'Direct Permanent Residence'
        : seed.pathwayClassification === 'route_to_pr'
        ? 'Temporary Work Visa Leading to PR'
        : 'Temporary Work Visa (No Direct PR)';

    const langText = String(seed.languageRequirement || '');
    const needsEnglishTest = /\b(ielts|celpip|pte|toefl|clb\s*[5-9]|mandatory)\b/i.test(langText);
    const feeText = `${seed.governmentApplicationFees || ''} ${seed.financialProofRequirement || ''}`;
    const hasHighProofOfFunds =
      /canada|australia|new zealand|express entry|blocked account|aud\s*\$4|cad\s*\$1|proof of funds|settlement funds/i.test(
        `${country} ${feeText} ${seed.programName}`
      );

    let withinUserBudget: 'Yes' | 'Verify' | 'No' = 'Verify';
    let budgetAlert = `Verify exact government visa fees and relocation coverage against your $${profile.maxUpfrontBudgetUsd.toLocaleString()} budget.`;

    if (hasHighProofOfFunds && profile.maxUpfrontBudgetUsd < 2000) {
      withinUserBudget = 'No';
      budgetAlert = `Upfront Cost Warning: Independent PR/points routes in ${country} typically require government fees, credential/skills assessment, language exams, and/or proof of settlement funds well above $${profile.maxUpfrontBudgetUsd.toLocaleString()} UNLESS you first secure an employer-sponsored job offer that waives settlement funds and covers relocation.`;
    } else if (/germany|netherlands|ireland|sweden|norway|finland|denmark|luxembourg|united kingdom/i.test(country)) {
      withinUserBudget = 'Verify';
      budgetAlert = `Employer-Sponsored Route Recommended for $${profile.maxUpfrontBudgetUsd.toLocaleString()} budget: government work-visa fees are modest (or paid by licensed sponsor), and a valid employment contract avoids independent proof-of-funds requirements.`;
    }

    const confirmations: string[] = [];
    if (needsEnglishTest && !profile.hasEnglishTest) {
      confirmations.push('Language exam (IELTS/PTE/etc.) required for points-based PR — verify employer-sponsored exemptions.');
    }
    if (withinUserBudget === 'No') {
      confirmations.push(`Upfront fees/proof-of-funds exceed $${profile.maxUpfrontBudgetUsd.toLocaleString()} unless employer-sponsored.`);
    }

    const hasFinanceOccupations = (seed.bankingFinanceOccupations || []).length > 0;
    const eligibilityClassification: EligibilityClassification = !seed.foreignApplicantsEligible
      ? 'NOT ELIGIBLE'
      : hasFinanceOccupations && confirmations.length === 0
      ? 'HIGHLY SUITABLE'
      : 'POTENTIALLY SUITABLE';

    const whyRecommended =
      PRIORITY_SETTLEMENT_COUNTRIES[country] ||
      PRIORITY_RELOCATION_COUNTRIES[country] ||
      `${country} publishes official foreign-worker demand across ${seed.professionalOccupationsInDemand.slice(0, 2).join(', ')}.`;

    const isJobOfferNecessary =
      seed.jobOfferRequired ||
      (seed.pathwayClassification === 'direct_pr' && /canada|australia/i.test(country)
        ? 'Not strictly mandatory for independent points streams (e.g., FSWP / Subclass 189), but an employer job offer significantly increases approval speed and can remove/reduce upfront settlement-fund barriers.'
        : 'Yes — a valid job offer from a licensed/recognized employer in the destination country is normally required before applying for the work residence permit.');

    const financialProofAnswer =
      seed.financialProofRequirement ||
      (hasHighProofOfFunds
        ? 'Independent points-based streams require substantial proof of settlement funds (verify current family-size threshold on official portal). Employer-sponsored work visas generally rely on your employment contract salary instead.'
        : 'Generally satisfied by your signed employment contract meeting the statutory minimum salary threshold (confirm on official government portal).');

    const whoPaysAnswer =
      /employer|sponsor/i.test(seed.employerSponsorshipOptions)
        ? 'Employer typically pays sponsorship/licensing fees and may cover work-permit fees and relocation flights (negotiate in offer); applicant pays personal passport/document legalization and any non-reimbursed visa fee.'
        : 'Applicant normally pays government immigration fees, credential evaluations, and relocation unless an employer explicitly sponsors relocation.';

    return {
      id: seed.id,
      country,
      region: seed.region,
      programName: seed.programName,
      officialAuthority: seed.officialAuthority,
      officialUrl: seed.officialApplicationUrl,
      shortageListUrl: seed.shortageOccupationListUrl,
      pathwayCategory,
      isRecommendedByResearch,
      isSelectedByUser,
      whyRecommended,
      eligibilityClassification,
      suitabilityNote:
        confirmations.length > 0
          ? `${seed.ethiopianEligibilityNotes} Items to verify: ${confirmations.join(' ')}`
          : `${seed.ethiopianEligibilityNotes} Finance/accounting occupations are listed among demand roles.`,
      budgetAlert,
      withinUserBudget,
      q1_canEthiopianApplyFromEthiopia: seed.ethiopianEligibilityNotes,
      q2_educationRequired: seed.educationRequirement,
      q3_experienceRequired: seed.experienceRequirement,
      q4_jobOfferNecessary: isJobOfferNecessary,
      q5_languageTestRequired: seed.languageRequirement,
      q6_financialProofRequired: financialProofAnswer,
      q7_officialFees: seed.governmentApplicationFees,
      q8_whoPaysExpenses: whoPaysAnswer,
      q9_canRelocateInitiallyAlone:
        'Yes — principal applicants can relocate alone first to stabilize employment and housing before initiating dependent visas (verify dependent timing rules on official portal).',
      q10_familyReunificationRules: seed.familyRelocationOptions,
      q11_leadsToPermanentResidence: `${pathwayCategory}: ${seed.permanentResidencyRoute}`,
      q12_estimatedTimeline:
        seed.estimatedProcessingStages ||
        (seed.pathwayClassification === 'direct_pr'
          ? 'Typically 6–14 months end-to-end (credential assessment, language test, invitation, and PR decision).'
          : 'Typically 1–4 months for employer-sponsored work visa processing, followed by 2–5 years of lawful work residence to qualify for PR.'),
      q13_officialProcedureAndLink: `Apply directly via ${seed.officialAuthority} (${seed.officialApplicationUrl}) — verify current occupation shortage list at ${seed.shortageOccupationListUrl}.`,
    };
  });

  return [...gulfEmployerSponsoredRoutes, ...mappedSeeds].sort((a, b) => {
    if (a.isSelectedByUser !== b.isSelectedByUser) return a.isSelectedByUser ? -1 : 1;
    if (a.isRecommendedByResearch !== b.isRecommendedByResearch) return a.isRecommendedByResearch ? -1 : 1;
    const rank: Record<EligibilityClassification, number> = {
      'HIGHLY SUITABLE': 3,
      'POTENTIALLY SUITABLE': 2,
      'NOT ELIGIBLE': 1,
    };
    return rank[b.eligibilityClassification] - rank[a.eligibilityClassification];
  });
}

function buildCountryRecommendations(
  evaluatedOpps: EvaluatedMigrationOpportunity[],
  pathways: OfficialImmigration13PointRecord[],
  selectedCountrySet: Set<string>
): CountryRecommendationIntel[] {
  const byCountry = new Map<string, CountryRecommendationIntel>();

  for (const p of pathways) {
    const key = p.country.toLowerCase();
    const isPriorityReloc = Boolean(PRIORITY_RELOCATION_COUNTRIES[p.country]);
    const isPrioritySettle = Boolean(PRIORITY_SETTLEMENT_COUNTRIES[p.country]);
    const tier: CountryRecommendationIntel['tier'] = isPriorityReloc
      ? 'priority_relocation'
      : isPrioritySettle
      ? 'priority_settlement'
      : 'recommended_global';

    byCountry.set(key, {
      country: p.country,
      region: p.region,
      tier,
      tierLabel:
        tier === 'priority_relocation'
          ? 'Employer-Funded Relocation Priority'
          : tier === 'priority_settlement'
          ? 'Career & Long-Term Settlement Priority'
          : 'Verified Global Demand',
      isRecommendedByResearch: p.isRecommendedByResearch,
      isSelectedByUser: selectedCountrySet.has(key),
      whyRecommended: p.whyRecommended,
      activeOpportunityCount: 0,
      highlySuitableCount: 0,
      potentiallySuitableCount: 0,
      employerFundedCount: 0,
      budgetFriendlyCount: 0,
      pathwayTypeLabel: p.pathwayCategory,
      officialPortalUrl: p.officialUrl,
    });
  }

  for (const opp of evaluatedOpps) {
    const key = opp.country.toLowerCase();
    if (!byCountry.has(key)) {
      byCountry.set(key, {
        country: opp.country,
        region: opp.region,
        tier: 'recommended_global',
        tierLabel: 'Active International Hiring',
        isRecommendedByResearch: Boolean(
          PRIORITY_RELOCATION_COUNTRIES[opp.country] || PRIORITY_SETTLEMENT_COUNTRIES[opp.country]
        ),
        isSelectedByUser: selectedCountrySet.has(key),
        whyRecommended:
          'Currently has verified active international recruitment listings open to eligible global applicants.',
        activeOpportunityCount: 0,
        highlySuitableCount: 0,
        potentiallySuitableCount: 0,
        employerFundedCount: 0,
        budgetFriendlyCount: 0,
        pathwayTypeLabel: 'Employer-Sponsored / International Recruitment',
        officialPortalUrl: opp.directOfficialLink,
      });
    }
    const entry = byCountry.get(key)!;
    entry.activeOpportunityCount += 1;
    if (opp.eligibilityClassification === 'HIGHLY SUITABLE') entry.highlySuitableCount += 1;
    if (opp.eligibilityClassification === 'POTENTIALLY SUITABLE') entry.potentiallySuitableCount += 1;
    if (opp.costBreakdown.employerPaidRelocation || opp.costBreakdown.governmentFunded) {
      entry.employerFundedCount += 1;
    }
    if (opp.costBreakdown.withinUserBudget === 'Yes') entry.budgetFriendlyCount += 1;
  }

  for (const selKey of selectedCountrySet) {
    if (!byCountry.has(selKey)) {
      const displayName = selKey
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      byCountry.set(selKey, {
        country: displayName,
        region: 'Global',
        tier: 'recommended_global',
        tierLabel: 'User-Selected Focus Country',
        isRecommendedByResearch: false,
        isSelectedByUser: true,
        whyRecommended: 'Selected by you for continuous priority monitoring.',
        activeOpportunityCount: 0,
        highlySuitableCount: 0,
        potentiallySuitableCount: 0,
        employerFundedCount: 0,
        budgetFriendlyCount: 0,
        pathwayTypeLabel: 'Monitor Official Portals',
        officialPortalUrl: '',
      });
    }
  }

  return Array.from(byCountry.values()).sort((a, b) => {
    if (a.isSelectedByUser !== b.isSelectedByUser) return a.isSelectedByUser ? -1 : 1;
    const tierRank = { priority_relocation: 3, priority_settlement: 2, recommended_global: 1 };
    if (tierRank[b.tier] !== tierRank[a.tier]) return tierRank[b.tier] - tierRank[a.tier];
    if (b.highlySuitableCount !== a.highlySuitableCount) return b.highlySuitableCount - a.highlySuitableCount;
    return b.activeOpportunityCount - a.activeOpportunityCount;
  });
}

function computeOppFingerprint(opp: GlobalOpportunity): string {
  return crypto
    .createHash('sha1')
    .update(
      `${opp.title}|${opp.organization}|${opp.country}|${opp.deadline?.deadlineDateRaw || ''}|${opp.funding?.stipendOrSalary || opp.funding?.fundingSummary || ''}|${opp.officialApplicationUrl || ''}`
    )
    .digest('hex')
    .slice(0, 16);
}

/**
 * Pure evaluation engine for Global Career & Legal Migration Hub.
 * Exported directly so automated tests can verify every classification, budget, and 13-point PR rule deterministically.
 */
export function evaluateMigrationHubPayload(params: {
  rawOpportunities: GlobalOpportunity[];
  profileInput?: Partial<MigrationProfileInput> | null;
  selectedCountries?: string[];
  snapshotMap?: Record<string, OpportunitySnapshotEntry>;
  changeHistory?: ChangeHistoryEvent[];
  lastRefreshAt?: string;
  nextRefreshAt?: string;
}): GlobalMigrationHubEvaluationResponse {
  const nowIso = new Date().toISOString();
  const profile = sanitizeProfile(params.profileInput);
  const selectedCountries = sanitizeSelectedCountries(params.selectedCountries);
  const selectedCountrySet = new Set(selectedCountries.map((c) => c.toLowerCase()));
  const snapshotMap = params.snapshotMap || {};

  // Deduplicate & filter strictly active verified opportunities (never expired, never duplicates)
  const seenKey = new Set<string>();
  const activeVerified: GlobalOpportunity[] = [];
  for (const opp of params.rawOpportunities || []) {
    if (!isOpportunityActiveAndDisplayable(opp)) continue;
    const dedupKey = `${String(opp.title || '').toLowerCase().trim()}|${String(opp.organization || '').toLowerCase().trim()}|${normalizeCountryKey(opp.country || '').toLowerCase()}`;
    if (seenKey.has(dedupKey)) continue;
    seenKey.add(dedupKey);
    activeVerified.push(opp);
  }

  const evaluated = activeVerified
    .map((opp) => {
      const snap = snapshotMap[opp.id];
      const currentFp = computeOppFingerprint(opp);
      let changeStatus: 'new' | 'updated' | 'unchanged' = 'unchanged';
      if (Object.keys(snapshotMap).length > 0) {
        if (!snap) {
          changeStatus = 'new';
        } else if (snap.fingerprint !== currentFp) {
          changeStatus = 'updated';
        }
      }
      return evaluateSingleOpportunity(opp, profile, selectedCountrySet, changeStatus, snap?.firstSeenAt);
    })
    .sort((a, b) => {
      const classRank: Record<EligibilityClassification, number> = {
        'HIGHLY SUITABLE': 3,
        'POTENTIALLY SUITABLE': 2,
        'NOT ELIGIBLE': 1,
      };
      if (classRank[b.eligibilityClassification] !== classRank[a.eligibilityClassification]) {
        return classRank[b.eligibilityClassification] - classRank[a.eligibilityClassification];
      }
      if (a.isInSelectedCountry !== b.isInSelectedCountry) {
        return a.isInSelectedCountry ? -1 : 1;
      }
      if (b.suitabilityScore !== a.suitabilityScore) {
        return b.suitabilityScore - a.suitabilityScore;
      }
      return a.title.localeCompare(b.title);
    });

  const pathways13 = build13PointImmigrationRecords(profile, selectedCountrySet);
  const countryIntel = buildCountryRecommendations(evaluated, pathways13, selectedCountrySet);

  const summary = {
    totalActiveVerified: evaluated.length,
    highlySuitableCount: evaluated.filter((o) => o.eligibilityClassification === 'HIGHLY SUITABLE').length,
    potentiallySuitableCount: evaluated.filter((o) => o.eligibilityClassification === 'POTENTIALLY SUITABLE').length,
    notEligibleCount: evaluated.filter((o) => o.eligibilityClassification === 'NOT ELIGIBLE').length,
    matchingProfileCount: evaluated.filter((o) => o.matchesUserProfile).length,
    nonMatchingCount: evaluated.filter((o) => !o.matchesUserProfile).length,
    washOpportunitiesCount: evaluated.filter((o) => o.isWashOpportunity).length,
    scholarshipsAndTrainingCount: evaluated.filter((o) => o.isScholarshipOrTraining).length,
    budgetFriendlyCount: evaluated.filter((o) => o.costBreakdown.withinUserBudget === 'Yes').length,
    applyFromEthiopiaCount: evaluated.filter((o) => o.canApplyFromEthiopia === 'Yes').length,
    selectedCountryMatchesCount: evaluated.filter((o) => o.isInSelectedCountry && o.matchesUserProfile).length,
    newSinceLastCheckCount: evaluated.filter((o) => o.changeStatus === 'new').length,
    updatedSinceLastCheckCount: evaluated.filter((o) => o.changeStatus === 'updated').length,
    countriesTrackedCount: countryIntel.length,
  };

  return {
    success: true,
    generatedAt: nowIso,
    lastRefreshAt: params.lastRefreshAt || nowIso,
    nextRefreshAt: params.nextRefreshAt || new Date(Date.now() + REFRESH_INTERVAL_MS).toISOString(),
    refreshIntervalMinutes: 30,
    officialDisclaimer: PR_OFFICIAL_DISCLAIMER,
    summary,
    profileUsed: profile,
    selectedCountries,
    recommendedCountries: countryIntel,
    opportunities: evaluated,
    immigrationPathways13Point: pathways13,
    changeHistory: params.changeHistory || [],
  };
}

export function registerGlobalMigrationHubRoutes(deps: RegisterGlobalMigrationHubDeps) {
  const {
    app,
    runtimeBaseDir,
    isVercel,
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    getRequesterUid,
  } = deps;

  const hubStorePath = path.join(runtimeBaseDir, 'data', 'global_migration_hub_store.json');
  const globalOppsStorePath = path.join(runtimeBaseDir, 'data', 'global_opportunities_store.json');

  function loadHubStore(): GlobalMigrationHubStore {
    ensureRuntimeDataDir();
    const nowIso = new Date().toISOString();
    const fallback: GlobalMigrationHubStore = {
      version: 1,
      updatedAt: nowIso,
      lastRefreshAt: nowIso,
      nextRefreshAt: new Date(Date.now() + REFRESH_INTERVAL_MS).toISOString(),
      users: {},
      opportunitySnapshot: {},
      changeHistory: [],
    };
    const loaded = loadJsonFileSafe<Partial<GlobalMigrationHubStore>>(hubStorePath, fallback);
    return {
      version: Number(loaded.version || 1),
      updatedAt: loaded.updatedAt || nowIso,
      lastRefreshAt: loaded.lastRefreshAt || nowIso,
      nextRefreshAt: loaded.nextRefreshAt || new Date(Date.now() + REFRESH_INTERVAL_MS).toISOString(),
      users: loaded.users && typeof loaded.users === 'object' ? loaded.users : {},
      opportunitySnapshot:
        loaded.opportunitySnapshot && typeof loaded.opportunitySnapshot === 'object'
          ? loaded.opportunitySnapshot
          : {},
      changeHistory: Array.isArray(loaded.changeHistory) ? loaded.changeHistory : [],
    };
  }

  function saveHubStore(store: GlobalMigrationHubStore): void {
    ensureRuntimeDataDir();
    store.updatedAt = new Date().toISOString();
    writeJsonFileAtomic(hubStorePath, store);
  }

  function loadLiveGlobalOpportunities(): GlobalOpportunity[] {
    const store = loadJsonFileSafe<Partial<GlobalOpportunitiesStore>>(globalOppsStorePath, {});
    return Array.isArray(store.international_opportunities) ? store.international_opportunities : [];
  }

  function runChangeMonitoringSweep(reason: 'startup' | 'interval_30m' | 'manual'): {
    store: GlobalMigrationHubStore;
    event: ChangeHistoryEvent | null;
  } {
    const store = loadHubStore();
    const liveOpps = loadLiveGlobalOpportunities().filter((o) => isOpportunityActiveAndDisplayable(o));
    const nowIso = new Date().toISOString();
    const prevSnapshot = store.opportunitySnapshot || {};
    const hadBaseline = Object.keys(prevSnapshot).length > 0;

    const nextSnapshot: Record<string, OpportunitySnapshotEntry> = {};
    const newTitles: string[] = [];
    const updatedTitles: string[] = [];
    const activeIds = new Set<string>();

    for (const opp of liveOpps) {
      activeIds.add(opp.id);
      const fp = computeOppFingerprint(opp);
      const prev = prevSnapshot[opp.id];
      const dl = opp.deadline?.deadlineDateRaw || opp.deadline?.deadlineUtcIso || '';
      const sf = opp.funding?.stipendOrSalary || opp.funding?.fundingSummary || '';
      if (!prev) {
        if (hadBaseline) newTitles.push(`${opp.title} (${normalizeCountryKey(opp.country)})`);
        nextSnapshot[opp.id] = {
          id: opp.id,
          title: opp.title,
          deadline: dl,
          salaryOrFunding: sf,
          firstSeenAt: nowIso,
          lastUpdatedAt: nowIso,
          fingerprint: fp,
        };
      } else {
        const changed = prev.fingerprint !== fp;
        if (changed) {
          updatedTitles.push(`${opp.title} (${normalizeCountryKey(opp.country)})`);
        }
        nextSnapshot[opp.id] = {
          ...prev,
          title: opp.title,
          deadline: dl,
          salaryOrFunding: sf,
          lastUpdatedAt: changed ? nowIso : prev.lastUpdatedAt,
          fingerprint: fp,
        };
      }
    }

    let expiredRemovedCount = 0;
    if (hadBaseline) {
      for (const oldId of Object.keys(prevSnapshot)) {
        if (!activeIds.has(oldId)) expiredRemovedCount += 1;
      }
    }

    store.opportunitySnapshot = nextSnapshot;
    store.lastRefreshAt = nowIso;
    store.nextRefreshAt = new Date(Date.now() + REFRESH_INTERVAL_MS).toISOString();

    let createdEvent: ChangeHistoryEvent | null = null;
    const hasMeaningfulDelta =
      !hadBaseline || newTitles.length > 0 || updatedTitles.length > 0 || expiredRemovedCount > 0;

    if (hasMeaningfulDelta) {
      createdEvent = {
        id: `chg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        detectedAt: nowIso,
        summary: !hadBaseline
          ? `Baseline established: tracking ${liveOpps.length} active verified global opportunities across banking, finance, WASH, scholarships & training.`
          : `Monitoring check (${reason}): ${newTitles.length} new, ${updatedTitles.length} updated, ${expiredRemovedCount} expired/closed removed.`,
        newCount: hadBaseline ? newTitles.length : liveOpps.length,
        updatedCount: updatedTitles.length,
        expiredRemovedCount,
        totalActiveVerified: liveOpps.length,
        newTitles: newTitles.slice(0, 12),
        updatedTitles: updatedTitles.slice(0, 12),
      };
      store.changeHistory = [createdEvent, ...(store.changeHistory || [])].slice(0, 40);
    }

    saveHubStore(store);
    return { store, event: createdEvent };
  }

  try {
    runChangeMonitoringSweep('startup');
  } catch (err) {
    console.warn('[GlobalMigrationHub] Initial snapshot notice:', err);
  }

  if (!isVercel && process.env.NODE_ENV !== 'test') {
    const timer = setInterval(() => {
      try {
        runChangeMonitoringSweep('interval_30m');
      } catch (err) {
        console.warn('[GlobalMigrationHub] 30-min refresh notice:', err);
      }
    }, REFRESH_INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
  }

  app.post('/api/global-migration-hub/evaluate', (req: Request, res: Response) => {
    try {
      const store = loadHubStore();
      const uid = getRequesterUid(req);
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
        profile?: Partial<MigrationProfileInput>;
        selectedCountries?: string[];
      };

      const ownWorkspace = uid ? store.users[uid] : undefined;
      const profileInput = body.profile ?? ownWorkspace?.profile ?? DEFAULT_GENERAL_MIGRATION_PROFILE;
      const selectedCountries = Array.isArray(body.selectedCountries)
        ? body.selectedCountries
        : ownWorkspace?.selectedCountries ?? [];

      const liveOpps = loadLiveGlobalOpportunities();
      const payload = evaluateMigrationHubPayload({
        rawOpportunities: liveOpps,
        profileInput,
        selectedCountries,
        snapshotMap: store.opportunitySnapshot,
        changeHistory: store.changeHistory,
        lastRefreshAt: store.lastRefreshAt,
        nextRefreshAt: store.nextRefreshAt,
      });

      res.json(payload);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to evaluate global migration and career opportunities.',
      });
    }
  });

  app.get('/api/global-migration-hub/user-state', (req: Request, res: Response) => {
    const uid = getRequesterUid(req);
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Sign in required to load your private career & migration workspace.',
      });
    }
    const store = loadHubStore();
    const existing = store.users[uid];
    const workspace: UserMigrationWorkspace = existing
      ? {
          profile: sanitizeProfile(existing.profile),
          selectedCountries: sanitizeSelectedCountries(existing.selectedCountries),
          savedOpportunityIds: Array.isArray(existing.savedOpportunityIds)
            ? existing.savedOpportunityIds.slice(0, 200)
            : [],
          applicationTracker: sanitizeTrackerItems(existing.applicationTracker),
          updatedAt: existing.updatedAt || new Date().toISOString(),
        }
      : {
          profile: sanitizeProfile(DEFAULT_GENERAL_MIGRATION_PROFILE),
          selectedCountries: [],
          savedOpportunityIds: [],
          applicationTracker: [],
          updatedAt: new Date().toISOString(),
        };

    return res.json({ success: true, workspace });
  });

  app.put('/api/global-migration-hub/user-state', (req: Request, res: Response) => {
    const uid = getRequesterUid(req);
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Sign in required to save your private career & migration workspace.',
      });
    }
    try {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Partial<UserMigrationWorkspace>;
      const store = loadHubStore();
      const prev = store.users[uid];

      const nextWorkspace: UserMigrationWorkspace = {
        profile: body.profile ? sanitizeProfile(body.profile) : sanitizeProfile(prev?.profile),
        selectedCountries: Array.isArray(body.selectedCountries)
          ? sanitizeSelectedCountries(body.selectedCountries)
          : sanitizeSelectedCountries(prev?.selectedCountries),
        savedOpportunityIds: Array.isArray(body.savedOpportunityIds)
          ? Array.from(
              new Set(
                body.savedOpportunityIds.map((id) => String(id || '').trim().slice(0, 140)).filter(Boolean)
              )
            ).slice(0, 200)
          : Array.isArray(prev?.savedOpportunityIds)
          ? prev.savedOpportunityIds
          : [],
        applicationTracker: Array.isArray(body.applicationTracker)
          ? sanitizeTrackerItems(body.applicationTracker)
          : sanitizeTrackerItems(prev?.applicationTracker),
        updatedAt: new Date().toISOString(),
      };

      store.users[uid] = nextWorkspace;
      saveHubStore(store);

      return res.json({ success: true, workspace: nextWorkspace });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to save your private workspace.',
      });
    }
  });

  app.post('/api/global-migration-hub/refresh-changes', (_req: Request, res: Response) => {
    try {
      const { store, event } = runChangeMonitoringSweep('manual');
      res.json({
        success: true,
        lastRefreshAt: store.lastRefreshAt,
        nextRefreshAt: store.nextRefreshAt,
        meaningfulChangeDetected: Boolean(event),
        latestEvent: event,
        changeHistory: store.changeHistory,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to check for opportunity updates.',
      });
    }
  });
}
