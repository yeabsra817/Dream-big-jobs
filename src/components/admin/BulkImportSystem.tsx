import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronRight,
  Eye,
  Check,
  Building,
  Calendar,
  MapPin,
  HelpCircle,
  Clock,
  ArrowRight,
  FileUp,
  Zap,
  Send,
  ExternalLink,
} from 'lucide-react';
import {
  Vacancy,
  OFFICIAL_CATEGORIES,
  BulkImportStats,
  DuplicateReportItem,
  JobCategoryName,
} from '../../types/job';
import { SAMPLE_BULK_PASTE_DATA } from '../../utils/helpers';
import { VacancyDetailModal } from '../VacancyDetailModal';

interface Props {
  existingVacancies: Vacancy[];
  onPublishVacancies: (vacancies: Vacancy[]) => Promise<void>;
  onSaveDrafts: (vacancies: Vacancy[]) => Promise<void>;
  onDuplicatesFound: (reports: DuplicateReportItem[]) => void;
  telegramUrl: string;
  siteSettings?: import('../../types/job').SiteSettings;
  onSendToTelegramQueue?: (vacancies: Vacancy[]) => void;
}

export const BulkImportSystem: React.FC<Props> = ({
  existingVacancies,
  onPublishVacancies,
  onSaveDrafts,
  onDuplicatesFound,
  telegramUrl,
  siteSettings,
  onSendToTelegramQueue,
}) => {
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  // Results
  const [extractedVacancies, setExtractedVacancies] = useState<Vacancy[]>([]);
  const [duplicateReports, setDuplicateReports] = useState<DuplicateReportItem[]>([]);
  const [stats, setStats] = useState<BulkImportStats | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('All');
  const [previewVacancy, setPreviewVacancy] = useState<Vacancy | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload handler (TXT, DOCX, PDF)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    setErrorMessage(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Failed to extract text from file');
      } else {
        setRawText((prev) => (prev ? `${prev}\n\n${data.text}` : data.text));
      }
    } catch (err: any) {
      setErrorMessage('Error uploading file: ' + err.message);
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ONE-CLICK PROCESS & DIRECTLY PUBLISH TO WEBSITE CATEGORIES + TELEGRAM
  const handleProcessAndPublishDirectly = async () => {
    if (!rawText.trim()) {
      setErrorMessage('Please paste vacancy announcements or upload a document first.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingStep('Separating and extracting Ethiopian vacancies with AI & Smart Engine...');

    try {
      // Step 1: Extraction
      const geminiRes = await fetch('/api/gemini/parse-bulk-vacancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });

      const geminiData = await geminiRes.json();
      if (!geminiRes.ok || !geminiData.success) {
        throw new Error(geminiData.error || 'Vacancy extraction failed.');
      }

      setProcessingStep('Checking for duplicate vacancies against existing records...');

      // Step 2: Intelligent Duplicate Detection
      const dupRes = await fetch('/api/admin/detect-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: geminiData.vacancies,
          existingVacancies,
        }),
      });

      const dupData = await dupRes.json();
      if (!dupRes.ok || !dupData.success) {
        throw new Error(dupData.error || 'Duplicate detection failed.');
      }

      setStats(dupData.stats);
      if (dupData.duplicatesReport.length > 0) {
        setDuplicateReports(dupData.duplicatesReport);
        onDuplicatesFound(dupData.duplicatesReport);
      }

      const validList: Vacancy[] = dupData.validCandidates || [];
      if (validList.length === 0) {
        setErrorMessage('All pasted vacancies were matched as existing duplicates. No new vacancies to publish.');
        return;
      }

      setProcessingStep(`Publishing ${validList.length} vacancies to website categories & broadcasting to Telegram...`);

      // Step 3: Prepare and publish
      let toPublish = validList.map((v) => ({
        ...v,
        status: 'published' as const,
        publishedAt: new Date().toISOString(),
      }));

      // Broadcast to Telegram
      let telegramNote = '';
      try {
        const channel = siteSettings?.telegramChannelName || '@DreamBigJobsEthiopia';
        const tgRes = await fetch('/api/admin/batch-telegram-publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vacancies: toPublish,
            channelName: channel,
          }),
        });
        const tgData = await tgRes.json();
        if (tgData?.results && Array.isArray(tgData.results)) {
          const resultMap = new Map<string, any>(tgData.results.map((r: any) => [r.id, r]));
          toPublish = toPublish.map((vac) => {
            const resItem = resultMap.get(vac.id);
            if (resItem?.status === 'success') {
              return {
                ...vac,
                telegramPublished: true,
                telegramMessageId: resItem.telegramMessageId,
                telegramPublishedAt: resItem.telegramPublishedAt,
              };
            }
            return vac;
          });
          const telegramCount = toPublish.filter((v) => v.telegramPublished).length;
          if (telegramCount > 0) {
            telegramNote = ` and broadcasted ${telegramCount} to ${channel}`;
          }
        } else if (tgData?.error?.includes('not configured')) {
          telegramNote = ' (Note: Configure Telegram Bot Token in Admin Settings to enable channel broadcasts)';
        }
      } catch (tgErr) {
        console.warn('Telegram broadcast notice:', tgErr);
      }

      // Save to database
      await onPublishVacancies(toPublish);

      // Clear form
      setRawText('');
      setExtractedVacancies([]);
      setSelectedIds(new Set());

      const sectors = Array.from(new Set(toPublish.map((v) => v.category))).join(', ');
      setSuccessMessage(
        `🎉 Successfully published ${toPublish.length} vacancies to website categories (${sectors})${telegramNote}! Loading into Telegram Publishing Queue...`
      );

      // Forward to Telegram Publishing Queue for review & batching
      if (onSendToTelegramQueue) {
        onSendToTelegramQueue(toPublish);
      }
    } catch (err: any) {
      setErrorMessage('Publishing Error: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // Bulk Process with Gemini AI & Review Before Publishing
  const handleProcessWithAI = async () => {
    if (!rawText.trim()) {
      setErrorMessage('Please paste vacancies text or upload a document first.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingStep('Separating and extracting Ethiopian vacancies with AI & Smart Engine...');

    try {
      // Step 1: Gemini extraction
      const geminiRes = await fetch('/api/gemini/parse-bulk-vacancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });

      const geminiData = await geminiRes.json();
      if (!geminiRes.ok || !geminiData.success) {
        throw new Error(geminiData.error || 'Gemini vacancy extraction failed.');
      }

      setProcessingStep('Assigning categories from 16 Ethiopian sectors & detecting duplicates...');

      // Step 2: Intelligent Duplicate Detection
      const dupRes = await fetch('/api/admin/detect-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: geminiData.vacancies,
          existingVacancies,
        }),
      });

      const dupData = await dupRes.json();
      if (!dupRes.ok || !dupData.success) {
        throw new Error(dupData.error || 'Duplicate detection failed.');
      }

      // Step 3: Populate organized vacancies & duplicate report
      setExtractedVacancies(dupData.validCandidates);
      setDuplicateReports(dupData.duplicatesReport);
      setStats(dupData.stats);

      // Select all valid candidates by default for publication review
      const allIds = new Set<string>(dupData.validCandidates.map((v: Vacancy) => v.id));
      setSelectedIds(allIds);

      // Notify parent to save duplicate report to database
      if (dupData.duplicatesReport.length > 0) {
        onDuplicatesFound(dupData.duplicatesReport);
      }

      setSuccessMessage(
        `Extracted ${dupData.validCandidates.length} vacancies across ${
          new Set(dupData.validCandidates.map((v: Vacancy) => v.category)).size
        } categories! Scroll down to review and click Publish.`
      );

      // Auto scroll to review section
      setTimeout(() => {
        document.getElementById('review-extracted-vacancies')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err: any) {
      setErrorMessage('Processing Error: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredVacancies.map((v) => v.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Change category of an extracted vacancy manually
  const handleChangeCategory = (id: string, newCategory: JobCategoryName) => {
    setExtractedVacancies((prev) =>
      prev.map((v) => (v.id === id ? { ...v, category: newCategory } : v))
    );
  };

  // Filter organized vacancies by category tab
  const filteredVacancies = extractedVacancies.filter(
    (v) => selectedCategoryTab === 'All' || v.category === selectedCategoryTab
  );

  // Unique categories detected in this batch
  const detectedCategoryNames = Array.from(new Set(extractedVacancies.map((v) => v.category)));

  // Publish Selected
  const handlePublishSelected = async () => {
    const toPublish = extractedVacancies
      .filter((v) => selectedIds.has(v.id))
      .map((v) => ({
        ...v,
        status: 'published' as const,
        publishedAt: new Date().toISOString(),
      }));

    if (toPublish.length === 0) {
      alert('Please select at least one vacancy to publish.');
      return;
    }

    setIsSaving(true);
    try {
      let finalToPublish = [...toPublish];

      // Automatically publish to Telegram channel if enabled
      if (siteSettings?.telegramAutoPublish) {
        try {
          const channel = siteSettings.telegramChannelName || '@DreamBigJobsEthiopia';
          const tgRes = await fetch('/api/admin/batch-telegram-publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vacancies: toPublish,
              channelName: channel,
            }),
          });
          const tgData = await tgRes.json();
          if (tgData?.results && Array.isArray(tgData.results)) {
            const resultMap = new Map<string, any>(tgData.results.map((r: any) => [r.id, r]));
            finalToPublish = finalToPublish.map((vac) => {
              const resItem = resultMap.get(vac.id);
              if (resItem?.status === 'success') {
                return {
                  ...vac,
                  telegramPublished: true,
                  telegramMessageId: resItem.telegramMessageId,
                  telegramPublishedAt: resItem.telegramPublishedAt,
                };
              } else if (resItem?.status === 'failed') {
                return {
                  ...vac,
                  telegramPublished: false,
                  telegramPublishError: resItem.error,
                };
              }
              return vac;
            });
          }
        } catch (tgBatchErr) {
          console.warn('Batch Telegram broadcast skipped or failed:', tgBatchErr);
        }
      }

      await onPublishVacancies(finalToPublish);
      // Remove published from pending list
      setExtractedVacancies((prev) => prev.filter((v) => !selectedIds.has(v.id)));
      setSelectedIds(new Set());
      const tgSuccessCount = finalToPublish.filter((v) => v.telegramPublished).length;
      setSuccessMessage(
        `Successfully published ${finalToPublish.length} vacancies directly to HOPELAND JOBS!${
          tgSuccessCount > 0 ? ` (${tgSuccessCount} sent to Telegram channel)` : ''
        }`
      );
    } catch (err: any) {
      alert('Error publishing vacancies: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Save All as Draft
  const handleSaveDrafts = async () => {
    const toDraft = extractedVacancies
      .filter((v) => selectedIds.has(v.id))
      .map((v) => ({
        ...v,
        status: 'draft' as const,
      }));

    if (toDraft.length === 0) {
      alert('Please select vacancies to save as draft.');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveDrafts(toDraft);
      setExtractedVacancies((prev) => prev.filter((v) => !selectedIds.has(v.id)));
      setSelectedIds(new Set());
      setSuccessMessage(`Saved ${toDraft.length} vacancies as Draft.`);
    } catch (err: any) {
      alert('Error saving drafts: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="bg-gradient-to-r from-[#0B132B] via-[#1C2541] to-[#0B132B] text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950 mb-3">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Core Administrative Feature</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              BULK JOB IMPORT & ORGANIZATION SYSTEM
            </h2>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
              Paste up to 50 raw Ethiopian vacancies at once. Gemini AI automatically detects individual job boundaries, extracts all 25+ parameters, assigns the correct category from the 16 Ethiopian sectors, and screens for duplicates before publication.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setRawText(SAMPLE_BULK_PASTE_DATA)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>Paste 7 Authentic Sample Jobs</span>
            </button>
            {rawText && (
              <button
                onClick={() => {
                  setRawText('');
                  setExtractedVacancies([]);
                  setStats(null);
                }}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="text-sm font-bold text-[#0B132B] flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" />
            <span>Paste Multiple Vacancies Below (Up to 50 Vacancies in one batch):</span>
          </label>

          {/* File Upload Helpers */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.docx,.pdf"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLoading || isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors"
            >
              <FileUp className="w-3.5 h-3.5 text-amber-600" />
              <span>{uploadLoading ? 'Extracting File...' : 'Upload TXT / DOCX / PDF'}</span>
            </button>
          </div>
        </div>

        <textarea
          rows={11}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste raw vacancy announcements from newspapers, Telegram channels, company websites, or official PDFs...&#10;&#10;Example:&#10;Commercial Bank of Ethiopia&#10;Position: Senior Risk Officer&#10;Location: Addis Ababa&#10;Deadline: 2026-11-20...&#10;&#10;The AI will automatically separate, classify, and format each vacancy without any manual splitting needed."
          className="w-full text-xs font-mono p-4 rounded-2xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 leading-relaxed outline-none"
        />

        {/* Process Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium">
            {rawText.length > 0 && (
              <span>
                {rawText.length} characters • Est. ~{Math.max(1, Math.round(rawText.length / 500))} vacancies detected
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Primary One-Click Publish Button */}
            <button
              onClick={handleProcessAndPublishDirectly}
              disabled={isProcessing || !rawText.trim()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
              <span>{isProcessing ? 'Processing & Publishing...' : '⚡ One-Click Process & Publish Directly to Website + Telegram'}</span>
            </button>

            {/* Secondary Process & Review Button */}
            <button
              onClick={handleProcessWithAI}
              disabled={isProcessing || !rawText.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#0B132B] hover:bg-[#1C2541] text-white font-bold text-xs sm:text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Process & Review First</span>
            </button>
          </div>
        </div>

        {/* Loading Step Banner */}
        {isProcessing && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 animate-pulse">
            <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
            <div>
              <p className="text-xs font-bold text-amber-900">{processingStep}</p>
              <p className="text-[11px] text-amber-700">Connecting to Gemini AI with Smart Ethiopian Regex Safety Net</p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-300 flex items-center justify-between gap-3 text-red-900 text-xs font-bold">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-red-700 hover:underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-3 text-emerald-900 text-sm font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-emerald-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="text-xs font-bold text-slate-500 uppercase">Detected</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.totalDetected}</div>
            <div className="text-[10px] text-slate-400">Total in text</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="text-xs font-bold text-emerald-700 uppercase">Organized</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{stats.successfullyOrganized}</div>
            <div className="text-[10px] text-slate-400">Ready to review</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/50 shadow-sm text-center">
            <div className="text-xs font-bold text-amber-800 uppercase">Duplicates</div>
            <div className="text-2xl font-black text-amber-700 mt-1">{stats.duplicatesDetected}</div>
            <div className="text-[10px] text-amber-600">Auto-discarded</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="text-xs font-bold text-slate-500 uppercase">Missing Info</div>
            <div className="text-2xl font-black text-slate-700 mt-1">{stats.missingInfoCount}</div>
            <div className="text-[10px] text-slate-400">With notes</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="text-xs font-bold text-blue-700 uppercase">Selected</div>
            <div className="text-2xl font-black text-blue-600 mt-1">{selectedIds.size}</div>
            <div className="text-[10px] text-slate-400">For action</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="text-xs font-bold text-purple-700 uppercase">Categories</div>
            <div className="text-2xl font-black text-purple-600 mt-1">{detectedCategoryNames.length}</div>
            <div className="text-[10px] text-slate-400">Sectors matched</div>
          </div>
        </div>
      )}

      {/* Duplicate Alert Notice */}
      {duplicateReports.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                {duplicateReports.length} Duplicate {duplicateReports.length === 1 ? 'Vacancy' : 'Vacancies'} Detected & Discarded
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                These duplicates were automatically excluded from the publication queue. You can inspect why they were matched in the Duplicate Report tab.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Review & Publication Section */}
      {extractedVacancies.length > 0 && (
        <div id="review-extracted-vacancies" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-bold text-[#0B132B]">
                Review Extracted Vacancies ({extractedVacancies.length})
              </h3>
              <p className="text-xs text-slate-500">
                You remain in full control. Verify, edit categories, or preview before publishing.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={async () => {
                  const toQueue = extractedVacancies.filter((v) => selectedIds.has(v.id));
                  if (toQueue.length === 0) {
                    alert('Please select at least one vacancy.');
                    return;
                  }
                  setIsSaving(true);
                  try {
                    await onPublishVacancies(toQueue);
                    if (onSendToTelegramQueue) {
                      onSendToTelegramQueue(toQueue);
                    }
                  } catch (e: any) {
                    alert('Failed to save to queue: ' + e.message);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving || selectedIds.size === 0}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-sm flex items-center gap-1.5"
              >
                <Send className="w-4 h-4 fill-current" />
                <span>Send {selectedIds.size} to Telegram Queue</span>
              </button>

              <button
                onClick={handleSaveDrafts}
                disabled={isSaving || selectedIds.size === 0}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Save {selectedIds.size} as Draft
              </button>
              <button
                onClick={handlePublishSelected}
                disabled={isSaving || selectedIds.size === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Publish {selectedIds.size} Approved Vacancies</span>
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100 scrollbar-none">
            <button
              onClick={() => setSelectedCategoryTab('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategoryTab === 'All'
                  ? 'bg-[#0B132B] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({extractedVacancies.length})
            </button>
            {detectedCategoryNames.map((catName) => {
              const count = extractedVacancies.filter((v) => v.category === catName).length;
              return (
                <button
                  key={catName}
                  onClick={() => setSelectedCategoryTab(catName)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedCategoryTab === catName
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {catName} ({count})
                </button>
              );
            })}
          </div>

          {/* Bulk Select All checkbox */}
          <div className="flex items-center justify-between text-xs text-slate-600 px-2">
            <label className="flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={
                  filteredVacancies.length > 0 &&
                  filteredVacancies.every((v) => selectedIds.has(v.id))
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span>Select All in this Category Tab ({filteredVacancies.length})</span>
            </label>
            <span>{selectedIds.size} total selected</span>
          </div>

          {/* Vacancy Review Cards */}
          <div className="space-y-4">
            {filteredVacancies.map((vacancy) => {
              const isSelected = selectedIds.has(vacancy.id);

              return (
                <div
                  key={vacancy.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-amber-50/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(vacancy.id)}
                      className="mt-1 rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                    />

                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-[#0B132B]">
                            {vacancy.title}
                          </span>
                          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {vacancy.organization}
                          </span>
                          <span className="text-xs text-slate-500">
                            📍 {vacancy.location}
                          </span>
                        </div>

                        {/* Inline Category Dropdown */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-400">Category:</span>
                          <select
                            value={vacancy.category}
                            onChange={(e) =>
                              handleChangeCategory(vacancy.id, e.target.value as JobCategoryName)
                            }
                            className="text-xs font-semibold py-1 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 outline-none focus:border-amber-500"
                          >
                            {OFFICIAL_CATEGORIES.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {vacancy.description}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500">
                        <div className="flex flex-wrap items-center gap-3">
                          <span>⏳ Deadline: <strong className="text-slate-800">{vacancy.applicationDeadline}</strong></span>
                          <span>💰 Salary: <strong className="text-slate-800">{vacancy.salary}</strong></span>
                          {vacancy.applicationMethod && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              Method: {vacancy.applicationMethod}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewVacancy(vacancy)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1 rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewVacancy && (
        <VacancyDetailModal
          vacancy={previewVacancy}
          onClose={() => setPreviewVacancy(null)}
          telegramUrl={telegramUrl}
        />
      )}
    </div>
  );
};
