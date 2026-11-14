import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
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
  Loader2,
  BarChart3,
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
  getCachedPublishedVacancies,
  getCachedSiteSettings,
  getCachedJobSeekerProfile,
  getCachedUserApplications,
  getRedirectResult,
  getAdditionalUserInfo,
} from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { isExpired, getDaysLeft } from './utils/helpers';
import { runAutonomousVacancyHealing } from './utils/SelfHealingEngine';
import { Navbar } from './components/Navbar';
import { CategoryCard } from './components/CategoryCard';
import { Footer } from './components/Footer';
import { initGoogleAnalytics4, trackAnalyticsEvent, setAnalyticsUserId } from './lib/analyticsTracker';
import { JobSeekerProfile, UserJobApplication, DEFAULT_JOB_SEEKER_PROFILE } from './types/jobSeeker';
import {
  fetchCustomerVisitCount,
  generateVisitCountAiInsights,
  runAiSmartSearch,
  askAiCareerCoach,
  SmartSearchAiResponse,
  CareerCoachAiResponse,
} from './lib/aiService';
import { CustomerVisitCountSummary, CustomerVisitAiInsight } from './types/analytics';

// Lazy-loaded secondary pages & modals (reduces initial JS bundle & speeds up navigation)
const CategoryView = lazy(() => import('./components/CategoryView').then((m) => ({ default: m.CategoryView })));
const LocationJobsView = lazy(() => import('./components/LocationJobsView').then((m) => ({ default: m.LocationJobsView })));
const AllCategoriesView = lazy(() => import('./components/AllCategoriesView').then((m) => ({ default: m.AllCategoriesView })));
const SavedJobsDrawer = lazy(() => import('./components/SavedJobsDrawer').then((m) => ({ default: m.SavedJobsDrawer })));
const VacancyDetailModal = lazy(() => import('./components/VacancyDetailModal').then((m) => ({ default: m.VacancyDetailModal })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminAuthModal = lazy(() => import('./components/admin/AdminAuthModal').then((m) => ({ default: m.AdminAuthModal })));
const UserAuthModal = lazy(() => import('./components/UserAuthModal').then((m) => ({ default: m.UserAuthModal })));
const JobApplicationModal = lazy(() => import('./components/JobApplicationModal').then((m) => ({ default: m.JobApplicationModal })));
const JobSeekerDashboard = lazy(() => import('./components/JobSeekerDashboard').then((m) => ({ default: m.JobSeekerDashboard })));

const PageLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center py-16">
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-xs text-xs font-bold text-slate-700">
      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
      <span>Loading...</span>
    </div>
  </div>
);

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
  // Database State — hydrated synchronously from localStorage cache for 0ms initial render
  const [vacancies, setVacancies] = useState<Vacancy[]>(() => getCachedPublishedVacancies());
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    const cached = getCachedSiteSettings();
    return (
      cached || {
        telegramChannelName: '@DreamBigJobsEthiopia',
        telegramChannelUrl: 'https://t.me/DreamBigJobsEthiopia',
        telegramGroupUrl: 'https://t.me/DreamBigJobsEthiopia',
        telegramBotUsername: '@DreamBigJobsEthiopiaBot',
        telegramAutoPublish: true,
        contactEmail: 'nexusitsoultion@gmail.com',
        contactPhone: '+251 91 123 4567',
        contactAddress: 'Bole Subcity, Addis Ababa, Ethiopia',
        customDomain: 'hopelandjobs.tech',
        gaMeasurementId: 'G-KH6X73105S',
        gaTrackingEnabled: true,
        aboutText:
          'HOPELAND JOBS is Ethiopia’s premier, verified job recruitment information portal. We provide genuine, accurate vacancies across banking, embassies, NGOs, hospitality, leading corporate sectors, and international visa opportunities.',
        updatedAt: new Date().toISOString(),
      }
    );
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

  // Customer Visit Count & AI Features State
  const [visitStats, setVisitStats] = useState<CustomerVisitCountSummary | null>(null);
  const [heroVisitInsight, setHeroVisitInsight] = useState<CustomerVisitAiInsight | null>(null);
  const [isHeroVisitInsightLoading, setIsHeroVisitInsightLoading] = useState(false);
  const [heroVisitInsightError, setHeroVisitInsightError] = useState<string | null>(null);
  const [showHeroVisitPanel, setShowHeroVisitPanel] = useState(false);

  const [aiSearchResult, setAiSearchResult] = useState<SmartSearchAiResponse | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);

  const [careerQuestion, setCareerQuestion] = useState('');
  const [careerCoachAdvice, setCareerCoachAdvice] = useState<CareerCoachAiResponse | null>(null);
  const [isCareerCoachLoading, setIsCareerCoachLoading] = useState(false);
  const [careerCoachError, setCareerCoachError] = useState<string | null>(null);

  // Load Initial Data (Public data: site settings & published vacancies)
  useEffect(() => {
    // Track real visitor landing immediately so quick visits or slow mobile loads are never missed
    initGoogleAnalytics4(undefined, false);
    trackAnalyticsEvent('page_view', {
      path: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
      title: typeof document !== 'undefined' ? document.title : 'HOPELAND JOBS',
    });

    async function loadData() {
      try {
        const [loadedSettings, loadedVacancies] = await Promise.all([
          getSiteSettings(),
          fetchPublishedVacancies(),
        ]);
        setSiteSettings(loadedSettings);
        setVacancies(loadedVacancies);

        // Ensure configured GA4 measurement ID from siteSettings is initialized
        if (loadedSettings.gaMeasurementId) {
          initGoogleAnalytics4(loadedSettings.gaMeasurementId, false);
        }

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

    // Background idle prefetch for frequently visited public chunks
    const prefetchTimer = setTimeout(() => {
      import('./components/AllCategoriesView');
      import('./components/CategoryView');
      import('./components/LocationJobsView');
      import('./components/VacancyDetailModal');
      import('./components/UserAuthModal');
    }, 1200);

    // Handle return from Google signInWithRedirect (mobile browsers where popups are blocked)
    getRedirectResult(auth)
      .then((result) => {
        if (!result?.user) return;
        const additionalInfo = getAdditionalUserInfo(result);
        const isNewUser = Boolean(additionalInfo?.isNewUser);
        trackAnalyticsEvent(isNewUser ? 'job_seeker_register' : 'job_seeker_login', {
          method: 'google',
          title: isNewUser ? 'Google Sign-Up' : 'Google Sign-In',
        });
      })
      .catch((err) => {
        console.warn('Google redirect sign-in notice:', err);
      });

    // Firebase Auth Listener & Google Account GA4 User Identification
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setAnalyticsUserId(user.uid || null);

        // Instant synchronous hydration from local cache before cloud sync completes
        const cachedProfile = getCachedJobSeekerProfile(user.uid);
        if (cachedProfile) setUserProfile(cachedProfile);
        const cachedApps = getCachedUserApplications(user.uid);
        if (cachedApps.length > 0) setUserApplications(cachedApps);

        fetchCustomerVisitCount(true).then((stats) => {
          if (stats) setVisitStats(stats);
        });
        if (isUserAdmin(user)) {
          setIsOwnerAuthorized(true);
          setAdminEmail(user.email);
        } else {
          setIsOwnerAuthorized(false);
          setAdminEmail(null);
        }

        // Load Job Seeker Profile & Applications
        try {
          const [existingProfile, apps] = await Promise.all([
            fetchJobSeekerProfile(user.uid),
            fetchUserApplications(user.uid),
          ]);
          setUserApplications(apps);

          const isGoogleUser = user.providerData?.some((p) => p.providerId === 'google.com');
          const now = new Date().toISOString();

          if (existingProfile) {
            let syncedProfile = existingProfile;
            if (isGoogleUser) {
              const nextFullName =
                !existingProfile.fullName || existingProfile.fullName === 'Job Seeker'
                  ? user.displayName || existingProfile.fullName
                  : existingProfile.fullName;
              const nextPhotoUrl = user.photoURL || existingProfile.photoUrl;
              const nextEmail = user.email || existingProfile.email;
              if (
                nextFullName !== existingProfile.fullName ||
                nextPhotoUrl !== existingProfile.photoUrl ||
                nextEmail !== existingProfile.email ||
                !existingProfile.emailVerified
              ) {
                syncedProfile = {
                  ...existingProfile,
                  fullName: nextFullName,
                  photoUrl: nextPhotoUrl,
                  email: nextEmail,
                  authProvider: existingProfile.authProvider || 'google',
                  emailVerified: user.emailVerified || existingProfile.emailVerified,
                  updatedAt: now,
                };
                await saveJobSeekerProfile(syncedProfile);
              }
            }
              setUserProfile(syncedProfile);
            if (Array.isArray(syncedProfile.savedJobIds) && syncedProfile.savedJobIds.length > 0) {
              setSavedJobIds((prev) => {
                const merged = new Set([...Array.from(prev), ...syncedProfile.savedJobIds!]);
                try {
                  localStorage.setItem('dreambigjobs_saved_jobs', JSON.stringify(Array.from(merged)));
                } catch {}
                return merged;
              });
            }
          } else {
            // Create default profile on first sign-in
            const newProfile: JobSeekerProfile = {
              ...DEFAULT_JOB_SEEKER_PROFILE,
              uid: user.uid,
              fullName: user.displayName || user.email?.split('@')[0] || 'Job Seeker',
              email: user.email || '',
              photoUrl: user.photoURL || undefined,
              phone: user.phoneNumber || '',
              authProvider: isGoogleUser ? 'google' : 'email',
              emailVerified: user.emailVerified,
              savedJobIds: Array.from(savedJobIds).slice(0, 200),
              createdAt: now,
              updatedAt: now,
            };
            await saveJobSeekerProfile(newProfile);
            setUserProfile(newProfile);
          }
        } catch (e) {
          console.warn('Profile sync notice:', e);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setUserApplications([]);
        setIsOwnerAuthorized(false);
        setAdminEmail(null);
        setAnalyticsUserId(null);
      }
    });

    // Load & refresh live customer visit count
    fetchCustomerVisitCount(true).then((stats) => {
      if (stats) setVisitStats(stats);
    });
    const visitInterval = setInterval(() => {
      fetchCustomerVisitCount(true).then((stats) => {
        if (stats) setVisitStats(stats);
      });
    }, 60000);

    return () => {
      unsubscribe();
      clearInterval(visitInterval);
      clearTimeout(prefetchTimer);
    };
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

  // Combined displayed search results (AI-ranked when AI Smart Search is active, otherwise standard filter)
  const displayedHomepageVacancies = useMemo(() => {
    if (aiSearchResult && aiSearchResult.matchedVacancyIds && aiSearchResult.matchedVacancyIds.length > 0) {
      const idRank = new Map<string, number>();
      aiSearchResult.matchedVacancyIds.forEach((id, idx) => idRank.set(id, idx));
      const matched = publishedVacancies
        .filter((v) => idRank.has(v.id))
        .sort((a, b) => (idRank.get(a.id) ?? 999) - (idRank.get(b.id) ?? 999));
      if (matched.length > 0) return matched;
    }
    return filteredHomepageVacancies;
  }, [aiSearchResult, publishedVacancies, filteredHomepageVacancies]);

  const handleAiSmartSearch = async () => {
    const q = heroSearch.trim();
    if (!q) return;
    setIsAiSearching(true);
    setAiSearchError(null);
    try {
      const result = await runAiSmartSearch({
        query: q,
        vacancies: publishedVacancies,
        userProfile,
      });
      setAiSearchResult(result);
      setTimeout(() => {
        const el = document.getElementById('search-results');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (err: any) {
      setAiSearchError(err?.message || 'AI Smart Search could not complete. Showing standard matches.');
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleToggleHeroVisitInsight = async () => {
    const nextOpen = !showHeroVisitPanel;
    setShowHeroVisitPanel(nextOpen);
    if (nextOpen && !heroVisitInsight && !isHeroVisitInsightLoading) {
      setIsHeroVisitInsightLoading(true);
      setHeroVisitInsightError(null);
      try {
        const insight = await generateVisitCountAiInsights(true);
        setHeroVisitInsight(insight);
      } catch (err: any) {
        setHeroVisitInsightError(err?.message || 'Unable to load AI customer visit insight.');
      } finally {
        setIsHeroVisitInsightLoading(false);
      }
    }
  };

  const handleAskCareerCoach = async (promptOverride?: string) => {
    const q = (promptOverride ?? careerQuestion).trim();
    if (!q) return;
    if (promptOverride) setCareerQuestion(promptOverride);
    setIsCareerCoachLoading(true);
    setCareerCoachError(null);
    try {
      const res = await askAiCareerCoach({
        userProfile,
        question: q,
        mode: 'advisor',
      });
      setCareerCoachAdvice(res);
    } catch (err: any) {
      setCareerCoachError(err?.message || 'AI Career Advisor is temporarily unavailable.');
    } finally {
      setIsCareerCoachLoading(false);
    }
  };

  // Personalized recommendations based on candidate's experience and position
  const recommendedVacancies = useMemo(() => {
    if (!userProfile) return [];

    const desiredTitle = (userProfile.desiredJobTitle || '').toLowerCase().trim();
    const pastTitles = (userProfile.experience || []).map((e) => (e.jobTitle || '').toLowerCase().trim()).filter(Boolean);
    const allUserTitles = [desiredTitle, ...pastTitles].filter(Boolean);
    const userExpYears = parseInt(userProfile.yearsOfExperience || '0', 10) || 0;
    const userExpStr = (userProfile.yearsOfExperience || '').toLowerCase();
    const userSkills = (userProfile.skills || []).map((s) => s.toLowerCase().trim()).filter(Boolean);
    const preferredInd = (userProfile.preferredIndustry || '').toLowerCase();

    return publishedVacancies
      .map((vac) => {
        let score = 0;
        const reasons: string[] = [];

        const vacTitle = (vac.title || '').toLowerCase();
        const vacCat = (vac.category || '').toLowerCase();
        const vacDesc = (vac.description || '').toLowerCase();
        const vacReqs = (vac.requiredSkills || []).join(' ').toLowerCase();
        const vacExp = (vac.experienceYears || '').toLowerCase();

        // 1. Position / Title Match (High Priority)
        const titleMatch = allUserTitles.some((t) => t && (vacTitle.includes(t) || t.includes(vacTitle)));
        if (titleMatch) {
          score += 45;
          reasons.push('Position Match');
        } else if (allUserTitles.some((t) => t.split(/\s+/).some((word) => word.length > 3 && vacTitle.includes(word)))) {
          score += 25;
          reasons.push('Role Match');
        }

        // 2. Industry / Category Match
        if (preferredInd && (vacCat.includes(preferredInd) || preferredInd.includes(vacCat))) {
          score += 25;
          reasons.push('Preferred Sector');
        }

        // 3. Experience Match
        if (userExpStr.includes('fresh') || userExpStr.includes('entry') || userExpYears <= 1) {
          if (vacExp.includes('fresh') || vacExp.includes('0') || vacExp.includes('entry') || vacCat.includes('internship')) {
            score += 20;
            reasons.push('Entry-Level Match');
          }
        } else {
          const vacExpYears = parseInt(vacExp, 10) || 0;
          if (vacExpYears > 0 && Math.abs(userExpYears - vacExpYears) <= 2) {
            score += 20;
            reasons.push(`Experience (~${userExpYears} yrs)`);
          } else if (userExpYears >= 3 && (vacExp.includes('senior') || vacExp.includes('lead') || vacExpYears >= 3)) {
            score += 15;
            reasons.push('Seniority Level');
          }
        }

        // 4. Skills Match
        const matchedSkills = userSkills.filter((s) => s.length > 2 && (vacDesc.includes(s) || vacReqs.includes(s) || vacTitle.includes(s)));
        if (matchedSkills.length > 0) {
          score += Math.min(20, matchedSkills.length * 6);
          reasons.push(`${matchedSkills.length} Matched Skills`);
        }

        // Fallback default score if partially aligned with sector
        if (score === 0 && (vacCat.includes('bank') || vacCat.includes('it') || vacCat.includes('company'))) {
          score = 15;
        }

        const matchPercentage = Math.min(99, Math.max(65, score));
        return {
          vacancy: vac,
          score,
          matchPercentage,
          reasons: reasons.slice(0, 2),
        };
      })
      .filter((item) => item.score >= 15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [publishedVacancies, userProfile]);

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
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const savedVacanciesList = useMemo(
    () => vacancies.filter((v) => savedJobIds.has(v.id)),
    [vacancies, savedJobIds]
  );

  const syncSavedJobsToCloud = (nextIds: string[]) => {
    if (!userProfile?.uid) return;
    const bounded = nextIds.slice(0, 200);
    const updatedProfile: JobSeekerProfile = {
      ...userProfile,
      savedJobIds: bounded,
      updatedAt: new Date().toISOString(),
    };
    setUserProfile(updatedProfile);
    saveJobSeekerProfile(updatedProfile).catch(() => {});
  };

  // Bookmarking / Saved Jobs
  const handleToggleSaveJob = (id: string) => {
    const next = new Set(savedJobIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const nextArr = Array.from(next);
    setSavedJobIds(next);
    try {
      localStorage.setItem('dreambigjobs_saved_jobs', JSON.stringify(nextArr));
    } catch (e) {
      console.warn('Local storage error:', e);
    }
    syncSavedJobsToCloud(nextArr);
  };

  const handleRemoveSavedJob = (id: string) => {
    const next = new Set(savedJobIds);
    next.delete(id);
    const nextArr = Array.from(next);
    setSavedJobIds(next);
    try {
      localStorage.setItem('dreambigjobs_saved_jobs', JSON.stringify(nextArr));
    } catch (e) {
      console.warn('Local storage error:', e);
    }
    syncSavedJobsToCloud(nextArr);
  };

  const handleClearAllSaved = () => {
    setSavedJobIds(new Set());
    try {
      localStorage.removeItem('dreambigjobs_saved_jobs');
    } catch (e) {
      console.warn('Local storage error:', e);
    }
    syncSavedJobsToCloud([]);
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
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  // If in Admin Dashboard view
  if (isAdminView && isOwnerAuthorized) {
    return (
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
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
          window.scrollTo({ top: 0, behavior: 'auto' });
        }}
        onOpenAllCategories={() => {
          setIsAllCategoriesView(true);
          setSelectedCategory(null);
          setSelectedLocation(null);
          window.scrollTo({ top: 0, behavior: 'auto' });
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
          try {
            await signOut(auth);
          } catch {}
          try {
            localStorage.removeItem('hopelandjobs_current_user');
          } catch {}
          setCurrentUser(null);
          setUserProfile(null);
          setUserApplications([]);
          setIsJobSeekerDashboardOpen(false);
          setAnalyticsUserId(null);
        }}
        language={language}
        onToggleLanguage={() => setLanguage(language === 'en' ? 'am' : 'en')}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {isAllCategoriesView ? (
          /* DEDICATED FULL CATEGORIES DIRECTORY */
          <Suspense fallback={<PageLoader />}>
            <AllCategoriesView
              categories={OFFICIAL_CATEGORIES}
              vacancies={vacancies}
              onBack={() => setIsAllCategoriesView(false)}
              onSelectCategory={(cat) => {
                setIsAllCategoriesView(false);
                setSelectedCategory(cat);
                window.scrollTo({ top: 0, behavior: 'auto' });
              }}
            />
          </Suspense>
        ) : selectedLocation ? (
          /* DEDICATED LOCATION VACANCY PAGE */
          <Suspense fallback={<PageLoader />}>
            <LocationJobsView
              initialLocation={selectedLocation}
              vacancies={vacancies}
              onBack={() => {
                setSelectedLocation(null);
                window.scrollTo({ top: 0, behavior: 'auto' });
              }}
              onSelectVacancy={handleSelectVacancy}
              savedJobIds={savedJobIds}
              onToggleSaveJob={handleToggleSaveJob}
              telegramUrl={siteSettings.telegramChannelUrl}
            />
          </Suspense>
        ) : selectedCategory ? (
          /* DEDICATED CATEGORY VACANCY PAGE */
          <Suspense fallback={<PageLoader />}>
            <CategoryView
              category={selectedCategory}
              vacancies={vacancies}
              onBack={() => {
                setSelectedCategory(null);
                window.scrollTo({ top: 0, behavior: 'auto' });
              }}
              onSelectVacancy={handleSelectVacancy}
              savedJobIds={savedJobIds}
              onToggleSaveJob={handleToggleSaveJob}
              onSelectLocation={handleSelectLocation}
              telegramUrl={siteSettings.telegramChannelUrl}
            />
          </Suspense>
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
                          onChange={(e) => {
                            setHeroSearch(e.target.value);
                            if (aiSearchResult) setAiSearchResult(null);
                            if (aiSearchError) setAiSearchError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && heroSearch.trim()) {
                              e.preventDefault();
                              handleAiSmartSearch();
                            }
                          }}
                          placeholder="Job title, skills, or ask AI (e.g. banking Addis)..."
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

                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        {(heroSearch || heroLocation !== 'All' || heroSector !== 'All' || heroEmploymentType !== 'All' || aiSearchResult) && (
                          <button
                            onClick={() => {
                              setHeroSearch('');
                              setHeroLocation('All');
                              setHeroSector('All');
                              setHeroEmploymentType('All');
                              setAiSearchResult(null);
                              setAiSearchError(null);
                            }}
                            className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                        {heroSearch.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={handleAiSmartSearch}
                            disabled={isAiSearching}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B132B] hover:bg-slate-800 disabled:opacity-60 text-amber-400 font-extrabold text-xs transition-all shadow-md shrink-0 cursor-pointer"
                          >
                            {isAiSearching ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 fill-current" />
                            )}
                            <span>{isAiSearching ? 'AI Matching...' : 'AI Smart Search'}</span>
                          </button>
                        )}
                        {heroSearch || heroLocation !== 'All' || heroSector !== 'All' || aiSearchResult ? (
                          <a
                            href="#search-results"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all shadow-md shrink-0 cursor-pointer"
                          >
                            <span>View {displayedHomepageVacancies.length} Matching Jobs</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setIsAllCategoriesView(true);
                              window.scrollTo({ top: 0, behavior: 'auto' });
                            }}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all shadow-md shrink-0 cursor-pointer"
                          >
                            <LayoutGrid className="w-3.5 h-3.5 text-slate-950" />
                            <span>Browse Job Categories</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-950" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Statistics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-5xl mx-auto pt-6 text-left">
                  <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-2xl font-black text-amber-400">{totalActiveVacancies}</div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                      Active Vacancies
                    </div>
                    <div className="text-[10px] text-slate-500">Live verified database</div>
                  </div>

                  <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-2xl font-black text-white">16</div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                      Job Sectors
                    </div>
                    <div className="text-[10px] text-slate-500">Banking to Embassy</div>
                  </div>

                  <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-2xl font-black text-white">25+</div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                      Ethiopian Cities
                    </div>
                    <div className="text-[10px] text-slate-500">Addis & All Regions</div>
                  </div>

                  <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-2xl font-black text-emerald-400">100%</div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                      Verified Jobs
                    </div>
                    <div className="text-[10px] text-slate-500">Zero fake listings</div>
                  </div>

                  <div className="col-span-2 sm:col-span-1 bg-slate-900/95 p-3.5 rounded-xl border border-amber-500/30 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-2xl font-black text-sky-400">
                          {visitStats ? visitStats.totalUniqueVisits : 0}
                        </div>
                        <button
                          type="button"
                          onClick={handleToggleHeroVisitInsight}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-[10px] font-bold transition-colors cursor-pointer"
                          title="AI Customer Visit Count Insight"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>AI</span>
                        </button>
                      </div>
                      <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                        Customer Visits
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {visitStats?.visitorsToday ?? 0} today • {visitStats?.activeNow ?? 0} live
                    </div>
                  </div>
                </div>

                {/* Expandable AI Customer Visit Count Insight Panel */}
                {showHeroVisitPanel && (
                  <div className="max-w-5xl mx-auto mt-3 bg-slate-900/95 border border-amber-400/40 rounded-2xl p-4 sm:p-5 text-left space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-amber-400 uppercase tracking-wider">
                        <BarChart3 className="w-4 h-4" />
                        <span>AI Customer Visit Count Intelligence</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setIsHeroVisitInsightLoading(true);
                            setHeroVisitInsightError(null);
                            try {
                              const [freshStats, freshInsight] = await Promise.all([
                                fetchCustomerVisitCount(true),
                                generateVisitCountAiInsights(true),
                              ]);
                              if (freshStats) setVisitStats(freshStats);
                              setHeroVisitInsight(freshInsight);
                            } catch (err: any) {
                              setHeroVisitInsightError(err?.message || 'Unable to refresh AI visit insights.');
                            } finally {
                              setIsHeroVisitInsightLoading(false);
                            }
                          }}
                          disabled={isHeroVisitInsightLoading}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                        >
                          {isHeroVisitInsightLoading ? 'Analyzing...' : 'Refresh AI'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowHeroVisitPanel(false)}
                          className="text-xs text-slate-400 hover:text-white px-2 py-1 cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {isHeroVisitInsightLoading ? (
                      <div className="flex items-center gap-2 text-xs text-slate-300 py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Gemini AI is analyzing live Hopeland Jobs customer visit counts...</span>
                      </div>
                    ) : heroVisitInsightError ? (
                      <p className="text-xs text-rose-300">{heroVisitInsightError}</p>
                    ) : heroVisitInsight ? (
                      <div className="space-y-2 text-xs">
                        <p className="font-bold text-white">{heroVisitInsight.headline}</p>
                        <p className="text-slate-300 leading-relaxed">{heroVisitInsight.visitTrendSummary}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                            <div className="text-[10px] font-bold uppercase text-amber-400 mb-1">
                              Audience Behavior
                            </div>
                            <p className="text-slate-300 leading-relaxed">{heroVisitInsight.audienceBehavior}</p>
                          </div>
                          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                            <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1">
                              Conversion Opportunity
                            </div>
                            <p className="text-slate-300 leading-relaxed">{heroVisitInsight.conversionOpportunity}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
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

            {/* SEARCH RESULTS SECTION (Shown Only When Visitor Has an Active Search or Filter Query) */}
            {(heroSearch.trim().length > 0 || heroLocation !== 'All' || heroSector !== 'All' || aiSearchResult !== null) && (
              <section id="search-results" className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-700 mb-1">
                      {aiSearchResult ? (
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-current" />
                      ) : (
                        <Search className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      <span>{aiSearchResult ? 'Gemini AI Smart Search Results' : 'Search Results'}</span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-[#0B132B]">
                      Matching Vacancies ({displayedHomepageVacancies.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Showing results for {heroSearch ? `"${heroSearch}"` : 'selected filters'} across Ethiopia.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setHeroSearch('');
                      setHeroLocation('All');
                      setHeroSector('All');
                      setHeroEmploymentType('All');
                      setAiSearchResult(null);
                      setAiSearchError(null);
                    }}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-xl transition-all self-start sm:self-auto cursor-pointer"
                  >
                    Clear Search
                  </button>
                </div>

                {aiSearchError && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    {aiSearchError}
                  </div>
                )}

                {aiSearchResult && (
                  <div className="mb-6 p-4 rounded-2xl bg-[#0B132B] text-white border border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-amber-400">
                        <Sparkles className="w-4 h-4 fill-current" />
                        <span>AI Interpretation: {aiSearchResult.interpretedQuery}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAiSearchResult(null)}
                        className="text-[11px] text-slate-300 hover:text-white underline cursor-pointer"
                      >
                        Switch to standard filter
                      </button>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{aiSearchResult.explanation}</p>
                    {aiSearchResult.searchTip && (
                      <p className="text-[11px] text-amber-300 font-medium">
                        Tip: {aiSearchResult.searchTip}
                      </p>
                    )}
                  </div>
                )}

                {displayedHomepageVacancies.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-3">
                    <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />
                    <h4 className="font-bold text-slate-800 text-sm">No vacancies match this specific filter</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Try searching by category name, click AI Smart Search for semantic matching, or browse the 16 official Ethiopian job categories.
                    </p>
                    <button
                      onClick={() => {
                        setHeroSearch('');
                        setHeroLocation('All');
                        setHeroSector('All');
                        setHeroEmploymentType('All');
                        setAiSearchResult(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayedHomepageVacancies.map((vac) => {
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
                              onClick={() => handleSelectVacancy(vac)}
                              className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white transition-colors cursor-pointer"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* PERSONALIZED RECOMMENDATIONS (Based on Candidate's Position & Experience) */}
            {userProfile ? (
              <section className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="bg-gradient-to-br from-amber-500/10 via-white to-amber-500/5 rounded-3xl p-6 sm:p-8 border border-amber-200/90 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-800 mb-1">
                        <Sparkles className="w-4 h-4 text-amber-600 fill-current" />
                        <span>Personalized Career Matches</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-[#0B132B]">
                        Recommended For You
                      </h2>
                      <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                        Tailored for <strong>{userProfile.fullName || 'You'}</strong> based on your desired position{' '}
                        <strong className="text-amber-800">"{userProfile.desiredJobTitle || userProfile.preferredIndustry}"</strong> and{' '}
                        <strong>{userProfile.yearsOfExperience}</strong> of professional experience.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsJobSeekerDashboardOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-50 text-slate-900 font-bold text-xs shadow-xs transition-all self-start sm:self-auto shrink-0 cursor-pointer"
                    >
                      <span>Update Preferences</span>
                      <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
                    </button>
                  </div>

                  {recommendedVacancies.length === 0 ? (
                    <div className="bg-white/80 backdrop-blur rounded-2xl p-8 text-center border border-amber-100 space-y-2">
                      <Briefcase className="w-8 h-8 text-amber-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-800">
                        Explore vacancies in your chosen sector below
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                        We are continuously analyzing new Ethiopian announcements matching your background.
                      </p>
                      <button
                        onClick={() => setIsJobSeekerDashboardOpen(true)}
                        className="mt-2 px-4 py-2 bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Refine Job Title & Skills
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {recommendedVacancies.map(({ vacancy: vac, matchPercentage, reasons }) => {
                        const days = getDaysLeft(vac.applicationDeadline);
                        const isSaved = savedJobIds.has(vac.id);
                        return (
                          <div
                            key={vac.id}
                            className="bg-white rounded-2xl p-5 border border-amber-200 hover:border-amber-400 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-black tracking-wide text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                                      {matchPercentage}% Match
                                    </span>
                                    {reasons.map((r, i) => (
                                      <span
                                        key={i}
                                        className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200"
                                      >
                                        {r}
                                      </span>
                                    ))}
                                  </div>
                                  <h3
                                    onClick={() => handleSelectVacancy(vac)}
                                    className="text-base font-bold text-slate-900 hover:text-amber-600 transition-colors cursor-pointer line-clamp-1 pt-1"
                                  >
                                    {vac.title}
                                  </h3>
                                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                    <Building className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{vac.organization}</span>
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleToggleSaveJob(vac.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors shrink-0 cursor-pointer"
                                  title={isSaved ? 'Remove' : 'Save'}
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

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-4 text-xs">
                              <span className="text-xs font-bold text-emerald-700 truncate max-w-[150px]">
                                {vac.salary || 'Salary negotiable'}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSelectVacancy(vac)}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors shadow-xs cursor-pointer"
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            ) : (
              /* Logged-Out Recommendation Invitation Banner */
              <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="bg-gradient-to-r from-[#0B132B] to-[#1C2541] rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-slate-800">
                  <div className="space-y-2 max-w-2xl text-center md:text-left">
                    <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-400">
                      <Sparkles className="w-4 h-4 fill-current" />
                      <span>Personalized Job Recommendations</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      Want Vacancies Recommended for Your Position & Experience?
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Sign in with your Google account to receive custom-tailored Ethiopian job opportunities matched directly to your experience level and desired job title.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setUserAuthModalMode('signin');
                      setIsUserAuthModalOpen(true);
                    }}
                    className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all shrink-0 flex items-center gap-2 cursor-pointer hover:scale-105"
                  >
                    <span>Sign In for Recommendations</span>
                    <ArrowRight className="w-4 h-4 text-slate-950" />
                  </button>
                </div>
              </section>
            )}

            {/* ETHIOPIAN JOB CATEGORIES DISCOVERY BANNER (Opens All Categories Directory) */}
            <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-700">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Official Ethiopian Sectors</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-[#0B132B]">
                    Browse All 16 Job Categories
                  </h3>
                  <p className="text-xs text-slate-500">
                    Explore vacancies across Banking, NGOs, Microfinance, IT, Healthcare, Engineering, and Diplomatic missions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAllCategoriesView(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-6 py-3 rounded-2xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors shadow-sm shrink-0 flex items-center gap-2 cursor-pointer"
                >
                  <LayoutGrid className="w-4 h-4 text-amber-400" />
                  <span>View All 16 Categories</span>
                  <ChevronRight className="w-3.5 h-3.5" />
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

            {/* CV & COVER LETTER ASSISTANCE SECTION + INTERACTIVE AI CAREER ADVISOR */}
            <section id="cv-assistance-section" className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <div className="bg-[#FFFBEB] rounded-3xl p-8 sm:p-12 border-2 border-amber-300 relative overflow-hidden space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
                      <Sparkles className="w-3.5 h-3.5 fill-current" />
                      <span>AI Career Guidance Service</span>
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
                        <span>AI-powered cover letter & interview preparation on every vacancy.</span>
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

                {/* Interactive Ask Hopeland AI Career & CV Advisor */}
                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-amber-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#0B132B] text-amber-400 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 fill-current" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Ask Hopeland AI Career & CV Advisor
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Instant Gemini AI guidance tailored for Ethiopian banks, NGOs, and corporate employers.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      'Banking CV tips for CBE & Awash',
                      'NGO cover letter checklist',
                      'Fresh graduate interview prep',
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleAskCareerCoach(prompt)}
                        disabled={isCareerCoachLoading}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-bold text-[11px] transition-colors cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={careerQuestion}
                      onChange={(e) => setCareerQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && careerQuestion.trim()) {
                          e.preventDefault();
                          handleAskCareerCoach();
                        }
                      }}
                      placeholder="Ask any CV, interview, or Ethiopian job search question..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleAskCareerCoach()}
                      disabled={isCareerCoachLoading || !careerQuestion.trim()}
                      className="px-5 py-2.5 rounded-xl bg-[#0B132B] hover:bg-slate-800 disabled:opacity-50 text-amber-400 font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
                    >
                      {isCareerCoachLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>{isCareerCoachLoading ? 'Thinking...' : 'Ask AI Advisor'}</span>
                    </button>
                  </div>

                  {careerCoachError && (
                    <p className="text-xs text-rose-600 font-medium">{careerCoachError}</p>
                  )}

                  {careerCoachAdvice && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                      <div className="font-bold text-slate-900">AI Career Guidance</div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                        {careerCoachAdvice.adviceAnswer}
                      </p>
                      {careerCoachAdvice.profileStrengthTips?.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <div className="text-[11px] font-bold uppercase text-amber-700">
                            Actionable Tips
                          </div>
                          <ul className="list-disc pl-4 space-y-1 text-slate-700">
                            {careerCoachAdvice.profileStrengthTips.map((tip, i) => (
                              <li key={i}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
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
      {isUserAuthModalOpen && (
        <Suspense fallback={null}>
          <UserAuthModal
            key={`user-auth-${userAuthModalMode}-${isUserAuthModalOpen}`}
            isOpen={isUserAuthModalOpen}
            initialMode={userAuthModalMode}
            onClose={() => setIsUserAuthModalOpen(false)}
            onSuccess={async (user, profile) => {
              if (user) {
                setCurrentUser(user);
                setAnalyticsUserId(user.uid || null);
                fetchCustomerVisitCount(true).then((stats) => {
                  if (stats) setVisitStats(stats);
                });
              }
              if (profile) {
                setUserProfile(profile);
              }
              setIsUserAuthModalOpen(false);
              if (user?.uid) {
                try {
                  const [p, apps] = await Promise.all([
                    profile ? Promise.resolve(profile) : fetchJobSeekerProfile(user.uid),
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
        </Suspense>
      )}

      {/* Job Seeker Profile & Dashboard Modal */}
      {isJobSeekerDashboardOpen && userProfile && (
        <Suspense fallback={null}>
          <JobSeekerDashboard
            profile={userProfile}
            applications={userApplications}
            savedVacancies={savedVacanciesList}
            onClose={() => setIsJobSeekerDashboardOpen(false)}
            onUpdateProfile={async (updated) => {
              await saveJobSeekerProfile(updated);
              setUserProfile(updated);
            }}
            onSelectVacancy={handleSelectVacancy}
          />
        </Suspense>
      )}

      {/* Job Application Modal (Direct Apply with CV & Cover Note) */}
      {isApplicationModalOpen && applyTargetVacancy && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Saved Vacancies Drawer */}
      {isSavedDrawerOpen && (
        <Suspense fallback={null}>
          <SavedJobsDrawer
            isOpen={isSavedDrawerOpen}
            onClose={() => setIsSavedDrawerOpen(false)}
            savedVacancies={savedVacanciesList}
            onRemoveSaved={handleRemoveSavedJob}
            onClearAll={handleClearAllSaved}
            onSelectVacancy={handleSelectVacancy}
            telegramUrl={siteSettings.telegramChannelUrl}
          />
        </Suspense>
      )}

      {/* Individual Vacancy Modal */}
      {selectedVacancy && (
        <Suspense fallback={null}>
          <VacancyDetailModal
            vacancy={selectedVacancy}
            userProfile={userProfile}
            onClose={handleCloseVacancy}
            telegramUrl={siteSettings.telegramChannelUrl}
          />
        </Suspense>
      )}

      {/* Admin Login Modal */}
      {isAdminAuthModalOpen && (
        <Suspense fallback={null}>
          <AdminAuthModal
            isOpen={isAdminAuthModalOpen}
            onClose={() => setIsAdminAuthModalOpen(false)}
            onLoginSuccess={(email) => {
              setIsOwnerAuthorized(true);
              setAdminEmail(email);
              setIsAdminView(true);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
