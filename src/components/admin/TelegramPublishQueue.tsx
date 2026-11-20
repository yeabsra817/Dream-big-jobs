import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  CheckSquare,
  Square,
  Sparkles,
  RefreshCw,
  FolderPlus,
  History,
  AlertTriangle,
  Play,
  ExternalLink,
  Search,
  Filter,
  Eye,
  Trash2,
  X,
  Building,
  Calendar,
  Layers,
  Check,
  FileUp,
  FileText,
  Upload,
} from 'lucide-react';
import {
  Vacancy,
  SiteSettings,
  TelegramBatchRecord,
  TelegramPostStatus,
  TelegramDistributionMode,
  OFFICIAL_CATEGORIES,
  DuplicateReportItem,
} from '../../types/job';
import {
  fetchTelegramBatches,
  saveTelegramBatch,
  deleteTelegramBatch,
} from '../../lib/firebase';
import { VacancyDetailModal } from '../VacancyDetailModal';
import {
  broadcastJobToTelegram,
  evaluateVacancyForTelegramClient,
  classifyVacancyBroadSectorClient,
  isWashNgoVacancyClient,
  isVacancyDeadlineExpiredClient,
  getTelegramDistributionModeLabel,
  normalizeTelegramChatId,
  verifyTelegramConnectionClient,
  fetchTelegramQueueStatusClient,
  startServerTelegramQueueClient,
  retryFailedServerQueueClient,
  cancelServerTelegramQueueClient,
  isFatalTelegramConfigError,
  ServerQueueStatusResponse,
  ChannelVerificationResult,
  DiscoveredTelegramChat,
} from '../../utils/telegramClient';
import { TelegramStatusPanel } from './TelegramStatusPanel';
import { validateVacancyStrict } from '../../utils/vacancyValidator';

interface Props {
  vacancies: Vacancy[];
  siteSettings: SiteSettings;
  onUpdateVacancy: (vacancy: Vacancy) => Promise<void>;
  onBatchUpdateVacancies?: (vacancies: Vacancy[]) => Promise<void>;
  onSaveSettings?: (settings: SiteSettings) => Promise<void>;
  initialSelectedIds?: string[];
}

export const TelegramPublishQueue: React.FC<Props> = ({
  vacancies,
  siteSettings,
  onUpdateVacancy,
  onBatchUpdateVacancies,
  onSaveSettings,
  initialSelectedIds,
}) => {
  // Selected IDs for batch actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedIds || [])
  );

  // Active status overrides during live queue execution (for immediate UI updates)
  const [inFlightJobId, setInFlightJobId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, { status: TelegramPostStatus; messageId?: number; postedAt?: string; error?: string }>
  >({});

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'posted' | 'failed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Preview Modal
  const [previewVacancy, setPreviewVacancy] = useState<Vacancy | null>(null);

  // Duplicate Warning Modal
  const [duplicateWarningJob, setDuplicateWarningJob] = useState<Vacancy | null>(null);

  // Batch Execution State
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const isBatchCancelledRef = useRef(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentTitle: string;
  } | null>(null);

  // Saved Batches & History Modal
  const [savedBatches, setSavedBatches] = useState<TelegramBatchRecord[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSaveBatchModalOpen, setIsSaveBatchModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [selectedHistoryBatch, setSelectedHistoryBatch] = useState<TelegramBatchRecord | null>(null);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Sub-tab inside Telegram Posting section: Live Queue vs Bulk Import (50+ Jobs)
  const [tgSectionTab, setTgSectionTab] = useState<'queue' | 'bulkImport'>('queue');
  const [batchPublishMode, setBatchPublishMode] = useState<TelegramDistributionMode>(
    siteSettings.telegramDistributionMode || 'all_jobs'
  );

  // Integrated Bulk Import (50+ Vacancies) Workflow State
  const [bulkRawText, setBulkRawText] = useState('');
  const [isBulkParsing, setIsBulkParsing] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkParsedVacancies, setBulkParsedVacancies] = useState<Vacancy[]>([]);
  const [bulkDuplicatesReport, setBulkDuplicatesReport] = useState<DuplicateReportItem[]>([]);
  const [bulkRejectedIncomplete, setBulkRejectedIncomplete] = useState<
    Array<{ id: string; title: string; organization: string; missingFields: string[] }>
  >([]);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSummaryStats, setBulkSummaryStats] = useState<{
    totalDetected: number;
    validCount: number;
    duplicatesSkipped: number;
    rejectedIncompleteCount: number;
    expiredCount: number;
    bankingCount: number;
    ngoCount: number;
    washCount: number;
    otherCount: number;
  } | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Feedback Notification
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Persistent Server Queue State (survives page refresh & server restarts)
  const [serverQueueStatus, setServerQueueStatus] = useState<ServerQueueStatusResponse | null>(null);
  const syncedQueueOutcomeRef = useRef<Set<string>>(new Set());

  // Channel Diagnostics & Quick Fixer
  const [channelCheckResult, setChannelCheckResult] = useState<ChannelVerificationResult | null>(null);
  const [isCheckingChannel, setIsCheckingChannel] = useState(false);
  const [showChannelFixer, setShowChannelFixer] = useState(false);
  const [manualChannelInput, setManualChannelInput] = useState(
    siteSettings.telegramChannelName || '@DreamBigJobsEthiopia'
  );
  const [isSavingChannelFix, setIsSavingChannelFix] = useState(false);

  const syncServerQueueStateToUi = async (data: ServerQueueStatusResponse | null) => {
    if (!data) return;
    setServerQueueStatus(data);

    const qs = data.queueState;
    if (qs?.items && qs.items.length > 0) {
      setStatusOverrides((prev) => {
        const next = { ...prev };
        for (const it of qs.items) {
          if (it.status === 'published') {
            next[it.vacancyId] = {
              status: 'success',
              messageId: it.telegramMessageId,
              postedAt: it.publishedAt,
            };
          } else if (it.status === 'failed') {
            next[it.vacancyId] = { status: 'failed', error: it.error };
          } else if (it.status === 'processing') {
            next[it.vacancyId] = { status: 'posting' };
          } else if (it.status === 'retrying') {
            next[it.vacancyId] = { status: 'retrying', error: it.error };
          }
        }
        return next;
      });

      const activeItem = qs.items.find((it) => it.status === 'processing' || it.status === 'retrying');
      if (activeItem) {
        setInFlightJobId(activeItem.vacancyId);
      } else {
        setInFlightJobId(null);
      }

      if (qs.status === 'running') {
        setIsBatchRunning(true);
        const done = (data.summary.published || 0) + (data.summary.failed || 0);
        setBatchProgress({
          current: Math.min(data.summary.total, done + (activeItem ? 1 : 0)),
          total: data.summary.total,
          currentTitle: activeItem
            ? `${activeItem.status === 'retrying' ? 'Retrying' : 'Posting'}: ${activeItem.title} — ${activeItem.organization}`
            : qs.currentTitle || 'Processing sequential Telegram queue...',
        });
      } else {
        setIsBatchRunning(false);
        setBatchProgress(null);
      }

      // Sync newly settled outcomes back to vacancy records once per outcome signature
      const updatesToPersist: Vacancy[] = [];
      for (const it of qs.items) {
        if (it.status !== 'published' && it.status !== 'failed') continue;
        const sig = `${it.vacancyId}:${it.status}:${it.telegramMessageId || ''}:${it.error || ''}`;
        if (syncedQueueOutcomeRef.current.has(sig)) continue;
        syncedQueueOutcomeRef.current.add(sig);

        const existing = vacancies.find((v) => v.id === it.vacancyId);
        if (!existing) continue;
        if (it.status === 'published' && (!existing.telegramPublished || existing.telegramMessageId !== it.telegramMessageId)) {
          updatesToPersist.push({
            ...existing,
            telegramPublished: true,
            telegramMessageId: it.telegramMessageId,
            telegramPublishedAt: it.publishedAt || new Date().toISOString(),
            telegramPublishError: '',
            status: 'published',
            publishedAt: existing.publishedAt || it.publishedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else if (it.status === 'failed' && !existing.telegramPublished && existing.telegramPublishError !== it.error) {
          updatesToPersist.push({
            ...existing,
            telegramPublishError: it.error || 'Telegram broadcast failed',
            updatedAt: new Date().toISOString(),
          });
        }
      }

      if (updatesToPersist.length > 0) {
        try {
          if (onBatchUpdateVacancies) {
            await onBatchUpdateVacancies(updatesToPersist);
          } else {
            for (const u of updatesToPersist) {
              await onUpdateVacancy(u);
            }
          }
        } catch {}
      }
    } else if (qs?.status !== 'running') {
      setIsBatchRunning(false);
      setBatchProgress(null);
      setInFlightJobId(null);
    }
  };

  const refreshQueueStatus = async () => {
    const data = await fetchTelegramQueueStatusClient();
    await syncServerQueueStateToUi(data);
  };

  useEffect(() => {
    refreshQueueStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (serverQueueStatus?.queueState?.status !== 'running') return;
    const timer = setInterval(() => {
      refreshQueueStatus();
    }, 1200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverQueueStatus?.queueState?.status]);

  useEffect(() => {
    if (siteSettings.telegramChannelName) {
      setManualChannelInput(siteSettings.telegramChannelName);
    }
  }, [siteSettings.telegramChannelName]);

  useEffect(() => {
    if (siteSettings.telegramDistributionMode) {
      setBatchPublishMode(siteSettings.telegramDistributionMode);
    }
  }, [siteSettings.telegramDistributionMode]);

  const activeNormalizedChannel = useMemo(
    () => normalizeTelegramChatId(siteSettings.telegramChannelName || siteSettings.telegramChannelId || '@DreamBigJobsEthiopia').chatId,
    [siteSettings.telegramChannelName, siteSettings.telegramChannelId]
  );

  const handleVerifyQueueChannel = async (overrideTarget?: string): Promise<ChannelVerificationResult> => {
    setIsCheckingChannel(true);
    try {
      const result = await verifyTelegramConnectionClient(overrideTarget ?? activeNormalizedChannel);
      setChannelCheckResult(result);
      if (!result.ok && !result.unreachableServer) {
        setShowChannelFixer(true);
      } else if (result.ok && result.chat) {
        setNotification({
          type: 'success',
          message: `✅ ${result.statusLabel || 'Connected successfully'}: "${result.chat.title}" (${result.normalizedChannel}, ID: ${result.chat.id}). Bot @${result.bot?.username || 'verified'} has Admin posting rights.`,
        });
      }
      return result;
    } finally {
      setIsCheckingChannel(false);
    }
  };

  const handleApplyChannelTarget = async (rawTarget: string, explicitId?: string) => {
    const normalized = normalizeTelegramChatId(rawTarget);
    if (normalized.isInviteLink) {
      setNotification({
        type: 'error',
        message: normalized.error || 'Private invite links (t.me/+...) cannot be used as a bot chat_id.',
      });
      return;
    }

    setIsSavingChannelFix(true);
    try {
      const cleanTarget = normalized.chatId;
      const updatedSettings: SiteSettings = {
        ...siteSettings,
        telegramChannelName: cleanTarget,
        ...(explicitId || normalized.isNumeric ? { telegramChannelId: explicitId || cleanTarget } : {}),
        ...(normalized.slug ? { telegramChannelUrl: `https://t.me/${normalized.slug}` } : {}),
        updatedAt: new Date().toISOString(),
      };

      if (onSaveSettings) {
        await onSaveSettings(updatedSettings);
      } else {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedSettings),
        });
      }

      setManualChannelInput(cleanTarget);
      setStatusOverrides((prev) => {
        const next: typeof prev = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v.status !== 'failed') next[k] = v;
        }
        return next;
      });

      const verifyRes = await verifyTelegramConnectionClient(cleanTarget);
      setChannelCheckResult(verifyRes);
      if (verifyRes.ok) {
        setShowChannelFixer(false);
        setNotification({
          type: 'success',
          message: `✅ ${verifyRes.statusLabel || 'Connected successfully'} to ${cleanTarget}${verifyRes.chat?.title ? ` ("${verifyRes.chat.title}")` : ''}! You can now publish or retry failed jobs.`,
        });
      } else {
        setShowChannelFixer(true);
        setNotification({
          type: 'error',
          message: verifyRes.error || `Saved ${cleanTarget}, but Telegram could not verify Admin posting rights yet.`,
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to save target channel: ${err?.message || String(err)}`,
      });
    } finally {
      setIsSavingChannelFix(false);
    }
  };

  const effectiveQueueSettings = useMemo<SiteSettings>(
    () => ({
      ...siteSettings,
      telegramDistributionMode: batchPublishMode,
    }),
    [siteSettings, batchPublishMode]
  );

  const handleBulkFileUploadInTg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsBulkUploading(true);
    setNotification(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload-file', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setNotification({ type: 'error', message: data?.error || 'Failed to read uploaded file.' });
      } else {
        setBulkRawText((prev) => (prev ? `${prev}\n\n${data.text}` : data.text));
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Upload error: ' + err.message });
    } finally {
      setIsBulkUploading(false);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    }
  };

  const handleParseBulkInTg = async () => {
    if (!bulkRawText.trim()) {
      setNotification({ type: 'error', message: 'Paste 50+ vacancy announcements or upload a document first.' });
      return;
    }
    setIsBulkParsing(true);
    setNotification(null);
    try {
      const parseRes = await fetch('/api/gemini/parse-bulk-vacancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bulkRawText }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok || !parseData?.success) {
        throw new Error(parseData?.error || 'Bulk vacancy extraction failed.');
      }

      const dupRes = await fetch('/api/admin/detect-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: parseData.vacancies || [],
          existingVacancies: vacancies,
        }),
      });
      const dupData = await dupRes.json();
      if (!dupRes.ok || !dupData?.success) {
        throw new Error(dupData?.error || 'Duplicate screening failed.');
      }

      const serverRejected = Array.isArray(dupData.rejectedIncomplete) ? dupData.rejectedIncomplete : [];
      const clientRejected: Array<{ id: string; title: string; organization: string; missingFields: string[] }> = [];
      const validList: Vacancy[] = [];

      for (const v of (dupData.validCandidates || []) as Vacancy[]) {
        const strict = validateVacancyStrict(v, { allowExpired: false });
        if (!strict.valid) {
          clientRejected.push({
            id: v.id,
            title: v.title || '(Missing Position)',
            organization: v.organization || '(Missing Employer)',
            missingFields: strict.missingFields,
          });
          continue;
        }
        const broad = v.broadCategory || classifyVacancyBroadSectorClient(v);
        const wash = typeof v.isWashNgo === 'boolean' ? v.isWashNgo : isWashNgoVacancyClient(v);
        const expiredFlag =
          typeof v.isExpired === 'boolean'
            ? v.isExpired
            : v.status === 'expired' || isVacancyDeadlineExpiredClient(v.applicationDeadline);
        validList.push({
          ...v,
          broadCategory: broad,
          isWashNgo: wash,
          isExpired: expiredFlag,
          status: expiredFlag ? ('expired' as const) : ('published' as const),
          publishedAt: v.publishedAt || new Date().toISOString(),
        });
      }

      const allRejected = [...serverRejected, ...clientRejected];
      const dups: DuplicateReportItem[] = dupData.duplicatesReport || [];
      setBulkParsedVacancies(validList);
      setBulkDuplicatesReport(dups);
      setBulkRejectedIncomplete(allRejected);
      setBulkSelectedIds(new Set(validList.filter((v) => !v.isExpired).map((v) => v.id)));

      const bankingCount = validList.filter((v) => v.broadCategory === 'Banking').length;
      const ngoCount = validList.filter((v) => v.broadCategory === 'NGO').length;
      const washCount = validList.filter((v) => v.isWashNgo).length;
      const otherCount = validList.filter((v) => v.broadCategory === 'Other').length;
      const expiredCount = validList.filter((v) => v.isExpired).length;

      setBulkSummaryStats({
        totalDetected: (parseData.vacancies || []).length,
        validCount: validList.length,
        duplicatesSkipped: dups.length,
        rejectedIncompleteCount: allRejected.length,
        expiredCount,
        bankingCount,
        ngoCount,
        washCount,
        otherCount,
      });

      setNotification({
        type: validList.length > 0 ? 'success' : 'error',
        message:
          validList.length > 0
            ? `Parsed ${validList.length} verified vacancies (${bankingCount} Banking, ${ngoCount} NGO incl. ${washCount} 🟢⭐ WASH, ${otherCount} Other; ${allRejected.length} incomplete/no-deadline blocked, ${dups.length} duplicates skipped). Review below and select Option A–D to publish.`
            : `Blocked ${allRejected.length} incomplete/no-deadline vacancy(ies) (${dups.length} duplicates). Every job must have a valid future Deadline, Employer Name, Position, Requirements, Method to Apply, and Direct Employer Link/Email/Physical Address.`,
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.message || 'Bulk parse failed.' });
    } finally {
      setIsBulkParsing(false);
    }
  };

  const getBulkEligibleByOption = (list: Vacancy[], mode: TelegramDistributionMode) => {
    const tempSettings: Partial<SiteSettings> = {
      ...siteSettings,
      telegramDistributionMode: mode,
    };
    return list.filter((v) => evaluateVacancyForTelegramClient(v, tempSettings, false, 'vacancy').allowed);
  };

  const handleSaveAndPublishBulkBatch = async (publishToTelegram: boolean) => {
    const selected = bulkParsedVacancies.filter(
      (v) => bulkSelectedIds.has(v.id) && validateVacancyStrict(v, { allowExpired: false }).valid
    );
    if (selected.length === 0) {
      setNotification({
        type: 'error',
        message: 'Select at least one complete, non-expired vacancy with all 6 mandatory fields.',
      });
      return;
    }
    setIsBatchRunning(true);
    isBatchCancelledRef.current = false;
    setNotification(null);

    try {
      if (onBatchUpdateVacancies) {
        await onBatchUpdateVacancies(selected);
      } else {
        for (const item of selected) {
          await onUpdateVacancy(item);
        }
      }

      if (!publishToTelegram) {
        setNotification({
          type: 'success',
          message: `Saved ${selected.length} imported vacancies to Hopeland Website without sending to Telegram.`,
        });
        setBulkParsedVacancies((prev) => prev.filter((v) => !bulkSelectedIds.has(v.id)));
        setBulkSelectedIds(new Set());
        return;
      }

      const eligible = getBulkEligibleByOption(selected, batchPublishMode);
      const excludedCount = selected.length - eligible.length;
      if (eligible.length === 0) {
        setNotification({
          type: 'info',
          message: `Saved ${selected.length} jobs to Hopeland Website. 0 vacancies matched ${getTelegramDistributionModeLabel(batchPublishMode)} with open deadlines/application method.`,
        });
        return;
      }

      setBatchProgress({
        current: 0,
        total: eligible.length,
        currentTitle: `Publishing ${eligible.length} jobs under ${getTelegramDistributionModeLabel(batchPublishMode)}...`,
      });

      const channel = activeNormalizedChannel;
      const preCheck = await verifyTelegramConnectionClient(channel);
      if (!preCheck.unreachableServer && !preCheck.ok) {
        setChannelCheckResult(preCheck);
        setShowChannelFixer(true);
        setIsBatchRunning(false);
        setBatchProgress(null);
        setNotification({
          type: 'error',
          message: `⛔ Batch paused before posting: ${preCheck.statusLabel ? `${preCheck.statusLabel} — ` : ''}${preCheck.error || 'Target channel verification failed.'}`,
        });
        return;
      }

      const startRes = await startServerTelegramQueueClient({
        vacancies: eligible,
        channelName: channel,
        distributionMode: batchPublishMode,
      });

      if (!startRes.success) {
        throw new Error(startRes.error || 'Failed to enqueue bulk batch on server.');
      }

      await syncServerQueueStateToUi(startRes);
      setBulkParsedVacancies((prev) => prev.filter((v) => !bulkSelectedIds.has(v.id)));
      setBulkSelectedIds(new Set());
      setNotification({
        type: 'success',
        message: `Saved ${selected.length} jobs to Hopeland Website and launched persistent sequential Telegram queue for ${eligible.length} eligible jobs (${excludedCount} excluded by ${getTelegramDistributionModeLabel(batchPublishMode)}). Progress is preserved across page refreshes.`,
      });
    } catch (err: any) {
      setIsBatchRunning(false);
      setBatchProgress(null);
      setNotification({ type: 'error', message: err?.message || 'Batch import/publish failed.' });
    }
  };

  // Load saved batches
  const loadBatches = async () => {
    setLoadingBatches(true);
    try {
      const records = await fetchTelegramBatches();
      setSavedBatches(records);
    } catch (err) {
      console.warn('Failed to fetch telegram batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  // Update selection if initialSelectedIds changes
  useEffect(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      setSelectedIds(new Set(initialSelectedIds));
    }
  }, [initialSelectedIds]);

  // Determine effective status for a vacancy (accounting for live in-flight state & overrides)
  const getJobStatus = (job: Vacancy): {
    status: TelegramPostStatus;
    label: string;
    badgeClass: string;
    messageId?: number;
    postedAt?: string;
    error?: string;
  } => {
    if (inFlightJobId === job.id) {
      return {
        status: 'posting',
        label: 'POSTING...',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse',
      };
    }

    const override = statusOverrides[job.id];
    if (override) {
      if (override.status === 'posting') {
        return {
          status: 'posting',
          label: 'PROCESSING...',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse',
        };
      }
      if (override.status === 'retrying') {
        return {
          status: 'retrying',
          label: 'RETRYING...',
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-400 animate-pulse',
          error: override.error,
        };
      }
      if (override.status === 'success') {
        return {
          status: 'success',
          label: 'SUCCESSFULLY POSTED',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          messageId: override.messageId,
          postedAt: override.postedAt,
        };
      }
      if (override.status === 'failed') {
        return {
          status: 'failed',
          label: 'FAILED',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
          error: override.error,
        };
      }
    }

    if (job.telegramPublished) {
      return {
        status: 'already',
        label: 'ALREADY POSTED',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        messageId: job.telegramMessageId,
        postedAt: job.telegramPublishedAt,
      };
    }

    if (job.telegramPublishError) {
      return {
        status: 'failed',
        label: 'FAILED',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        error: job.telegramPublishError,
      };
    }

    return {
      status: 'ready',
      label: 'READY TO POST',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    };
  };

  // Filtered vacancies list
  const filteredVacancies = useMemo(() => {
    return vacancies.filter((v) => {
      // Category filter
      if (categoryFilter !== 'all' && v.category !== categoryFilter) {
        return false;
      }

      // Status filter
      const { status } = getJobStatus(v);
      if (statusFilter === 'ready' && status !== 'ready') return false;
      if (statusFilter === 'posted' && status !== 'success' && status !== 'already') return false;
      if (statusFilter === 'failed' && status !== 'failed') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = v.title.toLowerCase().includes(q);
        const matchesOrg = v.organization.toLowerCase().includes(q);
        const matchesLoc = v.location.toLowerCase().includes(q);
        if (!matchesTitle && !matchesOrg && !matchesLoc) return false;
      }

      return true;
    });
  }, [vacancies, categoryFilter, statusFilter, searchQuery, statusOverrides, inFlightJobId]);

  // Live KPI Summary stats for visible/selected items
  const kpiStats = useMemo(() => {
    let readyCount = 0;
    let postedCount = 0;
    let failedCount = 0;

    vacancies.forEach((v) => {
      const { status } = getJobStatus(v);
      if (status === 'success' || status === 'already') {
        postedCount++;
      } else if (status === 'failed') {
        failedCount++;
      } else {
        readyCount++;
      }
    });

    return {
      total: vacancies.length,
      selected: selectedIds.size,
      ready: readyCount,
      posted: postedCount,
      failed: failedCount,
    };
  }, [vacancies, selectedIds, statusOverrides, inFlightJobId]);

  // Quick Preset Selection Handlers
  const handleSelectCount = (count: number) => {
    // Select first N unposted jobs from current filtered list (or all jobs if not enough unposted)
    const unposted = filteredVacancies.filter((v) => {
      const s = getJobStatus(v).status;
      return s === 'ready' || s === 'failed';
    });

    const targetList = unposted.length >= count ? unposted : filteredVacancies;
    const slice = targetList.slice(0, count);
    const newSet = new Set<string>(slice.map((v) => v.id));
    setSelectedIds(newSet);

    setNotification({
      type: 'info',
      message: `Selected ${newSet.size} vacancies for Telegram posting.`,
    });
  };

  const handleSelectAllUnpublished = () => {
    const unposted = vacancies.filter((v) => {
      const s = getJobStatus(v).status;
      return s === 'ready' || s === 'failed';
    });
    setSelectedIds(new Set(unposted.map((v) => v.id)));
    setNotification({
      type: 'info',
      message: `Selected all ${unposted.length} unpublished vacancies.`,
    });
  };

  // Retry ONLY failed vacancies (never resends already-published vacancies)
  const handleRetryFailedQueue = async () => {
    const failedJobs = vacancies.filter((v) => !v.telegramPublished && getJobStatus(v).status === 'failed');
    setSelectedIds(new Set(failedJobs.map((v) => v.id)));

    const preCheck = await verifyTelegramConnectionClient(activeNormalizedChannel);
    if (!preCheck.unreachableServer && !preCheck.ok) {
      setChannelCheckResult(preCheck);
      setShowChannelFixer(true);
      setNotification({
        type: 'error',
        message: `⛔ Cannot retry failed jobs: ${preCheck.statusLabel ? `${preCheck.statusLabel} — ` : ''}${preCheck.error || 'Target channel not verified.'}`,
      });
      return;
    }

    const serverFailedCount = serverQueueStatus?.summary?.failed || 0;
    if (serverFailedCount > 0) {
      const retryRes = await retryFailedServerQueueClient();
      await syncServerQueueStateToUi(retryRes);
      setNotification({
        type: 'info',
        message: `Retrying ONLY ${retryRes.requeuedCount || serverFailedCount} failed vacancies in the background queue. Already published jobs are untouched.`,
      });
      return;
    }

    if (failedJobs.length === 0) {
      setNotification({
        type: 'info',
        message: 'No failed vacancies found to retry.',
      });
      return;
    }

    const startRes = await startServerTelegramQueueClient({
      vacancies: failedJobs,
      channelName: activeNormalizedChannel,
      distributionMode: batchPublishMode,
      forceRetry: false,
    });
    await syncServerQueueStateToUi(startRes);
    setNotification({
      type: 'info',
      message: `Retrying ONLY ${failedJobs.length} failed vacancies sequentially. Published vacancies remain untouched.`,
    });
  };

  const handleSelectAllFailed = () => {
    handleRetryFailedQueue();
  };

  const handleToggleSelectAllVisible = () => {
    const allVisibleSelected = filteredVacancies.length > 0 && filteredVacancies.every((v) => selectedIds.has(v.id));
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVacancies.map((v) => v.id)));
    }
  };

  const handleToggleSelectJob = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Single Job Post Function (never marks published until Telegram confirms)
  const executeSinglePost = async (
    job: Vacancy,
    forceRetry = false
  ): Promise<{ ok: boolean; error?: string; fatal?: boolean; discoveredChats?: DiscoveredTelegramChat[] }> => {
    setInFlightJobId(job.id);
    setStatusOverrides((prev) => ({
      ...prev,
      [job.id]: { status: 'posting' },
    }));
    setNotification(null);

    try {
      const channel = activeNormalizedChannel;
      const data = await broadcastJobToTelegram(
        job,
        channel,
        forceRetry,
        siteSettings.customDomain,
        effectiveQueueSettings,
        'vacancy',
        forceRetry ? 'retry' : 'manual_publish'
      );

      if (!data.success) {
        const errorMsg = data.error || 'Telegram broadcast failed';
        const fatal = isFatalTelegramConfigError(errorMsg);
        setStatusOverrides((prev) => ({
          ...prev,
          [job.id]: { status: 'failed', error: errorMsg },
        }));

        await onUpdateVacancy({
          ...job,
          telegramPublishError: errorMsg,
          updatedAt: new Date().toISOString(),
        });

        if (fatal) {
          setChannelCheckResult({
            ok: false,
            chatExists: false,
            normalizedChannel: channel,
            error: errorMsg,
            discoveredChats: data.discoveredChats,
          });
          setShowChannelFixer(true);
        }

        setNotification({
          type: 'error',
          message: `❌ Failed to post "${job.title}": ${errorMsg}`,
        });
        await refreshQueueStatus();
        return { ok: false, error: errorMsg, fatal, discoveredChats: data.discoveredChats };
      }

      const publishedAt = data.telegramPublishedAt || new Date().toISOString();
      const messageId = data.telegramMessageId;

      setStatusOverrides((prev) => ({
        ...prev,
        [job.id]: {
          status: 'success',
          messageId,
          postedAt: publishedAt,
        },
      }));

      await onUpdateVacancy({
        ...job,
        telegramPublished: true,
        telegramMessageId: messageId,
        telegramPublishedAt: publishedAt,
        telegramPublishError: '',
        status: 'published',
        publishedAt: job.publishedAt || publishedAt,
        updatedAt: new Date().toISOString(),
      });

      setNotification({
        type: 'success',
        message: `✅ Successfully posted "${job.title}" to ${data.resolvedChatId || channel} (Message #${messageId || 'OK'})!`,
      });
      await refreshQueueStatus();
      return { ok: true };
    } catch (err: any) {
      const msg = err.message || 'Network error';
      setStatusOverrides((prev) => ({
        ...prev,
        [job.id]: { status: 'failed', error: msg },
      }));
      setNotification({
        type: 'error',
        message: `❌ Network error posting "${job.title}": ${msg}`,
      });
      return { ok: false, error: msg };
    } finally {
      setInFlightJobId(null);
    }
  };

  // Safe handler with duplicate confirmation modal
  const handleSinglePostClick = (job: Vacancy) => {
    const currentStatus = getJobStatus(job).status;
    if (currentStatus === 'success' || currentStatus === 'already') {
      setDuplicateWarningJob(job);
    } else {
      executeSinglePost(job, currentStatus === 'failed');
    }
  };

  const handleCancelActiveQueue = async () => {
    isBatchCancelledRef.current = true;
    const cancelRes = await cancelServerTelegramQueueClient();
    await syncServerQueueStateToUi(cancelRes);
    setNotification({
      type: 'info',
      message: 'Telegram publishing queue paused/cancelled.',
    });
  };

  // Bulk Publishing Workflow backed by Persistent Server Sequential Queue
  const handleBulkPostSelected = async (explicitJobs?: Vacancy[]) => {
    const jobsToPost = explicitJobs && explicitJobs.length > 0
      ? explicitJobs
      : vacancies.filter((v) => selectedIds.has(v.id));

    if (jobsToPost.length === 0) {
      setNotification({
        type: 'error',
        message: 'Please select at least one vacancy using the checkboxes first.',
      });
      return;
    }

    setIsBatchRunning(true);
    isBatchCancelledRef.current = false;
    setBatchProgress({
      current: 0,
      total: jobsToPost.length,
      currentTitle: `Verifying channel "${activeNormalizedChannel}" before broadcasting...`,
    });

    const preCheck = await verifyTelegramConnectionClient(activeNormalizedChannel);
    if (!preCheck.unreachableServer && !preCheck.ok) {
      setIsBatchRunning(false);
      setBatchProgress(null);
      setChannelCheckResult(preCheck);
      setShowChannelFixer(true);
      setNotification({
        type: 'error',
        message: `⛔ Queue paused before posting ${jobsToPost.length} jobs: ${preCheck.statusLabel ? `${preCheck.statusLabel} — ` : ''}${preCheck.error || 'Target channel not reachable.'}`,
      });
      return;
    }

    try {
      const startRes = await startServerTelegramQueueClient({
        vacancies: jobsToPost,
        channelName: activeNormalizedChannel,
        distributionMode: batchPublishMode,
        forceRetry: false,
      });

      if (!startRes.success) {
        setIsBatchRunning(false);
        setBatchProgress(null);
        setNotification({
          type: 'error',
          message: startRes.error || 'Failed to enqueue jobs on the server.',
        });
        return;
      }

      await syncServerQueueStateToUi(startRes);
      setNotification({
        type: 'info',
        message: `🚀 Started persistent sequential queue for ${jobsToPost.length} vacancies. Safe across page refreshes & automatic retries enabled.`,
      });

      const batchRecord: TelegramBatchRecord = {
        id: `batch_${Date.now()}`,
        name: `Telegram Session - ${new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })} (${jobsToPost.length} Jobs)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalCount: jobsToPost.length,
        successCount: startRes.summary?.published || 0,
        failedCount: startRes.summary?.failed || 0,
        status: 'draft',
        jobs: jobsToPost.map((j) => ({
          vacancyId: j.id,
          title: j.title,
          organization: j.organization,
          category: j.category,
          status: j.telegramPublished ? 'success' : 'pending',
        })),
      };
      saveTelegramBatch(batchRecord)
        .then(() => loadBatches())
        .catch(() => {});
    } catch (err: any) {
      setIsBatchRunning(false);
      setBatchProgress(null);
      setNotification({
        type: 'error',
        message: `Failed to start Telegram queue: ${err?.message || String(err)}`,
      });
    }
  };

  // Save Selected Jobs as a Named Batch (e.g. "Morning 20 Jobs")
  const handleSaveBatchModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) return;

    const jobsToSave = vacancies.filter((v) => selectedIds.has(v.id));
    if (jobsToSave.length === 0) {
      setNotification({
        type: 'error',
        message: 'No vacancies selected to save in batch.',
      });
      return;
    }

    const batch: TelegramBatchRecord = {
      id: `batch_${Date.now()}`,
      name: newBatchName.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalCount: jobsToSave.length,
      successCount: jobsToSave.filter((j) => getJobStatus(j).status === 'already' || getJobStatus(j).status === 'success').length,
      failedCount: 0,
      status: 'draft',
      jobs: jobsToSave.map((j) => ({
        vacancyId: j.id,
        title: j.title,
        organization: j.organization,
        category: j.category,
        status: j.telegramPublished ? 'success' : 'pending',
        telegramMessageId: j.telegramMessageId,
        postedAt: j.telegramPublishedAt,
      })),
    };

    try {
      await saveTelegramBatch(batch);
      await loadBatches();
      setIsSaveBatchModalOpen(false);
      setNewBatchName('');
      setNotification({
        type: 'success',
        message: `Saved batch "${batch.name}" with ${jobsToSave.length} vacancies!`,
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to save batch: ${err.message}`,
      });
    }
  };

  // Resume or Publish a saved batch
  const handlePublishSavedBatch = (batch: TelegramBatchRecord) => {
    const jobIds = new Set(batch.jobs.map((j) => j.vacancyId));
    setSelectedIds(jobIds);
    setIsHistoryModalOpen(false);
    setSelectedHistoryBatch(null);

    setNotification({
      type: 'info',
      message: `Loaded batch "${batch.name}" (${jobIds.size} jobs). Click "POST SELECTED TO TELEGRAM" to begin posting.`,
    });
  };

  const handleDeleteBatch = async (batchId: string) => {
    try {
      await deleteTelegramBatch(batchId);
      await loadBatches();
      if (selectedHistoryBatch?.id === batchId) {
        setSelectedHistoryBatch(null);
      }
      setNotification({
        type: 'info',
        message: 'Batch removed from history.',
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to delete batch: ${err.message}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-[#0B132B] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
                <Send className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  TELEGRAM PUBLISHING QUEUE
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                    Live Broadcast Manager
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 flex flex-wrap items-center gap-1.5">
                  <span>Target Channel:</span>
                  {/^-\d+$/.test(activeNormalizedChannel) ? (
                    <span className="text-amber-400 font-bold font-mono">{activeNormalizedChannel} (Private Channel ID)</span>
                  ) : (
                    <a
                      href={siteSettings.telegramChannelUrl || `https://t.me/${activeNormalizedChannel.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      {activeNormalizedChannel}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleVerifyQueueChannel()}
                    disabled={isCheckingChannel}
                    className="ml-1 px-2.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] font-bold transition-colors"
                  >
                    {isCheckingChannel ? 'Checking...' : 'Verify Channel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChannelFixer((v) => !v)}
                    className="px-2.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition-colors"
                  >
                    {showChannelFixer ? 'Hide Fixer' : 'Change Target'}
                  </button>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 shadow-sm"
            >
              <History className="w-4 h-4 text-amber-400" />
              <span>View Previous Batches ({savedBatches.length})</span>
            </button>

            <button
              onClick={() => {
                if (selectedIds.size === 0) {
                  setNotification({
                    type: 'error',
                    message: 'Please select vacancies to save into a batch first.',
                  });
                  return;
                }
                setNewBatchName(
                  `Batch - ${new Date().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })} (${selectedIds.size} Jobs)`
                );
                setIsSaveBatchModalOpen(true);
              }}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold transition-all border border-slate-700 shadow-sm"
            >
              <FolderPlus className="w-4 h-4 text-blue-400" />
              <span>Save as Batch ({selectedIds.size})</span>
            </button>
          </div>
        </div>

        {/* Live KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-900/80 rounded-2xl p-3 border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Queue Total</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{kpiStats.total}</p>
          </div>

          <div className="bg-amber-500/10 rounded-2xl p-3 border border-amber-500/30">
            <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Selected</p>
            <p className="text-xl font-extrabold text-amber-300 mt-0.5">{kpiStats.selected}</p>
          </div>

          <div className="bg-emerald-500/10 rounded-2xl p-3 border border-emerald-500/30">
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Posted to TG</p>
            <p className="text-xl font-extrabold text-emerald-300 mt-0.5">{kpiStats.posted}</p>
          </div>

          <div className="bg-rose-500/10 rounded-2xl p-3 border border-rose-500/30">
            <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Failed / Error</p>
            <p className="text-xl font-extrabold text-rose-300 mt-0.5">{kpiStats.failed}</p>
          </div>

          <div className="bg-sky-500/10 rounded-2xl p-3 border border-sky-500/30 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">Ready to Post</p>
            <p className="text-xl font-extrabold text-sky-300 mt-0.5">{kpiStats.ready}</p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs relative z-10">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="font-bold text-amber-400">
              Active Distribution Rule: {getTelegramDistributionModeLabel(batchPublishMode)}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            System 1 (Telegram &amp; Bulk Import) is completely independent from System 2 Private International Research.
          </span>
        </div>
      </div>

      {/* Unified Admin Telegram Status & Controls Panel */}
      <TelegramStatusPanel
        siteSettings={siteSettings}
        vacancies={vacancies}
        queueStatus={serverQueueStatus}
        onSaveSettings={onSaveSettings}
        onRetryFailed={handleRetryFailedQueue}
        onCancelQueue={handleCancelActiveQueue}
        onRefreshQueueStatus={refreshQueueStatus}
        onChannelVerified={(res) => setChannelCheckResult(res)}
      />

      {/* Sub-Tabs inside Telegram Posting Section */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTgSectionTab('queue')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors flex items-center gap-2 ${
              tgSectionTab === 'queue'
                ? 'bg-[#0B132B] text-amber-400 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Live Broadcast Queue ({vacancies.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTgSectionTab('bulkImport')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors flex items-center gap-2 ${
              tgSectionTab === 'bulkImport'
                ? 'bg-[#0B132B] text-amber-400 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Bulk Vacancy Import (50+ Jobs) &amp; WASH/Category Publisher</span>
            {bulkParsedVacancies.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                {bulkParsedVacancies.length}
              </span>
            )}
          </button>
        </div>

        {/* 4 Telegram Publishing Options Selector (System 1 Only) */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-bold text-slate-500 mr-1">Telegram Rule:</span>
          {[
            { id: 'all_jobs' as TelegramDistributionMode, label: 'A. ALL JOBS' },
            { id: 'banking_only' as TelegramDistributionMode, label: 'B. BANKING ONLY' },
            { id: 'ngo_only' as TelegramDistributionMode, label: 'C. NGO ONLY' },
            { id: 'banking_and_ngo_only' as TelegramDistributionMode, label: 'D. BANKING & NGO ONLY' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setBatchPublishMode(opt.id)}
              className={`px-2.5 py-1 rounded-lg font-extrabold border transition-colors ${
                batchPublishMode === opt.id
                  ? 'bg-amber-400 text-slate-950 border-amber-500'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inline Channel Fixer & Auto-Detect Diagnostics Panel */}
      {showChannelFixer && (
        <div className="bg-rose-50/90 border-2 border-rose-300 rounded-3xl p-5 shadow-sm space-y-3 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-extrabold text-sm text-rose-950">
                  Telegram Channel Connection Fixer
                </h3>
                <p className="text-rose-800 mt-0.5 leading-relaxed">
                  {channelCheckResult?.error ||
                    `Verify or update the target channel for ${siteSettings.telegramBotUsername ? `@${siteSettings.telegramBotUsername.replace('@', '')}` : 'your Telegram bot'}.`}
                </p>
                {channelCheckResult?.diagnosis && (
                  <p className="text-rose-900 font-semibold mt-1">{channelCheckResult.diagnosis}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowChannelFixer(false)}
              className="p-1 rounded-lg hover:bg-rose-100 text-rose-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-rose-200 space-y-2.5">
            <label className="block font-bold text-slate-800">
              Enter Public <code className="bg-slate-100 px-1 rounded">@username</code>, <code className="bg-slate-100 px-1 rounded">t.me/channel</code> link, or Private Channel ID (<code className="bg-slate-100 px-1 rounded">-100...</code>):
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={manualChannelInput}
                onChange={(e) => setManualChannelInput(e.target.value)}
                placeholder="@HopeLandJobs or -1001234567890"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-amber-500 outline-none"
              />
              <button
                type="button"
                onClick={() => handleApplyChannelTarget(manualChannelInput)}
                disabled={isSavingChannelFix || !manualChannelInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs whitespace-nowrap"
              >
                {isSavingChannelFix ? 'Saving & Verifying...' : 'Save & Verify Channel'}
              </button>
            </div>
            <p className="text-[11px] text-slate-600">
              <strong>Checklist:</strong> In Telegram, open your channel (&ldquo;Hopeland Jobs&rdquo;) &rarr; <strong>Administrators</strong> &rarr; ensure your bot is added as Administrator with <strong>Post Messages</strong> ON. If the channel is <strong>Private</strong>, copy any channel message link (<code className="bg-slate-100 px-1 rounded">https://t.me/c/...</code>) or forward a message to <code className="bg-slate-100 px-1 rounded">@userinfobot</code> to get its <code className="bg-slate-100 px-1 rounded">-100...</code> ID and paste it above.
            </p>
          </div>

          {channelCheckResult?.discoveredChats && channelCheckResult.discoveredChats.length > 0 && (
            <div className="bg-white rounded-2xl p-3.5 border border-emerald-300 space-y-2">
              <div className="font-extrabold text-emerald-900">
                Auto-Detected Channels for Your Bot (Click to Switch &amp; Save):
              </div>
              <div className="flex flex-wrap gap-2">
                {channelCheckResult.discoveredChats.map((dc) => (
                  <button
                    key={dc.id}
                    type="button"
                    disabled={isSavingChannelFix}
                    onClick={() => handleApplyChannelTarget(dc.username || dc.id, dc.id)}
                    className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-400 text-emerald-950 font-extrabold text-xs transition-colors"
                  >
                    Use &ldquo;{dc.title}&rdquo; ({dc.username || dc.id})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Notification Alert */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Persistent Server Batch Progress Banner */}
      {isBatchRunning && batchProgress && (
        <div className="bg-amber-500 text-slate-950 p-5 rounded-3xl shadow-lg border-2 border-amber-600">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-950" />
              <span className="font-extrabold text-sm sm:text-base">
                Sequential Telegram Publishing in Progress...
              </span>
            </div>
            <button
              onClick={handleCancelActiveQueue}
              className="px-3 py-1 rounded-xl bg-slate-950 text-amber-400 text-xs font-black hover:bg-slate-900 transition-colors"
            >
              Cancel Queue
            </button>
          </div>
          <p className="text-xs font-bold text-slate-900 truncate mb-3">{batchProgress.currentTitle}</p>
          <div className="w-full bg-slate-950/20 rounded-full h-3 overflow-hidden">
            <div
              className="bg-slate-950 h-3 rounded-full transition-all duration-300"
              style={{
                width: `${serverQueueStatus?.summary?.progressPercent ?? Math.round((batchProgress.current / batchProgress.total) * 100)}%`,
              }}
            />
          </div>
          <div className="flex flex-wrap justify-between items-center gap-2 text-[11px] font-bold text-slate-900 mt-2">
            <span>
              Total: {serverQueueStatus?.summary?.total ?? batchProgress.total} • Published: {serverQueueStatus?.summary?.published ?? 0} • Failed: {serverQueueStatus?.summary?.failed ?? 0} • Pending: {(serverQueueStatus?.summary?.pending ?? 0) + (serverQueueStatus?.summary?.processing ?? 0) + (serverQueueStatus?.summary?.retrying ?? 0)}
            </span>
            <span>
              {serverQueueStatus?.summary?.progressPercent ?? Math.round((batchProgress.current / batchProgress.total) * 100)}% Complete
            </span>
          </div>
        </div>
      )}

      {/* INTEGRATED BULK VACANCY IMPORT WORKFLOW (50+ VACANCIES) INSIDE TELEGRAM POSTING */}
      {tgSectionTab === 'bulkImport' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#0B132B] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" />
                  <span>Bulk Vacancy Import &amp; Telegram Batch Publisher (50–100+ Jobs)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Paste or import 50+ vacancies in one operation. Extracts Title, Employer, Location, Qualifications, Experience, Deadline &amp; Application Method, classifies Banking / NGO / Other, detects genuine WASH NGO jobs (<code>🟢⭐ WASH JOB</code>), and screens duplicates &amp; expired deadlines.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="file"
                  ref={bulkFileInputRef}
                  onChange={handleBulkFileUploadInTg}
                  accept=".txt,.docx,.pdf"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => bulkFileInputRef.current?.click()}
                  disabled={isBulkUploading || isBulkParsing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300"
                >
                  <FileUp className="w-4 h-4 text-amber-600" />
                  <span>{isBulkUploading ? 'Reading File...' : 'Import TXT / DOCX / PDF'}</span>
                </button>
              </div>
            </div>

            <textarea
              rows={9}
              value={bulkRawText}
              onChange={(e) => setBulkRawText(e.target.value)}
              placeholder="Paste 50+ job vacancies here separated by blank lines or headings (Company, Position, Location, Qualifications, Experience, Deadline, Application Method/URL/Email)..."
              className="w-full text-xs font-mono p-4 rounded-2xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-500 font-medium">
                {bulkRawText.length > 0
                  ? `${bulkRawText.length} chars pasted • Ready for single-pass bulk extraction`
                  : 'Supports 50, 100 or more vacancies in a single operation'}
              </div>
              <div className="flex items-center gap-2">
                {bulkRawText && (
                  <button
                    type="button"
                    onClick={() => {
                      setBulkRawText('');
                      setBulkParsedVacancies([]);
                      setBulkDuplicatesReport([]);
                      setBulkSummaryStats(null);
                      setBulkSelectedIds(new Set());
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleParseBulkInTg}
                  disabled={isBulkParsing || !bulkRawText.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B132B] hover:bg-slate-900 text-amber-400 font-black text-xs shadow-sm disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${isBulkParsing ? 'animate-spin' : ''}`} />
                  <span>{isBulkParsing ? 'Parsing & Classifying Batch...' : 'Read, Classify & Screen Duplicates/Expired'}</span>
                </button>
              </div>
            </div>
          </div>

          {bulkSummaryStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-center">
              {[
                { label: 'Detected', value: bulkSummaryStats.totalDetected, cls: 'bg-white border-slate-200 text-slate-900' },
                { label: 'New Valid', value: bulkSummaryStats.validCount, cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                { label: 'Banking', value: bulkSummaryStats.bankingCount, cls: 'bg-sky-50 border-sky-200 text-sky-900' },
                { label: 'NGO Total', value: bulkSummaryStats.ngoCount, cls: 'bg-indigo-50 border-indigo-200 text-indigo-900' },
                { label: '🟢⭐ WASH NGO', value: bulkSummaryStats.washCount, cls: 'bg-emerald-100 border-emerald-400 text-emerald-950' },
                { label: 'Other', value: bulkSummaryStats.otherCount, cls: 'bg-slate-50 border-slate-200 text-slate-700' },
                { label: 'Duplicates', value: bulkSummaryStats.duplicatesSkipped, cls: 'bg-amber-50 border-amber-300 text-amber-900' },
                { label: 'Blocked Incomplete', value: bulkSummaryStats.rejectedIncompleteCount, cls: 'bg-rose-50 border-rose-300 text-rose-900' },
              ].map((stat) => (
                <div key={stat.label} className={`p-3 rounded-2xl border ${stat.cls}`}>
                  <div className="text-xl font-black">{stat.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {bulkRejectedIncomplete.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 space-y-2">
              <div className="text-xs font-black text-rose-900">
                ⛔ {bulkRejectedIncomplete.length} Incomplete / No-Deadline Vacancies Blocked (Never Posted to Website or Telegram)
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1.5">
                {bulkRejectedIncomplete.map((rej) => (
                  <div key={rej.id} className="bg-white px-3 py-2 rounded-xl border border-rose-200 text-xs flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">
                      {rej.title} <span className="font-normal text-slate-500">— {rej.organization}</span>
                    </span>
                    <span className="text-[10px] font-bold text-rose-700">
                      Missing: {rej.missingFields.join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bulkParsedVacancies.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-[#0B132B]">
                    Review Imported Batch ({bulkParsedVacancies.length} Non-Duplicate Vacancies)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select one of the 4 Telegram Publishing Options below. WASH-related NGO vacancies automatically receive <strong className="text-emerald-700">🟢⭐ WASH JOB</strong> before the title when published under Option A, C, or D.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isBatchRunning || bulkSelectedIds.size === 0}
                    onClick={() => handleSaveAndPublishBulkBatch(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs disabled:opacity-50"
                  >
                    Save {bulkSelectedIds.size} to Website Only
                  </button>
                  <button
                    type="button"
                    disabled={isBatchRunning || bulkSelectedIds.size === 0}
                    onClick={() => handleSaveAndPublishBulkBatch(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-sm disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 fill-current" />
                    <span>
                      Publish Eligible ({getBulkEligibleByOption(bulkParsedVacancies.filter((v) => bulkSelectedIds.has(v.id)), batchPublishMode).length}) via {getTelegramDistributionModeLabel(batchPublishMode).split(':')[0]}
                    </span>
                  </button>
                </div>
              </div>

              {/* 4 Publishing Options Cards inside Batch Review */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  { id: 'all_jobs' as TelegramDistributionMode, code: 'A', title: 'ALL JOBS', desc: 'Publish every eligible verified vacancy.' },
                  { id: 'banking_only' as TelegramDistributionMode, code: 'B', title: 'BANKING JOBS ONLY', desc: 'Banking vacancies only (excludes NGO & WASH).' },
                  { id: 'ngo_only' as TelegramDistributionMode, code: 'C', title: 'NGO JOBS ONLY', desc: 'NGO vacancies only (WASH jobs get 🟢⭐ WASH JOB).' },
                  { id: 'banking_and_ngo_only' as TelegramDistributionMode, code: 'D', title: 'BANKING & NGO JOBS ONLY', desc: 'Banking + NGO together, excluding Other.' },
                ].map((opt) => {
                  const active = batchPublishMode === opt.id;
                  const matchCount = getBulkEligibleByOption(bulkParsedVacancies.filter((v) => bulkSelectedIds.has(v.id)), opt.id).length;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBatchPublishMode(opt.id)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        active
                          ? 'bg-[#0B132B] text-white border-amber-400 ring-2 ring-amber-400/40'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-black uppercase">
                        <span className={active ? 'text-amber-400' : 'text-slate-500'}>OPTION {opt.code}</span>
                        <span className={active ? 'text-emerald-300' : 'text-slate-600'}>{matchCount} eligible</span>
                      </div>
                      <div className="text-xs font-extrabold mt-0.5">{opt.title}</div>
                      <p className={`text-[10px] mt-0.5 ${active ? 'text-slate-300' : 'text-slate-500'}`}>{opt.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto border border-slate-200 rounded-2xl">
                {bulkParsedVacancies.map((v) => {
                  const isSel = bulkSelectedIds.has(v.id);
                  const gate = evaluateVacancyForTelegramClient(v, effectiveQueueSettings, false, 'vacancy');
                  return (
                    <div key={v.id} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${isSel ? 'bg-amber-50/30' : 'bg-white'}`}>
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() =>
                            setBulkSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(v.id)) next.delete(v.id);
                              else next.add(v.id);
                              return next;
                            })
                          }
                          className="mt-1 w-4 h-4 accent-amber-500 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {v.isWashNgo && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400">
                                🟢⭐ WASH JOB
                              </span>
                            )}
                            <span className="font-extrabold text-sm text-slate-900">{v.title}</span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                v.broadCategory === 'Banking'
                                  ? 'bg-sky-50 text-sky-900 border-sky-300'
                                  : v.broadCategory === 'NGO'
                                  ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {v.broadCategory || classifyVacancyBroadSectorClient(v)}
                            </span>
                            {v.isExpired && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
                                EXPIRED
                              </span>
                            )}
                          </div>
                          <div className="text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span><strong>Employer:</strong> {v.organization}</span>
                            <span><strong>Location:</strong> {v.location}</span>
                            <span><strong>Qualifications:</strong> {v.educationQualification || 'See details'}</span>
                            <span><strong>Experience:</strong> {v.experienceYears || 'See details'}</span>
                            <span><strong>Deadline:</strong> {v.applicationDeadline}</span>
                            <span><strong>Method:</strong> {v.applicationMethod}</span>
                          </div>
                          {!gate.allowed && gate.reason && (
                            <div className="text-[11px] font-semibold text-amber-800">{gate.reason}</div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewVacancy(v)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shrink-0 inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {bulkDuplicatesReport.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <strong>{bulkDuplicatesReport.length} Duplicates Excluded:</strong>{' '}
                  {bulkDuplicatesReport.slice(0, 5).map((d) => `${d.candidateTitle} (${d.candidateOrg})`).join(' · ')}
                  {bulkDuplicatesReport.length > 5 ? ` …and ${bulkDuplicatesReport.length - 5} more` : ''}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Control Bar: Presets & Batch Actions (Live Queue Tab) */}
      {tgSectionTab === 'queue' && (
      <>
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
        {/* Preset Selection Buttons & Primary Action */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Quick preset selectors */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <span className="font-bold text-slate-600 mr-1 flex items-center gap-1">
              <CheckSquare className="w-4 h-4 text-amber-500" />
              Quick Select:
            </span>
            {[1, 5, 10, 20, 50].map((num) => (
              <button
                key={num}
                onClick={() => handleSelectCount(num)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-100 hover:text-amber-950 text-slate-700 font-extrabold transition-all border border-slate-200"
              >
                {num} {num === 1 ? 'Job' : 'Jobs'}
              </button>
            ))}

            <button
              onClick={handleSelectAllUnpublished}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold transition-all border border-amber-300"
            >
              Select All Unpublished ({kpiStats.ready + kpiStats.failed})
            </button>

            {kpiStats.failed > 0 && (
              <button
                onClick={handleSelectAllFailed}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-extrabold transition-all border border-rose-300 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Failed ({kpiStats.failed})</span>
              </button>
            )}

            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 font-bold transition-all"
            >
              Clear Selection
            </button>
          </div>

          {/* Right: Main Telegram Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => handleBulkPostSelected()}
              disabled={isBatchRunning || selectedIds.size === 0}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-md active:scale-95"
            >
              <Send className="w-4 h-4 fill-current" />
              <span>POST SELECTED TO TELEGRAM ({selectedIds.size})</span>
            </button>

            <button
              onClick={async () => {
                const unposted = vacancies.filter((v) => {
                  const s = getJobStatus(v).status;
                  return s === 'ready' || s === 'failed';
                });
                setSelectedIds(new Set(unposted.map((v) => v.id)));
                await handleBulkPostSelected(unposted);
              }}
              disabled={isBatchRunning || kpiStats.ready + kpiStats.failed === 0}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#0B132B] hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>POST ALL UNPUBLISHED ({kpiStats.ready + kpiStats.failed})</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by job title, organization, or location..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-slate-500 font-semibold whitespace-nowrap">Status:</span>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="all">All Statuses</option>
              <option value="ready">Ready to Post (Yellow)</option>
              <option value="posted">Posted to TG (Green / Grey)</option>
              <option value="failed">Failed / Retry (Red)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-slate-500 font-semibold whitespace-nowrap">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 max-w-[200px] truncate"
            >
              <option value="all">All 16 Categories</option>
              {OFFICIAL_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Vacancies Queue Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Table Header Controls */}
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleSelectAllVisible}
              className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-950"
            >
              {filteredVacancies.length > 0 && filteredVacancies.every((v) => selectedIds.has(v.id)) ? (
                <CheckSquare className="w-4 h-4 text-amber-500" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Select Visible ({filteredVacancies.length})</span>
            </button>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-semibold text-slate-500">
              Showing {filteredVacancies.length} of {vacancies.length} total vacancies
            </span>
          </div>

          {selectedIds.size > 0 && (
            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              {selectedIds.size} Selected
            </span>
          )}
        </div>

        {/* Vacancies List */}
        {filteredVacancies.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Send className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">No Vacancies in this View</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Upload jobs via Copy-and-Paste or PDF bulk import, or adjust your search filter above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredVacancies.map((job) => {
              const isSelected = selectedIds.has(job.id);
              const jobStatus = getJobStatus(job);
              const isPostingThis = inFlightJobId === job.id;

              return (
                <div
                  key={job.id}
                  className={`p-4 sm:p-5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSelected ? 'bg-amber-50/50' : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Left: Checkbox & Job Core Info */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <button
                      onClick={() => handleToggleSelectJob(job.id)}
                      className="mt-1 flex-shrink-0 text-slate-400 hover:text-amber-500"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-amber-500 fill-amber-100" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        {(job.isWashNgo || isWashNgoVacancyClient(job)) && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400">
                            🟢⭐ WASH JOB
                          </span>
                        )}
                        <span className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                          {job.title}
                        </span>

                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            (job.broadCategory || classifyVacancyBroadSectorClient(job)) === 'Banking'
                              ? 'bg-sky-50 text-sky-900 border-sky-300'
                              : (job.broadCategory || classifyVacancyBroadSectorClient(job)) === 'NGO'
                              ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {job.broadCategory || classifyVacancyBroadSectorClient(job)}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${jobStatus.badgeClass}`}
                        >
                          {jobStatus.label}
                        </span>

                        {job.featured && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                            ★ Featured
                          </span>
                        )}
                      </div>

                      <div className="flex items-center flex-wrap gap-y-1 gap-x-4 text-xs text-slate-600 font-medium">
                        <span className="flex items-center gap-1 font-bold text-slate-800">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {job.organization}
                        </span>
                        <span>•</span>
                        <span className="text-slate-600">{job.category}</span>
                        <span>•</span>
                        <span>{job.location}</span>
                        {job.applicationDeadline && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-500">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              Deadline: {job.applicationDeadline}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Telegram Message Details / Error Row */}
                      {jobStatus.postedAt && (
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>
                            Posted to Telegram on{' '}
                            {new Date(jobStatus.postedAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {jobStatus.messageId && ` (Telegram Msg #${jobStatus.messageId})`}
                          </span>
                        </div>
                      )}

                      {jobStatus.error && (
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-rose-700 font-semibold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-600" />
                          <span>Telegram error: {jobStatus.error}</span>
                        </div>
                      )}
                      {(() => {
                        const gate = evaluateVacancyForTelegramClient(job, effectiveQueueSettings, true, 'vacancy');
                        if (!gate.allowed && gate.reason) {
                          return (
                            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-amber-900 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                              <span>{gate.reason}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center pl-8 md:pl-0">
                    <button
                      onClick={() => setPreviewVacancy(job)}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5"
                      title="Preview Vacancy Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Preview</span>
                    </button>

                    {/* Single Job Post Button */}
                    <button
                      onClick={() => handleSinglePostClick(job)}
                      disabled={isPostingThis || isBatchRunning}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 ${
                        jobStatus.status === 'success' || jobStatus.status === 'already'
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                          : jobStatus.status === 'failed'
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      }`}
                    >
                      {isPostingThis ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>SENDING...</span>
                        </>
                      ) : jobStatus.status === 'success' || jobStatus.status === 'already' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>POST AGAIN</span>
                        </>
                      ) : jobStatus.status === 'failed' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>RETRY TELEGRAM</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 fill-current" />
                          <span>POST TO TELEGRAM</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}

      {/* Duplicate Warning Confirmation Modal */}
      {duplicateWarningJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-center text-slate-900">
              Already Posted to Telegram
            </h3>

            <p className="text-xs text-slate-600 text-center mt-2">
              This job{' '}
              <strong className="text-slate-900">"{duplicateWarningJob.title}"</strong> at{' '}
              <strong>{duplicateWarningJob.organization}</strong> was already successfully posted to
              Telegram{' '}
              {duplicateWarningJob.telegramPublishedAt && (
                <span>
                  on{' '}
                  {new Date(duplicateWarningJob.telegramPublishedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
              .
            </p>

            <p className="text-xs font-semibold text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 mt-4 text-center">
              Are you sure you want to broadcast a duplicate post to your channel subscribers?
            </p>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setDuplicateWarningJob(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const job = duplicateWarningJob;
                  setDuplicateWarningJob(null);
                  executeSinglePost(job, true);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors shadow-sm"
              >
                Yes, Repost Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Batch Modal */}
      {isSaveBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-black">Save Telegram Posting Batch</h3>
              </div>
              <button
                onClick={() => setIsSaveBatchModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBatchModalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Batch Name / Description:
                </label>
                <input
                  type="text"
                  required
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder="e.g., Morning Banking Jobs - 20 Vacancies"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600">
                <p>
                  <strong>Total Vacancies to Save:</strong> {selectedIds.size}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  You can resume this batch anytime from "View Previous Batches".
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveBatchModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0B132B] hover:bg-slate-900 text-white font-black text-xs shadow-md"
                >
                  Save Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Previous Batches & History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 bg-[#0B132B] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  <History className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Telegram Posting Batches History</h3>
                  <p className="text-xs text-slate-400">
                    Track previous sessions, view delivery results, and resume posting incomplete batches.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setSelectedHistoryBatch(null);
                }}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-100">
              {loadingBatches ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                  Loading batch records...
                </div>
              ) : savedBatches.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No saved batches yet. Use "Save as Batch" or run a batch posting session.
                </div>
              ) : selectedHistoryBatch ? (
                // Drill-down into a specific batch
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedHistoryBatch(null)}
                      className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1"
                    >
                      ← Back to All Batches
                    </button>
                    <button
                      onClick={() => handlePublishSavedBatch(selectedHistoryBatch)}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Resume / Post This Batch</span>
                    </button>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <h4 className="font-extrabold text-sm text-slate-900">
                      {selectedHistoryBatch.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Created:{' '}
                      {new Date(selectedHistoryBatch.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • {selectedHistoryBatch.totalCount} Jobs
                    </p>
                    <div className="flex items-center gap-3 mt-3 text-xs font-bold">
                      <span className="text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                        {selectedHistoryBatch.successCount} Posted
                      </span>
                      <span className="text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300">
                        {selectedHistoryBatch.failedCount} Failed
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto border border-slate-200 rounded-2xl">
                    {selectedHistoryBatch.jobs.map((item, idx) => (
                      <div key={idx} className="p-3 text-xs flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{item.title}</p>
                          <p className="text-[11px] text-slate-500">{item.organization}</p>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${
                            item.status === 'success'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : item.status === 'failed'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // List of all batches
                savedBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{batch.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(batch.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • <strong>{batch.totalCount}</strong> Total Vacancies
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {batch.successCount} Posted
                        </span>
                        {batch.failedCount > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            {batch.failedCount} Failed
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {batch.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedHistoryBatch(batch)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => handlePublishSavedBatch(batch)}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Load Batch</span>
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                        title="Delete Batch Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vacancy Detail Modal Preview */}
      {previewVacancy && (
        <VacancyDetailModal
          vacancy={previewVacancy}
          onClose={() => setPreviewVacancy(null)}
          telegramUrl={siteSettings.telegramChannelUrl}
        />
      )}
    </div>
  );
};
