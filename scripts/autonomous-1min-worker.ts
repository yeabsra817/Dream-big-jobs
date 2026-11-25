/**
 * Standalone 24/7 1-Minute Autonomous Discovery Worker
 *
 * Independent of GitHub Actions' 5-minute cron limit and independent of website visitors.
 * Run continuously with:
 *   npm run worker:discovery
 * Or run a single verified cycle for testing with:
 *   npx tsx scripts/autonomous-1min-worker.ts --once
 * Or run N consecutive cycles with:
 *   npx tsx scripts/autonomous-1min-worker.ts --cycles=2 --interval-sec=60
 */
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import { registerGlobalOpportunitiesRoutes, formatEthiopiaDateTime } from '../serverGlobalOpportunities';
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
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp_${process.pid}_${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

async function main() {
  const once = process.argv.includes('--once');
  const cyclesArg = process.argv.find((a) => a.startsWith('--cycles='))?.split('=')[1];
  const intervalArg = process.argv.find((a) => a.startsWith('--interval-sec='))?.split('=')[1];
  const maxCycles = once ? 1 : cyclesArg ? Math.max(1, Number(cyclesArg)) : Infinity;
  const intervalSec = intervalArg
    ? Math.max(5, Number(intervalArg))
    : Number(process.env.AUTONOMOUS_TICK_INTERVAL_SECONDS || 60);

  const runtimeBaseDir = process.cwd();
  const dataDir = path.join(runtimeBaseDir, 'data');
  const ensureRuntimeDataDir = () => {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  };
  ensureRuntimeDataDir();

  const app = express();
  const globalOpportunitiesController = registerGlobalOpportunitiesRoutes({
    app,
    runtimeBaseDir,
    isVercel: true, // Prevent duplicate 6-hour timer inside standalone worker
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    loadUserProfiles: () => loadJsonFileSafe<Record<string, any>>(path.join(dataDir, 'user_profiles.json'), {}),
    isPersistentOwnerRequest: () => false,
    getRequesterUid: () => null,
    getRequesterEmail: () => null,
    appendAuditLog: () => {},
    getAiClient: async () => null,
  });

  const branchManagerController = registerBranchManagerJobsRoutes({
    app,
    runtimeBaseDir,
    isVercel: true,
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    isPersistentOwnerRequest: () => false,
    getRequesterUid: () => null,
  });

  const worker = registerAutonomousDiscoveryWorker({
    app,
    runtimeBaseDir,
    isVercel: false,
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    isPersistentOwnerRequest: () => false,
    appendAuditLog: (entry) => {
      console.log(`[Audit:${entry.severity || 'info'}] ${entry.action}: ${entry.summary}`);
    },
    pushAdminNotification: (item) => {
      console.log(`[OwnerNotification:${item.severity || 'info'}] ${item.title} — ${item.message}`);
    },
    globalOpportunitiesController,
    branchManagerController,
    autoStartWorker: false, // Controlled explicitly by loop below
  });

  let shuttingDown = false;
  process.on('SIGINT', () => {
    shuttingDown = true;
    worker.stop();
    console.log('\n[HopelandJobs 1-Min Worker] Graceful shutdown requested.');
  });
  process.on('SIGTERM', () => {
    shuttingDown = true;
    worker.stop();
  });

  console.log(
    `[HopelandJobs 1-Min Worker] Started at ${formatEthiopiaDateTime(Date.now())} | Interval: ${intervalSec}s | Mode: ${
      Number.isFinite(maxCycles) ? `${maxCycles} cycle(s)` : 'Continuous 24/7'
    }`
  );

  let completed = 0;
  while (!shuttingDown && completed < maxCycles) {
    const rec = await worker.runOneMinuteCycle('standalone_worker');
    completed++;
    console.log(
      `[Cycle #${completed}] id=${rec.cycleId} status=${rec.status} duration=${(rec.durationMs / 1000).toFixed(
        1
      )}s sources=${rec.sourcesPolled.join(', ')} scanned=${rec.candidatesScanned} verified=${
        rec.verifiedCount
      } rejected=${rec.rejectedCount} dupsSkipped=${rec.duplicatesSkipped} newMatches=${
        rec.newMatchingCount
      }${rec.error ? ` error="${rec.error}"` : ''}`
    );

    if (completed >= maxCycles || shuttingDown) break;
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }

  worker.stop();
  const status = worker.buildPublicStatus();
  console.log(
    `[HopelandJobs 1-Min Worker] Summary: totalCycles=${status.totalCyclesCompleted}, lastStatus=${status.lastCycleStatus}, lastSuccess=${status.lastSuccessfulSearchAtEat}, verified=${status.counts.opportunitiesVerified}, rejected=${status.counts.opportunitiesRejected}, visa3kVerified=${status.counts.visa3kVerifiedCount}`
  );
}

main().catch((err) => {
  console.error('[HopelandJobs 1-Min Worker] Fatal error:', err);
  process.exit(1);
});
