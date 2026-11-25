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
      'Not Disclosed',
      'Undisclosed Ethiopian salary must be clearly marked as "Not Disclosed"'
    );
    assert.equal(
      ethiopianUndisclosedBm.isBranchBankingMatch,
      true,
      'Ethiopian Branch Manager with undisclosed salary MUST remain eligible'
    );
    const etMatchForUser = evaluateOpportunityForUserProfile(ethiopianUndisclosedBm, BRANCH_MANAGER_PROFILE);
    assert.equal(etMatchForUser.eligible, true, 'Ethiopian domestic job must match Ethiopian Branch Manager user');
    console.log('[PASS] CASE 1: Ethiopian Branch Manager (<$3,000 & Not Disclosed) remained eligible and published.');

    // -------------------------------------------------------------------------
    // TEST 2: International Branch Manager > $3,000 WITH confirmed employer visa sponsorship -> ELIGIBLE
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

    assert.equal(intlBmValid.status, 'published', 'Valid international Branch Manager > $3k with sponsorship MUST publish');
    assert.equal(intlBmValid.isBranchBankingMatch, true, 'Valid international Branch Manager MUST match Branch Banking feature');
    assert.equal(intlBmValid.visa.verified, true);
    assert.equal(intlBmValid.salary.meetsAbove3000UsdMonthly, true);
    console.log('[PASS] CASE 2: International Branch Manager (>$3,000 + confirmed employer visa sponsorship) published & matched.');

    // -------------------------------------------------------------------------
    // TEST 3: International Branch Manager > $3,000 WITHOUT confirmed sponsorship -> REJECTED
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
          'Permission to apply for a visa independently upon offer. Invitation letter only provided for local onboarding.',
        description:
          'Manage retail branch operations, deposits, credit controls, and branch KPIs. 8+ years banking experience and 3 years branch management.',
      },
      { nowMs }
    );

    assert.equal(intlBmNoVisa.status, 'rejected', 'International job with permission-to-apply / invitation-letter-only MUST be rejected');
    assert.equal(intlBmNoVisa.visa.verified, false);
    assert.equal(intlBmNoVisa.isBranchBankingMatch, false);
    assert.ok(
      intlBmNoVisa.rejectionCodes.includes('visa_sponsorship_unconfirmed') ||
        intlBmNoVisa.rejectionCodes.includes('invitation_letter_only'),
      `Expected visa rejection code, got: ${intlBmNoVisa.rejectionCodes.join(', ')}`
    );
    console.log('[PASS] CASE 3: International Branch Manager (>$3,000 without confirmed visa sponsorship / permission to apply) rejected.');

    // -------------------------------------------------------------------------
    // TEST 4: International Branch Manager WITH sponsorship but salary < $3,000 -> REJECTED from special category
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

    assert.equal(
      intlBmLowSalary.isBranchBankingMatch,
      false,
      'International Branch Manager paying < $3,000 MUST be rejected from the special Branch Banking category'
    );
    assert.ok(
      intlBmLowSalary.branchBankingRejectionReasons.some((r) => r.includes('$3,000')),
      'Branch Banking rejection reason must explicitly cite the $3,000 threshold'
    );
    console.log('[PASS] CASE 4: International Branch Manager (sponsorship OK, salary $2,400 < $3,000) rejected from special Branch Banking category.');

    // -------------------------------------------------------------------------
    // TEST 5: International NON-branch job paying < $3,000 with sponsorship -> NOT rejected solely because of salary
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

    assert.equal(
      intlWashLowSalary.status,
      'published',
      'International non-branch job < $3,000 with confirmed sponsorship MUST publish'
    );
    assert.ok(
      !intlWashLowSalary.rejectionCodes.includes('salary_below_threshold'),
      'Non-branch international job must NOT be rejected for salary_below_threshold'
    );
    const washMatch = evaluateOpportunityForUserProfile(intlWashLowSalary, WASH_SPECIALIST_PROFILE);
    assert.equal(
      washMatch.eligible,
      true,
      `Non-branch international job < $3k MUST remain eligible for matching user, got rejections: ${washMatch.rejectionExplanations.join('; ')}`
    );
    console.log('[PASS] CASE 5: International non-branch WASH job ($2,350/mo + confirmed sponsorship) published & matched without $3,000 rejection.');

    // -------------------------------------------------------------------------
    // TEST 6: Same opportunity discovered across 3 websites -> ONLY ONE published record
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

    const firstSourceIngest = engine.ingestAndVerifyCandidate(
      db,
      {
        title: 'Retail Branch Manager - Abu Dhabi Central',
        employer: 'First Abu Dhabi Bank',
        country: 'United Arab Emirates',
        city: 'Abu Dhabi',
        category: 'job',
        officialApplicationUrl: 'https://careers.bankfab.com/jobs/fab-bm-2026-501?utm_source=bayt',
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
      { nowMs }
    );
    assert.equal(firstSourceIngest.outcome, 'created');
    assert.equal(firstSourceIngest.record.status, 'published');
    assert.equal(firstSourceIngest.record.primarySourceName, 'Bayt');

    const secondSourceIngest = engine.ingestAndVerifyCandidate(
      db,
      {
        title: 'Retail Branch Manager – Abu Dhabi Central',
        employer: 'First Abu Dhabi Bank',
        country: 'United Arab Emirates',
        city: 'Abu Dhabi',
        category: 'job',
        officialApplicationUrl: 'https://www.gulftalent.com/uae/jobs/fab-bm-501', // Different URL!
        sourceUrl: 'https://www.gulftalent.com/uae/jobs/fab-bm-501',
        sourceName: 'GulfTalent',
        referenceNumber: 'FAB-REQ-2026-501', // Same job reference number
        deadlineRaw: futureIso(24, nowMs),
        compensationRaw: 'USD 5,400 per month gross',
        explicitVisaNote:
          'Full UAE employment visa sponsorship, work permit and relocation package provided by employer.',
        description:
          'Manage full retail branch banking operations, deposit mobilization, credit growth, KYC/AML compliance, and branch staff supervision. 8 years banking and 3 years managerial experience.',
      },
      { nowMs: nowMs + 1000 }
    );
    assert.equal(secondSourceIngest.outcome, 'duplicate_merged');

    const thirdSourceIngest = engine.ingestAndVerifyCandidate(
      db,
      {
        title: 'Retail Branch Manager - Abu Dhabi Central',
        employer: 'First Abu Dhabi Bank',
        country: 'United Arab Emirates',
        city: 'Abu Dhabi',
        category: 'job',
        officialApplicationUrl: 'https://www.naukrigulf.com/fab-retail-branch-manager-501', // Third website URL!
        sourceUrl: 'https://www.naukrigulf.com/fab-retail-branch-manager-501',
        sourceName: 'Naukrigulf',
        referenceNumber: 'FAB-REQ-2026-501',
        deadlineRaw: futureIso(24, nowMs),
        compensationRaw: 'USD 5,400 per month gross',
        explicitVisaNote:
          'Full UAE employment visa sponsorship, work permit and relocation package provided by employer.',
        description:
          'Manage full retail branch banking operations, deposit mobilization, credit growth, KYC/AML compliance, and branch staff supervision. 8 years banking and 3 years managerial experience.',
      },
      { nowMs: nowMs + 2000 }
    );
    assert.equal(thirdSourceIngest.outcome, 'duplicate_merged');
    const publishedNow = engine.getAllOpportunities(db).filter((o) => o.status === 'published');
    assert.equal(publishedNow.length, 1, '3 websites with same opportunity MUST produce ONLY 1 published record');
    assert.equal(thirdSourceIngest.record.primarySourceName, 'Bayt', 'Original primary source MUST be preserved');
    assert.equal(thirdSourceIngest.record.sourceNames.length, 3, 'All 3 discovering sources must be tracked on the single record');
    console.log('[PASS] CASE 6: Same opportunity across 3 websites (Bayt, GulfTalent, Naukrigulf) published as 1 canonical record with original source preserved.');

    // -------------------------------------------------------------------------
    // TEST 7: Re-discovered after 24 hours -> updates existing record, NO duplicate, NO repeat notification;
    //         AND default notification preferences exclude scholarships/training/conferences unless opted in
    // -------------------------------------------------------------------------
    db.user_professional_profiles[BRANCH_MANAGER_PROFILE.userId] = BRANCH_MANAGER_PROFILE;
    const defaultPrefs = engine.getOrCreateNotificationPreferences(db, BRANCH_MANAGER_PROFILE.userId);
    assert.deepEqual(
      defaultPrefs.categories,
      ['job'],
      'Default user notification preferences MUST only include jobs unless user explicitly enables scholarships/training/conferences'
    );

    // Ingest a Banking scholarship -> should NOT notify user while categories = ['job']
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
    assert.equal(jobNotif1.sent, true, 'First eligible job match must notify user');

    const schNotif1 = engine.dispatchDeduplicatedNotificationForUser(db, {
      userId: BRANCH_MANAGER_PROFILE.userId,
      opportunity: schIngest.record,
      match: bmSchMatch,
      nowMs,
      mirrorToLegacyUserNotifications: false,
    });
    assert.equal(schNotif1.sent, false, 'Scholarship MUST NOT notify user by default');
    assert.equal(schNotif1.reason, 'suppressed_preferences', 'Scholarship must be suppressed by default job-only preferences');

    // Re-discover the EXACT same FAB Branch Manager job 24.5 hours later
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
    assert.equal(rediscovered24h.outcome, 'duplicate_merged', 'Re-discovery after 24h MUST merge/update without duplicating');
    assert.equal(
      db.opportunitiesUpdated,
      updatedBefore24h + 1,
      '24-hour re-discovery must increment opportunitiesUpdated counter'
    );
    assert.equal(
      engine.getAllOpportunities(db).filter((o) => o.status === 'published' && o.category === 'job').length,
      1,
      'Job count MUST remain 1 after 24h re-discovery'
    );

    const jobNotif2 = engine.dispatchDeduplicatedNotificationForUser(db, {
      userId: BRANCH_MANAGER_PROFILE.userId,
      opportunity: rediscovered24h.record,
      match: bmJobMatch,
      nowMs: after24hMs,
      mirrorToLegacyUserNotifications: false,
    });
    assert.equal(jobNotif2.sent, false, 'User MUST NOT be notified again about the same opportunity after 24h re-discovery');
    assert.equal(jobNotif2.reason, 'suppressed_duplicate');
    console.log('[PASS] CASE 7: 24h re-discovery updated existing record with 0 duplicates, 0 repeat notifications, and scholarships excluded unless opted in.');

    // -------------------------------------------------------------------------
    // TEST 8: Expired opportunity -> automatically unpublished/removed while preserving history
    // -------------------------------------------------------------------------
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
        deadlineRaw: futureIso(5, nowMs), // 5 full days remaining now -> valid
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

    const stillPublished = engine
      .getAllOpportunities(db)
      .find((o) => o.id === soonExpiringIngest.record.id && o.status === 'published');
    assert.equal(stillPublished, undefined, 'Expired opportunity must NOT appear in active published recommendations');

    const dashAfterExpiry = engine.buildAdminDashboard();
    assert.ok(
      dashAfterExpiry.recentVerificationLogs.some(
        (l) => l.opportunityId === soonExpiringIngest.record.id && l.action === 'auto_unpublish'
      ),
      'Auto-unpublish audit log must be preserved'
    );
    // Verify permanent_opportunity_history preserved on disk
    const persistedRaw = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'data', 'opportunity_intelligence_db.json'), 'utf-8')
    );
    assert.equal(
      persistedRaw.permanent_opportunity_history[soonExpiringIngest.record.canonicalKey]?.status,
      'unpublished',
      'Expired/unpublished opportunity must remain recorded in permanent_opportunity_history'
    );
    console.log('[PASS] CASE 8: Expired opportunity auto-unpublished from public recommendations and retained in permanent history.');

    // -------------------------------------------------------------------------
    // TEST 9: Exact 40 sources (10 per region), 24h Africa/Addis_Ababa schedule,
    //         and manual run preserving the automatic 24-hour schedule
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

    // Run initial automatic scheduled run (maxLiveNetworkSources: 0 for deterministic unit test speed)
    const schedRun = await engine.runDailySourceMonitoringAndRecheck('startup_boot', {
      maxLiveNetworkSources: 0,
      nowMs,
    });
    assert.equal(schedRun.timezone, 'Africa/Addis_Ababa');
    const dashAfterAuto = engine.buildAdminDashboard();
    assert.equal(dashAfterAuto.timezone, 'Africa/Addis_Ababa');
    assert.equal(dashAfterAuto.schedulerIntervalHours, 24);
    assert.ok(dashAfterAuto.metrics.lastSuccessfulExecution, 'Last successful execution must be recorded');
    assert.ok(dashAfterAuto.metrics.nextScheduledExecution, 'Next 24h scheduled execution must be set');
    assert.ok(dashAfterAuto.metrics.lastSuccessfulExecutionEat?.includes('EAT'), 'EAT timestamp must be formatted');
    assert.ok(dashAfterAuto.metrics.nextScheduledExecutionEat?.includes('EAT'), 'Next scheduled EAT timestamp must be formatted');

    const scheduledNextBeforeManual = dashAfterAuto.metrics.nextScheduledExecution;
    const diffHours =
      (Date.parse(scheduledNextBeforeManual!) - Date.parse(dashAfterAuto.metrics.lastSuccessfulExecution!)) /
      (60 * 60 * 1000);
    assert.ok(Math.abs(diffHours - 24) < 0.05, `Next scheduled run must be 24h later, got ${diffHours.toFixed(2)}h`);

    // Trigger manual admin run 2 hours later -> nextScheduledExecution MUST NOT shift!
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
      `[PASS] CASE 9: All 40 sources verified (10/10/10/10), Africa/Addis_Ababa 24h schedule active (${dashAfterManual.metrics.nextScheduledExecutionEat}), and manual run preserved schedule.`
    );

    console.log('\n========================================================================');
    console.log('ALL 9 MANDATORY SECTION 8 TEST CASES PASSED (100%)');
    console.log('========================================================================\n');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runAll9Tests().catch((err) => {
  console.error('\n[FAIL] 40-SOURCE & STRICT FILTER SUITE FAILED:', err);
  process.exit(1);
});
