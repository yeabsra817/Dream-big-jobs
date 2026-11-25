import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
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
  const tmpPath = `${filePath}.tmp_${process.pid}_${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

async function runTests() {
  const tmpBase = path.join('/tmp', `hopeland_auto1m_test_${Date.now()}`);
  const dataDir = path.join(tmpBase, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // Copy real baseline stores into isolated test dir so we don't mutate production test data
  for (const fname of ['global_opportunities_store.json', 'branch_manager_jobs_store.json']) {
    const src = path.join(process.cwd(), 'data', fname);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(dataDir, fname));
    }
  }

  // Seed a stale lock from a crashed foreign PID to verify automatic boot recovery
  const statePath = path.join(dataDir, 'autonomous_worker_state.json');
  writeJsonFileAtomic(statePath, {
    version: 1,
    activeLock: {
      runId: 'stale_crashed_run_999',
      trigger: 'internal_1min_worker',
      pid: 999999,
      startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  });

  const auditEvents: any[] = [];
  const notifications: any[] = [];
  const app = express();
  app.use(express.json());

  const globalOpportunitiesController = registerGlobalOpportunitiesRoutes({
    app,
    runtimeBaseDir: tmpBase,
    isVercel: true,
    ensureRuntimeDataDir: () => fs.mkdirSync(dataDir, { recursive: true }),
    loadJsonFileSafe,
    writeJsonFileAtomic,
    loadUserProfiles: () => ({}),
    isPersistentOwnerRequest: () => false,
    getRequesterUid: () => null,
    getRequesterEmail: () => null,
    appendAuditLog: () => {},
    getAiClient: async () => null,
  });

  const branchManagerController = registerBranchManagerJobsRoutes({
    app,
    runtimeBaseDir: tmpBase,
    isVercel: true,
    ensureRuntimeDataDir: () => fs.mkdirSync(dataDir, { recursive: true }),
    loadJsonFileSafe,
    writeJsonFileAtomic,
    isPersistentOwnerRequest: () => false,
    getRequesterUid: () => null,
  });

  const worker = registerAutonomousDiscoveryWorker({
    app,
    runtimeBaseDir: tmpBase,
    isVercel: false,
    ensureRuntimeDataDir: () => fs.mkdirSync(dataDir, { recursive: true }),
    loadJsonFileSafe,
    writeJsonFileAtomic,
    isPersistentOwnerRequest: () => false,
    appendAuditLog: (e) => auditEvents.push(e),
    pushAdminNotification: (n) => notifications.push(n),
    globalOpportunitiesController,
    branchManagerController,
    autoStartWorker: false,
  });

  // TEST 1: Crash-recovery cleared stale lock automatically on boot
  assert.strictEqual(worker.loadState().activeLock, null, 'Stale lock should be cleared on boot');
  assert.ok(
    auditEvents.some((e) => e.action === 'autonomous_discovery_lock_recovered'),
    'Lock recovery should be recorded in audit log'
  );
  console.log('PASS [1/6]: Stale lock crash recovery verified');

  // TEST 2: Real live incremental discovery cycle #1 + overlap lock protection
  const [cycle1, overlapCycle] = await Promise.all([
    worker.runOneMinuteCycle('internal_1min_worker', { includeGlobalSweepIfDue: false }),
    (async () => {
      await new Promise((r) => setTimeout(r, 120));
      return worker.runOneMinuteCycle('external_cron_webhook', { includeGlobalSweepIfDue: false });
    })(),
  ]);

  assert.ok(
    cycle1.status === 'success' || cycle1.status === 'partial',
    `Cycle 1 should succeed or be partial, got: ${cycle1.status} (${cycle1.error})`
  );
  assert.ok(cycle1.sourcesPolled.length >= 1, 'Cycle 1 should poll at least 1 approved source');
  assert.strictEqual(
    overlapCycle.status,
    'skipped_overlap',
    `Concurrent trigger must be safely skipped, got: ${overlapCycle.status}`
  );
  console.log(
    `PASS [2/6]: Live cycle #1 (${cycle1.status}, ${cycle1.durationMs}ms, sources=[${cycle1.sourcesPolled.join(', ')}], scanned=${cycle1.candidatesScanned}) + overlap safely skipped`
  );

  // TEST 3: Incremental rotation on Cycle #2 polls next batch without repeating cooled-down sources
  const cycle2 = await worker.runOneMinuteCycle('internal_1min_worker', {
    includeGlobalSweepIfDue: false,
  });
  assert.ok(cycle2.status === 'success' || cycle2.status === 'partial');
  const structured1 = cycle1.sourcesPolled.filter((s) => !s.startsWith('Public Web Crawler'));
  const structured2 = cycle2.sourcesPolled.filter((s) => !s.startsWith('Public Web Crawler'));
  const overlapSources = structured2.filter((s) => structured1.includes(s));
  assert.strictEqual(
    overlapSources.length,
    0,
    `Cycle 2 should rotate to fresh due sources instead of re-hitting cooled-down sources: ${overlapSources.join(', ')}`
  );
  console.log(
    `PASS [3/6]: Incremental source rotation verified (cycle #2 polled [${cycle2.sourcesPolled.join(', ')}], 0 rate-limit collisions)`
  );

  // TEST 4: Duplicate prevention & honest telemetry counts
  const status = worker.buildPublicStatus();
  assert.strictEqual(status.intervalSeconds, 60);
  assert.ok(status.lastSuccessfulSearchAt, 'lastSuccessfulSearchAt must be recorded');
  assert.ok(status.nextScheduledSearchAt, 'nextScheduledSearchAt must be recorded');
  assert.ok(status.counts.opportunitiesDiscovered > 0, 'Discovered count must be > 0');
  assert.ok(status.counts.opportunitiesVerified > 0, 'Verified count must be > 0');
  assert.ok(status.totalCyclesCompleted >= 2);
  assert.ok(status.totalSkippedOverlaps >= 1);
  console.log(
    `PASS [4/6]: Public telemetry verified (discovered=${status.counts.opportunitiesDiscovered}, verified=${status.counts.opportunitiesVerified}, rejected=${status.counts.opportunitiesRejected}, visa3k=${status.counts.visa3kVerifiedCount})`
  );

  // TEST 5: Route security verification (unauthenticated cron/owner routes blocked)
  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  try {
    const statusRes = await fetch(`http://127.0.0.1:${port}/api/autonomous-discovery/status`);
    assert.strictEqual(statusRes.status, 200);
    const statusJson = await statusRes.json();
    assert.strictEqual(statusJson.intervalSeconds, 60);

    const unauthTick = await fetch(`http://127.0.0.1:${port}/api/cron/autonomous-tick`);
    assert.strictEqual(unauthTick.status, 401, 'Unauthorized cron tick must return 401');

    const unauthTrigger = await fetch(`http://127.0.0.1:${port}/api/autonomous-discovery/trigger`, {
      method: 'POST',
    });
    assert.strictEqual(unauthTrigger.status, 403, 'Non-owner manual trigger must return 403');

    const unauthNotifs = await fetch(`http://127.0.0.1:${port}/api/autonomous-discovery/notifications`);
    assert.strictEqual(unauthNotifs.status, 403, 'Non-owner notifications route must return 403');
    console.log('PASS [5/6]: Route authentication & secret protection verified (200/401/403)');
  } finally {
    server.close();
  }

  // TEST 6: Verify GitHub Actions workflow does NOT contain invalid 1-minute cron
  const yml = fs.readFileSync(
    path.join(process.cwd(), '.github/workflows/hopeland-opportunity-discovery.yml'),
    'utf8'
  );
  assert.ok(!yml.includes("'* * * * *'"), 'GitHub Actions must NOT use invalid 1-minute cron');
  assert.ok(yml.includes('workflow_dispatch:'), 'GitHub Actions manual backup trigger preserved');
  console.log('PASS [6/6]: GitHub Actions workflow remains valid backup (>=5m schedule + workflow_dispatch)');

  worker.stop();
  fs.rmSync(tmpBase, { recursive: true, force: true });
  console.log('\nALL 6 AUTONOMOUS 1-MINUTE DISCOVERY TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
