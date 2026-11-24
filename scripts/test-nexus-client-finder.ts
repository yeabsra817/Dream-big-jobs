import assert from 'node:assert/strict';
import http from 'node:http';
import { getApiApp } from '../serverApp';
import {
  buildBulkBccGmailBatches,
  buildSelectedLeadsCsv,
  buildSingleClientGmailComposeUrl,
  classifyNexusLeadCategory,
  computeNexusLeadFingerprint,
  detectPriorityCountryAndCity,
  evaluate72HourFreshness,
  evaluateWebItRelevance,
  extractAndClassifyPublicEmails,
  generateNexusProposalMessage,
  isEmailSuppressed,
} from '../src/utils/nexusClientFinderEngine';
import { NexusClientLead, NexusSuppressionEntry } from '../src/types/nexusClientFinder';

const OWNER_EMAIL = 'nexusitsoultion@gmail.com';

async function httpJson(
  baseUrl: string,
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: any } = {}
): Promise<{ status: number; json: any }> {
  const resp = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await resp.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: resp.status, json };
}

async function runTests() {
  let passed = 0;
  const test = async (name: string, fn: () => Promise<void> | void) => {
    await fn();
    passed++;
    console.log(`PASS [${passed}]: ${name}`);
  };

  // =========================================================================
  // PURE ENGINE ACCEPTANCE TESTS
  // =========================================================================

  await test('Strict 72-hour freshness filter accepts <=72h and rejects >72h or missing dates', () => {
    const now = Date.now();
    const fresh = evaluate72HourFreshness(new Date(now - 12 * 3600 * 1000).toISOString(), now);
    assert.equal(fresh.valid, true);
    assert.equal(fresh.within72Hours, true);

    const exactBoundary = evaluate72HourFreshness(new Date(now - 71.5 * 3600 * 1000).toISOString(), now);
    assert.equal(exactBoundary.within72Hours, true);

    const stale = evaluate72HourFreshness(new Date(now - 74 * 3600 * 1000).toISOString(), now);
    assert.equal(stale.within72Hours, false);
    assert.ok(stale.reason?.includes('72-hour'));

    const missing = evaluate72HourFreshness(null, now);
    assert.equal(missing.valid, false);
    assert.equal(missing.within72Hours, false);
  });

  await test('Relevance & 10-category classifier accepts genuine web/IT requests and rejects For-Hire/spam', () => {
    const ecom = evaluateWebItRelevance(
      'Need Shopify e-commerce website developer in Dubai',
      'We are launching an online store in Dubai UAE and need a Shopify developer.'
    );
    assert.equal(ecom.relevant, true);
    assert.equal(
      classifyNexusLeadCategory('Need Shopify e-commerce website developer', 'online store', 'company'),
      'ecommerce_website_request'
    );

    const wp = classifyNexusLeadCategory('WordPress website redesign with Elementor', 'Redesign our WordPress site', 'company');
    assert.equal(wp, 'wordpress_website_request');

    const geo = detectPriorityCountryAndCity('Dubai, UAE', 'Need website', 'Business in Dubai');
    assert.equal(geo.country, 'United Arab Emirates');
    assert.equal(geo.city, 'Dubai');
    assert.equal(geo.isPriorityMarket, true);

    const forHire = evaluateWebItRelevance('[For Hire] Full Stack React Developer looking for work', 'Hire me for your website');
    assert.equal(forHire.relevant, false);

    const spam = evaluateWebItRelevance('Crypto airdrop forex signals fast cash', 'Get rich quick');
    assert.equal(spam.relevant, false);
  });

  await test('Email verification distinguishes Verified Business, Unverified Business, Personal, and No Public Email (never invents)', () => {
    const mxSet = new Set<string>(['almadar-dubai.ae']);

    const verifiedBiz = extractAndClassifyPublicEmails(
      'Contact projects@almadar-dubai.ae for our corporate website tender',
      'https://almadar-dubai.ae',
      mxSet
    );
    assert.equal(verifiedBiz.email, 'projects@almadar-dubai.ae');
    assert.equal(verifiedBiz.classification, 'verified_business_email');

    const unverifiedBiz = extractAndClassifyPublicEmails(
      'Reach us at hello@unknown-company-xyz.co.uk',
      null,
      new Set()
    );
    assert.equal(unverifiedBiz.email, 'hello@unknown-company-xyz.co.uk');
    assert.equal(unverifiedBiz.classification, 'unverified_business_email');

    const personal = extractAndClassifyPublicEmails('Email me at founder.personal@gmail.com', null, mxSet);
    assert.equal(personal.email, 'founder.personal@gmail.com');
    assert.equal(personal.classification, 'personal_email');

    const none = extractAndClassifyPublicEmails('Apply directly on our portal — no email listed', null, mxSet);
    assert.equal(none.email, null);
    assert.equal(none.classification, 'no_public_email');
  });

  await test('Cross-source duplicate detection produces canonical fingerprint', () => {
    const fp1 = computeNexusLeadFingerprint(
      'Build Corporate Website for Logistics Company',
      'Al Noor Logistics',
      'https://source-a.example/job/123',
      'info@alnoor.ae'
    );
    const fp2 = computeNexusLeadFingerprint(
      'Build Corporate Website for Logistics Company!',
      'Al Noor Logistics',
      'https://source-b.example/post/999',
      'INFO@ALNOOR.AE'
    );
    assert.equal(fp1, fp2);
  });

  await test('Single-Client Gmail Compose URL populates to/su/body accurately without auto-send', () => {
    const url = buildSingleClientGmailComposeUrl({
      recipientEmail: 'cto@nordicshop.se',
      subject: 'E-Commerce Development Support — Nexus IT Solutions',
      body: 'Hello Nordic Shop,\n\nWe saw your public Shopify listing.',
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, 'https://mail.google.com/mail/');
    assert.equal(parsed.searchParams.get('view'), 'cm');
    assert.equal(parsed.searchParams.get('fs'), '1');
    assert.equal(parsed.searchParams.get('to'), 'cto@nordicshop.se');
    assert.ok(parsed.searchParams.get('su')?.includes('Nexus IT Solutions'));
    assert.ok(parsed.searchParams.get('body')?.includes('Shopify'));
  });

  await test('Bulk Gmail Compose uses BCC ONLY, splits >25 into batches without dropping leads, honors suppression & CSV export', () => {
    const suppression: NexusSuppressionEntry[] = [
      {
        id: 'sup-1',
        email: 'blocked@optout.de',
        domain: 'optout.de',
        advertiserName: 'OptOut GmbH',
        reason: 'Requested do not contact',
        leadId: null,
        addedAt: new Date().toISOString(),
      },
    ];

    assert.equal(isEmailSuppressed('sales@optout.de', suppression), true);

    const mockLeads: NexusClientLead[] = Array.from({ length: 32 }, (_, idx) => {
      const email =
        idx === 0
          ? null
          : idx === 1
          ? 'blocked@optout.de'
          : idx === 2
          ? 'already@contacted.co.uk'
          : `client${idx}@company${idx}.ae`;
      return {
        id: `lead-${idx}`,
        fingerprint: `fp-${idx}`,
        title: `Need business website #${idx}`,
        advertiserName: `Company ${idx}`,
        advertiserType: 'company',
        country: 'United Arab Emirates',
        regionGroup: 'GCC / Middle East',
        city: 'Dubai',
        category: 'business_website_creation',
        categoryLabel: 'Business website creation',
        originalAdText: 'Looking for a responsive business website.',
        projectRequirements: ['Website Development', 'Responsive Mobile UI'],
        estimatedBudget: null,
        publishedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
        lastRecheckedAt: new Date().toISOString(),
        ageHoursAtDiscovery: 2,
        within72Hours: true,
        isActive: true,
        sourceId: 'freelancer_public_api',
        sourceName: 'Test Source',
        originalSourceUrl: `https://example.org/p/${idx}`,
        sourceHttpStatus: 200,
        robotsAllowed: true,
        publicEmail: email,
        emailClassification: email ? 'verified_business_email' : 'no_public_email',
        emailDomain: email ? email.split('@')[1] : null,
        emailMxVerified: Boolean(email),
        emailEvidenceSource: 'Original listing',
        officialWebsiteUrl: null,
        publicContactPageUrl: null,
        publicPhone: null,
        verificationStatus: 'verified',
        verificationNotes: 'Active',
        rejectionReason: null,
        contactStatus: idx === 2 ? 'contacted' : 'new',
        contactNotes: '',
        contactCount: idx === 2 ? 1 : 0,
        lastContactedAt: idx === 2 ? new Date().toISOString() : null,
        outreachHistory: [],
        suppressed: false,
      };
    });

    const bulk = buildBulkBccGmailBatches({
      leads: mockLeads,
      subject: 'Website Proposal — Nexus IT Solutions',
      body: 'Hello, we can help build your website.',
      suppressionList: suppression,
      maxPerBatch: 25,
    });

    // 32 total: 1 no-email + 1 suppressed + 1 already-contacted = 29 eligible -> 2 batches (25 + 4)
    assert.equal(bulk.includedCount, 29);
    assert.equal(bulk.excludedNoEmail.length, 1);
    assert.equal(bulk.excludedSuppressed.length, 1);
    assert.equal(bulk.excludedAlreadyContacted.length, 1);
    assert.equal(bulk.batches.length, 2);
    assert.equal(bulk.batches[0].bccList.length, 25);
    assert.equal(bulk.batches[1].bccList.length, 4);

    for (const batch of bulk.batches) {
      const parsed = new URL(batch.gmailComposeUrl);
      assert.equal(parsed.searchParams.get('to'), null, 'Bulk Gmail MUST NOT use To:');
      assert.equal(parsed.searchParams.get('cc'), null, 'Bulk Gmail MUST NOT use CC:');
      assert.ok((parsed.searchParams.get('bcc') || '').length > 0, 'Bulk Gmail MUST use BCC:');
      assert.equal(parsed.searchParams.get('bcc')?.includes('blocked@optout.de'), false);
    }

    const csv = buildSelectedLeadsCsv(mockLeads.slice(0, 5), 'business_website');
    assert.ok(csv.startsWith('Email,Email_Classification,Advertiser_Name'));
    assert.equal(csv.split('\r\n').length, 6);
  });

  await test('AI Message Assistant grounds outreach in actual ad requirements without fabricating prior contact', () => {
    const draft = generateNexusProposalMessage(
      {
        title: 'WooCommerce Store Redesign for Munich Retailer',
        advertiserName: 'Alpen Outdoor GmbH',
        country: 'Germany',
        category: 'ecommerce_website_request',
        originalAdText: 'We need a faster WooCommerce store with Stripe checkout.',
        projectRequirements: ['WooCommerce', 'Stripe Checkout', 'Website Redesign'],
        estimatedBudget: 'EUR 4000',
        emailClassification: 'verified_business_email',
      },
      'ecommerce_development'
    );
    assert.ok(draft.subject.includes('Nexus IT Solutions'));
    assert.ok(draft.body.includes('Alpen Outdoor GmbH'));
    assert.ok(draft.body.includes('WooCommerce'));
    assert.equal(/as we discussed|following our call|great speaking/i.test(draft.body), false);
  });

  // =========================================================================
  // LIVE SERVER ENDPOINT & ISOLATION ACCEPTANCE TESTS
  // =========================================================================

  const app = await getApiApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await test('Existing Hopeland public endpoints remain untouched and return HTTP 200', async () => {
      const vac = await httpJson(baseUrl, '/api/vacancies');
      assert.equal(vac.status, 200);
      const glob = await httpJson(baseUrl, '/api/global-opportunities');
      assert.equal(glob.status, 200);
    });

    await test('Public/non-admin access to Nexus Client Finder API is strictly blocked with HTTP 403', async () => {
      const unauthDash = await httpJson(baseUrl, '/api/admin/nexus-client-finder/dashboard');
      assert.equal(unauthDash.status, 403);

      const nonAdminRun = await httpJson(baseUrl, '/api/admin/nexus-client-finder/run-discovery', {
        method: 'POST',
        headers: { 'x-user-email': 'randomvisitor@example.com' },
      });
      assert.equal(nonAdminRun.status, 403);
    });

    await test('Authorized Admin runs real 100% free live discovery & gets real <=72h international leads', async () => {
      const adminHeaders = { 'x-user-email': OWNER_EMAIL, 'x-admin-email': OWNER_EMAIL };
      const runRes = await httpJson(baseUrl, '/api/admin/nexus-client-finder/run-discovery', {
        method: 'POST',
        headers: adminHeaders,
      });
      assert.equal(runRes.status, 200);
      assert.equal(runRes.json.success, true);
      assert.ok(runRes.json.runLog.sourcesQueried === 8);
      assert.ok(runRes.json.runLog.rawCandidatesScanned > 0, 'Live free sources should scan real public candidates');

      const dashRes = await httpJson(baseUrl, '/api/admin/nexus-client-finder/dashboard', {
        headers: adminHeaders,
      });
      assert.equal(dashRes.status, 200);
      assert.equal(dashRes.json.success, true);
      assert.ok(Array.isArray(dashRes.json.leads));
      assert.ok(dashRes.json.leads.length > 0, 'Live free discovery should yield real active <=72h leads');

      for (const lead of dashRes.json.leads) {
        assert.equal(lead.within72Hours, true, `Lead ${lead.id} must be within 72h`);
        assert.ok(lead.originalSourceUrl.startsWith('http'), 'Lead must carry real originalSourceUrl');
      }

      console.log(
        `  Live Free Discovery Summary -> Scanned: ${runRes.json.runLog.rawCandidatesScanned}, Accepted (<=72h): ${runRes.json.runLog.acceptedWithin72hCount}, Active Stored: ${dashRes.json.stats.totalActiveLeads}, Verified Biz Emails: ${dashRes.json.stats.verifiedBusinessEmailsCount}, Rejected (>72h): ${runRes.json.runLog.rejectedExpiredOrOver72hCount}, Rejected (Irrelevant): ${runRes.json.runLog.rejectedIrrelevantOrFakeCount}`
      );
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log(`\nALL ${passed}/${passed} NEXUS CLIENT FINDER ACCEPTANCE TESTS PASSED.`);
  process.exit(0);
}

runTests().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exit(1);
});
