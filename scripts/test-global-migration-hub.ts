import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import express from 'express';
import type { GlobalOpportunity } from '../src/types/globalOpportunities';
import {
  BENCHMARK_BANKING_MANAGER_PRESET,
  DEFAULT_GENERAL_MIGRATION_PROFILE,
} from '../src/types/globalMigrationHub';
import {
  evaluateMigrationHubPayload,
  registerGlobalMigrationHubRoutes,
} from '../serverGlobalMigrationHub';

const futureIso = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();
const futureDate = futureIso.slice(0, 10);

function makeSampleOpp(overrides: Partial<GlobalOpportunity>): GlobalOpportunity {
  const id = overrides.id || 'opp_sample';
  const nowIso = new Date().toISOString();
  const base: GlobalOpportunity = {
    id,
    fingerprint: `fp_${id}`,
    title: 'Commercial Banking Operations Manager',
    organization: 'Gulf International Bank',
    organizationType: 'financial_institution',
    category: 'international_job',
    sectors: ['banking_finance', 'leadership_management'],
    isWashDedicated: false,
    isBankingFinance: true,
    country: 'Saudi Arabia',
    location: 'Riyadh, Saudi Arabia',
    summary:
      'Lead commercial banking operations, branch performance, credit administration, internal controls, and customer relationship management. Employer-sponsored work visa and relocation assistance provided.',
    organizationAuthentic: true,
    sourceId: 'src_gib',
    sourceName: 'Gulf International Bank Careers',
    originalSourceUrl: 'https://careers.gib.com',
    officialApplicationUrl: 'https://careers.gib.com/banking-ops-manager',
    officialDomain: 'gib.com',
    department: 'banking_finance_jobs',
    applicationStatus: 'open',
    verificationStatus: 'Visa Sponsored',
    verificationTier: 'VERIFIED',
    hasVerifiedBadge: true,
    httpStatusCode: 200,
    robotsAllowed: true,
    verificationNotes: 'Verified direct employer career portal.',
    sourceEvidenceSnippet: 'Employer-sponsored work visa available for international candidates.',
    funding: {
      id: `fund_${id}`,
      opportunityId: id,
      fundingLevel: 'fully_funded',
      fundingSummary: 'Employer-paid work visa and relocation package.',
      transparencyTags: ['Employer-sponsored visa'],
      tuitionCovered: 'no',
      airfareCovered: 'yes',
      accommodationCovered: 'partial',
      visaSupportType: 'employer_sponsored_visa',
      employmentVisaClassification: 'confirmed_visa_sponsorship',
      employmentVisaLabel: 'Confirmed Visa Sponsorship',
      visaSupportSummary: 'Employer-sponsored Saudi work visa (Iqama) & relocation flight included.',
      visaMandatoryRulePassed: true,
      relocationAssistance: 'yes',
      applicationFee: 'None (Free)',
      stipendOrSalary: 'Competitive tax-free salary + housing allowance',
      verifiedAt: nowIso,
    },
    eligibility: {
      id: `elig_${id}`,
      opportunityId: id,
      eligibleNationalities: ['All nationalities', 'Ethiopian citizens'],
      ethiopianEligible: 'confirmed',
      educationRequirement: "Bachelor's degree in Accounting, Finance, or Banking.",
      minimumEducationLevel: 'bachelors',
      experienceRequirement: '5+ years in commercial banking and branch operations.',
      minimumYearsExperience: 5,
      careerLevel: 'management',
      requiredSkills: ['Banking operations', 'Branch management', 'Credit administration', 'Internal controls'],
      languagesRequired: ['English (working proficiency)'],
      universityRecommendationRequired: 'not_required',
      companyRecommendationRequired: 'not_required',
      institutionalNominationRequired: 'not_required',
      directIndividualApplicationAllowed: 'yes',
      verifiedAt: nowIso,
    },
    deadline: {
      id: `dl_${id}`,
      opportunityId: id,
      deadlineDateRaw: futureDate,
      deadlineUtcIso: futureIso,
      deadlineTimezone: 'UTC',
      fullDaysRemaining: 45,
      hoursRemaining: 45 * 24,
      meetsMinimumThreeFullDays: true,
      isClosingSoon: false,
      isExpired: false,
      startDate: 'Immediate',
      lastCheckedAt: nowIso,
    },
    visaCompliancePassed: true,
    professionalRestrictionPassed: true,
    discoveredAt: nowIso,
    lastVerifiedAt: nowIso,
    updatedAt: nowIso,
  };

  return {
    ...base,
    ...overrides,
    funding: { ...base.funding, ...(overrides.funding || {}) },
    eligibility: { ...base.eligibility, ...(overrides.eligibility || {}) },
    deadline: { ...base.deadline, ...(overrides.deadline || {}) },
  };
}

async function runTests() {
  let passed = 0;

  // Test 1: Honest Eligibility Classification & No Auto-Exclusion for Optional Master's / IELTS
  {
    const baseOpp = makeSampleOpp({ id: 'opp_highly_suitable_saudi' });
    const opps: GlobalOpportunity[] = [
      baseOpp,
      makeSampleOpp({
        id: 'opp_potentially_ielts',
        title: 'Senior Financial Risk Analyst',
        country: 'Germany',
        location: 'Frankfurt, Germany',
        eligibility: {
          ...baseOpp.eligibility,
          languagesRequired: ['IELTS or TOEFL score required for visa stage — check exemptions'],
        },
        funding: {
          ...baseOpp.funding,
          visaSupportSummary: 'EU Blue Card employer sponsorship available.',
        },
      }),
      makeSampleOpp({
        id: 'opp_not_eligible_masters',
        title: 'Chief Economist — Doctoral Track',
        country: 'Switzerland',
        location: 'Geneva, Switzerland',
        eligibility: {
          ...baseOpp.eligibility,
          educationRequirement: "Master's degree is mandatory for this position.",
          minimumEducationLevel: 'masters',
        },
      }),
      makeSampleOpp({
        id: 'opp_not_eligible_local_only',
        title: 'Retail Branch Officer (Local Citizens Only)',
        country: 'United Kingdom',
        location: 'London, United Kingdom',
        summary: 'Local candidates only. Must already have work authorization. No visa sponsorship.',
        eligibility: {
          ...baseOpp.eligibility,
          ethiopianEligible: 'not_confirmed',
          eligibleNationalities: ['UK citizens only'],
        },
        funding: {
          ...baseOpp.funding,
          visaSupportSummary: 'No visa sponsorship. Local candidates only.',
        },
      }),
      makeSampleOpp({
        id: 'opp_wash_engineer',
        title: 'WASH Civil Water Supply Engineer',
        organization: 'UNICEF',
        country: 'Kenya',
        location: 'Nairobi, Kenya',
        category: 'wash_opportunity',
        department: 'wash_jobs',
        isWashDedicated: true,
        isBankingFinance: false,
        sectors: ['wash', 'engineering'],
        summary: 'Design rural borehole water supply and sanitation infrastructure.',
        eligibility: {
          ...baseOpp.eligibility,
          educationRequirement: "Bachelor's degree in Civil or Water Resources Engineering.",
          experienceRequirement: '5+ years in rural water supply and sanitation engineering.',
          requiredSkills: ['Water supply', 'Sanitation engineering', 'Hydrology'],
        },
      }),
    ];

    const res = evaluateMigrationHubPayload({
      rawOpportunities: opps,
      profileInput: BENCHMARK_BANKING_MANAGER_PRESET,
      selectedCountries: ['Saudi Arabia', 'Germany'],
    });

    const saudi = res.opportunities.find((o) => o.id === 'opp_highly_suitable_saudi')!;
    const germanyIelts = res.opportunities.find((o) => o.id === 'opp_potentially_ielts')!;
    const swissMasters = res.opportunities.find((o) => o.id === 'opp_not_eligible_masters')!;
    const ukLocal = res.opportunities.find((o) => o.id === 'opp_not_eligible_local_only')!;
    const washEng = res.opportunities.find((o) => o.id === 'opp_wash_engineer')!;

    assert.ok(saudi, 'Saudi opportunity must be evaluated');
    assert.equal(saudi.eligibilityClassification, 'HIGHLY SUITABLE');
    assert.equal(saudi.canApplyFromEthiopia, 'Yes');
    assert.equal(saudi.costBreakdown.withinUserBudget, 'Yes');
    assert.equal(saudi.isInSelectedCountry, true);

    // Must NOT automatically mark NOT ELIGIBLE just because IELTS is mentioned!
    assert.ok(germanyIelts, 'Germany opportunity must be evaluated');
    assert.notEqual(germanyIelts.eligibilityClassification, 'NOT ELIGIBLE');
    assert.equal(germanyIelts.englishTestRequired, 'Yes');
    assert.ok(germanyIelts.confirmationNeededItems.length >= 1);

    // Must mark NOT ELIGIBLE when Master's is genuinely mandatory or local citizens only
    assert.equal(swissMasters.eligibilityClassification, 'NOT ELIGIBLE');
    assert.equal(ukLocal.eligibilityClassification, 'NOT ELIGIBLE');
    assert.equal(ukLocal.canApplyFromEthiopia, 'No');

    // WASH technical engineering separated cleanly from banking profile
    assert.equal(washEng.isWashOpportunity, true);
    assert.equal(washEng.eligibilityClassification, 'NOT ELIGIBLE');

    passed += 1;
    console.log('✅ Test 1 passed: Eligibility classification, IELTS non-exclusion & WASH separation');
  }

  // Test 2: 13-Point Legal Immigration & PR Honesty (Never claim temporary visa = PR!)
  {
    const res = evaluateMigrationHubPayload({
      rawOpportunities: [],
      profileInput: BENCHMARK_BANKING_MANAGER_PRESET,
      selectedCountries: ['Saudi Arabia', 'United Arab Emirates', 'Germany', 'Canada'],
    });

    assert.ok(res.immigrationPathways13Point.length >= 24, 'Should include all 24 PR portals + Saudi Arabia & UAE');

    const saudi = res.immigrationPathways13Point.find((p) => p.country === 'Saudi Arabia')!;
    const uae = res.immigrationPathways13Point.find((p) => p.country === 'United Arab Emirates')!;
    const canada = res.immigrationPathways13Point.find((p) => p.country === 'Canada')!;
    const germany = res.immigrationPathways13Point.find((p) => p.country === 'Germany')!;

    assert.ok(saudi && uae && canada && germany, 'Core priority countries must exist');
    assert.equal(saudi.pathwayCategory, 'Temporary Work Visa (No Direct PR)');
    assert.equal(uae.pathwayCategory, 'Temporary Work Visa (No Direct PR)');
    assert.match(saudi.q11_leadsToPermanentResidence, /No —/i);
    assert.match(uae.q11_leadsToPermanentResidence, /No —/i);
    assert.equal(canada.pathwayCategory, 'Direct Permanent Residence');
    assert.equal(canada.withinUserBudget, 'No', 'Canada independent Express Entry must warn about upfront costs > $500');

    for (const p of res.immigrationPathways13Point) {
      assert.ok(p.q1_canEthiopianApplyFromEthiopia.length > 10);
      assert.ok(p.q6_financialProofRequired.length > 10);
      assert.ok(p.q10_familyReunificationRules.length > 10);
      assert.ok(p.q11_leadsToPermanentResidence.length > 10);
      assert.ok(p.q13_officialProcedureAndLink.includes('https://'));
    }

    passed += 1;
    console.log('✅ Test 2 passed: 13-point legal migration & PR honesty (temporary work visa != PR)');
  }

  // Test 3: Strict Per-User Privacy Isolation via HTTP Routes
  {
    const tmpDir = path.join('/tmp', `hub_privacy_test_${Date.now()}`);
    fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'data', 'global_opportunities_store.json'),
      JSON.stringify({ international_opportunities: [makeSampleOpp({ id: 'opp_live_1' })] })
    );

    const app = express();
    app.use(express.json());

    registerGlobalMigrationHubRoutes({
      app,
      runtimeBaseDir: tmpDir,
      isVercel: true,
      ensureRuntimeDataDir: () => fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true }),
      loadJsonFileSafe: <T>(fp: string, fallback: T): T => {
        try {
          if (!fs.existsSync(fp)) return fallback;
          return JSON.parse(fs.readFileSync(fp, 'utf-8')) as T;
        } catch {
          return fallback;
        }
      },
      writeJsonFileAtomic: (fp: string, data: unknown) => {
        fs.writeFileSync(fp, JSON.stringify(data, null, 2));
      },
      getRequesterUid: (req) => {
        const uid = req.headers['x-user-uid'];
        return typeof uid === 'string' && uid.trim() ? uid.trim() : null;
      },
    });

    const server = await new Promise<import('http').Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = server.address() as { port: number };
    const base = `http://127.0.0.1:${addr.port}`;

    try {
      const unauthGet = await fetch(`${base}/api/global-migration-hub/user-state`);
      assert.equal(unauthGet.status, 401);

      const unauthPut = await fetch(`${base}/api/global-migration-hub/user-state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedCountries: ['Germany'] }),
      });
      assert.equal(unauthPut.status, 401);

      const saveA = await fetch(`${base}/api/global-migration-hub/user-state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-uid': 'uid_user_a' },
        body: JSON.stringify({
          profile: { ...BENCHMARK_BANKING_MANAGER_PRESET, currentOrRecentRole: 'Secret User A Role' },
          selectedCountries: ['Saudi Arabia', 'Germany'],
          savedOpportunityIds: ['opp_live_1'],
          applicationTracker: [
            {
              opportunityId: 'opp_live_1',
              title: 'Private App A',
              employerOrInstitution: 'Bank A',
              country: 'Saudi Arabia',
              officialUrl: 'https://careers.gib.com',
              stage: 'Applied',
              notes: 'Confidential User A Note',
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
      assert.equal(saveA.status, 200);

      const getB = await fetch(`${base}/api/global-migration-hub/user-state`, {
        headers: { 'x-user-uid': 'uid_user_b' },
      });
      assert.equal(getB.status, 200);
      const dataB = (await getB.json()) as any;
      assert.equal(dataB.workspace.selectedCountries.length, 0);
      assert.equal(dataB.workspace.applicationTracker.length, 0);
      assert.equal(
        dataB.workspace.profile.currentOrRecentRole,
        DEFAULT_GENERAL_MIGRATION_PROFILE.currentOrRecentRole
      );

      const evalGuest = await fetch(`${base}/api/global-migration-hub/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(evalGuest.status, 200);
      const guestData = (await evalGuest.json()) as any;
      assert.notEqual(guestData.profileUsed.currentOrRecentRole, 'Secret User A Role');
      assert.equal(guestData.selectedCountries.length, 0);
    } finally {
      server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    passed += 1;
    console.log('✅ Test 3 passed: Strict per-user privacy isolation & 401 guard verified');
  }

  // Test 4: GitHub Actions workflow fix & DuplicateCenter bulk-delete/no-alert verification
  {
    const wf = fs.readFileSync(
      path.resolve('.github/workflows/hopeland-opportunity-discovery.yml'),
      'utf-8'
    );
    assert.ok(!wf.includes("cache: 'npm'"), 'Workflow must not use cache: npm when package-lock.json is absent');
    assert.ok(wf.includes('if [ -f package-lock.json ]'), 'Workflow must check for package-lock.json before npm ci');

    const dupCenter = fs.readFileSync(
      path.resolve('src/components/admin/DuplicateCenter.tsx'),
      'utf-8'
    );
    assert.ok(
      dupCenter.includes('handleDeleteAllUploadDuplicates'),
      'DuplicateCenter must support Delete All Duplicates on upload queue'
    );
    assert.ok(!/\bconfirm\(/.test(dupCenter), 'DuplicateCenter must not call window.confirm');
    assert.ok(!/\balert\(/.test(dupCenter), 'DuplicateCenter must not call window.alert');

    const navbar = fs.readFileSync(path.resolve('src/components/Navbar.tsx'), 'utf-8');
    assert.ok(navbar.includes('Global Migration &amp; Career'), 'Navbar must render Global Migration & Career link');
    assert.ok(!navbar.includes('My Radar'), 'Navbar must NEVER call the new public feature My Radar');

    passed += 1;
    console.log('✅ Test 4 passed: GitHub Actions workflow, DuplicateCenter bulk-delete, and Navbar verified');
  }

  console.log(`\n🎉 All ${passed}/${passed} Global Migration & Career Hub tests PASSED!`);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
