import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Briefcase,
  Menu,
  X,
  MapPin,
  FileText,
  Heart,
  User,
  LogOut,
  LogIn,
  UserPlus,
  LayoutGrid,
  Globe,
  Plane,
  GraduationCap,
  Download,
  WifiOff,
  RefreshCw,
  Share,
  ChevronDown,
  Bell,
  Megaphone,
  ExternalLink,
} from 'lucide-react';
import { SiteSettings } from '../types/job';
import {
  JobSeekerProfile,
  NotificationPermissionState,
  NotificationPreferencesRecord,
  UserNotificationItem,
} from '../types/jobSeeker';
import { NotificationCenterPopover } from './NotificationCenterPopover';
import { AppBrandLogo } from './AppBrandLogo';
import { resolveSiteContent } from '../utils/siteContentDefaults';

interface Props {
  siteSettings: SiteSettings;
  isAdmin: boolean;
  adminEmail?: string | null;
  userProfile?: JobSeekerProfile | null;
  currentUserEmail?: string | null;
  onOpenAdmin: () => void;
  onSelectCategory: (categoryId: string) => void;
  onHomeClick: () => void;
  onOpenLocations: () => void;
  onOpenCvHelp: () => void;
  onOpenSavedJobs?: () => void;
  onOpenAllCategories?: () => void;
  onOpenInternationalOpportunities?: () => void;
  onOpenInternationalJobs?: () => void;
  onOpenImmigration?: () => void;
  onOpenScholarships?: () => void;
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
  onOpenDashboard?: () => void;
  onSignOutUser?: () => void;
  savedCount?: number;
  language: 'en' | 'am';
  onToggleLanguage: () => void;
  notifications?: UserNotificationItem[];
  unreadNotificationsCount?: number;
  notificationPrefs?: NotificationPreferencesRecord | null;
  browserNotificationPermission?: NotificationPermissionState;
  hasActiveDevicePush?: boolean;
  onMarkNotificationRead?: (id: string, read: boolean) => Promise<void>;
  onMarkAllNotificationsRead?: () => Promise<void>;
  onOpenNotification?: (notif: UserNotificationItem) => void;
  onOpenNotificationPreferences?: () => void;
  onPromptEnableNotifications?: () => void;
  canInstallApp?: boolean;
  canShowIosInstallGuide?: boolean;
  isStandaloneApp?: boolean;
  onInstallApp?: () => void;
  onOpenIosInstallGuide?: () => void;
  onOpenDownloadApplication?: () => void;
  isOnline?: boolean;
  isSyncingReconnect?: boolean;
}

export const Navbar: React.FC<Props> = ({
  siteSettings,
  userProfile,
  currentUserEmail,
  onHomeClick,
  onOpenLocations,
  onOpenCvHelp,
  onOpenSavedJobs,
  onOpenAllCategories,
  onOpenInternationalOpportunities,
  onOpenInternationalJobs,
  onOpenImmigration,
  onOpenScholarships,
  onOpenAuth,
  onOpenDashboard,
  onSignOutUser,
  savedCount = 0,
  language,
  onToggleLanguage,
  notifications = [],
  unreadNotificationsCount = 0,
  notificationPrefs = null,
  browserNotificationPermission = 'default',
  hasActiveDevicePush = false,
  onMarkNotificationRead = async () => {},
  onMarkAllNotificationsRead = async () => {},
  onOpenNotification = () => {},
  onOpenNotificationPreferences = () => {},
  onPromptEnableNotifications = () => {},
  canInstallApp = false,
  canShowIosInstallGuide = false,
  isStandaloneApp = false,
  onInstallApp,
  onOpenIosInstallGuide,
  onOpenDownloadApplication,
  isOnline = true,
  isSyncingReconnect = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [dismissedInstallStrip, setDismissedInstallStrip] = useState(false);
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const siteContent = resolveSiteContent(siteSettings);

  const handleDownloadAppClick = () => {
    if (onOpenDownloadApplication) {
      onOpenDownloadApplication();
    } else if (canInstallApp && onInstallApp) {
      onInstallApp();
    } else if (canShowIosInstallGuide && onOpenIosInstallGuide) {
      onOpenIosInstallGuide();
    }
  };

  const isLoggedIn = Boolean(currentUserEmail || userProfile?.email);
  const displayName = userProfile?.fullName || currentUserEmail?.split('@')[0] || 'Account';
  const displayInitials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleCategoriesNav = () => {
    if (onOpenAllCategories) {
      onOpenAllCategories();
    } else {
      const el = document.getElementById('categories-section');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-[0_2px_12px_rgba(11,19,43,0.06)]">
      {/* Optional Admin-Controlled Sitewide Announcement Banner */}
      {siteContent.showAnnouncementBanner &&
        siteContent.announcementText.trim().length > 0 &&
        !dismissedAnnouncement && (
          <div className="bg-emerald-700 text-white border-b border-emerald-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3 text-xs font-semibold">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Megaphone className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="truncate sm:whitespace-normal">{siteContent.announcementText}</span>
                {siteContent.announcementLinkUrl.trim().length > 0 && (
                  <a
                    href={
                      siteContent.announcementLinkUrl.startsWith('http')
                        ? siteContent.announcementLinkUrl
                        : `https://${siteContent.announcementLinkUrl}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/15 hover:bg-white/25 text-amber-200 font-bold whitespace-nowrap shrink-0 transition-colors"
                  >
                    <span>{siteContent.announcementLinkLabel || 'Learn More'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDismissedAnnouncement(true)}
                aria-label="Dismiss announcement"
                className="p-1 rounded-md text-emerald-100 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      {/* Official Top Bar — Optional Download Application (Phone & Computer) */}
      {siteContent.showTopDownloadBar &&
        !isStandaloneApp &&
        !dismissedInstallStrip &&
        (onOpenDownloadApplication || onInstallApp || onOpenIosInstallGuide) && (
          <div className="bg-gradient-to-r from-[#0B132B] via-[#132959] to-[#0B132B] text-slate-200 border-b border-amber-400/25">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={handleDownloadAppClick}
                  className="group inline-flex items-center gap-2 px-3.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#0B132B] text-xs font-extrabold tracking-tight transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 whitespace-nowrap"
                  title="Optional: Download application for Phone or Computer"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{siteContent.topDownloadBarText}</span>
                </button>
                {siteContent.topDownloadBarSubtitle && (
                  <span className="hidden md:inline text-xs font-semibold text-emerald-200 truncate">
                    {siteContent.topDownloadBarSubtitle}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDismissedInstallStrip(true)}
                aria-label="Hide download bar"
                title="Hide for now"
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-[72px] gap-4 lg:gap-8">
          {/* Zone 1: Brand Logo (Left) */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onHomeClick();
            }}
            className="flex items-center gap-2.5 cursor-pointer group shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] rounded-lg"
          >
            <AppBrandLogo
              logoUrl={siteSettings.appLogoUrl}
              size="md"
              variant="green"
              className="group-hover:brightness-95 transition-all"
            />
            <span className="font-extrabold text-xl sm:text-[22px] tracking-tight text-[#0B132B] whitespace-nowrap shrink-0">
              {siteContent.brandPrimary}
              <span className="text-[#16A34A]">{siteContent.brandAccent}</span>
            </span>
          </button>

          {/* Zone 2: Desktop Navigation Links */}
          <nav
            aria-label="Main navigation"
            className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-700"
          >
            {siteContent.showNavJobs && (
              <button
                type="button"
                onClick={onHomeClick}
                className="py-1 text-slate-700 hover:text-[#16A34A] border-b-2 border-transparent hover:border-[#16A34A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Jobs
              </button>
            )}
            {siteContent.showNavCategories && (
              <button
                type="button"
                onClick={handleCategoriesNav}
                className="py-1 text-slate-700 hover:text-[#16A34A] border-b-2 border-transparent hover:border-[#16A34A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Categories
              </button>
            )}
            <button
              type="button"
              onClick={onOpenLocations}
              className="py-1 text-slate-700 hover:text-[#16A34A] border-b-2 border-transparent hover:border-[#16A34A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Locations
            </button>
            {siteContent.showNavInternational && (onOpenInternationalOpportunities || onOpenInternationalJobs) && (
              <button
                type="button"
                onClick={onOpenInternationalOpportunities || onOpenInternationalJobs}
                className="py-1 text-slate-700 hover:text-[#16A34A] border-b-2 border-transparent hover:border-[#16A34A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                International Opportunities
              </button>
            )}
            <button
              type="button"
              onClick={onOpenCvHelp}
              className="py-1 text-slate-700 hover:text-[#16A34A] border-b-2 border-transparent hover:border-[#16A34A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              CV Help
            </button>
          </nav>

          {/* Zone 3: Account Dropdown & Utility Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {!isOnline && (
              <span
                className="hidden sm:inline-flex items-center gap-1 text-rose-700 font-semibold text-xs px-2 py-1 rounded-lg bg-rose-50"
                title="Offline mode"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </span>
            )}
            {isOnline && isSyncingReconnect && (
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[#16A34A] font-semibold text-xs"
                title="Syncing alerts"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              </span>
            )}

            {/* Notification Bell when logged in */}
            {isLoggedIn && (
              <NotificationCenterPopover
                notifications={notifications}
                unreadCount={unreadNotificationsCount}
                prefs={notificationPrefs}
                browserPermission={browserNotificationPermission}
                hasActiveDevicePush={hasActiveDevicePush}
                onMarkRead={onMarkNotificationRead}
                onMarkAllRead={onMarkAllNotificationsRead}
                onOpenNotification={onOpenNotification}
                onOpenPreferences={onOpenNotificationPreferences}
                onPromptEnableNotifications={onPromptEnableNotifications}
              />
            )}

            {/* Saved Jobs quick button on desktop */}
            {onOpenSavedJobs && (
              <button
                type="button"
                onClick={onOpenSavedJobs}
                aria-label={`Saved jobs (${savedCount})`}
                title="View saved vacancies"
                className="hidden sm:inline-flex relative min-h-[40px] min-w-[40px] px-2.5 py-2 rounded-full bg-slate-50 hover:bg-slate-100 text-[#0B132B] border border-slate-200 items-center justify-center transition-colors cursor-pointer"
              >
                <Heart
                  className={`w-4 h-4 ${
                    savedCount > 0 ? 'text-rose-500 fill-current' : 'text-slate-600'
                  }`}
                />
                {savedCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0B132B] text-white text-[10px] font-bold font-mono tabular-nums flex items-center justify-center border-2 border-white">
                    {savedCount}
                  </span>
                )}
              </button>
            )}

            {/* Clean Guest Optional Login / Register Buttons on Desktop, or Account Dropdown when signed in */}
            {!isLoggedIn ? (
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenAuth?.('signin')}
                  className="min-h-[40px] px-4 py-2 rounded-xl text-sm font-bold text-[#0B132B] border border-slate-300 hover:border-[#0B132B] hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth?.('signup')}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#16A34A] to-[#059669] hover:from-[#15803D] hover:to-[#047857] text-white text-sm font-extrabold transition-all shadow-sm shadow-emerald-600/25 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Register
                </button>
              </div>
            ) : (
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountDropdownOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={accountDropdownOpen}
                aria-label="Account menu"
                className="min-h-[40px] inline-flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0B132B] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
              >
                {userProfile?.photoUrl ? (
                  <img
                    src={userProfile.photoUrl}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#16A34A] text-white flex items-center justify-center text-xs font-bold">
                    {displayInitials}
                  </div>
                )}
                <span className="hidden md:inline text-sm font-semibold text-[#0B132B] max-w-[120px] truncate whitespace-nowrap">
                  {displayName}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 transition-transform duration-150 ${
                    accountDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {accountDropdownOpen && (
                <div
                  role="menu"
                  aria-label="Account options"
                  className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 origin-top-right animate-in fade-in zoom-in-95 duration-150"
                >
                  {isLoggedIn ? (
                    <>
                      <div className="px-4 py-2.5 border-b border-slate-100">
                        <p className="text-sm font-bold text-[#0B132B] truncate">{displayName}</p>
                        {currentUserEmail && (
                          <p className="text-xs text-slate-500 truncate">{currentUserEmail}</p>
                        )}
                      </div>

                      <div className="py-1">
                        {onOpenDashboard && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setAccountDropdownOpen(false);
                              onOpenDashboard();
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#16A34A] flex items-center gap-2.5 transition-colors cursor-pointer"
                          >
                            <User className="w-4 h-4 text-slate-500" />
                            <span>Profile</span>
                          </button>
                        )}

                        {onOpenSavedJobs && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setAccountDropdownOpen(false);
                              onOpenSavedJobs();
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#16A34A] flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5">
                              <Heart className="w-4 h-4 text-slate-500" />
                              <span>Saved Vacancies</span>
                            </span>
                            {savedCount > 0 && (
                              <span className="text-xs font-semibold text-slate-500 tabular-nums">
                                {savedCount}
                              </span>
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setAccountDropdownOpen(false);
                            onOpenNotificationPreferences();
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#16A34A] flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <Bell className="w-4 h-4 text-slate-500" />
                          <span>Alert Preferences</span>
                        </button>
                      </div>

                      <div className="pt-1 border-t border-slate-100">
                        {onSignOutUser && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setAccountDropdownOpen(false);
                              onSignOutUser();
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Log Out</span>
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountDropdownOpen(false);
                          onOpenAuth?.('signin');
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm font-semibold text-[#0B132B] hover:bg-slate-50 hover:text-[#16A34A] flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <LogIn className="w-4 h-4 text-slate-500" />
                        <span>Login</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountDropdownOpen(false);
                          onOpenAuth?.('signup');
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm font-semibold text-[#16A34A] hover:bg-emerald-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4 text-[#16A34A]" />
                        <span>Register</span>
                      </button>
                    </div>
                  )}

                  {/* Secondary utility actions neatly tucked in dropdown */}
                  <div className="mt-1 pt-1 border-t border-slate-100 text-xs">
                    {!isStandaloneApp && (onOpenDownloadApplication || onInstallApp || onOpenIosInstallGuide) && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountDropdownOpen(false);
                          handleDownloadAppClick();
                        }}
                        className="w-full px-4 py-2 text-left font-medium text-slate-600 hover:bg-slate-50 hover:text-[#0B132B] flex items-center gap-2.5 cursor-pointer"
                      >
                        {canShowIosInstallGuide && !canInstallApp ? (
                          <Share className="w-3.5 h-3.5 text-[#16A34A]" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-[#16A34A]" />
                        )}
                        <span>Download Application</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAccountDropdownOpen(false);
                        onToggleLanguage();
                      }}
                      className="w-full px-4 py-2 text-left font-medium text-slate-600 hover:bg-slate-50 hover:text-[#0B132B] flex items-center justify-between cursor-pointer"
                    >
                      <span>Language</span>
                      <span className="font-semibold text-[#16A34A]">
                        {language === 'en' ? 'አማርኛ' : 'English'}
                      </span>
                    </button>
                    <a
                      href={siteSettings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopia'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setAccountDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left font-medium text-slate-600 hover:bg-slate-50 hover:text-[#229ED9] flex items-center gap-2.5"
                    >
                      <Send className="w-3.5 h-3.5 text-[#229ED9]" />
                      <span>Telegram Channel</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Hamburger Menu Button on Mobile (Right) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden min-h-[42px] min-w-[42px] p-2 rounded-xl text-[#0B132B] hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Smooth Mobile Navigation Drawer */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] bg-white border-t border-slate-100 ${
          mobileMenuOpen ? 'max-h-[82vh] opacity-100' : 'max-h-0 opacity-0 border-t-transparent'
        }`}
      >
        <div className="px-4 py-4 space-y-2 overflow-y-auto max-h-[80vh]">
          {isLoggedIn ? (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {userProfile?.photoUrl ? (
                  <img
                    src={userProfile.photoUrl}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#16A34A] text-white font-bold text-sm flex items-center justify-center shrink-0">
                    {displayInitials}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[#0B132B] truncate">{displayName}</p>
                  {currentUserEmail && (
                    <p className="text-xs text-slate-500 truncate">{currentUserEmail}</p>
                  )}
                </div>
              </div>
              {onSignOutUser && (
                <button
                  type="button"
                  onClick={() => {
                    onSignOutUser();
                    setMobileMenuOpen(false);
                  }}
                  className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5 pb-2">
              <p className="text-[11px] font-medium text-slate-500 px-1">
                Optional Account · አማራጭ አካውንት
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onOpenAuth?.('signin');
                    setMobileMenuOpen(false);
                  }}
                  className="min-h-[44px] py-2.5 text-center text-sm font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B132B] border border-slate-300 cursor-pointer whitespace-nowrap"
                >
                  Login · ይግቡ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenAuth?.('signup');
                    setMobileMenuOpen(false);
                  }}
                  className="min-h-[44px] py-2.5 text-center text-sm font-extrabold rounded-xl bg-gradient-to-r from-[#16A34A] to-[#059669] hover:from-[#15803D] hover:to-[#047857] text-white shadow-sm cursor-pointer whitespace-nowrap"
                >
                  Register · ይመዝገቡ
                </button>
              </div>
            </div>
          )}

          {isLoggedIn && onOpenDashboard && (
            <button
              type="button"
              onClick={() => {
                onOpenDashboard();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl bg-emerald-50 text-[#15803D] font-semibold text-sm cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>My Profile</span>
            </button>
          )}

          {siteContent.showNavJobs && (
            <button
              type="button"
              onClick={() => {
                onHomeClick();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2.5 w-full text-left py-2.5 px-2 text-[#0B132B] font-medium hover:text-[#16A34A] text-sm cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-[#16A34A]" />
              <span>Jobs Home</span>
            </button>
          )}

          {siteContent.showNavCategories && (
            <button
              type="button"
              onClick={() => {
                handleCategoriesNav();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2.5 w-full text-left py-2.5 px-2 text-[#0B132B] font-medium hover:text-[#16A34A] text-sm cursor-pointer"
            >
              <LayoutGrid className="w-4 h-4 text-[#16A34A]" />
              <span>All Categories</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onOpenLocations();
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2.5 w-full text-left py-2.5 px-2 text-[#0B132B] font-medium hover:text-[#16A34A] text-sm cursor-pointer"
          >
            <MapPin className="w-4 h-4 text-[#16A34A]" />
            <span>Jobs by Location</span>
          </button>

          {onOpenSavedJobs && (
            <button
              type="button"
              onClick={() => {
                onOpenSavedJobs();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2.5 w-full text-left py-2.5 px-2 text-[#0B132B] font-medium hover:text-[#16A34A] text-sm cursor-pointer"
            >
              <Heart className={`w-4 h-4 ${savedCount > 0 ? 'text-rose-500 fill-current' : 'text-slate-400'}`} />
              <span>Saved Vacancies ({savedCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onOpenCvHelp();
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2.5 w-full text-left py-2.5 px-2 text-[#0B132B] font-medium hover:text-[#16A34A] text-sm cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#16A34A]" />
            <span>CV Assistance</span>
          </button>

          {siteContent.showNavInternational && onOpenInternationalOpportunities && (
            <button
              type="button"
              onClick={() => {
                onOpenInternationalOpportunities();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2.5 w-full text-left py-2.5 px-2 text-[#0B132B] font-semibold hover:text-[#16A34A] text-sm cursor-pointer"
            >
              <Globe className="w-4 h-4 text-[#16A34A]" />
              <span>International Opportunities</span>
            </button>
          )}

          {siteContent.showNavInternational && onOpenInternationalJobs && (
            <button
              type="button"
              onClick={() => {
                onOpenInternationalJobs();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2.5 w-full text-left py-2.5 px-2 text-[#0B132B] font-medium hover:text-[#16A34A] text-sm cursor-pointer"
            >
              <Globe className="w-4 h-4 text-[#1D4ED8]" />
              <span>International Jobs (Legacy)</span>
            </button>
          )}

          {siteContent.showNavImmigration && onOpenImmigration && (
            <button
              type="button"
              onClick={() => {
                onOpenImmigration();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2.5 w-full text-left py-2.5 px-2 text-[#0B132B] font-medium hover:text-[#16A34A] text-sm cursor-pointer"
            >
              <Plane className="w-4 h-4 text-[#1D4ED8]" />
              <span>Immigration &amp; PR</span>
            </button>
          )}

          {siteContent.showNavScholarships && onOpenScholarships && (
            <button
              type="button"
              onClick={() => {
                onOpenScholarships();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2.5 w-full text-left py-2.5 px-2 text-[#0B132B] font-medium hover:text-[#16A34A] text-sm cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-[#1D4ED8]" />
              <span>Scholarships</span>
            </button>
          )}

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {!isStandaloneApp && (onOpenDownloadApplication || onInstallApp || onOpenIosInstallGuide) && (
              <button
                type="button"
                onClick={() => {
                  handleDownloadAppClick();
                  setMobileMenuOpen(false);
                }}
                className="w-full min-h-[46px] flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#0B132B] font-extrabold text-sm py-2.5 rounded-xl shadow-sm cursor-pointer whitespace-nowrap"
              >
                {canShowIosInstallGuide && !canInstallApp ? (
                  <Share className="w-4 h-4 shrink-0" />
                ) : (
                  <Download className="w-4 h-4 shrink-0" />
                )}
                <span>Download App (Optional) · አፑን ያውርዱ</span>
              </button>
            )}
            <a
              href={siteSettings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopia'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-[#229ED9] text-white font-semibold text-sm py-2.5 rounded-xl"
            >
              <Send className="w-4 h-4 fill-white" />
              <span>Telegram Channel</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
