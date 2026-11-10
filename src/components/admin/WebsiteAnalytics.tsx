import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  Eye,
  Activity,
  Calendar,
  Clock,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  Trash2,
  Filter,
  MousePointerClick,
  Send,
  Layers,
  Sparkles,
  Search,
  Bot,
  Brain,
  Zap,
  TrendingDown,
  Building,
  DollarSign,
  HeartPulse,
  Bell,
  FileCheck2,
  Copy,
  Check,
  PlusCircle,
  ChevronRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';
import { SiteSettings } from '../../types/job';
import {
  AnalyticsSummary,
  AnalyticsPeriod,
  AiBusinessAnalystReport,
  HealthDiagnosticItem,
  SmartAlertItem,
} from '../../types/analytics';
import {
  getInternalTrafficExclusion,
  setInternalTrafficExclusion,
} from '../../lib/analyticsTracker';

interface Props {
  siteSettings: SiteSettings;
  onSaveSiteSettings: (settings: SiteSettings) => Promise<void>;
}

export const WebsiteAnalytics: React.FC<Props> = ({
  siteSettings,
  onSaveSiteSettings,
}) => {
  // Navigation & View Sub-tabs
  const [activeSection, setActiveSection] = useState<
    | 'overview'
    | 'aiAnalyst'
    | 'funnel'
    | 'traffic'
    | 'jobRankings'
    | 'searchConsole'
    | 'health'
    | 'alerts'
    | 'businessBi'
    | 'settings'
  >('overview');

  const [period, setPeriod] = useState<AnalyticsPeriod>('today');
  const [excludeAdmin, setExcludeAdmin] = useState<boolean>(() => getInternalTrafficExclusion());
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // AI Analyst state
  const [aiReport, setAiReport] = useState<AiBusinessAnalystReport | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedAi, setCopiedAi] = useState<boolean>(false);

  // Health audit state
  const [isRunningAudit, setIsRunningAudit] = useState<boolean>(false);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);

  // GSC state
  const [gscUrlInput, setGscUrlInput] = useState<string>('https://dreambigjobs.et');
  const [isSavingGsc, setIsSavingGsc] = useState<boolean>(false);

  // Inquiries & Revenue Record Modals / Inputs
  const [isRecordInquiryOpen, setIsRecordInquiryOpen] = useState(false);
  const [inquiryCompany, setInquiryCompany] = useState('');
  const [inquiryContact, setInquiryContact] = useState('');
  const [inquiryService, setInquiryService] = useState('Featured Vacancy Package');
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);

  const [isRecordRevenueOpen, setIsRecordRevenueOpen] = useState(false);
  const [revenueService, setRevenueService] = useState('Employer Advertising (30-Day Listing)');
  const [revenueAmount, setRevenueAmount] = useState('5000');
  const [revenuePayer, setRevenuePayer] = useState('');
  const [isSubmittingRevenue, setIsSubmittingRevenue] = useState(false);

  // GA4 Configuration state
  const [gaInput, setGaInput] = useState<string>(siteSettings.gaMeasurementId || '');
  const [isSavingGa, setIsSavingGa] = useState<boolean>(false);
  const [gaSuccessMsg, setGaSuccessMsg] = useState<string | null>(null);

  // Keep gaInput in sync when siteSettings updates from cloud or server
  useEffect(() => {
    if (siteSettings.gaMeasurementId) {
      setGaInput(siteSettings.gaMeasurementId);
    }
  }, [siteSettings.gaMeasurementId]);

  // Ranking filter state
  const [rankingSearch, setRankingSearch] = useState<string>('');
  const [rankingCategory, setRankingCategory] = useState<string>('All');

  // Fetch summary from server
  const fetchAnalyticsSummary = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        period,
        excludeAdmin: excludeAdmin ? 'true' : 'false',
        gaMeasurementId: siteSettings.gaMeasurementId || '',
      });

      const res = await fetch(`/api/analytics/summary?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data: AnalyticsSummary = await res.json();
      setSummary(data);
      if (data.searchConsole?.propertyUrl) {
        setGscUrlInput(data.searchConsole.propertyUrl);
      }
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err.message || 'Unable to load analytics summary');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsSummary();
    const interval = setInterval(() => {
      fetchAnalyticsSummary(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [period, excludeAdmin, siteSettings.gaMeasurementId]);

  const handleToggleExcludeAdmin = (val: boolean) => {
    setExcludeAdmin(val);
    setInternalTrafficExclusion(val);
  };

  // Generate AI Business Analyst Report
  const handleGenerateAiReport = async () => {
    if (!summary) return;
    setIsGeneratingAi(true);
    setAiError(null);

    try {
      const res = await fetch('/api/analytics/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryData: summary, period }),
      });

      if (!res.ok) throw new Error(`AI generation failed with HTTP ${res.status}`);
      const data: AiBusinessAnalystReport = await res.json();
      setAiReport(data);
    } catch (err: any) {
      console.error('AI Analyst error:', err);
      setAiError(err.message || 'Failed to generate AI insights.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Run live website health audit
  const handleRunHealthAudit = async () => {
    setIsRunningAudit(true);
    setAuditMessage(null);
    try {
      const res = await fetch('/api/analytics/health-audit', { method: 'POST' });
      if (!res.ok) throw new Error('Health audit returned an error.');
      const data = await res.json();
      if (summary) {
        setSummary({
          ...summary,
          healthDiagnostics: data.results,
        });
      }
      setAuditMessage(`Audit Completed: ${data.passedCount}/${data.totalChecks} Checks Passed.`);
      setTimeout(() => setAuditMessage(null), 5000);
    } catch (err: any) {
      alert('Error running audit: ' + err.message);
    } finally {
      setIsRunningAudit(false);
    }
  };

  // Save GSC configuration
  const handleSaveGscConfig = async (status: 'CONNECTED' | 'NOT TESTED') => {
    setIsSavingGsc(true);
    try {
      const res = await fetch('/api/analytics/gsc-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyUrl: gscUrlInput, status }),
      });
      if (res.ok) {
        const data = await res.json();
        if (summary) {
          setSummary({
            ...summary,
            searchConsole: data.searchConsole,
          });
        }
        alert(status === 'CONNECTED' ? 'Search Console verified as CONNECTED!' : 'GSC settings saved.');
      }
    } catch (err: any) {
      alert('Failed to save GSC settings: ' + err.message);
    } finally {
      setIsSavingGsc(false);
    }
  };

  // Record an Authentic Employer Inquiry
  const handleRecordInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryCompany.trim()) return;
    setIsSubmittingInquiry(true);
    try {
      const res = await fetch('/api/analytics/record-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: inquiryCompany,
          contactPerson: inquiryContact,
          serviceType: inquiryService,
        }),
      });
      if (res.ok) {
        setInquiryCompany('');
        setInquiryContact('');
        setIsRecordInquiryOpen(false);
        fetchAnalyticsSummary(true);
        alert('Employer inquiry recorded successfully.');
      }
    } catch (err: any) {
      alert('Error saving inquiry: ' + err.message);
    } finally {
      setIsSubmittingInquiry(false);
    }
  };

  // Record an Authentic Revenue Transaction
  const handleRecordRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(revenueAmount);
    if (!revenueService || isNaN(amount) || amount <= 0) return;
    setIsSubmittingRevenue(true);
    try {
      const res = await fetch('/api/analytics/record-revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: revenueService,
          amountEtb: amount,
          payer: revenuePayer,
        }),
      });
      if (res.ok) {
        setRevenuePayer('');
        setIsRecordRevenueOpen(false);
        fetchAnalyticsSummary(true);
        alert('Transaction recorded successfully. Business Intelligence updated.');
      }
    } catch (err: any) {
      alert('Error recording transaction: ' + err.message);
    } finally {
      setIsSubmittingRevenue(false);
    }
  };

  // Save GA4 ID
  const handleSaveGaMeasurementId = async () => {
    setIsSavingGa(true);
    setGaSuccessMsg(null);
    try {
      const cleanId = gaInput.trim().toUpperCase();
      if (cleanId && !cleanId.startsWith('G-')) {
        alert('Google Analytics 4 Measurement ID must start with "G-" (e.g. G-XXXXXXXXXX).');
        setIsSavingGa(false);
        return;
      }
      await onSaveSiteSettings({
        ...siteSettings,
        gaMeasurementId: cleanId,
        gaTrackingEnabled: Boolean(cleanId),
        updatedAt: new Date().toISOString(),
      });
      setGaSuccessMsg(cleanId ? `Configured GA4: ${cleanId}` : 'GA4 ID cleared');
      setTimeout(() => setGaSuccessMsg(null), 4000);
      fetchAnalyticsSummary(true);
    } catch (err: any) {
      alert('Failed to save GA4 settings: ' + err.message);
    } finally {
      setIsSavingGa(false);
    }
  };

  // Purge test data
  const handlePurgeTestData = async (internalOnly: boolean) => {
    const confirmText = internalOnly
      ? 'Remove all recorded internal development/admin test visits from the database?'
      : 'Reset ALL analytics data to 0? This cannot be undone.';
    if (!window.confirm(confirmText)) return;

    try {
      const res = await fetch('/api/analytics/reset-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purgeInternalOnly: internalOnly }),
      });
      if (res.ok) {
        alert(internalOnly ? 'Internal test events purged.' : 'All analytics reset to zero.');
        setAiReport(null);
        fetchAnalyticsSummary(true);
      }
    } catch (err: any) {
      alert('Error purging data: ' + err.message);
    }
  };

  const handleCopyAiReport = () => {
    if (!aiReport) return;
    const reportText = `🧠 HOPELAND JOBS — AI BUSINESS ANALYST REPORT
Period: ${aiReport.period} | Generated: ${new Date(aiReport.generatedAt).toLocaleString()}
Model: ${aiReport.modelUsed}

1. EXECUTIVE PERFORMANCE SUMMARY
${aiReport.performanceSummary}

2. GROWTH TRAJECTORY
${aiReport.growthAnalysis}

3. VISITOR ACQUISITION
${aiReport.acquisitionAnalysis}

4. POPULAR CATEGORIES & JOB DEMAND
${aiReport.categoryAndJobInsights}

5. APPLICATION CLICK PERFORMANCE
${aiReport.engagementAndClickPerformance}

6. TRAFFIC SOURCE ASSESSMENT
${aiReport.trafficSourceAssessment}

7. IDENTIFIED PERFORMANCE PROBLEMS
${aiReport.identifiedProblems?.map((p, i) => `${i + 1}. ${p}`).join('\n')}

8. PRACTICAL STRATEGIC RECOMMENDATIONS
${aiReport.strategicRecommendations?.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;

    navigator.clipboard.writeText(reportText);
    setCopiedAi(true);
    setTimeout(() => setCopiedAi(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Executive KPI Header */}
      <div className="bg-[#0B132B] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 uppercase tracking-wider">
                <Brain className="w-3.5 h-3.5" />
                AI Business Intelligence & Analytics
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />
                Zero-Data Accurate (No Mocking)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                <Clock className="w-3 h-3 text-amber-400" />
                Timezone: Africa/Addis_Ababa (UTC+3)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              SMART BUSINESS INTELLIGENCE DASHBOARD
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Real-time measurement of genuine website visitors, full visitor conversion funnel, traffic attribution,
              broken link health diagnostics, and Gemini AI business analysis for HOPELAND JOBS.
            </p>
          </div>

          {/* Quick Actions & Live Active Users */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fetchAnalyticsSummary(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors border border-slate-700 shadow-sm"
              title="Refresh Analytics Metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {/* Realtime Active Users Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-inner">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>
                Active Now (30m): <strong className="text-white text-sm">{summary?.activeUsersLast30Min ?? 0}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* 4 Standard Time Window Quick Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 shadow-inner">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Visitors Today</span>
              <span className="text-[10px] text-amber-400 font-mono">EAT</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
              {summary ? summary.visitorsToday : (loading ? '—' : 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Unique visitors today</div>
          </div>

          <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 shadow-inner">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Visitors Yesterday</span>
              <span className="text-[10px] text-amber-400 font-mono">EAT</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {summary ? summary.visitorsYesterday : (loading ? '—' : 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Previous calendar day</div>
          </div>

          <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 shadow-inner">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Last 7 Days</span>
              <span className="text-[10px] text-emerald-400 font-mono">7D</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              {summary ? summary.visitorsLast7 : (loading ? '—' : 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Rolling 7-day visitors</div>
          </div>

          <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 shadow-inner">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Last 30 Days</span>
              <span className="text-[10px] text-sky-400 font-mono">30D</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-sky-400 font-mono">
              {summary ? summary.visitorsLast30 : (loading ? '—' : 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Rolling 30-day visitors</div>
          </div>
        </div>
      </div>

      {/* Date Filter & Admin Traffic Exclusion Control Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Period:
          </span>
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7', label: 'Last 7 Days' },
              { id: 'last30', label: 'Last 30 Days' },
              { id: 'last90', label: 'Last 90 Days' },
              { id: 'all', label: 'All History' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setPeriod(t.id);
                setAiReport(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                period === t.id
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Development Exclusion Toggle */}
        <div className="flex items-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludeAdmin}
              onChange={(e) => handleToggleExcludeAdmin(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-700">
              Exclude Internal / Admin Traffic
            </span>
          </label>

          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              excludeAdmin
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}
          >
            {excludeAdmin ? 'Admin Filter Active' : 'All Traffic (Including Admin)'}
          </span>
        </div>
      </div>

      {/* Module Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
        {[
          { id: 'overview', label: 'Executive Overview', icon: BarChart3 },
          { id: 'aiAnalyst', label: 'AI Business Analyst (Gemini)', icon: Brain, badge: 'Smart AI' },
          { id: 'funnel', label: 'Conversion Funnel', icon: Filter },
          { id: 'traffic', label: 'Traffic & UTM Intelligence', icon: Globe },
          { id: 'jobRankings', label: 'Job & Employer Rankings', icon: Building },
          { id: 'searchConsole', label: 'Google Search Console', icon: Search },
          { id: 'health', label: 'Website Health & Audit', icon: HeartPulse },
          { id: 'alerts', label: 'Smart Alerts', icon: Bell, count: summary?.smartAlerts?.filter(a => a.status === 'ALERT').length },
          { id: 'businessBi', label: 'Business & Revenue BI', icon: DollarSign },
          { id: 'settings', label: 'GA4 & Settings', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-[#0B132B] text-amber-400 border-[#0B132B] shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase">
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: EXECUTIVE OVERVIEW */}
      {/* ========================================================= */}
      {activeSection === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Main Reporting Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-amber-400 transition-colors">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                <span>Unique Visitors</span>
                <Users className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                {summary ? summary.uniqueVisitors : (loading ? '—' : 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Distinct browsers</div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-sky-400 transition-colors">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                <span>Total Sessions</span>
                <Activity className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                {summary ? summary.totalSessions : (loading ? '—' : 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">30-min active windows</div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-indigo-400 transition-colors">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                <span>Total Page Views</span>
                <Eye className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                {summary ? summary.totalPageViews : (loading ? '—' : 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Pages & vacancy loads</div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-emerald-400 transition-colors">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                <span>New Visitors</span>
                <Sparkles className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
                {summary ? summary.newVisitors : (loading ? '—' : 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">First-time discovery</div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-amber-400 transition-colors col-span-2 md:col-span-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                <span>Returning Visitors</span>
                <RefreshCw className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                {summary ? summary.returningVisitors : (loading ? '—' : 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Repeat audience</div>
            </div>
          </div>

          {/* Zero Visitor Banner if exactly 0 visitors */}
          {summary && summary.uniqueVisitors === 0 && (
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-amber-950">
                  Exact Zero-Data Verification Active
                </h4>
                <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                  No genuine visitors recorded for this period yet. HOPELAND JOBS strictly avoids fake visitor counters or random numbers.
                  When a real person visits the site, the count will increment to 1.
                  {excludeAdmin && (
                    <span className="block mt-1 font-semibold text-amber-950">
                      Tip: "Exclude Admin / Internal Traffic" is ON, so your own admin browsing does not count as public users.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Conversion Funnel Mini View */}
          {summary?.funnel && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Visitor Conversion Funnel (Measured Stages)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Outbound application clicks track employer link interactions (never assumed as submitted applications)
                  </p>
                </div>
                <button
                  onClick={() => setActiveSection('funnel')}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  <span>Detailed Funnel</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {summary.funnel.map((f, i) => (
                  <div key={f.stage} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 line-clamp-1">
                      {i + 1}. {f.stage}
                    </div>
                    <div className="text-xl font-black text-slate-900 font-mono">
                      {f.count}
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-600 mt-1">
                      {f.conversionRate}% conversion
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Activity Visual Bar Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Daily Visitor & Page View Activity
                </h3>
                <p className="text-xs text-slate-500">
                  Measured in Africa/Addis_Ababa timezone (EAT, UTC+3)
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-400"></span>
                  Visitors
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-sky-500"></span>
                  Page Views
                </span>
              </div>
            </div>

            {summary && summary.dailyStats.length > 0 ? (
              <div className="space-y-3 pt-2">
                {summary.dailyStats.map((d) => {
                  const maxVal = Math.max(
                    ...summary.dailyStats.map((s) => Math.max(s.pageViews, s.visitors, 1))
                  );
                  const visitorWidth = Math.max(6, Math.round((d.visitors / maxVal) * 100));
                  const pageViewWidth = Math.max(6, Math.round((d.pageViews / maxVal) * 100));

                  return (
                    <div key={d.date} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-slate-700">{d.date}</span>
                        <span className="text-slate-500">
                          {d.visitors} visitors • {d.sessions} sessions • {d.pageViews} views
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all"
                            style={{ width: `${visitorWidth}%` }}
                          />
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full transition-all"
                            style={{ width: `${pageViewWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-600">No Daily Activity Recorded Yet</p>
                <p className="text-[11px] text-slate-400 max-w-sm mt-0.5">
                  Once public traffic visits the website, exact daily timestamps will chart automatically.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: AI BUSINESS ANALYST (GEMINI) */}
      {/* ========================================================= */}
      {activeSection === 'aiAnalyst' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-gradient-to-r from-[#0B132B] to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    Gemini 3.8 Flash Engine
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    Period: {summary?.dateRangeLabel || period}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  EXECUTIVE AI BUSINESS ANALYST
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Synthesizes actual retrieved analytics, conversion funnel bottlenecks, and market patterns.
                  Strictly grounded in authentic data: outputs <code className="text-amber-400 font-mono">INSUFFICIENT DATA</code> when numbers are zero or unmeasured.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateAiReport}
                  disabled={isGeneratingAi}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-transform transform hover:-translate-y-0.5 shadow-lg shadow-amber-400/20 disabled:opacity-50"
                >
                  <Bot className={`w-4 h-4 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingAi ? 'Synthesizing Data...' : 'Generate AI Intelligence Report'}</span>
                </button>
              </div>
            </div>
          </div>

          {aiError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {/* AI Report Display Card */}
          {aiReport ? (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-amber-500" />
                  <h3 className="font-black text-lg text-slate-900">
                    Intelligence Report ({aiReport.period.toUpperCase()})
                  </h3>
                  {aiReport.isInsufficientData ? (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      INSUFFICIENT DATA (PRE-LAUNCH)
                    </span>
                  ) : (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      MEASURED DATA ANALYZED
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 text-[11px]">
                    Generated {new Date(aiReport.generatedAt).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={handleCopyAiReport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                  >
                    {copiedAi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAi ? 'Copied' : 'Copy Report'}</span>
                  </button>
                </div>
              </div>

              {/* Strict Disclaimer Notice */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Strict Fact Verification Protocol:</strong> All points prefixed with{' '}
                  <span className="font-bold text-emerald-700">[MEASURED FACTS]</span> reflect verified database numbers.
                  Points marked <span className="font-bold text-sky-700">[ESTIMATES]</span> or{' '}
                  <span className="font-bold text-amber-700">[RECOMMENDATIONS]</span> provide market context for the Ethiopian job market.
                </div>
              </div>

              {/* Report Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-amber-500" />
                    <span>Executive Performance Summary</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {aiReport.performanceSummary}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span>Growth & Trajectory Analysis</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {aiReport.growthAnalysis}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-sky-500" />
                    <span>Visitor Acquisition & Channel Performance</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {aiReport.acquisitionAnalysis}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-indigo-500" />
                    <span>Category & Vacancy Demand Insights</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {aiReport.categoryAndJobInsights}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <MousePointerClick className="w-4 h-4 text-amber-600" />
                    <span>Application Click & Candidate Intent</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {aiReport.engagementAndClickPerformance}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-[#229ED9]" />
                    <span>Traffic Source Assessment</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {aiReport.trafficSourceAssessment}
                  </p>
                </div>
              </div>

              {/* Identified Problems & Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
                  <div className="text-xs font-black text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Identified Website Performance Bottlenecks</span>
                  </div>
                  <ul className="space-y-2 text-xs text-rose-900">
                    {aiReport.identifiedProblems?.map((prob, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-bold text-rose-600">•</span>
                        <span>{prob}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                  <div className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    <span>Practical Business Growth Recommendations</span>
                  </div>
                  <ul className="space-y-2 text-xs text-emerald-900">
                    {aiReport.strategicRecommendations?.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-bold text-emerald-600">✓</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-200 flex flex-col items-center justify-center">
              <Bot className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="font-extrabold text-base text-slate-900">
                No AI Intelligence Report Generated Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                Click "Generate AI Intelligence Report" above. Gemini will analyze the current period's data and compile an executive summary.
              </p>
              <button
                onClick={handleGenerateAiReport}
                disabled={isGeneratingAi}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-xs transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Run Analysis Now</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 3: VISITOR CONVERSION FUNNEL */}
      {/* ========================================================= */}
      {activeSection === 'funnel' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6 animate-in fade-in duration-150">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Filter className="w-5 h-5 text-amber-500" />
              <h2 className="text-xl font-black text-slate-900">
                Visitor Conversion Funnel (Step-by-Step Flow)
              </h2>
            </div>
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
              Measures candidate progress from top of the funnel (website landing) down to outbound employer application clicks,
              job bookmarks, employer inquiries, and verified service transactions.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950">
            <strong>Critical Accuracy Compliance:</strong> Outbound employer clicks indicate candidate intent to apply via the employer's official website or email.
            The portal never assumes or claims an application was completed once the candidate leaves to an external portal.
          </div>

          {/* Visual Step-by-Step Flow Cards */}
          <div className="space-y-4">
            {summary?.funnel?.map((step, idx) => {
              const maxCount = Math.max(...summary.funnel.map((s) => s.count), 1);
              const barWidth = Math.max(8, Math.round((step.count / maxCount) * 100));

              return (
                <div
                  key={step.stage}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-amber-400 transition-all space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#0B132B] text-amber-400 text-xs font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        {step.stage}
                      </h4>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span className="font-black text-slate-900 text-base">
                        {step.count}{' '}
                        <span className="text-slate-500 text-xs font-normal">candidates</span>
                      </span>
                      <span className="font-bold text-emerald-600 bg-emerald-100/70 px-2 py-0.5 rounded-lg">
                        {step.conversionRate}% overall
                      </span>
                      {idx > 0 && step.dropoffRate > 0 && (
                        <span className="font-semibold text-rose-600 bg-rose-100/70 px-2 py-0.5 rounded-lg">
                          -{step.dropoffRate}% dropoff
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="h-3 w-full bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 4: TRAFFIC & UTM INTELLIGENCE */}
      {/* ========================================================= */}
      {activeSection === 'traffic' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Traffic Source & Engagement Intelligence
                </h2>
                <p className="text-xs text-slate-500">
                  Identifies visitor acquisition channels and measures true engagement (visited 2+ pages or clicked apply)
                </p>
              </div>
              <Globe className="w-5 h-5 text-amber-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary?.trafficSources?.map((src) => (
                <div
                  key={src.source}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black px-3 py-1 rounded-xl bg-[#0B132B] text-amber-400">
                      {src.source}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {src.percentage}% of traffic
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center py-2 border-y border-slate-200/60 font-mono">
                    <div>
                      <div className="text-lg font-black text-slate-900">{src.visitors}</div>
                      <div className="text-[10px] text-slate-500">Total Visitors</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-emerald-600">{src.engagedVisitors}</div>
                      <div className="text-[10px] text-slate-500">Engaged Visitors</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Engagement Rate:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {src.engagementRate}%
                    </span>
                  </div>

                  {/* UTM Campaigns under this source */}
                  {src.utmCampaigns && src.utmCampaigns.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60 space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        Active UTM Campaigns:
                      </div>
                      {src.utmCampaigns.map((c, ci) => (
                        <div key={ci} className="text-[11px] flex items-center justify-between font-mono">
                          <span className="text-slate-700 truncate max-w-[140px]">{c.campaign}</span>
                          <span className="text-slate-500">{c.visitors}v / {c.clicks}c</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 5: JOB & EMPLOYER RANKINGS */}
      {/* ========================================================= */}
      {activeSection === 'jobRankings' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Vacancy Search & Filter */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={rankingSearch}
                onChange={(e) => setRankingSearch(e.target.value)}
                placeholder="Search ranked vacancies or employers..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Category:</span>
              <select
                value={rankingCategory}
                onChange={(e) => setRankingCategory(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="All">All Categories</option>
                {summary?.topCategories?.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Underperforming Vacancies (Engagement Gap) Notice */}
          {summary?.underperformingVacancies && summary.underperformingVacancies.length > 0 && (
            <div className="bg-amber-50 rounded-3xl p-6 border border-amber-200 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-base text-amber-950">
                  Engagement Gap: Vacancies with High Views but Low Application Clicks
                </h3>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                These vacancies attract high candidate interest but experience drop-offs before application link clicks.
                Inspect deadline proximity, missing requirements, or unclear apply instructions.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {summary.underperformingVacancies.map((uv) => (
                  <div key={uv.jobId} className="p-4 rounded-2xl bg-white border border-amber-200 shadow-xs space-y-1">
                    <div className="font-bold text-xs text-slate-900 line-clamp-1">{uv.title}</div>
                    <div className="text-[11px] text-slate-500">{uv.organization} • {uv.category}</div>
                    <div className="flex items-center justify-between text-xs font-mono pt-1 text-slate-700">
                      <span>{uv.views} views</span>
                      <span className="font-black text-rose-600">{uv.applyClicks} apply clicks ({uv.ctr}% CTR)</span>
                    </div>
                    <p className="text-[10px] text-amber-800 italic pt-1">{uv.opportunityReason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rankings Grid: Most Viewed Vacancies (2 cols) & Most Viewed Employers (1 col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Vacancy Rankings Table (2 cols) */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg text-slate-900">
                  Most Viewed Vacancies & Outbound CTR
                </h3>
                <MousePointerClick className="w-4 h-4 text-amber-500" />
              </div>

              {summary && summary.topVacancies.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="pb-3">Rank & Position</th>
                        <th className="pb-3 text-center">Views</th>
                        <th className="pb-3 text-center">Apply Clicks</th>
                        <th className="pb-3 text-right">Click-Through Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.topVacancies
                        .filter((v) => {
                          if (rankingCategory !== 'All' && v.category !== rankingCategory) return false;
                          if (rankingSearch && !v.title.toLowerCase().includes(rankingSearch.toLowerCase()) && !v.organization.toLowerCase().includes(rankingSearch.toLowerCase())) {
                            return false;
                          }
                          return true;
                        })
                        .map((v, i) => (
                          <tr key={v.jobId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-400 text-[11px] w-4">
                                  #{i + 1}
                                </span>
                                <div>
                                  <div className="font-bold text-slate-900 line-clamp-1">{v.title}</div>
                                  <div className="text-[11px] text-slate-500">{v.organization}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 text-center font-mono font-bold text-slate-700">{v.views}</td>
                            <td className="py-3 text-center font-mono font-bold text-emerald-600">{v.applyClicks}</td>
                            <td className="py-3 text-right font-mono font-black text-amber-600">{v.ctr}%</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-slate-400">No vacancy rankings recorded yet.</div>
              )}
            </div>

            {/* Top Employers Ranking (1 col) */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg text-slate-900">
                  Most Viewed Employers
                </h3>
                <Building className="w-4 h-4 text-slate-400" />
              </div>

              {summary && summary.topEmployers && summary.topEmployers.length > 0 ? (
                <div className="space-y-3">
                  {summary.topEmployers.map((emp, i) => (
                    <div
                      key={emp.organization}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 line-clamp-1">
                          #{i + 1} {emp.organization}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {emp.vacanciesCount} active vacancies
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-slate-900">{emp.totalViews} views</div>
                        <div className="text-[10px] text-emerald-600 font-semibold">{emp.totalApplyClicks} clicks ({emp.ctr}%)</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-slate-400">No employer rankings recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 6: GOOGLE SEARCH CONSOLE */}
      {/* ========================================================= */}
      {activeSection === 'searchConsole' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Search className="w-5 h-5 text-amber-500" />
                <h2 className="text-xl font-black text-slate-900">
                  Google Search Console (GSC) Integration
                </h2>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                    summary?.searchConsole?.status === 'CONNECTED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {summary?.searchConsole?.status || 'NOT CONFIGURED'}
                </span>
              </div>
              <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                Measures search appearance, organic search clicks, search impressions, average position, and indexing status.
                Search Console data is kept strictly distinct from GA4 website visitor sessions.
              </p>
            </div>
          </div>

          {/* GSC Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Search Impressions</div>
              <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                {summary?.searchConsole?.impressions ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Google Search appearances</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Search Clicks</div>
              <div className="text-2xl font-black text-emerald-600 font-mono mt-1">
                {summary?.searchConsole?.clicks ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Visits originating from Search</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Average Search CTR</div>
              <div className="text-2xl font-black text-amber-600 font-mono mt-1">
                {summary?.searchConsole?.ctr ?? 0}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Clicks / Impressions</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Average Position</div>
              <div className="text-2xl font-black text-sky-600 font-mono mt-1">
                {summary?.searchConsole?.averagePosition ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Google ranking average</div>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
              Search Console Domain Property Configuration
            </h4>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={gscUrlInput}
                onChange={(e) => setGscUrlInput(e.target.value)}
                placeholder="https://dreambigjobs.et or sc-domain:dreambigjobs.et"
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 flex-1"
              />
              <button
                onClick={() => handleSaveGscConfig('CONNECTED')}
                disabled={isSavingGsc}
                className="px-4 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-xs transition-colors"
              >
                Mark Connected & Verify
              </button>
              <button
                onClick={() => handleSaveGscConfig('NOT TESTED')}
                disabled={isSavingGsc}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors"
              >
                Save Property URL
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              To verify ownership in Google Search Console, upload your DNS TXT record or HTML verification tag to your domain registrar (e.g. ethio telecom / Ethio Telecom DNS).
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 7: WEBSITE HEALTH & AUDIT */}
      {/* ========================================================= */}
      {activeSection === 'health' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <HeartPulse className="w-5 h-5 text-rose-500" />
                <h2 className="text-xl font-black text-slate-900">
                  Website Health & Diagnostic Monitor
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Live monitoring for broken application links, server latency, mobile responsiveness, and database health
              </p>
            </div>

            <button
              onClick={handleRunHealthAudit}
              disabled={isRunningAudit}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRunningAudit ? 'animate-spin' : ''}`} />
              <span>{isRunningAudit ? 'Auditing Site...' : 'Run Health Audit Now'}</span>
            </button>
          </div>

          {auditMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{auditMessage}</span>
            </div>
          )}

          {/* Diagnostic Checks List */}
          <div className="space-y-3">
            {summary?.healthDiagnostics?.map((diag) => {
              let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
              if (diag.status === 'WARNING') badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
              else if (diag.status === 'FAIL') badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
              else if (diag.status === 'NOT TESTED') badgeColor = 'bg-slate-100 text-slate-700 border-slate-300';

              return (
                <div
                  key={diag.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs text-slate-900">{diag.name}</h4>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeColor}`}>
                        {diag.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{diag.details}</p>
                  </div>
                  <div className="text-right font-mono text-xs shrink-0">
                    <span className="font-bold text-slate-800">{diag.metric}</span>
                    <div className="text-[10px] text-slate-400">
                      Checked {new Date(diag.lastChecked).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 8: SMART ALERTS */}
      {/* ========================================================= */}
      {activeSection === 'alerts' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6 animate-in fade-in duration-150">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-5 h-5 text-amber-500" />
              <h2 className="text-xl font-black text-slate-900">
                Administrator Smart Alerts & Thresholds
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Automated notifications for traffic spikes, drop-offs, application link failures, and integration statuses
            </p>
          </div>

          <div className="space-y-3">
            {summary?.smartAlerts?.map((alt) => {
              let alertStyle = 'bg-slate-50 border-slate-200 text-slate-800';
              if (alt.status === 'ALERT') alertStyle = 'bg-rose-50 border-rose-200 text-rose-950';
              else if (alt.status === 'PASS') alertStyle = 'bg-emerald-50/70 border-emerald-200 text-emerald-950';

              return (
                <div
                  key={alt.id}
                  className={`p-4 rounded-2xl border ${alertStyle} flex flex-col sm:flex-row sm:items-start justify-between gap-4`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs">{alt.title}</span>
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                          alt.status === 'ALERT'
                            ? 'bg-rose-600 text-white'
                            : 'bg-emerald-200 text-emerald-900'
                        }`}
                      >
                        {alt.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold">{alt.triggerCondition}</div>
                    <div className="text-[11px] text-slate-500">
                      <strong>Current Reading:</strong> {alt.currentValue}
                    </div>
                    <div className="text-[11px] text-amber-900 font-medium pt-1 flex flex-wrap items-center justify-between gap-2">
                      <div>👉 <strong>Action:</strong> {alt.recommendedAction}</div>
                      {alt.actionLabel && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200/80">
                          {alt.actionLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-mono shrink-0">
                    {new Date(alt.detectedAt).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 9: BUSINESS & REVENUE BI */}
      {/* ========================================================= */}
      {activeSection === 'businessBi' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-xl font-black text-slate-900">
                    Business Performance & Verified Revenue
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Strictly measures actual collected revenue and verified employer inquiries (never projected or simulated)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsRecordInquiryOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Log Employer Inquiry</span>
                </button>
                <button
                  onClick={() => setIsRecordRevenueOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Record Transaction</span>
                </button>
              </div>
            </div>

            {/* Revenue Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200">
                <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Total Collected Revenue
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono mt-1">
                  {summary?.businessIntelligence?.totalCollectedRevenueEtb?.toLocaleString() ?? 0} ETB
                </div>
                <div className="text-[10px] text-emerald-800/80 mt-1">
                  100% verified collected payments
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Employer Ad Revenue
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                  {summary?.businessIntelligence?.actualEmployerRevenueEtb?.toLocaleString() ?? 0} ETB
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Featured job listing fees</div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  CV Tailoring Revenue
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                  {summary?.businessIntelligence?.actualCvServiceRevenueEtb?.toLocaleString() ?? 0} ETB
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Candidate resume services</div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Employer Inquiries
                </div>
                <div className="text-2xl font-black text-amber-600 font-mono mt-1">
                  {summary?.businessIntelligence?.employerInquiriesCount ?? 0}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Direct recruitment requests</div>
              </div>
            </div>

            {/* Strategic Growth Opportunities Identified */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Monetization & Business Opportunities</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {summary?.businessIntelligence?.growthOpportunities?.map((opp, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{opp.category}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {opp.potentialImpact} Impact
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{opp.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 10: GA4, INTEGRATIONS & SETTINGS */}
      {/* ========================================================= */}
      {activeSection === 'settings' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-8 animate-in fade-in duration-150">
          <div>
            <h2 className="text-xl font-black text-slate-900 mb-1">
              Analytics Integrations & Maintenance
            </h2>
            <p className="text-xs text-slate-500">
              Configure Google Analytics 4, Search Console credentials, and manage internal test traffic data
            </p>
          </div>

          {/* GA4 Setup Card */}
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Google Analytics 4 Measurement ID
                  </h3>
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                      siteSettings.gaMeasurementId
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {siteSettings.gaMeasurementId ? 'CONNECTED' : 'NOT CONFIGURED'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-xl">
                  Loads official <code className="font-mono">gtag.js</code> for public pages. Dual-reported alongside our verified first-party telemetry engine.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={gaInput}
                  onChange={(e) => setGaInput(e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 uppercase w-48"
                />
                <button
                  onClick={handleSaveGaMeasurementId}
                  disabled={isSavingGa}
                  className="px-4 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-xs transition-colors whitespace-nowrap shadow-sm"
                >
                  {isSavingGa ? 'Saving...' : 'Save GA4 ID'}
                </button>
              </div>
            </div>

            {gaSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{gaSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Development Test Data Maintenance */}
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Development Test Traffic Maintenance
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                Purge recorded internal developer clicks so your production launch dashboard begins with clean, 100% genuine user data.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePurgeTestData(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors border border-slate-200 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Purge Internal Test Visits</span>
              </button>

              <button
                onClick={() => handlePurgeTestData(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors border border-rose-200"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Reset All to 0</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Log Employer Inquiry */}
      {isRecordInquiryOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-black text-lg text-slate-900">
              Log Authentic Employer Inquiry
            </h3>
            <p className="text-xs text-slate-500">
              Record a genuine hiring inquiry received from an Ethiopian or international employer.
            </p>

            <form onSubmit={handleRecordInquiry} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Company / Organization *</label>
                <input
                  type="text"
                  required
                  value={inquiryCompany}
                  onChange={(e) => setInquiryCompany(e.target.value)}
                  placeholder="e.g. Awash Bank, UNICEF Ethiopia"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Contact Person</label>
                <input
                  type="text"
                  value={inquiryContact}
                  onChange={(e) => setInquiryContact(e.target.value)}
                  placeholder="e.g. HR Director, Hiring Lead"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Requested Service</label>
                <select
                  value={inquiryService}
                  onChange={(e) => setInquiryService(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-400 outline-none"
                >
                  <option value="Featured Vacancy Package">Featured Vacancy Package</option>
                  <option value="Urgent Hiring Broadcast">Urgent Hiring Broadcast</option>
                  <option value="Graduate Trainee Screening">Graduate Trainee Screening</option>
                  <option value="Direct Employer Profile">Direct Employer Profile</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRecordInquiryOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInquiry}
                  className="px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-xs shadow-sm"
                >
                  {isSubmittingInquiry ? 'Recording...' : 'Save Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Revenue Transaction */}
      {isRecordRevenueOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-black text-lg text-slate-900">
              Record Verified Revenue Transaction
            </h3>
            <p className="text-xs text-slate-500">
              Record authentic collected payments (in Ethiopian Birr) to maintain 100% verified business revenue data.
            </p>

            <form onSubmit={handleRecordRevenue} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Service Delivered *</label>
                <input
                  type="text"
                  required
                  value={revenueService}
                  onChange={(e) => setRevenueService(e.target.value)}
                  placeholder="e.g. Employer 30-Day Listing, CV Tailoring"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Amount (ETB) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={revenueAmount}
                  onChange={(e) => setRevenueAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Payer / Organization</label>
                <input
                  type="text"
                  value={revenuePayer}
                  onChange={(e) => setRevenuePayer(e.target.value)}
                  placeholder="e.g. Zemen Bank, Job Seeker"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRecordRevenueOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRevenue}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm"
                >
                  {isSubmittingRevenue ? 'Recording...' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
