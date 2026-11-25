/**
 * Automated verification suite for the HopelandJobs Master International Career,
 * Visa Sponsorship, USD Salary, 22-Country Permanent Residency, Weighted CV Matching,
 * and Admin Moderation/CSV Export upgrade.
 */
import assert from 'node:assert/strict';
import {
  CAREER_SPECIALTY_LABELS,
  classifyCareerSpecialtyCategory,
  classifySevenTierVisaSponsorship,
  detectInternationalRegion,
  evaluateWeightedCareerMatch,
  extractGroundedProfileFromCvText,
  parseAndNormalizeSalaryUsd,
  PRIMARY_BENCHMARK_PROFILE,
  scorePrPathwayForCareerProfile,
} from '../src/utils/internationalCareerIntelligence';
import { OFFICIAL_GOVERNMENT_PR_SEEDS } from '../serverPermanentResidency';
import { GlobalOpportunity, PermanentResidencyCountryRecord } from '../src/types/globalOpportunities';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    console.error(`  [FAIL] ${name}: ${err?.message || err}`);
    process.exitCode = 1;
  }
}

function makeSampleOpp(overrides: Partial<GlobalOpportunity> = {}): GlobalOpportunity {
  const nowIso = new Date().toISOString();
  const futureIso = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
  const base: GlobalOpportunity = {
    id: 'test-opp-1',
    fingerprint: 'fp-1',
    title: 'Branch Banking Operations Manager',
    organization: 'Nordic International Bank',
    organizationType: 'financial_institution',
    category: 'international_job',
    sectors: ['banking_finance'],
    country: 'Ireland',
    location: 'Dublin, Ireland',
    summary:
      'Lead branch banking operations, deposit mobilization, credit administration, internal controls, AML compliance, and staff supervision. Employer provides Critical Skills Employment Permit visa sponsorship and full relocation package for international applicants from abroad including Ethiopia. English is the working language. Gross salary EUR 72,000 per year plus medical insurance and relocation allowance.',
    originalSourceUrl: 'https://careers.examplebank.ie/roles/123',
    officialApplicationUrl: 'https://careers.examplebank.ie/roles/123',
    officialDomain: 'careers.examplebank.ie',
    sourceId: 'official-bank',
    sourceName: 'Official Bank Portal',
    applicationStatus: 'open',
    verificationStatus: 'Verified and Open',
    verificationTier: 'VERIFIED',
    organizationAuthentic: true,
    hasVerifiedBadge: true,
    deadline: {
      id: 'dl-1',
      opportunityId: 'test-opp-1',
      deadlineDateRaw: futureIso,
      deadlineUtcIso: futureIso,
      deadlineTimezone: 'UTC',
      startDate: 'Not Confirmed',
      fullDaysRemaining: 20,
      hoursRemaining: 480,
      meetsMinimumThreeFullDays: true,
      isClosingSoon: false,
      isExpired: false,
      lastCheckedAt: nowIso,
    },
    eligibility: {
      id: 'el-1',
      opportunityId: 'test-opp-1',
      eligibleNationalities: ['All nationalities including Ethiopia'],
      ethiopianEligible: 'confirmed',
      educationRequirement: "Bachelor's degree in Accounting, Finance, or Banking",
      minimumEducationLevel: 'bachelors',
      experienceRequirement: '7+ years in commercial banking with 3+ years management experience',
      minimumYearsExperience: 7,
      careerLevel: 'management',
      requiredSkills: ['Banking operations', 'Branch management', 'Internal controls', 'Risk management', 'Compliance'],
      languagesRequired: ['English'],
      universityRecommendationRequired: 'not_required',
      companyRecommendationRequired: 'not_required',
      institutionalNominationRequired: 'not_required',
      directIndividualApplicationAllowed: 'yes',
      verifiedAt: nowIso,
    },
    funding: {
      id: 'fn-1',
      opportunityId: 'test-opp-1',
      fundingLevel: 'not_confirmed',
      fundingSummary: 'Competitive international compensation package',
      airfareCovered: 'yes',
      accommodationCovered: 'not_confirmed',
      tuitionCovered: 'not_confirmed',
      stipendOrSalary: 'EUR 72,000 per year gross',
      applicationFee: 'Free',
      visaSupportType: 'employer_sponsored_visa',
      employmentVisaClassification: 'confirmed_visa_sponsorship',
      relocationAssistance: 'yes',
      visaSupportSummary: 'Explicit employer visa sponsorship and relocation assistance',
      transparencyTags: ['Employer-sponsored visa'],
      verifiedAt: nowIso,
    },
    isBankingFinance: true,
    isWashDedicated: false,
    httpStatusCode: 200,
    robotsAllowed: true,
    verificationNotes: 'Verified live against official careers portal.',
    sourceEvidenceSnippet: 'Employer provides Critical Skills Employment Permit visa sponsorship.',
    discoveredAt: nowIso,
    lastVerifiedAt: nowIso,
    updatedAt: nowIso,
  };
  return { ...base, ...overrides };
}

console.log('Running HopelandJobs Master International Career Upgrade Verification...');

test('1. Region detection maps Europe, Middle East, Asia-Pacific, North America, Africa & Other accurately', () => {
  assert.equal(detectInternationalRegion('Germany', 'Frankfurt'), 'Europe');
  assert.equal(detectInternationalRegion('Lithuania', 'Vilnius'), 'Europe');
  assert.equal(detectInternationalRegion('United Arab Emirates', 'Dubai'), 'Middle East');
  assert.equal(detectInternationalRegion('Saudi Arabia', 'Riyadh'), 'Middle East');
  assert.equal(detectInternationalRegion('Singapore', 'Singapore'), 'Asia-Pacific');
  assert.equal(detectInternationalRegion('Mauritius', 'Port Louis'), 'Africa & Other');
  assert.equal(detectInternationalRegion('Canada', 'Toronto'), 'North America');
});

test('2. 8 professional career categories classify Banking, Finance, Risk/Compliance, Credit, Fintech, Insurance, NGO, Management & WASH', () => {
  assert.equal(classifyCareerSpecialtyCategory('AML Compliance Manager', 'KYC and operational risk'), 'risk_compliance');
  assert.equal(classifyCareerSpecialtyCategory('Digital Banking Product Lead', 'Mobile money and fintech payments'), 'fintech_digital_finance');
  assert.equal(classifyCareerSpecialtyCategory('Microfinance Credit Manager', 'SME loan portfolio administration'), 'credit_microfinance');
  assert.equal(classifyCareerSpecialtyCategory('WASH Coordinator', 'Water and sanitation emergency response'), 'wash_engineering_health');
  assert.ok(Object.keys(CAREER_SPECIALTY_LABELS).length >= 8);
});

test('3. 7-Tier Visa Sponsorship never labels unconfirmed abroad job as sponsored', () => {
  const sponsoredOpp = makeSampleOpp();
  const sponsoredRes = classifySevenTierVisaSponsorship(sponsoredOpp);
  assert.equal(sponsoredRes.sponsorshipConfirmed, true);
  assert.equal(sponsoredRes.isPriorityTier, true);

  const base = makeSampleOpp();
  const unconfirmedOpp = makeSampleOpp({
    summary: 'Accountant role in Berlin. Manage monthly financial reporting and general ledger.',
    sourceEvidenceSnippet: '',
    funding: {
      ...base.funding,
      fundingLevel: 'not_confirmed',
      fundingSummary: 'Salary competitive',
      airfareCovered: 'not_confirmed',
      accommodationCovered: 'not_confirmed',
      tuitionCovered: 'not_confirmed',
      stipendOrSalary: '',
      visaSupportType: 'not_confirmed',
      employmentVisaClassification: 'no_sponsorship_stated',
      relocationAssistance: 'not_confirmed',
      visaSupportSummary: 'Not stated',
      transparencyTags: [],
    },
    eligibility: {
      ...base.eligibility,
      eligibleNationalities: ['Not Confirmed'],
      ethiopianEligible: 'not_confirmed',
      educationRequirement: 'Bachelor in Accounting',
      experienceRequirement: '5 years',
      minimumYearsExperience: 5,
      careerLevel: 'mid',
      requiredSkills: ['Accounting'],
    },
  });
  const unconfirmedRes = classifySevenTierVisaSponsorship(unconfirmedOpp);
  assert.equal(unconfirmedRes.sponsorshipConfirmed, false);
  assert.ok(/sponsorship not confirmed/i.test(unconfirmedRes.displayLabel));
});

test('4. Local-only jobs are flagged as local_applicants_only and NEVER marked sponsored', () => {
  const base = makeSampleOpp();
  const localOnlyOpp = makeSampleOpp({
    summary: 'Must already have valid right to work in the UK. No visa sponsorship available.',
    funding: {
      ...base.funding,
      fundingLevel: 'not_confirmed',
      fundingSummary: 'Competitive',
      airfareCovered: 'no',
      accommodationCovered: 'no',
      tuitionCovered: 'no',
      stipendOrSalary: 'GBP 55,000/year',
      visaSupportType: 'none',
      employmentVisaClassification: 'no_sponsorship_stated',
      relocationAssistance: 'no',
      visaSupportSummary: 'No sponsorship',
      transparencyTags: [],
    },
  });
  const res = classifySevenTierVisaSponsorship(localOnlyOpp);
  assert.equal(res.category, 'local_applicants_only');
  assert.equal(res.sponsorshipConfirmed, false);
});

test('5. USD Salary Standardization converts EUR/AED accurately and NEVER fabricates missing salary', () => {
  const oppWithSalary = makeSampleOpp();
  const sal = parseAndNormalizeSalaryUsd(oppWithSalary, 3000);
  assert.equal(sal.hasAdvertisedSalary, true);
  assert.equal(sal.currency, 'EUR');
  assert.equal(sal.grossOrNet, 'gross');
  assert.ok((sal.estimatedMonthlyUsd || 0) >= 6000);
  assert.equal(sal.meetsTargetMinimum, true);

  const oppNoSalary = makeSampleOpp({
    summary: 'Senior Finance Manager with visa sponsorship.',
    funding: {
      ...makeSampleOpp().funding,
      stipendOrSalary: '',
    },
  });
  const missingSal = parseAndNormalizeSalaryUsd(oppNoSalary, 3000);
  assert.equal(missingSal.hasAdvertisedSalary, false);
  assert.equal(missingSal.estimatedMonthlyUsd, null);
});

test('6. 100-Point Weighted Matching scores Ethiopian Branch Manager Benchmark >= 80% on strong sponsored match and caps <= 45% on local-only role', () => {
  const strongOpp = makeSampleOpp();
  const strongMatch = evaluateWeightedCareerMatch(strongOpp, PRIMARY_BENCHMARK_PROFILE);
  assert.ok(strongMatch.totalScore >= 80, `Expected >= 80, got ${strongMatch.totalScore}`);
  assert.equal(strongMatch.cappedDueToWorkAuth, false);
  const sum =
    strongMatch.breakdown.educationScore +
    strongMatch.breakdown.experienceScore +
    strongMatch.breakdown.responsibilityScore +
    strongMatch.breakdown.visaEligibilityScore +
    strongMatch.breakdown.salaryScore +
    strongMatch.breakdown.languageScore +
    strongMatch.breakdown.relocationFamilyScore;
  assert.equal(sum, strongMatch.totalScore);

  const localOnlyOpp = makeSampleOpp({
    summary: 'Branch Manager in London. Must have existing UK right to work. Sponsorship is not offered.',
    funding: {
      ...makeSampleOpp().funding,
      visaSupportType: 'none',
      employmentVisaClassification: 'no_sponsorship_stated',
      relocationAssistance: 'no',
    },
  });
  const cappedMatch = evaluateWeightedCareerMatch(localOnlyOpp, PRIMARY_BENCHMARK_PROFILE);
  assert.equal(cappedMatch.cappedDueToWorkAuth, true);
  assert.ok(cappedMatch.totalScore <= 45, `Expected <= 45 when ineligible for work auth, got ${cappedMatch.totalScore}`);
});

test('7. Strictly grounded CV extraction reads stated credentials and NEVER invents missing qualifications', () => {
  const sampleCv = `
    Addis Ababa, Ethiopia
    Experience: 9 years of professional experience in commercial banking.
    Role: Branch Manager (2023 - 2026) — Staff supervision, deposit mobilization, credit administration, internal controls, banking compliance.
    Education: BA in Accounting and Finance, Mekelle University.
    Languages: English, Amharic.
  `;
  const extracted = extractGroundedProfileFromCvText(sampleCv);
  assert.equal(extracted.nationality, 'Ethiopian');
  assert.equal(extracted.totalYearsExperience, 9);
  assert.match(extracted.educationDegree, /BA/i);
  assert.match(extracted.educationField, /Accounting and Finance/i);
  assert.equal(extracted.currentPosition, 'Branch Manager');
  assert.ok(extracted.cvEvidenceSnippets && extracted.cvEvidenceSnippets.length >= 2);

  // Sparse CV must NOT invent a degree or years of experience
  const sparse = extractGroundedProfileFromCvText('Hello, I am looking for opportunities in customer service.');
  assert.equal(sparse.totalYearsExperience, 0);
  assert.equal(sparse.educationDegree, 'Not specified in CV');
});

test('8. Official Government Permanent Residency registry covers >= 22 official countries with all 12 Section 7 criteria', () => {
  assert.ok(
    OFFICIAL_GOVERNMENT_PR_SEEDS.length >= 22,
    `Expected >= 22 official PR countries, found ${OFFICIAL_GOVERNMENT_PR_SEEDS.length}`
  );
  const countries = new Set(OFFICIAL_GOVERNMENT_PR_SEEDS.map((p) => p.country));
  for (const required of ['Canada', 'Germany', 'Ireland', 'United Kingdom', 'Netherlands', 'Luxembourg', 'Poland', 'United Arab Emirates', 'Saudi Arabia', 'Singapore', 'Mauritius']) {
    assert.ok(countries.has(required), `Missing required PR/migration country: ${required}`);
  }
  const nowIso = new Date().toISOString();
  for (const seed of OFFICIAL_GOVERNMENT_PR_SEEDS) {
    assert.ok(seed.officialApplicationUrl.startsWith('https://'), `${seed.country} must use official https URL`);
    assert.ok(seed.ethiopianEligibilityNotes.length > 10, `${seed.country} missing Ethiopian eligibility notes`);
    assert.ok(seed.governmentApplicationFees.length > 3, `${seed.country} missing government fees`);
    assert.ok(seed.familyRelocationOptions.length > 5, `${seed.country} missing family reunification info`);
    const record: PermanentResidencyCountryRecord = {
      ...seed,
      httpStatus: 200,
      verificationTier: 'VERIFIED',
      sourceEvidenceExcerpt: 'Official government immigration portal verified.',
      officialDisclaimer: 'Labour shortage does not guarantee permanent residency.',
      lastVerifiedAt: nowIso,
    };
    const prFit = scorePrPathwayForCareerProfile(record, PRIMARY_BENCHMARK_PROFILE);
    assert.ok(prFit.fitLevel.length > 0);
  }
});

if (process.exitCode && process.exitCode !== 0) {
  console.error(`\nVerification finished with failures (${passed} passed).`);
  process.exit(1);
} else {
  console.log(`\nALL ${passed} INTERNATIONAL CAREER UPGRADE TESTS PASSED.`);
}
