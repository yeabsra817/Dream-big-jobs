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
  Globe,
  Plane,
  Landmark,
  Building2,
  BellRing,
  UploadCloud,
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
  ExperienceScholarship,
  ImmigrationPathway,
  InternationalJob,
  ResearchHistoryRun,
  VerificationReportItem,
} from './types/international';
import {
  fetchPublishedVacancies,
  fetchVacancyById,
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
  fetchInternationalJobs,
  saveBatchInternationalJobs,
  deleteInternationalJob,
  fetchImmigrationPathways,
  saveBatchImmigrationPathways,
  deleteImmigrationPathway,
  fetchExperienceScholarships,
  saveBatchExperienceScholarships,
  deleteExperienceScholarship,
  fetchResearchHistory,
  saveResearchHistoryRun,
  fetchVerificationLogs,
  saveBatchVerificationLogs,
  setActiveAdminSessionEmail,
  getActiveAdminSessionEmail,
  fetchDeveloperSessionStatus,
  establishDeveloperGoogleSession,
  logoutDeveloperSession,
  fetchInternationalStateFromServer,
} from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { isExpired, getDaysLeft } from './utils/helpers';
import { runAutonomousVacancyHealing } from './utils/SelfHealingEngine';
import { broadcastJobToTelegram, normalizeTelegramChatId } from './utils/telegramClient';
import { Navbar } from './components/Navbar';
import { CategoryCard } from './components/CategoryCard';
import { CategoryIcon } from './components/CategoryIcon';
import { Footer } from './components/Footer';
import { HiddenDeveloperLogin } from './components/HiddenDeveloperLogin';
import { TrustedCompaniesCarousel } from './components/TrustedCompaniesCarousel';
import { FeaturedCompaniesCarousel } from './components/FeaturedCompaniesCarousel';
import { ETHIOPIAN_TRUSTED_COMPANIES, EthiopianCompanyItem } from './data/trustedCompanies';
import heroCareerBackdropImg from './assets/images/hero_career_backdrop_1794921607084.jpg';
import howHopelandWorksImg from './assets/images/how_hopeland_works_clean_1794921628573.jpg';
import { initGoogleAnalytics4, trackAnalyticsEvent, setAnalyticsUserId } from './lib/analyticsTracker';
import {
  JobSeekerProfile,
  UserJobApplication,
  DEFAULT_JOB_SEEKER_PROFILE,
  NotificationPreferencesRecord,
  NotificationPermissionState,
  UserNotificationItem,
  evaluateMandatoryProfileCompletion,
} from './types/jobSeeker';
import {
  computeStaffOpportunityRecommendations,
  hasCompletedMandatoryPreferences,
  hasProfileExperienceSignals,
  assessVacancyExperienceMatch,
  ExperienceMatchAssessment,
} from './utils/recommendationEngine';
import {
  registerServiceWorkerSafe,
  getBrowserNotificationPermission,
  fetchUserNotificationPreferences,
  saveUserNotificationPreferences,
  checkCurrentDevicePushHealth,
  checkVisitorNotificationStatus,
  recordNotificationPromptDismissal,
  clearNotificationPromptDismissal,
  isRunningInEmbeddedIframe,
  syncBrowserPushWithUserAccount,
  requestAndEnableNotifications,
  disableDeviceNotifications,
  fetchUserNotificationsServer,
  markUserNotificationReadServer,
  syncNotificationsOnReconnect,
  dispatchLocalServiceWorkerPushFallback,
  syncVacanciesToServerCatalog,
  syncAllUsersFromFirestoreToServer,
  deleteVacanciesFromServerCatalog,
  recalculateUserRecommendationsServer,
  isAmharicSignupPromoDismissed,
  recordAmharicSignupPromoDismissed,
  isIosSafariNeedsInstall,
} from './lib/notificationService';
import { NotificationPermissionModal } from './components/NotificationPermissionModal';
import { AmharicSignupPromoModal } from './components/AmharicSignupPromoModal';
import { PWAInstallPromptModal } from './components/PWAInstallPromptModal';
import { AppDownloadReminderBanner } from './components/AppDownloadReminderBanner';
import { usePWAInstall } from './hooks/usePWAInstall';
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
const InternationalJobsView = lazy(() => import('./components/InternationalJobsView').then((m) => ({ default: m.InternationalJobsView })));
const ImmigrationResidenceView = lazy(() => import('./components/ImmigrationResidenceView').then((m) => ({ default: m.ImmigrationResidenceView })));
const ScholarshipsView = lazy(() => import('./components/ScholarshipsView').then((m) => ({ default: m.ScholarshipsView })));
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
      <Loader2 className="w-4 h-4 animate-spin text-[#16A34A]" />
      <span>Loading...</span>
    </div>
  </div>
);

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
        appLogoUrl: '',
        appLogo512Url: '',
        appLogoMaskable512Url: '',
        appLogoUpdatedAt: '',
        gaMeasurementId: 'G-KH6X73105S',
        gaTrackingEnabled: true,
        aboutText:
          'HOPELAND JOBS is Ethiopia’s premier, verified job recruitment information portal. We provide genuine, accurate vacancies across banking, embassies, NGOs, hospitality, leading corporate sectors, and international visa opportunities.',
        updatedAt: new Date().toISOString(),
      }
    );
  });
  const [duplicateReports, setDuplicateReports] = useState<DuplicateReportItem[]>([]);
  const [internationalJobs, setInternationalJobs] = useState<InternationalJob[]>([]);
  const [immigrationPathways, setImmigrationPathways] = useState<ImmigrationPathway[]>([]);
  const [experienceScholarships, setExperienceScholarships] = useState<ExperienceScholarship[]>([]);
  const [researchHistory, setResearchHistory] = useState<ResearchHistoryRun[]>([]);
  const [verificationLogs, setVerificationLogs] = useState<VerificationReportItem[]>([]);

  // Navigation & View State
  const [selectedCategory, setSelectedCategory] = useState<CategoryMeta | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [isTelegramApplyArrival, setIsTelegramApplyArrival] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [isAllCategoriesView, setIsAllCategoriesView] = useState(false);
  const [activeExpansionView, setActiveExpansionView] = useState<
    'international-jobs' | 'immigration' | 'scholarships' | null
  >(() => {
    if (typeof window === 'undefined') return null;
    const v = new URLSearchParams(window.location.search).get('view');
    if (v === 'international-jobs' || v === 'immigration' || v === 'scholarships') return v;
    return null;
  });

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
  const [jobSeekerInitialTab, setJobSeekerInitialTab] = useState<
    'overview' | 'recommendations' | 'notifications' | 'personal' | 'professional' | 'education' | 'experience'
  >('overview');
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [applyTargetVacancy, setApplyTargetVacancy] = useState<Vacancy | null>(null);
  const [userApplications, setUserApplications] = useState<UserJobApplication[]>([]);
  const [homepageLocalMode, setHomepageLocalMode] = useState<'experience' | 'all'>('experience');
  const [showAllHomepageLocal, setShowAllHomepageLocal] = useState(false);
  const [searchExperienceOnly, setSearchExperienceOnly] = useState(false);

  // Notifications, Push & Reconnect Sync State
  const [userNotifications, setUserNotifications] = useState<UserNotificationItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferencesRecord | null>(null);
  const [browserPerm, setBrowserPerm] = useState<NotificationPermissionState>(() =>
    getBrowserNotificationPermission()
  );
  const [hasActiveDevicePush, setHasActiveDevicePush] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isAmharicPromoOpen, setIsAmharicPromoOpen] = useState(false);
  const [notificationModalReason, setNotificationModalReason] = useState<
    | 'first_time'
    | 'not_enabled_yet'
    | 'renew_device'
    | 'blocked_in_browser'
    | 'ios_install_required'
    | 'unsupported'
  >('first_time');
  const alreadyPromptedThisLoginRef = React.useRef(false);
  const enablePushRequestedRef = React.useRef(false);
  const visitorPromptCheckedRef = React.useRef(false);
  const visitorPromptTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOpenTopRecsRef = React.useRef(false);
  const pendingNotifReadIdRef = React.useRef<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncingReconnect, setIsSyncingReconnect] = useState(false);
  const [isIosInstallGuideOpen, setIsIosInstallGuideOpen] = useState(false);
  const [isInstallPopupOpen, setIsInstallPopupOpen] = useState(false);
  const [isMinuteInstallReminderOpen, setIsMinuteInstallReminderOpen] = useState(false);
  const {
    isInstalled: isStandaloneApp,
    isInstallable: canInstallNativeApp,
    isDesktop: isDesktopDevice,
    canShowIosInstallGuide,
    install: triggerNativeAppInstall,
  } = usePWAInstall();

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
  const [searchTab, setSearchTab] = useState<'jobs' | 'companies'>('jobs');
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [howWorksImgError, setHowWorksImgError] = useState(false);

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

  // Helper to sync existing/anonymous browser push subscription, load notifications, and apply visitor opt-in rules
  const hydrateUserNotificationsAndPrompt = React.useCallback(
    async (uid: string, email?: string | null, evaluatePrompt = true) => {
      if (!uid) return;
      try {
        if (visitorPromptTimerRef.current) {
          clearTimeout(visitorPromptTimerRef.current);
          visitorPromptTimerRef.current = null;
        }

        // Load user preferences first so an explicit opt-out (manuallyDisabled) is never overwritten
        const initialPrefs = await fetchUserNotificationPreferences(uid, email).catch(() => null);
        if (initialPrefs?.manuallyDisabled !== true) {
          await syncBrowserPushWithUserAccount(uid, email, undefined, initialPrefs).catch(() => null);
        }

        const [status, notifRes] = await Promise.all([
          checkVisitorNotificationStatus(uid, email),
          fetchUserNotificationsServer(uid, email),
        ]);
        const freshPrefs = status.preferences || initialPrefs;
        setNotificationPrefs(freshPrefs);
        setUserNotifications(notifRes.notifications);
        setUnreadNotificationsCount(notifRes.unreadCount);
        setBrowserPerm(status.browserPermission);
        setHasActiveDevicePush(
          freshPrefs?.manuallyDisabled !== true && status.hasValidSubscription
        );

        if (freshPrefs?.manuallyDisabled !== true && notifRes.notifications.length > 0) {
          dispatchLocalServiceWorkerPushFallback(uid, notifRes.notifications, freshPrefs).catch(() => 0);
        }

        // Background recommendation + missed match refresh (strictly gated on mandatory fields & opt-out)
        recalculateUserRecommendationsServer(uid, email, true)
          .then(async (res) => {
            if (res.newNotifications && res.newNotifications.length > 0) {
              const fresh = await fetchUserNotificationsServer(uid, email);
              setUserNotifications(fresh.notifications);
              setUnreadNotificationsCount(fresh.unreadCount);
              if (freshPrefs?.manuallyDisabled !== true) {
                await dispatchLocalServiceWorkerPushFallback(uid, fresh.notifications, freshPrefs).catch(
                  () => 0
                );
              }
            }
          })
          .catch(() => {});

        if (freshPrefs?.manuallyDisabled === true || status.hasValidSubscription) {
          setIsNotificationModalOpen(false);
          return;
        }

        if (
          evaluatePrompt &&
          (!alreadyPromptedThisLoginRef.current || enablePushRequestedRef.current) &&
          status.shouldShowPopup
        ) {
          if (
            status.reason !== 'already_active' &&
            status.reason !== 'dismissed_cooldown' &&
            status.reason !== 'unsupported'
          ) {
            alreadyPromptedThisLoginRef.current = true;
            enablePushRequestedRef.current = false;
            setNotificationModalReason(status.reason);
            setIsNotificationModalOpen(true);
          }
        }
      } catch (err) {
        console.warn('Notification hydration notice:', err);
      }
    },
    []
  );

  // Load Initial Data (Public data: site settings & published vacancies)
  useEffect(() => {
    // Track real visitor landing immediately so quick visits or slow mobile loads are never missed
    initGoogleAnalytics4(undefined, false);
    trackAnalyticsEvent('page_view', {
      path: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
      title: typeof document !== 'undefined' ? document.title : 'HOPELAND JOBS',
    });

    // Restore persistent server-signed developer session (survives page refresh & updates)
    fetchDeveloperSessionStatus().then((devStatus) => {
      if (devStatus.authenticated) {
        const email = devStatus.email || ADMIN_EMAIL;
        setActiveAdminSessionEmail(email);
        setIsOwnerAuthorized(true);
        setAdminEmail(email);
      }
    });

    async function loadData() {
      try {
        const [
          loadedSettings,
          loadedVacancies,
          loadedIntlJobs,
          loadedPathways,
          loadedScholarships,
        ] = await Promise.all([
          getSiteSettings(),
          fetchPublishedVacancies(),
          fetchInternationalJobs(false),
          fetchImmigrationPathways(false),
          fetchExperienceScholarships(false),
        ]);
        setSiteSettings(loadedSettings);
        setVacancies(loadedVacancies);
        setInternationalJobs(loadedIntlJobs);
        setImmigrationPathways(loadedPathways);
        setExperienceScholarships(loadedScholarships);

        // Seed server-side vacancy catalog if empty so matching engine always has verified jobs
        syncVacanciesToServerCatalog(loadedVacancies, { mode: 'seed_if_empty' });

        // Ensure Always-On GA4 measurement ID from siteSettings is initialized
        if (loadedSettings.gaTrackingEnabled !== false) {
          initGoogleAnalytics4(loadedSettings.gaMeasurementId || 'G-KH6X73105S', false);
        }

        // Check URL parameter or path for direct job link (from Telegram / WhatsApp / Social shares)
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('enablePush') === '1' && !isRunningInEmbeddedIframe()) {
            enablePushRequestedRef.current = true;
            clearNotificationPromptDismissal();
            urlParams.delete('enablePush');
            const cleanQuery = urlParams.toString();
            const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash || ''}`;
            window.history.replaceState({}, '', cleanUrl);
          }
          if (urlParams.get('installApp') === '1' && !isRunningInEmbeddedIframe()) {
            urlParams.delete('installApp');
            const cleanQuery = urlParams.toString();
            const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash || ''}`;
            window.history.replaceState({}, '', cleanUrl);
            setIsMinuteInstallReminderOpen(true);
          }
          if (urlParams.get('view') === 'top-recommendations') {
            pendingOpenTopRecsRef.current = true;
            const notifIdFromUrl = urlParams.get('notificationId');
            if (notifIdFromUrl) pendingNotifReadIdRef.current = notifIdFromUrl;
          }
          const jobId = urlParams.get('jobId') || urlParams.get('job_id') || urlParams.get('id');
          const pathMatch = window.location.pathname.match(/\/jobs\/([^\/\?]+)/);
          const targetId = jobId || (pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : undefined);
          const arrivedFromTelegram = urlParams.get('utm_source') === 'telegram';
          const applyAction =
            urlParams.get('apply') === '1' ||
            urlParams.get('action') === 'apply' ||
            arrivedFromTelegram;

          if (targetId) {
            let found = loadedVacancies.find(
              (v) => v.id === targetId || v.id.toLowerCase() === targetId.toLowerCase()
            );
            if (!found) {
              const fetchedOne = await fetchVacancyById(targetId).catch(() => null);
              if (fetchedOne) found = fetchedOne;
            }
            if (found) {
              setSelectedVacancy(found);
              setIsTelegramApplyArrival(applyAction);
              document.title = `${found.title} at ${found.organization} | HOPELAND JOBS`;
              trackAnalyticsEvent('vacancy_view', {
                jobId: found.id,
                jobTitle: found.title,
                organization: found.organization,
                category: found.category,
                path: `/jobs/${encodeURIComponent(found.id)}`,
                gaMeasurementId: loadedSettings.gaMeasurementId,
              });
              if (arrivedFromTelegram) {
                trackAnalyticsEvent('click_telegram_link', {
                  jobId: found.id,
                  jobTitle: found.title,
                  organization: found.organization,
                  category: found.category,
                  path: `/jobs/${encodeURIComponent(found.id)}`,
                  gaMeasurementId: loadedSettings.gaMeasurementId,
                });
              }
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
        setIsAmharicPromoOpen(false);
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
          const ownerEmail = user.email || ADMIN_EMAIL;
          setIsOwnerAuthorized(true);
          setAdminEmail(ownerEmail);
          setActiveAdminSessionEmail(ownerEmail);
          establishDeveloperGoogleSession(ownerEmail).catch(() => {});
        } else if (!getActiveAdminSessionEmail()) {
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
            // Touch lastActiveAt / lastLoginAt if stale (>2m)
            const prevActMs = syncedProfile.lastActiveAt ? new Date(syncedProfile.lastActiveAt).getTime() : 0;
            if (!prevActMs || Date.now() - prevActMs > 120000) {
              syncedProfile = { ...syncedProfile, lastLoginAt: now, lastActiveAt: now, updatedAt: now };
              saveJobSeekerProfile(syncedProfile).catch(() => {});
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
              noExperience: false,
              profileStatus: 'incomplete',
              profileCompletionPercentage: 0,
              savedJobIds: Array.from(savedJobIds).slice(0, 200),
              lastLoginAt: now,
              lastActiveAt: now,
              createdAt: now,
              updatedAt: now,
            };
            await saveJobSeekerProfile(newProfile);
            await saveUserNotificationPreferences(
              user.uid,
              {
                manuallyDisabled: false,
                permissionStatus: 'default',
                subscriptionStatus: 'none',
                channels: {
                  websiteBell: true,
                  browserPush: true,
                  mobilePush: true,
                  emailAlerts: false,
                },
              },
              user.email
            ).catch(() => null);
            setUserProfile(newProfile);
          }

          // Hydrate notifications, verify current device push status & apply strict Req 10F rule
          await hydrateUserNotificationsAndPrompt(user.uid, user.email, true);

          if (pendingOpenTopRecsRef.current) {
            pendingOpenTopRecsRef.current = false;
            const notifIdToRead = pendingNotifReadIdRef.current;
            pendingNotifReadIdRef.current = null;
            if (notifIdToRead) {
              markUserNotificationReadServer(user.uid, { notificationId: notifIdToRead, read: true }, user.email)
                .then((res) => {
                  setUserNotifications(res.notifications);
                  setUnreadNotificationsCount(res.unreadCount);
                })
                .catch(() => {});
            }
            setIsNotificationModalOpen(false);
            setJobSeekerInitialTab('recommendations');
            setIsJobSeekerDashboardOpen(true);
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', '/');
            }
          }
        } catch (e) {
          console.warn('Profile sync notice:', e);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setUserApplications([]);
        setUserNotifications([]);
        setUnreadNotificationsCount(0);
        setNotificationPrefs(null);
        setHasActiveDevicePush(false);
        alreadyPromptedThisLoginRef.current = false;
        setAnalyticsUserId(null);
        // Preserve password-authenticated developer session if active
        const activeSessionEmail = getActiveAdminSessionEmail();
        if (activeSessionEmail) {
          setIsOwnerAuthorized(true);
          setAdminEmail(activeSessionEmail);
        } else {
          setIsOwnerAuthorized(false);
          setAdminEmail(null);
        }

        // Check unregistered visitors: display promo popup only on general browsing, not covering direct job links
        if (!visitorPromptCheckedRef.current) {
          visitorPromptCheckedRef.current = true;
          const searchParamsNow =
            typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const isTopRecsLanding = searchParamsNow?.get('view') === 'top-recommendations';
          if (isTopRecsLanding || pendingOpenTopRecsRef.current) {
            setUserAuthModalMode('signin');
            setIsUserAuthModalOpen(true);
            return;
          }
          const isDirectJobLanding =
            typeof window !== 'undefined' &&
            (/\/jobs\/[^/?]+/.test(window.location.pathname) ||
              Boolean(searchParamsNow?.has('jobId')) ||
              Boolean(searchParamsNow?.has('job_id')) ||
              Boolean(searchParamsNow?.has('id')));
          if (!isDirectJobLanding) {
            if (visitorPromptTimerRef.current) clearTimeout(visitorPromptTimerRef.current);
            visitorPromptTimerRef.current = setTimeout(async () => {
              if (auth.currentUser) return;
              try {
                if (enablePushRequestedRef.current) {
                  clearNotificationPromptDismissal();
                }
                const status = await checkVisitorNotificationStatus(null, null);
                setBrowserPerm(status.browserPermission);
                setHasActiveDevicePush(status.hasValidSubscription);

                if (enablePushRequestedRef.current) {
                  enablePushRequestedRef.current = false;
                  if (!status.hasValidSubscription && status.reason !== 'unsupported') {
                    alreadyPromptedThisLoginRef.current = true;
                    setIsAmharicPromoOpen(false);
                    setNotificationModalReason(
                      status.reason === 'already_active' || status.reason === 'dismissed_cooldown'
                        ? 'first_time'
                        : status.reason
                    );
                    setIsNotificationModalOpen(true);
                  }
                  return;
                }

                if (!isAmharicSignupPromoDismissed()) {
                  alreadyPromptedThisLoginRef.current = true;
                  setIsNotificationModalOpen(false);
                  setIsAmharicPromoOpen(true);
                  return;
                }

                if (
                  status.shouldShowPopup &&
                  status.reason !== 'already_active' &&
                  status.reason !== 'dismissed_cooldown' &&
                  status.reason !== 'unsupported'
                ) {
                  alreadyPromptedThisLoginRef.current = true;
                  setNotificationModalReason(status.reason);
                  setIsNotificationModalOpen(true);
                }
              } catch {}
            }, 900);
          }
        }
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
      if (visitorPromptTimerRef.current) {
        clearTimeout(visitorPromptTimerRef.current);
        visitorPromptTimerRef.current = null;
      }
    };
  }, [hydrateUserNotificationsAndPrompt]);

  // Real-time online heartbeat for signed-in users (keeps Admin Online Users count accurate)
  useEffect(() => {
    if (!userProfile?.uid) return;
    const heartbeat = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const now = new Date().toISOString();
        saveJobSeekerProfile({
          ...userProfile,
          lastActiveAt: now,
        }).catch(() => {});
      }
    }, 60 * 1000);
    return () => clearInterval(heartbeat);
  }, [userProfile]);

  // Register Service Worker, PWA Install Prompt, Online/Offline Reconnect Sync & Deep-Link Message Handler
  useEffect(() => {
    registerServiceWorkerSafe();

    const triggerReconnectSync = async () => {
      if (!userProfile?.uid) return;
      setIsSyncingReconnect(true);
      try {
        const res = await syncNotificationsOnReconnect(userProfile.uid, userProfile.email);
        if (res) {
          setUserNotifications(res.notifications);
          setUnreadNotificationsCount(res.unreadCount);
          if (notificationPrefs?.manuallyDisabled !== true && res.notifications.length > 0) {
            await dispatchLocalServiceWorkerPushFallback(
              userProfile.uid,
              res.notifications,
              notificationPrefs
            ).catch(() => 0);
          }
        }
      } finally {
        setIsSyncingReconnect(false);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      triggerReconnectSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && userProfile?.uid) {
        triggerReconnectSync();
      }
    };
    const handleSwMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'HOPELAND_RECONNECT_SYNC_TRIGGER') {
        triggerReconnectSync();
      } else if (event.data?.type === 'HOPELAND_OPEN_RECOMMENDATIONS_FROM_NOTIFICATION') {
        const notificationId = event.data.notificationId;
        setIsAdminView(false);
        setActiveExpansionView(null);
        setSelectedCategory(null);
        setSelectedLocation(null);
        setIsAllCategoriesView(false);
        setSelectedVacancy(null);
        if (notificationId && userProfile?.uid) {
          markUserNotificationReadServer(userProfile.uid, { notificationId, read: true }, userProfile.email)
            .then((res) => {
              setUserNotifications(res.notifications);
              setUnreadNotificationsCount(res.unreadCount);
            })
            .catch(() => {});
        }
        if (userProfile?.uid) {
          setJobSeekerInitialTab('recommendations');
          setIsJobSeekerDashboardOpen(true);
        } else {
          pendingOpenTopRecsRef.current = true;
          if (notificationId) pendingNotifReadIdRef.current = notificationId;
          setUserAuthModalMode('signin');
          setIsUserAuthModalOpen(true);
        }
      } else if (event.data?.type === 'HOPELAND_OPEN_JOB_FROM_NOTIFICATION') {
        const resolvedJobId = event.data.vacancyId || event.data.jobId;
        const notificationId = event.data.notificationId;
        if (notificationId && userProfile?.uid) {
          markUserNotificationReadServer(userProfile.uid, { notificationId, read: true }, userProfile.email)
            .then((res) => {
              setUserNotifications(res.notifications);
              setUnreadNotificationsCount(res.unreadCount);
            })
            .catch(() => {});
        }
        if (resolvedJobId) {
          setIsAdminView(false);
          setActiveExpansionView(null);
          setSelectedCategory(null);
          setSelectedLocation(null);
          setIsAllCategoriesView(false);
          let found = vacancies.find(
            (v) => v.id === resolvedJobId || v.id.toLowerCase() === String(resolvedJobId).toLowerCase()
          );
          if (!found) {
            try {
              const latest = await fetchPublishedVacancies();
              if (latest.length > 0) {
                setVacancies(latest);
                found = latest.find(
                  (v) => v.id === resolvedJobId || v.id.toLowerCase() === String(resolvedJobId).toLowerCase()
                );
              }
            } catch {}
          }
          if (found) {
            setSelectedVacancy(found);
            setIsTelegramApplyArrival(Boolean(event.data?.url && String(event.data.url).includes('apply=1')));
            document.title = `${found.title} at ${found.organization} | HOPELAND JOBS`;
          }
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', `/?jobId=${encodeURIComponent(resolvedJobId)}`);
          }
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [userProfile?.uid, userProfile?.email, vacancies]);

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
      const viewParam = urlParams.get('view');
      if (viewParam === 'top-recommendations') {
        setActiveExpansionView(null);
        setJobSeekerInitialTab('recommendations');
        setIsJobSeekerDashboardOpen(true);
      } else if (
        viewParam === 'international-jobs' ||
        viewParam === 'immigration' ||
        viewParam === 'scholarships'
      ) {
        setActiveExpansionView(viewParam);
      } else if (!targetId) {
        setActiveExpansionView(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [vacancies]);

  // When admin logs in, load ALL vacancies, duplicate reports, fresh site settings, and international admin datasets
  useEffect(() => {
    if (isOwnerAuthorized) {
      syncAllUsersFromFirestoreToServer(adminEmail || undefined).catch(() => {});
      Promise.all([
        fetchAllVacanciesAdmin(),
        fetchDuplicateReports(),
        getSiteSettings(),
        fetchInternationalJobs(true),
        fetchImmigrationPathways(true),
        fetchExperienceScholarships(true),
        fetchResearchHistory(),
        fetchVerificationLogs(),
      ])
        .then(([all, dups, freshSettings, intlJobs, pathways, scholarships, historyRuns, verLogs]) => {
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
              syncVacanciesToServerCatalog(healed.healedVacancies, { mode: 'replace' });
            } else {
              setVacancies(all);
              syncVacanciesToServerCatalog(all, { mode: 'replace' });
            }
          }
          if (dups.length > 0) setDuplicateReports(dups);
          setInternationalJobs(intlJobs);
          setImmigrationPathways(pathways);
          setExperienceScholarships(scholarships);
          setResearchHistory(historyRuns);
          setVerificationLogs(verLogs);

          // Pull latest private server state from the autonomous 30s System 2 scheduler
          fetchInternationalStateFromServer(true)
            .then((srv) => {
              if (!srv) return;
              if (Array.isArray(srv.internationalJobs)) setInternationalJobs(srv.internationalJobs);
              if (Array.isArray(srv.immigrationPathways)) setImmigrationPathways(srv.immigrationPathways);
              if (Array.isArray(srv.experienceScholarships)) setExperienceScholarships(srv.experienceScholarships);
              if (Array.isArray(srv.researchHistory)) setResearchHistory(srv.researchHistory);
              if (Array.isArray(srv.verificationLogs)) setVerificationLogs(srv.verificationLogs);
            })
            .catch(() => {});
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

  // Filtered Ethiopian showcase companies when browsing/searching in Companies tab
  const matchingCompanies = useMemo(() => {
    const q = heroSearch.toLowerCase().trim();
    const list = ETHIOPIAN_TRUSTED_COMPANIES.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.shortName.toLowerCase().includes(q) ||
        c.sector.toLowerCase().includes(q) ||
        c.categoryName.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
      );
    });
    return list;
  }, [heroSearch]);

  // Filtered vacancies for the homepage list
  const filteredHomepageVacancies = useMemo(() => {
    return publishedVacancies.filter((v) => {
      const q = heroSearch.toLowerCase().trim();
      const matchedCompany = q
        ? ETHIOPIAN_TRUSTED_COMPANIES.find(
            (c) =>
              c.name.toLowerCase() === q ||
              c.shortName.toLowerCase() === q ||
              c.name.toLowerCase().includes(q)
          )
        : undefined;

      const matchesSearch =
        !q ||
        v.title.toLowerCase().includes(q) ||
        v.organization.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.location.toLowerCase().includes(q) ||
        (matchedCompany ? v.category === matchedCompany.categoryName && v.organization.toLowerCase().includes(matchedCompany.shortName.toLowerCase()) : false) ||
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

  const hasExpSignals = useMemo(() => hasProfileExperienceSignals(userProfile), [userProfile]);

  const vacancyExperienceMap = useMemo(() => {
    const map = new Map<string, ExperienceMatchAssessment>();
    if (!hasExpSignals) return map;
    publishedVacancies.forEach((v) => {
      map.set(v.id, assessVacancyExperienceMatch(userProfile, v));
    });
    return map;
  }, [publishedVacancies, userProfile, hasExpSignals]);

  const localExperienceMatchedVacancies = useMemo(() => {
    if (!hasExpSignals) return [];
    return publishedVacancies
      .filter((v) => vacancyExperienceMap.get(v.id)?.isMatch)
      .sort((a, b) => {
        const ma = vacancyExperienceMap.get(a.id)!;
        const mb = vacancyExperienceMap.get(b.id)!;
        if (ma.meetsYearsRequirement !== mb.meetsYearsRequirement) {
          return ma.meetsYearsRequirement ? -1 : 1;
        }
        if (ma.matchType !== mb.matchType) {
          return ma.matchType === 'direct' ? -1 : 1;
        }
        return mb.score - ma.score;
      });
  }, [publishedVacancies, vacancyExperienceMap, hasExpSignals]);

  // Combined displayed search results (AI-ranked when AI Smart Search is active, otherwise experience-prioritized filter)
  const displayedHomepageVacancies = useMemo(() => {
    let base: Vacancy[];
    if (aiSearchResult && aiSearchResult.matchedVacancyIds && aiSearchResult.matchedVacancyIds.length > 0) {
      const idRank = new Map<string, number>();
      aiSearchResult.matchedVacancyIds.forEach((id, idx) => idRank.set(id, idx));
      const matched = publishedVacancies
        .filter((v) => idRank.has(v.id))
        .sort((a, b) => (idRank.get(a.id) ?? 999) - (idRank.get(b.id) ?? 999));
      base = matched.length > 0 ? matched : filteredHomepageVacancies;
    } else if (hasExpSignals) {
      base = [...filteredHomepageVacancies].sort((a, b) => {
        const ma = vacancyExperienceMap.get(a.id);
        const mb = vacancyExperienceMap.get(b.id);
        const aMatch = ma?.isMatch ? 1 : 0;
        const bMatch = mb?.isMatch ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
        if (ma?.isMatch && mb?.isMatch) {
          if (ma.meetsYearsRequirement !== mb.meetsYearsRequirement) {
            return ma.meetsYearsRequirement ? -1 : 1;
          }
          if (ma.matchType !== mb.matchType) {
            return ma.matchType === 'direct' ? -1 : 1;
          }
          return mb.score - ma.score;
        }
        return 0;
      });
    } else {
      base = filteredHomepageVacancies;
    }

    if (searchExperienceOnly && hasExpSignals) {
      return base.filter((v) => vacancyExperienceMap.get(v.id)?.isMatch);
    }
    return base;
  }, [
    aiSearchResult,
    publishedVacancies,
    filteredHomepageVacancies,
    hasExpSignals,
    vacancyExperienceMap,
    searchExperienceOnly,
  ]);

  const handleHeroSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchTriggered(true);
    setAiSearchError(null);
    setTimeout(() => {
      const el = document.getElementById('search-results');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleSelectCompanyFromShowcase = (company: EthiopianCompanyItem) => {
    setSearchTab('companies');
    setHeroSearch(company.name);
    setHeroLocation('All');
    setHeroSector('All');
    setHeroEmploymentType('All');
    setAiSearchResult(null);
    setAiSearchError(null);
    setSearchTriggered(true);
    setTimeout(() => {
      const el = document.getElementById('search-results');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleViewAllFeaturedCompanies = () => {
    setSearchTab('companies');
    setHeroSearch('');
    setHeroLocation('All');
    setHeroSector('All');
    setHeroEmploymentType('All');
    setAiSearchResult(null);
    setAiSearchError(null);
    setSearchTriggered(true);
    setTimeout(() => {
      const el = document.getElementById('search-results');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleClearHomepageSearch = () => {
    setHeroSearch('');
    setHeroLocation('All');
    setHeroSector('All');
    setHeroEmploymentType('All');
    setAiSearchResult(null);
    setAiSearchError(null);
    setSearchTriggered(false);
  };

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

  // Personalized recommendations across all verified sectors using shared engine
  const recommendedVacancies = useMemo(() => {
    if (!userProfile) return [];
    return computeStaffOpportunityRecommendations(
      userProfile,
      publishedVacancies,
      [],
      [],
      30
    );
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
    setIsTelegramApplyArrival(false);
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.origin}/jobs/${encodeURIComponent(v.id)}`;
      window.history.pushState({ jobId: v.id }, `${v.title} | HOPELAND JOBS`, newUrl);
      document.title = `${v.title} at ${v.organization} | HOPELAND JOBS`;
    }
  };

  const handleCloseVacancy = () => {
    setSelectedVacancy(null);
    setIsTelegramApplyArrival(false);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, 'HOPELAND JOBS', '/');
      document.title = 'HOPELAND JOBS | Hopeland Jobs - Find Your Opportunity.';
    }
  };

  // Dedicated Location Selection
  const handleSelectLocation = (loc: string) => {
    setSelectedLocation(loc);
    setSelectedCategory(null);
    setIsAllCategoriesView(false);
    setActiveExpansionView(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleOpenExpansionView = (
    view: 'international-jobs' | 'immigration' | 'scholarships' | null
  ) => {
    setSelectedCategory(null);
    setSelectedLocation(null);
    setIsAllCategoriesView(false);
    setActiveExpansionView(view);
    if (typeof window !== 'undefined') {
      const targetUrl = view
        ? `${window.location.pathname}?view=${view}`
        : window.location.pathname;
      window.history.pushState({ view }, 'HOPELAND JOBS', targetUrl);
    }
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

  // Automatic Telegram Publishing when a vacancy is newly published or approved
  const maybeAutoPublishVacancyToTelegram = async (savedVacancy: Vacancy, previousVacancy?: Vacancy) => {
    if (siteSettings.telegramAutoPublish === false) return;
    if (savedVacancy.status !== 'published') return;
    if (savedVacancy.telegramPublished) return;

    const wasAlreadyPublishedOnSite = previousVacancy?.status === 'published';
    if (wasAlreadyPublishedOnSite) return;

    const targetChannel = normalizeTelegramChatId(
      siteSettings.telegramChannelName || siteSettings.telegramChannelId || '@DreamBigJobsEthiopia'
    ).chatId;

    try {
      const res = await broadcastJobToTelegram(
        savedVacancy,
        targetChannel,
        false,
        siteSettings.customDomain,
        siteSettings,
        'vacancy',
        'auto_publish'
      );

      if (res.success) {
        const synced: Vacancy = {
          ...savedVacancy,
          telegramPublished: true,
          telegramMessageId: res.telegramMessageId,
          telegramPublishedAt: res.telegramPublishedAt || new Date().toISOString(),
          telegramPublishError: '',
          updatedAt: new Date().toISOString(),
        };
        setVacancies((prev) => prev.map((v) => (v.id === synced.id ? synced : v)));
        await saveVacancy(synced);
      } else if (!res.alreadyPublished && !res.blockedByRule && res.error) {
        const failedSync: Vacancy = {
          ...savedVacancy,
          telegramPublishError: res.error,
          updatedAt: new Date().toISOString(),
        };
        setVacancies((prev) => prev.map((v) => (v.id === failedSync.id ? failedSync : v)));
        await saveVacancy(failedSync);
      }
    } catch (err: any) {
      console.warn('Auto-publish Telegram notice:', err?.message || err);
    }
  };

  // Admin Actions
  const handleSaveVacancy = async (updated: Vacancy) => {
    const existing = vacancies.find((v) => v.id === updated.id);
    setVacancies((prev) => {
      const exists = prev.some((v) => v.id === updated.id);
      if (exists) return prev.map((v) => (v.id === updated.id ? updated : v));
      return [updated, ...prev];
    });
    await saveVacancy(updated);
    await syncAllUsersFromFirestoreToServer(adminEmail || undefined);
    await syncVacanciesToServerCatalog([updated], {
      mode: 'merge',
      changedVacancyId: updated.id,
      changedVacancyIds: updated.status === 'published' ? [updated.id] : [],
      changeType: existing ? 'updated' : 'published',
    });
    void maybeAutoPublishVacancyToTelegram(updated, existing);
  };

  const handleBatchSaveVacancies = async (newVacancies: Vacancy[]) => {
    setVacancies((prev) => {
      const map = new Map(prev.map((v) => [v.id, v]));
      newVacancies.forEach((v) => map.set(v.id, v));
      return Array.from(map.values());
    });
    await saveBatchVacancies(newVacancies);
    const publishedIds = newVacancies.filter((v) => v.status === 'published').map((v) => v.id);
    await syncAllUsersFromFirestoreToServer(adminEmail || undefined);
    await syncVacanciesToServerCatalog(newVacancies, {
      mode: 'merge',
      changedVacancyId: publishedIds[0],
      changedVacancyIds: publishedIds,
      changeType: 'published',
    });
  };

  const handleDeleteVacancy = async (id: string) => {
    setVacancies((prev) => prev.filter((v) => v.id !== id));
    await deleteVacancy(id);
    deleteVacanciesFromServerCatalog([id]);
  };

  const handleBatchDeleteVacancies = async (ids: string[]) => {
    setVacancies((prev) => prev.filter((v) => !ids.includes(v.id)));
    await deleteBatchVacancies(ids);
    deleteVacanciesFromServerCatalog(ids);
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
      publishedAt: status === 'published' ? (target.publishedAt || new Date().toISOString()) : target.publishedAt,
      updatedAt: new Date().toISOString(),
    };

    setVacancies((prev) => prev.map((v) => (v.id === id ? updated : v)));
    try {
      await saveVacancy(updated);
      await syncAllUsersFromFirestoreToServer(adminEmail || undefined);
      await syncVacanciesToServerCatalog([updated], {
        mode: 'merge',
        changedVacancyId: updated.id,
        changedVacancyIds: status === 'published' ? [updated.id] : [],
        changeType: status === 'published' ? 'published' : 'updated',
      });
      void maybeAutoPublishVacancyToTelegram(updated, target);
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

  // International Expansion CRUD Handlers
  const handleSaveInternationalJobs = async (items: InternationalJob[]) => {
    setInternationalJobs((prev) => {
      const map = new Map(prev.map((j) => [j.id, j]));
      items.forEach((j) => map.set(j.id, j));
      return Array.from(map.values());
    });
    await saveBatchInternationalJobs(items);
  };

  const handleDeleteInternationalJob = async (id: string) => {
    setInternationalJobs((prev) => prev.filter((j) => j.id !== id));
    await deleteInternationalJob(id);
  };

  const handleSaveImmigrationPathways = async (items: ImmigrationPathway[]) => {
    setImmigrationPathways((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      items.forEach((p) => map.set(p.id, p));
      return Array.from(map.values());
    });
    await saveBatchImmigrationPathways(items);
  };

  const handleDeleteImmigrationPathway = async (id: string) => {
    setImmigrationPathways((prev) => prev.filter((p) => p.id !== id));
    await deleteImmigrationPathway(id);
  };

  const handleSaveExperienceScholarships = async (items: ExperienceScholarship[]) => {
    setExperienceScholarships((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      items.forEach((s) => map.set(s.id, s));
      return Array.from(map.values());
    });
    await saveBatchExperienceScholarships(items);
  };

  const handleDeleteExperienceScholarship = async (id: string) => {
    setExperienceScholarships((prev) => prev.filter((s) => s.id !== id));
    await deleteExperienceScholarship(id);
  };

  const handleSaveResearchRun = async (run: ResearchHistoryRun) => {
    setResearchHistory((prev) => [run, ...prev.filter((r) => r.id !== run.id)].slice(0, 100));
    await saveResearchHistoryRun(run);
  };

  const handleSaveVerificationLogs = async (logs: VerificationReportItem[]) => {
    setVerificationLogs((prev) => {
      const map = new Map(prev.map((l) => [l.id, l]));
      logs.forEach((l) => map.set(l.id, l));
      return Array.from(map.values()).slice(0, 300);
    });
    await saveBatchVerificationLogs(logs);
  };

  const handleSyncInternationalState = (srv: {
    internationalJobs?: InternationalJob[];
    immigrationPathways?: ImmigrationPathway[];
    experienceScholarships?: ExperienceScholarship[];
    researchHistory?: ResearchHistoryRun[];
    verificationLogs?: VerificationReportItem[];
  }) => {
    if (!srv) return;
    if (Array.isArray(srv.internationalJobs)) setInternationalJobs(srv.internationalJobs);
    if (Array.isArray(srv.immigrationPathways)) setImmigrationPathways(srv.immigrationPathways);
    if (Array.isArray(srv.experienceScholarships)) setExperienceScholarships(srv.experienceScholarships);
    if (Array.isArray(srv.researchHistory)) setResearchHistory(srv.researchHistory);
    if (Array.isArray(srv.verificationLogs)) setVerificationLogs(srv.verificationLogs);
  };

  const handleSelectCategoryByName = (categoryName: string) => {
    const meta = OFFICIAL_CATEGORIES.find((c) => c.name === categoryName);
    if (meta) {
      setSelectedCategory(meta);
      setIsAllCategoriesView(false);
      setActiveExpansionView(null);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  // Mandatory profile completeness gate for non-admin signed-in users
  const isMandatoryProfileIncomplete = Boolean(
    currentUser &&
      userProfile &&
      !isOwnerAuthorized &&
      !evaluateMandatoryProfileCompletion(userProfile).isProfileComplete
  );

  const handleSignOutUser = React.useCallback(async () => {
    try {
      await signOut(auth);
    } catch {}
    try {
      localStorage.removeItem('hopelandjobs_current_user');
    } catch {}
    alreadyPromptedThisLoginRef.current = false;
    setCurrentUser(null);
    setUserProfile(null);
    setUserApplications([]);
    setUserNotifications([]);
    setUnreadNotificationsCount(0);
    setNotificationPrefs(null);
    setHasActiveDevicePush(false);
    setIsJobSeekerDashboardOpen(false);
    setAnalyticsUserId(null);
  }, []);

  // Dynamically sync developer's App Logo to favicon, Apple Touch Icon, and Web Manifest via API endpoints
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const versionTag = encodeURIComponent(
      siteSettings.appLogoUpdatedAt || siteSettings.updatedAt || 'default'
    );
    const dynamicFavicon = `/api/pwa-icon/favicon-32x32.png?v=${versionTag}`;
    const dynamicAppleIcon = `/api/pwa-icon/apple-touch-icon.png?v=${versionTag}`;
    const dynamicManifest = `/api/manifest.webmanifest?v=${versionTag}`;

    const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (faviconLink) faviconLink.href = dynamicFavicon;

    const appleLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (appleLink) appleLink.href = dynamicAppleIcon;

    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifestLink) manifestLink.href = dynamicManifest;
  }, [
    siteSettings.appLogoUrl,
    siteSettings.appLogo512Url,
    siteSettings.appLogoMaskable512Url,
    siteSettings.appLogoUpdatedAt,
    siteSettings.updatedAt,
  ]);

  // Direct 1-tap download handler: immediately invokes native OS install prompt on Phone & Computer
  const handleDownloadApplicationClick = React.useCallback(async () => {
    const outcome = await triggerNativeAppInstall();
    if (outcome === 'accepted') {
      setIsMinuteInstallReminderOpen(false);
      setIsInstallPopupOpen(false);
      return;
    }
    if (outcome === 'dismissed') {
      setIsMinuteInstallReminderOpen(false);
      return;
    }
    // Browser doesn't support native beforeinstallprompt (e.g. iOS Safari or preview iframe)
    setIsMinuteInstallReminderOpen(false);
    setIsInstallPopupOpen(true);
  }, [triggerNativeAppInstall]);

  // Show subtle non-blocking official dim-light Download App reminder every 1 minute (60s) until installed
  useEffect(() => {
    if (
      isStandaloneApp ||
      isAdminView ||
      isInstallPopupOpen ||
      isMinuteInstallReminderOpen ||
      isMandatoryProfileIncomplete
    ) {
      return;
    }
    const isBlockedByActiveDialog =
      isUserAuthModalOpen ||
      isAdminAuthModalOpen ||
      isNotificationModalOpen ||
      isAmharicPromoOpen ||
      isJobSeekerDashboardOpen ||
      isApplicationModalOpen ||
      isIosInstallGuideOpen;

    if (isBlockedByActiveDialog) return;

    const timer = setTimeout(() => {
      setIsMinuteInstallReminderOpen(true);
    }, 60_000);

    return () => clearTimeout(timer);
  }, [
    isStandaloneApp,
    isAdminView,
    isInstallPopupOpen,
    isMinuteInstallReminderOpen,
    isMandatoryProfileIncomplete,
    isUserAuthModalOpen,
    isAdminAuthModalOpen,
    isNotificationModalOpen,
    isAmharicPromoOpen,
    isJobSeekerDashboardOpen,
    isApplicationModalOpen,
    isIosInstallGuideOpen,
  ]);

  // Obligate signed-in seekers to fill their mandatory profile before browsing
  useEffect(() => {
    if (
      !isMandatoryProfileIncomplete ||
      !userProfile ||
      isAdminView ||
      isUserAuthModalOpen ||
      isNotificationModalOpen
    ) {
      return;
    }

    setIsAmharicPromoOpen(false);
    setIsInstallPopupOpen(false);

    const hasPersonal = Boolean(
      userProfile.fullName &&
        userProfile.fullName.trim().length >= 2 &&
        userProfile.phone &&
        userProfile.phone.trim().length >= 6 &&
        userProfile.locationCity &&
        userProfile.locationCity.trim().length >= 2
    );
    const hasEducation = Boolean(
      Array.isArray(userProfile.education) && userProfile.education.length > 0
    );
    const hasExpHistory = Boolean(
      userProfile.noExperience === true ||
        (Array.isArray(userProfile.experience) && userProfile.experience.length > 0) ||
        (userProfile.currentPosition && userProfile.currentPosition.trim().length >= 2)
    );

    const nextTab: 'personal' | 'education' | 'experience' | 'professional' = !hasPersonal
      ? 'personal'
      : !hasEducation
      ? 'education'
      : !hasExpHistory
      ? 'experience'
      : 'professional';

    setJobSeekerInitialTab((prev) =>
      prev === 'personal' ||
      prev === 'education' ||
      prev === 'experience' ||
      prev === 'professional'
        ? prev
        : nextTab
    );
    setIsJobSeekerDashboardOpen(true);
  }, [
    isMandatoryProfileIncomplete,
    userProfile,
    isAdminView,
    isUserAuthModalOpen,
    isNotificationModalOpen,
  ]);

  // If in Admin Dashboard view
  if (isAdminView && isOwnerAuthorized) {
    return (
      <Suspense fallback={<PageLoader />}>
        <AdminDashboard
          adminEmail={adminEmail}
          onLogout={async () => {
            await Promise.allSettled([signOut(auth), logoutDeveloperSession()]);
            setAdminEmail(null);
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
          internationalJobs={internationalJobs}
          immigrationPathways={immigrationPathways}
          experienceScholarships={experienceScholarships}
          researchHistory={researchHistory}
          verificationLogs={verificationLogs}
          onSaveInternationalJobs={handleSaveInternationalJobs}
          onDeleteInternationalJob={handleDeleteInternationalJob}
          onSaveImmigrationPathways={handleSaveImmigrationPathways}
          onDeleteImmigrationPathway={handleDeleteImmigrationPathway}
          onSaveExperienceScholarships={handleSaveExperienceScholarships}
          onDeleteExperienceScholarship={handleDeleteExperienceScholarship}
          onSaveResearchRun={handleSaveResearchRun}
          onSaveVerificationLogs={handleSaveVerificationLogs}
          onSyncInternationalState={handleSyncInternationalState}
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
          setActiveExpansionView(null);
          setIsJobSeekerDashboardOpen(false);
          if (typeof window !== 'undefined' && window.location.search.includes('view=')) {
            window.history.pushState({}, 'HOPELAND JOBS', window.location.pathname);
          }
          window.scrollTo({ top: 0, behavior: 'auto' });
        }}
        onOpenAllCategories={() => {
          setIsAllCategoriesView(true);
          setSelectedCategory(null);
          setSelectedLocation(null);
          setActiveExpansionView(null);
          window.scrollTo({ top: 0, behavior: 'auto' });
        }}
        onOpenInternationalJobs={() => handleOpenExpansionView('international-jobs')}
        onOpenImmigration={() => handleOpenExpansionView('immigration')}
        onOpenScholarships={() => handleOpenExpansionView('scholarships')}
        onOpenLocations={() => handleSelectLocation('All')}
        onOpenSavedJobs={() => setIsSavedDrawerOpen(true)}
        savedCount={savedJobIds.size}
        onOpenCvHelp={() => {
          setActiveExpansionView(null);
          setSelectedCategory(null);
          setSelectedLocation(null);
          setIsAllCategoriesView(false);
          setTimeout(() => {
            const el = document.getElementById('cv-assistance-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }}
        onOpenAuth={(mode) => {
          setUserAuthModalMode(mode);
          setIsUserAuthModalOpen(true);
        }}
        onOpenDashboard={() => {
          setJobSeekerInitialTab('overview');
          setIsJobSeekerDashboardOpen(true);
        }}
        onSignOutUser={handleSignOutUser}
        language={language}
        onToggleLanguage={() => setLanguage(language === 'en' ? 'am' : 'en')}
        notifications={userNotifications}
        unreadNotificationsCount={unreadNotificationsCount}
        notificationPrefs={notificationPrefs}
        browserNotificationPermission={browserPerm}
        hasActiveDevicePush={hasActiveDevicePush}
        onMarkNotificationRead={async (notifId, read) => {
          if (!userProfile?.uid) return;
          const res = await markUserNotificationReadServer(userProfile.uid, { notificationId: notifId, read }, userProfile.email);
          setUserNotifications(res.notifications);
          setUnreadNotificationsCount(res.unreadCount);
        }}
        onMarkAllNotificationsRead={async () => {
          if (!userProfile?.uid) return;
          const res = await markUserNotificationReadServer(userProfile.uid, { markAll: true }, userProfile.email);
          setUserNotifications(res.notifications);
          setUnreadNotificationsCount(res.unreadCount);
        }}
        onOpenNotification={(notif) => {
          if (!notif.read && userProfile?.uid) {
            markUserNotificationReadServer(userProfile.uid, { notificationId: notif.id, read: true }, userProfile.email)
              .then((res) => {
                setUserNotifications(res.notifications);
                setUnreadNotificationsCount(res.unreadCount);
              })
              .catch(() => {});
          }
          if (Array.isArray(notif.topJobs) && notif.topJobs.length > 1) {
            setJobSeekerInitialTab('recommendations');
            setIsJobSeekerDashboardOpen(true);
            return;
          }
          const matchedVac = vacancies.find((v) => v.id === notif.vacancyId);
          if (matchedVac) {
            handleSelectVacancy(matchedVac);
          } else if (notif.applicationUrl || notif.jobUrl) {
            window.open(notif.applicationUrl || notif.jobUrl, '_blank', 'noopener,noreferrer');
          }
        }}
        onOpenNotificationPreferences={() => {
          setJobSeekerInitialTab('notifications');
          setIsJobSeekerDashboardOpen(true);
        }}
        onPromptEnableNotifications={() => {
          setNotificationModalReason(browserPerm === 'denied' ? 'blocked_in_browser' : 'not_enabled_yet');
          setIsNotificationModalOpen(true);
        }}
        canInstallApp={canInstallNativeApp}
        canShowIosInstallGuide={canShowIosInstallGuide}
        isStandaloneApp={isStandaloneApp}
        onInstallApp={handleDownloadApplicationClick}
        onOpenIosInstallGuide={() => setIsInstallPopupOpen(true)}
        onOpenDownloadApplication={handleDownloadApplicationClick}
        isOnline={isOnline}
        isSyncingReconnect={isSyncingReconnect}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeExpansionView === 'international-jobs' ? (
          <Suspense fallback={<PageLoader />}>
            <InternationalJobsView
              jobs={internationalJobs}
              onBack={() => handleOpenExpansionView(null)}
              userProfile={userProfile}
              onOpenAuth={() => {
                setUserAuthModalMode('signin');
                setIsUserAuthModalOpen(true);
              }}
              onOpenProfile={() => {
                setJobSeekerInitialTab('professional');
                setIsJobSeekerDashboardOpen(true);
              }}
            />
          </Suspense>
        ) : activeExpansionView === 'immigration' ? (
          <Suspense fallback={<PageLoader />}>
            <ImmigrationResidenceView
              pathways={immigrationPathways}
              onBack={() => handleOpenExpansionView(null)}
            />
          </Suspense>
        ) : activeExpansionView === 'scholarships' ? (
          <Suspense fallback={<PageLoader />}>
            <ScholarshipsView
              scholarships={experienceScholarships}
              onBack={() => handleOpenExpansionView(null)}
            />
          </Suspense>
        ) : isAllCategoriesView ? (
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
              userProfile={userProfile}
              onOpenAuth={() => {
                setUserAuthModalMode('signin');
                setIsUserAuthModalOpen(true);
              }}
              onOpenProfile={() => {
                setJobSeekerInitialTab('professional');
                setIsJobSeekerDashboardOpen(true);
              }}
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
              userProfile={userProfile}
            />
          </Suspense>
        ) : (
          /* HOMEPAGE (Clean Ethiojobs-inspired HopelandJobs Layout) */
          <>
            {/* 1. CLEAN WHITE HERO & ROUNDED SEARCH SECTION */}
            <section className="relative bg-white overflow-hidden pt-14 pb-16 sm:pt-24 sm:pb-24 px-4 sm:px-6 lg:px-8">
              {/* Subtle Illustrated Backdrop Graphic around edges, pure white center */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-55"
              >
                <img
                  src={heroCareerBackdropImg}
                  alt=""
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/35 to-white" />
              </div>

              <div className="relative z-10 max-w-4xl mx-auto">
                {/* Clean minimal Jobs / Companies tabs above the search bar */}
                <div
                  role="tablist"
                  aria-label="Search type"
                  className="flex items-center justify-center gap-6 mb-5"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={searchTab === 'jobs'}
                    onClick={() => setSearchTab('jobs')}
                    className={`pb-2 text-sm sm:text-base font-bold transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
                      searchTab === 'jobs'
                        ? 'border-[#16A34A] text-[#0B132B]'
                        : 'border-transparent text-slate-500 hover:text-[#0B132B]'
                    }`}
                  >
                    Jobs
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={searchTab === 'companies'}
                    onClick={() => setSearchTab('companies')}
                    className={`pb-2 text-sm sm:text-base font-bold transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
                      searchTab === 'companies'
                        ? 'border-[#16A34A] text-[#0B132B]'
                        : 'border-transparent text-slate-500 hover:text-[#0B132B]'
                    }`}
                  >
                    Companies
                  </button>
                </div>

                {/* Prominent Rounded Search Bar */}
                <form
                  onSubmit={handleHeroSearchSubmit}
                  className="bg-white rounded-full p-2 sm:p-2.5 shadow-[0_10px_36px_rgba(11,19,43,0.08)] border border-slate-200/90 focus-within:border-[#16A34A] focus-within:ring-4 focus-within:ring-[#16A34A]/10 transition-all flex items-center gap-2"
                >
                  <div className="relative flex-1 min-w-0 flex items-center pl-3 sm:pl-4">
                    <Search className="w-5 h-5 text-slate-400 shrink-0 mr-2.5" />
                    <input
                      type="text"
                      value={heroSearch}
                      onChange={(e) => {
                        setHeroSearch(e.target.value);
                        if (aiSearchResult) setAiSearchResult(null);
                        if (aiSearchError) setAiSearchError(null);
                      }}
                      placeholder={
                        searchTab === 'jobs'
                          ? 'Job title, keywords, or skills...'
                          : 'Search companies in Ethiopia (e.g. CBE, Airlines, UNICEF)...'
                      }
                      aria-label={searchTab === 'jobs' ? 'Search jobs' : 'Search companies'}
                      className="w-full py-2 sm:py-2.5 bg-transparent text-sm sm:text-base text-[#0B132B] placeholder:text-slate-400 outline-none font-medium"
                    />
                  </div>

                  {/* Clean desktop location selector inside the rounded bar when on Jobs tab */}
                  {searchTab === 'jobs' && (
                    <div className="hidden md:flex items-center border-l border-slate-200 pl-3 pr-1 max-w-[185px]">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mr-1.5" />
                      <select
                        value={heroLocation}
                        onChange={(e) => setHeroLocation(e.target.value)}
                        aria-label="Filter by location"
                        className="w-full py-2 bg-transparent text-xs sm:text-sm font-medium text-slate-600 outline-none cursor-pointer truncate"
                      >
                        <option value="All">All Ethiopia</option>
                        {ETHIOPIAN_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-full bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-sm transition-colors shrink-0 cursor-pointer shadow-sm"
                  >
                    Search
                  </button>
                </form>

                {/* Mobile-only compact location selector */}
                {searchTab === 'jobs' && (
                  <div className="mt-3 flex md:hidden justify-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-[#16A34A]" />
                      <select
                        value={heroLocation}
                        onChange={(e) => setHeroLocation(e.target.value)}
                        aria-label="Filter by location mobile"
                        className="bg-transparent font-medium outline-none cursor-pointer"
                      >
                        <option value="All">All Ethiopia</option>
                        {ETHIOPIAN_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 2. TRUSTED BY ETHIOPIAN COMPANIES CAROUSEL (Right-to-Left Infinite Scroll) */}
            <TrustedCompaniesCarousel onSelectCompany={handleSelectCompanyFromShowcase} />

            {/* 3. SEARCH RESULTS SECTION (Shown when visitor searches or clicks a company) */}
            {(heroSearch.trim().length > 0 ||
              heroLocation !== 'All' ||
              heroSector !== 'All' ||
              aiSearchResult !== null ||
              searchTriggered) && (
              <section
                id="search-results"
                className="bg-white py-10 px-4 sm:px-6 lg:px-8 border-t border-slate-100"
              >
                <div className="max-w-7xl mx-auto">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#16A34A] mb-1">
                        {aiSearchResult ? (
                          <Sparkles className="w-3.5 h-3.5 text-[#16A34A]" />
                        ) : (
                          <Search className="w-3.5 h-3.5 text-[#16A34A]" />
                        )}
                        <span>
                          {aiSearchResult
                            ? 'AI Smart Search Results'
                            : searchTab === 'companies'
                              ? 'Companies & Open Vacancies'
                              : 'Job Search Results'}
                        </span>
                      </div>
                      <h2 className="text-2xl font-bold text-[#0B132B]">
                        {searchTab === 'companies'
                          ? `Matching Companies (${matchingCompanies.length}) · Vacancies (${displayedHomepageVacancies.length})`
                          : `Matching Vacancies (${displayedHomepageVacancies.length})`}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        {heroSearch.trim()
                          ? `Showing results for "${heroSearch.trim()}" across Ethiopia.`
                          : 'Showing active verified listings across Ethiopia.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      {hasExpSignals && searchTab === 'jobs' && (
                        <button
                          type="button"
                          onClick={() => setSearchExperienceOnly((prev) => !prev)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            searchExperienceOnly
                              ? 'bg-[#0B132B] text-white'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {searchExperienceOnly ? 'Showing Experience Matches' : 'Experience Matches Only'}
                          </span>
                        </button>
                      )}
                      {searchTab === 'jobs' && heroSearch.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={handleAiSmartSearch}
                          disabled={isAiSearching}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-xs transition-colors cursor-pointer"
                        >
                          {isAiSearching ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4ADE80]" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-[#4ADE80]" />
                          )}
                          <span>{isAiSearching ? 'Matching...' : 'AI Smart Search'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleClearHomepageSearch}
                        className="text-xs font-semibold text-slate-600 hover:text-[#0B132B] bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        Clear Search
                      </button>
                    </div>
                  </div>

                  {aiSearchError && (
                    <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                      {aiSearchError}
                    </div>
                  )}

                  {aiSearchResult && (
                    <div className="mb-6 p-4 rounded-2xl bg-[#0B132B] text-white border border-slate-800 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#4ADE80]">
                          <Sparkles className="w-4 h-4" />
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
                        <p className="text-[11px] text-[#4ADE80] font-medium">
                          Tip: {aiSearchResult.searchTip}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Companies Grid when Companies tab is active */}
                  {searchTab === 'companies' && (
                    <div className="mb-8">
                      {matchingCompanies.length === 0 ? (
                        <div className="bg-[#F5F7FA] rounded-2xl p-8 text-center border border-slate-200">
                          <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <p className="text-sm font-bold text-[#0B132B]">
                            No partner organizations matched "{heroSearch.trim()}"
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Try searching another Ethiopian company name or browse all featured employers below.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {matchingCompanies.map((company) => (
                            <div
                              key={company.id}
                              onClick={() => handleSelectCompanyFromShowcase(company)}
                              className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-[#16A34A] hover:shadow-md transition-all cursor-pointer flex items-start gap-4"
                            >
                              <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200/80 p-2 flex items-center justify-center shrink-0">
                                <img
                                  src={company.logoUrl}
                                  alt={company.name}
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  className="max-h-full max-w-full w-auto h-auto object-contain"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-[#0B132B] truncate">
                                  {company.name}
                                </h3>
                                <p className="text-xs text-slate-500 truncate mt-0.5">{company.sector}</p>
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 truncate">
                                  <MapPin className="w-3 h-3 text-[#16A34A] shrink-0" />
                                  <span className="truncate">{company.location}</span>
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vacancies Grid */}
                  {displayedHomepageVacancies.length === 0 ? (
                    <div className="bg-[#F5F7FA] rounded-2xl p-10 text-center border border-slate-200 space-y-3">
                      <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />
                      <h4 className="font-bold text-[#0B132B] text-sm">
                        No open vacancies matched this filter right now
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Try searching by another keyword, click AI Smart Search for semantic matching, or explore the 16 official categories below.
                      </p>
                      <button
                        type="button"
                        onClick={handleClearHomepageSearch}
                        className="px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-xs cursor-pointer transition-colors"
                      >
                        Reset Search
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {displayedHomepageVacancies.map((vac) => {
                        const days = getDaysLeft(vac.applicationDeadline);
                        const isSaved = savedJobIds.has(vac.id);
                        const expMatch = vacancyExperienceMap.get(vac.id);
                        return (
                          <div
                            key={vac.id}
                            className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-[#16A34A] hover:shadow-md transition-all flex flex-col justify-between"
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                                <span className="font-semibold text-[#16A34A] truncate">
                                  {vac.category}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleSaveJob(vac.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 transition-colors shrink-0 cursor-pointer"
                                  title="Save job"
                                >
                                  <Heart className={`w-4 h-4 ${isSaved ? 'text-rose-500 fill-current' : ''}`} />
                                </button>
                              </div>

                              {expMatch?.isMatch && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                                    expMatch.matchType === 'direct'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-sky-50 text-sky-800 border border-sky-200'
                                  }`}
                                >
                                  <Sparkles className="w-3 h-3 shrink-0" />
                                  <span>{expMatch.badgeLabel}</span>
                                </span>
                              )}

                              <h3
                                onClick={() => handleSelectVacancy(vac)}
                                className="font-bold text-base text-[#0B132B] hover:text-[#16A34A] transition-colors cursor-pointer line-clamp-1"
                              >
                                {vac.title}
                              </h3>

                              <p className="text-xs text-slate-600 font-semibold truncate flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{vac.organization}</span>
                              </p>

                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 pt-1">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-[#16A34A]" />
                                  {vac.location}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="text-slate-600 font-medium">
                                  {vac.employmentType || 'Full-time'}
                                </span>
                              </div>
                            </div>

                            <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-4 text-xs">
                              <span className="text-xs text-slate-500 font-medium flex items-center gap-1 tabular-nums">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {days.text}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSelectVacancy(vac)}
                                className="px-4 py-1.5 rounded-xl font-semibold text-xs bg-[#16A34A] hover:bg-[#15803D] text-white transition-colors cursor-pointer"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 4. TOP CATEGORIES SECTION (Light Grey #F5F7FA) */}
            <section
              id="categories-section"
              aria-label="Top Categories"
              className="bg-[#F5F7FA] py-14 sm:py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-200/70"
            >
              <div className="max-w-7xl mx-auto">
                <div className="text-center max-w-2xl mx-auto mb-10">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B132B]">
                    Top Categories
                  </h2>
                  <p className="text-sm text-slate-500 mt-2">
                    Explore verified Ethiopian career opportunities across banking, NGOs, diplomacy, IT, health, and corporate industries.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                  {OFFICIAL_CATEGORIES.slice(0, 12).map((cat) => {
                    const count = activeCountMap.get(cat.name) || 0;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategoryByName(cat.name)}
                        className="group bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-[#16A34A] hover:shadow-md transition-all text-left flex items-start gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
                      >
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#16A34A] group-hover:bg-[#16A34A] group-hover:text-white transition-colors flex items-center justify-center shrink-0">
                          <CategoryIcon iconName={cat.iconName} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-[#0B132B] group-hover:text-[#16A34A] transition-colors line-clamp-2 leading-snug">
                            {cat.name}
                          </h3>
                          {cat.amharicName && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                              {cat.amharicName}
                            </p>
                          )}
                          <p className="text-xs font-semibold text-slate-500 mt-1.5 tabular-nums">
                            {count} {count === 1 ? 'Open Job' : 'Open Jobs'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-9 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAllCategoriesView(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white hover:bg-[#16A34A] text-[#0B132B] hover:text-white border border-slate-200 hover:border-[#16A34A] font-semibold text-sm shadow-xs transition-all cursor-pointer"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span>Explore All 16 Categories</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>

            {/* LOCAL JOBS FOR YOUR EXPERIENCE + SEE ALL TOGGLE (Rendered when signed in) */}
            {userProfile && (
              <section className="bg-white py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-100">
                <div className="max-w-7xl mx-auto">
                  <div className="rounded-3xl p-6 sm:p-8 border border-emerald-200 bg-emerald-50/40 space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#16A34A] mb-1">
                          <Sparkles className="w-4 h-4" />
                          <span>Experience-First Local Career Matches</span>
                        </div>
                        <h2 className="text-2xl font-bold text-[#0B132B]">
                          {homepageLocalMode === 'experience' && hasExpSignals
                            ? 'Local Jobs Based on Your Experience'
                            : 'All Local Jobs Across Ethiopia'}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                          {hasExpSignals ? (
                            <>
                              Prioritizing opportunities matching{' '}
                              <strong className="text-[#15803D]">
                                {userProfile.currentPosition || userProfile.desiredJobTitle || userProfile.preferredIndustry || 'your profession'}
                              </strong>{' '}
                              and closely related career fields first (e.g. Banking ↔ Finance).
                            </>
                          ) : (
                            'Add your work experience & expertise to filter local jobs tailored to your profession and related fields first.'
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
                        {hasExpSignals && (
                          <>
                            <button
                              type="button"
                              onClick={() => setHomepageLocalMode('experience')}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                homepageLocalMode === 'experience'
                                  ? 'bg-[#0B132B] text-white shadow-xs'
                                  : 'bg-white border border-emerald-200 text-slate-700 hover:border-[#16A34A]'
                              }`}
                            >
                              <Sparkles className={`w-3.5 h-3.5 ${homepageLocalMode === 'experience' ? 'text-amber-400' : 'text-[#16A34A]'}`} />
                              <span>Your Experience ({localExperienceMatchedVacancies.length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setHomepageLocalMode('all')}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                homepageLocalMode === 'all'
                                  ? 'bg-[#16A34A] text-white shadow-xs'
                                  : 'bg-white border border-emerald-200 text-slate-700 hover:border-[#16A34A]'
                              }`}
                            >
                              <Globe className="w-3.5 h-3.5" />
                              <span>See All Local Jobs ({publishedVacancies.length})</span>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setJobSeekerInitialTab('professional');
                            setIsJobSeekerDashboardOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-emerald-200 hover:border-[#16A34A] text-[#0B132B] font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          <span>Update Experience</span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#16A34A]" />
                        </button>
                      </div>
                    </div>

                    {(() => {
                      const orderedAllLocal = [...publishedVacancies].sort((a, b) => {
                        const ma = vacancyExperienceMap.get(a.id);
                        const mb = vacancyExperienceMap.get(b.id);
                        const aMatch = ma?.isMatch ? 1 : 0;
                        const bMatch = mb?.isMatch ? 1 : 0;
                        if (aMatch !== bMatch) return bMatch - aMatch;
                        if (ma?.isMatch && mb?.isMatch) return mb.score - ma.score;
                        return 0;
                      });

                      const activeList =
                        homepageLocalMode === 'experience' && hasExpSignals
                          ? localExperienceMatchedVacancies
                          : orderedAllLocal;

                      const recById = new Map(recommendedVacancies.map((r) => [r.id, r]));

                      if (!hasExpSignals) {
                        return (
                          <div className="bg-white rounded-2xl p-8 text-center border border-emerald-100 space-y-2">
                            <Briefcase className="w-8 h-8 text-[#16A34A] mx-auto" />
                            <p className="text-xs font-bold text-[#0B132B]">
                              Add your work experience, job title, and expertise to see matched &amp; related-field local jobs first
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setJobSeekerInitialTab('professional');
                                  setIsJobSeekerDashboardOpen(true);
                                }}
                                className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Add Experience &amp; Expertise
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSelectLocation('All')}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#0B132B] rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Browse All {publishedVacancies.length} Local Jobs
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (activeList.length === 0) {
                        return (
                          <div className="bg-white rounded-2xl p-8 text-center border border-emerald-100 space-y-3">
                            <Briefcase className="w-8 h-8 text-[#16A34A] mx-auto" />
                            <p className="text-xs font-bold text-[#0B132B]">
                              No local vacancies currently match your experience fields
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              {publishedVacancies.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setHomepageLocalMode('all')}
                                  className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                                >
                                  See All {publishedVacancies.length} Local Jobs
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setJobSeekerInitialTab('professional');
                                  setIsJobSeekerDashboardOpen(true);
                                }}
                                className="px-4 py-2 bg-white border border-slate-200 hover:border-[#16A34A] text-[#0B132B] rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Refine Job Title &amp; Sectors
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const visibleList = showAllHomepageLocal ? activeList : activeList.slice(0, 6);

                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {visibleList.map((vac) => {
                              const days = getDaysLeft(vac.applicationDeadline);
                              const isSaved = savedJobIds.has(vac.id);
                              const expMatch = vacancyExperienceMap.get(vac.id);
                              const rec = recById.get(vac.id);
                              return (
                                <div
                                  key={vac.id}
                                  className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-[#16A34A] shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                  <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap text-xs">
                                          {expMatch?.isMatch && (
                                            <span
                                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                                expMatch.matchType === 'direct'
                                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                  : 'bg-sky-50 text-sky-800 border border-sky-200'
                                              }`}
                                            >
                                              <Sparkles className="w-3 h-3" />
                                              <span>{expMatch.badgeLabel}</span>
                                            </span>
                                          )}
                                          {rec && (
                                            <span className="font-bold font-mono tabular-nums text-[#16A34A]">
                                              {rec.matchScore}% Match
                                            </span>
                                          )}
                                          <span className="text-slate-600 font-medium">{vac.category}</span>
                                        </div>
                                        <h3
                                          onClick={() => handleSelectVacancy(vac)}
                                          className="text-base font-bold text-[#0B132B] hover:text-[#16A34A] transition-colors cursor-pointer line-clamp-1 pt-0.5"
                                        >
                                          {vac.title}
                                        </h3>
                                        <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                          <Building className="w-3.5 h-3.5 text-slate-400" />
                                          <span>{vac.organization}</span>
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleSaveJob(vac.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors shrink-0 cursor-pointer"
                                        title={isSaved ? 'Remove' : 'Save'}
                                      >
                                        <Heart className={`w-4 h-4 ${isSaved ? 'text-rose-500 fill-current' : ''}`} />
                                      </button>
                                    </div>

                                    {rec && rec.matchReasons.length > 0 && (
                                      <div className="text-xs text-[#15803D] font-medium line-clamp-1">
                                        Why it matches: {rec.matchReasons.slice(0, 2).join(' · ')}
                                      </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                      <span className="flex items-center gap-1 truncate">
                                        <MapPin className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                                        <span className="truncate">{vac.location}</span>
                                      </span>
                                      <span aria-hidden="true" className="text-slate-300">·</span>
                                      <span className="flex items-center gap-1 truncate tabular-nums">
                                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{days.text}</span>
                                      </span>
                                    </div>
                                  </div>

                                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-4 text-xs">
                                    <span className="text-xs font-semibold text-[#15803D] truncate max-w-[160px]">
                                      {vac.salary || 'Salary negotiable'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectVacancy(vac)}
                                      className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white transition-colors cursor-pointer"
                                    >
                                      View Details
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {activeList.length > 6 && (
                            <div className="text-center pt-2">
                              <button
                                type="button"
                                onClick={() => setShowAllHomepageLocal((prev) => !prev)}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white border border-emerald-200 hover:border-[#16A34A] text-xs font-bold text-[#0B132B] cursor-pointer shadow-xs transition-colors"
                              >
                                <span>
                                  {showAllHomepageLocal
                                    ? 'Show Fewer'
                                    : `Show All ${activeList.length} ${homepageLocalMode === 'experience' ? 'Experience Matches' : 'Local Jobs'}`}
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 text-[#16A34A]" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </section>
            )}

            {/* 5. FEATURED COMPANIES SLIDER SECTION (Blue Background #1E40AF-#0F3D8A) */}
            <FeaturedCompaniesCarousel
              vacancies={publishedVacancies}
              onSelectCompany={handleSelectCompanyFromShowcase}
              onViewAllCompanies={handleViewAllFeaturedCompanies}
            />

            {/* 6. HOW HOPELANDJOBS WORKS SECTION (Light Grey #F5F7FA) */}
            <section
              aria-label="How HopelandJobs Works"
              className="bg-[#F5F7FA] py-14 sm:py-16 px-4 sm:px-6 lg:px-8"
            >
              <div className="max-w-6xl mx-auto">
                <div className="text-center max-w-2xl mx-auto mb-10">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B132B]">
                    How HopelandJobs Works
                  </h2>
                  <p className="text-sm text-slate-500 mt-2">
                    Find verified Ethiopian careers, organize your application documents, and receive real-time job alerts tailored to your profile.
                  </p>
                </div>

                {/* Large Centered Clean Illustration */}
                {!howWorksImgError ? (
                  <div className="max-w-4xl mx-auto mb-10 rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-sm">
                    <img
                      src={howHopelandWorksImg}
                      alt="How HopelandJobs works across job discovery, CV profile readiness, and alerts"
                      onError={() => setHowWorksImgError(true)}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                ) : null}

                {/* Concise 3-Step Horizontal Flow */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16A34A] flex items-center justify-center font-bold text-sm tabular-nums">
                      01
                    </div>
                    <h3 className="text-base font-bold text-[#0B132B]">
                      Search Verified Jobs
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Browse genuine job announcements across Ethiopia’s top banks, NGOs, UN agencies, airlines, and corporate employers with confirmed deadlines.
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E40AF] flex items-center justify-center">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-[#0B132B]">
                      Build Profile &amp; CV Vault
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Save your education, work history, CV, and supporting credentials securely once so you are always ready to apply directly.
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16A34A] flex items-center justify-center">
                      <BellRing className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-[#0B132B]">
                      Get Matched &amp; Apply
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Receive instant alerts when vacancies matching your qualifications and preferred sectors open, with direct official employer application links.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 7. CV & APPLICATION ADVISOR + ABOUT HOPELANDJOBS (Restrained White Section) */}
            <section
              id="cv-assistance-section"
              className="bg-white py-14 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80"
            >
              <div className="max-w-7xl mx-auto space-y-10">
                <div className="bg-[#F5F7FA] rounded-3xl p-6 sm:p-10 border border-slate-200/80 space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                      <h2 className="text-2xl sm:text-3xl font-bold text-[#0B132B]">
                        CV &amp; Application Assistance
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        Applying for banking positions at CBE or Awash, UN agencies like UNICEF, or corporate roles in Addis Ababa? Prepare your application documents to match official Ethiopian recruitment standards.
                      </p>

                      <div className="space-y-2 text-xs sm:text-sm text-slate-700 font-medium">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                          <span>Tailored cover letter &amp; interview tips on every vacancy.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                          <span>Document checklists (Degree, Official Transcript, National ID).</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                          <span>Direct employer submission portals — zero application fees.</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                      <h3 className="text-xs font-bold text-[#0B132B] uppercase tracking-wider">
                        Standard Ethiopian Application Checklist
                      </h3>
                      <div className="space-y-2 text-xs text-slate-700">
                        <div className="p-2.5 rounded-xl bg-[#F5F7FA] border border-slate-200/70 flex items-center justify-between">
                          <span>1. Professional CV (Chronological format)</span>
                          <span className="text-[#16A34A] font-semibold">Standard</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#F5F7FA] border border-slate-200/70 flex items-center justify-between">
                          <span>2. Tailored Application Letter referencing Ref #</span>
                          <span className="text-[#16A34A] font-semibold">Essential</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#F5F7FA] border border-slate-200/70 flex items-center justify-between">
                          <span>3. University Degree &amp; Official Student Copy</span>
                          <span className="text-[#16A34A] font-semibold">Required</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#F5F7FA] border border-slate-200/70 flex items-center justify-between">
                          <span>4. Renewed National ID (Fayda / Kebele ID)</span>
                          <span className="text-[#16A34A] font-semibold">Verified</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Ask Hopeland AI Career & CV Advisor */}
                  <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#16A34A] text-white flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#0B132B]">
                          Hopeland AI Career &amp; CV Advisor
                        </h3>
                        <p className="text-xs text-slate-500">
                          Instant guidance tailored for Ethiopian banks, NGOs, and corporate employers.
                        </p>
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
                          className="px-3 py-1.5 rounded-xl bg-[#F5F7FA] hover:bg-emerald-50 border border-slate-200 hover:border-[#16A34A]/50 text-[#0B132B] font-semibold text-xs transition-colors cursor-pointer"
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
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-[#0B132B] outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
                      />
                      <button
                        type="button"
                        onClick={() => handleAskCareerCoach()}
                        disabled={isCareerCoachLoading || !careerQuestion.trim()}
                        className="px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
                      >
                        {isCareerCoachLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span>{isCareerCoachLoading ? 'Thinking...' : 'Ask Advisor'}</span>
                      </button>
                    </div>

                    {careerCoachError && (
                      <p className="text-xs text-rose-600 font-medium">{careerCoachError}</p>
                    )}

                    {careerCoachAdvice && (
                      <div className="p-4 rounded-xl bg-[#F5F7FA] border border-slate-200 space-y-3 text-xs sm:text-sm">
                        <div className="font-bold text-[#0B132B]">Career Guidance</div>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                          {careerCoachAdvice.adviceAnswer}
                        </p>
                        {careerCoachAdvice.profileStrengthTips?.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <div className="text-xs font-bold uppercase text-[#16A34A]">
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

                {/* Clean About HopelandJobs Summary */}
                <div
                  id="about-section"
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-4"
                >
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#16A34A]">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verified Quality Promise</span>
                    </div>
                    <h2 className="text-2xl font-bold text-[#0B132B]">About HOPELAND JOBS</h2>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {siteSettings.aboutText ||
                        'HOPELAND JOBS is Ethiopia’s trusted, verified recruitment information portal connecting professionals with genuine opportunities across banking, NGOs, embassies, aviation, hospitality, corporate organizations, and international career pathways.'}
                    </p>
                  </div>

                  <div className="bg-[#F5F7FA] p-6 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs sm:text-sm text-slate-700">
                    <div className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                      <span><strong>Verified Vacancies:</strong> Confirmed deadlines and official employers.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                      <span><strong>Direct Portals:</strong> Zero hidden third-party application fees.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                      <span><strong>Instant Alerts:</strong> Personalized notifications when matching roles open.</span>
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
        onOpenInternationalJobs={() => handleOpenExpansionView('international-jobs')}
        onOpenImmigration={() => handleOpenExpansionView('immigration')}
        onOpenScholarships={() => handleOpenExpansionView('scholarships')}
      />

      {/* User Auth Modal (Sign In / Register / Google / Forgot Password) */}
      {isUserAuthModalOpen && (
        <Suspense fallback={null}>
          <UserAuthModal
            key={`user-auth-${userAuthModalMode}-${isUserAuthModalOpen}`}
            isOpen={isUserAuthModalOpen}
            appLogoUrl={siteSettings.appLogoUrl}
            initialMode={userAuthModalMode}
            onClose={() => setIsUserAuthModalOpen(false)}
            onSuccess={async (user, profile) => {
              setIsAmharicPromoOpen(false);
              const signedUpMode = userAuthModalMode === 'signup';
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
              let resolvedProfile = profile || null;
              if (user?.uid) {
                try {
                  const [p, apps] = await Promise.all([
                    profile ? Promise.resolve(profile) : fetchJobSeekerProfile(user.uid),
                    fetchUserApplications(user.uid),
                  ]);
                  if (p) {
                    setUserProfile(p);
                    resolvedProfile = p;
                  }
                  setUserApplications(apps);
                  await hydrateUserNotificationsAndPrompt(user.uid, user.email, true);
                } catch {}
              } else if (profile?.uid) {
                await hydrateUserNotificationsAndPrompt(profile.uid, profile.email, true);
              }
              if (applyTargetVacancy) {
                setIsApplicationModalOpen(true);
              } else if (
                signedUpMode ||
                (resolvedProfile && !evaluateMandatoryProfileCompletion(resolvedProfile).isProfileComplete)
              ) {
                setJobSeekerInitialTab('professional');
                setIsJobSeekerDashboardOpen(true);
              }
            }}
          />
        </Suspense>
      )}

      {/* Amharic Job Registration & Daily Push Notification Promotion Popup (Unregistered Visitors) */}
      {isAmharicPromoOpen && !currentUser && (
        <AmharicSignupPromoModal
          isOpen={isAmharicPromoOpen}
          appLogoUrl={siteSettings.appLogoUrl}
          hasActiveDevicePush={hasActiveDevicePush}
          onClose={(dismissed) => {
            setIsAmharicPromoOpen(false);
            if (dismissed) {
              recordAmharicSignupPromoDismissed();
            }
          }}
          onSignUpClick={() => {
            setIsAmharicPromoOpen(false);
            recordAmharicSignupPromoDismissed();
            setUserAuthModalMode('signup');
            setIsUserAuthModalOpen(true);
          }}
          onNotificationsEnabled={() => {
            setBrowserPerm('granted');
            setHasActiveDevicePush(true);
          }}
        />
      )}

      {/* Automatic Visitor & Account Notification Opt-In Modal */}
      {isNotificationModalOpen && (
        <NotificationPermissionModal
          isOpen={isNotificationModalOpen}
          uid={userProfile?.uid || null}
          userEmail={userProfile?.email || null}
          appLogoUrl={siteSettings.appLogoUrl}
          reason={notificationModalReason}
          initialEmailAlerts={false}
          onClose={(dismissed) => {
            setIsNotificationModalOpen(false);
            if (dismissed) {
              recordNotificationPromptDismissal(
                userProfile?.uid || null,
                userProfile?.email || null
              )
                .then((p) => {
                  if (p) setNotificationPrefs(p);
                })
                .catch(() => {});
            }
          }}
          onEnabled={async (prefs) => {
            if (prefs) setNotificationPrefs(prefs);
            setIsNotificationModalOpen(false);
            setBrowserPerm('granted');
            setHasActiveDevicePush(true);
            if (userProfile?.uid) {
              const health = await checkCurrentDevicePushHealth(
                userProfile.uid,
                prefs,
                userProfile.email
              );
              setBrowserPerm(health.browserPermission);
              setHasActiveDevicePush(health.hasActiveSubscriptionOnThisDevice);
              const fresh = await fetchUserNotificationsServer(userProfile.uid, userProfile.email);
              setUserNotifications(fresh.notifications);
              setUnreadNotificationsCount(fresh.unreadCount);
              await dispatchLocalServiceWorkerPushFallback(
                userProfile.uid,
                fresh.notifications,
                prefs || notificationPrefs
              ).catch(() => 0);
            }
          }}
        />
      )}

      {/* Job Seeker Profile & Dashboard Modal */}
      {isJobSeekerDashboardOpen && userProfile && (
        <Suspense fallback={null}>
          <JobSeekerDashboard
            profile={userProfile}
            applications={userApplications}
            savedVacancies={savedVacanciesList}
            vacancies={vacancies}
            internationalJobs={internationalJobs}
            experienceScholarships={experienceScholarships}
            initialTab={jobSeekerInitialTab}
            notifications={userNotifications}
            unreadNotificationsCount={unreadNotificationsCount}
            notificationPrefs={notificationPrefs}
            browserNotificationPermission={browserPerm}
            hasActiveDevicePush={hasActiveDevicePush}
            mandatoryLock={isMandatoryProfileIncomplete}
            onSignOut={handleSignOutUser}
            onClose={() => {
              if (!isMandatoryProfileIncomplete) {
                setIsJobSeekerDashboardOpen(false);
                setJobSeekerInitialTab('overview');
              }
            }}
            onUpdateProfile={async (updated) => {
              await saveJobSeekerProfile(updated);
              setUserProfile(updated);

              let latestPrefs = notificationPrefs;
              let pushActiveNow = hasActiveDevicePush;
              const isNowMandatoryComplete =
                evaluateMandatoryProfileCompletion(updated).isProfileComplete;
              const hasPrefFields = hasCompletedMandatoryPreferences(updated);

              // Automatically enable phone bar push once mandatory fields are complete (unless user manually disabled it)
              if ((isNowMandatoryComplete || hasPrefFields) && latestPrefs?.manuallyDisabled !== true) {
                if (!pushActiveNow && getBrowserNotificationPermission() !== 'denied') {
                  const pushInit = await requestAndEnableNotifications(updated.uid, {
                    emailAlerts: false,
                    websiteBell: true,
                    email: updated.email,
                  }).catch(() => null);
                  if (pushInit?.preferences) {
                    latestPrefs = pushInit.preferences;
                    setNotificationPrefs(pushInit.preferences);
                  }
                  if (pushInit?.permissionStatus) {
                    setBrowserPerm(pushInit.permissionStatus);
                  }
                  if (pushInit?.subscriptionActive) {
                    pushActiveNow = true;
                    setHasActiveDevicePush(true);
                  }
                }
              }

              // Recalculate personalized recommendations and dispatch eligible job alerts (max 3 strictly qualified jobs)
              await recalculateUserRecommendationsServer(updated.uid, updated.email, true).catch(() => null);
              const fresh = await fetchUserNotificationsServer(updated.uid, updated.email);
              setUserNotifications(fresh.notifications);
              setUnreadNotificationsCount(fresh.unreadCount);
              if (latestPrefs?.manuallyDisabled !== true && fresh.notifications.length > 0) {
                await dispatchLocalServiceWorkerPushFallback(
                  updated.uid,
                  fresh.notifications,
                  latestPrefs
                ).catch(() => 0);
              }

              // If mandatory profile just completed and phone bar alerts still need permission/activation, prompt right away
              if (
                isNowMandatoryComplete &&
                !pushActiveNow &&
                latestPrefs?.manuallyDisabled !== true
              ) {
                const livePerm = getBrowserNotificationPermission();
                setNotificationModalReason(
                  isIosSafariNeedsInstall()
                    ? 'ios_install_required'
                    : livePerm === 'denied'
                    ? 'blocked_in_browser'
                    : 'not_enabled_yet'
                );
                setIsJobSeekerDashboardOpen(false);
                setIsNotificationModalOpen(true);
              }
            }}
            onUpdateNotificationPrefs={async (patch) => {
              if (!userProfile?.uid) return;
              const saved = await saveUserNotificationPreferences(userProfile.uid, patch, userProfile.email);
              if (saved) {
                setNotificationPrefs(saved);
                const health = await checkCurrentDevicePushHealth(
                  userProfile.uid,
                  saved,
                  userProfile.email
                );
                setBrowserPerm(health.browserPermission);
                setHasActiveDevicePush(
                  saved.manuallyDisabled !== true && health.hasActiveSubscriptionOnThisDevice
                );
              }
            }}
            onEnableDevicePush={async () => {
              if (!userProfile?.uid) return;
              const res = await requestAndEnableNotifications(userProfile.uid, {
                emailAlerts: false,
                websiteBell: true,
                email: userProfile.email,
              });
              if (res.preferences) setNotificationPrefs(res.preferences);
              const health = await checkCurrentDevicePushHealth(
                userProfile.uid,
                res.preferences,
                userProfile.email
              );
              setBrowserPerm(health.browserPermission);
              setHasActiveDevicePush(
                res.preferences?.manuallyDisabled !== true && health.hasActiveSubscriptionOnThisDevice
              );
              if (!res.subscriptionActive && (res.permissionStatus === 'denied' || health.browserPermission === 'denied')) {
                setNotificationModalReason('blocked_in_browser');
                setIsNotificationModalOpen(true);
              }
              const fresh = await fetchUserNotificationsServer(userProfile.uid, userProfile.email);
              setUserNotifications(fresh.notifications);
              setUnreadNotificationsCount(fresh.unreadCount);
              if (res.preferences?.manuallyDisabled !== true && fresh.notifications.length > 0) {
                await dispatchLocalServiceWorkerPushFallback(
                  userProfile.uid,
                  fresh.notifications,
                  res.preferences
                ).catch(() => 0);
              }
            }}
            onDisableDevicePush={async () => {
              if (!userProfile?.uid) return;
              const res = await disableDeviceNotifications(userProfile.uid, userProfile.email);
              if (res.preferences) setNotificationPrefs(res.preferences);
              const health = await checkCurrentDevicePushHealth(
                userProfile.uid,
                res.preferences,
                userProfile.email
              );
              setBrowserPerm(health.browserPermission);
              setHasActiveDevicePush(false);
            }}
            onMarkNotificationRead={async (notifId, read) => {
              if (!userProfile?.uid) return;
              const res = await markUserNotificationReadServer(
                userProfile.uid,
                { notificationId: notifId, read },
                userProfile.email
              );
              setUserNotifications(res.notifications);
              setUnreadNotificationsCount(res.unreadCount);
            }}
            onMarkAllNotificationsRead={async () => {
              if (!userProfile?.uid) return;
              const res = await markUserNotificationReadServer(
                userProfile.uid,
                { markAll: true },
                userProfile.email
              );
              setUserNotifications(res.notifications);
              setUnreadNotificationsCount(res.unreadCount);
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
            autoFocusApply={isTelegramApplyArrival}
            isSaved={savedJobIds.has(selectedVacancy.id)}
            onToggleSave={handleToggleSaveJob}
            onApplyOnWebsite={(vac) => {
              handleCloseVacancy();
              handleStartApply(vac);
            }}
            onClose={handleCloseVacancy}
            telegramUrl={siteSettings.telegramChannelUrl}
          />
        </Suspense>
      )}

      {/* Hidden Blurred Developer Login (Bottom-Left Corner) */}
      <HiddenDeveloperLogin
        isOwnerAuthorized={isOwnerAuthorized}
        onLoginSuccess={(email) => {
          setActiveAdminSessionEmail(email);
          setIsOwnerAuthorized(true);
          setAdminEmail(email);
          setIsAdminView(true);
        }}
        onOpenDashboard={() => setIsAdminView(true)}
        onLogout={async () => {
          await Promise.allSettled([signOut(auth), logoutDeveloperSession()]);
          setAdminEmail(null);
          setIsOwnerAuthorized(false);
          setIsAdminView(false);
        }}
      />

      {/* Admin Login Modal */}
      {isAdminAuthModalOpen && (
        <Suspense fallback={null}>
          <AdminAuthModal
            isOpen={isAdminAuthModalOpen}
            onClose={() => setIsAdminAuthModalOpen(false)}
            onLoginSuccess={(email) => {
              setActiveAdminSessionEmail(email);
              setIsOwnerAuthorized(true);
              setAdminEmail(email);
              setIsAdminView(true);
            }}
          />
        </Suspense>
      )}

      {/* iPhone / iPad Add to Home Screen Guide Modal */}
      {isIosInstallGuideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
            <div className="bg-[#0B132B] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold">Add HopelandJobs to iPhone / iPad</h3>
                <p className="text-xs text-slate-300 mt-0.5">Enable instant lock-screen job alerts (iOS 16.4+)</p>
              </div>
              <button
                type="button"
                onClick={() => setIsIosInstallGuideOpen(false)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs text-slate-700 leading-relaxed">
              <p className="font-medium text-slate-800">
                Follow these 3 quick steps in Safari to install HopelandJobs on your Home Screen and unlock instant iPhone notifications:
              </p>
              <ol className="space-y-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-950">
                <li>
                  <strong>1. Tap the Share button</strong> at the bottom (or top) bar of Safari.
                </li>
                <li>
                  <strong>2. Scroll down and tap Add to Home Screen</strong>, then confirm <strong>Add</strong>.
                </li>
                <li>
                  <strong>3. Open HopelandJobs from your Home Screen</strong> and tap <strong>Enable Notifications</strong>.
                </li>
              </ol>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsIosInstallGuideOpen(false)}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Every-1-Minute Subtle Dim-Light Download Reminder (Direct 1-Tap Install) */}
      <AppDownloadReminderBanner
        isOpen={isMinuteInstallReminderOpen && !isStandaloneApp && !isInstallPopupOpen}
        appLogoUrl={siteSettings.appLogoUrl}
        isDesktop={isDesktopDevice}
        onDirectDownload={handleDownloadApplicationClick}
        onDismiss={() => setIsMinuteInstallReminderOpen(false)}
      />
      {/* Fallback Phone & Computer Application Download Guide (When Native Direct Install Is Unavailable) */}
      <PWAInstallPromptModal
        isOpen={isInstallPopupOpen && !isStandaloneApp}
        appLogoUrl={siteSettings.appLogoUrl}
        customDomain={siteSettings.customDomain}
        canInstallNative={canInstallNativeApp}
        isIOS={canShowIosInstallGuide}
        isDesktop={isDesktopDevice}
        onInstallNative={triggerNativeAppInstall}
        onDismiss={() => setIsInstallPopupOpen(false)}
      />
    </div>
  );
}
