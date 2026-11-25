import type { Express, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  AdminAutonomousTelemetryResponse,
  ApprovedSourceCategory,
  ApprovedSourceHealth,
  AutonomousCycleRecord,
  AutonomousCycleStatus,
  AutonomousDiscoveryStatusResponse,
  AutonomousNewMatchNotification,
  OperationalIncident,
} from './src/types/autonomousDiscovery';
import {
  formatEthiopiaDateTime,
  type GlobalOpportunitiesStore,
} from './serverGlobalOpportunities';
import {
  fetchLiveFxRates,
  LIVE_ASHBY_BANKING_BOARDS,
  LIVE_GREENHOUSE_BANKING_BOARDS,
  type RawDiscoveredBranchJob,
} from './serverBranchManagerJobs';
import type { BranchManagerJobsSearchResponse } from './src/types/branchManagerJobs';
import {
  AutonomousWebCrawler,
  loadJsonWithBackupRecovery,
  saveJsonTransactional,
  type CrawlerFetchImpl,
} from './serverAutonomousWebCrawler';

interface GlobalOpportunitiesControllerLike {
  loadStore: () => GlobalOpportunitiesStore;
  runFullOfficialDiscovery: (
    trigger:
      | 'github_actions_cron'
      | 'vercel_cron'
      | 'ethiopia_6h_schedule'
      | 'server_interval'
      | 'manual_admin'
      | 'startup_recheck',
    options?: {
      scheduledSlotEat?: string;
      attemptNumber?: number;
      maxAttempts?: number;
    }
  ) => Promise<any>;
}

interface BranchManagerControllerLike {
  loadStore: () => any;
  loadExistingGlobalOpps: () => any[];
  mergeIncrementalCandidates: (params: {
    sourceLabel: string;
    idPrefix: string;
    incomingCandidates: RawDiscoveredBranchJob[];
    fxUpdate?: { rates: Record<string, number>; updatedAt: string; sourceNote: string };
  }) => {
    store: any;
    newlyAdded: number;
    duplicatesSkipped: number;
    totalCandidates: number;
  };
  evaluateForOwner: () => BranchManagerJobsSearchResponse;
}

export interface RegisterAutonomousDiscoveryWorkerDeps {
  app: Express;
  runtimeBaseDir: string;
  isVercel: boolean;
  ensureRuntimeDataDir: () => void;
  loadJsonFileSafe: <T>(filePath: string, fallback: T) => T;
  writeJsonFileAtomic: (filePath: string, data: unknown) => void;
  isPersistentOwnerRequest: (req: Request) => boolean;
  appendAuditLog: (entry: {
    action: string;
    actorEmail?: string;
    targetType: string;
    targetId?: string;
    summary: string;
    severity?: 'info' | 'warning' | 'critical';
  }) => void;
  pushAdminNotification: (item: {
    type: string;
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'critical';
  }) => void;
  globalOpportunitiesController: GlobalOpportunitiesControllerLike;
  branchManagerController: BranchManagerControllerLike;
  autoStartWorker?: boolean;
  crawlerFetchImpl?: CrawlerFetchImpl;
  skipDnsForMockTest?: boolean;
}

interface ApprovedSourceDefinition {
  id: string;
  name: string;
  category: ApprovedSourceCategory;
  kind: 'greenhouse' | 'ashby' | 'arbeitnow' | 'fx' | 'global_6dept';
  slug?: string;
  employerName?: string;
  employerType?: string;
  minPollIntervalSec: number;
}

interface PersistedSeenRecord {
  firstSeenAt: string;
  lastSeenAt: string;
  stream: 'visa_3k' | 'global_opportunity' | 'web_crawler';
  title: string;
  employer: string;
  notified: boolean;
}

interface PersistedWorkerState {
  version: number;
  workerStartedAt: string;
  intervalSeconds: number;
  activeLock: {
    runId: string;
    trigger: string;
    pid: number;
    startedAt: string;
    expiresAt: string;
  } | null;
  lastCycleAt: string | null;
  lastCycleStatus: AutonomousCycleStatus | 'idle';
  lastSuccessfulSearchAt: string | null;
  lastSuccessfulSearchAtEat: string | null;
  lastFailedSearchAt: string | null;
  lastFailedSearchAtEat: string | null;
  nextScheduledSearchAt: string | null;
  nextScheduledSearchAtEat: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  totalCyclesCompleted: number;
  totalSkippedOverlaps: number;
  lastPreflightOk: boolean;
  lastPreflightMessage: string | null;
  counts: {
    opportunitiesDiscovered: number;
    opportunitiesVerified: number;
    opportunitiesRejected: number;
    newMatchingOpportunities: number;
    globalVerifiedCount: number;
    globalActiveCount: number;
    prCountriesVerifiedCount: number;
    visa3kVerifiedCount: number;
    visa3kAuditedCount: number;
  };
  sources: Record<
    string,
    ApprovedSourceHealth & {
      backoffUntil: string | null;
    }
  >;
  seenFingerprints: Record<string, PersistedSeenRecord>;
  baselineSeeded: boolean;
  recentNotifications: AutonomousNewMatchNotification[];
  incidents: OperationalIncident[];
  cycleHistory: AutonomousCycleRecord[];
}

const DEFAULT_INTERVAL_SECONDS = 60;
const LOCK_TTL_MS = 5 * 60 * 1000;
const MAX_CYCLE_HISTORY = 80;
const MAX_NOTIFICATIONS = 60;
const MAX_INCIDENTS = 100;
const MAX_SEEN_FINGERPRINTS = 5000;

function buildApprovedSources(): ApprovedSourceDefinition[] {
  const list: ApprovedSourceDefinition[] = [];

  for (const board of LIVE_GREENHOUSE_BANKING_BOARDS) {
    list.push({
      id: `gh_${board.slug}`,
      name: `${board.employerName} Official Careers`,
      category: 'employer_careers',
      kind: 'greenhouse',
      slug: board.slug,
      employerName: board.employerName,
      employerType: board.employerType,
      minPollIntervalSec: 360,
    });
  }

  for (const board of LIVE_ASHBY_BANKING_BOARDS) {
    list.push({
      id: `ashby_${board.slug}`,
      name: `${board.employerName} Official Careers`,
      category: 'employer_careers',
      kind: 'ashby',
      slug: board.slug,
      employerName: board.employerName,
      employerType: board.employerType,
      minPollIntervalSec: 360,
    });
  }

  list.push({
    id: 'arbeitnow_eu_live',
    name: 'Arbeitnow Europe Official Job Feed',
    category: 'employer_careers',
    kind: 'arbeitnow',
    minPollIntervalSec: 300,
  });

  list.push({
    id: 'open_er_api_fx',
    name: 'Open Exchange Rates USD FX Feed',
    category: 'gov_portal',
    kind: 'fx',
    minPollIntervalSec: 1800,
  });

  list.push({
    id: 'global_6dept_official_sweep',
    name: '6-Department Global Official Portals (UN, World Bank, ReliefWeb, Scholarships, Gov PR)',
    category: 'intl_org',
    kind: 'global_6dept',
    minPollIntervalSec: 900,
  });

  return list;
}

function makeFingerprint(stream: string, url: string, title: string, employer: string): string {
  const normalized = [
    stream,
    String(url || '').trim().toLowerCase().replace(/\/+$/, ''),
    String(title || '').trim().toLowerCase().replace(/\s+/g, ' '),
    String(employer || '').trim().toLowerCase().replace(/\s+/g, ' '),
  ].join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}

function makeIncidentSignature(component: string, errorMsg: string): string {
  const norm = `${component.toLowerCase()}|${errorMsg
    .toLowerCase()
    .replace(/[0-9]+ms/g, '<ms>')
    .replace(/[0-9]+s/g, '<s>')
    .replace(/\s+/g, ' ')
    .slice(0, 140)}`;
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 16);
}

function constantTimeSecretEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function fetchJsonWithRetryAndRateLimit(
  url: string,
  timeoutMs = 8000,
  maxRetries = 2
): Promise<{
  ok: boolean;
  status: number;
  data?: any;
  rateLimited?: boolean;
  retryAfterSec?: number;
  errorType?: 'temporary' | 'permanent';
  error?: string;
}> {
  let lastError = 'Unknown network error';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'HopelandJobs-AutonomousDiscovery/2.0',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429) {
        const retryHeader = res.headers.get('retry-after');
        const parsedSec = retryHeader ? Number(retryHeader) : NaN;
        const retryAfterSec =
          Number.isFinite(parsedSec) && parsedSec > 0
            ? Math.min(3600, Math.max(300, Math.ceil(parsedSec)))
            : 600;
        return {
          ok: false,
          status: 429,
          rateLimited: true,
          retryAfterSec,
          errorType: 'temporary',
          error: `HTTP 429 rate-limited (cooldown ${retryAfterSec}s)`,
        };
      }

      if (res.ok) {
        const data = await res.json();
        return { ok: true, status: res.status, data };
      }

      lastError = `HTTP ${res.status}`;
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, errorType: 'permanent', error: lastError };
      }
    } catch (err: any) {
      lastError =
        err?.name === 'TimeoutError' ? `Timeout after ${timeoutMs}ms` : err?.message || String(err);
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }

  return { ok: false, status: 0, errorType: 'temporary', error: lastError };
}

async function sendOwnerAlertEmailIfConfigured(subject: string, textBody: string): Promise<boolean> {
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const recipient = (process.env.OWNER_ALERT_EMAIL || smtpUser).trim();
  if (!smtpUser || !smtpPass || !recipient) {
    return false;
  }

  try {
    const nodemailerMod: any = await import('nodemailer');
    const nodemailer = nodemailerMod.default || nodemailerMod;
    const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpFrom = (process.env.SMTP_FROM || smtpUser).trim();

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: recipient,
      subject,
      text: textBody,
    });
    return true;
  } catch (err: any) {
    console.warn('[AutonomousDiscovery] Optional SMTP alert skipped:', err?.message || err);
    return false;
  }
}

export function registerAutonomousDiscoveryWorker(deps: RegisterAutonomousDiscoveryWorkerDeps) {
  const {
    app,
    runtimeBaseDir,
    isVercel,
    ensureRuntimeDataDir,
    isPersistentOwnerRequest,
    appendAuditLog,
    pushAdminNotification,
    globalOpportunitiesController,
    branchManagerController,
  } = deps;

  const configuredSec = Number(
    process.env.AUTONOMOUS_TICK_INTERVAL_SECONDS || DEFAULT_INTERVAL_SECONDS
  );
  const intervalSeconds =
    Number.isFinite(configuredSec) && configuredSec >= 30 && configuredSec <= 3600
      ? Math.floor(configuredSec)
      : DEFAULT_INTERVAL_SECONDS;
  const intervalMs = intervalSeconds * 1000;

  const stateFilePath = path.join(runtimeBaseDir, 'data', 'autonomous_worker_state.json');
  const approvedSources = buildApprovedSources();
  const bootTimestampIso = new Date().toISOString();

  const webCrawler = new AutonomousWebCrawler({
    runtimeBaseDir,
    fetchImpl: deps.crawlerFetchImpl,
    skipDnsForMockTest: deps.skipDnsForMockTest,
  });

  let isCycleInFlight = false;
  let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function createDefaultState(): PersistedWorkerState {
    const sources: PersistedWorkerState['sources'] = {};
    for (const s of approvedSources) {
      sources[s.id] = {
        id: s.id,
        name: s.name,
        category: s.category,
        minPollIntervalSec: s.minPollIntervalSec,
        lastPolledAt: null,
        nextAllowedPollAt: null,
        lastStatus: 'idle',
        lastItemCount: 0,
        consecutiveErrors: 0,
        lastError: null,
        backoffUntil: null,
      };
    }
    const nextIso = new Date(Date.now() + intervalMs).toISOString();
    return {
      version: 2,
      workerStartedAt: bootTimestampIso,
      intervalSeconds,
      activeLock: null,
      lastCycleAt: null,
      lastCycleStatus: 'idle',
      lastSuccessfulSearchAt: null,
      lastSuccessfulSearchAtEat: null,
      lastFailedSearchAt: null,
      lastFailedSearchAtEat: null,
      nextScheduledSearchAt: nextIso,
      nextScheduledSearchAtEat: formatEthiopiaDateTime(nextIso),
      lastError: null,
      consecutiveFailures: 0,
      totalCyclesCompleted: 0,
      totalSkippedOverlaps: 0,
      lastPreflightOk: true,
      lastPreflightMessage: null,
      counts: {
        opportunitiesDiscovered: 0,
        opportunitiesVerified: 0,
        opportunitiesRejected: 0,
        newMatchingOpportunities: 0,
        globalVerifiedCount: 0,
        globalActiveCount: 0,
        prCountriesVerifiedCount: 0,
        visa3kVerifiedCount: 0,
        visa3kAuditedCount: 0,
      },
      sources,
      seenFingerprints: {},
      baselineSeeded: false,
      recentNotifications: [],
      incidents: [],
      cycleHistory: [],
    };
  }

  function loadState(): PersistedWorkerState {
    ensureRuntimeDataDir();
    const def = createDefaultState();
    const { data: raw, recoveredFromBackup, recoveryNote } =
      loadJsonWithBackupRecovery<Partial<PersistedWorkerState>>(stateFilePath, def);

    const mergedSources: PersistedWorkerState['sources'] = { ...def.sources };
    if (raw.sources && typeof raw.sources === 'object') {
      for (const s of approvedSources) {
        if (raw.sources[s.id]) {
          mergedSources[s.id] = {
            ...def.sources[s.id],
            ...raw.sources[s.id],
            name: s.name,
            category: s.category,
            minPollIntervalSec: s.minPollIntervalSec,
          };
        }
      }
    }

    const state: PersistedWorkerState = {
      ...def,
      ...raw,
      intervalSeconds,
      counts: { ...def.counts, ...(raw.counts || {}) },
      sources: mergedSources,
      seenFingerprints:
        raw.seenFingerprints && typeof raw.seenFingerprints === 'object'
          ? raw.seenFingerprints
          : {},
      recentNotifications: Array.isArray(raw.recentNotifications)
        ? raw.recentNotifications
        : [],
      incidents: Array.isArray(raw.incidents) ? raw.incidents : [],
      cycleHistory: Array.isArray(raw.cycleHistory) ? raw.cycleHistory : [],
    };

    if (recoveredFromBackup && recoveryNote) {
      recordGroupedIncident(state, {
        component: 'storage:autonomous_worker_state',
        message: recoveryNote,
        errorType: 'temporary',
        severity: 'warning',
        autoRecovered: true,
        recoveryResult: 'Restored cleanly from .bak snapshot',
      });
    }

    return state;
  }

  function saveState(state: PersistedWorkerState): void {
    ensureRuntimeDataDir();
    const entries = Object.entries(state.seenFingerprints);
    if (entries.length > MAX_SEEN_FINGERPRINTS) {
      entries.sort((a, b) => Date.parse(b[1].lastSeenAt) - Date.parse(a[1].lastSeenAt));
      state.seenFingerprints = Object.fromEntries(entries.slice(0, MAX_SEEN_FINGERPRINTS));
    }
    state.cycleHistory = state.cycleHistory.slice(0, MAX_CYCLE_HISTORY);
    state.recentNotifications = state.recentNotifications.slice(0, MAX_NOTIFICATIONS);
    state.incidents = state.incidents.slice(0, MAX_INCIDENTS);
    saveJsonTransactional(stateFilePath, state);
  }

  /**
   * Incident Grouping Engine (Section 13D & 13F):
   * Groups repeated failures into ONE incident instead of spamming repetitive alerts every minute.
   */
  function recordGroupedIncident(
    state: PersistedWorkerState,
    params: {
      component: string;
      message: string;
      errorType: 'temporary' | 'permanent';
      severity: 'warning' | 'critical';
      autoRecovered?: boolean;
      recoveryResult?: string;
    }
  ): { incident: OperationalIncident; shouldNotifyOwner: boolean; notifyReason?: string } {
    const nowIso = new Date().toISOString();
    const signature = makeIncidentSignature(params.component, params.message);
    const existing = state.incidents.find(
      (inc) => inc.signature === signature && inc.status !== 'resolved'
    );

    if (existing) {
      existing.lastOccurredAt = nowIso;
      existing.occurrences++;
      existing.message = params.message;
      if (params.autoRecovered) {
        existing.recoveryAttempts++;
        existing.status = 'resolved';
        existing.resolvedAt = nowIso;
        existing.lastRecoveryResult = params.recoveryResult || 'Recovered automatically';
        return {
          incident: existing,
          shouldNotifyOwner: existing.severity === 'critical',
          notifyReason: 'recovered',
        };
      }
      existing.recoveryAttempts++;
      if (existing.occurrences >= 3 && existing.status !== 'escalated') {
        existing.status = 'escalated';
        existing.severity = 'critical';
        existing.lastRecoveryResult = `Automatic recovery failed after ${existing.occurrences} occurrences — human review recommended.`;
        const shouldNotify = !existing.notifiedAt;
        if (shouldNotify) existing.notifiedAt = nowIso;
        return { incident: existing, shouldNotifyOwner: shouldNotify, notifyReason: 'escalated' };
      }
      // Already tracked & grouped — do NOT send duplicate alerts every minute!
      return { incident: existing, shouldNotifyOwner: false };
    }

    const next: OperationalIncident = {
      id: `inc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      signature,
      component: params.component,
      errorType: params.errorType,
      severity: params.severity,
      message: params.message,
      firstOccurredAt: nowIso,
      lastOccurredAt: nowIso,
      occurrences: 1,
      status: params.autoRecovered ? 'resolved' : 'open',
      recoveryAttempts: params.autoRecovered ? 1 : 0,
      lastRecoveryResult: params.autoRecovered
        ? params.recoveryResult || 'Recovered automatically'
        : null,
      notifiedAt: params.severity === 'critical' && !params.autoRecovered ? nowIso : null,
      resolvedAt: params.autoRecovered ? nowIso : null,
    };

    state.incidents.unshift(next);
    const shouldNotifyOwner = params.severity === 'critical' && !params.autoRecovered;
    return {
      incident: next,
      shouldNotifyOwner,
      notifyReason: shouldNotifyOwner ? 'new_critical' : undefined,
    };
  }

  function resolveComponentIncidents(
    state: PersistedWorkerState,
    component: string,
    recoveryNote: string
  ): OperationalIncident[] {
    const nowIso = new Date().toISOString();
    const resolvedCritical: OperationalIncident[] = [];
    for (const inc of state.incidents) {
      if (inc.component === component && inc.status !== 'resolved') {
        const wasCritical = inc.severity === 'critical' || inc.status === 'escalated';
        inc.status = 'resolved';
        inc.resolvedAt = nowIso;
        inc.lastRecoveryResult = recoveryNote;
        if (wasCritical) {
          resolvedCritical.push(inc);
        }
      }
    }
    return resolvedCritical;
  }

  /**
   * Pre-flight Dependency, Configuration & Storage Validation (Section 13B)
   */
  function runPreflightCheck(): { ok: boolean; message: string } {
    try {
      ensureRuntimeDataDir();
      const dataDir = path.join(runtimeBaseDir, 'data');
      const probePath = path.join(dataDir, `.preflight_${process.pid}_${Date.now()}.tmp`);
      fs.writeFileSync(probePath, 'ok', 'utf8');
      fs.unlinkSync(probePath);
      const nodeMajor = Number(process.versions.node.split('.')[0]);
      if (!Number.isFinite(nodeMajor) || nodeMajor < 18) {
        return { ok: false, message: `Unsupported Node.js version: ${process.versions.node} (requires >=18)` };
      }
      return { ok: true, message: `Node v${process.versions.node} + writable atomic data storage verified` };
    } catch (err: any) {
      return {
        ok: false,
        message: `Storage/environment preflight failed: ${err?.message || String(err)}`,
      };
    }
  }

  function recoverOnBoot(): void {
    const state = loadState();
    const nowMs = Date.now();
    if (state.activeLock) {
      const lockExpired = Date.parse(state.activeLock.expiresAt) <= nowMs;
      const fromPreviousProcess = state.activeLock.pid !== process.pid;
      if (lockExpired || fromPreviousProcess) {
        const staleId = state.activeLock.runId;
        state.activeLock = null;
        recordGroupedIncident(state, {
          component: 'worker:execution_lock',
          message: `Recovered stale execution lock (${staleId}) after worker restart.`,
          errorType: 'temporary',
          severity: 'warning',
          autoRecovered: true,
          recoveryResult: 'Cleared stale lock and resumed 1-minute schedule',
        });
        appendAuditLog({
          action: 'autonomous_discovery_lock_recovered',
          actorEmail: 'system_worker',
          targetType: 'autonomous_discovery',
          summary: `Recovered stale execution lock (${staleId}) after server restart/timeout.`,
          severity: 'warning',
        });
      }
    }

    // Recover any queued crawler tasks interrupted mid-flight
    const crawlerRecovery = webCrawler.recoverInterruptedTasksOnBoot();
    if (crawlerRecovery.recoveredTasks > 0 || crawlerRecovery.recoveredFromBackup) {
      recordGroupedIncident(state, {
        component: 'crawler:queue_recovery',
        message:
          crawlerRecovery.recoveryNote ||
          `Recovered ${crawlerRecovery.recoveredTasks} queued crawler task(s) after restart.`,
        errorType: 'temporary',
        severity: 'warning',
        autoRecovered: true,
        recoveryResult: `Re-queued ${crawlerRecovery.recoveredTasks} unfinished task(s)`,
      });
    }

    const preflight = runPreflightCheck();
    state.lastPreflightOk = preflight.ok;
    state.lastPreflightMessage = preflight.message;
    recomputeLiveCountsIntoState(state);
    saveState(state);
  }

  function recomputeLiveCountsIntoState(state: PersistedWorkerState): {
    ownerEval: BranchManagerJobsSearchResponse;
    globalActiveCount: number;
    globalVerifiedCount: number;
    prVerifiedCount: number;
    globalRejectedCount: number;
  } {
    const globalStore = globalOpportunitiesController.loadStore();
    const globalOpps = Array.isArray(globalStore.international_opportunities)
      ? globalStore.international_opportunities
      : [];
    const globalActive = globalOpps.filter((o) => !o.isArchived && o.hasVerifiedBadge);
    const globalVerified = globalActive.filter((o) => o.verificationTier === 'VERIFIED');
    const prPathways = Array.isArray(globalStore.permanent_residency_pathways)
      ? globalStore.permanent_residency_pathways
      : [];
    const prVerified = prPathways.filter((p) => p.verificationTier === 'VERIFIED');
    const latestGlobalLog = globalStore.discovery_job_logs?.[0];
    const globalRejectedCount =
      Number(latestGlobalLog?.rejectedUnderThreeDaysCount || 0) +
      Number(latestGlobalLog?.rejectedBrokenOrClosedCount || 0) +
      Number(latestGlobalLog?.rejectedDueToVisaCount || 0) +
      Number(latestGlobalLog?.rejectedDueToProfessionalRestrictionCount || 0);

    const ownerEval = branchManagerController.evaluateForOwner();
    const audit = ownerEval.audit;
    const branchRejectedCount =
      Number(audit.excludedOutsideAllowedRegions || 0) +
      Number(audit.excludedLocalAfricanNonInternational || 0) +
      Number(audit.excludedUndisclosedSalary || 0) +
      Number(audit.excludedBelow3000Usd || 0) +
      Number(audit.excludedUnconfirmedVisaSponsorship || 0) +
      Number(audit.excludedEthiopianIneligible || 0) +
      Number(audit.excludedNonMatchingRole || 0) +
      Number(audit.excludedExpiredOrDuplicate || 0);

    const crawlerMetrics = webCrawler.getMetricsSummary().summary;

    state.counts = {
      opportunitiesDiscovered:
        globalOpps.length + audit.totalCandidatesScanned + crawlerMetrics.opportunitiesExtracted,
      opportunitiesVerified:
        globalActive.length + ownerEval.jobs.length + crawlerMetrics.opportunitiesPublished,
      opportunitiesRejected:
        globalRejectedCount +
        branchRejectedCount +
        crawlerMetrics.opportunitiesRejected +
        crawlerMetrics.opportunitiesExpired,
      newMatchingOpportunities: state.recentNotifications.length,
      globalVerifiedCount: globalVerified.length,
      globalActiveCount: globalActive.length,
      prCountriesVerifiedCount: prVerified.length,
      visa3kVerifiedCount: ownerEval.jobs.length,
      visa3kAuditedCount: audit.totalCandidatesScanned,
    };

    return {
      ownerEval,
      globalActiveCount: globalActive.length,
      globalVerifiedCount: globalVerified.length,
      prVerifiedCount: prVerified.length,
      globalRejectedCount,
    };
  }

  async function pollSingleFastSource(
    src: ApprovedSourceDefinition
  ): Promise<{
    ok: boolean;
    rateLimited?: boolean;
    retryAfterSec?: number;
    errorType?: 'temporary' | 'permanent';
    error?: string;
    scannedCount: number;
    newlyAdded: number;
    duplicatesSkipped: number;
  }> {
    if (src.kind === 'greenhouse' && src.slug && src.employerName) {
      const url = `https://boards-api.greenhouse.io/v1/boards/${src.slug}/jobs?content=true`;
      const res = await fetchJsonWithRetryAndRateLimit(url, 8000, 1);
      if (!res.ok) {
        return {
          ok: false,
          rateLimited: res.rateLimited,
          retryAfterSec: res.retryAfterSec,
          errorType: res.errorType,
          error: res.error,
          scannedCount: 0,
          newlyAdded: 0,
          duplicatesSkipped: 0,
        };
      }
      const jobs = Array.isArray(res.data?.jobs) ? res.data.jobs : [];
      const incoming: RawDiscoveredBranchJob[] = [];
      for (const j of jobs) {
        const jobUrl = String(j.absolute_url || '').trim();
        if (!jobUrl.startsWith('https://')) continue;
        incoming.push({
          id: `bm_gh_${src.slug}_${j.id || crypto.randomBytes(4).toString('hex')}`,
          title: String(j.title || '').trim(),
          employerName: src.employerName,
          employerTypeHint: src.employerType,
          isInternationalEmployerVerified: true,
          locationRaw: String(j.location?.name || '').trim(),
          descriptionText: String(j.content || ''),
          applicationUrl: jobUrl,
          sourcePortal: src.name,
          datePosted: typeof j.updated_at === 'string' ? j.updated_at.slice(0, 10) : undefined,
        });
      }
      const merged = branchManagerController.mergeIncrementalCandidates({
        sourceLabel: src.name,
        idPrefix: `bm_gh_${src.slug}_`,
        incomingCandidates: incoming,
      });
      return {
        ok: true,
        scannedCount: jobs.length,
        newlyAdded: merged.newlyAdded,
        duplicatesSkipped: merged.duplicatesSkipped,
      };
    }

    if (src.kind === 'ashby' && src.slug && src.employerName) {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${src.slug}?includeCompensation=true`;
      const res = await fetchJsonWithRetryAndRateLimit(url, 8000, 1);
      if (!res.ok) {
        return {
          ok: false,
          rateLimited: res.rateLimited,
          retryAfterSec: res.retryAfterSec,
          errorType: res.errorType,
          error: res.error,
          scannedCount: 0,
          newlyAdded: 0,
          duplicatesSkipped: 0,
        };
      }
      const jobs = Array.isArray(res.data?.jobs) ? res.data.jobs : [];
      const incoming: RawDiscoveredBranchJob[] = [];
      for (const j of jobs) {
        const jobUrl = String(j.jobUrl || j.applyUrl || '').trim();
        if (!jobUrl.startsWith('https://')) continue;
        const compSummary =
          j.compensation?.compensationTierSummary ||
          j.compensation?.summaryComponents?.map((c: any) => c.label).join(' ') ||
          '';
        incoming.push({
          id: `bm_ash_${src.slug}_${j.id || crypto.randomBytes(4).toString('hex')}`,
          title: String(j.title || '').trim(),
          employerName: src.employerName,
          employerTypeHint: src.employerType,
          isInternationalEmployerVerified: true,
          locationRaw: String(j.location || j.address?.postalAddress?.addressCountry || '').trim(),
          descriptionText: String(j.descriptionPlain || j.descriptionHtml || ''),
          compensationRaw: compSummary ? `Base salary: ${compSummary}` : '',
          applicationUrl: jobUrl,
          sourcePortal: src.name,
          datePosted: typeof j.publishedAt === 'string' ? j.publishedAt.slice(0, 10) : undefined,
        });
      }
      const merged = branchManagerController.mergeIncrementalCandidates({
        sourceLabel: src.name,
        idPrefix: `bm_ash_${src.slug}_`,
        incomingCandidates: incoming,
      });
      return {
        ok: true,
        scannedCount: jobs.length,
        newlyAdded: merged.newlyAdded,
        duplicatesSkipped: merged.duplicatesSkipped,
      };
    }

    if (src.kind === 'arbeitnow') {
      const res = await fetchJsonWithRetryAndRateLimit(
        'https://www.arbeitnow.com/api/job-board-api',
        8000,
        1
      );
      if (!res.ok) {
        return {
          ok: false,
          rateLimited: res.rateLimited,
          retryAfterSec: res.retryAfterSec,
          errorType: res.errorType,
          error: res.error,
          scannedCount: 0,
          newlyAdded: 0,
          duplicatesSkipped: 0,
        };
      }
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      const incoming: RawDiscoveredBranchJob[] = [];
      for (const j of list) {
        const jobUrl = String(j.url || '').trim();
        if (!jobUrl.startsWith('https://')) continue;
        const desc = String(j.description || '');
        const tags = Array.isArray(j.tags) ? j.tags.join(' ') : '';
        incoming.push({
          id: `bm_arb_${j.slug || crypto.randomBytes(4).toString('hex')}`,
          title: String(j.title || '').trim(),
          employerName: String(j.company_name || 'European Employer').trim(),
          locationRaw: `${String(j.location || '')} Germany Europe`.trim(),
          countryHint: 'Germany',
          descriptionText: `${desc}\nTags: ${tags}`,
          applicationUrl: jobUrl,
          sourcePortal: 'Arbeitnow Europe',
          datePosted:
            typeof j.created_at === 'number'
              ? new Date(j.created_at * 1000).toISOString().slice(0, 10)
              : undefined,
        });
      }
      const merged = branchManagerController.mergeIncrementalCandidates({
        sourceLabel: 'Arbeitnow Europe Live Board',
        idPrefix: 'bm_arb_',
        incomingCandidates: incoming,
      });
      return {
        ok: true,
        scannedCount: list.length,
        newlyAdded: merged.newlyAdded,
        duplicatesSkipped: merged.duplicatesSkipped,
      };
    }

    if (src.kind === 'fx') {
      const fx = await fetchLiveFxRates();
      const merged = branchManagerController.mergeIncrementalCandidates({
        sourceLabel: 'Hopeland Verified Global Store (UN, World Bank, AfDB, ReliefWeb, EU Portals)',
        idPrefix: 'bm_store_',
        incomingCandidates: branchManagerController
          .loadExistingGlobalOpps()
          .filter(
            (opp: any) =>
              !opp.isArchived &&
              opp.applicationStatus !== 'expired' &&
              opp.applicationStatus !== 'closed'
          )
          .map((opp: any) => ({
            id: `bm_store_${opp.id}`,
            title: opp.title,
            employerName: opp.organization,
            locationRaw: `${opp.location || ''} ${opp.country || ''}`.trim(),
            countryHint: opp.country,
            descriptionText: [
              opp.summary || '',
              opp.funding?.fundingSummary || '',
              opp.funding?.visaSupportSummary || '',
              opp.eligibility?.educationRequirement || '',
              opp.eligibility?.experienceRequirement || '',
              (opp.eligibility?.languagesRequired || []).join(', '),
            ].join('\n'),
            compensationRaw: opp.funding?.stipendOrSalary || opp.funding?.fundingSummary || '',
            applicationUrl: opp.officialApplicationUrl || opp.originalSourceUrl || '',
            sourcePortal: opp.sourceName || 'Verified Official Portal',
            datePosted: opp.publicationDate || opp.discoveredAt?.slice(0, 10),
            applicationDeadline:
              opp.deadline?.deadlineUtcIso?.slice(0, 10) || opp.deadline?.deadlineDateRaw,
            explicitVisaNote: opp.funding?.visaSupportSummary || '',
            ethiopianEligibleHint: opp.eligibility?.ethiopianEligible,
          })),
        fxUpdate: fx,
      });
      return {
        ok: true,
        scannedCount: merged.totalCandidates,
        newlyAdded: merged.newlyAdded,
        duplicatesSkipped: merged.duplicatesSkipped,
      };
    }

    return {
      ok: false,
      errorType: 'permanent',
      error: `Unsupported source kind: ${src.kind}`,
      scannedCount: 0,
      newlyAdded: 0,
      duplicatesSkipped: 0,
    };
  }

  function selectSourcesForThisMinute(
    state: PersistedWorkerState,
    nowMs: number
  ): ApprovedSourceDefinition[] {
    const isAllowedNow = (s: ApprovedSourceDefinition): boolean => {
      const h = state.sources[s.id];
      if (!h) return true;
      if (h.backoffUntil && Date.parse(h.backoffUntil) > nowMs) return false;
      if (!h.nextAllowedPollAt) return true;
      return Date.parse(h.nextAllowedPollAt) <= nowMs;
    };

    const fastDue = approvedSources
      .filter((s) => s.kind !== 'global_6dept' && isAllowedNow(s))
      .sort((a, b) => {
        const aTime = state.sources[a.id]?.lastPolledAt
          ? Date.parse(state.sources[a.id].lastPolledAt!)
          : 0;
        const bTime = state.sources[b.id]?.lastPolledAt
          ? Date.parse(state.sources[b.id].lastPolledAt!)
          : 0;
        return aTime - bTime;
      });

    if (fastDue.length > 0) {
      return fastDue.slice(0, 3);
    }

    const globalSweep = approvedSources.find((s) => s.kind === 'global_6dept');
    if (globalSweep && isAllowedNow(globalSweep)) {
      return [globalSweep];
    }

    const oldestFast = approvedSources
      .filter((s) => {
        if (s.kind === 'global_6dept') return false;
        const h = state.sources[s.id];
        if (h?.backoffUntil && Date.parse(h.backoffUntil) > nowMs) return false;
        const ageMs = h?.lastPolledAt ? nowMs - Date.parse(h.lastPolledAt) : Infinity;
        return ageMs >= 90_000;
      })
      .sort((a, b) => {
        const aTime = state.sources[a.id]?.lastPolledAt
          ? Date.parse(state.sources[a.id].lastPolledAt!)
          : 0;
        const bTime = state.sources[b.id]?.lastPolledAt
          ? Date.parse(state.sources[b.id].lastPolledAt!)
          : 0;
        return aTime - bTime;
      });

    return oldestFast.slice(0, 1);
  }

  async function runOneMinuteCycle(
    trigger: AutonomousCycleRecord['trigger'],
    options?: { includeGlobalSweepIfDue?: boolean; crawlerMaxTasks?: number; skipFastBoards?: boolean }
  ): Promise<AutonomousCycleRecord> {
    const startedMs = Date.now();
    const startedAt = new Date(startedMs).toISOString();
    const cycleId = `auto1m_${startedMs}_${crypto.randomBytes(3).toString('hex')}`;

    const preState = loadState();
    const activePersistedLock =
      preState.activeLock && Date.parse(preState.activeLock.expiresAt) > startedMs;

    if (isCycleInFlight || activePersistedLock) {
      const nextIso = new Date(startedMs + intervalMs).toISOString();
      const skippedRecord: AutonomousCycleRecord = {
        cycleId,
        trigger,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        status: 'skipped_overlap',
        sourcesPolled: [],
        candidatesScanned: 0,
        newlyDiscovered: 0,
        verifiedCount: preState.counts.opportunitiesVerified,
        rejectedCount: preState.counts.opportunitiesRejected,
        duplicatesSkipped: 0,
        newMatchingCount: 0,
        error: `Skipped overlapping trigger: previous cycle (${preState.activeLock?.runId || 'in-flight'}) still running.`,
      };
      preState.totalSkippedOverlaps = (preState.totalSkippedOverlaps || 0) + 1;
      preState.nextScheduledSearchAt = nextIso;
      preState.nextScheduledSearchAtEat = formatEthiopiaDateTime(nextIso);
      preState.cycleHistory.unshift(skippedRecord);
      saveState(preState);
      return skippedRecord;
    }

    isCycleInFlight = true;
    const state = loadState();

    // Pre-flight validation before running discovery
    const preflight = runPreflightCheck();
    state.lastPreflightOk = preflight.ok;
    state.lastPreflightMessage = preflight.message;
    if (!preflight.ok) {
      isCycleInFlight = false;
      const failIso = new Date().toISOString();
      const incResult = recordGroupedIncident(state, {
        component: 'worker:preflight',
        message: preflight.message,
        errorType: 'permanent',
        severity: 'critical',
      });
      state.lastCycleAt = failIso;
      state.lastCycleStatus = 'failed';
      state.lastFailedSearchAt = failIso;
      state.lastFailedSearchAtEat = formatEthiopiaDateTime(failIso);
      state.lastError = preflight.message;
      state.consecutiveFailures++;
      saveState(state);
      if (incResult.shouldNotifyOwner) {
        pushAdminNotification({
          type: `incident_${incResult.incident.signature}`,
          title: 'HopelandJobs Autonomous Discovery Preflight Failure',
          message: preflight.message,
          severity: 'critical',
        });
      }
      return {
        cycleId,
        trigger,
        startedAt,
        finishedAt: failIso,
        durationMs: Date.now() - startedMs,
        status: 'failed',
        sourcesPolled: [],
        candidatesScanned: 0,
        newlyDiscovered: 0,
        verifiedCount: state.counts.opportunitiesVerified,
        rejectedCount: state.counts.opportunitiesRejected,
        duplicatesSkipped: 0,
        newMatchingCount: 0,
        error: preflight.message,
      };
    }

    state.activeLock = {
      runId: cycleId,
      trigger,
      pid: process.pid,
      startedAt,
      expiresAt: new Date(startedMs + LOCK_TTL_MS).toISOString(),
    };
    saveState(state);

    const sourcesPolled: string[] = [];
    const cycleErrors: string[] = [];
    const incidentsToNotify: Array<{ title: string; message: string; severity: 'info' | 'warning' | 'critical' }> = [];
    let succeededCount = 0;
    let failedCount = 0;
    let candidatesScanned = 0;
    let duplicatesSkipped = 0;
    let newlyDiscoveredRaw = 0;
    let crawlerPagesProcessed = 0;
    let crawlerNewDomainsFound = 0;
    let crawlerOpportunitiesExtracted = 0;

    try {
      // PHASE A: Independent Public-Web Crawler Batch (Sitemaps, RSS/Atom, HTML Link-Following, JSON-LD, Archive CDX)
      const crawlRes = await webCrawler.runIncrementalCrawlBatch({
        maxTasks: options?.crawlerMaxTasks ?? 3,
      });
      crawlerPagesProcessed = crawlRes.pagesProcessed;
      crawlerNewDomainsFound = crawlRes.newDomainsDiscovered.length;
      crawlerOpportunitiesExtracted = crawlRes.opportunitiesExtracted;
      succeededCount += crawlRes.tasksSucceeded;
      failedCount += crawlRes.tasksFailed;
      candidatesScanned += crawlRes.opportunitiesExtracted;
      duplicatesSkipped += crawlRes.duplicatesPrevented;
      newlyDiscoveredRaw += crawlRes.newPagesDiscovered;

      if (crawlRes.pagesProcessed > 0) {
        sourcesPolled.push(`Public Web Crawler (${crawlRes.pagesProcessed} pages, +${crawlRes.newDomainsDiscovered.length} new domains)`);
      }

      if (crawlRes.publishedBranchCandidates.length > 0) {
        branchManagerController.mergeIncrementalCandidates({
          sourceLabel: 'Autonomous Public Web Crawler',
          idPrefix: 'bm_web_',
          incomingCandidates: crawlRes.publishedBranchCandidates,
        });
      }

      for (const cErr of crawlRes.errors) {
        cycleErrors.push(`${cErr.component}: ${cErr.message}`);
        const incOut = recordGroupedIncident(state, {
          component: cErr.component,
          message: cErr.message,
          errorType: cErr.errorType,
          severity: 'warning',
        });
        if (incOut.shouldNotifyOwner) {
          incidentsToNotify.push({
            title: `Crawler Incident Escalated (${cErr.domain})`,
            message: `${cErr.message} (${incOut.incident.occurrences} occurrences). Other sources continue unaffected.`,
            severity: 'warning',
          });
        }
      }

      // PHASE B: Structured Approved Official Employer Career Boards & Global Portals (Rate-Limit Safe Rotation)
      if (!options?.skipFastBoards) {
        const dueSources = selectSourcesForThisMinute(state, startedMs);
        const selected =
          options?.includeGlobalSweepIfDue === false
            ? dueSources.filter((s) => s.kind !== 'global_6dept')
            : dueSources;

        for (const src of selected) {
          const pollNowMs = Date.now();
          const pollNowIso = new Date(pollNowMs).toISOString();
          sourcesPolled.push(src.name);

          if (src.kind === 'global_6dept') {
            try {
              const log = await globalOpportunitiesController.runFullOfficialDiscovery(
                'server_interval',
                {
                  scheduledSlotEat: formatEthiopiaDateTime(pollNowMs) || pollNowIso,
                  attemptNumber: 1,
                  maxAttempts: 1,
                }
              );
              const srcState = state.sources[src.id];
              srcState.lastPolledAt = pollNowIso;
              srcState.nextAllowedPollAt = new Date(
                pollNowMs + src.minPollIntervalSec * 1000
              ).toISOString();
              srcState.lastItemCount = Number(log?.candidatesDiscovered || 0);
              candidatesScanned += Number(log?.candidatesDiscovered || 0);
              duplicatesSkipped += Number(log?.duplicatesSkipped || 0);

              if (log?.status === 'failed') {
                failedCount++;
                srcState.lastStatus = 'error';
                srcState.consecutiveErrors = (srcState.consecutiveErrors || 0) + 1;
                srcState.lastError = (log.errors || ['Global discovery failed']).slice(0, 2).join('; ');
                srcState.backoffUntil = new Date(pollNowMs + 600 * 1000).toISOString();
                cycleErrors.push(`${src.name}: ${srcState.lastError}`);
                recordGroupedIncident(state, {
                  component: `source:${src.id}`,
                  message: srcState.lastError || 'Global discovery failed',
                  errorType: 'temporary',
                  severity: 'warning',
                });
              } else {
                succeededCount++;
                srcState.lastStatus = 'ok';
                srcState.consecutiveErrors = 0;
                srcState.lastError = null;
                srcState.backoffUntil = null;
                const resolved = resolveComponentIncidents(
                  state,
                  `source:${src.id}`,
                  'Global 6-department sweep succeeded'
                );
                for (const r of resolved) {
                  incidentsToNotify.push({
                    title: `Recovered: ${src.name}`,
                    message: `Previously escalated incident (${r.message}) has automatically recovered.`,
                    severity: 'info',
                  });
                }
              }
            } catch (err: any) {
              failedCount++;
              const msg = err?.message || String(err);
              const srcState = state.sources[src.id];
              srcState.lastPolledAt = pollNowIso;
              srcState.lastStatus = 'error';
              srcState.consecutiveErrors = (srcState.consecutiveErrors || 0) + 1;
              srcState.lastError = msg;
              srcState.backoffUntil = new Date(pollNowMs + 600 * 1000).toISOString();
              cycleErrors.push(`${src.name}: ${msg}`);
              recordGroupedIncident(state, {
                component: `source:${src.id}`,
                message: msg,
                errorType: 'temporary',
                severity: 'warning',
              });
            }
            continue;
          }

          const res = await pollSingleFastSource(src);
          const srcState = state.sources[src.id];
          srcState.lastPolledAt = pollNowIso;
          srcState.nextAllowedPollAt = new Date(
            pollNowMs + src.minPollIntervalSec * 1000
          ).toISOString();

          if (res.ok) {
            succeededCount++;
            candidatesScanned += res.scannedCount;
            newlyDiscoveredRaw += res.newlyAdded;
            duplicatesSkipped += res.duplicatesSkipped;
            srcState.lastStatus = 'ok';
            srcState.lastItemCount = res.scannedCount;
            srcState.consecutiveErrors = 0;
            srcState.lastError = null;
            srcState.backoffUntil = null;
            const resolved = resolveComponentIncidents(
              state,
              `source:${src.id}`,
              `${src.name} returned HTTP 200 (${res.scannedCount} listings)`
            );
            for (const r of resolved) {
              incidentsToNotify.push({
                title: `Recovered: ${src.name}`,
                message: `Source recovered automatically after previous failure (${r.message}).`,
                severity: 'info',
              });
            }
          } else {
            failedCount++;
            srcState.consecutiveErrors = (srcState.consecutiveErrors || 0) + 1;
            srcState.lastError = res.error || 'Request failed';
            if (res.rateLimited) {
              srcState.lastStatus = 'rate_limited';
              srcState.backoffUntil = new Date(
                pollNowMs + (res.retryAfterSec || 600) * 1000
              ).toISOString();
            } else {
              srcState.lastStatus = 'error';
              const backoffSec = Math.min(
                3600,
                180 * Math.pow(2, Math.min(4, srcState.consecutiveErrors - 1))
              );
              srcState.backoffUntil = new Date(pollNowMs + backoffSec * 1000).toISOString();
            }
            cycleErrors.push(`${src.name}: ${srcState.lastError}`);
            const incOut = recordGroupedIncident(state, {
              component: `source:${src.id}`,
              message: srcState.lastError,
              errorType: res.errorType || 'temporary',
              severity: 'warning',
            });
            if (incOut.shouldNotifyOwner) {
              incidentsToNotify.push({
                title: `Source Repeated Failure: ${src.name}`,
                message: `${srcState.lastError} (${incOut.incident.occurrences} occurrences). Temporarily paused while other sources continue.`,
                severity: 'warning',
              });
            }
          }
        }
      }

      // PHASE C: Evaluate against Saved Owner Profile ONLY, Deduplicate, and Notify Only on Genuinely New Matches
      const nowEndIso = new Date().toISOString();
      const { ownerEval } = recomputeLiveCountsIntoState(state);

      const newlyDetectedMatches: AutonomousNewMatchNotification[] = [];
      const isInitialBaselineSeed = !state.baselineSeeded;

      for (const job of ownerEval.jobs) {
        const fp = makeFingerprint(
          'visa_3k',
          job.officialApplicationUrl,
          job.jobTitle,
          job.employerName
        );
        const existing = state.seenFingerprints[fp];
        if (!existing) {
          state.seenFingerprints[fp] = {
            firstSeenAt: nowEndIso,
            lastSeenAt: nowEndIso,
            stream: 'visa_3k',
            title: job.jobTitle,
            employer: job.employerName,
            notified: !isInitialBaselineSeed,
          };
          if (!isInitialBaselineSeed) {
            newlyDetectedMatches.push({
              id: `match_${fp}_${Date.now()}`,
              discoveredAt: nowEndIso,
              stream: 'visa_3k',
              title: job.jobTitle,
              employer: job.employerName,
              country: job.country,
              salaryDisplay: job.usdEquivalentDisplay || job.originalSalaryDisplay,
              matchScore: job.profileMatchPercentage,
              officialUrl: job.officialApplicationUrl,
              emailSent: false,
            });
          }
        } else {
          existing.lastSeenAt = nowEndIso;
        }
      }

      const globalStore = globalOpportunitiesController.loadStore();
      const activeBankingGlobal = (globalStore.international_opportunities || []).filter(
        (o) =>
          !o.isArchived &&
          o.hasVerifiedBadge &&
          o.verificationTier === 'VERIFIED' &&
          (o.department === 'banking_finance_jobs' ||
            /bank|finance|accounting|branch manager|credit|compliance|treasury/i.test(
              `${o.title} ${o.organization}`
            ))
      );

      for (const opp of activeBankingGlobal) {
        const fp = makeFingerprint(
          'global_opportunity',
          opp.officialApplicationUrl,
          opp.title,
          opp.organization
        );
        const existing = state.seenFingerprints[fp];
        if (!existing) {
          state.seenFingerprints[fp] = {
            firstSeenAt: nowEndIso,
            lastSeenAt: nowEndIso,
            stream: 'global_opportunity',
            title: opp.title,
            employer: opp.organization,
            notified: !isInitialBaselineSeed,
          };
          if (!isInitialBaselineSeed) {
            newlyDetectedMatches.push({
              id: `match_${fp}_${Date.now()}`,
              discoveredAt: nowEndIso,
              stream: 'global_opportunity',
              title: opp.title,
              employer: opp.organization,
              country: opp.country,
              salaryDisplay:
                opp.funding?.stipendOrSalary ||
                opp.funding?.fundingSummary ||
                'Verified International Role',
              matchScore: 82,
              officialUrl: opp.officialApplicationUrl,
              emailSent: false,
            });
          }
        } else {
          existing.lastSeenAt = nowEndIso;
        }
      }

      if (isInitialBaselineSeed) {
        state.baselineSeeded = true;
      }

      if (newlyDetectedMatches.length > 0) {
        const lines = newlyDetectedMatches.slice(0, 10).map(
          (m, idx) =>
            `${idx + 1}. ${m.title} — ${m.employer} (${m.country})\n` +
            `   Salary: ${m.salaryDisplay} | Profile Match: ${m.matchScore}%\n` +
            `   Official Link: ${m.officialUrl}`
        );
        const emailSent = await sendOwnerAlertEmailIfConfigured(
          `[HopelandJobs] ${newlyDetectedMatches.length} New Verified Matching Opportunity${newlyDetectedMatches.length > 1 ? 's' : ''} Found`,
          [
            `HopelandJobs 24/7 Autonomous Discovery found ${newlyDetectedMatches.length} new verified matching opportunity(ies) for your saved profile:`,
            '',
            ...lines,
            '',
            `Detected at: ${formatEthiopiaDateTime(Date.now())}`,
          ].join('\n')
        );
        for (const m of newlyDetectedMatches) {
          m.emailSent = emailSent;
        }
        state.recentNotifications = [...newlyDetectedMatches, ...state.recentNotifications].slice(
          0,
          MAX_NOTIFICATIONS
        );
        state.counts.newMatchingOpportunities = state.recentNotifications.length;

        const top = newlyDetectedMatches[0];
        pushAdminNotification({
          type: `new_autonomous_match_${top.id.slice(0, 14)}`,
          title: `${newlyDetectedMatches.length} New Verified Matching Opportunity Found`,
          message: `${top.title} at ${top.employer} (${top.country}) — ${top.salaryDisplay} (${top.matchScore}% match).`,
          severity: 'info',
        });
      }

      // Honest status evaluation
      const cycleStatus: AutonomousCycleStatus =
        succeededCount === 0 && failedCount > 0
          ? 'failed'
          : failedCount > 0
          ? 'partial'
          : 'success';

      const finishedMs = Date.now();
      const finishedAt = new Date(finishedMs).toISOString();
      const nextScheduledAt = new Date(finishedMs + intervalMs).toISOString();

      const record: AutonomousCycleRecord = {
        cycleId,
        trigger,
        startedAt,
        finishedAt,
        durationMs: finishedMs - startedMs,
        status: cycleStatus,
        sourcesPolled,
        candidatesScanned,
        newlyDiscovered: newlyDiscoveredRaw,
        verifiedCount: state.counts.opportunitiesVerified,
        rejectedCount: state.counts.opportunitiesRejected,
        duplicatesSkipped,
        newMatchingCount: newlyDetectedMatches.length,
        crawlerPagesProcessed,
        crawlerNewDomainsFound,
        crawlerOpportunitiesExtracted,
        error: cycleErrors.length > 0 ? cycleErrors.slice(0, 3).join(' | ') : null,
      };

      state.lastCycleAt = finishedAt;
      state.lastCycleStatus = cycleStatus;
      state.nextScheduledSearchAt = nextScheduledAt;
      state.nextScheduledSearchAtEat = formatEthiopiaDateTime(nextScheduledAt);
      state.totalCyclesCompleted = (state.totalCyclesCompleted || 0) + 1;

      if (cycleStatus === 'failed') {
        state.lastFailedSearchAt = finishedAt;
        state.lastFailedSearchAtEat = formatEthiopiaDateTime(finishedAt);
        state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
        state.lastError = record.error || 'All scheduled official sources failed in this cycle.';
        const critInc = recordGroupedIncident(state, {
          component: 'worker:discovery_cycle',
          message: state.lastError,
          errorType: 'temporary',
          severity: state.consecutiveFailures >= 3 ? 'critical' : 'warning',
        });
        if (critInc.shouldNotifyOwner) {
          incidentsToNotify.push({
            title: 'Autonomous Discovery Engine Critical Incident',
            message: `${state.consecutiveFailures} consecutive discovery cycles failed. Last error: ${state.lastError}`,
            severity: 'critical',
          });
        }
      } else {
        const recoveredEngine = resolveComponentIncidents(
          state,
          'worker:discovery_cycle',
          `Discovery cycle succeeded (${sourcesPolled.length} source batches processed)`
        );
        for (const r of recoveredEngine) {
          incidentsToNotify.push({
            title: 'HopelandJobs Discovery Engine Recovered',
            message: `Autonomous discovery recovered automatically from: ${r.message}`,
            severity: 'info',
          });
        }
        state.lastSuccessfulSearchAt = finishedAt;
        state.lastSuccessfulSearchAtEat = formatEthiopiaDateTime(finishedAt);
        state.consecutiveFailures = 0;
        state.lastError = cycleErrors.length > 0 ? record.error : null;
      }

      // Send grouped incident notifications (never repetitive minute-by-minute spam!)
      for (const alert of incidentsToNotify) {
        pushAdminNotification({
          type: `ops_${crypto.createHash('sha256').update(alert.title).digest('hex').slice(0, 12)}`,
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
        });
        if (alert.severity === 'critical' || alert.title.startsWith('Recovered:')) {
          await sendOwnerAlertEmailIfConfigured(
            `[HopelandJobs Ops] ${alert.title}`,
            `${alert.message}\n\nTime (EAT): ${formatEthiopiaDateTime(Date.now())}`
          );
        }
      }

      // Merge any skipped_overlap counters/history recorded while this cycle was in flight
      const latestDisk = loadState();
      state.totalSkippedOverlaps = Math.max(
        state.totalSkippedOverlaps || 0,
        latestDisk.totalSkippedOverlaps || 0
      );
      const existingIds = new Set(state.cycleHistory.map((c) => c.cycleId));
      const inFlightSkips = latestDisk.cycleHistory.filter(
        (c) => c.status === 'skipped_overlap' && !existingIds.has(c.cycleId)
      );
      state.activeLock = null;
      state.cycleHistory = [record, ...inFlightSkips, ...state.cycleHistory];
      saveState(state);

      return record;
    } catch (err: any) {
      const finishedMs = Date.now();
      const finishedAt = new Date(finishedMs).toISOString();
      const nextScheduledAt = new Date(finishedMs + intervalMs).toISOString();
      const errMsg = err?.message || String(err);

      const failRecord: AutonomousCycleRecord = {
        cycleId,
        trigger,
        startedAt,
        finishedAt,
        durationMs: finishedMs - startedMs,
        status: 'failed',
        sourcesPolled,
        candidatesScanned,
        newlyDiscovered: newlyDiscoveredRaw,
        verifiedCount: state.counts.opportunitiesVerified,
        rejectedCount: state.counts.opportunitiesRejected,
        duplicatesSkipped,
        newMatchingCount: 0,
        error: errMsg,
      };

      const errState = loadState();
      errState.activeLock = null;
      errState.lastCycleAt = finishedAt;
      errState.lastCycleStatus = 'failed';
      errState.lastFailedSearchAt = finishedAt;
      errState.lastFailedSearchAtEat = formatEthiopiaDateTime(finishedAt);
      errState.lastError = errMsg;
      errState.consecutiveFailures = (errState.consecutiveFailures || 0) + 1;
      errState.nextScheduledSearchAt = nextScheduledAt;
      errState.nextScheduledSearchAtEat = formatEthiopiaDateTime(nextScheduledAt);
      recordGroupedIncident(errState, {
        component: 'worker:unhandled_exception',
        message: errMsg,
        errorType: 'temporary',
        severity: 'critical',
      });
      errState.cycleHistory.unshift(failRecord);
      saveState(errState);

      return failRecord;
    } finally {
      isCycleInFlight = false;
      try {
        const finalState = loadState();
        if (finalState.activeLock?.runId === cycleId) {
          finalState.activeLock = null;
          saveState(finalState);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  function scheduleNextTick(delayMs: number): void {
    if (stopped || isVercel || process.env.NODE_ENV === 'test') return;
    if (scheduledTimer) clearTimeout(scheduledTimer);

    const nextAtIso = new Date(Date.now() + delayMs).toISOString();
    try {
      const st = loadState();
      st.nextScheduledSearchAt = nextAtIso;
      st.nextScheduledSearchAtEat = formatEthiopiaDateTime(nextAtIso);
      saveState(st);
    } catch {
      // Non-fatal
    }

    scheduledTimer = setTimeout(async () => {
      if (stopped) return;
      try {
        await runOneMinuteCycle('internal_1min_worker');
      } catch (err: any) {
        console.warn('[AutonomousDiscovery 1-Min Worker] Cycle error:', err?.message || err);
      } finally {
        if (!stopped) {
          scheduleNextTick(intervalMs);
        }
      }
    }, delayMs);

    if (typeof scheduledTimer.unref === 'function') {
      scheduledTimer.unref();
    }
  }

  function buildPublicStatus(): AutonomousDiscoveryStatusResponse {
    const state = loadState();
    const sourceValues = Object.values(state.sources);
    const healthyCount = sourceValues.filter(
      (s) => s.lastStatus === 'ok' || s.lastStatus === 'idle'
    ).length;
    const degradedCount = sourceValues.filter(
      (s) => s.lastStatus === 'error' || s.lastStatus === 'rate_limited'
    ).length;
    const crawlerSummary = webCrawler.getMetricsSummary().summary;
    const openIncidentsCount = state.incidents.filter((i) => i.status !== 'resolved').length;

    return {
      success: true,
      engineMode: isVercel ? 'external_1min_scheduler' : 'continuous_1min_worker',
      intervalSeconds: state.intervalSeconds,
      isCurrentlyRunning:
        isCycleInFlight ||
        Boolean(state.activeLock && Date.parse(state.activeLock.expiresAt) > Date.now()),
      workerStartedAt: state.workerStartedAt,
      lastCycleAt: state.lastCycleAt,
      lastCycleStatus: state.lastCycleStatus,
      lastSuccessfulSearchAt: state.lastSuccessfulSearchAt,
      lastSuccessfulSearchAtEat: state.lastSuccessfulSearchAtEat,
      lastFailedSearchAt: state.lastFailedSearchAt,
      lastFailedSearchAtEat: state.lastFailedSearchAtEat,
      nextScheduledSearchAt: state.nextScheduledSearchAt,
      nextScheduledSearchAtEat: state.nextScheduledSearchAtEat,
      lastError: state.lastError,
      consecutiveFailures: state.consecutiveFailures,
      totalCyclesCompleted: state.totalCyclesCompleted,
      totalSkippedOverlaps: state.totalSkippedOverlaps,
      counts: state.counts,
      sourcesSummary: {
        totalApproved: sourceValues.length,
        healthyCount,
        rateLimitedOrDegradedCount: degradedCount,
      },
      crawlerSummary,
      openIncidentsCount,
      recentCycles: state.cycleHistory.slice(0, 10),
    };
  }

  function buildAdminTelemetry(): AdminAutonomousTelemetryResponse {
    const state = loadState();
    const crawlerData = webCrawler.getMetricsSummary();
    const openCritical = state.incidents.some(
      (i) => i.status !== 'resolved' && (i.severity === 'critical' || i.status === 'escalated')
    );
    const openWarning = state.incidents.some((i) => i.status !== 'resolved');

    const engineStatus: AdminAutonomousTelemetryResponse['engineStatus'] =
      state.consecutiveFailures >= 3 || openCritical
        ? 'failing'
        : state.consecutiveFailures > 0 || openWarning
        ? 'degraded'
        : state.totalCyclesCompleted > 0
        ? 'healthy'
        : 'idle';

    return {
      success: true,
      generatedAt: new Date().toISOString(),
      engineStatus,
      workerStatus: {
        mode: isVercel ? 'external_1min_scheduler' : 'continuous_1min_worker',
        running: !stopped && !isVercel,
        intervalSeconds: state.intervalSeconds,
        pid: process.pid,
        uptimeSeconds: Math.max(0, Math.floor((Date.now() - Date.parse(bootTimestampIso)) / 1000)),
        workerStartedAt: state.workerStartedAt,
        totalCyclesCompleted: state.totalCyclesCompleted,
        totalSkippedOverlaps: state.totalSkippedOverlaps,
        consecutiveFailures: state.consecutiveFailures,
        lastPreflightOk: state.lastPreflightOk,
        lastPreflightMessage: state.lastPreflightMessage,
      },
      schedule: {
        lastSuccessfulExecution: state.lastSuccessfulSearchAt,
        lastSuccessfulExecutionEat: state.lastSuccessfulSearchAtEat,
        lastFailedExecution: state.lastFailedSearchAt,
        lastFailedExecutionEat: state.lastFailedSearchAtEat,
        nextScheduledExecution: state.nextScheduledSearchAt,
        nextScheduledExecutionEat: state.nextScheduledSearchAtEat,
        githubBackupSchedule: '00:00, 06:00, 12:00, 18:00 EAT (GitHub Actions backup + workflow_dispatch)',
      },
      crawler: crawlerData.summary,
      combinedCounts: state.counts,
      pipelineBreakdown: crawlerData.pipelineBreakdown,
      recentDomains: crawlerData.recentDomains,
      activeQueueSample: crawlerData.activeQueueSample,
      recentWebOpportunities: crawlerData.recentOpportunities,
      incidents: state.incidents.slice(0, 40),
      recentCycles: state.cycleHistory.slice(0, 20),
      sources: Object.values(state.sources).map(({ backoffUntil: _b, ...rest }) => rest),
    };
  }

  // 1. Public read-only live status endpoint (sanitized — zero secrets, zero owner PII)
  app.get('/api/autonomous-discovery/status', (_req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(buildPublicStatus());
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Unable to load autonomous discovery status.',
      });
    }
  });

  // 2. Owner-only full operational monitoring telemetry for the Admin Dashboard (Section 8)
  app.get('/api/autonomous-discovery/admin-telemetry', (req: Request, res: Response) => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({
        success: false,
        error: 'Owner authentication required to access autonomous crawler operational telemetry.',
      });
      return;
    }
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(buildAdminTelemetry());
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Unable to load operational telemetry.',
      });
    }
  });

  // 3. External 1-minute scheduler webhook endpoint (for cron-job.org / Cloudflare Workers Cron / Cloud Scheduler)
  const handleExternalCronTick = async (req: Request, res: Response): Promise<void> => {
    const cronSecret = (process.env.CRON_SECRET || '').trim();
    const authHeader = String(req.headers.authorization || '').trim();
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const isVercelCron = String(req.headers['x-vercel-cron'] || '') === '1';
    const hasSecretMatch = Boolean(cronSecret && constantTimeSecretEqual(bearerToken, cronSecret));
    const isOwner = isPersistentOwnerRequest(req);

    if (!isVercelCron && !hasSecretMatch && !isOwner) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized autonomous discovery tick. Supply Authorization: Bearer <CRON_SECRET>.',
      });
      return;
    }

    try {
      const record = await runOneMinuteCycle('external_cron_webhook', {
        includeGlobalSweepIfDue: !isVercel,
        crawlerMaxTasks: isVercel ? 2 : 3,
      });
      const statusPayload = buildPublicStatus();
      const httpCode = record.status === 'failed' ? 500 : 200;
      res.status(httpCode).json({
        success: record.status !== 'failed',
        cycle: record,
        status: statusPayload,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Autonomous discovery tick failed.',
      });
    }
  };

  app.get('/api/cron/autonomous-tick', handleExternalCronTick);
  app.post('/api/cron/autonomous-tick', handleExternalCronTick);

  // 4. Strictly Owner-Only Manual Test Trigger
  app.post('/api/autonomous-discovery/trigger', async (req: Request, res: Response): Promise<void> => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({
        success: false,
        error: 'Owner authentication required to manually trigger an autonomous discovery cycle.',
      });
      return;
    }
    try {
      const record = await runOneMinuteCycle('manual_owner');
      res.status(record.status === 'failed' ? 500 : 200).json({
        success: record.status !== 'failed',
        cycle: record,
        status: buildPublicStatus(),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Manual autonomous discovery cycle failed.',
      });
    }
  });

  // 5. Strictly Owner-Only Personal New-Match Notifications Feed
  app.get('/api/autonomous-discovery/notifications', (req: Request, res: Response): void => {
    if (!isPersistentOwnerRequest(req)) {
      res.status(403).json({
        success: false,
        error: 'Owner authentication required to access personal match notifications.',
      });
      return;
    }
    const state = loadState();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      notifications: state.recentNotifications,
      totalCount: state.recentNotifications.length,
    });
  });

  // Recover stale locks, interrupted queue tasks, and corrupted snapshots on boot
  recoverOnBoot();

  const shouldAutoStart =
    deps.autoStartWorker !== false && !isVercel && process.env.NODE_ENV !== 'test';
  if (shouldAutoStart) {
    scheduleNextTick(6000);
    console.log(
      `[HopelandJobs Autonomous Discovery] Continuous ${intervalSeconds}s worker & independent public-web crawler armed (${approvedSources.length} structured sources + self-expanding web frontier, transactional .bak recovery & incident grouping active).`
    );
  }

  return {
    runOneMinuteCycle,
    buildPublicStatus,
    buildAdminTelemetry,
    loadState,
    webCrawler,
    stop() {
      stopped = true;
      if (scheduledTimer) {
        clearTimeout(scheduledTimer);
        scheduledTimer = null;
      }
    },
  };
}
