import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Trash2,
  RotateCcw,
  Eye,
  CheckCircle2,
  Building,
  Calendar,
  Layers,
  Search,
  RefreshCw,
  Archive,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { DuplicateReportItem, Vacancy } from '../../types/job';
import { VacancyDetailModal } from '../VacancyDetailModal';
import {
  auditAllExistingVacancies,
  checkDuplicateVacancy,
} from '../../utils/duplicateDetector';

interface Props {
  duplicateReports: DuplicateReportItem[];
  allVacancies: Vacancy[];
  onDiscardDuplicate: (reportId: string) => Promise<void>;
  onRestoreDuplicate: (report: DuplicateReportItem) => Promise<void>;
  onSaveVacancy?: (vacancy: Vacancy) => Promise<void>;
  onBatchUpdateVacancies?: (vacancies: Vacancy[]) => Promise<void>;
  onDeleteVacancy?: (id: string) => Promise<void>;
  onBatchDeleteVacancies?: (ids: string[]) => Promise<void>;
  onUpdateVacancyStatus?: (id: string, status: Vacancy['status'], deadline?: string) => Promise<void>;
  telegramUrl: string;
}

export interface InternalDuplicatePair {
  id: string;
  original: Vacancy;
  duplicate: Vacancy;
  similarityScore: number;
  reason: string;
  detectedAt: string;
}

export const DuplicateCenter: React.FC<Props> = ({
  duplicateReports,
  allVacancies,
  onDiscardDuplicate,
  onRestoreDuplicate,
  onSaveVacancy,
  onBatchUpdateVacancies,
  onDeleteVacancy,
  onBatchDeleteVacancies,
  onUpdateVacancyStatus,
  telegramUrl,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'alwaysInside' | 'uploadQueue'>('alwaysInside');
  const [selectedInspectVacancy, setSelectedInspectVacancy] = useState<Vacancy | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [autoDeleteOnAudit, setAutoDeleteOnAudit] = useState(false);

  // Internal Audit State ("Always inside strictly")
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgressMessage, setAuditProgressMessage] = useState('');
  const [internalPairs, setInternalPairs] = useState<InternalDuplicatePair[]>([]);
  const [dismissedPairIds, setDismissedPairIds] = useState<Set<string>>(new Set());
  const [lastAuditTime, setLastAuditTime] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [isBulkDiscardingUploads, setIsBulkDiscardingUploads] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    tone: 'danger' | 'warning';
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Search filter inside duplicate lists
  const [searchQuery, setSearchQuery] = useState('');

  // Run full internal duplicate audit across all stored vacancies
  const handleRunFullAudit = async () => {
    setIsAuditing(true);
    setActionSuccessMessage(null);
    setAuditProgressMessage('Scanning all vacancies currently in the database...');

    try {
      // Step 1: Client-side strict audit with multi-tier engine
      const clientReports = auditAllExistingVacancies(allVacancies);

      // Step 2: Also query server audit endpoint for backend consistency
      let serverPairs: any[] = [];
      try {
        const res = await fetch('/api/admin/scan-existing-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vacancies: allVacancies }),
        });
        const data = await res.json();
        if (data?.success && Array.isArray(data.duplicatePairs)) {
          serverPairs = data.duplicatePairs;
        }
      } catch (srvErr) {
        console.warn('Server audit endpoint notice (using client audit):', srvErr);
      }

      // Merge and construct full internal pairs
      const pairs: InternalDuplicatePair[] = [];
      const processed = new Set<string>();

      // From clientReports
      for (const rep of clientReports) {
        const orig = allVacancies.find((v) => v.id === rep.matchedVacancyId);
        const dup = (rep.candidateData as Vacancy) || allVacancies.find((v) => v.id === rep.id);
        if (orig && dup && orig.id !== dup.id) {
          const key = [orig.id, dup.id].sort().join('___');
          if (!processed.has(key)) {
            processed.add(key);
            pairs.push({
              id: `pair_${key}`,
              original: orig,
              duplicate: dup,
              similarityScore: rep.similarityScore,
              reason: rep.reason,
              detectedAt: rep.detectedAt || new Date().toISOString(),
            });
          }
        }
      }

      // From serverPairs
      for (const sp of serverPairs) {
        const orig = allVacancies.find((v) => v.id === sp.originalId);
        const dup = allVacancies.find((v) => v.id === sp.duplicateId);
        if (orig && dup && orig.id !== dup.id) {
          const key = [orig.id, dup.id].sort().join('___');
          if (!processed.has(key)) {
            processed.add(key);
            pairs.push({
              id: `pair_${key}`,
              original: orig,
              duplicate: dup,
              similarityScore: sp.similarityScore || 0.95,
              reason: sp.reason || 'Server detected duplicate',
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }

      setInternalPairs(pairs);
      setLastAuditTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setActionSuccessMessage(
        pairs.length === 0
          ? 'Full database audit complete: 0 duplicates detected. All stored vacancies are strictly unique!'
          : `Audit complete: detected ${pairs.length} duplicate ${pairs.length === 1 ? 'pair' : 'pairs'} inside the database.`
      );
    } catch (err: any) {
      setActionErrorMessage('Error running database duplicate audit: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsAuditing(false);
      setAuditProgressMessage('');
    }
  };

  // Run initial scan on component load once
  useEffect(() => {
    if (allVacancies.length > 1 && internalPairs.length === 0 && !lastAuditTime) {
      handleRunFullAudit();
    }
  }, [allVacancies.length]);

  // Archive a specific duplicate vacancy so it is removed from public categories & Telegram
  const handleArchiveDuplicateVacancy = async (pair: InternalDuplicatePair) => {
    setActionLoadingId(pair.id);
    try {
      const dup = pair.duplicate;
      if (onUpdateVacancyStatus) {
        await onUpdateVacancyStatus(dup.id, 'archived');
      } else if (onSaveVacancy) {
        await onSaveVacancy({
          ...dup,
          status: 'archived',
          duplicateOfId: pair.original.id,
          duplicateReason: pair.reason,
          updatedAt: new Date().toISOString(),
        });
      }

      // Remove from active pair list
      setInternalPairs((prev) => prev.filter((p) => p.id !== pair.id));
      setActionSuccessMessage(
        `Archived duplicate "${dup.title}" (ID: ${dup.id}). It has been removed from website categories and the Telegram publishing queue.`
      );
    } catch (err: any) {
      setActionErrorMessage('Error archiving duplicate vacancy: ' + (err?.message || 'Unknown error'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Permanently delete a single duplicate vacancy
  const handleDeleteDuplicateVacancy = (pair: InternalDuplicatePair) => {
    setActionErrorMessage(null);
    setPendingConfirm({
      title: 'Delete Duplicate Vacancy Permanently?',
      message: `Permanently delete duplicate vacancy "${pair.duplicate.title}" (ID: ${pair.duplicate.id})? The original record will remain untouched.`,
      confirmLabel: 'Delete Permanently',
      tone: 'danger',
      onConfirm: async () => {
        setActionLoadingId(pair.id);
        try {
          if (onDeleteVacancy) {
            await onDeleteVacancy(pair.duplicate.id);
          }
          setInternalPairs((prev) => prev.filter((p) => p.id !== pair.id));
          setActionSuccessMessage(`Permanently deleted duplicate vacancy "${pair.duplicate.title}".`);
        } catch (err: any) {
          setActionErrorMessage('Error deleting duplicate vacancy: ' + (err?.message || 'Unknown error'));
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  // Dismiss a duplicate pair as distinct
  const handleDismissPair = (pairId: string) => {
    setDismissedPairIds((prev) => new Set([...prev, pairId]));
  };

  // Batch archive all detected duplicates in one click
  const handleBatchArchiveAllDuplicates = () => {
    const activePairs = internalPairs.filter((p) => !dismissedPairIds.has(p.id));
    if (activePairs.length === 0) return;
    setActionErrorMessage(null);
    setPendingConfirm({
      title: `Archive All ${activePairs.length} Duplicate Vacancies?`,
      message: `Archive all ${activePairs.length} duplicate vacancies so they are immediately hidden from public website categories and the Telegram queue?`,
      confirmLabel: `Archive All (${activePairs.length})`,
      tone: 'warning',
      onConfirm: async () => {
        setIsAuditing(true);
        setActionSuccessMessage(null);
        try {
          const duplicatesToArchive = activePairs.map((pair) => ({
            ...pair.duplicate,
            status: 'archived' as const,
            duplicateOfId: pair.original.id,
            duplicateReason: pair.reason,
            updatedAt: new Date().toISOString(),
          }));

          if (onBatchUpdateVacancies) {
            await onBatchUpdateVacancies(duplicatesToArchive);
          } else if (onSaveVacancy) {
            for (const dup of duplicatesToArchive) {
              await onSaveVacancy(dup);
            }
          }

          setInternalPairs([]);
          setActionSuccessMessage(
            `Archived ${duplicatesToArchive.length} duplicate vacancies. Public categories and Telegram queue are now clean.`
          );
        } catch (err: any) {
          setActionErrorMessage('Error batch archiving duplicates: ' + (err?.message || 'Unknown error'));
        } finally {
          setIsAuditing(false);
        }
      },
    });
  };

  // Permanently delete all detected database duplicate vacancies in one click
  const handleAutoDeleteAllDuplicates = () => {
    const activePairs = internalPairs.filter((p) => !dismissedPairIds.has(p.id));
    if (activePairs.length === 0) {
      setActionErrorMessage('No duplicate vacancies currently detected to delete.');
      return;
    }
    setActionErrorMessage(null);
    setPendingConfirm({
      title: `Delete All ${activePairs.length} Duplicate Vacancies Permanently?`,
      message: `This will permanently delete ${activePairs.length} duplicate records from the database while keeping every original unique vacancy intact.`,
      confirmLabel: `Delete All Duplicates (${activePairs.length})`,
      tone: 'danger',
      onConfirm: async () => {
        setIsAuditing(true);
        setActionSuccessMessage(null);
        try {
          const duplicateIds = Array.from(new Set(activePairs.map((pair) => pair.duplicate.id)));
          if (onBatchDeleteVacancies) {
            await onBatchDeleteVacancies(duplicateIds);
          } else if (onDeleteVacancy) {
            for (const id of duplicateIds) {
              await onDeleteVacancy(id);
            }
          }

          setInternalPairs([]);
          setActionSuccessMessage(
            `Permanently deleted all ${duplicateIds.length} duplicate vacancies. All website categories and the Telegram queue now contain only unique records.`
          );
        } catch (err: any) {
          setActionErrorMessage('Error deleting duplicates: ' + (err?.message || 'Unknown error'));
        } finally {
          setIsAuditing(false);
        }
      },
    });
  };

  // Restore uploaded duplicate candidate to pending queue
  const handleRestore = async (rep: DuplicateReportItem) => {
    setActionErrorMessage(null);
    setActionLoadingId(rep.id);
    try {
      await onRestoreDuplicate(rep);
      setActionSuccessMessage(`Restored "${rep.candidateTitle}" to the review queue as a distinct vacancy.`);
    } catch (err: any) {
      setActionErrorMessage('Error restoring duplicate: ' + (err?.message || 'Unknown error'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Permanently discard a single uploaded duplicate report
  const handleDiscard = (report: DuplicateReportItem) => {
    setActionErrorMessage(null);
    setPendingConfirm({
      title: 'Discard Duplicate Record Permanently?',
      message: `Permanently delete screened duplicate "${report.candidateTitle}" (${report.candidateOrg}) from the upload discard queue?`,
      confirmLabel: 'Discard Permanently',
      tone: 'danger',
      onConfirm: async () => {
        setActionLoadingId(report.id);
        try {
          await onDiscardDuplicate(report.id);
          setActionSuccessMessage(`Permanently deleted duplicate record "${report.candidateTitle}".`);
        } catch (err: any) {
          setActionErrorMessage('Error discarding duplicate: ' + (err?.message || 'Unknown error'));
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  // Permanently delete ALL uploaded duplicate reports in the queue
  const handleDeleteAllUploadDuplicates = () => {
    const targets = filteredUploadReports;
    if (targets.length === 0) return;
    setActionErrorMessage(null);
    setPendingConfirm({
      title: `Delete All ${targets.length} Screened Duplicates Permanently?`,
      message: `This will permanently delete ${targets.length} duplicate ${targets.length === 1 ? 'record' : 'records'} from the Upload Screening Discard Queue. Existing published originals are not affected.`,
      confirmLabel: `Delete All Duplicates (${targets.length})`,
      tone: 'danger',
      onConfirm: async () => {
        setIsBulkDiscardingUploads(true);
        setActionSuccessMessage(null);
        let deletedCount = 0;
        let failedCount = 0;
        try {
          for (const report of targets) {
            try {
              await onDiscardDuplicate(report.id);
              deletedCount += 1;
            } catch {
              failedCount += 1;
            }
          }
          if (failedCount > 0) {
            setActionErrorMessage(
              `Deleted ${deletedCount} duplicate records, but ${failedCount} could not be removed. Please try again.`
            );
          } else {
            setActionSuccessMessage(
              `Permanently deleted all ${deletedCount} screened duplicate ${deletedCount === 1 ? 'record' : 'records'} from the discard queue.`
            );
          }
        } finally {
          setIsBulkDiscardingUploads(false);
        }
      },
    });
  };

  // Filtered internal pairs
  const filteredInternalPairs = useMemo(() => {
    return internalPairs
      .filter((p) => !dismissedPairIds.has(p.id))
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.original.title.toLowerCase().includes(q) ||
          p.original.organization.toLowerCase().includes(q) ||
          p.duplicate.title.toLowerCase().includes(q) ||
          p.duplicate.organization.toLowerCase().includes(q) ||
          p.reason.toLowerCase().includes(q)
        );
      });
  }, [internalPairs, dismissedPairIds, searchQuery]);

  // Filtered upload screening reports
  const filteredUploadReports = useMemo(() => {
    return duplicateReports.filter((rep) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        rep.candidateTitle.toLowerCase().includes(q) ||
        rep.candidateOrg.toLowerCase().includes(q) ||
        rep.matchedTitle.toLowerCase().includes(q) ||
        rep.matchedOrg.toLowerCase().includes(q) ||
        rep.reason.toLowerCase().includes(q)
      );
    });
  }, [duplicateReports, searchQuery]);

  const activeDuplicatesCount = filteredInternalPairs.length;

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Strict Duplicate Protection & Audit Center</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#0B132B]">
              Duplicate Vacancy Detection Engine
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Guarantees 100% unique vacancies across HOPELAND JOBS. Automatically screens incoming
              uploads (copy-paste, PDF, TXT) and continuously audits all vacancies currently stored in the
              database.
            </p>
          </div>

          {/* KPI Mini-Cards */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200 text-center min-w-[100px]">
              <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">
                Total in DB
              </span>
              <span className="text-xl font-black text-slate-900">{allVacancies.length}</span>
            </div>

            <div className={`px-4 py-2.5 rounded-2xl border text-center min-w-[110px] ${
              activeDuplicatesCount > 0
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}>
              <span className="text-[10px] block font-bold uppercase tracking-wider">
                {activeDuplicatesCount > 0 ? 'Internal Dups' : 'DB Clean'}
              </span>
              <span className="text-xl font-black">
                {activeDuplicatesCount > 0 ? activeDuplicatesCount : '0 (Clean)'}
              </span>
            </div>

            <div className="bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200 text-center min-w-[110px]">
              <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">
                Screened Uploads
              </span>
              <span className="text-xl font-black text-amber-700">{duplicateReports.length}</span>
            </div>
          </div>
        </div>

        {/* Action & Feedback Messages */}
        {actionSuccessMessage && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-3 text-emerald-900 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionSuccessMessage(null)}
              className="text-xs text-emerald-700 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
        {actionErrorMessage && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-300 flex items-center justify-between gap-3 text-rose-900 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionErrorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionErrorMessage(null)}
              className="text-xs text-rose-700 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Sub-Tabs: Always Inside vs Upload Queue */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-2">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setActiveSubTab('alwaysInside')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'alwaysInside'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>Database Audit (Always Inside)</span>
              {activeDuplicatesCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                  {activeDuplicatesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('uploadQueue')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'uploadQueue'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Upload Screening Discard Queue</span>
              {duplicateReports.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black">
                  {duplicateReports.length}
                </span>
              )}
            </button>
          </div>

          {/* Audit Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunFullAudit}
              disabled={isAuditing || isBulkDiscardingUploads}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isAuditing ? 'Auditing Database...' : 'Run Full Database Audit'}</span>
            </button>

            {activeSubTab === 'alwaysInside' && activeDuplicatesCount > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleAutoDeleteAllDuplicates}
                  disabled={isAuditing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  title="Permanently delete all detected duplicate vacancies from the database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete All Duplicates ({activeDuplicatesCount})</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchArchiveAllDuplicates}
                  disabled={isAuditing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  title="Archive all duplicate vacancies so they disappear from categories and Telegram"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive All (1-Click)</span>
                </button>
              </>
            )}

            {activeSubTab === 'uploadQueue' && filteredUploadReports.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllUploadDuplicates}
                disabled={isBulkDiscardingUploads}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                title="Permanently delete all screened duplicate records in the upload discard queue"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isBulkDiscardingUploads
                    ? 'Deleting All Duplicates...'
                    : `Delete All Duplicates (${filteredUploadReports.length})`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mt-4">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search duplicates by job title, organization, or match reason..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 outline-none bg-slate-50/50"
          />
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* TAB 1: ALWAYS INSIDE DATABASE AUDITOR */}
        {/* ------------------------------------------------------------------------- */}
        {activeSubTab === 'alwaysInside' && (
          <div className="mt-6 space-y-4">
            {isAuditing ? (
              <div className="py-16 text-center max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">
                  Scanning All Stored Vacancies for Duplicates...
                </h3>
                <p className="text-xs text-slate-500">
                  {auditProgressMessage || 'Applying Ethiopian organization aliases, reference code verification, and multi-tier title matching.'}
                </p>
              </div>
            ) : filteredInternalPairs.length === 0 ? (
              <div className="py-16 text-center max-w-md mx-auto">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Database Is 100% Unique & Clean
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  No internal duplicate vacancies were detected among the {allVacancies.length} records.
                  {lastAuditTime && ` Last verified at ${lastAuditTime}.`}
                </p>
                <div className="mt-4">
                  <button
                    onClick={handleRunFullAudit}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run Audit Again</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                  <span>
                    Showing <strong>{filteredInternalPairs.length}</strong> detected duplicate{' '}
                    {filteredInternalPairs.length === 1 ? 'pair' : 'pairs'} inside the database:
                  </span>
                  {lastAuditTime && <span>Audited at {lastAuditTime}</span>}
                </div>

                {filteredInternalPairs.map((pair) => {
                  const scorePercent = Math.round(pair.similarityScore * 100);
                  const isExactRef = pair.reason.toLowerCase().includes('reference');

                  return (
                    <div
                      key={pair.id}
                      className="bg-amber-50/40 rounded-2xl p-5 border-2 border-amber-200/90 hover:border-amber-400 transition-all space-y-4 shadow-sm"
                    >
                      {/* Top Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-mono uppercase font-black px-2.5 py-0.5 rounded ${
                                isExactRef
                                  ? 'bg-rose-200 text-rose-950 border border-rose-300'
                                  : 'bg-amber-200 text-amber-950 border border-amber-300'
                              }`}
                            >
                              Match Confidence: {scorePercent}% {isExactRef ? '— Exact Ref #' : ''}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              Detected: {new Date(pair.detectedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-amber-950 mt-1.5">
                            <strong>Detection Reason:</strong> {pair.reason}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDismissPair(pair.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Acknowledge both vacancies as distinct and dismiss duplicate warning"
                          >
                            <Check className="w-3.5 h-3.5 text-slate-500" />
                            <span>Keep Both (Distinct)</span>
                          </button>
                        </div>
                      </div>

                      {/* Side-by-Side Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {/* Duplicate Record (Candidate for archiving) */}
                        <div className="bg-white p-4 rounded-xl border-2 border-amber-300 space-y-2 relative">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold uppercase text-[10px] tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                              Duplicate Record (ID: {pair.duplicate.id})
                            </span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              Status: {pair.duplicate.status}
                            </span>
                          </div>
                          <div className="font-black text-slate-900 text-sm leading-snug">
                            {pair.duplicate.title}
                          </div>
                          <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span>{pair.duplicate.organization}</span>
                          </div>
                          <div className="text-slate-500 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Deadline: {pair.duplicate.applicationDeadline || 'N/A'}</span>
                          </div>
                          {pair.duplicate.referenceNumber &&
                            pair.duplicate.referenceNumber !== 'Not specified in the original vacancy' && (
                              <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded">
                                Ref: {pair.duplicate.referenceNumber}
                              </div>
                            )}
                          <div className="text-slate-500 line-clamp-2 pt-1 border-t border-slate-100">
                            {pair.duplicate.description}
                          </div>
                        </div>

                        {/* Existing Original Vacancy */}
                        <div className="bg-white p-4 rounded-xl border border-emerald-300 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold uppercase text-[10px] tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                              Existing Original Record (ID: {pair.original.id})
                            </span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Status: {pair.original.status}
                            </span>
                          </div>
                          <div className="font-black text-slate-900 text-sm leading-snug">
                            {pair.original.title}
                          </div>
                          <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span>{pair.original.organization}</span>
                          </div>
                          <div className="text-slate-500 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Deadline: {pair.original.applicationDeadline || 'N/A'}</span>
                          </div>
                          {pair.original.referenceNumber &&
                            pair.original.referenceNumber !== 'Not specified in the original vacancy' && (
                              <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded">
                                Ref: {pair.original.referenceNumber}
                              </div>
                            )}
                          <div className="text-slate-500 line-clamp-2 pt-1 border-t border-slate-100">
                            {pair.original.description}
                          </div>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-amber-200/60">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedInspectVacancy(pair.duplicate)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect Duplicate</span>
                          </button>
                          <button
                            onClick={() => setSelectedInspectVacancy(pair.original)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect Original</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleArchiveDuplicateVacancy(pair)}
                            disabled={actionLoadingId === pair.id}
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm"
                            title="Mark status as archived so it is hidden from website categories and Telegram queue"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>Archive Duplicate</span>
                          </button>

                          {onDeleteVacancy && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDuplicateVacancy(pair)}
                              disabled={actionLoadingId === pair.id}
                              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer"
                              title="Permanently delete this duplicate vacancy record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Permanently</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* TAB 2: UPLOAD SCREENING DISCARD QUEUE (While Uploaded Strictly) */}
        {/* ------------------------------------------------------------------------- */}
        {activeSubTab === 'uploadQueue' && (
          <div className="mt-6 space-y-4">
            {filteredUploadReports.length === 0 ? (
              <div className="py-16 text-center max-w-md mx-auto">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Upload Discard Queue Is Empty
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  No duplicate candidates are currently isolated from upload batches. When you import
                  vacancies from bulk copy-paste or document files, any duplicate candidates will appear here
                  for review.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 px-1">
                  <span>
                    Showing <strong>{filteredUploadReports.length}</strong> candidates isolated during
                    vacancy uploads:
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteAllUploadDuplicates}
                    disabled={isBulkDiscardingUploads}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {isBulkDiscardingUploads
                        ? 'Deleting All...'
                        : `Delete All Duplicates (${filteredUploadReports.length})`}
                    </span>
                  </button>
                </div>

                {filteredUploadReports.map((report) => {
                  const originalVacancy = allVacancies.find(
                    (v) => v.id === report.matchedVacancyId
                  );

                  return (
                    <div
                      key={report.id}
                      className="bg-amber-50/30 rounded-2xl p-5 border border-amber-200/80 hover:border-amber-400 transition-all space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <span className="text-[11px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-amber-200/60 text-amber-900">
                            Match Confidence: {Math.round(report.similarityScore * 100)}%
                          </span>
                          <h4 className="text-base font-bold text-[#0B132B] mt-1">
                            Candidate: {report.candidateTitle}
                          </h4>
                          <p className="text-xs font-semibold text-slate-600">
                            Organization: {report.candidateOrg}
                          </p>
                        </div>

                        <div className="text-xs text-slate-400 sm:text-right">
                          Detected: {new Date(report.detectedAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Reason */}
                      <div className="bg-white p-3.5 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                        <span className="font-bold shrink-0">Reason:</span>
                        <span>{report.reason}</span>
                      </div>

                      {/* Side-by-side comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {/* Candidate */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
                          <div className="font-bold uppercase text-[10px] tracking-wider text-amber-700">
                            Excluded Candidate (Upload Stream)
                          </div>
                          <div className="font-bold text-slate-900">{report.candidateTitle}</div>
                          <div className="text-slate-600">{report.candidateOrg}</div>
                          <div className="text-slate-500">
                            Deadline: {report.candidateData.applicationDeadline || 'N/A'}
                          </div>
                          <div className="text-slate-500 line-clamp-2">
                            {report.candidateData.description || 'No description'}
                          </div>
                        </div>

                        {/* Matched Original */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
                          <div className="font-bold uppercase text-[10px] tracking-wider text-emerald-700">
                            Existing Original Vacancy (ID: {report.matchedVacancyId})
                          </div>
                          <div className="font-bold text-slate-900">{report.matchedTitle}</div>
                          <div className="text-slate-600">{report.matchedOrg}</div>
                          <div className="text-slate-500">
                            Deadline: {report.matchedDeadline || 'N/A'}
                          </div>
                          {originalVacancy && (
                            <div className="text-slate-500 line-clamp-2">
                              {originalVacancy.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setSelectedInspectVacancy(report.candidateData as Vacancy)
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Candidate Details</span>
                          </button>

                          {originalVacancy && (
                            <button
                              onClick={() => setSelectedInspectVacancy(originalVacancy)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Original Vacancy</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRestore(report)}
                            disabled={actionLoadingId === report.id}
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm"
                            title="Restore to Review Queue if this is actually a distinct position"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore as Distinct Vacancy</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDiscard(report)}
                            disabled={actionLoadingId === report.id || isBulkDiscardingUploads}
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                            title="Permanently remove this duplicate record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Discard Permanently</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline Confirmation Modal (Iframe-safe replacement for window.confirm) */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  pendingConfirm.tone === 'danger'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">{pendingConfirm.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{pendingConfirm.message}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = pendingConfirm.onConfirm;
                  setPendingConfirm(null);
                  await action();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                  pendingConfirm.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {pendingConfirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Inspection Modal */}
      {selectedInspectVacancy && (
        <VacancyDetailModal
          vacancy={selectedInspectVacancy}
          onClose={() => setSelectedInspectVacancy(null)}
          telegramUrl={telegramUrl}
        />
      )}
    </div>
  );
};
