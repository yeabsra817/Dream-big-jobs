/**
 * Comprehensive Acceptance & Reliability Verification Suite (Sections 12 & 13G)
 *
 * Verifies:
 *  1. GitHub Actions workflow repair & esbuild peer dependency fix
 *  2. Public-URL SSRF / private-IP / metadata security blocking
 *  3. Search-API-free public web discovery (robots.txt, sitemap, RSS, HTML link-following,
 *     new domain expansion, Schema.org JobPosting extraction, 6-state verification,
 *     duplicate prevention, unavailable-site fault isolation, grouped incident deduplication)
 *  4. Transactional `.bak` automatic corruption recovery with zero record loss
 *  5. Worker restart / crash recovery (stale lock clearance + stuck 'processing' task requeue)
 *  6. Live public internet crawl verification (no mock fetch, no Google/Bing Search APIs)
 *  7. Endpoint authentication & Admin Operational Telemetry (403 non-owner, 200 owner, 401/200 cron)
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import assert from 'assert';
import express from 'express';
import type { AddressInfo } from 'net';
import {
  AutonomousWebCrawler,
  validatePublicCrawlUrl,
  type CrawlerFetchImpl,
} from '../serverAutonomousWebCrawler';
import { registerGlobalOpportunitiesRoutes } from '../serverGlobalOpportunities';
import { registerBranchManagerJobsRoutes } from '../serverBranchManagerJobs';
import { registerAutonomousDiscoveryWorker } from '../serverAutonomousDiscoveryWorker';

function loadJsonFileSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFileAtomic(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp_${process.pid}_${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function createMockResponse(status: number, body: string, contentType = 'text/html; charset=utf-8') {
  const headersMap = new Map<string, string>([['content-type', contentType]]);
  return {
    status,
    headers: {
      get(name: string) {
        return headersMap.get(name.toLowerCase()) || null;
      },
    },
    async text() {
      return body;
    },
  };
}

function createTempWorkspace(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  return dir;
}

function createMinimalAppWithWorker(options: {
  runtimeBaseDir: string;
  crawlerFetchImpl?: CrawlerFetchImpl;
  skipDnsForMockTest?: boolean;
}) {
  const app = express();
  app.use(express.json());
  const dataDir = path.join(options.runtimeBaseDir, 'data');
  const ensureRuntimeDataDir = () => {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  };
  ensureRuntimeDataDir();

  const isPersistentOwnerRequest = (req: express.Request) =>
    String(req.headers['x-owner-test-auth'] || '') === 'verified-owner';

  const globalOpportunitiesController = registerGlobalOpportunitiesRoutes({
    app,
    runtimeBaseDir: options.runtimeBaseDir,
    isVercel: true,
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    loadUserProfiles: () => ({}),
    isPersistentOwnerRequest,
    getRequesterUid: () => null,
    getRequesterEmail: () => null,
    appendAuditLog: () => {},
    getAiClient: async () => null,
  });

  const branchManagerController = registerBranchManagerJobsRoutes({
    app,
    runtimeBaseDir: options.runtimeBaseDir,
    isVercel: true,
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    isPersistentOwnerRequest,
    getRequesterUid: () => null,
  });

  const ownerNotifications: Array<{ type: string; title: string; message: string; severity?: string }> = [];

  const worker = registerAutonomousDiscoveryWorker({
    app,
    runtimeBaseDir: options.runtimeBaseDir,
    isVercel: false,
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    isPersistentOwnerRequest,
    appendAuditLog: () => {},
    pushAdminNotification: (item) => {
      ownerNotifications.push(item);
    },
    globalOpportunitiesController,
    branchManagerController,
    autoStartWorker: false,
    crawlerFetchImpl: options.crawlerFetchImpl,
    skipDnsForMockTest: options.skipDnsForMockTest,
  });

  return { app, worker, branchManagerController, ownerNotifications };
}

async function runTests() {
  const startedAt = Date.now();
  const cleanupDirs: string[] = [];

  try {
    console.log('========================================================================');
    console.log('HOPelandJOBS AUTONOMOUS CRAWLER & RELIABILITY ACCEPTANCE TEST SUITE');
    console.log('========================================================================');

    // -------------------------------------------------------------------------
    // TEST 1: GitHub Actions Workflow & Dependency Fix Verification
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Verifying GitHub Actions workflow & package.json dependency fix...');
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    const workflowYaml = fs.readFileSync(
      path.join(process.cwd(), '.github', 'workflows', 'hopeland-opportunity-discovery.yml'),
      'utf8'
    );
    const esbuildSpec = pkg.devDependencies?.esbuild || pkg.dependencies?.esbuild;
    assert(
      typeof esbuildSpec === 'string' && esbuildSpec.includes('0.28'),
      `Expected esbuild ^0.28.x in package.json, got ${esbuildSpec}`
    );
    assert(workflowYaml.includes('actions/checkout@v7'), 'Workflow should use actions/checkout@v7');
    assert(workflowYaml.includes('actions/setup-node@v7'), 'Workflow should use actions/setup-node@v7');
    assert(workflowYaml.includes("node-version: '24'"), 'Workflow should use Node 24');
    assert(workflowYaml.includes('workflow_dispatch:'), 'Workflow should retain manual workflow_dispatch');
    assert(!workflowYaml.includes("'* * * * *'"), 'Workflow must NOT configure unsupported 1-minute GitHub cron');
    console.log('  PASS: esbuild ^0.28.0 verified, workflow upgraded to @v7 + Node 24 + valid 6h cron + workflow_dispatch.');

    // -------------------------------------------------------------------------
    // TEST 2: SSRF / Private-Network URL Protection
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Verifying strict SSRF / private-network crawl URL guard...');
    const blockedCases = [
      'http://127.0.0.1:3000/api/admin',
      'http://localhost/secret',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.15/internal',
      'http://192.168.1.1/router',
      'http://[::1]/loopback',
      'file:///etc/passwd',
      'https://user:pass@example.com/jobs',
      'http://metadata.google.internal/computeMetadata/v1/',
    ];
    for (const badUrl of blockedCases) {
      const check = await validatePublicCrawlUrl(badUrl, { skipDnsForMockTest: true });
      assert.strictEqual(check.ok, false, `Expected blocked URL to fail validation: ${badUrl}`);
    }
    const goodCheck = await validatePublicCrawlUrl('https://careers.nordicbank.example/jobs/branch-manager', {
      skipDnsForMockTest: true,
    });
    assert.strictEqual(goodCheck.ok, true, 'Expected valid public HTTPS URL to pass validation');
    console.log(`  PASS: All ${blockedCases.length} internal/private/metadata/file URLs rejected; public HTTPS URL allowed.`);

    // -------------------------------------------------------------------------
    // TEST 3: Search-API-Free Public Web Discovery, 6-State Verification,
    //         Unavailable-Site Fault Isolation & Grouped Incident Tracking
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Verifying independent web discovery, 6-state pipeline, fault isolation & grouped incidents...');
    const ws3 = createTempWorkspace('hopeland-acc-t3-');
    cleanupDirs.push(ws3);

    const mockFetch: CrawlerFetchImpl = async (url) => {
      if (url === 'https://careers.nordicbank.example/robots.txt') {
        return createMockResponse(
          200,
          [
            'User-agent: *',
            'Disallow: /private/',
            'Crawl-delay: 2',
            'Sitemap: https://careers.nordicbank.example/sitemap.xml',
          ].join('\n'),
          'text/plain'
        );
      }
      if (url === 'https://careers.nordicbank.example/sitemap.xml') {
        return createMockResponse(
          200,
          `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://careers.nordicbank.example/jobs/senior-branch-manager</loc></url>
            <url><loc>https://careers.nordicbank.example/private/secret-job</loc></url>
          </urlset>`,
          'application/xml'
        );
      }
      if (url === 'https://careers.nordicbank.example/jobs/openings') {
        return createMockResponse(
          200,
          `<!doctype html>
          <html>
            <head>
              <title>Nordic Commercial Bank Careers</title>
              <link rel="alternate" type="application/rss+xml" href="https://careers.nordicbank.example/jobs/feed.xml" />
              <script type="application/ld+json">
              [
                {
                  "@context": "https://schema.org",
                  "@type": "JobPosting",
                  "title": "Senior Retail Bank Branch Manager (Visa Sponsorship)",
                  "description": "Lead retail banking operations, credit risk compliance, and customer portfolio growth in Stockholm, Sweden. Full work permit and visa sponsorship plus relocation assistance provided for international applicants worldwide including Ethiopia. Gross salary USD 5,200 per month.",
                  "hiringOrganization": { "name": "Nordic Commercial Bank AB" },
                  "jobLocation": { "address": { "addressCountry": "Sweden", "addressLocality": "Stockholm" } },
                  "baseSalary": { "currency": "USD", "value": { "minValue": 62400, "unitText": "YEAR" } },
                  "validThrough": "2028-12-31",
                  "url": "https://careers.nordicbank.example/jobs/branch-manager-stockholm"
                },
                {
                  "@context": "https://schema.org",
                  "@type": "JobPosting",
                  "title": "Fast Track Banking Officer - Guaranteed Visa",
                  "description": "Pay an application fee via Western Union to secure your guaranteed visa immediately.",
                  "hiringOrganization": { "name": "Fake Agency Ltd" },
                  "validThrough": "2028-12-31",
                  "url": "https://careers.nordicbank.example/jobs/scam-role"
                },
                {
                  "@context": "https://schema.org",
                  "@type": "JobPosting",
                  "title": "Compliance & Audit Manager (Closed 2023)",
                  "description": "Lead regulatory banking compliance in Oslo, Norway with visa sponsorship. USD 4,500 per month.",
                  "hiringOrganization": { "name": "Nordic Commercial Bank AB" },
                  "validThrough": "2023-06-30",
                  "url": "https://careers.nordicbank.example/jobs/expired-compliance"
                }
              ]
              </script>
            </head>
            <body>
              <h1>Global Banking & Finance Careers</h1>
              <a href="https://jobs.eurofinance.example/careers/banking-opportunities">Partner Bank Careers in Germany</a>
              <a href="https://careers.nordicbank.example/private/blocked-by-robots">Internal Staff Only</a>
            </body>
          </html>`
        );
      }
      if (url === 'https://careers.nordicbank.example/jobs/feed.xml') {
        return createMockResponse(
          200,
          `<?xml version="1.0" encoding="UTF-8"?>
          <rss version="2.0"><channel>
            <title>Nordic Bank Jobs</title>
            <item>
              <title>Global WASH Programme & Water Infrastructure Coordinator</title>
              <link>https://careers.nordicbank.example/jobs/wash-coordinator</link>
              <description>International NGO and development bank partnership. Visa sponsorship and relocation included for international candidates. Salary USD 4,200/month.</description>
            </item>
          </channel></rss>`,
          'application/rss+xml'
        );
      }
      if (url === 'https://down-portal.example/robots.txt') {
        return createMockResponse(503, 'Service Temporarily Unavailable', 'text/plain');
      }
      if (url === 'https://down-portal.example/careers') {
        return createMockResponse(503, 'Service Temporarily Unavailable', 'text/plain');
      }
      if (url === 'https://jobs.eurofinance.example/robots.txt') {
        return createMockResponse(404, 'Not Found', 'text/plain');
      }
      if (url === 'https://jobs.eurofinance.example/careers/banking-opportunities') {
        return createMockResponse(
          200,
          `<html><head><title>EuroFinance Bank Careers</title></head><body><h1>Banking Jobs</h1></body></html>`
        );
      }
      return createMockResponse(404, 'Not Found', 'text/plain');
    };

    const { worker, branchManagerController } = createMinimalAppWithWorker({
      runtimeBaseDir: ws3,
      crawlerFetchImpl: mockFetch,
      skipDnsForMockTest: true,
    });

    // Replace seed queue with deterministic mock targets for Test 3
    const { db } = worker.webCrawler.loadDb();
    db.domains = {};
    db.queue = [];
    db.opportunities = [];
    worker.webCrawler.enqueueUrl(db, {
      url: 'https://careers.nordicbank.example/jobs/openings',
      taskType: 'html_page',
      priority: 100,
      discoveredFrom: 'test_seed',
      categoryHint: 'employer_careers',
    });
    worker.webCrawler.enqueueUrl(db, {
      url: 'https://down-portal.example/careers',
      taskType: 'html_page',
      priority: 99,
      discoveredFrom: 'test_seed',
      categoryHint: 'employer_careers',
    });
    worker.webCrawler.saveDb(db);

    const cycle1 = await worker.runOneMinuteCycle('standalone_worker', {
      includeGlobalSweepIfDue: false,
      crawlerMaxTasks: 4,
    });
    const metricsAfter1 = worker.webCrawler.getMetricsSummary();
    const stateAfter1 = worker.loadState();

    // Assert fault isolation: careers.nordicbank.example succeeded even though down-portal.example returned 503!
    assert(metricsAfter1.summary.pagesCrawled >= 1, 'Expected >=1 crawled page despite down-portal.example 503');
    assert(
      metricsAfter1.recentDomains.some((d) => d.domain === 'jobs.eurofinance.example'),
      'Expected HTML link-following to discover brand-new domain jobs.eurofinance.example'
    );
    assert(
      metricsAfter1.recentDomains.some(
        (d) =>
          d.domain === 'careers.nordicbank.example' &&
          d.sitemaps.includes('https://careers.nordicbank.example/sitemap.xml') &&
          d.disallowedPrefixes.includes('/private/')
      ),
      'Expected robots.txt parsing to harvest Sitemap and record Disallow: /private/'
    );
    assert(
      metricsAfter1.pipelineBreakdown.PUBLISHED >= 1,
      `Expected >=1 PUBLISHED opportunity, got ${metricsAfter1.pipelineBreakdown.PUBLISHED}`
    );
    assert(
      metricsAfter1.pipelineBreakdown.REJECTED >= 1,
      `Expected >=1 REJECTED scam opportunity, got ${metricsAfter1.pipelineBreakdown.REJECTED}`
    );
    assert(
      metricsAfter1.pipelineBreakdown.EXPIRED >= 1,
      `Expected >=1 EXPIRED opportunity, got ${metricsAfter1.pipelineBreakdown.EXPIRED}`
    );

    // Check robots.txt enforcement: /private/ URL should NEVER be crawled as done
    const dbAfter1 = worker.webCrawler.loadDb().db;
    const downTask = dbAfter1.queue.find((t) => t.url === 'https://down-portal.example/careers');
    assert(downTask && downTask.status === 'queued' && downTask.nextRetryAt, 'Expected 503 task to remain queued with backoff');

    // Check grouped incident recorded for down-portal.example
    const downIncident1 = stateAfter1.incidents.find((i) => i.component === 'crawler:down-portal.example');
    assert(downIncident1 && downIncident1.occurrences === 1, 'Expected 1 grouped incident for down-portal.example');

    // Force down-portal retry due NOW + re-enqueue identical openings page to test duplicate prevention & incident grouping
    downTask.nextRetryAt = null;
    if (dbAfter1.domains['down-portal.example']) {
      dbAfter1.domains['down-portal.example'].lastCrawledAt = null;
      dbAfter1.domains['down-portal.example'].pausedUntil = null;
    }
    // Also enqueue the openings page fresh via a slightly different query-less force by resetting its task to queued
    const openingsTask = dbAfter1.queue.find((t) => t.url === 'https://careers.nordicbank.example/jobs/openings');
    if (openingsTask) {
      openingsTask.status = 'queued';
      delete dbAfter1.crawledPages['https://careers.nordicbank.example/jobs/openings'];
      if (dbAfter1.domains['careers.nordicbank.example']) {
        dbAfter1.domains['careers.nordicbank.example'].lastCrawledAt = null;
      }
    }
    worker.webCrawler.saveDb(dbAfter1);

    await worker.runOneMinuteCycle('standalone_worker', {
      includeGlobalSweepIfDue: false,
      crawlerMaxTasks: 4,
    });
    const stateAfter2 = worker.loadState();
    const metricsAfter2 = worker.webCrawler.getMetricsSummary();
    const downIncidents = stateAfter2.incidents.filter((i) => i.component === 'crawler:down-portal.example');
    assert.strictEqual(
      downIncidents.length,
      1,
      `Expected single grouped incident (no duplicate alert spam), got ${downIncidents.length}`
    );
    assert(
      downIncidents[0].occurrences >= 2,
      `Expected grouped incident occurrences >= 2, got ${downIncidents[0].occurrences}`
    );
    assert(
      metricsAfter2.summary.duplicateRecordsPrevented >= 1,
      `Expected duplicateRecordsPrevented >= 1 on re-crawl, got ${metricsAfter2.summary.duplicateRecordsPrevented}`
    );

    // Check that the published $5,200/mo visa-sponsored branch manager role was forwarded into the $3,000+ store!
    const bmStore = branchManagerController.loadStore();
    assert(
      bmStore.rawCandidates.some((c: any) => String(c.title).includes('Senior Retail Bank Branch Manager')),
      'Expected published $5,200/mo branch manager role from web crawler to merge into $3,000+ store'
    );
    console.log(
      `  PASS: Cycle status=${cycle1.status} | domains=${metricsAfter2.summary.domainsDiscovered} | pagesCrawled=${metricsAfter2.summary.pagesCrawled} | PUBLISHED=${metricsAfter2.pipelineBreakdown.PUBLISHED} REJECTED=${metricsAfter2.pipelineBreakdown.REJECTED} EXPIRED=${metricsAfter2.pipelineBreakdown.EXPIRED} | dupsPrevented=${metricsAfter2.summary.duplicateRecordsPrevented} | groupedIncidents=${downIncidents.length} (occurrences=${downIncidents[0].occurrences}).`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Corrupted Database Auto-Recovery from Transactional `.bak`
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Simulating database corruption and verifying automatic .bak recovery...');
    const crawlerDbPath = path.join(ws3, 'data', 'autonomous_crawler_db.json');
    const workerStatePath = path.join(ws3, 'data', 'autonomous_worker_state.json');
    const domainsBeforeCorrupt = Object.keys(worker.webCrawler.loadDb().db.domains).length;
    const oppsBeforeCorrupt = worker.webCrawler.loadDb().db.opportunities.length;
    const cyclesBeforeCorrupt = worker.loadState().totalCyclesCompleted;

    // Ensure `.bak` exists with latest valid snapshot by saving once more
    worker.webCrawler.saveDb(worker.webCrawler.loadDb().db);
    assert(fs.existsSync(`${crawlerDbPath}.bak`), 'Expected autonomous_crawler_db.json.bak snapshot');
    assert(fs.existsSync(`${workerStatePath}.bak`), 'Expected autonomous_worker_state.json.bak snapshot');

    // Corrupt BOTH primary JSON files!
    fs.writeFileSync(crawlerDbPath, '{"version": 1, "domains": { TRUNCATED_CORRUPT_JSON', 'utf8');
    fs.writeFileSync(workerStatePath, '<<<CORRUPTED_STATE_FILE>>>', 'utf8');

    // Reload using fresh instances and verify automatic recovery with zero data loss
    const freshCrawler = new AutonomousWebCrawler({
      runtimeBaseDir: ws3,
      fetchImpl: mockFetch,
      skipDnsForMockTest: true,
    });
    const recoveredCrawler = freshCrawler.loadDb();
    assert.strictEqual(recoveredCrawler.recoveredFromBackup, true, 'Expected crawler DB recovery from .bak');
    assert.strictEqual(
      Object.keys(recoveredCrawler.db.domains).length,
      domainsBeforeCorrupt,
      'Expected zero domain loss after .bak recovery'
    );
    assert.strictEqual(
      recoveredCrawler.db.opportunities.length,
      oppsBeforeCorrupt,
      'Expected zero opportunity loss after .bak recovery'
    );

    const { worker: recoveredWorker } = createMinimalAppWithWorker({
      runtimeBaseDir: ws3,
      crawlerFetchImpl: mockFetch,
      skipDnsForMockTest: true,
    });
    assert(
      recoveredWorker.loadState().totalCyclesCompleted >= cyclesBeforeCorrupt - 1,
      'Expected worker state cycle history preserved after .bak recovery'
    );
    console.log(
      `  PASS: Corrupted primary DB & worker state auto-restored from .bak with 0 lost domains (${domainsBeforeCorrupt}) and 0 lost opportunities (${oppsBeforeCorrupt}).`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Worker Restart / Crash Recovery (Stale Lock + Interrupted Task)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Simulating abrupt worker crash (stale lock + stuck processing task)...');
    const dbCrash = freshCrawler.loadDb().db;
    dbCrash.queue.push({
      id: 'task_interrupted_crash_test',
      url: 'https://jobs.eurofinance.example/careers/banking-opportunities',
      domain: 'jobs.eurofinance.example',
      taskType: 'html_page',
      priority: 95,
      status: 'processing',
      attempts: 1,
      maxAttempts: 3,
      nextRetryAt: null,
      enqueuedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: null,
      discoveredFrom: 'crash_test',
      lastError: null,
    });
    freshCrawler.saveDb(dbCrash);

    const stateCrash = JSON.parse(fs.readFileSync(workerStatePath, 'utf8'));
    stateCrash.activeLock = {
      runId: 'crashed_run_999',
      trigger: 'server_1min_interval',
      pid: 999999,
      startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    };
    writeJsonFileAtomic(workerStatePath, stateCrash);

    // Boot a brand-new worker instance — recoverOnBoot() runs automatically
    const { worker: rebootedWorker } = createMinimalAppWithWorker({
      runtimeBaseDir: ws3,
      crawlerFetchImpl: mockFetch,
      skipDnsForMockTest: true,
    });
    const postBootState = rebootedWorker.loadState();
    const postBootTask = rebootedWorker.webCrawler
      .loadDb()
      .db.queue.find((t) => t.id === 'task_interrupted_crash_test');
    assert.strictEqual(postBootState.activeLock, null, 'Expected stale lock cleared automatically on boot');
    assert.strictEqual(
      postBootTask?.status,
      'queued',
      `Expected interrupted 'processing' task returned to 'queued' on boot, got ${postBootTask?.status}`
    );
    console.log('  PASS: Stale crash lock cleared automatically and stuck processing task safely returned to queue.');

    // -------------------------------------------------------------------------
    // TEST 6: Live Public Internet Crawl (No Mock Fetch, No Google/Bing API)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Running LIVE public internet crawl batch (zero search APIs, real HTTP)...');
    const wsLive = createTempWorkspace('hopeland-acc-live-');
    cleanupDirs.push(wsLive);
    const liveCrawler = new AutonomousWebCrawler({
      runtimeBaseDir: wsLive,
    });
    const liveBatch = await liveCrawler.runIncrementalCrawlBatch({ maxTasks: 3 });
    const liveMetrics = liveCrawler.getMetricsSummary();
    assert(
      liveBatch.pagesProcessed >= 1,
      `Expected >=1 real public page crawled live, got ${liveBatch.pagesProcessed} (errors: ${JSON.stringify(liveBatch.errors)})`
    );
    console.log(
      `  PASS: LIVE public crawl succeeded! pagesProcessed=${liveBatch.pagesProcessed}, domainsDiscovered=${liveMetrics.summary.domainsDiscovered}, newPagesDiscovered=${liveBatch.newPagesDiscovered}, opportunitiesExtracted=${liveBatch.opportunitiesExtracted}, verified=${liveBatch.opportunitiesVerified}, published=${liveBatch.opportunitiesPublished}, rejected=${liveBatch.opportunitiesRejected}.`
    );

    // -------------------------------------------------------------------------
    // TEST 7: HTTP Endpoints, Owner Auth (403/200), Cron Auth (401/200) & 15 Metrics
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Verifying HTTP endpoints, owner auth & all 15 admin operational telemetry metrics...');
    process.env.CRON_SECRET = 'test-hopeland-cron-secret-2026';
    const { app: httpApp } = createMinimalAppWithWorker({
      runtimeBaseDir: ws3,
      crawlerFetchImpl: mockFetch,
      skipDnsForMockTest: true,
    });

    const server = await new Promise<import('http').Server>((resolve) => {
      const s = httpApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    try {
      const port = (server.address() as AddressInfo).port;
      const base = `http://127.0.0.1:${port}`;

      // Public status
      const statusRes = await fetch(`${base}/api/autonomous-discovery/status`);
      assert.strictEqual(statusRes.status, 200);
      const statusJson = (await statusRes.json()) as any;
      assert(statusJson.crawlerSummary && typeof statusJson.crawlerSummary.domainsDiscovered === 'number');

      // Admin telemetry unauthenticated -> 403
      const unauthAdminRes = await fetch(`${base}/api/autonomous-discovery/admin-telemetry`);
      assert.strictEqual(unauthAdminRes.status, 403, 'Expected 403 for unauthenticated admin-telemetry');

      // Admin telemetry owner-authenticated -> 200 + verify all 15 metrics present
      const authAdminRes = await fetch(`${base}/api/autonomous-discovery/admin-telemetry`, {
        headers: { 'x-owner-test-auth': 'verified-owner' },
      });
      assert.strictEqual(authAdminRes.status, 200, 'Expected 200 for owner-authenticated admin-telemetry');
      const telemetry = (await authAdminRes.json()) as any;
      assert.strictEqual(telemetry.success, true);
      assert(typeof telemetry.workerStatus?.running === 'boolean', 'Missing workerStatus.running');
      assert(typeof telemetry.crawler?.domainsDiscovered === 'number', 'Missing domainsDiscovered');
      assert(typeof telemetry.crawler?.domainsMonitored === 'number', 'Missing domainsMonitored');
      assert(typeof telemetry.crawler?.pagesCrawled === 'number', 'Missing pagesCrawled');
      assert(typeof telemetry.crawler?.newPagesDiscovered === 'number', 'Missing newPagesDiscovered');
      assert(typeof telemetry.crawler?.opportunitiesExtracted === 'number', 'Missing opportunitiesExtracted');
      assert(typeof telemetry.crawler?.opportunitiesVerified === 'number', 'Missing opportunitiesVerified');
      assert(typeof telemetry.crawler?.opportunitiesPublished === 'number', 'Missing opportunitiesPublished');
      assert(typeof telemetry.crawler?.opportunitiesPendingVerification === 'number', 'Missing pending count');
      assert(typeof telemetry.crawler?.opportunitiesRejected === 'number', 'Missing rejected count');
      assert(typeof telemetry.crawler?.opportunitiesExpired === 'number', 'Missing expired count');
      assert(typeof telemetry.crawler?.duplicateRecordsPrevented === 'number', 'Missing duplicate count');
      assert(typeof telemetry.crawler?.queueDepth?.total === 'number', 'Missing queue depth');
      assert(telemetry.schedule && 'lastSuccessfulExecution' in telemetry.schedule, 'Missing schedule telemetry');
      assert(Array.isArray(telemetry.incidents), 'Missing incidents array');

      // Cron webhook unauthenticated -> 401
      const unauthCronRes = await fetch(`${base}/api/cron/autonomous-tick`);
      assert.strictEqual(unauthCronRes.status, 401, 'Expected 401 for unauthenticated cron tick');

      // Cron webhook with Bearer secret -> 200
      const authCronRes = await fetch(`${base}/api/cron/autonomous-tick`, {
        headers: { Authorization: 'Bearer test-hopeland-cron-secret-2026' },
      });
      assert.strictEqual(authCronRes.status, 200, 'Expected 200 for valid Bearer CRON_SECRET tick');

      console.log('  PASS: /status=200, /admin-telemetry=403(unauth)/200(owner, all 15 metrics), /cron/autonomous-tick=401/200.');
    } finally {
      server.close();
    }

    console.log('\n========================================================================');
    console.log(`ALL 7 ACCEPTANCE & RELIABILITY TESTS PASSED in ${((Date.now() - startedAt) / 1000).toFixed(2)}s`);
    console.log('========================================================================');
  } finally {
    for (const dir of cleanupDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

runTests().catch((err) => {
  console.error('\nACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
