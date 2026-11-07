import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Layers,
  FilePlus,
  AlertTriangle,
  Send,
  Settings,
  LogOut,
  ArrowLeft,
  Shield,
  CheckCircle2,
  Database,
  ExternalLink,
  BarChart3,
  HeartPulse,
  Bell,
} from 'lucide-react';
import {
  Vacancy,
  SiteSettings,
  DuplicateReportItem,
} from '../../types/job';
import { AnalyticsSummary } from '../../types/analytics';
import { BulkImportSystem } from './BulkImportSystem';
import { ManualPostModal } from './ManualPostModal';
import { DuplicateCenter } from './DuplicateCenter';
import { VacancyManager } from './VacancyManager';
import { TelegramSettings } from './TelegramSettings';
import { SiteSettingsPanel } from './SiteSettingsPanel';
import { TelegramPublishQueue } from './TelegramPublishQueue';
import { WebsiteAnalytics } from './WebsiteAnalytics';
import { SystemHealth } from './SystemHealth';
import { SmartAlertsBell, SmartAlertsCenter, evaluateSmartAlerts } from './SmartAlerts';
import { PersonalAutoApply } from './PersonalAutoApply';
import { auth, googleProvider, ADMIN_EMAIL } from '../../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { runAutonomousVacancyHealing } from '../../utils/SelfHealingEngine';

interface Props {
  adminEmail: string | null;
  onLogout: () => void;
  onCloseDashboard: () => void;
  vacancies: Vacancy[];
  siteSettings: SiteSettings;
  duplicateReports: DuplicateReportItem[];
  onSaveVacancy: (vacancy: Vacancy) => Promise<void>;
  onBatchSaveVacancies: (vacancies: Vacancy[]) => Promise<void>;
  onDeleteVacancy: (id: string) => Promise<void>;
  onBatchDeleteVacancies?: (ids: string[]) => Promise<void>;
  onUpdateVacancyStatus: (id: string, status: Vacancy['status'], deadline?: string) => Promise<void>;
  onSaveSiteSettings: (settings: SiteSettings) => Promise<void>;
  onSaveDuplicateReports: (reports: DuplicateReportItem[]) => Promise<void>;
  onDiscardDuplicate: (reportId: string) => Promise<void>;
  onRestoreDuplicate: (report: DuplicateReportItem) => Promise<void>;
  onRestoreFullBackup: (data: {
    vacancies: Vacancy[];
    settings?: SiteSettings;
    duplicateReports?: DuplicateReportItem[];
  }) => Promise<void>;
}

export const AdminDashboard: React.FC<Props> = ({
  adminEmail,
  onLogout,
  onCloseDashboard,
  vacancies,
  siteSettings,
  duplicateReports,
  onSaveVacancy,
  onBatchSaveVacancies,
  onDeleteVacancy,
  onBatchDeleteVacancies,
  onUpdateVacancyStatus,
  onSaveSiteSettings,
  onSaveDuplicateReports,
  onDiscardDuplicate,
  onRestoreDuplicate,
  onRestoreFullBackup,
}) => {
  const [activeTab, setActiveTab] = useState<
    'bulk' | 'telegramQueue' | 'manual' | 'duplicates' | 'vacancies' | 'analytics' | 'health' | 'alerts' | 'autoApply' | 'telegram' | 'settings'
  >('bulk');

  const [queueSelectedJobIds, setQueueSelectedJobIds] = useState<string[]>([]);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null);
  const [broadcastVacancy, setBroadcastVacancy] = useState<Vacancy | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);

  // Periodic fetch of analytics summary for live alerts watchdog
  const fetchAnalyticsSummary = async () => {
    try {
      const params = new URLSearchParams({
        period: 'today',
        excludeAdmin: siteSettings.excludeAdminTraffic !== false ? 'true' : 'false',
        gaMeasurementId: siteSettings.gaMeasurementId || '',
        trafficDropThreshold: String(siteSettings.alertTrafficDropThreshold || 50),
        minBaseline: String(siteSettings.alertMinVisitorsBaseline || 2),
      });
      const res = await fetch(`/api/analytics/summary?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsSummary(data);
      }
    } catch (e) {
      console.warn('Analytics summary fetch for smart alerts:', e);
    }
  };

  useEffect(() => {
    fetchAnalyticsSummary();
    const interval = setInterval(fetchAnalyticsSummary, 30000);
    return () => clearInterval(interval);
  }, [
    siteSettings.excludeAdminTraffic,
    siteSettings.gaMeasurementId,
    siteSettings.alertTrafficDropThreshold,
    siteSettings.alertMinVisitorsBaseline,
  ]);

  // Global Autonomous Self-Healing Watchdog (Checks & fixes issues within seconds)
  useEffect(() => {
    const runGlobalHealSweep = async () => {
      try {
        const result = runAutonomousVacancyHealing(vacancies);
        if (result.changedCount > 0) {
          await onBatchSaveVacancies(result.healedVacancies);
        }
      } catch (err) {
        console.warn('Global self-healing sweep error:', err);
      }
    };

    // Run immediate sweep on mount/updates
    runGlobalHealSweep();

    const interval = setInterval(runGlobalHealSweep, 8000);
    return () => clearInterval(interval);
  }, [vacancies, onBatchSaveVacancies]);

  // Evaluated alerts for badge & bell
  const evaluatedAlerts = useMemo(
    () =>
      evaluateSmartAlerts(
        vacancies,
        siteSettings,
        analyticsSummary,
        siteSettings.dismissedAlertIds || []
      ),
    [vacancies, siteSettings, analyticsSummary]
  );

  const activeAlertsCount = evaluatedAlerts.filter(
    (a) => a.status === 'ALERT' && !a.isDismissed
  ).length;

  const unpostedToTelegramCount = vacancies.filter((v) => !v.telegramPublished).length;

  const handleSendToTelegramQueue = (jobs: Vacancy[]) => {
    setQueueSelectedJobIds(jobs.map((j) => j.id));
    setActiveTab('telegramQueue');
  };

  const handleEditVacancy = (v: Vacancy) => {
    setEditingVacancy(v);
    setIsManualModalOpen(true);
  };

  const handleDuplicatesFound = async (newReports: DuplicateReportItem[]) => {
    await onSaveDuplicateReports(newReports);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      {/* Top Admin Header Bar */}
      <header className="bg-[#0B132B] text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Left: Brand & Admin badge */}
            <div className="flex items-center gap-4">
              <button
                onClick={onCloseDashboard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                title="Return to Public Website View"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">View Public Website</span>
              </button>

              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm">
                  <Shield className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-lg text-white">
                      ADMIN CONTROL PANEL
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Owner
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    DREAM BIG JOBS • {adminEmail || 'nexusitsoultion@gmail.com'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Quick actions */}
            <div className="flex items-center gap-3">
              {/* Smart Alerts Notification Bell */}
              <SmartAlertsBell
                vacancies={vacancies}
                siteSettings={siteSettings}
                summary={analyticsSummary}
                onOpenCenter={() => setActiveTab('alerts')}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
                onEditVacancy={handleEditVacancy}
              />

              {!auth.currentUser && (
                <button
                  onClick={async () => {
                    try {
                      await signInWithPopup(auth, googleProvider);
                    } catch (e) {
                      console.warn('Google sign-in popup issue:', e);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-colors shadow-sm animate-pulse"
                  title={`Sign in with Google (${ADMIN_EMAIL}) to enable live Firestore cloud database sync`}
                >
                  <Shield className="w-3.5 h-3.5 fill-current" />
                  <span>Sync to Cloud</span>
                </button>
              )}

              <button
                onClick={() => {
                  setEditingVacancy(null);
                  setIsManualModalOpen(true);
                }}
                className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
              >
                <FilePlus className="w-4 h-4" />
                <span>Post Single Vacancy</span>
              </button>

              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 text-xs font-semibold transition-colors border border-slate-700"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pt-1 pb-3 scrollbar-none border-t border-slate-800/80 text-xs font-bold">
            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === 'bulk'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Bulk Import System (50 Jobs)</span>
            </button>

            <button
              onClick={() => setActiveTab('telegramQueue')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === 'telegramQueue'
                  ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Send className="w-4 h-4 text-sky-400 fill-current" />
              <span>Telegram Posting Queue</span>
              {unpostedToTelegramCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-black">
                  {unpostedToTelegramCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('vacancies')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === 'vacancies'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Manage Vacancies ({vacancies.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('duplicates')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === 'duplicates'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Strict Duplicate Center</span>
              {duplicateReports.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                  {duplicateReports.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Website Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('health')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === 'health'
                  ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <HeartPulse className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>System Health & Auto-Repair</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" />
            </button>

            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === 'alerts'
                  ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Smart Alerts</span>
              {activeAlertsCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                  {activeAlertsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('autoApply')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors border ${
                activeTab === 'autoApply'
                  ? 'bg-amber-400 text-slate-950 shadow-sm font-black border-amber-300'
                  : 'text-amber-300 hover:text-white hover:bg-slate-800 border-amber-500/30'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400 fill-current" />
              <span>Personal AI Auto Apply</span>
              <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Yeabsra
              </span>
            </button>

            <button
              onClick={() => setActiveTab('telegram')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === 'telegram'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Bot Config & Test</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === 'settings'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Site Settings & Backup</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {activeTab === 'bulk' && (
          <BulkImportSystem
            existingVacancies={vacancies}
            onPublishVacancies={onBatchSaveVacancies}
            onSaveDrafts={onBatchSaveVacancies}
            onDuplicatesFound={handleDuplicatesFound}
            telegramUrl={siteSettings.telegramChannelUrl}
            siteSettings={siteSettings}
            onSendToTelegramQueue={handleSendToTelegramQueue}
          />
        )}

        {activeTab === 'telegramQueue' && (
          <TelegramPublishQueue
            vacancies={vacancies}
            siteSettings={siteSettings}
            onUpdateVacancy={onSaveVacancy}
            onBatchUpdateVacancies={onBatchSaveVacancies}
            initialSelectedIds={queueSelectedJobIds}
          />
        )}

        {activeTab === 'vacancies' && (
          <VacancyManager
            vacancies={vacancies}
            onEditVacancy={handleEditVacancy}
            onDeleteVacancy={onDeleteVacancy}
            onUpdateStatus={onUpdateVacancyStatus}
            onOpenManualPost={() => {
              setEditingVacancy(null);
              setIsManualModalOpen(true);
            }}
            onBroadcastTelegram={(v) => {
              setQueueSelectedJobIds([v.id]);
              setActiveTab('telegramQueue');
            }}
            telegramUrl={siteSettings.telegramChannelUrl}
          />
        )}


        {activeTab === 'duplicates' && (
          <DuplicateCenter
            duplicateReports={duplicateReports}
            allVacancies={vacancies}
            onDiscardDuplicate={onDiscardDuplicate}
            onRestoreDuplicate={onRestoreDuplicate}
            onSaveVacancy={onSaveVacancy}
            onBatchUpdateVacancies={onBatchSaveVacancies}
            onDeleteVacancy={onDeleteVacancy}
            onBatchDeleteVacancies={onBatchDeleteVacancies}
            onUpdateVacancyStatus={onUpdateVacancyStatus}
            telegramUrl={siteSettings.telegramChannelUrl}
          />
        )}

        {activeTab === 'analytics' && (
          <WebsiteAnalytics
            siteSettings={siteSettings}
            onSaveSiteSettings={onSaveSiteSettings}
          />
        )}

        {activeTab === 'health' && (
          <SystemHealth
            vacancies={vacancies}
            onEditVacancy={handleEditVacancy}
            onUpdateVacancyStatus={onUpdateVacancyStatus}
            onBatchUpdateVacancies={onBatchSaveVacancies}
            onSaveVacancy={onSaveVacancy}
          />
        )}

        {activeTab === 'alerts' && (
          <SmartAlertsCenter
            vacancies={vacancies}
            siteSettings={siteSettings}
            onSaveSiteSettings={onSaveSiteSettings}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            onEditVacancy={handleEditVacancy}
            summary={analyticsSummary}
            onRefreshAnalytics={fetchAnalyticsSummary}
          />
        )}

        {activeTab === 'autoApply' && (
          <PersonalAutoApply
            vacancies={vacancies}
            adminEmail={adminEmail}
          />
        )}

        {activeTab === 'telegram' && (
          <TelegramSettings
            settings={siteSettings}
            onSaveSettings={onSaveSiteSettings}
            sampleVacancy={broadcastVacancy || vacancies[0]}
            allVacancies={vacancies}
            onUpdateVacancyTelegramStatus={async (id, published, messageId, error) => {
              const target = vacancies.find((v) => v.id === id);
              if (target) {
                const updated: Vacancy = {
                  ...target,
                  telegramPublished: published,
                  telegramMessageId: messageId,
                  telegramPublishedAt: published ? new Date().toISOString() : undefined,
                  telegramPublishError: error,
                  updatedAt: new Date().toISOString(),
                };
                await onSaveVacancy(updated);
              }
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SiteSettingsPanel
            settings={siteSettings}
            vacancies={vacancies}
            duplicateReports={duplicateReports}
            onSaveSettings={onSaveSiteSettings}
            onRestoreData={onRestoreFullBackup}
          />
        )}
      </main>

      {/* Manual Post / Edit Modal */}
      {isManualModalOpen && (
        <ManualPostModal
          existingVacancies={vacancies}
          onSaveVacancy={async (v) => {
            await onSaveVacancy(v);
            setIsManualModalOpen(false);
            setEditingVacancy(null);
          }}
          onClose={() => {
            setIsManualModalOpen(false);
            setEditingVacancy(null);
          }}
          initialData={editingVacancy}
        />
      )}
    </div>
  );
};
