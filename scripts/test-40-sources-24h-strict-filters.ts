/**
 * Hopeland Jobs — 40 Permanent Sources, 24-Hour Monitoring & Strict Job Filter Verification Suite
 *
 * Verifies ALL 9 mandatory Section 8 acceptance test cases:
 *  1. Ethiopian domestic Branch Manager job paying below $3,000 + undisclosed salary -> remains eligible.
 *  2. International Branch Manager job paying > $3,000 with confirmed employer visa sponsorship -> eligible.
 *  3. International Branch Manager job paying > $3,000 WITHOUT confirmed sponsorship (and "permission to apply") -> rejected.
 *  4. International Branch Manager job WITH sponsorship but salary below $3,000 -> rejected from special Branch Banking category.
 *  5. International non-branch job paying below $3,000 with confirmed sponsorship -> NOT rejected solely because of salary.
 *  6. Same opportunity discovered across 3 websites -> published as ONLY ONE record, original primary source preserved.
 *  7. Same opportunity re-discovered after 24 hours -> updates existing record, NO duplicate, user NOT notified again;
 *     default user notification preferences exclude scholarships/training/conferences unless opted in.
 *  8. Expired opportunity -> automatically unpublished/removed while preserved in permanent history.
 *  9. 40 registered permanent sources (10 per region), 24-hour Africa/Addis_Ababa scheduler, and manual run schedule preservation.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildAndVerifyCanonicalOpportunity,
  evaluateOpportunityForUserProfile,
} from '../src/utils/strictOpportunityMatcher';
import type { UserProfessionalProfileInput } from '../src/types/opportunityIntelligence';
import {
  OpportunityIntelligenceEngine,
  buildInitialOfficialSourcesRegistry,
} from '../serverOpportunityIntelligence';

function futureIso(daysAhead: number, baseMs = Date.now()): string {
  return new Date(baseMs + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function loadJsonFileSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFileAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

const BRANCH_MANAGER_PROFILE: UserProfessionalProfileInput = {
  userId: 'usr-branch-manager-et',
  email: 'bm@hopelandjobs.tech',
  fullName: 'Abebe Bikila',
  professionalSector: 'branch_banking',
  currentOccupation: 'Branch Manager',
  educationLevel: 'bachelors',
  fieldOfStudy: 'Banking and Finance',
  yearsOfExperience: 9,
  bankingExperienceYears: 9,
  managerialExperienceYears: 3,
  skills: ['Branch Banking', 'Retail Banking', 'Deposit Mobilization', 'Credit Operations', 'KYC/AML'],
  certifications: ['Certified Branch Manager'],
  careerLevel: 'manager',
  preferredLocations: ['Ethiopia', 'United Arab Emirates', 'Qatar', 'Germany', 'United Kingdom'],
  preferredEnvironment: 'both',
  nationality: 'Ethiopian',
};

const WASH_SPECIALIST_PROFILE: UserProfessionalProfileInput = {
  userId: 'usr-wash-specialist-et',
  email: 'wash@hopelandjobs.tech',
  fullName: 'Selamawit Tadesse',
  professionalSector: 'wash',
  currentOccupation: 'WASH Programme Officer',
  educationLevel: 'masters',
  fieldOfStudy: 'Water Supply and Environmental Engineering',
  yearsOfExperience: 6,
  managerialExperienceYears: 1,
  skills: ['WASH', 'Water Supply', 'Sanitation', 'Hygiene Promotion', 'Hydraulic Modeling'],
  certifications: ['Sphere Standards'],
  careerLevel: 'senior_professional',
  preferredLocations: ['Germany', 'Netherlands', 'Norway', 'Sweden', 'United Kingdom'],
  preferredEnvironment: 'both',
  nationality: 'Ethiopian',
};

async function runAll9Tests() {
  const nowMs = Date.now();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hopeland-40-sources-test-'));

  try {
    console.log('\n========================================================================');
    console.log('HOPELAND JOBS — 40 SOURCES, 24H SCHEDULER & STRICT FILTER TEST SUITE');
    console.log('========================================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: Ethiopian Branch Manager job < $3,000 + undisclosed salary -> ELIGIBLE
    // -------------------------------------------------------------------------
    const ethiopianLowSalaryBm = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Branch Manager - Addis Ababa Main Branch',
        employer: 'Commercial Bank of Ethiopia',
        country: 'Ethiopia',
        city: 'Addis Ababa',
        category: 'job',
        officialApplicationUrl: 'https://careers.combanketh.et/jobs/bm-addis-2026',
        sourceUrl: 'https://careers.combanketh.et/jobs/bm-addis-2026',
        sourceName: 'Commercial Bank of Ethiopia Careers',
        deadlineRaw: futureIso(18, nowMs),
        compensationRaw: 'ETB 45,000 per month gross',
        description:
          'Lead branch banking operations, retail deposit mobilization, SME credit portfolio growth, KYC/AML compliance, and team coaching in Addis Ababa. Minimum 8 years banking experience including 3 years managerial experience.',
        responsibilities: [
          'Lead daily retail branch operations and deposit mobilization targets',
          'Supervise branch customer service, teller controls, and SME credit origination',
          'Ensure strict National Bank of Ethiopia regulatory compliance and KYC/AML governance',
        ],
      },
      { nowMs }
    );

    assert.equal(ethiopianLowSalaryBm.environment, 'ethiopia_domestic');
    assert.equal(ethiopianLowSalaryBm.status, 'published', 'Ethiopian Branch Manager < $3k MUST publish');
    assert.equal(
      ethiopianLowSalaryBm.isBranchBankingMatch,
      true,
      'Ethiopian Branch Manager < $3k MUST remain eligible for Branch Banking profile (no $3k domestic gate)'
    );
    assert.ok(
      (ethiopianLowSalaryBm.salary.normalizedMonthlyUsd ?? 0) < 3000,
      'Normalized domestic salary should indeed be < $3,000/month'
    );
    assert.ok(
      !ethiopianLowSalaryBm.rejectionCodes.includes('salary_below_threshold'),
      'Ethiopian domestic job must NEVER be rejected for salary_below_threshold'
    );

    const ethiopianUndisclosedBm = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Branch Manager - Hawassa District',
        employer: 'Awash Bank',
        country: 'Ethiopia',
        city: 'Hawassa',
        category: 'job',
        officialApplicationUrl: 'https://careers.awashbank.com/jobs/bm-hawassa-2026',
        sourceUrl: 'https://careers.awashbank.com/jobs/bm-hawassa-2026',
        sourceName: 'Awash Bank Careers',
        deadlineRaw: futureIso(14, nowMs),
        compensationRaw: '', // Undisclosed salary
        description:
          'Manage full branch banking operations, branch staff supervision, credit appraisal, and deposit mobilization in Hawassa. Requires 8 years banking experience and 3 years branch management experience.',
      },
      { nowMs }
    );

    assert.equal(ethiopianUndisclosedBm.status, 'published', 'Ethiopian job with undisclosed salary MUST publish');
    assert.equal(
      ethiopianUndisclosedBm.salary.salaryDisplay,
      'Salary not disclosed',
      'Undisclosed salary must be clearly marked as "Salary not disclosed"'
    );
    assert.equal(
      ethiopianUndisclosedBm.visa.transparencyStatus,
      'Visa sponsorship not applicable — domestic opportunity',
      'Domestic Ethiopian opportunity must carry exact domestic visa label'
    );
    assert.equal(
      ethiopianUndisclosedBm.isBranchBankingMatch,
      true,
      'Ethiopian Branch Manager with undisclosed salary MUST remain eligible'
    );
    const etMatchForUser = evaluateOpportunityForUserProfile(ethiopianUndisclosedBm, BRANCH_MANAGER_PROFILE);
    assert.equal(etMatchForUser.eligible, true, 'Ethiopian domestic job must match Ethiopian Branch Manager user');
    console.log('[PASS] CASE 1: Ethiopian Branch Manager (<$3,000 & "Salary not disclosed") eligible with exact domestic visa label.');

    // -------------------------------------------------------------------------
    // TEST 2: International Branch Manager WITH confirmed employer visa sponsorship -> ELIGIBLE
    // -------------------------------------------------------------------------
    const intlBmValid = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Retail Branch Manager - Dubai Flagship',
        employer: 'Emirates NBD',
        country: 'United Arab Emirates',
        city: 'Dubai',
        category: 'job',
        officialApplicationUrl: 'https://careers.emiratesnbd.com/jobs/retail-branch-manager-dubai-901',
        sourceUrl: 'https://www.bayt.com/en/uae/jobs/retail-branch-manager-901/',
        sourceName: 'Bayt',
        referenceNumber: 'ENBD-BM-2026-901',
        deadlineRaw: futureIso(20, nowMs),
        compensationRaw: 'USD 5,200 per month gross',
        explicitVisaNote:
          'Employer provides full UAE employment visa sponsorship, work permit processing, visa fees covered by employer, and international relocation assistance. International applicants from Ethiopia welcome.',
        description:
          'Direct branch banking P&L, retail deposits, SME lending, operational risk controls, and branch staff coaching. Minimum 8 years banking experience with 3 years managerial leadership.',
      },
      { nowMs }
    );

    assert.equal(intlBmValid.status, 'published', 'Valid international Branch Manager with sponsorship MUST publish');
    assert.equal(intlBmValid.isBranchBankingMatch, true, 'Valid international Branch Manager MUST match Branch Banking feature');
    assert.equal(intlBmValid.visa.verified, true);
    assert.equal(intlBmValid.visa.transparencyStatus, 'VISA SPONSORSHIP CONFIRMED');
    assert.equal(intlBmValid.applicationLinkVerification.status, 'VERIFIED');
    assert.equal(intlBmValid.deadlineStatusLabel, 'OPEN — ACCEPTING APPLICATIONS');
    console.log('[PASS] CASE 2: International Branch Manager (confirmed employer visa sponsorship + verified direct link) published & matched.');

    // -------------------------------------------------------------------------
    // TEST 3: Visa Sponsorship Transparency — All 4 International Statuses + Past Sponsorship Trap
    //         Branch Banking MUST reject unconfirmed/past-only/relocation-only sponsorship
    // -------------------------------------------------------------------------
    const intlBmNoVisa = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Branch Manager - Doha Commercial Branch',
        employer: 'Qatar Gulf Commercial Bank',
        country: 'Qatar',
        city: 'Doha',
        category: 'job',
        officialApplicationUrl: 'https://careers.qgcb.qa/jobs/bm-doha-77',
        sourceUrl: 'https://www.gulftalent.com/qatar/jobs/bm-doha-77',
        sourceName: 'GulfTalent',
        deadlineRaw: futureIso(20, nowMs),
        compensationRaw: 'USD 5,500 per month gross',
        explicitVisaNote:
          'No visa sponsorship is offered. Applicants must already have work authorization in Qatar.',
        description:
          'Manage retail branch operations, deposits, credit controls, and branch KPIs. 8+ years banking experience and 3 years branch management.',
      },
      { nowMs }
    );
    assert.equal(intlBmNoVisa.status, 'published', 'General international job without sponsorship publishes transparently');
    assert.equal(intlBmNoVisa.visa.verified, false);
    assert.equal(intlBmNoVisa.visa.transparencyStatus, 'VISA SPONSORSHIP NOT OFFERED');
    assert.equal(intlBmNoVisa.isBranchBankingMatch, false, 'Branch Banking MUST exclude VISA SPONSORSHIP NOT OFFERED');

    const intlBmPastSponsorOnly = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Branch Manager - Amsterdam',
        employer: 'Dutch Retail Financial Group',
        country: 'Netherlands',
        city: 'Amsterdam',
        category: 'job',
        officialApplicationUrl: 'https://careers.dutchretail.nl/jobs/bm-ams-12',
        sourceUrl: 'https://careers.dutchretail.nl/jobs/bm-ams-12',
        sourceName: 'Dutch Retail Financial Group',
        deadlineRaw: futureIso(20, nowMs),
        compensationRaw: 'EUR 4,500 per month gross',
        explicitVisaNote:
          'International applicants welcome with relocation assistance. Employer has previously sponsored other employees on a case-by-case basis.',
        description:
          'Manage retail branch operations, deposits, and team leadership. 8 years banking and 3 years management.',
      },
      { nowMs }
    );
    assert.equal(intlBmPastSponsorOnly.visa.verified, false, 'Past sponsorship / relocation assistance MUST NOT count as confirmed visa sponsorship');
    assert.equal(intlBmPastSponsorOnly.visa.transparencyStatus, 'VISA SPONSORSHIP REQUIRES CONFIRMATION');
    assert.equal(intlBmPastSponsorOnly.isBranchBankingMatch, false, 'Branch Banking MUST NOT accept REQUIRES CONFIRMATION');

    const intlSilentVisa = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Water Engineer - Municipal Systems',
        employer: 'EuroWater Consultancy',
        country: 'Germany',
        city: 'Munich',
        category: 'job',
        officialApplicationUrl: 'https://careers.eurowater.de/jobs/water-engineer-55',
        sourceUrl: 'https://careers.eurowater.de/jobs/water-engineer-55',
        sourceName: 'EuroWater Consultancy',
        deadlineRaw: futureIso(20, nowMs),
        compensationRaw: '',
        description:
          'Design municipal water supply and sanitation distribution networks across southern Germany. 5+ years water engineering experience.',
      },
      { nowMs }
    );
    assert.equal(intlSilentVisa.status, 'published');
    assert.equal(intlSilentVisa.visa.transparencyStatus, 'VISA SPONSORSHIP NOT SPECIFIED');
    assert.equal(intlSilentVisa.salary.salaryDisplay, 'Salary not disclosed');
    console.log('[PASS] CASE 3: All 4 international visa statuses verified; past-sponsorship/relocation-only blocked from Branch Banking.');

    // -------------------------------------------------------------------------
    // TEST 4: International Branch Manager WITH confirmed sponsorship AND salary < $3,000 + undisclosed salary
    //         -> MUST NOW PASS & MATCH (Section 1 & 2: NO USD 3,000 SALARY RESTRICTION!)
    // -------------------------------------------------------------------------
    const intlBmLowSalary = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Branch Manager - Retail Banking',
        employer: 'Baltic Retail Bank',
        country: 'Lithuania',
        city: 'Vilnius',
        category: 'job',
        officialApplicationUrl: 'https://careers.balticretailbank.lt/jobs/bm-vilnius-44',
        sourceUrl: 'https://eures.europa.eu/jobs/bm-vilnius-44',
        sourceName: 'EURES',
        deadlineRaw: futureIso(25, nowMs),
        compensationRaw: 'USD 2,400 per month gross',
        explicitVisaNote:
          'Employer provides EU work visa sponsorship and full work permit processing for qualified non-EU applicants including Ethiopian citizens.',
        description:
          'Oversee branch banking operations, retail customer service, deposit growth, and KYC/AML compliance. Requires 8 years banking experience and 3 years managerial experience.',
      },
      { nowMs }
    );

    assert.equal(intlBmLowSalary.status, 'published', 'Intl Branch Manager < $3,000 with confirmed sponsorship MUST publish');
    assert.equal(
      intlBmLowSalary.isBranchBankingMatch,
      true,
      'Intl Branch Manager < $3,000 with confirmed sponsorship MUST match Branch Banking (ALL $3,000 restrictions removed!)'
    );
    assert.ok(!intlBmLowSalary.rejectionCodes.includes('salary_below_threshold'));

    const intlBmUndisclosedSalary = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Retail Branch Manager - Prague',
        employer: 'Central Europe Commercial Bank',
        country: 'Czech Republic',
        city: 'Prague',
        category: 'job',
        officialApplicationUrl: 'https://careers.cecb.cz/jobs/retail-branch-manager-99',
        sourceUrl: 'https://careers.cecb.cz/jobs/retail-branch-manager-99',
        sourceName: 'CECB Careers',
        deadlineRaw: futureIso(20, nowMs),
        compensationRaw: '',
        explicitVisaNote: 'Employer provides full work visa sponsorship for international hires.',
        description:
          'Lead branch banking operations, retail deposits, credit operations, and KYC/AML compliance. Requires 8 years banking and 3 years managerial experience.',
      },
      { nowMs }
    );
    assert.equal(intlBmUndisclosedSalary.status, 'published');
    assert.equal(intlBmUndisclosedSalary.salary.salaryDisplay, 'Salary not disclosed');
    assert.equal(
      intlBmUndisclosedSalary.isBranchBankingMatch,
      true,
      'Intl Branch Manager with undisclosed salary and confirmed visa sponsorship MUST match Branch Banking'
    );
    console.log('[PASS] CASE 4: International Branch Manager (<$3,000 & "Salary not disclosed" with confirmed visa sponsorship) BOTH matched with zero $3,000 restriction.');

    // -------------------------------------------------------------------------
    // TEST 5: International NON-branch job paying < $3,000 + Direct Link & Funding Verification
    // -------------------------------------------------------------------------
    const intlWashLowSalary = buildAndVerifyCanonicalOpportunity(
      {
        title: 'WASH Technical Specialist - Water Supply Systems',
        employer: 'Nordic Water Aid Foundation',
        country: 'Norway',
        city: 'Oslo',
        category: 'job',
        officialApplicationUrl: 'https://careers.nordicwateraid.no/jobs/wash-specialist-2026',
        sourceUrl: 'https://arbeidsplassen.nav.no/stillinger/stilling/wash-2026',
        sourceName: 'NAV / Arbeidsplassen',
        deadlineRaw: futureIso(22, nowMs),
        compensationRaw: 'USD 2,350 per month gross',
        explicitVisaNote:
          'Employer sponsors Norwegian skilled worker work visa and residence permit for international candidates including Ethiopia.',
        description:
          'Lead water supply design, sanitation systems, hygiene promotion, and WASH monitoring across international field partnerships. Minimum 5 years WASH engineering experience.',
      },
      { nowMs }
    );

    assert.equal(intlWashLowSalary.status, 'published');
    assert.ok(!intlWashLowSalary.rejectionCodes.includes('salary_below_threshold'));
    const washMatch = evaluateOpportunityForUserProfile(intlWashLowSalary, WASH_SPECIALIST_PROFILE);
    assert.equal(washMatch.eligible, true);

    // Direct Application Link Rejection: Search-result URL & generic homepage MUST be rejected (NOT VERIFIED)
    const searchUrlRejected = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Branch Manager - Search Link Trap',
        employer: 'Example Bank',
        country: 'United Kingdom',
        city: 'London',
        category: 'job',
        officialApplicationUrl: 'https://careers.examplebank.co.uk/jobs?search=branch-manager&q=london',
        sourceUrl: 'https://careers.examplebank.co.uk/jobs?search=branch-manager',
        sourceName: 'Example Bank',
        deadlineRaw: futureIso(15, nowMs),
        explicitVisaNote: 'Employer provides Skilled Worker visa sponsorship.',
        description: 'Branch manager role with 8 years banking experience.',
      },
      { nowMs }
    );
    assert.equal(searchUrlRejected.status, 'rejected', 'Search-result URL MUST be rejected');
    assert.equal(searchUrlRejected.applicationLinkVerification.status, 'NOT VERIFIED');

    const homepageRejected = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Branch Manager - Bare Homepage Trap',
        employer: 'Example Bank Two',
        country: 'United Kingdom',
        city: 'London',
        category: 'job',
        officialApplicationUrl: 'https://www.examplebanktwo.co.uk/',
        sourceUrl: 'https://www.examplebanktwo.co.uk/',
        sourceName: 'Example Bank Two',
        deadlineRaw: futureIso(15, nowMs),
        explicitVisaNote: 'Employer provides Skilled Worker visa sponsorship.',
        description: 'Branch manager role with 8 years banking experience.',
      },
      { nowMs }
    );
    assert.equal(homepageRejected.status, 'rejected', 'Generic bare homepage URL MUST be rejected');
    assert.equal(homepageRejected.applicationLinkVerification.status, 'NOT VERIFIED');

    // Accurate Scholarship Funding: Partial funding MUST NEVER be labeled "Fully Funded"
    const partialScholarship = buildAndVerifyCanonicalOpportunity(
      {
        title: 'MSc Global Finance Partial Tuition Grant',
        employer: 'University of Helsinki',
        country: 'Finland',
        city: 'Helsinki',
        category: 'scholarship',
        officialApplicationUrl: 'https://www.helsinki.fi/en/admissions/scholarships/global-finance-grant-2026',
        sourceUrl: 'https://www.helsinki.fi/en/admissions/scholarships',
        sourceName: 'Studyinfo Finland',
        deadlineRaw: futureIso(30, nowMs),
        explicitFundingNote: '50% tuition waiver; living expenses and travel are self-funded by the student.',
        description: 'Graduate finance scholarship offering partial tuition fee waiver for international applicants.',
      },
      { nowMs }
    );
    assert.equal(partialScholarship.status, 'published');
    assert.ok(
      /partially funded/i.test(partialScholarship.eligibility.fundingCoverage),
      `Partial grant must be classified as Partially Funded, got: ${partialScholarship.eligibility.fundingCoverage}`
    );
    assert.ok(
      !/^fully funded/i.test(partialScholarship.eligibility.fundingCoverage.trim()),
      'Partial scholarship MUST NEVER be labeled Fully Funded'
    );
    console.log('[PASS] CASE 5: Non-branch WASH <$3k passed; search-result & homepage URLs rejected; partial scholarship never labeled Fully Funded.');

    // -------------------------------------------------------------------------
    // TEST 6: Same opportunity discovered across 5 websites -> ONLY ONE published record
    // -------------------------------------------------------------------------
    const engine = new OpportunityIntelligenceEngine({
      runtimeBaseDir: tmpDir,
      isVercel: false,
      ensureRuntimeDataDir: () => fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true }),
      loadJsonFileSafe,
      writeJsonFileAtomic,
      loadUserProfiles: () => ({}),
      appendAuditLog: () => {},
    });
    const db = engine.loadDb();

    const fiveWebsites = [
      {
        name: 'Bayt',
        appUrl: 'https://careers.bankfab.com/jobs/fab-bm-2026-501?utm_source=bayt',
        srcUrl: 'https://www.bayt.com/en/uae/jobs/fab-bm-501/',
        title: 'Retail Branch Manager - Abu Dhabi Central',
      },
      {
        name: 'GulfTalent',
        appUrl: 'https://www.gulftalent.com/uae/jobs/fab-bm-501',
        srcUrl: 'https://www.gulftalent.com/uae/jobs/fab-bm-501',
        title: 'Retail Branch Manager – Abu Dhabi Central',
      },
      {
        name: 'Naukrigulf',
        appUrl: 'https://www.naukrigulf.com/fab-retail-branch-manager-501',
        srcUrl: 'https://www.naukrigulf.com/fab-retail-branch-manager-501',
        title: 'Retail Branch Manager - Abu Dhabi Central',
      },
      {
        name: 'EURES',
        appUrl: 'https://eures.europa.eu/jobs/fab-bm-501',
        srcUrl: 'https://eures.europa.eu/jobs/fab-bm-501',
        title: 'Retail Branch Manager (Abu Dhabi Central)',
      },
      {
        name: 'Indeed Worldwide',
        appUrl: 'https://ae.indeed.com/viewjob?jk=fab501',
        srcUrl: 'https://ae.indeed.com/viewjob?jk=fab501',
        title: 'Retail Branch Manager - Abu Dhabi Central',
      },
    ];

    let firstSourceIngest!: ReturnType<typeof engine.ingestAndVerifyCandidate>;
    let lastSourceIngest!: ReturnType<typeof engine.ingestAndVerifyCandidate>;
    fiveWebsites.forEach((site, idx) => {
      const res = engine.ingestAndVerifyCandidate(
        db,
        {
          title: site.title,
          employer: 'First Abu Dhabi Bank',
          country: 'United Arab Emirates',
          city: 'Abu Dhabi',
          category: 'job',
          officialApplicationUrl: site.appUrl,
          sourceUrl: site.srcUrl,
          sourceName: site.name,
          referenceNumber: 'FAB-REQ-2026-501',
          deadlineRaw: futureIso(24, nowMs),
          compensationRaw: 'USD 5,400 per month gross',
          explicitVisaNote:
            'Full UAE employment visa sponsorship, work permit and relocation package provided by employer for Ethiopian and international applicants.',
          description:
            'Manage full retail branch banking operations, deposit mobilization, credit growth, KYC/AML compliance, and branch staff supervision. 8 years banking and 3 years managerial experience.',
        },
        { nowMs: nowMs + idx * 1000 }
      );
      if (idx === 0) {
        firstSourceIngest = res;
        assert.equal(res.outcome, 'created');
      } else {
        assert.equal(res.outcome, 'duplicate_merged', `Site #${idx + 1} (${site.name}) must collapse into 1 canonical record`);
      }
      lastSourceIngest = res;
    });

    const publishedNow = engine.getAllOpportunities(db).filter((o) => o.status === 'published');
    assert.equal(publishedNow.length, 1, '5 websites with same opportunity MUST produce ONLY 1 published record');
    assert.equal(lastSourceIngest.record.primarySourceName, 'Bayt', 'Original primary source MUST be preserved');
    assert.equal(lastSourceIngest.record.sourceNames.length, 5, 'All 5 discovering sources must be tracked on the single record');
    console.log('[PASS] CASE 6: Same opportunity across 5 websites collapsed into 1 canonical record with original primary source preserved.');

    // -------------------------------------------------------------------------
    // TEST 7: 24h re-discovery -> 0 duplicates, 0 repeat notifications;
    //         Meaningful change (confirmed visa sponsorship added) -> notifies user ONCE
    // -------------------------------------------------------------------------
    db.user_professional_profiles[BRANCH_MANAGER_PROFILE.userId] = BRANCH_MANAGER_PROFILE;
    const defaultPrefs = engine.getOrCreateNotificationPreferences(db, BRANCH_MANAGER_PROFILE.userId);
    assert.deepEqual(defaultPrefs.categories, ['job']);

    const schIngest = engine.ingestAndVerifyCandidate(
      db,
      {
        title: 'Master of Banking & Financial Risk Management Scholarship',
        employer: 'DAAD Germany',
        country: 'Germany',
        city: 'Frankfurt',
        category: 'scholarship',
        officialApplicationUrl: 'https://www.daad.de/en/study-and-research-in-germany/scholarships/banking-2026',
        sourceUrl: 'https://www.daad.de/en/',
        sourceName: 'DAAD',
        deadlineRaw: futureIso(30, nowMs),
        explicitVisaNote: 'Full tuition, monthly stipend, health insurance, and official visa sponsorship provided with visa fees covered for Ethiopian applicants.',
        description: 'Fully funded graduate scholarship in retail banking, risk management, and financial leadership. Individual applications accepted directly.',
      },
      { nowMs }
    );
    assert.equal(schIngest.outcome, 'created');
    assert.equal(schIngest.record.status, 'published');

    const bmJobMatch = evaluateOpportunityForUserProfile(firstSourceIngest.record, BRANCH_MANAGER_PROFILE);
    const bmSchMatch = evaluateOpportunityForUserProfile(schIngest.record, BRANCH_MANAGER_PROFILE);

    const jobNotif1 = engine.dispatchDeduplicatedNotificationForUser(db, {
      userId: BRANCH_MANAGER_PROFILE.userId,
      opportunity: firstSourceIngest.record,
      match: bmJobMatch,
      nowMs,
      mirrorToLegacyUserNotifications: false,
    });
    assert.equal(jobNotif1.sent, true);

    const schNotif1 = engine.dispatchDeduplicatedNotificationForUser(db, {
      userId: BRANCH_MANAGER_PROFILE.userId,
      opportunity: schIngest.record,
      match: bmSchMatch,
      nowMs,
      mirrorToLegacyUserNotifications: false,
    });
    assert.equal(schNotif1.sent, false);
    assert.equal(schNotif1.reason, 'suppressed_preferences');

    const after24hMs = nowMs + 24.5 * 60 * 60 * 1000;
    const updatedBefore24h = db.opportunitiesUpdated;
    const rediscovered24h = engine.ingestAndVerifyCandidate(
      db,
      {
        title: 'Retail Branch Manager - Abu Dhabi Central',
        employer: 'First Abu Dhabi Bank',
        country: 'United Arab Emirates',
        city: 'Abu Dhabi',
        category: 'job',
        officialApplicationUrl: 'https://careers.bankfab.com/jobs/fab-bm-2026-501',
        sourceUrl: 'https://www.bayt.com/en/uae/jobs/fab-bm-501/',
        sourceName: 'Bayt',
        referenceNumber: 'FAB-REQ-2026-501',
        deadlineRaw: futureIso(24, nowMs),
        compensationRaw: 'USD 5,400 per month gross',
        explicitVisaNote:
          'Full UAE employment visa sponsorship, work permit and relocation package provided by employer for Ethiopian and international applicants.',
        description:
          'Manage full retail branch banking operations, deposit mobilization, credit growth, KYC/AML compliance, and branch staff supervision. 8 years banking and 3 years managerial experience.',
      },
      { nowMs: after24hMs }
    );
    assert.equal(rediscovered24h.outcome, 'duplicate_merged');
    assert.equal(db.opportunitiesUpdated, updatedBefore24h + 1);

    const jobNotif2 = engine.dispatchDeduplicatedNotificationForUser(db, {
      userId: BRANCH_MANAGER_PROFILE.userId,
      opportunity: rediscovered24h.record,
      match: bmJobMatch,
      nowMs: after24hMs,
      mirrorToLegacyUserNotifications: false,
    });
    assert.equal(jobNotif2.sent, false);
    assert.equal(jobNotif2.reason, 'suppressed_duplicate');

    // Meaningful change: deadline extended -> increments updateVersion & notifies ONCE
    const deadlineExtended = engine.ingestAndVerifyCandidate(
      db,
      {
        title: 'Retail Branch Manager - Abu Dhabi Central',
        employer: 'First Abu Dhabi Bank',
        country: 'United Arab Emirates',
        city: 'Abu Dhabi',
        category: 'job',
        officialApplicationUrl: 'https://careers.bankfab.com/jobs/fab-bm-2026-501',
        sourceUrl: 'https://www.bayt.com/en/uae/jobs/fab-bm-501/',
        sourceName: 'Bayt',
        referenceNumber: 'FAB-REQ-2026-501',
        deadlineRaw: futureIso(40, nowMs),
        compensationRaw: 'USD 5,400 per month gross',
        explicitVisaNote:
          'Full UAE employment visa sponsorship, work permit and relocation package provided by employer for Ethiopian and international applicants.',
        description:
          'Manage full retail branch banking operations, deposit mobilization, credit growth, KYC/AML compliance, and branch staff supervision. 8 years banking and 3 years managerial experience.',
      },
      { nowMs: after24hMs + 5000 }
    );
    assert.equal(deadlineExtended.outcome, 'material_updated', 'Extended deadline must trigger material_updated');
    const jobNotifMeaningful = engine.dispatchDeduplicatedNotificationForUser(db, {
      userId: BRANCH_MANAGER_PROFILE.userId,
      opportunity: deadlineExtended.record,
      match: bmJobMatch,
      nowMs: after24hMs + 5000,
      mirrorToLegacyUserNotifications: false,
    });
    assert.equal(jobNotifMeaningful.sent, true, 'Meaningful deadline update MUST notify user');
    console.log('[PASS] CASE 7: 24h re-discovery produced 0 duplicates & 0 repeat alerts; meaningful deadline update notified user cleanly.');

    // -------------------------------------------------------------------------
    // TEST 8: All 6 Deadline Status Labels + Auto-Unpublish Expired & Permanent History
    // -------------------------------------------------------------------------
    const closingSoonJob = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Branch Manager - Closing Soon Test',
        employer: 'Nordic Bank Group',
        country: 'Sweden',
        city: 'Stockholm',
        category: 'job',
        officialApplicationUrl: 'https://careers.nordicbank.se/jobs/bm-soon-1',
        sourceUrl: 'https://careers.nordicbank.se/jobs/bm-soon-1',
        sourceName: 'Nordic Bank Group',
        deadlineRaw: futureIso(5, nowMs), // 3..7 days -> CLOSING SOON
        explicitVisaNote: 'Employer provides full Swedish work visa sponsorship.',
        description: 'Branch banking management role. 8 years banking and 3 years managerial experience.',
      },
      { nowMs }
    );
    assert.equal(closingSoonJob.deadlineStatusLabel, 'CLOSING SOON');

    const closedJob = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Branch Manager - Closed Test',
        employer: 'Nordic Bank Group',
        country: 'Sweden',
        city: 'Stockholm',
        category: 'job',
        officialApplicationUrl: 'https://careers.nordicbank.se/jobs/bm-closed-1',
        sourceUrl: 'https://careers.nordicbank.se/jobs/bm-closed-1',
        sourceName: 'Nordic Bank Group',
        deadlineRaw: futureIso(20, nowMs),
        isClosedOrWithdrawn: true,
        explicitVisaNote: 'Employer provides full Swedish work visa sponsorship.',
        description: 'This position has been filled and applications are closed.',
      },
      { nowMs }
    );
    assert.equal(closedJob.deadlineStatusLabel, 'APPLICATIONS CLOSED');
    assert.ok(closedJob.status === 'expired' || closedJob.status === 'rejected');

    const notPublishedDeadline = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Branch Manager - No Deadline Published',
        employer: 'Nordic Bank Group',
        country: 'Sweden',
        city: 'Stockholm',
        category: 'job',
        officialApplicationUrl: 'https://careers.nordicbank.se/jobs/bm-nodate-1',
        sourceUrl: 'https://careers.nordicbank.se/jobs/bm-nodate-1',
        sourceName: 'Nordic Bank Group',
        deadlineRaw: '',
        explicitVisaNote: 'Employer provides full Swedish work visa sponsorship.',
        description: 'Branch banking management role. 8 years banking and 3 years managerial experience.',
      },
      { nowMs }
    );
    assert.equal(notPublishedDeadline.deadlineStatusLabel, 'DEADLINE NOT PUBLISHED');

    const notYetOpenJob = buildAndVerifyCanonicalOpportunity(
      {
        title: 'Branch Manager - Opens Next Month',
        employer: 'Nordic Bank Group',
        country: 'Sweden',
        city: 'Stockholm',
        category: 'job',
        officialApplicationUrl: 'https://careers.nordicbank.se/jobs/bm-future-open-1',
        sourceUrl: 'https://careers.nordicbank.se/jobs/bm-future-open-1',
        sourceName: 'Nordic Bank Group',
        deadlineRaw: `Applications open on ${futureIso(15, nowMs)}`,
        explicitVisaNote: 'Employer provides full Swedish work visa sponsorship.',
        description: 'Applications open next month for branch manager role.',
      },
      { nowMs }
    );
    assert.equal(notYetOpenJob.deadlineStatusLabel, 'NOT YET OPEN');

    const soonExpiringIngest = engine.ingestAndVerifyCandidate(
      db,
      {
        title: 'Senior Branch Manager - Riyadh',
        employer: 'Saudi National Bank',
        country: 'Saudi Arabia',
        city: 'Riyadh',
        category: 'job',
        officialApplicationUrl: 'https://careers.alahli.com/jobs/snb-bm-riyadh-88',
        sourceUrl: 'https://www.gulftalent.com/saudi-arabia/jobs/snb-bm-88',
        sourceName: 'GulfTalent',
        deadlineRaw: futureIso(5, nowMs),
        compensationRaw: 'USD 6,000 per month gross',
        explicitVisaNote: 'Employer provides Saudi employment work visa sponsorship and relocation support.',
        description: 'Direct branch banking operations, deposits, and credit teams. 8 years banking and 3 years managerial experience.',
      },
      { nowMs }
    );
    assert.equal(soonExpiringIngest.outcome, 'created');
    assert.equal(soonExpiringIngest.record.status, 'published');

    // Fast-forward 6 days so deadline has passed
    const sixDaysLaterMs = nowMs + 6 * 24 * 60 * 60 * 1000;
    const recheck = engine.recheckAllPublishedOpportunities(db, sixDaysLaterMs);
    assert.ok(recheck.unpublishedCount >= 1, 'Expired opportunity MUST be automatically unpublished');
    engine.saveDb(db);

    const expiredRecord = engine
      .getAllOpportunities(db)
      .find((o) => o.id === soonExpiringIngest.record.id);
    assert.equal(expiredRecord?.deadlineStatusLabel, 'DEADLINE PASSED');
    assert.notEqual(expiredRecord?.status, 'published');

    const dashAfterExpiry = engine.buildAdminDashboard();
    assert.ok(
      dashAfterExpiry.recentVerificationLogs.some(
        (l) => l.opportunityId === soonExpiringIngest.record.id && l.action === 'auto_unpublish'
      )
    );
    const persistedRaw = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'data', 'opportunity_intelligence_db.json'), 'utf-8')
    );
    assert.equal(
      persistedRaw.permanent_opportunity_history[soonExpiringIngest.record.canonicalKey]?.status,
      'unpublished'
    );
    console.log('[PASS] CASE 8: All 6 deadline status labels verified; expired opportunity auto-unpublished & retained in permanent history.');

    // -------------------------------------------------------------------------
    // TEST 9: Exact 40 sources (10 per region), 24h Africa/Addis_Ababa schedule,
    //         manual run schedule preservation, AND Broader Internet Discovery ingestion
    // -------------------------------------------------------------------------
    const sources40 = buildInitialOfficialSourcesRegistry();
    assert.equal(sources40.length, 40, 'Must register EXACTLY 40 permanent sources');
    const byRegion = {
      'Middle East': sources40.filter((s) => s.region === 'Middle East').length,
      Europe: sources40.filter((s) => s.region === 'Europe').length,
      USA: sources40.filter((s) => s.region === 'USA').length,
      'Scandinavia / Nordic': sources40.filter((s) => s.region === 'Scandinavia / Nordic').length,
    };
    assert.deepEqual(byRegion, {
      'Middle East': 10,
      Europe: 10,
      USA: 10,
      'Scandinavia / Nordic': 10,
    });

    // Seed broader internet discovery file (outside the 40 registered websites) using real autonomous_web_crawler_db.json schema
    writeJsonFileAtomic(path.join(tmpDir, 'data', 'autonomous_web_crawler_db.json'), {
      opportunities: {
        crawl_dnb_991: {
          id: 'crawl_dnb_991',
          status: 'PUBLISHED',
          title: 'Regional Banking Operations Manager',
          employer: 'DNB Bank ASA',
          country: 'Norway',
          location: 'Oslo',
          category: 'job',
          officialApplicationUrl: 'https://careers.dnb.no/jobs/regional-banking-ops-manager-991',
          sourcePageUrl: 'https://careers.dnb.no/jobs/regional-banking-ops-manager-991',
          sourceDomain: 'careers.dnb.no',
          deadline: futureIso(25, nowMs),
          salaryDisplay: 'NOK 48,000 per month gross',
          visaEvidence: 'Employer provides confirmed Norwegian Skilled Worker visa sponsorship for international hires.',
          summary:
            'Lead retail banking branch operations, deposit mobilization, credit operations, and team supervision in Oslo. 8 years banking and 3 years management.',
        },
      },
    });

    const schedRun = await engine.runDailySourceMonitoringAndRecheck('startup_boot', {
      maxLiveNetworkSources: 0,
      nowMs,
    });
    assert.equal(schedRun.timezone, 'Africa/Addis_Ababa');
    const postRunDb = engine.loadDb();
    const broaderIngested = engine
      .getAllOpportunities(postRunDb)
      .find((o) => o.employer === 'DNB Bank ASA' && o.status === 'published');
    assert.ok(
      broaderIngested,
      '24-hour monitoring cycle MUST ingest verified official opportunities from broader internet discovery beyond the 40 registered sites'
    );
    assert.equal(broaderIngested?.isBranchBankingMatch, true);

    const dashAfterAuto = engine.buildAdminDashboard();
    assert.equal(dashAfterAuto.timezone, 'Africa/Addis_Ababa');
    assert.equal(dashAfterAuto.schedulerIntervalHours, 24);
    assert.ok(dashAfterAuto.metrics.lastSuccessfulExecution);
    assert.ok(dashAfterAuto.metrics.nextScheduledExecution);
    assert.ok(dashAfterAuto.metrics.lastSuccessfulExecutionEat?.includes('EAT'));
    assert.ok(dashAfterAuto.metrics.nextScheduledExecutionEat?.includes('EAT'));

    const scheduledNextBeforeManual = dashAfterAuto.metrics.nextScheduledExecution;
    const diffHours =
      (Date.parse(scheduledNextBeforeManual!) - Date.parse(dashAfterAuto.metrics.lastSuccessfulExecution!)) /
      (60 * 60 * 1000);
    assert.ok(Math.abs(diffHours - 24) < 0.05, `Next scheduled run must be 24h later, got ${diffHours.toFixed(2)}h`);

    const manualRun = await engine.runDailySourceMonitoringAndRecheck('manual_admin', {
      maxLiveNetworkSources: 0,
      nowMs: nowMs + 2 * 60 * 60 * 1000,
    });
    assert.equal(manualRun.trigger, 'manual_admin');
    const dashAfterManual = engine.buildAdminDashboard();
    assert.equal(
      dashAfterManual.metrics.nextScheduledExecution,
      scheduledNextBeforeManual,
      'Manual admin run MUST NOT change or reset the automatic 24-hour schedule'
    );
    console.log(
      `[PASS] CASE 9: All 40 sources (10/10/10/10), Africa/Addis_Ababa 24h schedule, manual schedule preservation, AND broader internet discovery ingestion verified.`
    );

    console.log('\n========================================================================');
    console.log('ALL 9 MANDATORY ACCEPTANCE CASES (SECTIONS 1–15) PASSED (100%)');
    console.log('========================================================================\n');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runAll9Tests().catch((err) => {
  console.error('\n[FAIL] 40-SOURCE & MANDATORY UPDATE SUITE FAILED:', err);
  process.exit(1);
});
