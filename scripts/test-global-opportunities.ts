import assert from 'node:assert/strict';
import * as http from 'node:http';
import {
  classifyEmploymentVisaStatus,
  classifyFundingAndVisaTransparency,
  classifyOpportunityDepartment,
  computeOpportunityFingerprint,
  computeVerificationOutcome,
  detectSectorsFromText,
  EMPLOYMENT_VISA_LABELS,
  evaluateMandatoryVisaCompliance,
  evaluateOpportunityDeadline,
  evaluateOpportunityForUser,
  evaluatePermanentResidencyEligibility,
  evaluateProfessionalRestrictionCompliance,
  isOpportunityActiveAndDisplayable,
  MINIMUM_FULL_DAYS_REMAINING,
  recommendOpportunitiesForUser,
} from '../src/utils/opportunityIntelligenceEngine';
import { validateOfficialExternalUrl } from '../serverGlobalOpportunities';
import { GlobalOpportunity, PermanentResidencyCountryRecord } from '../src/types/globalOpportunities';
import { DEFAULT_JOB_SEEKER_PROFILE, JobSeekerProfile } from '../src/types/jobSeeker';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`FAIL: ${name} -> ${err?.message || err}`);
    failed++;
  }
}

function makeFixtureOpportunity(overrides: Partial<GlobalOpportunity> = {}): GlobalOpportunity {
  const now = Date.now();
  const futureIso = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString();
  const base: GlobalOpportunity = {
    id: 'gopp_test_001',
    fingerprint: 'unicef|wash specialist|unicef.org/careers',
    title: 'WASH Specialist (Water Supply & Sanitation)',
    organization: 'UNICEF',
    organizationType: 'un_agency',
    category: 'wash_opportunity',
    sectors: ['wash', 'humanitarian', 'engineering'],
    isWashDedicated: true,
    isBankingFinance: false,
    country: 'Kenya',
    location: 'Nairobi, Kenya',
    summary: 'International WASH Specialist supporting rural water supply, sanitation, and hygiene promotion.',
    organizationAuthentic: true,
    sourceId: 'reliefweb_jobs_wash_intl',
    sourceName: 'ReliefWeb Official UN & INGO Portal',
    originalSourceUrl: 'https://reliefweb.int/job/12345',
    officialApplicationUrl: 'https://jobs.unicef.org/en-us/job/12345',
    officialDomain: 'jobs.unicef.org',
    applicationStatus: 'open',
    verificationStatus: 'Visa Sponsored',
    hasVerifiedBadge: true,
    httpStatusCode: 200,
    robotsAllowed: true,
    verificationNotes: 'Live official page verified (HTTP 200).',
    sourceEvidenceSnippet: 'UNICEF international recruitment with relocation assistance.',
    funding: {
      id: 'fund_test_001',
      opportunityId: 'gopp_test_001',
      fundingLevel: 'fully_funded',
      fundingSummary: 'International UN salary with relocation assistance',
      transparencyTags: ['Employer-sponsored visa', 'Fully funded'],
      tuitionCovered: 'not_confirmed',
      airfareCovered: 'yes',
      accommodationCovered: 'not_confirmed',
      visaSupportType: 'employer_sponsored_visa',
      visaSupportSummary: 'Employer-sponsored work visa / permit confirmed',
      relocationAssistance: 'yes',
      applicationFee: 'None (Free)',
      verifiedAt: new Date(now).toISOString(),
    },
    eligibility: {
      id: 'elig_test_001',
      opportunityId: 'gopp_test_001',
      eligibleNationalities: ['All nationalities (including Ethiopian citizens)'],
      ethiopianEligible: 'confirmed',
      educationRequirement: "Bachelor's or Master's degree in Water Engineering or Environmental Health",
      minimumEducationLevel: 'bachelors',
      experienceRequirement: 'Minimum 3 years of relevant WASH experience',
      minimumYearsExperience: 3,
      careerLevel: 'mid',
      requiredSkills: ['WASH', 'Water Supply', 'Sanitation', 'Hygiene'],
      languagesRequired: ['English'],
      universityRecommendationRequired: 'not_required',
      companyRecommendationRequired: 'not_required',
      institutionalNominationRequired: 'not_required',
      directIndividualApplicationAllowed: 'yes',
      verifiedAt: new Date(now).toISOString(),
    },
    deadline: {
      id: 'dead_test_001',
      opportunityId: 'gopp_test_001',
      deadlineDateRaw: futureIso,
      deadlineUtcIso: futureIso,
      deadlineTimezone: 'UTC',
      fullDaysRemaining: 10,
      hoursRemaining: 240,
      meetsMinimumThreeFullDays: true,
      isClosingSoon: false,
      isExpired: false,
      startDate: 'Not Confirmed',
      lastCheckedAt: new Date(now).toISOString(),
    },
    discoveredAt: new Date(now).toISOString(),
    lastVerifiedAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };

  return {
    ...base,
    ...overrides,
    funding: { ...base.funding, ...(overrides.funding || {}) },
    eligibility: { ...base.eligibility, ...(overrides.eligibility || {}) },
    deadline: { ...base.deadline, ...(overrides.deadline || {}) },
  };
}

async function main() {
  const fixedNow = Date.UTC(2026, 10, 22, 12, 0, 0); // 2026-11-22T12:00:00Z

  // -----------------------------------------------------------------------
  // 1. DEADLINE & TIMEZONE TESTS (Mandatory >= 3 Full Days / 72 Hours Rule)
  // -----------------------------------------------------------------------
  await runTest('Deadline: rejects exactly 71 hours remaining (< 3 full days)', () => {
    const deadline = new Date(fixedNow + 71 * 60 * 60 * 1000).toISOString();
    const res = evaluateOpportunityDeadline(deadline, 'UTC', fixedNow);
    assert.equal(res.valid, true);
    assert.equal(res.isExpired, false);
    assert.equal(res.meetsMinimumThreeFullDays, false);
    assert.equal(res.fullDaysRemaining, 2);
  });

  await runTest('Deadline: accepts exactly 72 hours remaining (3 full days) and marks Closing Soon', () => {
    const deadline = new Date(fixedNow + 72 * 60 * 60 * 1000).toISOString();
    const res = evaluateOpportunityDeadline(deadline, 'UTC', fixedNow);
    assert.equal(res.valid, true);
    assert.equal(res.isExpired, false);
    assert.equal(res.meetsMinimumThreeFullDays, true);
    assert.equal(res.fullDaysRemaining, MINIMUM_FULL_DAYS_REMAINING);
    assert.equal(res.isClosingSoon, true);
  });

  await runTest('Deadline: rejects expired/past deadlines', () => {
    const past = new Date(fixedNow - 60 * 1000).toISOString();
    const res = evaluateOpportunityDeadline(past, 'UTC', fixedNow);
    assert.equal(res.isExpired, true);
    assert.equal(res.meetsMinimumThreeFullDays, false);
  });

  await runTest('Deadline: rejects missing or "rolling" deadlines (never invents deadline)', () => {
    assert.equal(evaluateOpportunityDeadline('', 'UTC', fixedNow).valid, false);
    assert.equal(evaluateOpportunityDeadline('Rolling', 'UTC', fixedNow).valid, false);
    assert.equal(evaluateOpportunityDeadline('Not Confirmed', 'UTC', fixedNow).valid, false);
  });

  await runTest('Deadline: timezone-aware date-only calculation (Africa/Addis_Ababa UTC+3 vs UTC)', () => {
    // 2026-11-25 23:59:59 EAT (UTC+3) == 2026-11-25 20:59:59 UTC -> 80.99h from 2026-11-22 12:00 UTC (>= 72h)
    const eatRes = evaluateOpportunityDeadline('2026-11-25', 'Africa/Addis_Ababa', fixedNow);
    const utcRes = evaluateOpportunityDeadline('2026-11-25', 'UTC', fixedNow);
    assert.equal(eatRes.meetsMinimumThreeFullDays, true);
    assert.equal(utcRes.meetsMinimumThreeFullDays, true);
    // EAT closes 3 hours earlier in UTC than UTC midnight
    assert.ok(eatRes.hoursRemaining < utcRes.hoursRemaining);
    assert.ok(Math.abs((utcRes.hoursRemaining - eatRes.hoursRemaining) - 3) < 0.2);
  });

  // -----------------------------------------------------------------------
  // 2. VERIFICATION & FUNDING / VISA TRANSPARENCY TESTS
  // -----------------------------------------------------------------------
  await runTest('Funding/Visa: NEVER confuses invitation letter with visa sponsorship or visa fees', () => {
    const classified = classifyFundingAndVisaTransparency({
      fundingSummary: 'Conference registration waived. Organizers provide an official invitation letter for visa application.',
      visaSummary: 'Official invitation letter issued upon acceptance.',
    });
    assert.equal(classified.visaSupportType, 'invitation_letter_only');
    assert.ok(!classified.transparencyTags.includes('Employer-sponsored visa'));
    assert.ok(!classified.transparencyTags.includes('Visa fees funded'));
    assert.ok(classified.transparencyTags.includes('Visa application assistance only'));
  });

  await runTest('Funding/Visa: confirms Employer-Sponsored Visa only when explicitly stated and not negated', () => {
    const positive = classifyFundingAndVisaTransparency({
      visaSummary: 'Employer-sponsored work visa and relocation package provided for international hires.',
    });
    assert.equal(positive.visaSupportType, 'employer_sponsored_visa');
    assert.ok(positive.transparencyTags.includes('Employer-sponsored visa'));

    const negated = classifyFundingAndVisaTransparency({
      visaSummary: 'We cannot sponsor work visas. No visa sponsorship available.',
    });
    assert.notEqual(negated.visaSupportType, 'employer_sponsored_visa');
    assert.equal(negated.visaSupportType, 'none');
  });

  await runTest('Mandatory Visa Filter: accepts employer-sponsored work visa & visa-fee-covered programs, REJECTS visa-free, invitation letter, assistance only, self-paid, unspecified, and withdrawn', () => {
    // 1. Employment: Employer-sponsored work visa PASSES
    const empPass = evaluateMandatoryVisaCompliance(
      'international_job',
      classifyFundingAndVisaTransparency({
        visaSummary: 'Employer-sponsored work visa and work permit sponsorship confirmed by HR.',
      })
    );
    assert.equal(empPass.passed, true);

    // 2. Scholarship: Visa application fee coverage PASSES
    const schPass = evaluateMandatoryVisaCompliance(
      'university_scholarship',
      classifyFundingAndVisaTransparency({
        fundingSummary: 'Fully funded Banking & Finance MSc scholarship. Visa application fees are fully covered.',
      })
    );
    assert.equal(schPass.passed, true);

    // 3. REJECT: Visa-free entry (must NOT confuse with visa sponsorship)
    const visaFree = classifyFundingAndVisaTransparency({
      visaSummary: 'Visa-free entry for eligible passport holders.',
    });
    assert.equal(visaFree.visaSupportType, 'visa_free_not_sponsorship');
    const visaFreeCheck = evaluateMandatoryVisaCompliance('conference_summit', visaFree);
    assert.equal(visaFreeCheck.passed, false);
    assert.ok(visaFreeCheck.reason?.toLowerCase().includes('visa-free'));

    // 4. REJECT: Invitation letter only
    const invOnly = evaluateMandatoryVisaCompliance(
      'conference_summit',
      classifyFundingAndVisaTransparency({
        visaSummary: 'Organizers issue an official invitation letter for visa application.',
      })
    );
    assert.equal(invOnly.passed, false);

    // 5. REJECT: Visa assistance without fee coverage
    const assistOnly = evaluateMandatoryVisaCompliance(
      'professional_training',
      classifyFundingAndVisaTransparency({
        visaSummary: 'Participants receive visa assistance and guidance only.',
      })
    );
    assert.equal(assistOnly.passed, false);

    // 6. REJECT: Applicants must pay own visa fees / withdrawn sponsorship
    const selfPaid = evaluateMandatoryVisaCompliance(
      'university_scholarship',
      classifyFundingAndVisaTransparency({
        visaSummary: 'Applicants must pay their own visa application fees.',
      })
    );
    assert.equal(selfPaid.passed, false);

    // 7. REJECT: Official source contradicts claimed visa sponsorship (e.g., withdrawn post-publication)
    const contradicted = evaluateMandatoryVisaCompliance(
      'international_job',
      {
        visaSupportType: 'employer_sponsored_visa',
        visaSupportSummary: 'Employer-sponsored work visa confirmed',
      },
      'Update: visa sponsorship is no longer available and has been withdrawn for this opening.'
    );
    assert.equal(contradicted.passed, false);

    // 8. REJECT: Unspecified visa funding
    const unspecified = evaluateMandatoryVisaCompliance(
      'professional_training',
      classifyFundingAndVisaTransparency({
        fundingSummary: 'Fully funded training program.',
      })
    );
    assert.equal(unspecified.passed, false);
  });

  await runTest('Professional Restrictions: Scholarships, Training & Conferences strictly restricted to Banking & Finance OR WASH; International Jobs retain existing categories', () => {
    const bankSch = evaluateProfessionalRestrictionCompliance('university_scholarship', {
      title: 'MSc in Banking, Microfinance and Financial Regulation',
      summary: 'Graduate scholarship in central banking, fintech, and accounting.',
    });
    assert.equal(bankSch.passed, true);
    assert.equal(bankSch.domain, 'banking_finance');

    const washConf = evaluateProfessionalRestrictionCompliance('conference_summit', {
      title: 'Global Water Supply, Sanitation and Climate-Resilient WASH Summit',
      summary: 'International symposium on wastewater management and environmental health.',
    });
    assert.equal(washConf.passed, true);
    assert.equal(washConf.domain, 'wash');

    const unrelatedTraining = evaluateProfessionalRestrictionCompliance('professional_training', {
      title: 'International Culinary Arts & Luxury Hospitality Leadership Workshop',
      summary: 'Training for hotel managers and fine dining chefs.',
    });
    assert.equal(unrelatedTraining.passed, false);
    assert.equal(unrelatedTraining.domain, 'restricted');

    const unrelatedScholarship = evaluateProfessionalRestrictionCompliance('university_scholarship', {
      title: 'Master of Fine Arts in Contemporary Sculpture',
      summary: 'Studio arts and gallery curation scholarship.',
    });
    assert.equal(unrelatedScholarship.passed, false);

    // International Jobs keep non-Banking/non-WASH categories (subject to mandatory employer visa sponsorship)
    const intlTechJob = evaluateProfessionalRestrictionCompliance('international_job', {
      title: 'Senior Cloud Infrastructure Engineer',
      summary: 'Distributed systems engineering role with employer-sponsored work visa.',
    });
    assert.equal(intlTechJob.passed, true);
    assert.equal(intlTechJob.domain, 'international_job_allowed');
  });

  await runTest('Verification Gate: unverified URL, <3d deadline, missing visa confirmation, or restricted profession NEVER receives Verified badge', () => {
    const dlOk = evaluateOpportunityDeadline(new Date(fixedNow + 10 * 86400_000).toISOString(), 'UTC', fixedNow);
    const unverified = computeVerificationOutcome({
      urlVerified: false,
      organizationAuthentic: true,
      applicationStatus: 'open',
      deadlineEval: dlOk,
      funding: { fundingLevel: 'fully_funded', visaSupportType: 'visa_fees_funded', visaSupportSummary: 'Official visa fee coverage confirmed' },
      eligibility: { ethiopianEligible: 'confirmed' },
      category: 'university_scholarship',
      title: 'Banking & Finance MSc Scholarship',
      isBankingFinance: true,
    });
    assert.equal(unverified.hasVerifiedBadge, false);
    assert.equal(unverified.verificationStatus, 'Unverified');
    assert.equal(unverified.isPubliclyDisplayable, false);

    const dlShort = evaluateOpportunityDeadline(new Date(fixedNow + 50 * 3600_000).toISOString(), 'UTC', fixedNow);
    const shortRes = computeVerificationOutcome({
      urlVerified: true,
      organizationAuthentic: true,
      applicationStatus: 'open',
      deadlineEval: dlShort,
      funding: { fundingLevel: 'fully_funded', visaSupportType: 'visa_fees_funded', visaSupportSummary: 'Official visa fee coverage confirmed' },
      eligibility: { ethiopianEligible: 'confirmed' },
      category: 'university_scholarship',
      title: 'Banking & Finance MSc Scholarship',
      isBankingFinance: true,
    });
    assert.equal(shortRes.hasVerifiedBadge, false);
    assert.equal(shortRes.isPubliclyDisplayable, false);

    // Fails mandatory visa rule when strictVisaOnly is enforced even with live URL & >= 3 days
    const noVisaRes = computeVerificationOutcome({
      urlVerified: true,
      organizationAuthentic: true,
      applicationStatus: 'open',
      deadlineEval: dlOk,
      funding: { fundingLevel: 'fully_funded', visaSupportType: 'invitation_letter_only', visaSupportSummary: 'Invitation letter only' },
      eligibility: { ethiopianEligible: 'confirmed' },
      category: 'university_scholarship',
      title: 'Banking & Finance MSc Scholarship',
      isBankingFinance: true,
      strictVisaOnly: true,
    });
    assert.equal(noVisaRes.isPubliclyDisplayable, false);
    assert.equal(noVisaRes.rejectionCategory, 'visa');
    assert.equal(noVisaRes.verificationTier, 'REJECTED / POTENTIAL SCAM');

    // Fails professional restriction even with visa fees funded
    const wrongDomainRes = computeVerificationOutcome({
      urlVerified: true,
      organizationAuthentic: true,
      applicationStatus: 'open',
      deadlineEval: dlOk,
      funding: { fundingLevel: 'fully_funded', visaSupportType: 'visa_fees_funded', visaSupportSummary: 'Official visa fee coverage confirmed' },
      eligibility: { ethiopianEligible: 'confirmed' },
      category: 'professional_training',
      title: 'Fashion Design & Textile Photography Bootcamp',
      summary: 'Creative arts workshop.',
    });
    assert.equal(wrongDomainRes.isPubliclyDisplayable, false);
    assert.equal(wrongDomainRes.rejectionCategory, 'professional_restriction');
    assert.equal(wrongDomainRes.verificationTier, 'REJECTED / POTENTIAL SCAM');

    // Passes ALL gates: live official URL, >=3d, visa fees funded, WASH scholarship
    const fullPass = computeVerificationOutcome({
      urlVerified: true,
      organizationAuthentic: true,
      applicationStatus: 'open',
      deadlineEval: dlOk,
      funding: { fundingLevel: 'fully_funded', visaSupportType: 'visa_fees_funded', visaSupportSummary: 'Official visa fee coverage confirmed' },
      eligibility: { ethiopianEligible: 'confirmed' },
      category: 'university_scholarship',
      title: 'MSc in Water Supply, Sanitation and Hygiene (WASH) Engineering',
      isWashDedicated: true,
    });
    assert.equal(fullPass.isPubliclyDisplayable, true);
    assert.equal(fullPass.hasVerifiedBadge, true);
    assert.equal(fullPass.visaCompliancePassed, true);
    assert.equal(fullPass.professionalRestrictionPassed, true);
    assert.equal(fullPass.verificationTier, 'VERIFIED');

    // Transparent 6-tier employment visa status: genuine official Banking job without explicit visa wording => PARTIALLY VERIFIED (never falsely marked Visa Sponsored)
    const noSponsorshipStatedJob = computeVerificationOutcome({
      urlVerified: true,
      organizationAuthentic: true,
      applicationStatus: 'open',
      deadlineEval: dlOk,
      funding: {
        fundingLevel: 'not_confirmed',
        visaSupportType: 'not_confirmed',
        visaSupportSummary: 'No sponsorship stated',
        employmentVisaClassification: 'no_sponsorship_stated',
      },
      eligibility: { ethiopianEligible: 'not_confirmed' },
      category: 'international_job',
      title: 'Senior AML Compliance & Banking Risk Officer',
      isBankingFinance: true,
    });
    assert.equal(noSponsorshipStatedJob.isPubliclyDisplayable, true);
    assert.equal(noSponsorshipStatedJob.verificationTier, 'PARTIALLY VERIFIED');
    assert.notEqual(noSponsorshipStatedJob.verificationStatus, 'Visa Sponsored');
  });

  await runTest('6-Tier Employment Visa Classification & 5-Department Routing: accurate transparent labels without exaggeration', () => {
    const sponsored = classifyEmploymentVisaStatus({
      fullText: 'Employer-sponsored work visa and Skilled Worker visa sponsorship provided for international banking hires.',
    });
    assert.equal(sponsored.classification, 'confirmed_visa_sponsorship');
    assert.equal(sponsored.label, EMPLOYMENT_VISA_LABELS.confirmed_visa_sponsorship);

    const intlRecruit = classifyEmploymentVisaStatus({
      fullText: 'UN International Professional P-3 vacancy open to applicants of all nationalities.',
    });
    assert.equal(intlRecruit.classification, 'confirmed_international_recruitment');

    const relocation = classifyEmploymentVisaStatus({
      fullText: 'Comprehensive relocation assistance and moving allowance offered to successful candidate.',
    });
    assert.equal(relocation.classification, 'relocation_assistance');

    const permit = classifyEmploymentVisaStatus({
      fullText: 'Work permit assistance available through HR immigration team.',
    });
    assert.equal(permit.classification, 'work_permit_assistance');

    const noneStated = classifyEmploymentVisaStatus({
      fullText: 'Senior Internal Auditor required for European banking operations team.',
    });
    assert.equal(noneStated.classification, 'no_sponsorship_stated');

    const notEligible = classifyEmploymentVisaStatus({
      fullText: 'Candidates must already have unrestricted right to work; no visa sponsorship available.',
    });
    assert.equal(notEligible.classification, 'not_eligible_international');

    assert.equal(classifyOpportunityDepartment('international_job', true, false), 'banking_finance_jobs');
    assert.equal(classifyOpportunityDepartment('wash_opportunity', false, true), 'wash_jobs');
    assert.equal(classifyOpportunityDepartment('university_scholarship', true, false), 'banking_wash_scholarships');
    assert.equal(classifyOpportunityDepartment('professional_training', false, true), 'banking_wash_training');
    assert.equal(classifyOpportunityDepartment('conference_summit', true, false), 'banking_wash_conferences');
  });

  await runTest('Official Permanent Residency Eligibility Engine: distinguishes direct PR vs route to PR and never claims shortage = automatic PR', () => {
    const samplePr: PermanentResidencyCountryRecord = {
      id: 'pr_canada_express_entry',
      country: 'Canada',
      region: 'North America',
      programName: 'Express Entry — Federal Skilled Worker & Category-Based Draws',
      pathwayClassification: 'direct_pr',
      pathwayClassificationLabel: 'Direct Permanent Residency Pathway',
      officialAuthority: 'Immigration, Refugees and Citizenship Canada (IRCC)',
      officialApplicationUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html',
      shortageOccupationListUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations/category-based-selection.html',
      officialDomain: 'www.canada.ca',
      httpStatus: 200,
      verificationTier: 'VERIFIED',
      sourceEvidenceExcerpt: 'Official IRCC Express Entry Federal Skilled Worker pathway.',
      professionalOccupationsInDemand: ['Financial Auditors and Accountants', 'Civil Engineers'],
      labourOccupationsInDemand: ['Plumbers', 'Electricians'],
      bankingFinanceOccupations: ['Financial Auditors and Accountants', 'Banking Managers'],
      washWaterOccupations: ['Civil Engineers', 'Water Treatment Operators'],
      foreignApplicantsEligible: true,
      ethiopianCitizensEligible: 'confirmed',
      ethiopianEligibilityNotes: 'Open to eligible skilled applicants worldwide including Ethiopian citizens.',
      educationRequirement: 'Post-secondary degree with ECA',
      experienceRequirement: 'Minimum 1 year skilled experience',
      languageRequirement: 'IELTS / CELPIP CLB 7+',
      ageRestriction: 'Points decrease gradually after age 29',
      skillsAssessmentRequired: 'Educational Credential Assessment (ECA)',
      permanentResidencyRoute: 'Direct Permanent Residency upon Invitation to Apply (ITA)',
      employerSponsorshipOptions: 'Optional LMIA job offer adds CRS points',
      familyRelocationOptions: 'Spouse and dependent children included',
      governmentApplicationFees: 'Verify current IRCC fees on canada.ca',
      officialDisclaimer: 'Labour or skill shortages do NOT automatically grant permanent residency. Governed exclusively by IRCC.',
      lastVerifiedAt: new Date().toISOString(),
    };

    const profile: JobSeekerProfile = {
      ...DEFAULT_JOB_SEEKER_PROFILE,
      uid: 'user_bank_eth',
      email: 'hanna.auditor@example.com',
      fullName: 'Hanna Bekele',
      desiredJobTitle: 'Financial Auditor and Banking Risk Specialist',
      preferredIndustry: 'Banking and Finance',
      yearsOfExperience: '5 years',
      skills: ['Financial Auditing', 'Risk Management', 'IFRS', 'Banking Operations'],
      education: [
        {
          id: 'ed_bank_1',
          institution: 'Addis Ababa University',
          qualification: 'MSc Degree',
          fieldOfStudy: 'Accounting and Finance',
          graduationYear: '2019',
        },
      ],
    };

    const assessment = evaluatePermanentResidencyEligibility(samplePr, profile);
    assert.equal(assessment.country, 'Canada');
    assert.equal(assessment.pathwayClassification, 'direct_pr');
    assert.ok(assessment.matchedCriteria.length >= 1, 'Expected matched criteria for financial/banking profile');
    assert.ok(assessment.disclaimer.toLowerCase().includes('not automatically grant permanent residency'));
  });

  await runTest('Deduplication: produces identical fingerprints for normalized duplicate URLs/titles', () => {
    const fp1 = computeOpportunityFingerprint('WASH Specialist', 'UNICEF', 'https://www.unicef.org/jobs/123?utm_source=abc');
    const fp2 = computeOpportunityFingerprint('wash specialist', 'unicef', 'https://unicef.org/jobs/123#apply');
    assert.equal(fp1, fp2);
  });

  // -----------------------------------------------------------------------
  // 3. ELIGIBILITY & PERSONALIZED RECOMMENDATION TESTS
  // -----------------------------------------------------------------------
  await runTest('Recommendations: matches Ethiopian WASH Water Engineer with transparent match reasons', () => {
    const washProfile: JobSeekerProfile = {
      ...DEFAULT_JOB_SEEKER_PROFILE,
      uid: 'user_wash_eth',
      email: 'water.engineer@example.com',
      fullName: 'Abebe Bikila',
      desiredJobTitle: 'WASH Water Supply Engineer',
      preferredIndustry: 'NGO and International Organizations',
      yearsOfExperience: '5 years',
      skills: ['Water Supply', 'Sanitation', 'Hygiene Promotion', 'Hydraulic Modeling'],
      education: [
        {
          id: 'ed1',
          institution: 'Arba Minch University',
          qualification: 'BSc Degree',
          fieldOfStudy: 'Water Resources and Environmental Engineering',
          graduationYear: '2020',
        },
      ],
    };

    const washOpp = makeFixtureOpportunity();
    const rec = evaluateOpportunityForUser(washOpp, washProfile);
    assert.equal(rec.eligible, true);
    assert.equal(rec.disqualificationReasons.length, 0);
    assert.ok(rec.matchScore >= 55, `Expected strong match score, got ${rec.matchScore}`);
    assert.ok(rec.matchReasons.length >= 2);
  });

  await runTest('Recommendations: STRICTLY excludes user when failing mandatory experience, education, nationality, or nomination rules', () => {
    const juniorProfile: JobSeekerProfile = {
      ...DEFAULT_JOB_SEEKER_PROFILE,
      uid: 'user_junior',
      email: 'fresh@example.com',
      fullName: 'Fresh Graduate',
      desiredJobTitle: 'Junior WASH Officer',
      preferredIndustry: 'WASH',
      yearsOfExperience: '1 year',
      skills: ['WASH', 'Water Supply', 'Sanitation'],
      education: [
        {
          id: 'ed1',
          institution: 'Addis Ababa University',
          qualification: 'Diploma',
          fieldOfStudy: 'Environmental Health',
          graduationYear: '2025',
        },
      ],
    };

    // Fails 3 years mandatory experience + Bachelors degree
    const seniorWash = makeFixtureOpportunity();
    const r1 = evaluateOpportunityForUser(seniorWash, juniorProfile);
    assert.equal(r1.eligible, false);
    assert.ok(r1.disqualificationReasons.length >= 2);

    // Fails nationality exclusion
    const euOnly = makeFixtureOpportunity({
      id: 'gopp_eu_only',
      eligibility: {
        ...seniorWash.eligibility,
        minimumYearsExperience: 0,
        minimumEducationLevel: 'none',
        ethiopianEligible: 'excluded',
        eligibleNationalities: ['EU Citizens Only'],
      },
    });
    const r2 = evaluateOpportunityForUser(euOnly, juniorProfile);
    assert.equal(r2.eligible, false);

    // Fails mandatory university nomination on scholarship
    const nomRequired = makeFixtureOpportunity({
      id: 'gopp_nom_req',
      category: 'university_scholarship',
      eligibility: {
        ...seniorWash.eligibility,
        minimumYearsExperience: 0,
        minimumEducationLevel: 'none',
        ethiopianEligible: 'confirmed',
        universityRecommendationRequired: 'required',
        directIndividualApplicationAllowed: 'no',
      },
    });
    const r3 = evaluateOpportunityForUser(nomRequired, juniorProfile);
    assert.equal(r3.eligible, false);

    // recommendOpportunitiesForUser returns empty when all fail mandatory gates
    const list = recommendOpportunitiesForUser([seniorWash, euOnly, nomRequired], juniorProfile);
    assert.equal(list.length, 0);
  });

  await runTest('Strict Cross-Sector Profile Matching: NEVER recommends Banking training to WASH user or WASH training to Banking user', () => {
    const bankingUser: JobSeekerProfile = {
      ...DEFAULT_JOB_SEEKER_PROFILE,
      uid: 'user_banker',
      email: 'banker@example.com',
      fullName: 'Selamawit Tesfaye',
      desiredJobTitle: 'Senior Credit Risk Analyst',
      preferredIndustry: 'Banking and Finance',
      yearsOfExperience: '6 years',
      skills: ['Credit Risk', 'IFRS 9', 'AML/CFT', 'Financial Analysis', 'Microfinance'],
      education: [
        {
          id: 'ed_b1',
          institution: 'Addis Ababa University',
          qualification: 'MSc Degree',
          fieldOfStudy: 'Accounting and Finance',
          graduationYear: '2019',
        },
      ],
    };

    const washUser: JobSeekerProfile = {
      ...DEFAULT_JOB_SEEKER_PROFILE,
      uid: 'user_wash_only',
      email: 'wash@example.com',
      fullName: 'Dawit Bekele',
      desiredJobTitle: 'Water Supply & Sanitation Engineer',
      preferredIndustry: 'Water Resources & WASH',
      yearsOfExperience: '5 years',
      skills: ['Water Supply', 'Sanitation', 'Hygiene', 'Wastewater Management', 'EPANET'],
      education: [
        {
          id: 'ed_w1',
          institution: 'Arba Minch University',
          qualification: 'BSc Degree',
          fieldOfStudy: 'Water Supply and Environmental Engineering',
          graduationYear: '2020',
        },
      ],
    };

    const bankingTraining = makeFixtureOpportunity({
      id: 'gopp_bank_train',
      title: 'Central Banking & Financial Regulation Executive Training',
      organization: 'Bank for International Settlements',
      category: 'professional_training',
      sectors: ['banking_finance'],
      isWashDedicated: false,
      isBankingFinance: true,
      summary: 'Executive training on banking regulation, microfinance supervision, and fintech oversight.',
      funding: {
        ...makeFixtureOpportunity().funding,
        visaSupportType: 'visa_fees_funded',
        visaSupportSummary: 'Official visa application fee coverage confirmed',
      },
      eligibility: {
        ...makeFixtureOpportunity().eligibility,
        requiredSkills: ['Banking', 'Financial Regulation', 'Credit Risk'],
      },
    });

    const washTraining = makeFixtureOpportunity({
      id: 'gopp_wash_train',
      title: 'Climate-Resilient WASH & Wastewater Management Fellowship',
      organization: 'IHE Delft',
      category: 'professional_training',
      sectors: ['wash'],
      isWashDedicated: true,
      isBankingFinance: false,
      summary: 'Professional WASH training on water supply, sanitation, hygiene, and environmental health.',
      funding: {
        ...makeFixtureOpportunity().funding,
        visaSupportType: 'visa_fees_funded',
        visaSupportSummary: 'Official visa application fee coverage confirmed',
      },
      eligibility: {
        ...makeFixtureOpportunity().eligibility,
        requiredSkills: ['Water Supply', 'Sanitation', 'Hygiene'],
      },
    });

    // Banking user -> Banking training PASSES, WASH training REJECTED
    const bankOnBank = evaluateOpportunityForUser(bankingTraining, bankingUser);
    const bankOnWash = evaluateOpportunityForUser(washTraining, bankingUser);
    assert.equal(bankOnBank.eligible, true);
    assert.equal(bankOnWash.eligible, false);
    assert.ok(bankOnWash.disqualificationReasons.some((r) => /wash/i.test(r)));

    // WASH user -> WASH training PASSES, Banking training REJECTED
    const washOnWash = evaluateOpportunityForUser(washTraining, washUser);
    const washOnBank = evaluateOpportunityForUser(bankingTraining, washUser);
    assert.equal(washOnWash.eligible, true);
    assert.equal(washOnBank.eligible, false);
    assert.ok(washOnBank.disqualificationReasons.some((r) => /banking/i.test(r)));
  });

  await runTest('Sector Intelligence: detects Banking/Finance and WASH sectors accurately', () => {
    const bank = detectSectorsFromText('Central Banking, Digital Banking, Financial Inclusion and Microfinance Risk Management Training');
    assert.equal(bank.isBankingFinance, true);
    assert.ok(bank.sectors.includes('banking_finance'));

    const wash = detectSectorsFromText('Climate-Resilient WASH, Rural Water Supply, Wastewater Management and Hygiene Promotion');
    assert.equal(wash.isWash, true);
    assert.ok(wash.sectors.includes('wash'));
  });

  // -----------------------------------------------------------------------
  // 4. SECURITY & SSRF PROTECTION TESTS
  // -----------------------------------------------------------------------
  await runTest('Security/SSRF: blocks loopback, private IPs, cloud metadata, non-HTTPS, javascript:, and unofficial blogs', () => {
    const blockedUrls = [
      'http://unicef.org/careers',
      'https://127.0.0.1/admin',
      'https://localhost:3000/api',
      'https://169.254.169.254/latest/meta-data/',
      'https://10.0.0.1/internal',
      'https://192.168.1.10/router',
      'https://172.16.0.5/secret',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'https://opportunitiescorners.com/fake-scholarship',
      'https://scholarshippositions.com/post',
      'https://t.me/randomchannel',
    ];
    for (const bad of blockedUrls) {
      const check = validateOfficialExternalUrl(bad);
      assert.equal(check.valid && check.isOfficialDomain, false, `Expected URL to be blocked: ${bad}`);
    }

    const allowedUrls = [
      'https://jobs.unicef.org/en-us/listing',
      'https://www.worldbank.org/en/about/careers',
      'https://www.wateraid.org/uk/careers',
      'https://www.who.int/careers',
      'https://www.daad.de/en/',
      'https://reliefweb.int/jobs',
    ];
    for (const good of allowedUrls) {
      const check = validateOfficialExternalUrl(good);
      assert.equal(check.valid && check.isOfficialDomain, true, `Expected official URL to be allowed: ${good}`);
    }
  });

  // -----------------------------------------------------------------------
  // 5. LIVE SERVER API, AUTH RBAC & REAL OFFICIAL DISCOVERY TESTS
  // -----------------------------------------------------------------------
  process.env.NODE_ENV = 'test';
  const { getApiApp } = await import('../serverApp');
  const app = await getApiApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    await runTest('API Security: rejects unauthenticated admin discovery, logs, and acknowledge-alert requests (HTTP 403)', async () => {
      const r1 = await fetch(`${baseUrl}/api/admin/global-opportunities/run-discovery`, { method: 'POST' });
      assert.equal(r1.status, 403);
      const r2 = await fetch(`${baseUrl}/api/global-opportunities/logs`);
      assert.equal(r2.status, 403);
      const r3 = await fetch(`${baseUrl}/api/admin/global-opportunities/acknowledge-alert`, { method: 'POST' });
      assert.equal(r3.status, 403);
    });

    await runTest('API Security: rejects unauthorized cron trigger (HTTP 401)', async () => {
      const r = await fetch(`${baseUrl}/api/cron/global-opportunities`);
      assert.equal(r.status, 401);
    });

    await runTest('Ethiopia Time 24/7 Schedule Math: computes exact 00:00, 06:00, 12:00, 18:00 Africa/Addis_Ababa slots (UTC 21:00, 03:00, 09:00, 15:00)', async () => {
      const { getNextEthiopiaScheduleSlot, ETHIOPIA_CRON_EXPRESSION_UTC } = await import('../serverGlobalOpportunities');
      assert.equal(ETHIOPIA_CRON_EXPRESSION_UTC, '0 3,9,15,21 * * *');

      // 05:30 EAT (02:30 UTC) -> next slot is 06:00 EAT (03:00 UTC)
      const s1 = getNextEthiopiaScheduleSlot(Date.UTC(2026, 10, 22, 2, 30, 0));
      assert.equal(s1.slotLabelEat, '06:00 Africa/Addis_Ababa');
      assert.equal(s1.utcIso, '2026-11-22T03:00:00.000Z');

      // 06:00:00 EAT exact boundary (03:00:00 UTC) -> next slot is 12:00 EAT (09:00 UTC)
      const s2 = getNextEthiopiaScheduleSlot(Date.UTC(2026, 10, 22, 3, 0, 0));
      assert.equal(s2.slotLabelEat, '12:00 Africa/Addis_Ababa');
      assert.equal(s2.utcIso, '2026-11-22T09:00:00.000Z');

      // 14:15 EAT (11:15 UTC) -> next slot is 18:00 EAT (15:00 UTC)
      const s3 = getNextEthiopiaScheduleSlot(Date.UTC(2026, 10, 22, 11, 15, 0));
      assert.equal(s3.slotLabelEat, '18:00 Africa/Addis_Ababa');
      assert.equal(s3.utcIso, '2026-11-22T15:00:00.000Z');

      // 23:45 EAT (20:45 UTC) -> next slot is 00:00 EAT next calendar day (21:00 UTC same UTC day)
      const s4 = getNextEthiopiaScheduleSlot(Date.UTC(2026, 10, 22, 20, 45, 0));
      assert.equal(s4.slotLabelEat, '00:00 Africa/Addis_Ababa');
      assert.equal(s4.utcIso, '2026-11-22T21:00:00.000Z');
    });

    await runTest('API Sources: exposes 24/7 Ethiopia Time 6h schedule, ReliefWeb, Direct Official Websites Monitor, Gemini Search Grounding, optional Tavily & Brave', async () => {
      const r = await fetch(`${baseUrl}/api/global-opportunities/sources`);
      assert.equal(r.status, 200);
      const body: any = await r.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.sources) && body.sources.length >= 6);
      assert.ok(body.schedulerInfo);
      assert.equal(body.schedulerInfo.intervalMinutes, 360);
      assert.equal(body.schedulerInfo.timezone, 'Africa/Addis_Ababa');
      assert.deepEqual(body.schedulerInfo.scheduleHoursEat, ['00:00', '06:00', '12:00', '18:00']);
      assert.equal(body.schedulerInfo.cronExpressionUtc, '0 3,9,15,21 * * *');
      assert.equal(body.schedulerInfo.operatesWithoutVisitors, true);
      assert.ok(body.schedulerInfo.nextScheduledRunAtEat);
      const ids = body.sources.map((s: any) => s.id);
      assert.ok(ids.includes('reliefweb_jobs_wash_intl'));
      assert.ok(ids.includes('reliefweb_training_conferences'));
      assert.ok(ids.includes('official_direct_website_monitor'));
      assert.ok(ids.includes('gemini_official_search_grounding'));
      assert.ok(ids.includes('tavily_web_search_api'));
      assert.ok(ids.includes('brave_web_search_api'));
      // Confirm discontinued Google Custom Search & Bing v7 are NOT required or listed
      assert.ok(!ids.includes('google_custom_search_api'));
      assert.ok(!ids.includes('bing_web_search_api'));
      const allRequiredVars = body.sources.flatMap((s: any) => s.requiredEnvVars || []);
      assert.ok(!allRequiredVars.includes('GOOGLE_SEARCH_API_KEY'));
      assert.ok(!allRequiredVars.includes('GOOGLE_SEARCH_CX'));
    });

    await runTest('Autonomous Schedule & Provider Configuration: defaults to 360-min (6h) interval and respects OPPORTUNITY_SEARCH_PROVIDERS', async () => {
      const { getEnabledSearchProviders, getDiscoveryIntervalMinutes } = await import('../serverGlobalOpportunities');
      const prevProviders = process.env.OPPORTUNITY_SEARCH_PROVIDERS;
      const prevInterval = process.env.DISCOVERY_INTERVAL_MINUTES;
      try {
        delete process.env.DISCOVERY_INTERVAL_MINUTES;
        assert.equal(getDiscoveryIntervalMinutes(), 360);
        process.env.DISCOVERY_INTERVAL_MINUTES = '180';
        assert.equal(getDiscoveryIntervalMinutes(), 180);
        process.env.DISCOVERY_INTERVAL_MINUTES = '2'; // Clamped safely to >= 10 minutes
        assert.equal(getDiscoveryIntervalMinutes(), 10);

        process.env.OPPORTUNITY_SEARCH_PROVIDERS = 'reliefweb,direct_websites,gemini';
        const subset = getEnabledSearchProviders();
        assert.equal(subset.has('reliefweb'), true);
        assert.equal(subset.has('direct_websites'), true);
        assert.equal(subset.has('gemini'), true);
        assert.equal(subset.has('tavily'), false);
        assert.equal(subset.has('brave'), false);

        process.env.OPPORTUNITY_SEARCH_PROVIDERS = 'auto';
        const full = getEnabledSearchProviders();
        assert.equal(full.has('reliefweb'), true);
        assert.equal(full.has('direct_websites'), true);
        assert.equal(full.has('gemini'), true);
        assert.equal(full.has('tavily'), true);
        assert.equal(full.has('brave'), true);
      } finally {
        if (prevProviders === undefined) delete process.env.OPPORTUNITY_SEARCH_PROVIDERS;
        else process.env.OPPORTUNITY_SEARCH_PROVIDERS = prevProviders;
        if (prevInterval === undefined) delete process.env.DISCOVERY_INTERVAL_MINUTES;
        else process.env.DISCOVERY_INTERVAL_MINUTES = prevInterval;
      }
    });

    await runTest('Live 6-Hour Scheduled Discovery, Overlap Lock & Verification: prevents concurrent overlap, records metrics, and enforces >= 3 full days rule', async () => {
      // Fire 2 concurrent scheduled requests to verify overlap prevention lock
      const [cronRes1, cronRes2] = await Promise.all([
        fetch(`${baseUrl}/api/cron/global-opportunities?source=github_actions`, {
          method: 'GET',
          headers: { 'x-vercel-cron': '1' },
        }),
        new Promise<Response>((resolve) =>
          setTimeout(
            () =>
              resolve(
                fetch(`${baseUrl}/api/cron/global-opportunities?source=github_actions`, {
                  method: 'GET',
                  headers: { 'x-vercel-cron': '1' },
                })
              ),
            120
          )
        ),
      ]);
      assert.equal(cronRes1.status, 200);
      assert.equal(cronRes2.status, 200);
      const body1: any = await cronRes1.json();
      const body2: any = await cronRes2.json();
      assert.equal(body1.success, true);
      assert.equal(body2.success, true);

      const primaryLog = body1.runLog.skippedOverlap ? body2.runLog : body1.runLog;
      const overlapLog = body1.runLog.skippedOverlap ? body1.runLog : body2.runLog;
      assert.equal(overlapLog.skippedOverlap, true, 'Expected second concurrent scheduled execution to be safely skipped by overlap lock');
      assert.equal(primaryLog.trigger, 'github_actions_cron');
      assert.ok(primaryLog.candidatesDiscovered > 0, 'Expected live official sources to discover candidates');

      console.log(
        `   [Live Discovery Summary] trigger=${primaryLog.trigger}, sources=${primaryLog.sourcesQueried}, discovered=${primaryLog.candidatesDiscovered}, verified=${primaryLog.verifiedAndActiveCount}, rejectedVisa=${primaryLog.rejectedDueToVisaCount ?? 0}, rejectedProf=${primaryLog.rejectedDueToProfessionalRestrictionCount ?? 0}, autoUnpublished=${primaryLog.autoUnpublishedCount ?? 0}, excluded<3d=${primaryLog.rejectedUnderThreeDaysCount}`
      );

      // Verify GET /api/global-opportunities strictly returns verified opportunities with >= 3 full days + mandatory visa compliance
      const listRes = await fetch(`${baseUrl}/api/global-opportunities`);
      assert.equal(listRes.status, 200);
      const listBody: any = await listRes.json();
      assert.equal(listBody.success, true);
      assert.equal(listBody.minimumDaysRemainingRule, 3);
      assert.equal(listBody.schedulerInfo?.intervalMinutes, 360);
      assert.equal(listBody.schedulerInfo?.timezone, 'Africa/Addis_Ababa');
      assert.ok(listBody.schedulerInfo?.lastSuccessfulRunAtEat, 'Expected lastSuccessfulRunAtEat to be recorded');
      assert.ok(listBody.schedulerInfo?.nextScheduledRunAtEat, 'Expected nextScheduledRunAtEat to be computed');
      assert.ok(listBody.schedulerInfo?.connectedSourcesCount >= 3, 'Expected >= 3 connected sources');
      assert.ok(listBody.websiteOnlyPolicyNote.toLowerCase().includes('no emails, sms, whatsapp, or push'));

      const directMonitor = (listBody.sources || []).find((s: any) => s.id === 'official_direct_website_monitor');
      assert.ok(directMonitor, 'Expected official_direct_website_monitor in sources');
      assert.ok(
        Array.isArray(directMonitor.monitoredPortals) && directMonitor.monitoredPortals.length >= 8,
        'Expected live monitoredPortals health results'
      );
      const healthyCount = directMonitor.monitoredPortals.filter(
        (p: any) => typeof p.httpStatus === 'number' && p.httpStatus >= 200 && p.httpStatus < 400
      ).length;
      assert.ok(healthyCount >= 6, `Expected at least 6 reachable official portals, got ${healthyCount}`);
      console.log(
        `   [Direct Official Portals] ${healthyCount}/${directMonitor.monitoredPortals.length} HTTP 200 verified, extracted=${directMonitor.lastItemCount}`
      );

      for (const opp of listBody.opportunities) {
        assert.equal(opp.hasVerifiedBadge, true, `Unverified opp leaked into public API: ${opp.id}`);
        assert.equal(opp.isArchived, false, `Archived opp leaked into public API: ${opp.id}`);
        assert.ok(opp.deadline.fullDaysRemaining >= 3, `Opp with <3 days leaked: ${opp.id}`);
        assert.ok(opp.officialApplicationUrl.startsWith('https://'), `Non-HTTPS URL leaked: ${opp.id}`);
        assert.ok(
          opp.verificationTier === 'VERIFIED' || opp.verificationTier === 'PARTIALLY VERIFIED',
          `Unexpected verificationTier leaked into public API: ${opp.id} (${opp.verificationTier})`
        );
        if (opp.funding.employmentVisaClassification === 'confirmed_visa_sponsorship') {
          assert.equal(
            opp.funding.visaSupportType,
            'employer_sponsored_visa',
            `Visa sponsorship exaggerated without employer_sponsored_visa evidence: ${opp.id}`
          );
        }
        assert.equal(
          evaluateProfessionalRestrictionCompliance(opp.category, opp).passed,
          true,
          `Restricted-profession opp leaked into public API: ${opp.id}`
        );
        assert.equal(isOpportunityActiveAndDisplayable(opp), true);
      }

      // Verify Department 6 Official Government Permanent Residency & Labour Shortage Country Intelligence endpoint
      assert.ok(
        Array.isArray(listBody.permanentResidencyPathways) && listBody.permanentResidencyPathways.length >= 14,
        `Expected >= 14 official government PR country pathways, got ${listBody.permanentResidencyPathways?.length}`
      );
      assert.ok(listBody.countsBySubsection?.permanent_residency >= 14);

      const prRes = await fetch(`${baseUrl}/api/global-opportunities/permanent-residency`);
      assert.equal(prRes.status, 200);
      const prBody: any = await prRes.json();
      assert.equal(prBody.success, true);
      assert.ok(prBody.totalCountries >= 14);
      assert.ok(prBody.directPrCount >= 3, 'Expected Direct PR pathways (e.g. Canada, Australia, New Zealand)');
      assert.ok(prBody.routeToPrCount >= 5, 'Expected Route-to-PR pathways');
      assert.ok(prBody.temporaryPermitCount >= 1, 'Expected Temporary Work Permit classification');
      assert.ok(
        prBody.disclaimer.toLowerCase().includes('do not automatically grant permanent residency'),
        'Expected official PR non-guarantee disclaimer'
      );
      for (const pathway of prBody.pathways) {
        assert.ok(pathway.officialApplicationUrl.startsWith('https://'), `Non-HTTPS PR portal URL: ${pathway.country}`);
        assert.ok(pathway.shortageOccupationListUrl.startsWith('https://'), `Non-HTTPS shortage list URL: ${pathway.country}`);
      }
      console.log(
        `   [Official PR Intelligence] ${prBody.totalCountries} countries (Direct PR=${prBody.directPrCount}, Route to PR=${prBody.routeToPrCount}, Temp Permit=${prBody.temporaryPermitCount})`
      );
    });

    // -----------------------------------------------------------------------
    // 6. HUMANIZE TEXT & HUMANIZE CHECKER API TESTS
    // -----------------------------------------------------------------------
    await runTest('Writing API (Humanize Text): validates input, preserves technical terms, supports document types & styles', async () => {
      const badRes = await fetch(`${baseUrl}/api/writing/humanize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Too short' }),
      });
      assert.equal(badRes.status, 400);

      const sampleText =
        "In today's fast-paced world, I am writing to express my keen interest in the WASH Water Engineer role. I utilized EPANET and GIS in order to facilitate the implementation of rural water supply projects, and I possess a strong background in IFRS budgeting and sanitation hygiene. Please do not hesitate to contact me at this point in time.";

      const okRes = await fetch(`${baseUrl}/api/writing/humanize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          documentType: 'cover_letter',
          style: 'concise',
        }),
      });
      assert.equal(okRes.status, 200);
      const data: any = await okRes.json();
      assert.ok(typeof data.revisedText === 'string' && data.revisedText.length > 20);
      assert.equal(data.documentType, 'cover_letter');
      assert.equal(data.style, 'concise');
      assert.ok(data.revisedText.includes('EPANET'), 'Expected technical term EPANET to be preserved');
      assert.ok(data.revisedText.includes('IFRS'), 'Expected technical term IFRS to be preserved');
      assert.ok(Array.isArray(data.improvementsApplied) && data.improvementsApplied.length > 0);
      assert.ok(data.integrityNotice.toLowerCase().includes('never invents'));
    });

    await runTest('Writing API (Humanize Checker): detects readability, clichés, tone inconsistency, repetition, long sentences, alternatives, and ethical transparency notice', async () => {
      const draft =
        "Dear Sir, in today's fast-paced world, I'm super excited to delve deeply into this scholarship because I have tons of experience in microfinance and AML/CFT compliance and I believe that this program is of paramount importance due to the fact that it will allow me to strengthen banking regulation and financial inclusion systems across regional institutions while delivering measurable outcomes. I lead credit risk audits. I lead credit risk audits. I lead banking reviews. I lead financial reports.";

      const res = await fetch(`${baseUrl}/api/writing/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: draft,
          documentType: 'scholarship_application',
        }),
      });
      assert.equal(res.status, 200);
      const report: any = await res.json();
      assert.ok(typeof report.overallQualityScore === 'number' && report.overallQualityScore >= 0 && report.overallQualityScore <= 100);
      assert.ok(typeof report.metrics?.fleschReadingEase === 'number');
      assert.ok(report.metrics.wordCount > 50);
      assert.ok(Array.isArray(report.issues) && report.issues.length >= 3);
      const issueCategories = new Set(report.issues.map((i: any) => i.category));
      assert.ok(issueCategories.has('generic_expression') || issueCategories.has('unnatural_wording'));
      assert.ok(issueCategories.has('overly_complicated'), 'Expected long sentence detection');
      assert.ok(issueCategories.has('inconsistent_tone'), 'Expected inconsistent tone detection');
      assert.ok(issueCategories.has('repetitive_sentence'), 'Expected repetitive sentence detection');
      assert.ok(Array.isArray(report.alternatives) && report.alternatives.length >= 2);
      assert.ok(typeof report.improvedVersion === 'string' && report.improvedVersion.includes('AML/CFT'));
      // Ethical transparency verification: NEVER claims to detect AI authorship or bypass detectors
      assert.ok(report.transparencyNotice.toLowerCase().includes('does not promise to bypass ai detectors'));
      assert.ok(report.transparencyNotice.toLowerCase().includes('no automated detector can reliably prove'));
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log(`\n=== TEST SUITE SUMMARY: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
