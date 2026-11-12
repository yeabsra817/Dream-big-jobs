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
  Filter,
  Check,
  Heart,
  Clock,
  Layers,
  LayoutGrid,
  ChevronRight,
  Award,
  Zap,
  UserCheck,
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
  fetchJobSeekerProfile,
  saveJobSeekerProfile,
  fetchUserApplications,
} from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { isExpired, getDaysLeft } from './utils/helpers';
import { runAutonomousVacancyHealing } from './utils/SelfHealingEngine';
import { Navbar } from './components/Navbar';
import { CategoryCard } from './components/CategoryCard';
import { CategoryView } from './components/CategoryView';
import { LocationJobsView } from './components/LocationJobsView';
import { SavedJobsDrawer } from './components/SavedJobsDrawer';
import { VacancyDetailModal } from './components/VacancyDetailModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminAuthModal } from './components/admin/AdminAuthModal';
import { UserAuthModal } from './components/UserAuthModal';
import { JobApplicationModal } from './components/JobApplicationModal';
import { JobSeekerDashboard } from './components/JobSeekerDashboard';
import { AllCategoriesView } from './components/AllCategoriesView';
import { Footer } from './components/Footer';
import { initGoogleAnalytics4, trackAnalyticsEvent } from './lib/analyticsTracker';
import { JobSeekerProfile, UserJobApplication, DEFAULT_JOB_SEEKER_PROFILE } from './types/jobSeeker';

const POPULAR_EMPLOYERS = [
  { name: 'Commercial Bank of Ethiopia', short: 'CBE', category: 'Commercial Banking & Microfinance', vacancies: 'Official' },
  { name: 'Awash Bank', short: 'Awash', category: 'Commercial Banking & Microfinance', vacancies: 'Verified' },
  { name: 'Ethiopian Airlines', short: 'ET Air', category: 'Aviation, Logistics & Freight', vacancies: 'Direct' },
  { name: 'Safaricom Ethiopia', short: 'Safaricom', category: 'IT, Software & Telecommunications', vacancies: 'Official' },
  { name: 'UNICEF Ethiopia', short: 'UNICEF', category: 'NGO, UN & Civil Society', vacancies: 'UN Agency' },
  { name: 'MSF (Doctors Without Borders)', short: 'MSF', category: 'Health, Medical & Pharmaceuticals', vacancies: 'Medical' },
  { name: 'Ethio Telecom', short: 'EthioTel', category: 'IT, Software & Telecommunications', vacancies: 'Telecom' },
  { name: 'Dashen Bank', short: 'Dashen', category: 'Commercial Banking & Microfinance', vacancies: 'Private' },
];

export default function App() {
  // Database State
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
    customDomain: 'hopelandjobs.tech',
    aboutText:
      'HOPELAND JOBS is Ethiopia’s premier, verified job recruitment information portal. We provide genuine, accurate vacancies across banking, embassies, NGOs, hospitality, leading corporate sectors, and international visa opportunities.',
    updatedAt: new Date().toISOString(),
  });
  const [duplicateReports, setDuplicateReports] = useState<DuplicateReportItem[]>([]);

  // Navigation & View State
  const [selectedCategory, setSelectedCategory] = useState<CategoryMeta | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [isAllCategoriesView, setIsAllCategoriesView] = useState(false);

  // Auth States
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [isUserAuthModalOpen, setIsUserAuthModalOpen] = useState(false);
  const [userAuthModalMode, setUserAuthModalMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<JobSeekerProfile | null>(null);
  const [isOwnerAuthorized, setIsOwnerAuthorized] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  // Job Seeker Dashboard & Application Modal States
  const [isJobSeekerDashboardOpen, setIsJobSeekerDashboardOpen] = useState(false);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [applyTargetVacancy, setApplyTargetVacancy] = useState<Vacancy | null>(null);
  const [userApplications, setUserApplications] = useState<UserJobApplication[]>([]);

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

  // Search & Filter in Hero
  const [heroSearch, setHeroSearch] = useState('');
  const [heroLocation, setHeroLocation] = useState('All');
  const [heroSector, setHeroSector] = useState('All');
  const [heroEmploymentType, setHeroEmploymentType] = useState('All');

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

        // Check URL parameter or path for direct job link (from Telegram / WhatsApp / Social shares)
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const jobId = urlParams.get('jobId') || urlParams.get('job_id') || urlParams.get('id');
          const pathMatch = window.location.pathname.match(/\/jobs\/([^\/\?]+)/);
          const targetId = jobId || pathMatch?.[1];

          if (targetId) {
            const found = loadedVacancies.find((v) => v.id === targetId || v.id.toLowerCase() === targetId.toLowerCase());
            if (found) {
              setSelectedVacancy(found);
              document.title = `${found.title} at ${found.organization} | HOPELAND JOBS`;
              trackAnalyticsEvent('vacancy_view', {
                jobId: found.id,
                jobTitle: found.title,
                organization: found.organization,
                category: found.category,
                path: `/?jobId=${found.id}`,
                gaMeasurementId: loadedSettings.gaMeasurementId,
              });
            }
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        if (isUserAdmin(user)) {
          setIsOwnerAuthorized(true);
          setAdminEmail(user.email);
        }
        // Load Job Seeker Profile & Applications
        try {
          const [profile, apps] = await Promise.all([
            fetchJobSeekerProfile(user.uid),
            fetchUserApplications(user.uid),
          ]);
          setUserApplications(apps);
          if (profile) {
            setUserProfile(profile);
          } else {
            // Create default profile on first sign-in
            const newProfile: JobSeekerProfile = {
              ...DEFAULT_JOB_SEEKER_PROFILE,
              uid: user.uid,
              fullName: user.displayName || user.email?.split('@')[0] || 'Job Seeker',
              email: user.email || '',
              photoUrl: user.photoURL || undefined,
              authProvider: user.providerData?.[0]?.providerId?.includes('google') ? 'google' : 'email',
              emailVerified: user.emailVerified,
            };
            await saveJobSeekerProfile(newProfile);
            setUserProfile(newProfile);
          }
        } catch (e) {
          console.warn('Profile sync notice:', e);
        }
      } else {
        setUserProfile(null);
        setUserApplications([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Browser navigation popstate listener for direct job URLs and Back/Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const jobId = urlParams.get('jobId') || urlParams.get('job_id') || urlParams.get('id');
      const pathMatch = window.location.pathname.match(/\/jobs\/([^\/\?]+)/);
      const targetId = jobId || pathMatch?.[1];

      if (targetId) {
        const found = vacancies.find((v) => v.id === targetId);
        if (found) {
          setSelectedVacancy(found);
          document.title = `${found.title} at ${found.organization} | HOPELAND JOBS`;
        }
      } else {
        setSelectedVacancy(null);
        document.title = 'HOPELAND JOBS | Hopeland Jobs - Find Your Opportunity.';
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [vacancies]);

  // When admin logs in, load ALL vacancies, duplicate reports, and fresh site settings
  useEffect(() => {
    if (isOwnerAuthorized) {
      Promise.all([fetchAllVacanciesAdmin(), fetchDuplicateReports(), getSiteSettings()])
        .then(([all, dups, freshSettings]) => {
          if (freshSettings) {
            setSiteSettings(freshSettings);
            if (freshSettings.gaMeasurementId) {
              initGoogleAnalytics4(freshSettings.gaMeasurementId, false);
            }
          }
          if (all.length > 0) {
            // Autonomous healing sweep: immediately archives expired listings and standardizes categories
            const healed = runAutonomousVacancyHealing(all);
            if (healed.changedCount > 0) {
              setVacancies(healed.healedVacancies);
              saveBatchVacancies(healed.healedVacancies);
            } else {
              setVacancies(all);
            }
          }
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
        title: `Vacancies in ${selectedLocation} - HOPELAND JOBS`,
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

  // Total active vacancies count across all sectors
  const totalActiveVacancies = useMemo(() => {
    return vacancies.filter((v) => v.status === 'published' && !isExpired(v.applicationDeadline)).length;
  }, [vacancies]);

  // Active published vacancies list
  const publishedVacancies = useMemo(() => {
    return vacancies.filter((v) => v.status === 'published' && !isExpired(v.applicationDeadline));
  }, [vacancies]);

  // Filtered vacancies for the homepage list
  const filteredHomepageVacancies = useMemo(() => {
    return publishedVacancies.filter((v) => {
      const q = heroSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.title.toLowerCase().includes(q) ||
        v.organization.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.location.toLowerCase().includes(q) ||
        (v.requiredSkills && v.requiredSkills.some((s) => s.toLowerCase().includes(q)));

      const matchesLocation =
        heroLocation === 'All' ||
        v.location.toLowerCase().includes(heroLocation.toLowerCase().split(' ')[0]);

      const matchesSector = heroSector === 'All' || v.category === heroSector;

      const matchesType =
        heroEmploymentType === 'All' ||
        (v.employmentType && v.employmentType.toLowerCase().includes(heroEmploymentType.toLowerCase()));

      return matchesSearch && matchesLocation && matchesSector && matchesType;
    });
  }, [publishedVacancies, heroSearch, heroLocation, heroSector, heroEmploymentType]);

  // Featured vacancies (top 4 priority or latest)
  const featuredVacancies = useMemo(() => {
    return publishedVacancies.slice(0, 4);
  }, [publishedVacancies]);

  // Continuous 24/7 Search Bar Activity Tracking
  useEffect(() => {
    const q = heroSearch.trim();
    if (!q || q.length < 2) return;

    const timer = setTimeout(() => {
      const matches = filteredHomepageVacancies.length;
      trackAnalyticsEvent('search', {
        searchTerm: q,
        resultsCount: matches,
        hasResults: matches > 0,
        category: heroSector,
        path: `/?search=${encodeURIComponent(q)}`,
        gaMeasurementId: siteSettings.gaMeasurementId,
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [heroSearch, filteredHomepageVacancies.length, heroSector, siteSettings.gaMeasurementId]);

  // Permanent URL and Direct Vacancy Selection
  const handleSelectVacancy = (v: Vacancy) => {
    setSelectedVacancy(v);
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.origin}/?jobId=${v.id}`;
      window.history.pushState({ jobId: v.id }, `${v.title} | HOPELAND JOBS`, newUrl);
      document.title = `${v.title} at ${v.organization} | HOPELAND JOBS`;
    }
  };

  const handleCloseVacancy = () => {
    setSelectedVacancy(null);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, 'HOPELAND JOBS', window.location.pathname);
      document.title = 'HOPELAND JOBS | Hopeland Jobs - Find Your Opportunity.';
    }
  };

  // Dedicated Location Selection
  const handleSelectLocation = (loc: string) => {
    setSelectedLocation(loc);
    setSelectedCategory(null);
    setIsAllCategoriesView(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Bookmarking / Saved Jobs
  const handleToggleSaveJob = (id: string) => {
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem('dreambigjobs_saved_jobs', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn('Local storage error:', e);
      }
      return next;
    });
  };

  const handleRemoveSavedJob = (id: string) => {
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      try {
        localStorage.setItem('dreambigjobs_saved_jobs', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn('Local storage error:', e);
      }
      return next;
    });
  };

  const handleClearAllSaved = () => {
    setSavedJobIds(new Set());
    try {
      localStorage.removeItem('dreambigjobs_saved_jobs');
    } catch (e) {
      console.warn('Local storage error:', e);
    }
  };

  // Application Trigger
  const handleStartApply = (vac: Vacancy) => {
    setApplyTargetVacancy(vac);
    setIsApplicationModalOpen(true);
  };

  // Admin Actions
  const handleSaveVacancy = async (updated: Vacancy) => {
    setVacancies((prev) => {
      const exists = prev.some((v) => v.id === updated.id);
      if (exists) return prev.map((v) => (v.id === updated.id ? updated : v));
      return [updated, ...prev];
    });
    await saveVacancy(updated);
  };

  const handleBatchSaveVacancies = async (newVacancies: Vacancy[]) => {
    setVacancies((prev) => {
      const map = new Map(prev.map((v) => [v.id, v]));
      newVacancies.forEach((v) => map.set(v.id, v));
      return Array.from(map.values());
    });
    await saveBatchVacancies(newVacancies);
  };

  const handleDeleteVacancy = async (id: string) => {
    setVacancies((prev) => prev.filter((v) => v.id !== id));
    await deleteVacancy(id);
  };

  const handleBatchDeleteVacancies = async (ids: string[]) => {
    setVacancies((prev) => prev.filter((v) => !ids.includes(v.id)));
    await deleteBatchVacancies(ids);
  };

  const handleUpdateVacancyStatus = async (
    id: string,
    status: Vacancy['status'],
    deadline?: string
  ) => {
    const target = vacancies.find((v) => v.id === id);
    if (!target) return;

    const updated: Vacancy = {
      ...target,
      status,
      applicationDeadline: deadline || target.applicationDeadline,
      updatedAt: new Date().toISOString(),
    };

    setVacancies((prev) => prev.map((v) => (v.id === id ? updated : v)));
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
    const restoredVacancy: Vacancy = {
      id: `restored_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: report.candidateTitle,
      organization: report.candidateOrg,
      category: report.candidateData.category || 'Private Companies',
      location: report.candidateData.location || 'Addis Ababa',
      employmentType: report.candidateData.employmentType || 'Full-time',
      vacanciesCount: report.candidateData.vacanciesCount || 'Not specified',
      salary: report.candidateData.salary || 'Not specified',
      educationQualification: report.candidateData.educationQualification || 'Not specified',
      requiredFieldOfStudy: report.candidateData.requiredFieldOfStudy || 'Not specified',
      experienceYears: report.candidateData.experienceYears || 'Not specified',
      requiredSkills: report.candidateData.requiredSkills || [],
      description: report.candidateData.description || 'Restored duplicate entry.',
      responsibilities: report.candidateData.responsibilities || [],
      requiredDocuments: report.candidateData.requiredDocuments || ['CV', 'Cover Letter'],
      applicationMethod: report.candidateData.applicationMethod || 'Online URL',
      applicationUrl: report.candidateData.applicationUrl || '',
      applicationEmail: report.candidateData.applicationEmail || '',
      applicationInstructions: report.candidateData.applicationInstructions || 'Apply directly.',
      applicationDeadline: report.candidateData.applicationDeadline || '2026-11-30',
      contactInfo: report.candidateData.contactInfo || 'Not specified',
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
      setIsAllCategoriesView(false);
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
        userProfile={userProfile}
        currentUserEmail={currentUser?.email}
        onOpenAdmin={() => {
          if (isOwnerAuthorized) setIsAdminView(true);
          else setIsAdminAuthModalOpen(true);
        }}
        onSelectCategory={handleSelectCategoryByName}
        onHomeClick={() => {
          setSelectedCategory(null);
          setSelectedLocation(null);
          setIsAllCategoriesView(false);
          setIsJobSeekerDashboardOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAllCategories={() => {
          setIsAllCategoriesView(true);
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
        onOpenAuth={(mode) => {
          setUserAuthModalMode(mode);
          setIsUserAuthModalOpen(true);
        }}
        onOpenDashboard={() => setIsJobSeekerDashboardOpen(true)}
        onSignOutUser={async () => {
          await signOut(auth);
          setUserProfile(null);
        }}
        language={language}
        onToggleLanguage={() => setLanguage(language === 'en' ? 'am' : 'en')}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {isAllCategoriesView ? (
          /* DEDICATED FULL CATEGORIES DIRECTORY */
          <AllCategoriesView
            categories={OFFICIAL_CATEGORIES}
            vacancies={vacancies}
            onBack={() => setIsAllCategoriesView(false)}
            onSelectCategory={(cat) => {
              setIsAllCategoriesView(false);
              setSelectedCategory(cat);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : selectedLocation ? (
          /* DEDICATED LOCATION VACANCY PAGE */
          <LocationJobsView
            initialLocation={selectedLocation}
            vacancies={vacancies}
            onBack={() => {
              setSelectedLocation(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectVacancy={handleSelectVacancy}
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
            onSelectVacancy={handleSelectVacancy}
            savedJobIds={savedJobIds}
            onToggleSaveJob={handleToggleSaveJob}
            onSelectLocation={handleSelectLocation}
            telegramUrl={siteSettings.telegramChannelUrl}
          />
        ) : (
          /* HOMEPAGE */
          <>
            {/* HERO SECTION */}
            <section className="relative bg-[#0B132B] text-white overflow-hidden py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

              <div className="relative max-w-6xl mx-auto text-center space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/90 text-amber-400 text-xs font-bold border border-slate-700/80 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>100% Verified Ethiopian Career Opportunities</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                  HOPELAND <span className="text-amber-400">JOBS</span>
                  <span className="block text-lg sm:text-2xl font-medium text-slate-300 mt-2.5">
                    Hopeland Jobs. Find Your Opportunity.
                  </span>
                </h1>

                <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed">
                  Your trusted destination for banking, embassy, NGO, hospitality, corporate, and international career opportunities across Addis Ababa and all Ethiopian regions.
                </p>

                {/* Comprehensive Multi-Field Search Form */}
                <div className="max-w-4xl mx-auto pt-2">
                  <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-2xl border border-slate-200/90 text-slate-900 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {/* Keyword search input */}
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={heroSearch}
                          onChange={(e) => setHeroSearch(e.target.value)}
                          placeholder="Job title, skills, or company..."
                          className="w-full pl-10 pr-3 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-200 outline-none font-medium focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                        />
                      </div>

                      {/* Location Filter */}
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                          value={heroLocation}
                          onChange={(e) => setHeroLocation(e.target.value)}
                          className="w-full pl-10 pr-3 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-200 outline-none font-medium bg-white text-slate-700 focus:ring-2 focus:ring-amber-400"
                        >
                          <option value="All">All Locations (Ethiopia & Remote)</option>
                          {ETHIOPIAN_LOCATIONS.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Sector Filter */}
                      <div className="relative">
                        <Briefcase className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                          value={heroSector}
                          onChange={(e) => setHeroSector(e.target.value)}
                          className="w-full pl-10 pr-3 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-200 outline-none font-medium bg-white text-slate-700 focus:ring-2 focus:ring-amber-400"
                        >
                          <option value="All">All Professional Sectors</option>
                          {OFFICIAL_CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Secondary filters row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        <span className="text-slate-500 font-semibold shrink-0">Type:</span>
                        {['All', 'Full-time', 'Contract', 'Remote', 'Internship'].map((tp) => (
                          <button
                            key={tp}
                            onClick={() => setHeroEmploymentType(tp)}
                            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 ${
                              heroEmploymentType === tp
                                ? 'bg-amber-400 text-slate-950 font-bold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {tp}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        {(heroSearch || heroLocation !== 'All' || heroSector !== 'All' || heroEmploymentType !== 'All') && (
                          <button
                            onClick={() => {
                              setHeroSearch('');
                              setHeroLocation('All');
                              setHeroSector('All');
                              setHeroEmploymentType('All');
                            }}
                            className="text-xs text-slate-500 hover:text-slate-800 underline"
                          >
                            Reset
                          </button>
                        )}
                        <a
                          href="#vacancies-list"
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all shadow-md shrink-0"
                        >
                          <span>View {filteredHomepageVacancies.length} Matching Jobs</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Statistics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto pt-6 text-left">
                  <div className="bg-slate-900/60 backdrop-blur p-3.5 rounded-xl border border-slate-800">
                    <div className="text-2xl font-black text-amber-400">{totalActiveVacancies}</div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                      Active Vacancies
                    </div>
                    <div className="text-[10px] text-slate-500">Live verified database</div>
                  </div>

                  <div className="bg-slate-900/60 backdrop-blur p-3.5 rounded-xl border border-slate-800">
                    <div className="text-2xl font-black text-white">16</div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                      Job Sectors
                    </div>
                    <div className="text-[10px] text-slate-500">Banking to Embassy</div>
                  </div>

                  <div className="bg-slate-900/60 backdrop-blur p-3.5 rounded-xl border border-slate-800">
                    <div className="text-2xl font-black text-white">25+</div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                      Ethiopian Cities
                    </div>
                    <div className="text-[10px] text-slate-500">Addis & All Regions</div>
                  </div>

                  <div className="bg-slate-900/60 backdrop-blur p-3.5 rounded-xl border border-slate-800">
                    <div className="text-2xl font-black text-emerald-400">100%</div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                      Verified Jobs
                    </div>
                    <div className="text-[10px] text-slate-500">Zero fake listings</div>
                  </div>
                </div>
              </div>
            </section>

            {/* TELEGRAM CHANNEL STRIP */}
            <section className="bg-gradient-to-r from-[#229ED9] via-[#1E88E5] to-[#0288D1] text-white py-4 px-4 sm:px-6 shadow-inner">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                    <Send className="w-5 h-5 fill-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold tracking-tight">
                      Instant Vacancy Alerts on Telegram
                    </h3>
                    <p className="text-xs text-white/90 font-medium">
                      Join <strong className="text-white underline">@DreamBigJobsEthiopia</strong> for real-time announcements.
                    </p>
                  </div>
                </div>
                <a
                  href={siteSettings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopia'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-white text-[#1976D2] hover:bg-slate-50 font-black text-xs uppercase tracking-wider shadow-md transition-all shrink-0 flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 fill-[#1976D2]" />
                  <span>Join Our Telegram Channel</span>
                </a>
              </div>
            </section>

            {/* FEATURED VACANCIES SECTION */}
            {featuredVacancies.length > 0 && (
              <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="flex items-end justify-between gap-4 mb-6">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-700 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-current" />
                      <span>Priority Opportunities</span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-[#0B132B]">
                      Featured Vacancies in Ethiopia
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      High-impact listings from leading banks, embassies, and multinational organizations.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {featuredVacancies.map((vac) => {
                    const days = getDaysLeft(vac.applicationDeadline);
                    const isSaved = savedJobIds.has(vac.id);
                    return (
                      <div
                        key={vac.id}
                        className="bg-white rounded-2xl p-5 border border-amber-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                {vac.category}
                              </span>
                              <h3
                                onClick={() => handleSelectVacancy(vac)}
                                className="text-base font-bold text-slate-900 hover:text-amber-600 transition-colors cursor-pointer mt-1.5 line-clamp-1"
                              >
                                {vac.title}
                              </h3>
                              <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-slate-400" />
                                <span>{vac.organization}</span>
                              </p>
                            </div>
                            <button
                              onClick={() => handleToggleSaveJob(vac.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                              title={isSaved ? 'Remove from saved' : 'Save vacancy'}
                            >
                              <Heart className={`w-4 h-4 ${isSaved ? 'text-rose-500 fill-current' : ''}`} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="truncate">{vac.location}</span>
                            </span>
                            <span className="flex items-center gap-1 truncate">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{days.text}</span>
                            </span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-4">
                          <span className="text-xs font-bold text-emerald-700 truncate max-w-[150px]">
                            {vac.salary || 'Salary negotiable'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSelectVacancy(vac)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            >
                              Details
                            </button>
                            <button
                              onClick={() => handleStartApply(vac)}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors shadow-xs"
                            >
                              Apply Now
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* LATEST VACANCIES LIST & SEARCH RESULTS */}
            <section id="vacancies-list" className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Live Job Directory</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-[#0B132B]">
                    {heroSearch || heroLocation !== 'All' || heroSector !== 'All'
                      ? `Matching Vacancies (${filteredHomepageVacancies.length})`
                      : `Latest Published Vacancies (${publishedVacancies.length})`}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click "Apply Now" to attach your CV and apply with verified Ethiopian records.
                  </p>
                </div>
              </div>

              {filteredHomepageVacancies.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
                  <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="font-bold text-slate-800 text-sm">No vacancies match your search</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Try clearing one or more filters, or view all vacancies by selecting "All" in the location and sector dropdowns.
                  </p>
                  <button
                    onClick={() => {
                      setHeroSearch('');
                      setHeroLocation('All');
                      setHeroSector('All');
                      setHeroEmploymentType('All');
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs"
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredHomepageVacancies.slice(0, 12).map((vac) => {
                    const days = getDaysLeft(vac.applicationDeadline);
                    const isSaved = savedJobIds.has(vac.id);
                    return (
                      <div
                        key={vac.id}
                        className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                              {vac.category}
                            </span>
                            <button
                              onClick={() => handleToggleSaveJob(vac.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                              title="Bookmark"
                            >
                              <Heart className={`w-3.5 h-3.5 ${isSaved ? 'text-rose-500 fill-current' : ''}`} />
                            </button>
                          </div>

                          <h3
                            onClick={() => handleSelectVacancy(vac)}
                            className="font-bold text-sm text-slate-900 hover:text-amber-600 transition-colors cursor-pointer line-clamp-1"
                          >
                            {vac.title}
                          </h3>

                          <p className="text-xs text-slate-600 font-semibold truncate flex items-center gap-1">
                            <Building className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{vac.organization}</span>
                          </p>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 pt-1">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-amber-500" />
                              {vac.location}
                            </span>
                            <span>•</span>
                            <span className="text-slate-600 font-medium">{vac.employmentType || 'Full-time'}</span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-4 text-xs">
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {days.text}
                          </span>
                          <button
                            onClick={() => handleStartApply(vac)}
                            className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white transition-colors"
                          >
                            Apply Now
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* POPULAR EMPLOYERS SHOWCASE */}
            <section className="bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 border-y border-slate-200">
              <div className="max-w-7xl mx-auto space-y-6">
                <div className="text-center max-w-2xl mx-auto space-y-1.5">
                  <div className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-amber-700">
                    <Building className="w-3.5 h-3.5" />
                    <span>Trusted Organizations</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-[#0B132B]">
                    Popular Employers in Ethiopia
                  </h2>
                  <p className="text-xs text-slate-500">
                    Explore verified announcements from top domestic banks, telecom leaders, and international development agencies.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {POPULAR_EMPLOYERS.map((emp) => (
                    <div
                      key={emp.short}
                      onClick={() => {
                        setHeroSearch(emp.name);
                        const el = document.getElementById('vacancies-list');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="bg-white p-4 rounded-xl border border-slate-200/90 hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer group text-center"
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 font-black text-sm flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                        {emp.short.slice(0, 3)}
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-amber-600 transition-colors line-clamp-1">
                        {emp.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{emp.category}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* EXPLORE JOB CATEGORIES SECTION (WITH VIEW ALL BUTTON) */}
            <section id="categories-section" className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-700 mb-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Categorized Sectors</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B132B]">
                    Explore Job Categories
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Browse active vacancies across Ethiopia's principal economic sectors.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setIsAllCategoriesView(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors shadow-sm shrink-0"
                >
                  <LayoutGrid className="w-4 h-4 text-amber-400" />
                  <span>View All 16 Categories</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Top 8 Sector Preview Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {OFFICIAL_CATEGORIES.slice(0, 8).map((category) => {
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

              <div className="text-center pt-2">
                <button
                  onClick={() => {
                    setIsAllCategoriesView(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-2 text-xs font-bold text-amber-700 hover:text-amber-800 underline"
                >
                  Looking for more sectors? Open the complete Ethiopian Job Categories Directory →
                </button>
              </div>
            </section>

            {/* HOW IT WORKS SECTION */}
            <section className="bg-[#0B132B] text-white py-16 px-4 sm:px-6 lg:px-8 border-y border-slate-800">
              <div className="max-w-7xl mx-auto space-y-10">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                    <Sparkles className="w-3.5 h-3.5 fill-current" />
                    <span>Simple & Transparent</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    How Hopeland Jobs Works for Ethiopian Job Seekers
                  </h2>
                  <p className="text-xs text-slate-300">
                    Designed from the ground up for simplicity, security, and real career results.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center">
                      1
                    </div>
                    <h3 className="font-extrabold text-base text-white">Discover Verified Vacancies</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Every position on Hopeland Jobs is reviewed for verified employers, official deadlines, and authentic job requirements.
                    </p>
                  </div>

                  <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center">
                      2
                    </div>
                    <h3 className="font-extrabold text-base text-white">Build Your Vault (10 GB Cloud)</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Securely store your CVs, degree certificates, Kebele IDs, and experience letters in persistent cloud storage, ready for any application.
                    </p>
                  </div>

                  <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center">
                      3
                    </div>
                    <h3 className="font-extrabold text-base text-white">Apply & Track Status</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Submit applications in 1-click without duplicate submissions. Monitor milestone updates in real-time from your personal dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* JOB SEEKER REGISTRATION CTA BANNER */}
            <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <div className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 rounded-3xl p-8 sm:p-12 shadow-lg text-slate-950 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2 max-w-xl text-center md:text-left">
                  <span className="text-xs font-black uppercase tracking-wider bg-slate-950 text-amber-400 px-3 py-1 rounded-full">
                    Free Account for Job Seekers
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                    Ready to Accelerate Your Career in Ethiopia?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-950/90 font-medium">
                    Create your candidate account to unlock the 10GB Document Vault, track application progression, and receive tailored vacancy alerts.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setUserAuthModalMode('signup');
                      setIsUserAuthModalOpen(true);
                    }}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-xs transition-all shadow-md"
                  >
                    Create Free Account
                  </button>
                  <button
                    onClick={() => {
                      setUserAuthModalMode('signin');
                      setIsUserAuthModalOpen(true);
                    }}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs transition-all border border-slate-950/20"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </section>

            {/* POPULAR ETHIOPIAN LOCATIONS SECTION */}
            <section id="locations-section" className="bg-slate-100/70 py-14 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
              <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Nationwide Coverage</span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-[#0B132B]">
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
                        className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-amber-500 hover:shadow-sm transition-all cursor-pointer group"
                        title={`Click to view all jobs in ${city}`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 group-hover:text-amber-600 transition-colors line-clamp-1 flex items-center gap-1">
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
            <section id="cv-assistance-section" className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <div className="bg-[#FFFBEB] rounded-3xl p-8 sm:p-12 border-2 border-amber-300 relative overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
                      <Sparkles className="w-3.5 h-3.5 fill-current" />
                      <span>Career Guidance Service</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-amber-950">
                      CV & Application Assistance for Ethiopian Job Seekers
                    </h2>
                    <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed">
                      Applying for banking positions at CBE or Awash? Diplomatic missions at AU or embassies? UN agencies like UNICEF? Each sector requires tailored application standards.
                    </p>

                    <div className="space-y-2 text-xs text-amber-900 font-medium">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Tailored cover letter generator available on every vacancy.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Checklists of required Ethiopian documents (Kebele ID, Degree, Experience).</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Direct official employer portals — no third-party application fees.</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Standard Ethiopian Application Checklist
                    </h3>
                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <span>1. Professional CV (Chronological format)</span>
                        <span className="text-emerald-600 font-bold">Standard</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <span>2. Tailored Application Letter referencing Ref #</span>
                        <span className="text-emerald-600 font-bold">Essential</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <span>3. University Degree & Official Student Copy</span>
                        <span className="text-emerald-600 font-bold">Required</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <span>4. Renewed National ID (Fayda / Kebele ID)</span>
                        <span className="text-emerald-600 font-bold">Government</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ABOUT US SECTION */}
            <section id="about-section" className="bg-white py-14 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
              <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Our Quality Promise</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-[#0B132B]">About HOPELAND JOBS</h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {siteSettings.aboutText ||
                      'HOPELAND JOBS is Ethiopia’s premier, verified job recruitment information portal. We provide genuine, accurate vacancies across banking, embassies, NGOs, hospitality, leading corporate sectors, and international visa opportunities.'}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Every vacancy is verified with confirmed application deadlines and official employer channels.
                  </p>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="text-sm font-bold text-[#0B132B]">
                    Why Ethiopian Candidates Choose HOPELAND JOBS:
                  </h3>
                  <div className="space-y-2 text-xs text-slate-700">
                    <div className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Verified Announcements Only:</strong> Every job has a confirmed deadline and employer.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>10 GB Cloud Vault:</strong> Store and manage credentials persistently.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Zero Application Fees:</strong> Direct connections to employer portals.</span>
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
          else setIsAdminAuthModalOpen(true);
        }}
      />

      {/* User Auth Modal (Sign In / Register / Google / Forgot Password) */}
      <UserAuthModal
        isOpen={isUserAuthModalOpen}
        initialMode={userAuthModalMode}
        onClose={() => setIsUserAuthModalOpen(false)}
        onSuccess={async (user) => {
          setIsUserAuthModalOpen(false);
          if (user?.uid) {
            try {
              const [p, apps] = await Promise.all([
                fetchJobSeekerProfile(user.uid),
                fetchUserApplications(user.uid),
              ]);
              if (p) setUserProfile(p);
              setUserApplications(apps);
            } catch {}
          }
          if (applyTargetVacancy) {
            setIsApplicationModalOpen(true);
          }
        }}
      />

      {/* Job Seeker Profile & Dashboard Modal */}
      {isJobSeekerDashboardOpen && userProfile && (
        <JobSeekerDashboard
          profile={userProfile}
          applications={userApplications}
          savedVacancies={vacancies.filter((v) => savedJobIds.has(v.id))}
          onClose={() => setIsJobSeekerDashboardOpen(false)}
          onUpdateProfile={async (updated) => {
            await saveJobSeekerProfile(updated);
            setUserProfile(updated);
          }}
          onSelectVacancy={handleSelectVacancy}
        />
      )}

      {/* Job Application Modal (Direct Apply with CV & Cover Note) */}
      {isApplicationModalOpen && applyTargetVacancy && (
        <JobApplicationModal
          isOpen={isApplicationModalOpen}
          vacancy={applyTargetVacancy}
          userProfile={userProfile}
          currentUser={currentUser}
          onClose={() => {
            setIsApplicationModalOpen(false);
            setApplyTargetVacancy(null);
          }}
          onNeedAuth={() => {
            setUserAuthModalMode('signin');
            setIsUserAuthModalOpen(true);
          }}
          onApplicationSubmitted={(newApp) => {
            setUserApplications((prev) => [newApp, ...prev]);
          }}
        />
      )}

      {/* Saved Vacancies Drawer */}
      <SavedJobsDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        savedVacancies={vacancies.filter((v) => savedJobIds.has(v.id))}
        onRemoveSaved={handleRemoveSavedJob}
        onClearAll={handleClearAllSaved}
        onSelectVacancy={handleSelectVacancy}
        telegramUrl={siteSettings.telegramChannelUrl}
      />

      {/* Individual Vacancy Modal */}
      {selectedVacancy && (
        <VacancyDetailModal
          vacancy={selectedVacancy}
          onClose={handleCloseVacancy}
          telegramUrl={siteSettings.telegramChannelUrl}
          onApply={(v) => handleStartApply(v)}
        />
      )}

      {/* Admin Login Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onLoginSuccess={(email) => {
          setIsOwnerAuthorized(true);
          setAdminEmail(email);
          setIsAdminView(true);
        }}
      />
    </div>
  );
}
