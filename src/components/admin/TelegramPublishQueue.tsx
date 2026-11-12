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
} from 'lucide-react';
import {
  Vacancy,
  SiteSettings,
  TelegramBatchRecord,
  TelegramPostStatus,
  OFFICIAL_CATEGORIES,
} from '../../types/job';
import {
  fetchTelegramBatches,
  saveTelegramBatch,
  deleteTelegramBatch,
} from '../../lib/firebase';
import { VacancyDetailModal } from '../VacancyDetailModal';
import { broadcastJobToTelegram } from '../../utils/telegramClient';

interface Props {
  vacancies: Vacancy[];
  siteSettings: SiteSettings;
  onUpdateVacancy: (vacancy: Vacancy) => Promise<void>;
  onBatchUpdateVacancies?: (vacancies: Vacancy[]) => Promise<void>;
  initialSelectedIds?: string[];
}

export const TelegramPublishQueue: React.FC<Props> = ({
  vacancies,
  siteSettings,
  onUpdateVacancy,
  onBatchUpdateVacancies,
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

  // Feedback Notification
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

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

  const handleSelectAllFailed = () => {
    const failed = vacancies.filter((v) => getJobStatus(v).status === 'failed');
    setSelectedIds(new Set(failed.map((v) => v.id)));
    setNotification({
      type: 'info',
      message: `Selected ${failed.length} failed vacancies to retry posting.`,
    });
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

  // Single Job Post Function
  const executeSinglePost = async (job: Vacancy, forceRetry = false): Promise<boolean> => {
    setInFlightJobId(job.id);
    setNotification(null);

    try {
      const channel = siteSettings.telegramChannelName || '@DreamBigJobsEthiopia';
      const data = await broadcastJobToTelegram(job, channel, siteSettings.telegramBotToken, forceRetry, siteSettings.customDomain);

      if (!data.success) {
        const errorMsg = data.error || 'Telegram broadcast failed';
        setStatusOverrides((prev) => ({
          ...prev,
          [job.id]: { status: 'failed', error: errorMsg },
        }));

        await onUpdateVacancy({
          ...job,
          telegramPublishError: errorMsg,
          updatedAt: new Date().toISOString(),
        });

        setNotification({
          type: 'error',
          message: `❌ Failed to post "${job.title}": ${errorMsg}`,
        });
        return false;
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
        message: `✅ Successfully posted "${job.title}" to ${channel} (Message #${messageId || 'OK'})!`,
      });
      return true;
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
      return false;
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
      executeSinglePost(job, false);
    }
  };

  // Bulk Publishing Workflow (Sequential with safe rate-limiting delay)
  const handleBulkPostSelected = async () => {
    if (selectedIds.size === 0) {
      setNotification({
        type: 'error',
        message: 'Please select at least one vacancy using the checkboxes first.',
      });
      return;
    }

    const jobsToPost = vacancies.filter((v) => selectedIds.has(v.id));
    if (jobsToPost.length === 0) return;

    setIsBatchRunning(true);
    isBatchCancelledRef.current = false;
    setBatchProgress({
      current: 0,
      total: jobsToPost.length,
      currentTitle: 'Initializing safe Telegram publishing queue...',
    });

    let successCount = 0;
    let failedCount = 0;
    const batchJobHistory: TelegramBatchRecord['jobs'] = [];

    for (let i = 0; i < jobsToPost.length; i++) {
      if (isBatchCancelledRef.current) {
        setNotification({
          type: 'info',
          message: `Batch posting stopped by user. Processed ${i} of ${jobsToPost.length}.`,
        });
        break;
      }

      const currentJob = jobsToPost[i];
      setBatchProgress({
        current: i + 1,
        total: jobsToPost.length,
        currentTitle: `Posting (${i + 1}/${jobsToPost.length}): ${currentJob.title} - ${currentJob.organization}`,
      });

      // Post single job sequentially
      const ok = await executeSinglePost(currentJob, false);
      if (ok) {
        successCount++;
        batchJobHistory.push({
          vacancyId: currentJob.id,
          title: currentJob.title,
          organization: currentJob.organization,
          category: currentJob.category,
          status: 'success',
          postedAt: new Date().toISOString(),
        });
      } else {
        failedCount++;
        batchJobHistory.push({
          vacancyId: currentJob.id,
          title: currentJob.title,
          organization: currentJob.organization,
          category: currentJob.category,
          status: 'failed',
          error: statusOverrides[currentJob.id]?.error || 'Failed to broadcast',
        });
      }

      // Safe delay between posts (1.2s) to respect Telegram API rate limits
      if (i < jobsToPost.length - 1 && !isBatchCancelledRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }

    // Auto-record session in batch history
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
      successCount,
      failedCount,
      status: failedCount === 0 ? 'completed' : successCount > 0 ? 'partially_failed' : 'draft',
      jobs: batchJobHistory,
    };

    try {
      await saveTelegramBatch(batchRecord);
      await loadBatches();
    } catch (saveErr) {
      console.warn('Failed to auto-save batch history record:', saveErr);
    }

    setIsBatchRunning(false);
    setBatchProgress(null);

    setNotification({
      type: successCount > 0 ? 'success' : 'error',
      message: `🎉 Batch completed: ${successCount} successfully posted, ${failedCount} failed out of ${jobsToPost.length}.`,
    });
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
                <p className="text-xs sm:text-sm text-slate-400">
                  Target Channel:{' '}
                  <a
                    href={siteSettings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopia'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 font-bold hover:underline inline-flex items-center gap-1"
                  >
                    {siteSettings.telegramChannelName || '@DreamBigJobsEthiopia'}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>{' '}
                  • Review, select, and publish individually or in sequential batches.
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
      </div>

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

      {/* Batch In-Progress Banner */}
      {isBatchRunning && batchProgress && (
        <div className="bg-amber-500 text-slate-950 p-5 rounded-3xl shadow-lg border-2 border-amber-600 animate-pulse">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-950" />
              <span className="font-extrabold text-sm sm:text-base">
                Sequential Telegram Publishing in Progress...
              </span>
            </div>
            <button
              onClick={() => {
                isBatchCancelledRef.current = true;
              }}
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
                width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-900 mt-2">
            <span>
              Processing {batchProgress.current} of {batchProgress.total} vacancies
            </span>
            <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}% Complete</span>
          </div>
        </div>
      )}

      {/* Control Bar: Presets & Batch Actions */}
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
              onClick={handleBulkPostSelected}
              disabled={isBatchRunning || selectedIds.size === 0}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-md active:scale-95"
            >
              <Send className="w-4 h-4 fill-current" />
              <span>POST SELECTED TO TELEGRAM ({selectedIds.size})</span>
            </button>

            <button
              onClick={async () => {
                handleSelectAllUnpublished();
                setTimeout(() => {
                  handleBulkPostSelected();
                }, 100);
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
                        <span className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                          {job.title}
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
