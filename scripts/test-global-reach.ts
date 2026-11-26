import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import express from 'express';
import http from 'node:http';
import {
  OWNER_WORKSPACE_ID,
  buildCanonicalDedupKey,
  createYeabsraOwnerProfile,
  extractPublicContactsFromHtml,
  registerGlobalReachRoutes,
  safePublicFetch,
} from '../serverGlobalReach';
import {
  buildBulkBccGmailBatches,
  buildEditableOutreachTemplate,
  buildSingleGmailComposeUrl,
  buildWhatsAppChatUrl,
  inspectInstagramUrl,
  inspectLinkedInUrl,
  normalizePublishedWhatsAppDigits,
  scoreGlobalReachContact,
} from '../src/utils/globalReachEngine';

async function runTests() {
  const results: Array<{ name: string; status: 'PASS' | 'FAIL'; detail?: string }> = [];

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      results.push({ name, status: 'PASS' });
      console.log(`✅ PASS: ${name}`);
    } catch (err: any) {
      results.push({ name, status: 'FAIL', detail: err?.message || String(err) });
      console.error(`❌ FAIL: ${name} -> ${err?.message || err}`);
    }
  }

  // 1. Direct Gmail single & bulk BCC privacy tests
  await test('Gmail single compose URL populates exact recipient, subject, and body', () => {
    const url = buildSingleGmailComposeUrl({
      to: 'careers@triodos.com',
      subject: 'International Banking Inquiry — Yeabsra Tefera',
      body: 'Dear Triodos Bank Team, I am an Ethiopian banking professional...',
    });
    assert.ok(url && url.startsWith('https://mail.google.com/mail/?'));
    const parsed = new URL(url!);
    assert.equal(parsed.searchParams.get('to'), 'careers@triodos.com');
    assert.equal(parsed.searchParams.get('su'), 'International Banking Inquiry — Yeabsra Tefera');
    assert.ok((parsed.searchParams.get('body') || '').includes('Ethiopian banking professional'));
  });

  await test('Bulk Gmail outreach strictly uses BCC only (never exposes recipients in To/CC)', () => {
    const batches = buildBulkBccGmailBatches({
      recipients: [
        'alice@bankone.org',
        'bob@banktwo.org',
        'ALICE@bankone.org', // duplicate should be deduped
        'not-an-email',
        'carol@fintech.io',
      ],
      subject: 'Introduction — Yeabsra Tefera',
      body: 'Respectful introduction',
      maxPerBatch: 2,
    });
    assert.equal(batches.length, 2);
    for (const batch of batches) {
      const parsed = new URL(batch.gmailComposeUrl);
      assert.equal(parsed.searchParams.get('to'), null, 'Bulk Gmail must NOT expose recipients in To');
      assert.equal(parsed.searchParams.get('cc'), null, 'Bulk Gmail must NOT expose recipients in CC');
      const bcc = parsed.searchParams.get('bcc') || '';
      assert.ok(bcc.length > 0, 'BCC must be populated');
    }
  });

  // 2. WhatsApp Business strict link generation (never fabricates / rejects local or invalid numbers)
  await test('WhatsApp Business click-to-chat accepts published international numbers and rejects invalid/fabricated inputs', () => {
    const valid = buildWhatsAppChatUrl('+44 20 7946 0958', 'Hello, introducing myself');
    assert.ok(valid && valid.startsWith('https://wa.me/442079460958?text='));

    const fromWaLink = buildWhatsAppChatUrl('https://wa.me/971501234567');
    assert.equal(fromWaLink, 'https://wa.me/971501234567');

    // Must reject non-international or fake numbers
    assert.equal(normalizePublishedWhatsAppDigits('0911223344'), null);
    assert.equal(buildWhatsAppChatUrl('random-name-ethiopia'), null);
    assert.equal(buildWhatsAppChatUrl('+0000000000'), null);
  });

  // 3. LinkedIn & Instagram official link validation + restriction notices
  await test('LinkedIn & Instagram profile URLs validated with honest platform messaging notices', () => {
    const liPerson = inspectLinkedInUrl('https://www.linkedin.com/in/yeabsra-tefera');
    assert.equal(liPerson.validUrl, 'https://www.linkedin.com/in/yeabsra-tefera');
    assert.equal(liPerson.profileType, 'person');
    assert.ok(liPerson.messagingNote.toLowerCase().includes('connection'));

    const liFake = inspectLinkedInUrl('javascript:alert(1)');
    assert.equal(liFake.validUrl, null);

    const ig = inspectInstagramUrl('https://www.instagram.com/triodosbank/');
    assert.equal(ig.validUrl, 'https://www.instagram.com/triodosbank/');
    assert.ok(ig.messagingNote.toLowerCase().includes('instagram'));
  });

  // 4. HTML extraction extracts ONLY genuine public channels and never fabricates
  await test('Official HTML public contact extractor extracts real published channels and ignores noreply/disposable', () => {
    const sampleHtml = `
      <html><body>
        <a href="mailto:noreply@bank.com">No Reply</a>
        <a href="mailto:careers@triodos.com">Careers</a>
        <a href="https://www.linkedin.com/company/triodos-bank">LinkedIn</a>
        <a href="https://www.instagram.com/triodosbank">Instagram</a>
        <a href="https://wa.me/31306936500">WhatsApp Business</a>
        <a href="/contact-us">Contact Us</a>
        <p>We welcome international applicants and global careers.</p>
      </body></html>
    `;
    const extracted = extractPublicContactsFromHtml(sampleHtml, 'https://www.triodos.com/');
    assert.equal(extracted.publicEmail, 'careers@triodos.com');
    assert.equal(extracted.emailMatchesOfficialDomain, true);
    assert.equal(extracted.linkedInUrl, 'https://www.linkedin.com/company/triodos-bank');
    assert.equal(extracted.instagramUrl, 'https://www.instagram.com/triodosbank');
    assert.equal(extracted.whatsAppBusinessNumber, '+31306936500');
    assert.equal(extracted.contactPageUrl, 'https://www.triodos.com/contact-us');
    assert.equal(extracted.sponsorshipTierDetected, 'international_recruiter');
  });

  // 5. SSRF protection blocks localhost, private IPs, and cloud metadata endpoints
  await test('SSRF security guard blocks localhost, private IPs, and cloud metadata URLs', async () => {
    const blockedUrls = [
      'http://127.0.0.1:3000/api/global-reach/dashboard',
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:8080/admin',
      'http://10.0.0.1/internal',
      'javascript:alert(1)',
    ];
    for (const u of blockedUrls) {
      const res = await safePublicFetch(u);
      assert.equal(res.ok, false, `Expected SSRF guard to block ${u}`);
    }
  });

  // 6. Personalized outreach across all 8 approaches respects accuracy & dignity rules
  await test('Personalized outreach covers all 8 approaches accurately with Yeabsra Tefera real profile', () => {
    const profile = createYeabsraOwnerProfile();
    assert.equal(profile.fullName, 'Yeabsra Tefera');
    assert.equal(profile.totalExperienceYears, 9);
    assert.equal(profile.managementExperienceYears, 3);
    assert.equal(profile.educationInstitution, 'Mekelle University');
    assert.equal(profile.graduationYear, '2016');

    const dummyContact: any = {
      id: 'c1',
      entityType: 'organization',
      fullName: 'Triodos Bank',
      companyName: 'Triodos Bank',
      positionOrRole: 'Official Organization Contact',
      industry: 'Sustainable Banking & Financial Services',
      country: 'Netherlands',
      region: 'Europe',
      sponsorshipTier: 'international_recruiter',
      sponsorshipEvidenceNote: 'International careers',
    };

    const approaches = [
      'employment_request',
      'banking_finance_career',
      'website_development',
      'business_partnership',
      'professional_mentorship',
      'employment_referral',
      'international_relocation_guidance',
      'professional_networking',
    ] as const;

    const bodies = new Set<string>();
    for (const app of approaches) {
      const draft = buildEditableOutreachTemplate(dummyContact, profile, app);
      assert.ok(draft.subject.length > 10);
      assert.ok(draft.message.includes('Yeabsra Tefera'));
      assert.ok(draft.message.includes('9 years'));
      assert.ok(!/give me money|send cash|rich philanthropist/i.test(draft.message));
      bodies.add(draft.message);
    }
    assert.equal(bodies.size, 8, 'Each of the 8 outreach approaches should produce a distinct message');

    const scored = scoreGlobalReachContact(
      {
        ...dummyContact,
        verificationStatus: 'verified_public_professional_contact',
        publicEmail: 'careers@triodos.com',
      },
      profile
    );
    assert.ok(scored.score >= 70);
    assert.ok(scored.reasons.length >= 2);
  });

  // 7. Full Express API integration test with isolated temp DB (live discovery, CRUD, dedup, scheduler, crash recovery, strict privacy isolation)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hopeland-global-reach-test-'));
  const prevDisable = process.env.DISABLE_BACKGROUND_SCHEDULERS;
  process.env.DISABLE_BACKGROUND_SCHEDULERS = 'true';
  process.env.CRON_SECRET = 'test-global-reach-cron-secret';

  const makeTestApp = () => {
    const app = express();
    app.use(express.json());
    const controller = registerGlobalReachRoutes({
      app,
      runtimeBaseDir: tmpDir,
      isVercel: false,
      ensureRuntimeDataDir: () => {
        fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true });
      },
      loadJsonFileSafe: (fp, fallback) => {
        try {
          return JSON.parse(fs.readFileSync(fp, 'utf8'));
        } catch {
          return fallback;
        }
      },
      writeJsonFileAtomic: (fp, data) => {
        const tmp = `${fp}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tmp, fp);
      },
      isPersistentOwnerRequest: (req) =>
        String(req.headers['x-admin-email'] || '').toLowerCase() === 'yeabsra45@gmail.com',
      getRequesterUid: (req) => String(req.headers['x-user-uid'] || ''),
      getRequesterEmail: (req) => String(req.headers['x-user-email'] || ''),
      appendAuditLog: () => {},
      getAiClient: () => null,
    });
    return { app, controller };
  };

  let { app, controller } = makeTestApp();
  let server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const ownerHeaders = {
    'Content-Type': 'application/json',
    'x-admin-email': 'yeabsra45@gmail.com',
    'x-user-email': 'yeabsra45@gmail.com',
  };
  const regularUserHeaders = {
    'Content-Type': 'application/json',
    'x-user-uid': 'registered_user_abc123',
    'x-user-email': 'other.user@example.org',
  };

  try {
    await test('Unauthenticated requests are blocked with HTTP 401', async () => {
      const r = await fetch(`${baseUrl}/api/global-reach/dashboard`);
      assert.equal(r.status, 401);
      const cronNoSecret = await fetch(`${baseUrl}/api/cron/global-reach`);
      assert.equal(cronNoSecret.status, 401);
    });

    await test('Strict user privacy isolation: regular registered user NEVER sees Yeabsra Tefera profile or contacts', async () => {
      const ownerRes = await fetch(`${baseUrl}/api/global-reach/dashboard`, { headers: ownerHeaders }).then((r) =>
        r.json()
      );
      assert.equal(ownerRes.success, true);
      assert.equal(ownerRes.isOwnerWorkspace, true);
      assert.equal(ownerRes.profile.fullName, 'Yeabsra Tefera');

      // Add a private contact to owner workspace
      await fetch(`${baseUrl}/api/global-reach/contacts`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({
          fullName: 'Owner Secret Contact',
          companyName: 'Owner Private Bank',
          country: 'Switzerland',
          publicEmail: 'owner-only@privatebank.ch',
        }),
      });

      const userRes = await fetch(`${baseUrl}/api/global-reach/dashboard`, {
        headers: regularUserHeaders,
      }).then((r) => r.json());

      assert.equal(userRes.success, true);
      assert.equal(userRes.isOwnerWorkspace, false);
      assert.notEqual(userRes.profile.fullName, 'Yeabsra Tefera');
      assert.notEqual(userRes.profile.email, 'yeabsra45@gmail.com');
      assert.equal(userRes.contacts.length, 0, 'Other registered user must never see owner contacts');
    });

    await test('Live public contact discovery, verification, persistence, and duplicate prevention work end-to-end', async () => {
      const run1 = await fetch(`${baseUrl}/api/global-reach/discover-now`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({ region: 'Europe' }),
      }).then((r) => r.json());

      assert.equal(run1.success, true);
      assert.ok(run1.cycleLog.sourcesChecked >= 4);
      assert.ok(
        run1.cycleLog.newContactsAdded > 0,
        `Expected real live contacts discovered from public sources, got ${run1.cycleLog.newContactsAdded}`
      );

      // Re-run on same Europe region to confirm duplicate prevention works
      const run2 = await fetch(`${baseUrl}/api/global-reach/discover-now`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({ region: 'Europe' }),
      }).then((r) => r.json());

      assert.equal(run2.success, true);
      assert.ok(
        run2.cycleLog.duplicatesPrevented > 0,
        'Second identical region run should detect and prevent duplicates'
      );

      // Verify canonical dedup key behavior directly too
      assert.equal(
        buildCanonicalDedupKey({ publicEmail: 'TEST@Bank.COM' }),
        buildCanonicalDedupKey({ publicEmail: 'test@bank.com' })
      );
    });

    await test('Contact CRUD, notes, follow-up, outreach logging, suppression, and scheduler pause/resume work', async () => {
      const createRes = await fetch(`${baseUrl}/api/global-reach/contacts`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({
          entityType: 'individual',
          fullName: 'Dr. Elena Rostova',
          companyName: 'Nordic Finance Advisory',
          positionOrRole: 'Managing Director',
          industry: 'Banking & Finance',
          country: 'Sweden',
          officialWebsite: 'https://www.triodos.com/',
          publicEmail: 'elena@nordicfinance.se',
          category: 'mentors',
        }),
      });
      assert.equal(createRes.status, 201);
      const created = await createRes.json();
      const cid = created.contact.id;

      // Duplicate add should return 409
      const dupRes = await fetch(`${baseUrl}/api/global-reach/contacts`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({
          fullName: 'Dr. Elena Rostova',
          publicEmail: 'elena@nordicfinance.se',
        }),
      });
      assert.equal(dupRes.status, 409);

      // Edit notes, follow-up date, and star
      const patchRes = await fetch(`${baseUrl}/api/global-reach/contacts/${cid}`, {
        method: 'PATCH',
        headers: ownerHeaders,
        body: JSON.stringify({
          personalNotes: 'Follow up after quarterly banking report',
          nextFollowUpDate: '2026-12-15',
          isImportant: true,
        }),
      }).then((r) => r.json());
      assert.equal(patchRes.contact.personalNotes, 'Follow up after quarterly banking report');
      assert.equal(patchRes.contact.nextFollowUpDate, '2026-12-15');
      assert.equal(patchRes.contact.isImportant, true);

      // Log approved outreach
      const logRes = await fetch(`${baseUrl}/api/global-reach/outreach/log`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({
          contactIds: [cid],
          channel: 'gmail',
          approach: 'professional_mentorship',
          subject: 'Mentorship Inquiry',
          messagePreview: 'Dear Dr. Rostova...',
          mode: 'single',
        }),
      }).then((r) => r.json());
      assert.equal(logRes.recordedCount, 1);

      // Pause & Resume scheduler
      const paused = await fetch(`${baseUrl}/api/global-reach/scheduler/control`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({ action: 'pause' }),
      }).then((r) => r.json());
      assert.equal(paused.scheduler.status, 'paused');

      const resumed = await fetch(`${baseUrl}/api/global-reach/scheduler/control`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({ action: 'resume' }),
      }).then((r) => r.json());
      assert.equal(resumed.scheduler.status, 'active_waiting');
      assert.ok(resumed.scheduler.nextScheduledRunAt);

      // Delete contact
      const delRes = await fetch(`${baseUrl}/api/global-reach/contacts/${cid}`, {
        method: 'DELETE',
        headers: ownerHeaders,
      }).then((r) => r.json());
      assert.equal(delRes.success, true);
    });

    await test('Persistence & graceful crash-recovery after simulated server restart', async () => {
      // Simulate an abrupt crash leaving isRunningNow = true on disk
      const dbFile = path.join(tmpDir, 'data', 'global_reach_db.json');
      const rawDb = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
      const savedCountBeforeCrash = rawDb.workspaces[OWNER_WORKSPACE_ID].contacts.length;
      rawDb.workspaces[OWNER_WORKSPACE_ID].scheduler.isRunningNow = true;
      rawDb.workspaces[OWNER_WORKSPACE_ID].scheduler.lockAcquiredAt = new Date().toISOString();
      fs.writeFileSync(dbFile, JSON.stringify(rawDb, null, 2), 'utf8');

      // Stop old server & boot a fresh Express instance pointing at same data dir
      controller.stopScheduler();
      await new Promise<void>((resolve) => server.close(() => resolve()));

      const rebooted = makeTestApp();
      app = rebooted.app;
      controller = rebooted.controller;
      server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const newPort = (server.address() as any).port;

      const dashAfterRestart = await fetch(`http://127.0.0.1:${newPort}/api/global-reach/dashboard`, {
        headers: ownerHeaders,
      }).then((r) => r.json());

      assert.equal(dashAfterRestart.contacts.length, savedCountBeforeCrash, 'All contacts must persist across restart');
      assert.equal(dashAfterRestart.scheduler.isRunningNow, false, 'Stale running lock must auto-recover on restart');
      assert.ok(
        (dashAfterRestart.scheduler.recoveryNotes || '').includes('Recovered gracefully'),
        'Crash recovery note should be recorded'
      );

      // Also verify authorized hourly Vercel Cron endpoint works
      const cronOk = await fetch(`http://127.0.0.1:${newPort}/api/cron/global-reach`, {
        headers: { Authorization: 'Bearer test-global-reach-cron-secret' },
      }).then((r) => r.json());
      assert.equal(cronOk.success, true);
      assert.ok(cronOk.executedWorkspaces >= 1);
    });
  } finally {
    controller.stopScheduler();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (prevDisable === undefined) delete process.env.DISABLE_BACKGROUND_SCHEDULERS;
    else process.env.DISABLE_BACKGROUND_SCHEDULERS = prevDisable;
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} Global Reach tests passed.`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
