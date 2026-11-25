import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import express from 'express';
import http from 'node:http';
import {
  BRANCH_BANKING_REFERENCE_PROFILE,
  evaluateForBranchBankingSpecialFeature,
  evaluateOpportunityForUserProfile,
} from '../src/utils/strictOpportunityMatcher';
import type { UserProfessionalProfileInput } from '../src/types/opportunityIntelligence';
import {
  OpportunityIntelligenceEngine,
  registerOpportunityIntelligenceRoutes,
} from '../serverOpportunityIntelligence';

async function runMasterAcceptanceTests() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hopeland-oi-master-test-'));
  fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true });

  const loadJsonFileSafe = <T,>(filePath: string, fallback: T): T => {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch {
      return fallback;
    }
  };
  const writeJsonFileAtomic = (filePath: string, data: unknown): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  };

  const app = express();
  app.use(express.json());

  const OWNER_EMAIL = 'yeabsra@hopelandjobs.tech';
  const TEST_CRON_SECRET = 'test-cron-secret-hopeland-2026';
  process.env.CRON_SECRET = TEST_CRON_SECRET;

  const engine: OpportunityIntelligenceEngine = registerOpportunityIntelligenceRoutes({
    app,
    runtimeBaseDir: tmpDir,
    isVercel: false,
    ensureRuntimeDataDir: () => fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true }),
    loadJsonFileSafe,
    writeJsonFileAtomic,
    loadUserProfiles: () => ({}),
    isPersistentOwnerRequest: (req) =>
      String(req.headers['x-user-email'] || '').toLowerCase() === OWNER_EMAIL,
    getRequesterUid: (req) => {
      const uid = String(req.headers['x-user-uid'] || '').trim();
      return uid || null;
    },
    appendAuditLog: () => {},
    autoStartDailyScheduler: false,
  });

  const nowMs = Date.now();
  const in14Days = new Date(nowMs + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const in2Days = new Date(nowMs + 48 * 60 * 60 * 1000).toISOString();

  const db = engine.loadDb();

  console.log('\n====================================================================');
  console.log('HOPELAND JOBS — SECTION 12 MASTER VERIFICATION SUITE (TESTS 1 - 10)');
  console.log('====================================================================\n');

  // =========================================================================
  // TEST 1: Branch Manager (9 yrs banking, 3 yrs management, >$3,000/mo)
  // -> Recommends closely related branch banking management positions (intl & domestic)
  // =========================================================================
  const intlBranchMgrRes = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Branch Operations Manager - Retail Banking',
    employer: 'Emirates NBD',
    country: 'United Arab Emirates',
    city: 'Dubai',
    region: 'Middle East',
    description:
      'Lead daily branch operations, supervise branch tellers and relationship officers, manage branch P&L, deposit mobilization, credit operations, and internal compliance. Requires 8 years banking experience including 3 years managerial leadership. Employer provides UAE employment visa sponsorship, residence visa fees covered, and relocation allowance.',
    compensationRaw: 'AED 22,000 per month gross',
    explicitVisaNote: 'Full UAE employment work visa sponsorship provided for international applicants.',
    officialApplicationUrl: 'https://careers.emiratesnbd.com/jobs/branch-operations-manager-dubai-1001',
    sourceName: 'Emirates NBD Official Careers',
    deadlineRaw: in14Days,
  });

  const domesticBranchMgrRes = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Senior Branch Manager',
    employer: 'Dashen Bank S.C.',
    country: 'Ethiopia',
    city: 'Addis Ababa',
    region: 'Ethiopia',
    description:
      'Oversee commercial branch operations, deposit mobilization, credit appraisal, branch compliance, and staff supervision in Addis Ababa. Requires 8 years banking experience with 3 years branch managerial experience. Salary: ETB 460,000 per month gross.',
    compensationRaw: 'ETB 460,000 per month gross',
    officialApplicationUrl: 'https://dashenbanksc.com/careers/senior-branch-manager-addis-2001',
    sourceName: 'Hopeland Jobs Ethiopian Domestic Catalog',
    deadlineRaw: in14Days,
  });

  assert.equal(intlBranchMgrRes.record.status, 'published', 'TEST 1: Intl Branch Operations Manager should be published');
  assert.equal(domesticBranchMgrRes.record.status, 'published', 'TEST 1: Ethiopian Domestic Senior Branch Manager should be published without visa requirement');
  assert.equal(domesticBranchMgrRes.record.environment, 'ethiopia_domestic');
  assert.equal(domesticBranchMgrRes.record.visa.conditionMet, 'domestic_not_required');

  const bmEvalIntl = evaluateForBranchBankingSpecialFeature({
    title: intlBranchMgrRes.record.title,
    employer: intlBranchMgrRes.record.employer,
    description: intlBranchMgrRes.record.descriptionSummary,
    responsibilities: intlBranchMgrRes.record.actualResponsibilities,
    sector: intlBranchMgrRes.record.sector,
    seniorityLevel: intlBranchMgrRes.record.seniorityLevel,
    exp: {
      requiredTotalYears: intlBranchMgrRes.record.eligibility.requiredTotalYears,
      requiredBankingYears: intlBranchMgrRes.record.eligibility.requiredBankingYears,
      requiredManagerialYears: intlBranchMgrRes.record.eligibility.requiredManagerialYears,
      bankingExperienceSummary: '',
      managerialExperienceSummary: '',
    },
    salary: intlBranchMgrRes.record.salary,
    visa: intlBranchMgrRes.record.visa,
    environment: intlBranchMgrRes.record.environment,
    deadlinePassed: true,
    deadlineExplanation: '',
    profile: BRANCH_BANKING_REFERENCE_PROFILE,
  });

  assert.equal(bmEvalIntl.matched, true, 'TEST 1: Branch Operations Manager must match reference profile');
  assert.ok(bmEvalIntl.relevanceScore >= 75, 'TEST 1: Relevance score must be high');
  assert.ok(
    (intlBranchMgrRes.record.salary.normalizedMonthlyUsd || 0) > 3000,
    'TEST 1: Salary normalized strictly > $3,000/month'
  );
  console.log(
    `[PASS] TEST 1: Branch Manager profile matched "${intlBranchMgrRes.record.title}" (${intlBranchMgrRes.record.salary.salaryDisplay}, Relevance ${bmEvalIntl.relevanceScore}%) & Ethiopian Domestic "${domesticBranchMgrRes.record.title}" (no visa required).`
  );

  // =========================================================================
  // TEST 2: Vice President requiring 15 years executive banking experience
  // -> MUST BE REJECTED as unsuitable seniority match
  // =========================================================================
  const vpRes = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Vice President of Global Retail Banking',
    employer: 'First Abu Dhabi Bank',
    country: 'United Arab Emirates',
    city: 'Abu Dhabi',
    region: 'Middle East',
    description:
      'Executive Vice President reporting to Group CEO. Requires 15 years of executive banking leadership experience managing regional P&L across 6 countries. Work visa sponsorship provided. Salary: USD 18,000 per month gross.',
    compensationRaw: 'USD 18,000 per month gross',
    explicitVisaNote: 'Employer provides UAE work visa sponsorship.',
    officialApplicationUrl: 'https://careers.bankfab.com/jobs/vp-global-retail-banking-9901',
    sourceName: 'FAB Official Careers',
    deadlineRaw: in14Days,
  });

  const vpEvalBranch = evaluateForBranchBankingSpecialFeature({
    title: vpRes.record.title,
    employer: vpRes.record.employer,
    description: vpRes.record.descriptionSummary,
    responsibilities: vpRes.record.actualResponsibilities,
    sector: vpRes.record.sector,
    seniorityLevel: vpRes.record.seniorityLevel,
    exp: {
      requiredTotalYears: vpRes.record.eligibility.requiredTotalYears,
      requiredBankingYears: vpRes.record.eligibility.requiredBankingYears,
      requiredManagerialYears: vpRes.record.eligibility.requiredManagerialYears,
      bankingExperienceSummary: '',
      managerialExperienceSummary: '',
    },
    salary: vpRes.record.salary,
    visa: vpRes.record.visa,
    environment: vpRes.record.environment,
    deadlinePassed: true,
    deadlineExplanation: '',
    profile: BRANCH_BANKING_REFERENCE_PROFILE,
  });

  const vpEvalUniversal = evaluateOpportunityForUserProfile(vpRes.record, BRANCH_BANKING_REFERENCE_PROFILE);

  assert.equal(vpEvalBranch.matched, false, 'TEST 2: VP (15 yrs executive) MUST be rejected by Branch Banking matcher');
  assert.ok(
    vpEvalBranch.rejectionCodes.includes('seniority_mismatch_too_senior'),
    `TEST 2: Expected seniority_mismatch_too_senior, got ${vpEvalBranch.rejectionCodes.join(', ')}`
  );
  assert.equal(vpEvalUniversal.eligible, false, 'TEST 2: VP MUST also be rejected by universal seniority matcher');
  assert.ok(
    vpEvalUniversal.rejectionCodes.includes('seniority_mismatch_too_senior'),
    'TEST 2: Universal matcher must emit seniority_mismatch_too_senior'
  );
  console.log(
    `[PASS] TEST 2: "${vpRes.record.title}" (15 yrs executive) REJECTED [${vpEvalBranch.rejectionCodes.join(', ')}] — ${vpEvalBranch.rejectionReasons[0]}`
  );

  // =========================================================================
  // TEST 3: Customer Service Representative vacancy
  // -> MUST BE REJECTED as unsuitable professional and seniority match
  // =========================================================================
  const csrRes = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Customer Service Representative - Bank Branch Teller',
    employer: 'Abu Dhabi Commercial Bank',
    country: 'United Arab Emirates',
    city: 'Dubai',
    region: 'Middle East',
    description:
      'Entry-level front-desk bank teller and customer service representative handling cash deposits, account inquiries, and daily customer queue. 0-1 year experience required. Work visa sponsorship provided. Salary: USD 3,400 per month gross.',
    compensationRaw: 'USD 3,400 per month gross',
    explicitVisaNote: 'UAE work visa sponsorship provided.',
    officialApplicationUrl: 'https://careers.adcb.com/jobs/csr-bank-teller-3002',
    sourceName: 'ADCB Official Careers',
    deadlineRaw: in14Days,
  });

  const csrEvalBranch = evaluateForBranchBankingSpecialFeature({
    title: csrRes.record.title,
    employer: csrRes.record.employer,
    description: csrRes.record.descriptionSummary,
    responsibilities: csrRes.record.actualResponsibilities,
    sector: csrRes.record.sector,
    seniorityLevel: csrRes.record.seniorityLevel,
    exp: {
      requiredTotalYears: csrRes.record.eligibility.requiredTotalYears,
      requiredBankingYears: csrRes.record.eligibility.requiredBankingYears,
      requiredManagerialYears: csrRes.record.eligibility.requiredManagerialYears,
      bankingExperienceSummary: '',
      managerialExperienceSummary: '',
    },
    salary: csrRes.record.salary,
    visa: csrRes.record.visa,
    environment: csrRes.record.environment,
    deadlinePassed: true,
    deadlineExplanation: '',
    profile: BRANCH_BANKING_REFERENCE_PROFILE,
  });
  const csrEvalUniversal = evaluateOpportunityForUserProfile(csrRes.record, BRANCH_BANKING_REFERENCE_PROFILE);

  assert.equal(csrEvalBranch.matched, false, 'TEST 3: CSR MUST be rejected by Branch Banking matcher');
  assert.ok(
    csrEvalBranch.rejectionCodes.includes('seniority_mismatch_too_junior'),
    `TEST 3: Expected seniority_mismatch_too_junior, got ${csrEvalBranch.rejectionCodes.join(', ')}`
  );
  assert.equal(csrEvalUniversal.eligible, false, 'TEST 3: CSR MUST be rejected by universal matcher');
  console.log(
    `[PASS] TEST 3: "${csrRes.record.title}" REJECTED [${csrEvalBranch.rejectionCodes.join(', ')}] — ${csrEvalBranch.rejectionReasons[0]}`
  );

  // =========================================================================
  // TEST 4: WASH professional -> recommends WASH jobs/scholarships/training/conferences
  // AND strictly rejects banking management positions
  // =========================================================================
  const washUserProfile: UserProfessionalProfileInput = {
    userId: 'user_wash_specialist_01',
    professionalSector: 'wash',
    currentOccupation: 'WASH Specialist',
    educationLevel: 'masters',
    fieldOfStudy: 'Water Supply and Sanitation Engineering',
    yearsOfExperience: 6,
    bankingExperienceYears: 0,
    managerialExperienceYears: 1,
    skills: ['WASH', 'Water Supply', 'Sanitation', 'Hygiene Promotion', 'Hydrology', 'Humanitarian Water'],
    certifications: [],
    minimumSalaryUsdMonthly: null,
    careerLevel: 'senior_professional',
    preferredLocations: ['Europe', 'Scandinavia', 'USA', 'Global', 'Ethiopia'],
    preferredEnvironment: 'both',
    nationality: 'Ethiopian',
    countriesWithLegalWorkRight: ['Ethiopia'],
    allowJuniorRoles: false,
  };

  const washJobRes = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Senior WASH Specialist - Water and Sanitation Programs',
    employer: 'WaterAid International',
    country: 'United Kingdom',
    city: 'London',
    region: 'Europe',
    description:
      'Lead international Water, Sanitation, and Hygiene (WASH) engineering and community hygiene programs across East Africa. Requires 5-7 years WASH experience. Employer provides UK Skilled Worker work visa sponsorship. Salary: GBP 56,000 per year gross.',
    compensationRaw: 'GBP 56,000 per year gross',
    explicitVisaNote: 'UK Skilled Worker visa sponsorship provided for international applicants.',
    officialApplicationUrl: 'https://www.wateraid.org/uk/careers/senior-wash-specialist-4001',
    sourceName: 'WaterAid Global Careers',
    deadlineRaw: in14Days,
  });

  const washScholarshipRes = engine.ingestAndVerifyCandidate(db, {
    category: 'scholarship',
    title: 'MSc Water Management and WASH Engineering Fully Funded Fellowship',
    employer: 'IHE Delft Institute for Water Education',
    country: 'Netherlands',
    city: 'Delft',
    region: 'Europe',
    description:
      'Fully funded international scholarship for Ethiopian and developing-country WASH professionals in water supply, sanitation, and hydrology. Includes full tuition, stipend, travel, and Netherlands visa sponsorship and visa fees covered.',
    explicitVisaNote: 'Includes full visa sponsorship and visa fees covered by IHE Delft.',
    explicitFundingNote: 'Fully funded tuition, monthly living stipend, flights, and visa costs covered.',
    officialApplicationUrl: 'https://www.un-ihe.org/scholarships/wash-fellowship-2026',
    sourceName: 'IHE Delft Scholarships',
    deadlineRaw: in14Days,
  });

  const washConfRes = engine.ingestAndVerifyCandidate(db, {
    category: 'conference',
    title: 'SIWI World Water Week Global WASH Fellowship Conference',
    employer: 'Stockholm International Water Institute',
    country: 'Sweden',
    city: 'Stockholm',
    region: 'Scandinavia',
    description:
      'International water, sanitation, and hygiene (WASH) conference fellowship for Ethiopian WASH practitioners. Fully funded participation with Schengen visa sponsorship and visa fees reimbursed.',
    explicitVisaNote: 'Visa sponsorship and visa fees covered for selected international fellows.',
    explicitFundingNote: 'Fully funded conference travel, lodging, and visa fees.',
    officialApplicationUrl: 'https://www.worldwaterweek.org/fellowships/wash-2026',
    sourceName: 'SIWI World Water Week',
    deadlineRaw: in14Days,
  });

  assert.equal(washJobRes.record.status, 'published', 'TEST 4: WASH job should be published');
  assert.equal(washScholarshipRes.record.status, 'published', 'TEST 4: WASH scholarship should be published');
  assert.equal(washConfRes.record.status, 'published', 'TEST 4: WASH conference should be published');

  const washMatchJob = evaluateOpportunityForUserProfile(washJobRes.record, washUserProfile);
  const washMatchSch = evaluateOpportunityForUserProfile(washScholarshipRes.record, washUserProfile);
  const washMatchConf = evaluateOpportunityForUserProfile(washConfRes.record, washUserProfile);
  const washMatchBanking = evaluateOpportunityForUserProfile(intlBranchMgrRes.record, washUserProfile);

  assert.equal(washMatchJob.eligible, true, 'TEST 4: WASH specialist must match WASH job');
  assert.equal(washMatchSch.eligible, true, 'TEST 4: WASH specialist must match WASH scholarship');
  assert.equal(washMatchConf.eligible, true, 'TEST 4: WASH specialist must match WASH conference');
  assert.equal(washMatchBanking.eligible, false, 'TEST 4: WASH specialist MUST reject Branch Banking job');
  assert.ok(
    washMatchBanking.rejectionCodes.includes('industry_mismatch'),
    `TEST 4: Expected industry_mismatch for WASH user on Banking job, got ${washMatchBanking.rejectionCodes.join(', ')}`
  );
  console.log(
    `[PASS] TEST 4: WASH user matched WASH job (${washMatchJob.relevanceScore}%), WASH scholarship (${washMatchSch.relevanceScore}%), WASH conference (${washMatchConf.relevanceScore}%), and REJECTED Banking job [${washMatchBanking.rejectionCodes.join(', ')}].`
  );

  // =========================================================================
  // TEST 5: International banking job with verified visa sponsorship & >$3,000/mo
  // -> MUST BE ALLOWED
  // =========================================================================
  const allowedIntlBankRes = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Retail Banking Manager',
    employer: 'Nordea Bank Abp',
    country: 'Sweden',
    city: 'Stockholm',
    region: 'Scandinavia',
    description:
      'Manage retail branch banking operations, supervise relationship officers, oversee branch compliance, lending portfolio, and deposit targets. 7 years banking experience with 3 years managerial experience. Nordea provides Swedish work permit and visa sponsorship plus relocation package.',
    compensationRaw: 'SEK 62,000 per month gross',
    explicitVisaNote: 'Confirmed employer work permit and visa sponsorship for international applicants.',
    officialApplicationUrl: 'https://www.nordea.com/en/careers/retail-banking-manager-stockholm-5001',
    sourceName: 'Nordea Official Careers',
    deadlineRaw: in14Days,
  });
  const allowedEval = evaluateOpportunityForUserProfile(
    allowedIntlBankRes.record,
    BRANCH_BANKING_REFERENCE_PROFILE
  );
  assert.equal(allowedIntlBankRes.record.status, 'published', 'TEST 5: Verified visa + >$3k banking job must publish');
  assert.equal(allowedIntlBankRes.record.visa.verified, true);
  assert.equal(allowedIntlBankRes.record.salary.meetsAbove3000UsdMonthly, true);
  assert.equal(allowedEval.eligible, true, 'TEST 5: Must be allowed for Branch Manager profile');
  console.log(
    `[PASS] TEST 5: Allowed "${allowedIntlBankRes.record.title}" at ${allowedIntlBankRes.record.employer} (${allowedIntlBankRes.record.salary.salaryDisplay}, Visa: ${allowedIntlBankRes.record.visa.statusLabel}).`
  );

  // =========================================================================
  // TEST 6: International job WITHOUT verified work visa sponsorship
  // (plus scholarship with invitation letter only / applicant-paid visa)
  // -> MUST BE REJECTED
  // =========================================================================
  const noVisaJobRes = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Branch Manager - Commercial Banking',
    employer: 'Regional Bank Germany',
    country: 'Germany',
    city: 'Frankfurt',
    region: 'Europe',
    description:
      'Manage commercial branch banking operations, deposit mobilization, and team supervision. Requires 8 years banking and 3 years management. Candidates must already have the right to work in Germany; no visa sponsorship is offered. Salary: EUR 7,000 per month gross.',
    compensationRaw: 'EUR 7,000 per month gross',
    officialApplicationUrl: 'https://example-bank.de/careers/branch-manager-no-visa-6001',
    sourceName: 'European Bank Portal',
    deadlineRaw: in14Days,
  });

  const inviteOnlyConfRes = engine.ingestAndVerifyCandidate(db, {
    category: 'conference',
    title: 'Global Banking Leadership Summit 2026',
    employer: 'European Finance Forum',
    country: 'France',
    city: 'Paris',
    region: 'Europe',
    description:
      'International banking summit. We provide an invitation letter only for visa applications; visa fees are the participant responsibility.',
    officialApplicationUrl: 'https://example-finance-forum.eu/summit-2026',
    sourceName: 'European Finance Forum',
    deadlineRaw: in14Days,
  });

  assert.equal(noVisaJobRes.record.status, 'rejected', 'TEST 6: International job without visa sponsorship MUST be rejected');
  assert.ok(
    noVisaJobRes.record.rejectionCodes.includes('visa_sponsorship_unconfirmed'),
    `TEST 6: Expected visa_sponsorship_unconfirmed, got ${noVisaJobRes.record.rejectionCodes.join(', ')}`
  );
  assert.equal(inviteOnlyConfRes.record.status, 'rejected', 'TEST 6: Invitation-letter-only conference MUST be rejected');
  assert.ok(
    inviteOnlyConfRes.record.rejectionCodes.includes('invitation_letter_only') ||
      inviteOnlyConfRes.record.rejectionCodes.includes('visa_cost_applicant_paid') ||
      inviteOnlyConfRes.record.rejectionCodes.includes('visa_sponsorship_unconfirmed'),
    'TEST 6: Conference must fail invitation-letter-only / visa-fee filter'
  );
  console.log(
    `[PASS] TEST 6: Rejected international job without visa [${noVisaJobRes.record.rejectionCodes.join(', ')}] & invitation-only conference [${inviteOnlyConfRes.record.rejectionCodes.join(', ')}].`
  );

  // =========================================================================
  // TEST 7: Same job discovered from 3 different websites
  // -> Stored as ONE canonical opportunity & sends AT MOST ONE notification
  // =========================================================================
  const dupBefore = db.duplicateOpportunitiesPrevented;
  const site1 = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Area Branch Manager - Retail Banking',
    employer: 'Qatar National Bank (QNB)',
    country: 'Qatar',
    city: 'Doha',
    region: 'Middle East',
    description:
      'Oversee 5 retail banking branches in Doha, supervise branch managers and tellers, drive deposit mobilization and credit risk controls. Requires 8 years banking experience and 3 years managerial experience. Full Qatar work visa sponsorship provided.',
    compensationRaw: 'QAR 24,000 per month gross',
    explicitVisaNote: 'Full Qatar employment work visa sponsorship provided.',
    officialApplicationUrl: 'https://careers.qnb.com/jobs/area-branch-manager-doha-7001?utm_source=portal1',
    sourceUrl: 'https://portal-one.example.com/qnb-area-branch-manager',
    sourceName: 'QNB Official Portal',
    deadlineRaw: in14Days,
  });
  const site2 = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Area Branch Manager - Retail Banking',
    employer: 'Qatar National Bank (QNB)',
    country: 'Qatar',
    city: 'Doha',
    region: 'Middle East',
    description:
      'Oversee 5 retail banking branches in Doha, supervise branch managers and tellers, drive deposit mobilization and credit risk controls. Requires 8 years banking experience and 3 years managerial experience. Full Qatar work visa sponsorship provided.',
    compensationRaw: 'QAR 24,000 per month gross',
    explicitVisaNote: 'Full Qatar employment work visa sponsorship provided.',
    officialApplicationUrl: 'https://careers.qnb.com/jobs/area-branch-manager-doha-7001?ref=gulfjobs',
    sourceUrl: 'https://portal-two.example.com/qnb-area-branch-manager',
    sourceName: 'Gulf Banking Aggregator',
    deadlineRaw: in14Days,
  });
  const site3 = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Area Branch Manager - Retail Banking',
    employer: 'Qatar National Bank (QNB)',
    country: 'Qatar',
    city: 'Doha',
    region: 'Middle East',
    description:
      'Oversee 5 retail banking branches in Doha, supervise branch managers and tellers, drive deposit mobilization and credit risk controls. Requires 8 years banking experience and 3 years managerial experience. Full Qatar work visa sponsorship provided.',
    compensationRaw: 'QAR 24,000 per month gross',
    explicitVisaNote: 'Full Qatar employment work visa sponsorship provided.',
    officialApplicationUrl: 'https://careers.qnb.com/jobs/area-branch-manager-doha-7001?utm_medium=feed3',
    sourceUrl: 'https://portal-three.example.com/qnb-area-branch-manager',
    sourceName: 'Middle East Finance Feed',
    deadlineRaw: in14Days,
  });

  assert.equal(site1.outcome, 'created');
  assert.equal(site2.outcome, 'duplicate_merged');
  assert.equal(site3.outcome, 'duplicate_merged');
  assert.equal(site1.record.id, site2.record.id, 'TEST 7: Website 2 must collapse into same canonical ID');
  assert.equal(site1.record.id, site3.record.id, 'TEST 7: Website 3 must collapse into same canonical ID');
  assert.equal(
    db.duplicateOpportunitiesPrevented - dupBefore,
    2,
    'TEST 7: Exactly 2 cross-website duplicates prevented'
  );
  assert.equal(site3.record.sourceUrls.length, 3, 'TEST 7: All 3 source URLs preserved on the 1 canonical record');

  const bmMatchForNotif = evaluateOpportunityForUserProfile(
    site3.record,
    BRANCH_BANKING_REFERENCE_PROFILE
  );
  const notif1 = engine.dispatchDeduplicatedNotificationForUser(db, {
    userId: 'user_branch_mgr_01',
    opportunity: site1.record,
    match: bmMatchForNotif,
  });
  const notif2 = engine.dispatchDeduplicatedNotificationForUser(db, {
    userId: 'user_branch_mgr_01',
    opportunity: site2.record,
    match: bmMatchForNotif,
  });
  const notif3 = engine.dispatchDeduplicatedNotificationForUser(db, {
    userId: 'user_branch_mgr_01',
    opportunity: site3.record,
    match: bmMatchForNotif,
  });

  assert.equal(notif1.sent, true, 'TEST 7: First notification must be sent');
  assert.equal(notif2.sent, false, 'TEST 7: Second website duplicate must NOT notify');
  assert.equal(notif3.sent, false, 'TEST 7: Third website duplicate must NOT notify');
  console.log(
    `[PASS] TEST 7: Same job from 3 websites collapsed into 1 canonical ID (${site1.record.id}) with 3 merged sources and sent AT MOST 1 notification.`
  );

  // =========================================================================
  // TEST 8: Previously published opportunity loses confirmed visa sponsorship
  // -> Automatically UNPUBLISHED while preserving immutable verification history
  // =========================================================================
  const revokableRes = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Branch Banking Service Manager',
    employer: 'Nordic Commercial Bank',
    country: 'Denmark',
    city: 'Copenhagen',
    region: 'Scandinavia',
    description:
      'Lead branch customer service operations, supervise banking officers, manage daily compliance and branch targets. Requires 7 years banking and 3 years managerial experience. Work visa sponsorship provided. Salary: DKK 52,000 per month gross.',
    compensationRaw: 'DKK 52,000 per month gross',
    explicitVisaNote: 'Employer provides Denmark Fast-Track work visa sponsorship.',
    officialApplicationUrl: 'https://nordic-bank.dk/careers/branch-service-manager-8001',
    sourceName: 'Work in Denmark Official',
    deadlineRaw: in14Days,
  });
  assert.equal(revokableRes.record.status, 'published', 'TEST 8: Initially published with confirmed visa');

  const revokedRecheck = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Branch Banking Service Manager',
    employer: 'Nordic Commercial Bank',
    country: 'Denmark',
    city: 'Copenhagen',
    region: 'Scandinavia',
    description:
      'Lead branch customer service operations, supervise banking officers, manage daily compliance and branch targets. Requires 7 years banking and 3 years managerial experience. Update: No longer sponsoring work visas; EU right to work required. Salary: DKK 52,000 per month gross.',
    compensationRaw: 'DKK 52,000 per month gross',
    officialApplicationUrl: 'https://nordic-bank.dk/careers/branch-service-manager-8001',
    sourceName: 'Work in Denmark Official',
    deadlineRaw: in14Days,
    visaSponsorshipRevoked: true,
  });

  const logsForRevoked = db.opportunity_verification_logs.filter(
    (l) => l.opportunityId === revokableRes.record.id
  );
  assert.equal(revokedRecheck.record.status, 'unpublished', 'TEST 8: Must auto-unpublish when visa sponsorship is lost');
  assert.ok(logsForRevoked.length >= 2, 'TEST 8: Immutable verification history must retain both initial & auto-unpublish logs');
  assert.ok(
    logsForRevoked.some((l) => l.newStatus === 'published') &&
      logsForRevoked.some((l) => l.newStatus === 'unpublished' || l.action === 'auto_unpublish'),
    'TEST 8: History must preserve initial published entry and subsequent unpublished entry'
  );
  console.log(
    `[PASS] TEST 8: "${revokedRecheck.record.title}" auto-unpublished after losing visa sponsorship while preserving ${logsForRevoked.length} immutable verification history entries.`
  );

  // =========================================================================
  // TEST 9: Opportunity discovered with only 2 days remaining
  // -> MUST BE REJECTED (minimum 3 full days / 72 hours required)
  // =========================================================================
  const twoDayRes = engine.ingestAndVerifyCandidate(db, {
    category: 'job',
    title: 'Banking Operations Manager',
    employer: 'Commercial Bank Europe',
    country: 'Netherlands',
    city: 'Amsterdam',
    region: 'Europe',
    description:
      'Manage retail banking operations, supervise branch staff, credit controls, and compliance. Requires 8 years banking and 3 years management. Highly Skilled Migrant visa sponsorship provided. Salary: EUR 6,800 per month gross.',
    compensationRaw: 'EUR 6,800 per month gross',
    explicitVisaNote: 'IND recognized sponsor providing Netherlands work visa sponsorship.',
    officialApplicationUrl: 'https://commercial-bank-nl.example.eu/careers/ops-mgr-9001',
    sourceName: 'IND Netherlands Portal',
    deadlineRaw: in2Days,
  });

  assert.equal(twoDayRes.record.status, 'rejected', 'TEST 9: 2-day remaining opportunity MUST be rejected');
  assert.ok(
    twoDayRes.record.rejectionCodes.includes('deadline_under_three_days'),
    `TEST 9: Expected deadline_under_three_days, got ${twoDayRes.record.rejectionCodes.join(', ')}`
  );
  console.log(
    `[PASS] TEST 9: Opportunity with 2 days remaining REJECTED [${twoDayRes.record.rejectionCodes.join(', ')}] — ${twoDayRes.record.rejectionExplanations.join(' ')}`
  );

  // =========================================================================
  // TEST 10: User already notified today -> Same opportunity appears tomorrow
  // -> MUST NOT send repeated notification (zero repeated alerts)
  // =========================================================================
  const tomorrowMs = nowMs + 25 * 60 * 60 * 1000;
  const dupNotifBefore = db.duplicateNotificationsPrevented;
  const tomorrowNotif = engine.dispatchDeduplicatedNotificationForUser(db, {
    userId: 'user_branch_mgr_01',
    opportunity: site1.record,
    match: bmMatchForNotif,
    nowMs: tomorrowMs,
  });

  assert.equal(tomorrowNotif.sent, false, 'TEST 10: User MUST NOT be notified again tomorrow for same opportunity');
  assert.equal(tomorrowNotif.reason, 'suppressed_duplicate');
  assert.equal(
    db.duplicateNotificationsPrevented,
    dupNotifBefore + 1,
    'TEST 10: Duplicate notification prevented counter must increment'
  );
  console.log(
    `[PASS] TEST 10: Tomorrow's re-discovery of "${site1.record.title}" suppressed [${tomorrowNotif.reason}].`
  );

  // Save test DB state and verify live HTTP routes & auth protection
  engine.saveDb(db);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Verify Admin Dashboard 403 unauth vs 200 owner with ALL 17 required metrics
    const unauthDash = await fetch(`${baseUrl}/api/opportunity-intelligence/admin/dashboard`);
    assert.equal(unauthDash.status, 403, 'SECURITY: Admin dashboard must return 403 without owner auth');

    const ownerDashRes = await fetch(`${baseUrl}/api/opportunity-intelligence/admin/dashboard`, {
      headers: { 'x-user-email': OWNER_EMAIL },
    });
    assert.equal(ownerDashRes.status, 200, 'Admin dashboard must return 200 for owner');
    const ownerDash = (await ownerDashRes.json()) as any;
    const requiredMetricKeys = [
      'totalSourcesMonitored',
      'sourcesSuccessfullyChecked',
      'sourcesFailed',
      'newOpportunitiesDiscovered',
      'opportunitiesVerified',
      'opportunitiesRejected',
      'opportunitiesPublished',
      'opportunitiesRemoved',
      'visaSponsorshipFailures',
      'salaryFilterFailures',
      'experienceMismatchRejections',
      'seniorityMismatchRejections',
      'duplicateOpportunitiesPrevented',
      'notificationsSent',
      'duplicateNotificationsPrevented',
      'lastSuccessfulExecution',
      'nextScheduledExecution',
    ];
    for (const key of requiredMetricKeys) {
      assert.ok(key in ownerDash.metrics, `Admin dashboard missing required metric: ${key}`);
    }
    assert.equal(ownerDash.metrics.totalSourcesMonitored, 40, 'Must monitor all 40 permanent official sources');

    // Verify Cron endpoint 401 unauth
    const unauthCron = await fetch(`${baseUrl}/api/cron/daily-opportunity-intelligence`);
    assert.equal(unauthCron.status, 401, 'SECURITY: Cron endpoint must return 401 without CRON_SECRET');

    // Verify User notification preferences 401 unauth
    const unauthPrefs = await fetch(`${baseUrl}/api/opportunity-intelligence/notifications/preferences`);
    assert.equal(unauthPrefs.status, 401, 'SECURITY: Notification preferences must return 401 when signed out');

    // Verify Branch Banking public intelligence endpoint returns matched items with all 13 card fields
    const bmApiRes = await fetch(`${baseUrl}/api/opportunity-intelligence/branch-banking`);
    assert.equal(bmApiRes.status, 200);
    const bmApi = (await bmApiRes.json()) as any;
    assert.ok(bmApi.totalMatched >= 3, `Expected >= 3 matched Branch Banking jobs, got ${bmApi.totalMatched}`);
    const sample = bmApi.jobs[0];
    const requiredCardFields = [
      'positionTitle',
      'employer',
      'country',
      'salary',
      'salaryPeriod',
      'salaryTaxBasis',
      'requiredBankingExperience',
      'requiredManagerialExperience',
      'actualResponsibilities',
      'visaSponsorshipStatus',
      'applicationDeadline',
      'officialApplicationLink',
      'verificationStatus',
      'whyMatchesReferenceProfile',
      'relevanceScore',
    ];
    for (const f of requiredCardFields) {
      assert.ok(f in sample, `Branch Banking card missing required field: ${f}`);
    }

    console.log(
      `\n[PASS] SECURITY & API VERIFICATION: 403/401 guards verified, Admin Dashboard exposes all 17 metrics (${ownerDash.metrics.totalSourcesMonitored} sources monitored), Branch Banking API exposes all 13+ card fields (${bmApi.totalMatched} matched).\n`
    );
    console.log('====================================================================');
    console.log('ALL 10 MANDATORY SECTION 12 TESTS + SECURITY CHECKS PASSED (100%)');
    console.log('====================================================================\n');
  } finally {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runMasterAcceptanceTests().catch((err) => {
  console.error('\n[FAIL] MASTER ACCEPTANCE SUITE FAILED:', err);
  process.exit(1);
});
