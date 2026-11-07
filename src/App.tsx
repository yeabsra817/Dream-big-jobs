import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Sparkles,
  Send,
  MapPin,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Building,
  GraduationCap,
  TrendingUp,
  ArrowRight,
  ExternalLink,
  Users,
  Compass,
  Briefcase,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  Vacancy,
  SiteSettings,
  DuplicateReportItem,
  OFFICIAL_CATEGORIES,
  ETHIOPIAN_LOCATIONS,
  CategoryMeta,
} from './types/job';
import {
  fetchPublishedVacancies,
  fetchAllVacanciesAdmin,
  saveVacancy,
  saveBatchVacancies,
  deleteVacancy,
  deleteBatchVacancies,
  getSiteSettings,
  saveSiteSettings,
  fetchDuplicateReports,
  saveDuplicateReport,
  updateDuplicateReportStatus,
  deleteDuplicateReport,
  isUserAdmin,
  auth,
  ADMIN_EMAIL,
} from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { isExpired, SAMPLE_BULK_PASTE_DATA } from './utils/helpers';
import { Navbar } from './components/Navbar';
import { CategoryCard } from './components/CategoryCard';
import { CategoryView } from './components/CategoryView';
import { LocationJobsView } from './components/LocationJobsView';
import { SavedJobsDrawer } from './components/SavedJobsDrawer';
import { VacancyDetailModal } from './components/VacancyDetailModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminAuthModal } from './components/admin/AdminAuthModal';
import { Footer } from './components/Footer';
import { initGoogleAnalytics4, trackAnalyticsEvent } from './lib/analyticsTracker';

export default function App() {
  // State
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    telegramChannelName: '@DreamBigJobsEthiopia',
    telegramChannelUrl: 'https://t.me/DreamBigJobsEthiopia',
    telegramGroupUrl: 'https://t.me/DreamBigJobsEthiopia',
    telegramBotUsername: '@DreamBigJobsEthiopiaBot',
    telegramAutoPublish: true,
    contactEmail: 'nexusitsoultion@gmail.com',
    contactPhone: '+251 91 123 4567',
    contactAddress: 'Bole Subcity, Addis Ababa, Ethiopia',
    aboutText:
      'DREAM BIG JOBS is Ethiopia’s premier, verified job recruitment information portal. We provide genuine, accurate vacancies across banking, embassies, NGOs, hospitality, and leading corporate sectors.',
    updatedAt: new Date().toISOString(),
  });
  const [duplicateReports, setDuplicateReports] = useState<DuplicateReportItem[]>([]);

  // Navigation & View State
  const [selectedCategory, setSelectedCategory] = useState<CategoryMeta | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isOwnerAuthorized, setIsOwnerAuthorized] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  // Saved Jobs Bookmarking State
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('dreambigjobs_saved_jobs');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);

  // Search in Hero
  const [heroSearch, setHeroSearch] = useState('');
  const [heroLocation, setHeroLocation] = useState('All');

  // Language
  const [language, setLanguage] = useState<'en' | 'am'>('en');

  // Loading
  const [loading, setLoading] = useState(true);

  // Load Initial Data (Public data: site settings & published vacancies)
  useEffect(() => {
    async function loadData() {
      try {
        const [loadedSettings, loadedVacancies] = await Promise.all([
          getSiteSettings(),
          fetchPublishedVacancies(),
        ]);
        setSiteSettings(loadedSettings);
        setVacancies(loadedVacancies);

        // Initialize GA4 if measurement ID exists
        if (loadedSettings.gaMeasurementId) {
          initGoogleAnalytics4(loadedSettings.gaMeasurementId, false);
        }

        // Send initial public page_view event
        trackAnalyticsEvent('page_view', {
          path: window.location.pathname + window.location.search,
          title: document.title,
          gaMeasurementId: loadedSettings.gaMeasurementId,
        });

        // Check URL parameter for direct job link (from Telegram / WhatsApp / Social shares)
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const jobId = urlParams.get('jobId');
          if (jobId) {
            const found = loadedVacancies.find((v) => v.id === jobId);
            if (found) setSelectedVacancy(found);
          }
        }
      } catch (err) {
        console.warn('Initial data load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Firebase Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && isUserAdmin(user)) {
        setIsOwnerAuthorized(true);
        setAdminEmail(user.email);
      }
    });

    return () => unsubscribe();
  }, []);

  // When admin logs in, load ALL vacancies (including drafts, pending_review, archived) and duplicate reports
  useEffect(() => {
    if (isOwnerAuthorized) {
      Promise.all([fetchAllVacanciesAdmin(), fetchDuplicateReports()])
        .then(([all, dups]) => {
          if (all.length > 0) setVacancies(all);
          if (dups.length > 0) setDuplicateReports(dups);
        })
        .catch((err) => console.warn('Admin data load error:', err));
    }
  }, [isOwnerAuthorized]);

  // Track Category View events
  useEffect(() => {
    if (selectedCategory) {
      trackAnalyticsEvent('category_view', {
        category: selectedCategory.name,
        title: `${selectedCategory.name} - Jobs in Ethiopia`,
        path: `/?category=${encodeURIComponent(selectedCategory.name)}`,
        gaMeasurementId: siteSettings.gaMeasurementId,
      });
    }
  }, [selectedCategory, siteSettings.gaMeasurementId]);

  // Track Location View events
  useEffect(() => {
    if (selectedLocation) {
      trackAnalyticsEvent('location_view', {
        path: `/?location=${encodeURIComponent(selectedLocation)}`,
        title: `Vacancies in ${selectedLocation} - DREAM BIG JOBS`,
        gaMeasurementId: siteSettings.gaMeasurementId,
      });
    }
  }, [selectedLocation, siteSettings.gaMeasurementId]);

  // Compute active published vacancy count for each category
  const activeCountMap = useMemo(() => {
    const map = new Map<string, number>();
    OFFICIAL_CATEGORIES.forEach((c) => map.set(c.name, 0));

    vacancies.forEach((v) => {
      if (v.status === 'published' && !isExpired(v.applicationDeadline)) {
        const current = map.get(v.category) || 0;
        map.set(v.category, current + 1);
      }
    });
    return map;
  }, [vacancies]);

  // Filter categories by hero search
  const filteredCategories = useMemo(() => {
    if (!heroSearch.trim()) return OFFICIAL_CATEGORIES;
    const query = heroSearch.toLowerCase().trim();
    return OFFICIAL_CATEGORIES.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.amharicName.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.featuredEmployers.some((e) => e.toLowerCase().includes(query))
    );
  }, [heroSearch]);

  // Total active vacancies count across all sectors
  const totalActiveVacancies = useMemo(() => {
    return vacancies.filter((v) => v.status === 'published' && !isExpired(v.applicationDeadline)).length;
  }, [vacancies]);

  // Handlers for Admin Operations
  const handleSaveVacancy = async (v: Vacancy) => {
    let finalVacancy = { ...v };

    // Auto-broadcast to Telegram channel if published and enabled
    if (v.status === 'published' && siteSettings.telegramAutoPublish && !v.telegramPublished) {
      try {
        const tgRes = await fetch('/api/admin/telegram-publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vacancy: v,
            channelName: siteSettings.telegramChannelName || '@DreamBigJobsEthiopia',
          }),
        });
        const tgData = await tgRes.json();
        if (tgData.success) {
          finalVacancy.telegramPublished = true;
          finalVacancy.telegramMessageId = tgData.telegramMessageId;
          finalVacancy.telegramPublishedAt = tgData.telegramPublishedAt;
          finalVacancy.telegramPublishError = '';
        } else if (tgData.error) {
          finalVacancy.telegramPublishError = tgData.error;
        }
      } catch (err) {
        console.warn('Auto Telegram publish failed:', err);
      }
    }

    // 1. Update React state immediately
    setVacancies((prev) => {
      const idx = prev.findIndex((item) => item.id === finalVacancy.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = finalVacancy;
        return next;
      }
      return [finalVacancy, ...prev];
    });

    // 2. Persist to storage safely
    try {
      await saveVacancy(finalVacancy);
    } catch (err) {
      console.warn('Save vacancy persistence note:', err);
    }
  };

  const handleBatchSaveVacancies = async (newVacancies: Vacancy[]) => {
    // 1. Immediately update React state so the UI reflects changes without waiting for network
    setVacancies((prev) => {
      const updateMap = new Map<string, Vacancy>();
      prev.forEach((v) => updateMap.set(v.id, v));
      newVacancies.forEach((nv) => updateMap.set(nv.id, nv));
      return Array.from(updateMap.values());
    });

    // 2. Persist to storage safely
    try {
      await saveBatchVacancies(newVacancies);
    } catch (err) {
      console.warn('Batch vacancy persistence note:', err);
    }
  };

  const handleDeleteVacancy = async (id: string) => {
    await deleteVacancy(id);
    setVacancies((prev) => prev.filter((v) => v.id !== id));
  };

  const handleBatchDeleteVacancies = async (ids: string[]) => {
    await deleteBatchVacancies(ids);
    const idSet = new Set(ids);
    setVacancies((prev) => prev.filter((v) => !idSet.has(v.id)));
  };

  const handleSelectLocation = (city: string) => {
    setSelectedLocation(city);
    setSelectedCategory(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSaveJob = (jobId: string) => {
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      try {
        localStorage.setItem('dreambigjobs_saved_jobs', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const handleRemoveSavedJob = (jobId: string) => {
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      try {
        localStorage.setItem('dreambigjobs_saved_jobs', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const handleClearAllSaved = () => {
    setSavedJobIds(new Set());
    try {
      localStorage.removeItem('dreambigjobs_saved_jobs');
    } catch {}
  };

  const handleUpdateVacancyStatus = async (
    id: string,
    status: Vacancy['status'],
    newDeadline?: string
  ) => {
    const target = vacancies.find((v) => v.id === id);
    if (!target) return;
    let updated: Vacancy = {
      ...target,
      status,
      applicationDeadline: newDeadline || target.applicationDeadline,
      updatedAt: new Date().toISOString(),
    };

    // Auto-broadcast to Telegram if transitioning to published
    if (status === 'published' && siteSettings.telegramAutoPublish && !updated.telegramPublished) {
      try {
        const tgRes = await fetch('/api/admin/telegram-publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vacancy: updated,
            channelName: siteSettings.telegramChannelName || '@DreamBigJobsEthiopia',
          }),
        });
        const tgData = await tgRes.json();
        if (tgData.success) {
          updated.telegramPublished = true;
          updated.telegramMessageId = tgData.telegramMessageId;
          updated.telegramPublishedAt = tgData.telegramPublishedAt;
          updated.telegramPublishError = undefined;
        } else if (tgData.error) {
          updated.telegramPublishError = tgData.error;
        }
      } catch (err) {
        console.warn('Auto Telegram publish error on status change:', err);
      }
    }

    // 1. Immediately update React state
    setVacancies((prev) => prev.map((v) => (v.id === id ? updated : v)));

    // 2. Persist safely
    try {
      await saveVacancy(updated);
    } catch (err) {
      console.warn('Update vacancy status note:', err);
    }
  };

  const handleSaveSiteSettings = async (newSettings: SiteSettings) => {
    await saveSiteSettings(newSettings);
    setSiteSettings(newSettings);
  };

  const handleSaveDuplicateReports = async (newReports: DuplicateReportItem[]) => {
    for (const rep of newReports) {
      await saveDuplicateReport(rep);
    }
    setDuplicateReports((prev) => [...newReports, ...prev]);
  };

  const handleDiscardDuplicate = async (reportId: string) => {
    await deleteDuplicateReport(reportId);
    setDuplicateReports((prev) => prev.filter((r) => r.id !== reportId));
  };

  const handleRestoreDuplicate = async (report: DuplicateReportItem) => {
    // Restore as a valid vacancy in draft / pending review
    const restoredVacancy: Vacancy = {
      id: `restored_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: report.candidateTitle,
      organization: report.candidateOrg,
      category: report.candidateData.category || 'Private Companies',
      location: report.candidateData.location || 'Addis Ababa',
      employmentType: report.candidateData.employmentType || 'Full-time',
      vacanciesCount: report.candidateData.vacanciesCount || 'Not specified in the original vacancy',
      salary: report.candidateData.salary || 'Not specified in the original vacancy',
      educationQualification: report.candidateData.educationQualification || 'Not specified in the original vacancy',
      requiredFieldOfStudy: report.candidateData.requiredFieldOfStudy || 'Not specified in the original vacancy',
      experienceYears: report.candidateData.experienceYears || 'Not specified in the original vacancy',
      requiredSkills: report.candidateData.requiredSkills || [],
      description: report.candidateData.description || 'Restored duplicate entry.',
      responsibilities: report.candidateData.responsibilities || [],
      requiredDocuments: report.candidateData.requiredDocuments || ['CV', 'Cover Letter'],
      applicationMethod: report.candidateData.applicationMethod || 'Online URL',
      applicationUrl: report.candidateData.applicationUrl || '',
      applicationEmail: report.candidateData.applicationEmail || '',
      applicationInstructions: report.candidateData.applicationInstructions || 'Apply directly.',
      applicationDeadline: report.candidateData.applicationDeadline || '2026-11-30',
      contactInfo: report.candidateData.contactInfo || 'Not specified in the original vacancy',
      status: 'pending_review',
      viewsCount: 0,
      sharesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveVacancy(restoredVacancy);
    await updateDuplicateReportStatus(report.id, 'restored');
    setVacancies((prev) => [restoredVacancy, ...prev]);
    setDuplicateReports((prev) => prev.filter((r) => r.id !== report.id));
    alert(`Successfully restored "${restoredVacancy.title}" to the Vacancy Review queue!`);
  };

  const handleRestoreFullBackup = async (data: {
    vacancies: Vacancy[];
    settings?: SiteSettings;
    duplicateReports?: DuplicateReportItem[];
  }) => {
    await saveBatchVacancies(data.vacancies);
    if (data.settings) await saveSiteSettings(data.settings);
    setVacancies(data.vacancies);
    if (data.settings) setSiteSettings(data.settings);
    if (data.duplicateReports) setDuplicateReports(data.duplicateReports);
  };

  const handleSelectCategoryByName = (categoryName: string) => {
    const meta = OFFICIAL_CATEGORIES.find((c) => c.name === categoryName);
    if (meta) {
      setSelectedCategory(meta);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // If in Admin Dashboard view
  if (isAdminView && isOwnerAuthorized) {
    return (
      <AdminDashboard
        adminEmail={adminEmail}
        onLogout={async () => {
          await signOut(auth);
          setIsOwnerAuthorized(false);
          setIsAdminView(false);
        }}
        onCloseDashboard={() => setIsAdminView(false)}
        vacancies={vacancies}
        siteSettings={siteSettings}
        duplicateReports={duplicateReports}
        onSaveVacancy={handleSaveVacancy}
        onBatchSaveVacancies={handleBatchSaveVacancies}
        onDeleteVacancy={handleDeleteVacancy}
        onBatchDeleteVacancies={handleBatchDeleteVacancies}
        onUpdateVacancyStatus={handleUpdateVacancyStatus}
        onSaveSiteSettings={handleSaveSiteSettings}
        onSaveDuplicateReports={handleSaveDuplicateReports}
        onDiscardDuplicate={handleDiscardDuplicate}
        onRestoreDuplicate={handleRestoreDuplicate}
        onRestoreFullBackup={handleRestoreFullBackup}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Navigation Bar */}
      <Navbar
        siteSettings={siteSettings}
        isAdmin={isOwnerAuthorized}
        adminEmail={adminEmail}
        onOpenAdmin={() => {
          if (isOwnerAuthorized) setIsAdminView(true);
          else setIsAuthModalOpen(true);
        }}
        onSelectCategory={handleSelectCategoryByName}
        onHomeClick={() => {
          setSelectedCategory(null);
          setSelectedLocation(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenLocations={() => handleSelectLocation('All')}
        onOpenSavedJobs={() => setIsSavedDrawerOpen(true)}
        savedCount={savedJobIds.size}
        onOpenCvHelp={() => {
          const el = document.getElementById('cv-assistance-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        language={language}
        onToggleLanguage={() => setLanguage(language === 'en' ? 'am' : 'en')}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {selectedLocation ? (
          /* DEDICATED LOCATION VACANCY PAGE (Shows jobs when user clicks job by location) */
          <LocationJobsView
            initialLocation={selectedLocation}
            vacancies={vacancies}
            onBack={() => {
              setSelectedLocation(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectVacancy={(v) => setSelectedVacancy(v)}
            savedJobIds={savedJobIds}
            onToggleSaveJob={handleToggleSaveJob}
            telegramUrl={siteSettings.telegramChannelUrl}
          />
        ) : selectedCategory ? (
          /* DEDICATED CATEGORY VACANCY PAGE */
          <CategoryView
            category={selectedCategory}
            vacancies={vacancies}
            onBack={() => {
              setSelectedCategory(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectVacancy={(v) => setSelectedVacancy(v)}
            savedJobIds={savedJobIds}
            onToggleSaveJob={handleToggleSaveJob}
            onSelectLocation={handleSelectLocation}
            telegramUrl={siteSettings.telegramChannelUrl}
          />
        ) : (
          /* HOMEPAGE (Displays Job Categories, Search, Key Stats, Locations, About) */
          <>
            {/* HERO SECTION */}
            <section className="relative bg-[#0B132B] text-white overflow-hidden py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
              {/* Background radial glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

              <div className="relative max-w-7xl mx-auto text-center space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/90 text-amber-400 text-xs font-bold border border-slate-700/80 shadow-sm animate-in fade-in">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>100% Verified Ethiopian Career Opportunities</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                  DREAM BIG <span className="text-amber-400">JOBS</span>
                  <span className="block text-xl sm:text-2xl lg:text-3xl font-medium text-slate-300 mt-3">
                    Dream Big. Find Your Opportunity.
                  </span>
                </h1>

                <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed">
                  Your trusted destination for banking, embassy, NGO, hospitality, tourism, and corporate career opportunities across Addis Ababa and all Ethiopian regions.
                </p>

                {/* Hero Search Box */}
                <div className="max-w-3xl mx-auto pt-4">
                  <div className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-2xl border border-slate-200/90 flex flex-col sm:flex-row items-center gap-2 text-slate-900">
                    <div className="relative flex-1 w-full">
                      <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={heroSearch}
                        onChange={(e) => setHeroSearch(e.target.value)}
                        placeholder="Search category, bank, NGO, or role..."
                        className="w-full pl-11 pr-4 py-3 rounded-xl text-sm outline-none font-medium placeholder:text-slate-400"
                      />
                    </div>

                    <a
                      href="#categories-section"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm transition-all shadow-md shrink-0"
                    >
                      <span>Explore Categories</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Quick sector tags */}
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs text-slate-400">
                    <span>Popular Sectors:</span>
                    {['Banking', 'NGO & UN', 'Embassies', 'Hotels', 'IT & Telecom'].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          setHeroSearch(tag);
                          const el = document.getElementById('categories-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  {/* Smart Quick Cities Row */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 text-xs">
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Jobs by Location:</span>
                    </span>
                    {['Addis Ababa', 'Hawassa', 'Adama', 'Dire Dawa', 'Bahir Dar', 'Mekelle'].map((city) => (
                      <button
                        key={city}
                        onClick={() => handleSelectLocation(city)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-amber-400 hover:text-slate-950 text-slate-300 font-semibold transition-all border border-slate-700/60"
                      >
                        {city}
                      </button>
                    ))}
                    <button
                      onClick={() => handleSelectLocation('All')}
                      className="px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 hover:bg-amber-400 hover:text-slate-950 font-extrabold transition-all border border-amber-400/40"
                    >
                      All Cities →
                    </button>
                  </div>
                </div>

                {/* Live Statistics Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-slate-800/80 text-left">
                  <div className="bg-slate-900/60 backdrop-blur p-4 rounded-2xl border border-slate-800">
                    <div className="text-2xl sm:text-3xl font-black text-amber-400">
                      {totalActiveVacancies}
                    </div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                      Active Vacancies
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Real database count</div>
                  </div>

                  <div className="bg-slate-900/60 backdrop-blur p-4 rounded-2xl border border-slate-800">
                    <div className="text-2xl sm:text-3xl font-black text-white">16</div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                      Job Sectors
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Banking to Diplomatic</div>
                  </div>

                  <div className="bg-slate-900/60 backdrop-blur p-4 rounded-2xl border border-slate-800">
                    <div className="text-2xl sm:text-3xl font-black text-white">25+</div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                      Ethiopian Cities
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Addis & All Regions</div>
                  </div>

                  <div className="bg-slate-900/60 backdrop-blur p-4 rounded-2xl border border-slate-800">
                    <div className="text-2xl sm:text-3xl font-black text-emerald-400">100%</div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                      Admin Verified
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Zero fake vacancies</div>
                  </div>
                </div>
              </div>
            </section>

            {/* TELEGRAM COMMUNITY STRIP */}
            <section className="bg-gradient-to-r from-[#229ED9] via-[#1E88E5] to-[#0288D1] text-white py-5 px-4 sm:px-6 shadow-inner">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-sm">
                    <Send className="w-6 h-6 fill-white" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold tracking-tight">
                      Never Miss a Job Opportunity! Get Ethiopian Vacancies on Telegram
                    </h3>
                    <p className="text-xs text-white/90 font-medium">
                      Join <strong className="text-white underline">@DreamBigJobsEthiopia</strong> for verified banking, embassy, NGO, and corporate vacancy broadcasts.
                    </p>
                  </div>
                </div>
                <a
                  href={siteSettings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopia'}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join Our Telegram Channel @DreamBigJobsEthiopia"
                  className="px-6 py-3 rounded-xl bg-white text-[#1976D2] hover:bg-slate-50 font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-cyan-900/20 transition-all transform hover:scale-105 shrink-0 flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4 fill-[#1976D2]" />
                  <span>Join Our Telegram Channel</span>
                </a>
              </div>
            </section>

            {/* JOB CATEGORIES SECTION (THE CORE REQUIREMENT) */}
            <section id="categories-section" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                  <Briefcase className="w-3.5 h-3.5 text-amber-700" />
                  <span>Explore by Professional Sector</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0B132B]">
                  Official Ethiopian Job Categories
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Click on any category to view all active, verified vacancies in that sector. Vacancy numbers reflect real published announcements in our database.
                </p>
              </div>

              {/* 16 Category Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredCategories.map((category) => {
                  const count = activeCountMap.get(category.name) || 0;
                  return (
                    <CategoryCard
                      key={category.id}
                      category={category}
                      activeCount={count}
                      onSelect={(catName) => handleSelectCategoryByName(catName)}
                      language={language}
                    />
                  );
                })}
              </div>

              {/* Empty state hint if database has 0 vacancies */}
              {totalActiveVacancies === 0 && (
                <div className="mt-12 p-6 rounded-3xl bg-amber-50 border border-amber-300 max-w-2xl mx-auto text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center mx-auto">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold text-amber-950">
                    Administrator Setup Note
                  </h4>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    You are logged in or ready to publish vacancies. Click below to open the Admin Portal, where you can paste or upload up to 50 real vacancies in one bulk import!
                  </p>
                  <button
                    onClick={() => {
                      if (isOwnerAuthorized) setIsAdminView(true);
                      else setIsAuthModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-500 hover:text-slate-950 text-white font-extrabold text-xs transition-colors shadow-md"
                  >
                    <span>Open Admin Bulk Import Tool</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </section>

            {/* POPULAR ETHIOPIAN LOCATIONS SECTION */}
            <section id="locations-section" className="bg-slate-100/70 py-16 px-4 sm:px-6 lg:px-8 border-y border-slate-200">
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Nationwide Coverage</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B132B]">
                      Popular Ethiopian Job Locations
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Explore vacancies in commercial hubs, regional capital cities, and nationwide projects.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {ETHIOPIAN_LOCATIONS.slice(0, 12).map((city) => {
                    const countInCity = vacancies.filter(
                      (v) =>
                        v.status === 'published' &&
                        v.location.toLowerCase().includes(city.toLowerCase().split(' ')[0])
                    ).length;

                    return (
                      <div
                        key={city}
                        onClick={() => handleSelectLocation(city)}
                        className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-amber-500 hover:shadow-lg transition-all cursor-pointer group hover:-translate-y-0.5 duration-200"
                        title={`Click to view all jobs in ${city}`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-slate-800 group-hover:text-amber-600 transition-colors line-clamp-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>{city}</span>
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            countInCity > 0
                              ? 'bg-amber-100 text-amber-900 font-black'
                              : 'bg-slate-100 text-slate-400 font-medium'
                          }`}>
                            {countInCity}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* CV & COVER LETTER ASSISTANCE SECTION */}
            <section id="cv-assistance-section" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <div className="bg-[#FFFBEB] rounded-3xl p-8 sm:p-12 border-2 border-amber-300 relative overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
                      <Sparkles className="w-3.5 h-3.5 fill-current" />
                      <span>Career Guidance Service</span>
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-extrabold text-amber-950">
                      CV & Cover Letter Assistance for Ethiopian Job Seekers
                    </h2>
                    <p className="text-sm text-amber-900/90 leading-relaxed">
                      Applying for banking positions at CBE or Awash? Diplomatic missions at AU or embassies? UN agencies like UNICEF? Each sector requires tailored application standards.
                    </p>

                    <div className="space-y-2 text-xs text-amber-900 font-medium">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Every vacancy page includes a 1-click tailored cover letter generator.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Accurate checklists of required documents (Kebele ID, Degree, Experience).</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Direct official employer portals — no third-party application fees.</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-md space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      Sample Application Checklist (Ethiopian Standards)
                    </h3>
                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <span>1. Professional CV (Max 2-3 pages, Chronological)</span>
                        <span className="text-emerald-600 font-bold">Standard</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <span>2. Tailored Application Letter referencing vacancy Ref #</span>
                        <span className="text-emerald-600 font-bold">Essential</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <span>3. University Degree & Official Student Copy</span>
                        <span className="text-emerald-600 font-bold">Required</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <span>4. Work Experience letters stating job title & dates</span>
                        <span className="text-emerald-600 font-bold">Verified</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <span>5. Renewed National ID (Fayda / Kebele ID)</span>
                        <span className="text-emerald-600 font-bold">Government</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ABOUT US SECTION */}
            <section id="about-section" className="bg-white py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
              <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Our Quality Promise</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B132B]">
                    About DREAM BIG JOBS
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {siteSettings.aboutText ||
                      'DREAM BIG JOBS is Ethiopia’s premier, verified job recruitment information portal. We provide genuine, accurate vacancies across banking, embassies, NGOs, hospitality, and leading corporate sectors.'}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Unlike unregulated job scrapers, every vacancy on DREAM BIG JOBS is collected, checked, and approved personally by the website owner. We never generate fake vacancies or invent employer information.
                  </p>

                  <div className="pt-2 flex items-center gap-4">
                    <a
                      href={siteSettings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopiaBot'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#229ED9] text-white font-bold text-xs hover:bg-[#1E88E5] transition-colors shadow-sm"
                    >
                      <Send className="w-4 h-4" />
                      <span>Open Our Telegram Bot</span>
                    </a>
                  </div>
                </div>

                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 space-y-4">
                  <h3 className="text-base font-bold text-[#0B132B]">
                    Why Ethiopian Job Seekers Choose DREAM BIG JOBS:
                  </h3>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold">
                        1
                      </div>
                      <div>
                        <strong className="text-slate-900 block font-bold">Verified Announcements Only</strong>
                        Every job has a confirmed deadline, verified employer, and official application method.
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold">
                        2
                      </div>
                      <div>
                        <strong className="text-slate-900 block font-bold">Smart Sector Categorization</strong>
                        Explore by sector so you quickly find jobs matching your exact profession and degree.
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold">
                        3
                      </div>
                      <div>
                        <strong className="text-slate-900 block font-bold">No Application Fees / Direct Links</strong>
                        We link directly to official employer career sites or official recruitment emails.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <Footer
        siteSettings={siteSettings}
        onSelectCategory={handleSelectCategoryByName}
        onSelectLocation={handleSelectLocation}
        onOpenAdmin={() => {
          if (isOwnerAuthorized) setIsAdminView(true);
          else setIsAuthModalOpen(true);
        }}
      />

      {/* Saved Vacancies Drawer */}
      <SavedJobsDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        savedVacancies={vacancies.filter((v) => savedJobIds.has(v.id))}
        onRemoveSaved={handleRemoveSavedJob}
        onClearAll={handleClearAllSaved}
        onSelectVacancy={(v) => setSelectedVacancy(v)}
        telegramUrl={siteSettings.telegramChannelUrl}
      />

      {/* Individual Vacancy Modal */}
      {selectedVacancy && (
        <VacancyDetailModal
          vacancy={selectedVacancy}
          onClose={() => {
            setSelectedVacancy(null);
            // Clear URL parameter
            if (typeof window !== 'undefined' && window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }}
          telegramUrl={siteSettings.telegramChannelUrl}
        />
      )}

      {/* Admin Login Modal */}
      <AdminAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(email) => {
          setIsOwnerAuthorized(true);
          setAdminEmail(email);
          setIsAdminView(true);
        }}
      />
    </div>
  );
}
