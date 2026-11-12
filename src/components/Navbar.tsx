import React, { useState } from 'react';
import {
  Send,
  Shield,
  Briefcase,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  MapPin,
  FileText,
  UserCheck,
  Heart,
  User,
  LogOut,
  LayoutGrid,
} from 'lucide-react';
import { SiteSettings } from '../types/job';
import { JobSeekerProfile } from '../types/jobSeeker';

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
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
  onOpenDashboard?: () => void;
  onSignOutUser?: () => void;
  savedCount?: number;
  language: 'en' | 'am';
  onToggleLanguage: () => void;
}

export const Navbar: React.FC<Props> = ({
  siteSettings,
  isAdmin,
  adminEmail,
  userProfile,
  currentUserEmail,
  onOpenAdmin,
  onSelectCategory,
  onHomeClick,
  onOpenLocations,
  onOpenCvHelp,
  onOpenSavedJobs,
  onOpenAllCategories,
  onOpenAuth,
  onOpenDashboard,
  onSignOutUser,
  savedCount = 0,
  language,
  onToggleLanguage,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoggedIn = Boolean(currentUserEmail || userProfile?.email);
  const displayName = userProfile?.fullName || currentUserEmail?.split('@')[0] || 'My Account';
  const displayInitials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-[#0B132B] text-white shadow-lg border-b border-slate-800">
      {/* Top micro banner */}
      <div className="bg-[#1C2541] px-4 py-1.5 text-xs text-slate-300 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Official Ethiopian Vacancy Portal
            </span>
            <span className="hidden sm:inline text-slate-500">·</span>
            <span className="hidden sm:inline text-slate-300">
              🇪🇹 Addis Ababa, Hawassa, Adama, Dire Dawa & All Regions
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={onToggleLanguage}
              className="flex items-center gap-1.5 hover:text-amber-400 transition-colors text-xs font-semibold px-2 py-0.5 rounded bg-slate-800"
            >
              <span className="text-amber-400">🌐</span>
              <span>{language === 'en' ? 'አማርኛ (Amharic)' : 'English'}</span>
            </button>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300">Currency: <strong className="text-amber-300">ETB</strong></span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Brand Logo */}
          <div
            onClick={onHomeClick}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6 text-[#0B132B] fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-2xl tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                  HOPELAND <span className="text-amber-400">JOBS</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  ET
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Hopeland Jobs. Find Your Opportunity.
              </p>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden xl:flex items-center space-x-6 text-sm font-medium">
            <button
              onClick={onHomeClick}
              className="text-slate-200 hover:text-amber-400 transition-colors whitespace-nowrap"
            >
              Home
            </button>
            <button
              onClick={() => {
                if (onOpenAllCategories) {
                  onOpenAllCategories();
                } else {
                  const el = document.getElementById('categories-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="text-slate-200 hover:text-amber-400 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <LayoutGrid className="w-4 h-4 text-amber-400" />
              <span>Explore Categories</span>
            </button>
            <button
              onClick={onOpenLocations}
              className="text-slate-200 hover:text-amber-400 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>Jobs by Location</span>
            </button>
            <button
              onClick={onOpenCvHelp}
              className="text-slate-200 hover:text-amber-400 transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>CV Assistance</span>
            </button>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center space-x-2.5 shrink-0">
            {/* Saved Jobs button */}
            {onOpenSavedJobs && (
              <button
                onClick={onOpenSavedJobs}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
                title="View your saved vacancies"
              >
                <Heart className={`w-3.5 h-3.5 ${savedCount > 0 ? 'text-rose-500 fill-current' : 'text-slate-400'}`} />
                <span>Saved</span>
                {savedCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                    {savedCount}
                  </span>
                )}
              </button>
            )}

            {/* Telegram Channel CTA */}
            <a
              href={siteSettings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopia'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Join Our Telegram Channel @DreamBigJobsEthiopia"
              className="inline-flex items-center gap-1.5 bg-[#229ED9] hover:bg-[#1E88E5] text-white font-bold text-xs px-3 py-2 rounded-xl shadow-sm transition-all"
            >
              <Send className="w-3.5 h-3.5 fill-white" />
              <span>Telegram</span>
            </a>

            {/* User Auth / Dashboard Button */}
            {isLoggedIn ? (
              <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  onClick={onOpenDashboard}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors"
                  title="Open Job Seeker Dashboard"
                >
                  {userProfile?.photoUrl ? (
                    <img
                      src={userProfile.photoUrl}
                      alt={displayName}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-[10px] font-black">
                      {displayInitials}
                    </div>
                  )}
                  <span className="max-w-[100px] truncate">{displayName}</span>
                </button>
                {onSignOutUser && (
                  <button
                    onClick={onSignOutUser}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700/60 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onOpenAuth?.('signin')}
                  className="text-xs font-bold px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onOpenAuth?.('signup')}
                  className="text-xs font-extrabold px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm transition-all"
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Admin Portal Button */}
            <button
              onClick={onOpenAdmin}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-2 rounded-xl border transition-all ${
                isAdmin
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title={isAdmin ? 'Admin Dashboard (Active)' : 'Administrator Access'}
            >
              <Shield className={`w-3.5 h-3.5 ${isAdmin ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className="hidden md:inline">{isAdmin ? 'Admin' : 'Admin'}</span>
            </button>
          </div>

          {/* Mobile menu toggle */}
          <div className="flex sm:hidden items-center gap-2">
            {isLoggedIn ? (
              <button
                onClick={onOpenDashboard}
                className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center shadow-sm"
              >
                {displayInitials}
              </button>
            ) : (
              <button
                onClick={() => onOpenAuth?.('signin')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-400 text-slate-950"
              >
                Sign In
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0B132B] border-t border-slate-800 px-4 pt-3 pb-6 space-y-3">
          {/* User Status Bar in Mobile */}
          {isLoggedIn ? (
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center">
                  {displayInitials}
                </div>
                <div>
                  <p className="font-bold text-sm text-white">{displayName}</p>
                  <p className="text-[11px] text-slate-400">{currentUserEmail}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  onSignOutUser?.();
                  setMobileMenuOpen(false);
                }}
                className="p-2 text-rose-400 hover:bg-slate-700 rounded-lg text-xs"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-1 pb-2">
              <button
                onClick={() => {
                  onOpenAuth?.('signin');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 text-center text-xs font-bold rounded-xl bg-slate-800 text-slate-200 border border-slate-700"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  onOpenAuth?.('signup');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 text-center text-xs font-extrabold rounded-xl bg-amber-400 text-slate-950"
              >
                Create Account
              </button>
            </div>
          )}

          {isLoggedIn && onOpenDashboard && (
            <button
              onClick={() => {
                onOpenDashboard();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl bg-amber-400/10 text-amber-300 font-bold text-sm border border-amber-400/30"
            >
              <User className="w-4 h-4 text-amber-400" />
              <span>My Job Seeker Profile & Vault</span>
            </button>
          )}

          <button
            onClick={() => {
              onHomeClick();
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 text-slate-200 font-medium hover:text-amber-400 text-sm"
          >
            Home
          </button>

          <button
            onClick={() => {
              if (onOpenAllCategories) {
                onOpenAllCategories();
              } else {
                const el = document.getElementById('categories-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2 w-full text-left py-2 text-slate-200 font-semibold hover:text-amber-400 text-sm"
          >
            <LayoutGrid className="w-4 h-4 text-amber-400" />
            <span>Explore All Job Categories</span>
          </button>

          <button
            onClick={() => {
              onOpenLocations();
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2 w-full text-left py-2 text-slate-200 font-semibold hover:text-amber-400 text-sm"
          >
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>Jobs by Location</span>
          </button>

          {onOpenSavedJobs && (
            <button
              onClick={() => {
                onOpenSavedJobs();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full text-left py-2 text-slate-200 font-semibold hover:text-amber-400 text-sm"
            >
              <Heart className={`w-4 h-4 ${savedCount > 0 ? 'text-rose-500 fill-current' : 'text-slate-400'}`} />
              <span>Saved Vacancies ({savedCount})</span>
            </button>
          )}

          <button
            onClick={() => {
              onOpenCvHelp();
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 text-slate-200 font-medium hover:text-amber-400 text-sm"
          >
            CV & Cover Letter Assistance
          </button>

          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
            <a
              href={siteSettings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopia'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Join Our Telegram Channel @DreamBigJobsEthiopia"
              className="w-full flex items-center justify-center gap-2 bg-[#229ED9] text-white font-bold text-sm py-3 rounded-xl shadow-sm cursor-pointer"
            >
              <Send className="w-4 h-4 fill-white" />
              <span>Join Hopeland Jobs on Telegram</span>
            </a>
            <button
              onClick={() => {
                onOpenAdmin();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 text-slate-200 font-semibold text-sm py-2.5 rounded-lg border border-slate-700"
            >
              <Shield className="w-4 h-4 text-amber-400" />
              {isAdmin ? 'Admin Dashboard (Active)' : 'Administrator Access'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
