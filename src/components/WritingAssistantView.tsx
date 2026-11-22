import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Copy,
  FileCheck2,
  FileEdit,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  ETHICAL_TRANSPARENCY_NOTICE,
  HumanizeTextResult,
  INTEGRITY_PRESERVATION_NOTICE,
  WRITING_DOCUMENT_TYPES,
  WRITING_STYLES,
  WritingDocumentType,
  WritingIssueCategory,
  WritingQualityReport,
  WritingStyleOption,
} from '../utils/writingQualityAnalyzer';

export type WritingToolTab = 'humanize-text' | 'humanize-checker';

interface WritingAssistantViewProps {
  initialTool?: WritingToolTab;
  onToolChange?: (tool: WritingToolTab) => void;
  onBack: () => void;
}

const SAMPLE_DRAFTS: Record<'banking' | 'wash', { label: string; docType: WritingDocumentType; text: string }> = {
  banking: {
    label: 'Banking Cover Letter Sample',
    docType: 'cover_letter',
    text: "In today's fast-paced world, I am writing to express my keen interest in the Credit Risk Analyst position. I am a passionate and results-driven professional who possesses a strong background in IFRS 9 modeling, AML/CFT compliance, and corporate credit underwriting across Ethiopian commercial banking. Furthermore, moreover, it is worth noting that I utilized SQL and Power BI in order to facilitate the implementation of automated portfolio stress testing, which served as a testament to my commitment to leveraging synergies across treasury and risk teams. Please do not hesitate to contact me at this point in time.",
  },
  wash: {
    label: 'WASH Scholarship Statement Sample',
    docType: 'scholarship_application',
    text: "Dear Sir, I am writing to express my strong interest in the MSc in Water Supply and Sanitation Engineering scholarship. I'm super excited because I've got tons of field experience in rural borehole drilling, water quality testing, and EPANET network modeling in Oromia and Somali regions, and this program is of paramount importance due to the fact that it will allow me to delve deeply into climate-resilient water management and wastewater treatment systems that can serve communities facing recurring drought while strengthening local utility operations and public health outcomes across rural districts.",
  },
};

const ISSUE_CATEGORY_LABELS: Record<WritingIssueCategory, string> = {
  generic_expression: 'Generic expression',
  unnatural_wording: 'Unnatural wording',
  repetitive_sentence: 'Repetitive phrasing',
  overly_complicated: 'Overly complicated sentence',
  inconsistent_tone: 'Inconsistent tone',
};

const SEVERITY_TEXT_STYLES: Record<'high' | 'medium' | 'low', string> = {
  high: 'text-rose-700',
  medium: 'text-amber-700',
  low: 'text-slate-600',
};

export const WritingAssistantView: React.FC<WritingAssistantViewProps> = ({
  initialTool = 'humanize-text',
  onToolChange,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<WritingToolTab>(initialTool);

  // Humanize Text state
  const [humanizeInput, setHumanizeInput] = useState('');
  const [humanizeDocType, setHumanizeDocType] = useState<WritingDocumentType>('cover_letter');
  const [humanizeStyle, setHumanizeStyle] = useState<WritingStyleOption>('professional');
  const [humanizeLoading, setHumanizeLoading] = useState(false);
  const [humanizeError, setHumanizeError] = useState<string | null>(null);
  const [humanizeResult, setHumanizeResult] = useState<HumanizeTextResult | null>(null);
  const [editableRevisedText, setEditableRevisedText] = useState('');
  const [copiedHumanized, setCopiedHumanized] = useState(false);

  // Humanize Checker state
  const [checkerInput, setCheckerInput] = useState('');
  const [checkerDocType, setCheckerDocType] = useState<WritingDocumentType>('cover_letter');
  const [checkerLoading, setCheckerLoading] = useState(false);
  const [checkerError, setCheckerError] = useState<string | null>(null);
  const [checkerReport, setCheckerReport] = useState<WritingQualityReport | null>(null);
  const [editableImprovedVersion, setEditableImprovedVersion] = useState('');
  const [copiedImproved, setCopiedImproved] = useState(false);

  useEffect(() => {
    setActiveTab(initialTool);
  }, [initialTool]);

  const handleSwitchTab = (tab: WritingToolTab) => {
    setActiveTab(tab);
    onToolChange?.(tab);
  };

  const wordCount = (str: string) => {
    const trimmed = str.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  };

  const handleRunHumanize = async () => {
    const trimmed = humanizeInput.trim();
    if (trimmed.length < 15) {
      setHumanizeError('Enter at least 15 characters of text so we can improve its clarity and flow.');
      return;
    }
    setHumanizeLoading(true);
    setHumanizeError(null);
    try {
      const resp = await fetch('/api/writing/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed,
          documentType: humanizeDocType,
          style: humanizeStyle,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Could not refine your text. Please try again.');
      }
      setHumanizeResult(data as HumanizeTextResult);
      setEditableRevisedText(data.revisedText || '');
    } catch (err: any) {
      setHumanizeError(err?.message || 'Unable to process text refinement.');
    } finally {
      setHumanizeLoading(false);
    }
  };

  const handleRunChecker = async () => {
    const trimmed = checkerInput.trim();
    if (trimmed.length < 15) {
      setCheckerError('Enter at least 15 characters of text to run a writing-quality check.');
      return;
    }
    setCheckerLoading(true);
    setCheckerError(null);
    try {
      const resp = await fetch('/api/writing/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed,
          documentType: checkerDocType,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Could not analyze your draft. Please try again.');
      }
      setCheckerReport(data as WritingQualityReport);
      setEditableImprovedVersion(data.improvedVersion || '');
    } catch (err: any) {
      setCheckerError(err?.message || 'Unable to run writing-quality analysis.');
    } finally {
      setCheckerLoading(false);
    }
  };

  const handleCopyText = async (value: string, target: 'humanized' | 'improved') => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      if (target === 'humanized') {
        setCopiedHumanized(true);
        window.setTimeout(() => setCopiedHumanized(false), 2200);
      } else {
        setCopiedImproved(true);
        window.setTimeout(() => setCopiedImproved(false), 2200);
      }
    } catch {
      // Fallback for restricted clipboards
      const textarea = document.createElement('textarea');
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      if (target === 'humanized') {
        setCopiedHumanized(true);
        window.setTimeout(() => setCopiedHumanized(false), 2200);
      } else {
        setCopiedImproved(true);
        window.setTimeout(() => setCopiedImproved(false), 2200);
      }
    }
  };

  const sendRevisedToChecker = () => {
    const textToCheck = editableRevisedText.trim() || humanizeInput.trim();
    if (!textToCheck) return;
    setCheckerInput(textToCheck);
    setCheckerDocType(humanizeDocType);
    handleSwitchTab('humanize-checker');
  };

  const sendImprovedToHumanizer = () => {
    const textToPolish = editableImprovedVersion.trim() || checkerInput.trim();
    if (!textToPolish) return;
    setHumanizeInput(textToPolish);
    setHumanizeDocType(checkerDocType);
    handleSwitchTab('humanize-text');
  };

  const loadSample = (key: 'banking' | 'wash', destination: WritingToolTab) => {
    const sample = SAMPLE_DRAFTS[key];
    if (destination === 'humanize-text') {
      setHumanizeDocType(sample.docType);
      setHumanizeInput(sample.text);
      setHumanizeError(null);
    } else {
      setCheckerDocType(sample.docType);
      setCheckerInput(sample.text);
      setCheckerError(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Compact Editorial Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to HopelandJobs
              </button>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Career Writing Studio
              </h1>
              <p className="text-sm text-slate-600 max-w-2xl">
                Refine CVs, cover letters, scholarship statements, and application emails into clear, natural prose — without inventing facts or qualifications.
              </p>
            </div>

            {/* Segmented Tool Switcher */}
            <div
              role="tablist"
              aria-label="Writing Tools"
              className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-lg self-start md:self-auto"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'humanize-text'}
                onClick={() => handleSwitchTab('humanize-text')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                  activeTab === 'humanize-text'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileEdit className="w-4 h-4 text-emerald-600" />
                Humanize Text
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'humanize-checker'}
                onClick={() => handleSwitchTab('humanize-checker')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                  activeTab === 'humanize-checker'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                Humanize Checker
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'humanize-text' ? (
          <div className="space-y-5">
            {/* Controls Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-5">
                  <label
                    htmlFor="humanize-doc-type"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
                  >
                    Document Type
                  </label>
                  <select
                    id="humanize-doc-type"
                    value={humanizeDocType}
                    onChange={(e) => setHumanizeDocType(e.target.value as WritingDocumentType)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  >
                    {WRITING_DOCUMENT_TYPES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-4">
                  <label
                    htmlFor="humanize-style"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
                  >
                    Writing Style
                  </label>
                  <select
                    id="humanize-style"
                    value={humanizeStyle}
                    onChange={(e) => setHumanizeStyle(e.target.value as WritingStyleOption)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  >
                    {WRITING_STYLES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleRunHumanize}
                    disabled={humanizeLoading}
                    className="w-full h-10 inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold transition-colors"
                  >
                    {humanizeLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Refining...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Humanize Text
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {WRITING_STYLES.find((s) => s.id === humanizeStyle)?.description}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">Load example:</span>
                  <button
                    type="button"
                    onClick={() => loadSample('banking', 'humanize-text')}
                    className="font-medium text-emerald-700 hover:text-emerald-800 underline-offset-2 hover:underline"
                  >
                    Banking Cover Letter
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample('wash', 'humanize-text')}
                    className="font-medium text-emerald-700 hover:text-emerald-800 underline-offset-2 hover:underline"
                  >
                    WASH Scholarship Draft
                  </button>
                </div>
              </div>
            </div>

            {humanizeError && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-800">
                {humanizeError}
              </div>
            )}

            {/* Split Editor Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Source Draft */}
              <div className="bg-white border border-slate-200 rounded-xl flex flex-col">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Your Draft</h2>
                  <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
                    <span>{wordCount(humanizeInput)} words</span>
                    <span>{humanizeInput.length.toLocaleString()} / 15,000 chars</span>
                    {humanizeInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setHumanizeInput('');
                          setHumanizeResult(null);
                          setEditableRevisedText('');
                          setHumanizeError(null);
                        }}
                        className="text-slate-500 hover:text-slate-900 font-medium"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={humanizeInput}
                  onChange={(e) => setHumanizeInput(e.target.value)}
                  maxLength={15000}
                  rows={14}
                  placeholder="Paste your CV summary, cover letter, scholarship essay, motivation letter, or professional email here..."
                  className="w-full flex-1 p-4 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 resize-y focus:outline-none rounded-b-xl"
                />
              </div>

              {/* Revised Editable Output */}
              <div className="bg-white border border-slate-200 rounded-xl flex flex-col">
                <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Revised Text (Editable)</h2>
                    {humanizeResult && (
                      <span className="text-xs text-slate-500 tabular-nums">
                        · {wordCount(editableRevisedText)} words
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!editableRevisedText.trim()}
                      onClick={() => handleCopyText(editableRevisedText, 'humanized')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                    >
                      {copiedHumanized ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Text
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={!editableRevisedText.trim()}
                      onClick={sendRevisedToChecker}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/70 disabled:opacity-40 transition-colors"
                    >
                      Check Quality
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {editableRevisedText || humanizeResult ? (
                  <textarea
                    value={editableRevisedText}
                    onChange={(e) => setEditableRevisedText(e.target.value)}
                    rows={14}
                    aria-label="Editable revised text"
                    className="w-full flex-1 p-4 text-sm leading-relaxed text-slate-900 resize-y focus:outline-none rounded-b-xl"
                  />
                ) : (
                  <div className="flex-1 min-h-[280px] flex flex-col items-center justify-center p-8 text-center text-slate-500">
                    <FileEdit className="w-8 h-8 text-slate-300 mb-3" />
                    <p className="text-sm font-medium text-slate-700">
                      Your refined version will appear here
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Choose a document type and writing style, then click Humanize Text. You can edit and copy the result freely.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Editorial Summary & Integrity Footer */}
            {humanizeResult && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Editorial Improvements Applied
                    </h3>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {humanizeResult.improvementsApplied.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                        Preserved Technical & Domain Terms
                      </h3>
                      <p className="text-sm text-slate-700">
                        {humanizeResult.preservedTechnicalTerms.length > 0
                          ? humanizeResult.preservedTechnicalTerms.join(' · ')
                          : 'Original terminology and factual details preserved intact.'}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 tabular-nums">
                      Word count: {humanizeResult.wordCountBefore} before → {wordCount(editableRevisedText)} after
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-3 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p>{INTEGRITY_PRESERVATION_NOTICE}</p>
            </div>
          </div>
        ) : (
          /* ================= HUMANIZE CHECKER TAB ================= */
          <div className="space-y-5">
            {/* Input Panel */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Writing-Quality Diagnostic Input
                  </h2>
                  <select
                    aria-label="Document context for quality check"
                    value={checkerDocType}
                    onChange={(e) => setCheckerDocType(e.target.value as WritingDocumentType)}
                    className="h-8 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  >
                    {WRITING_DOCUMENT_TYPES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-400">Sample:</span>
                  <button
                    type="button"
                    onClick={() => loadSample('banking', 'humanize-checker')}
                    className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    Banking Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample('wash', 'humanize-checker')}
                    className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    WASH Statement
                  </button>
                  <span className="text-slate-500 tabular-nums">
                    {wordCount(checkerInput)} words
                  </span>
                </div>
              </div>

              <textarea
                value={checkerInput}
                onChange={(e) => setCheckerInput(e.target.value)}
                maxLength={15000}
                rows={8}
                placeholder="Paste any application text, motivation letter, CV section, or email to inspect readability, repetition, generic clichés, tone consistency, and sentence clarity..."
                className="w-full p-4 sm:p-5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 resize-y focus:outline-none"
              />

              <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Evaluates readability, repetition, generic phrases, tone consistency, and sentence length.
                </p>
                <div className="flex items-center gap-2">
                  {checkerInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setCheckerInput('');
                        setCheckerReport(null);
                        setEditableImprovedVersion('');
                        setCheckerError(null);
                      }}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleRunChecker}
                    disabled={checkerLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold transition-colors"
                  >
                    {checkerLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <ClipboardCheck className="w-4 h-4" />
                        Run Quality Check
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {checkerError && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-800">
                {checkerError}
              </div>
            )}

            {/* Honest Ethical Transparency Notice (always visible) */}
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-3 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p>{checkerReport?.transparencyNotice || ETHICAL_TRANSPARENCY_NOTICE}</p>
            </div>

            {/* Structured Writing-Quality Report */}
            {checkerReport && (
              <div className="space-y-5">
                {/* 4-Column Score Strip (hairline divided, tabular-nums) */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                    <div className="p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Writing Quality
                      </p>
                      <p className="mt-1 text-3xl font-bold text-slate-900 tabular-nums">
                        {checkerReport.overallQualityScore}
                        <span className="text-sm font-normal text-slate-400"> / 100</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {checkerReport.issues.length} diagnostic finding{checkerReport.issues.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Readability
                      </p>
                      <p className="mt-1 text-3xl font-bold text-slate-900 tabular-nums">
                        {checkerReport.metrics.fleschReadingEase}
                        <span className="text-sm font-normal text-slate-400"> ease</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Grade {checkerReport.metrics.fleschKincaidGrade} · {checkerReport.metrics.readingLevelLabel}
                      </p>
                    </div>

                    <div className="p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Natural Phrasing
                      </p>
                      <p className="mt-1 text-3xl font-bold text-slate-900 tabular-nums">
                        {checkerReport.subScores.naturalness}
                        <span className="text-sm font-normal text-slate-400"> / 100</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {checkerReport.alternatives.length} natural alternative{checkerReport.alternatives.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tone & Conciseness
                      </p>
                      <p className="mt-1 text-3xl font-bold text-slate-900 tabular-nums">
                        {Math.round(
                          (checkerReport.subScores.toneConsistency + checkerReport.subScores.conciseness) / 2
                        )}
                        <span className="text-sm font-normal text-slate-400"> / 100</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600 tabular-nums">
                        Tone {checkerReport.subScores.toneConsistency} · Conciseness {checkerReport.subScores.conciseness}
                      </p>
                    </div>
                  </div>

                  {/* Secondary Readability Metadata Row */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                    <p className="font-medium text-slate-800">{checkerReport.summaryVerdict}</p>
                    <p className="tabular-nums text-slate-500">
                      {checkerReport.metrics.wordCount} words · {checkerReport.metrics.sentenceCount} sentences ·{' '}
                      {checkerReport.metrics.averageWordsPerSentence} words/sentence ·{' '}
                      {checkerReport.metrics.longSentenceCount} long sentence
                      {checkerReport.metrics.longSentenceCount === 1 ? '' : 's'} ·{' '}
                      {checkerReport.metrics.lexicalDiversityPercent}% vocabulary variety
                    </p>
                  </div>
                </div>

                {/* Diagnostics & Natural Alternatives */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Findings List */}
                  <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Editorial Findings
                      </h3>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {checkerReport.issues.length} item{checkerReport.issues.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {checkerReport.issues.length === 0 ? (
                      <div className="p-6 text-sm text-slate-600">
                        No repetitive sentences, generic clichés, tone inconsistencies, or overly long sentences were detected in this draft.
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-200">
                        {checkerReport.issues.map((issue) => (
                          <li key={issue.id} className="p-4 sm:px-5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-slate-900">
                                {ISSUE_CATEGORY_LABELS[issue.category]}
                              </span>
                              <span className={`font-medium capitalize ${SEVERITY_TEXT_STYLES[issue.severity]}`}>
                                {issue.severity} priority
                              </span>
                            </div>
                            <p className="text-xs font-mono bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-700 break-words">
                              {issue.excerpt}
                            </p>
                            <p className="text-xs text-slate-600">{issue.explanation}</p>
                            <p className="text-xs font-medium text-emerald-800">{issue.suggestion}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Natural Alternatives Table */}
                  <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Suggested Natural Alternatives
                      </h3>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {checkerReport.alternatives.length} suggestion{checkerReport.alternatives.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {checkerReport.alternatives.length === 0 ? (
                      <div className="p-6 text-sm text-slate-600">
                        Your phrasing already avoids common clichés and robotic expressions.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wide">
                            <tr>
                              <th className="py-2.5 px-4 font-semibold">Original Phrase</th>
                              <th className="py-2.5 px-4 font-semibold">Natural Alternative</th>
                              <th className="py-2.5 px-4 font-semibold">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {checkerReport.alternatives.map((alt, idx) => (
                              <tr key={idx} className="align-top">
                                <td className="py-3 px-4 font-medium text-slate-700 line-through decoration-rose-300">
                                  {alt.original}
                                </td>
                                <td className="py-3 px-4 font-semibold text-emerald-700">
                                  {alt.naturalAlternative}
                                </td>
                                <td className="py-3 px-4 text-slate-600">{alt.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Improved Version Box */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Improved Version (Editable)
                      </h3>
                      <p className="text-xs text-slate-500">
                        All original meaning and technical terms preserved. Edit directly or copy for your application.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyText(editableImprovedVersion, 'improved')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        {copiedImproved ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Improved Text
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={sendImprovedToHumanizer}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/70 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refine Style in Humanize Text
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={editableImprovedVersion}
                    onChange={(e) => setEditableImprovedVersion(e.target.value)}
                    rows={8}
                    aria-label="Improved writing version"
                    className="w-full p-4 sm:p-5 text-sm leading-relaxed text-slate-900 resize-y focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
