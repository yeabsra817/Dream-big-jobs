import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import {
  formatEthiopiaDateTime,
  registerGlobalOpportunitiesRoutes,
} from '../serverGlobalOpportunities';
import type { DiscoveryJobLogRecord } from '../src/types/globalOpportunities';

function loadJsonFileSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFileAtomic(filePath: string, data: any): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp_${process.pid}_${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

async function getOptionalAiClient(): Promise<any> {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  try {
    const mod = await import('@google/genai');
    return new mod.GoogleGenAI({ apiKey: key });
  } catch {
    return null;
  }
}

async function main() {
  const triggerArg = process.argv.find((a) => a.startsWith('--trigger='))?.split('=')[1] || 'manual_admin';
  const allowedTriggers: DiscoveryJobLogRecord['trigger'][] = [
    'github_actions_cron',
    'vercel_cron',
    'ethiopia_6h_schedule',
    'server_interval',
    'manual_admin',
    'startup_recheck',
  ];
  const trigger: DiscoveryJobLogRecord['trigger'] = allowedTriggers.includes(triggerArg as any)
    ? (triggerArg as DiscoveryJobLogRecord['trigger'])
    : 'manual_admin';

  const runtimeBaseDir = process.cwd();
  const dataDir = path.join(runtimeBaseDir, 'data');
  const ensureRuntimeDataDir = () => {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  };
  ensureRuntimeDataDir();

  const profilesFile = path.join(dataDir, 'user_profiles.json');
  const app = express();

  // Pass isVercel=true so the CLI runner executes deterministically without arming background setTimeout loops
  const controller = registerGlobalOpportunitiesRoutes({
    app,
    runtimeBaseDir,
    isVercel: true,
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    loadUserProfiles: () => loadJsonFileSafe<Record<string, any>>(profilesFile, {}),
    isPersistentOwnerRequest: () => false,
    getRequesterUid: () => null,
    getRequesterEmail: () => null,
    appendAuditLog: () => {},
    getAiClient: getOptionalAiClient,
  });

  const startedEat = formatEthiopiaDateTime(Date.now()) || new Date().toISOString();
  console.log(`\n[HopelandJobs Autonomous Discovery] Starting 6-Department Global Run`);
  console.log(`Trigger: ${trigger} | Ethiopia Time: ${startedEat}`);
  console.log(`AI Independence Mode: ${process.env.GEMINI_API_KEY ? 'Gemini Optional Layer Enabled' : '100% AI-Independent Autonomous Core'}`);

  const runLog = await controller.runFullOfficialDiscovery(trigger, {
    scheduledSlotEat: startedEat,
    attemptNumber: 1,
    maxAttempts: 1,
  });

  const store = controller.loadStore();
  const activeOpps = store.international_opportunities.filter((o) => !o.isArchived && o.hasVerifiedBadge);
  const prPathways = store.permanent_residency_pathways || [];

  const report = {
    generatedAt: new Date().toISOString(),
    generatedAtEat: formatEthiopiaDateTime(Date.now()),
    trigger,
    status: runLog.status,
    durationMs: runLog.durationMs,
    sourcesQueried: runLog.sourcesQueried,
    candidatesDiscovered: runLog.candidatesDiscovered,
    verifiedAndActiveCount: runLog.verifiedAndActiveCount,
    verifiedTierCount: activeOpps.filter((o) => o.verificationTier === 'VERIFIED').length,
    partiallyVerifiedTierCount: activeOpps.filter((o) => o.verificationTier !== 'VERIFIED').length,
    duplicatesSkipped: runLog.duplicatesSkipped,
    rejectedUnderThreeDaysCount: runLog.rejectedUnderThreeDaysCount,
    rejectedBrokenOrClosedCount: runLog.rejectedBrokenOrClosedCount,
    rejectedDueToVisaCount: runLog.rejectedDueToVisaCount || 0,
    rejectedDueToProfessionalRestrictionCount: runLog.rejectedDueToProfessionalRestrictionCount || 0,
    permanentResidencyCountriesTotal: prPathways.length,
    permanentResidencyVerifiedHttp200: prPathways.filter((p) => p.verificationTier === 'VERIFIED').length,
    departmentSummaries: runLog.departmentSummaries || [],
    sources: store.opportunity_sources.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      lastItemCount: s.lastItemCount,
      lastError: s.lastError,
    })),
    errors: runLog.errors,
    sampleActiveOpportunities: activeOpps.slice(0, 12).map((o) => ({
      title: o.title,
      organization: o.organization,
      department: o.department,
      country: o.country,
      verificationTier: o.verificationTier,
      visaClassification: o.funding.employmentVisaLabel || o.funding.visaSupportSummary,
      deadline: o.deadline.deadlineDateRaw,
      daysRemaining: o.deadline.fullDaysRemaining,
      officialUrl: o.officialApplicationUrl,
    })),
  };

  const reportFile = path.join(dataDir, 'latest_discovery_report.json');
  writeJsonFileAtomic(reportFile, report);

  console.log('\n================ DISCOVERY RUN SUMMARY ================');
  console.log(`Status: ${report.status.toUpperCase()} | Duration: ${(report.durationMs / 1000).toFixed(1)}s`);
  console.log(`Sources Queried: ${report.sourcesQueried} | Candidates Discovered: ${report.candidatesDiscovered}`);
  console.log(`Active Displayable Opportunities: ${report.verifiedAndActiveCount} (VERIFIED: ${report.verifiedTierCount}, PARTIALLY VERIFIED: ${report.partiallyVerifiedTierCount})`);
  console.log(`Official Government PR Countries: ${report.permanentResidencyCountriesTotal} (Live HTTP 200 Verified: ${report.permanentResidencyVerifiedHttp200})`);
  console.log(`Duplicates Skipped: ${report.duplicatesSkipped} | Rejected (<3d): ${report.rejectedUnderThreeDaysCount} | Rejected (Broken/Closed): ${report.rejectedBrokenOrClosedCount}`);
  console.log('\nDepartment Breakdown:');
  for (const dept of report.departmentSummaries) {
    console.log(
      `  - ${dept.label}: status=${dept.status}, total=${dept.candidatesFound}, verified=${dept.verifiedCount}, partial=${dept.partiallyVerifiedCount}, pending=${dept.pendingCount}, rejected/expired=${dept.rejectedOrExpiredCount}`
    );
  }
  if (report.errors.length > 0) {
    console.log('\nNon-fatal Source Notes / Errors:');
    for (const err of report.errors) {
      console.log(`  * ${err}`);
    }
  }
  console.log(`\nReport persisted to: ${reportFile}`);
  console.log('=======================================================\n');

  // Write GitHub Actions Step Summary when running inside GitHub Actions
  const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryPath) {
    const mdLines = [
      `## HopelandJobs 24/7 Global Discovery Report`,
      `- **Executed (EAT):** ${report.generatedAtEat}`,
      `- **Trigger:** \`${trigger}\` | **Status:** \`${report.status.toUpperCase()}\` | **Duration:** ${(report.durationMs / 1000).toFixed(1)}s`,
      `- **Active Global Banking & WASH Opportunities:** **${report.verifiedAndActiveCount}** (VERIFIED: ${report.verifiedTierCount}, PARTIALLY VERIFIED: ${report.partiallyVerifiedTierCount})`,
      `- **Official Government Permanent Residency Countries:** **${report.permanentResidencyCountriesTotal}** (${report.permanentResidencyVerifiedHttp200} live HTTP 200 verified)`,
      ``,
      `| Department | Status | Total | Verified | Partially Verified | Pending | Rejected / Expired |`,
      `| --- | --- | ---: | ---: | ---: | ---: | ---: |`,
      ...report.departmentSummaries.map(
        (d) =>
          `| ${d.label} | ${d.status} | ${d.candidatesFound} | ${d.verifiedCount} | ${d.partiallyVerifiedCount} | ${d.pendingCount} | ${d.rejectedOrExpiredCount} |`
      ),
    ];
    if (report.errors.length > 0) {
      mdLines.push('', '### Source Warnings', ...report.errors.map((e) => `- ${e}`));
    }
    fs.appendFileSync(stepSummaryPath, `${mdLines.join('\n')}\n`, 'utf8');
  }

  if (runLog.status === 'failed') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[HopelandJobs Autonomous Discovery] Fatal error:', err);
  process.exit(1);
});
