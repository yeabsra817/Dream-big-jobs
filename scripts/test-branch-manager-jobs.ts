import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import express from 'express';
import {
  classifyAllowedRegionScope,
  evaluateBranchManagerJobs,
  extractExplicitVisaSponsorshipEvidence,
  parseGuaranteedBaseSalaryUsd,
  RawDiscoveredBranchJob,
  registerBranchManagerJobsRoutes,
} from '../serverBranchManagerJobs';

function makeRawJob(overrides: Partial<RawDiscoveredBranchJob>): RawDiscoveredBranchJob {
  return {
    id: 'raw_1',
    title: 'Banking Operations Manager',
    employerName: 'Standard Chartered',
    locationRaw: 'London, United Kingdom',
    descriptionText:
      'Base salary: £78,000 - £92,000 per year GBP. We provide full Skilled Worker visa sponsorship and relocation package with family dependant visa support for international applicants worldwide. Requires 5+ years in commercial banking operations, credit controls, branch management, and team supervision.',
    applicationUrl: 'https://careers.sc.com/banking-ops-manager',
    sourcePortal: 'Standard Chartered Official Careers',
    datePosted: '2026-11-20',
    applicationDeadline: '2027-02-15',
    ethiopianEligibleHint: 'confirmed',
    ...overrides,
  };
}

async function runTests() {
  let passed = 0;

  // Test 1: Strict Geographic Scope (Africa International Banks/Companies, Middle East, Europe, Scandinavian ONLY)
  {
    assert.equal(
      classifyAllowedRegionScope({ locationRaw: 'Stockholm, Sweden', employerName: 'Klarna' }).regionScope,
      'Scandinavian'
    );
    assert.equal(
      classifyAllowedRegionScope({ locationRaw: 'Frankfurt, Germany', employerName: 'N26' }).regionScope,
      'Europe'
    );
    assert.equal(
      classifyAllowedRegionScope({ locationRaw: 'Riyadh, Saudi Arabia', employerName: 'Gulf Bank' }).regionScope,
      'Middle East'
    );
    assert.equal(
      classifyAllowedRegionScope({
        locationRaw: 'Nairobi, Kenya',
        employerName: 'African Development Bank',
      }).regionScope,
      'Africa (International Banks & Companies)'
    );

    // Purely local African company MUST be rejected!
    const localAfrican = classifyAllowedRegionScope({
      locationRaw: 'Nairobi, Kenya',
      employerName: 'Small Local Savings Cooperative Ltd',
    });
    assert.equal(localAfrican.allowed, false);
    assert.equal(localAfrican.rejectedAsLocalAfrican, true);

    // USA, Canada, Australia, Asia outside Middle East MUST be rejected!
    assert.equal(
      classifyAllowedRegionScope({ locationRaw: 'New York, United States', employerName: 'Citibank' }).allowed,
      false
    );
    assert.equal(
      classifyAllowedRegionScope({ locationRaw: 'Toronto, Canada', employerName: 'RBC' }).allowed,
      false
    );
    assert.equal(
      classifyAllowedRegionScope({ locationRaw: 'Sydney, Australia', employerName: 'ANZ' }).allowed,
      false
    );
    assert.equal(
      classifyAllowedRegionScope({ locationRaw: 'Singapore', employerName: 'DBS' }).allowed,
      false
    );

    passed += 1;
    console.log('✅ Test 1 passed: 4-region scope enforced & local African/non-allowed continents rejected');
  }

  // Test 2: Base Salary Parser & Currency Conversion (NO $3,000 threshold; undisclosed -> "Salary not disclosed")
  {
    const gbp = parseGuaranteedBaseSalaryUsd('Guaranteed base salary: £60,000 - £72,000 per year.');
    assert.equal(gbp.disclosed, true);
    assert.equal(gbp.currency, 'GBP');
    assert.ok(gbp.baseMonthlyUsd > 3000, '£60k/yr parses accurately');
    assert.ok(gbp.originalSalaryDisplay.includes('£60,000'));
    assert.ok(gbp.usdEquivalentDisplay.includes('$'));

    const sar = parseGuaranteedBaseSalaryUsd('Monthly gross base salary: SAR 18,000 per month.');
    assert.equal(sar.disclosed, true);
    assert.equal(sar.currency, 'SAR');
    assert.equal(sar.baseMonthlyUsd, 4800);

    const lowEur = parseGuaranteedBaseSalaryUsd('Base salary: €24,000 per year.');
    assert.equal(lowEur.disclosed, true);
    assert.ok(lowEur.baseMonthlyUsd < 3000, '€24k/yr parses accurately below $3,000/mo without rejection');

    const undisclosed = parseGuaranteedBaseSalaryUsd('Competitive salary plus performance bonus and benefits.');
    assert.equal(undisclosed.disclosed, false);
    assert.equal(undisclosed.originalSalaryDisplay, 'Salary not disclosed');
    assert.equal(undisclosed.usdEquivalentDisplay, 'Salary not disclosed');

    const revenueOnly = parseGuaranteedBaseSalaryUsd('We raised $50,000,000 Series B funding and process $500,000 volume.');
    assert.equal(revenueOnly.disclosed, false);
    assert.equal(revenueOnly.originalSalaryDisplay, 'Salary not disclosed');

    passed += 1;
    console.log('✅ Test 2 passed: Salary parser & FX conversion verified (undisclosed -> "Salary not disclosed")');
  }

  // Test 3: Strict Branch Banking Verification (NO $3,000 salary threshold, strict confirmed visa sponsorship & direct URL)
  {
    const candidates: RawDiscoveredBranchJob[] = [
      makeRawJob({ id: 'pass_europe_uk' }),
      makeRawJob({
        id: 'pass_scandinavia',
        title: 'Credit Risk Manager',
        employerName: 'Pleo',
        locationRaw: 'Copenhagen, Denmark',
        descriptionText:
          'Annual gross base salary: DKK 720,000 per year. Employer-sponsored work visa and relocation support provided for international hires.',
      }),
      makeRawJob({
        id: 'pass_middle_east',
        title: 'Branch Manager - Commercial Banking',
        employerName: 'Standard Chartered',
        locationRaw: 'Dubai, United Arab Emirates',
        descriptionText:
          'Gross monthly salary: AED 25,000 per month. Full visa sponsorship provided with relocation package and family visa support.',
      }),
      makeRawJob({
        id: 'pass_africa_intl',
        title: 'Grants Finance Manager',
        employerName: 'African Development Bank',
        locationRaw: 'Abidjan, Ivory Coast',
        descriptionText:
          'Base salary: USD 84,000 per year. Full international visa sponsorship and relocation package provided.',
      }),
      // MUST PASS: undisclosed salary with confirmed visa sponsorship (Section 1: NEVER exclude for undisclosed salary)
      makeRawJob({
        id: 'pass_undisclosed_salary',
        title: 'Finance Manager',
        descriptionText:
          'Competitive package. We offer full visa sponsorship for international applicants.',
      }),
      // MUST PASS: salary below $3,000/mo with confirmed visa sponsorship (Section 1 & 2: NO USD 3,000 restriction!)
      makeRawJob({
        id: 'pass_low_salary',
        title: 'Credit Operations Manager',
        employerName: 'EuroCredit GmbH',
        locationRaw: 'Berlin, Germany',
        descriptionText:
          'Base salary: EUR 28,000 per year. We offer full visa sponsorship for international applicants.',
      }),
      // MUST FAIL: no visa sponsorship
      makeRawJob({
        id: 'fail_no_visa',
        title: 'Financial Controller',
        descriptionText:
          'Base salary: £85,000 per year. Applicants must already have the right to work; no visa sponsorship available.',
      }),
      // MUST FAIL: employer previously sponsored other employees (NOT current confirmation!)
      makeRawJob({
        id: 'fail_past_sponsorship_only',
        title: 'Branch Operations Manager',
        employerName: 'Nordic Retail Group',
        locationRaw: 'Stockholm, Sweden',
        descriptionText:
          'Base salary: SEK 55,000 per month. Company has previously sponsored visas for employees on a case-by-case basis.',
      }),
      // MUST FAIL: search-result URL instead of direct official application link
      makeRawJob({
        id: 'fail_search_url',
        title: 'Retail Branch Manager',
        applicationUrl: 'https://careers.sc.com/jobs?search=branch-manager&q=london',
      }),
      // MUST FAIL: unrelated role (Software Engineer)
      makeRawJob({
        id: 'fail_unrelated_role',
        title: 'Senior Software Engineer',
        descriptionText:
          'Base salary: £120,000 per year. Full visa sponsorship available for international applicants.',
      }),
      // MUST FAIL: USA outside allowed 4 regions
      makeRawJob({
        id: 'fail_usa',
        title: 'Branch Manager',
        locationRaw: 'New York, United States',
      }),
      // MUST FAIL: local non-international African employer
      makeRawJob({
        id: 'fail_local_africa',
        title: 'Branch Manager',
        employerName: 'Local Micro Savings Cooperative',
        locationRaw: 'Nairobi, Kenya',
      }),
    ];

    const res = evaluateBranchManagerJobs({
      rawCandidates: candidates,
      isOwnerAccountProfile: true,
    });

    const ids = res.jobs.map((j) => j.id);
    assert.equal(res.jobs.length, 6, `Expected exactly 6 verified jobs (including undisclosed & <$3k salary), got ${res.jobs.length}: ${ids.join(', ')}`);
    assert.ok(ids.includes('pass_europe_uk'));
    assert.ok(ids.includes('pass_scandinavia'));
    assert.ok(ids.includes('pass_middle_east'));
    assert.ok(ids.includes('pass_africa_intl'));
    assert.ok(ids.includes('pass_undisclosed_salary'), 'Undisclosed salary with confirmed visa sponsorship MUST pass');
    assert.ok(ids.includes('pass_low_salary'), 'Salary below $3,000/mo with confirmed visa sponsorship MUST pass');
    assert.ok(!ids.includes('fail_past_sponsorship_only'), 'Past-sponsorship-only MUST NOT be classified as confirmed');
    assert.ok(!ids.includes('fail_search_url'), 'Search-result URL MUST be rejected');

    assert.equal(res.audit.excludedUndisclosedSalary, 0, 'Must NEVER exclude undisclosed salary');
    assert.equal(res.audit.excludedBelow3000Usd, 0, 'Must NEVER exclude salary below $3,000');
    assert.equal(res.audit.excludedNonMatchingRole, 1);
    assert.equal(res.audit.excludedOutsideAllowedRegions, 1);
    assert.equal(res.audit.excludedLocalAfricanNonInternational, 1);

    const undisclosedJob = res.jobs.find((j) => j.id === 'pass_undisclosed_salary')!;
    assert.equal(undisclosedJob.salaryDisclosed, false);
    assert.equal(undisclosedJob.originalSalaryDisplay, 'Salary not disclosed');
    assert.equal(undisclosedJob.usdEquivalentDisplay, 'Salary not disclosed');

    const lowSalaryJob = res.jobs.find((j) => j.id === 'pass_low_salary')!;
    assert.equal(lowSalaryJob.salaryDisclosed, true);
    assert.ok(lowSalaryJob.grossMonthlySalaryUsd < 3000);

    // Verify all required Section 13 fields present on every approved job
    for (const j of res.jobs) {
      assert.ok(j.originalSalaryDisplay.length > 3);
      assert.equal(j.visaTransparencyStatus, 'VISA SPONSORSHIP CONFIRMED');
      assert.ok(j.visaSponsorshipEvidence.length > 10);
      assert.ok(j.ethiopianEligibilityConfirmation.length > 10);
      assert.ok(j.officialApplicationUrl.startsWith('https://'));
      assert.equal(j.applicationLinkStatus, 'VERIFIED');
      assert.ok(j.deadlineStatusLabel && j.deadlineStatusLabel.length > 3);
      assert.ok(j.lastVerifiedAt && j.lastVerifiedAt.length > 10);
      assert.ok(
        j.workMode === 'onsite' || j.workMode === 'hybrid' || j.workMode === 'remote' || j.workMode === 'not_specified'
      );
      assert.ok(j.whyYouQualify.length >= 1);
      assert.ok(j.jobResponsibilities.length >= 1);
    }

    passed += 1;
    console.log('✅ Test 3 passed: Zero $3,000 restriction, undisclosed salary allowed, past-sponsorship & search URL rejected, Section 13 fields verified');
  }

  // Test 4: Strict Owner vs Public Privacy Isolation via HTTP Routes
  {
    const tmpDir = path.join('/tmp', `bm_privacy_test_${Date.now()}`);
    fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'data', 'branch_manager_jobs_store.json'),
      JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        lastDiscoveryAt: new Date().toISOString(),
        fxUpdatedAt: new Date().toISOString(),
        fxSourceNote: 'Test FX',
        fxRatesUsdBase: { USD: 1, GBP: 0.785, EUR: 0.92 },
        sourcesChecked: ['Test Official Portal'],
        rawCandidates: [makeRawJob({ id: 'live_test_1' })],
        users: {},
      })
    );

    const app = express();
    app.use(express.json());
    registerBranchManagerJobsRoutes({
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
      isPersistentOwnerRequest: (req) => req.headers['x-owner-test'] === 'true',
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
      // Unauthenticated user-profile MUST return 401
      const unauth = await fetch(`${base}/api/branch-manager-jobs/user-profile`);
      assert.equal(unauth.status, 401);

      // Owner gets their exact saved profile (Mekelle University, 2016, 9 yrs, CBE/Nib/Oromia/Tsedey)
      const ownerRes = await fetch(`${base}/api/branch-manager-jobs/user-profile`, {
        headers: { 'x-user-uid': 'owner_uid', 'x-owner-test': 'true' },
      });
      const ownerData = (await ownerRes.json()) as any;
      assert.equal(ownerData.profile.institution, 'Mekelle University');
      assert.equal(ownerData.profile.totalBankingYears, 9);
      assert.equal(ownerData.profile.branchManagerYears, 3);
      assert.ok(ownerData.profile.employers.some((e: string) => e.includes('Tsedey Bank')));

      // Non-owner user MUST NEVER see owner's Mekelle University / Tsedey Bank / CBE profile!
      const otherRes = await fetch(`${base}/api/branch-manager-jobs/user-profile`, {
        headers: { 'x-user-uid': 'other_user_uid' },
      });
      const otherData = (await otherRes.json()) as any;
      assert.equal(otherData.profile.institution, '');
      assert.equal(otherData.profile.employers.length, 0);

      // Guest search MUST NEVER expose owner's private profile!
      const guestSearch = await fetch(`${base}/api/branch-manager-jobs/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const guestData = (await guestSearch.json()) as any;
      assert.equal(guestData.isOwnerAccountProfile, false);
      assert.equal(guestData.profileUsed.institution, '');
      assert.equal(guestData.profileUsed.employers.length, 0);
    } finally {
      server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    passed += 1;
    console.log('✅ Test 4 passed: Owner profile strictly private & never exposed to other users or guests');
  }

  // Test 5: Navbar placement right next to Humanize Checker / Writing Tools
  {
    const navbar = fs.readFileSync(path.resolve('src/components/Navbar.tsx'), 'utf-8');
    assert.ok(navbar.includes('Jobs for Branch Manager'), 'Navbar must include Jobs for Branch Manager');
    const checkerIdx = navbar.indexOf('Humanize Checker');
    const branchMobileIdx = navbar.indexOf('Jobs for Branch Manager', checkerIdx);
    assert.ok(checkerIdx > 0 && branchMobileIdx > checkerIdx, 'Jobs for Branch Manager must appear next to Humanize Checker');

    passed += 1;
    console.log('✅ Test 5 passed: Navbar renders Jobs for Branch Manager right next to Humanize Checker');
  }

  console.log(`\n🎉 All ${passed}/${passed} Jobs for Branch Manager tests PASSED!`);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
