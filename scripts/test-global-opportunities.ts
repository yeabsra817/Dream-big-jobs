import assert from 'node:assert/strict';
import * as http from 'node:http';
import {
  classifyFundingAndVisaTransparency,
  computeOpportunityFingerprint,
  computeVerificationOutcome,
  detectSectorsFromText,
  evaluateOpportunityDeadline,
  evaluateOpportunityForUser,
  isOpportunityActiveAndDisplayable,
  MINIMUM_FULL_DAYS_REMAINING,
  recommendOpportunitiesForUser,
} from '../src/utils/opportunityIntelligenceEngine';
import { validateOfficialExternalUrl } from '../serverGlobalOpportunities';
import { GlobalOpportunity } from '../src/types/globalOpportunities';
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

  await runTest('Verification Gate: unverified URL or <3d opportunity NEVER receives Verified badge', () => {
    const dlOk = evaluateOpportunityDeadline(new Date(fixedNow + 10 * 86400_000).toISOString(), 'UTC', fixedNow);
    const unverified = computeVerificationOutcome({
      urlVerified: false,
      organizationAuthentic: true,
      applicationStatus: 'open',
      deadlineEval: dlOk,
      funding: { fundingLevel: 'fully_funded', visaSupportType: 'none' },
      eligibility: { ethiopianEligible: 'confirmed' },
      category: 'university_scholarship',
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
      funding: { fundingLevel: 'fully_funded', visaSupportType: 'none' },
      eligibility: { ethiopianEligible: 'confirmed' },
      category: 'university_scholarship',
    });
    assert.equal(shortRes.hasVerifiedBadge, false);
    assert.equal(shortRes.isPubliclyDisplayable, false);
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
      assert.ok(primaryLog.savedCount > 0, 'Expected savedCount > 0');

      console.log(
        `   [Live Discovery Summary] trigger=${primaryLog.trigger}, sources=${primaryLog.sourcesQueried}, discovered=${primaryLog.candidatesDiscovered}, verified=${primaryLog.verifiedAndActiveCount}, saved=${primaryLog.savedCount}, excluded<3d=${primaryLog.rejectedUnderThreeDaysCount}, unverifiedOrClosed=${primaryLog.rejectedBrokenOrClosedCount}`
      );

      // Verify GET /api/global-opportunities strictly returns verified opportunities with >= 3 full days + Ethiopia Time schedulerInfo
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
        assert.ok(opp.deadline.fullDaysRemaining >= 3, `Opp with <3 days leaked: ${opp.id}`);
        assert.ok(opp.officialApplicationUrl.startsWith('https://'), `Non-HTTPS URL leaked: ${opp.id}`);
        assert.equal(isOpportunityActiveAndDisplayable(opp), true);
      }
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
