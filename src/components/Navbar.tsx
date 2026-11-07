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
} from 'lucide-react';
import { SiteSettings } from '../types/job';

interface Props {
  siteSettings: SiteSettings;
  isAdmin: boolean;
  adminEmail?: string | null;
  onOpenAdmin: () => void;
  onSelectCategory: (categoryId: string) => void;
  onHomeClick: () => void;
  onOpenLocations: () => void;
  onOpenCvHelp: () => void;
  onOpenSavedJobs?: () => void;
  savedCount?: number;
  language: 'en' | 'am';
  onToggleLanguage: () => void;
}

export const Navbar: React.FC<Props> = ({
  siteSettings,
  isAdmin,
  adminEmail,
  onOpenAdmin,
  onSelectCategory,
  onHomeClick,
  onOpenLocations,
  onOpenCvHelp,
  onOpenSavedJobs,
  savedCount = 0,
  language,
  onToggleLanguage,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#0B132B] text-white shadow-lg border-b border-slate-800">
      {/* Top micro banner */}
      <div className="bg-[#1C2541] px-4 py-1.5 text-xs text-slate-300 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Official Ethiopian Vacancy Portal
            </span>
            <span className="hidden sm:inline text-slate-500">|</span>
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
            <span className="text-slate-500">|</span>
            <span className="text-slate-300">Currency: <strong className="text-amber-300">ETB</strong></span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo */}
          <div
            onClick={onHomeClick}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-7 h-7 text-[#0B132B] fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-2xl tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                  DREAM BIG <span className="text-amber-400">JOBS</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  ET
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Dream Big. Find Your Opportunity.
              </p>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center space-x-6 text-sm font-medium">
            <button
              onClick={onHomeClick}
              className="text-slate-200 hover:text-amber-400 transition-colors"
            >
              Home
            </button>
            <button
              onClick={onOpenLocations}
              className="text-slate-200 hover:text-amber-400 transition-colors flex items-center gap-1.5"
            >
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>Jobs by Location</span>
            </button>
            <a
              href="#categories-section"
              className="text-slate-200 hover:text-amber-400 transition-colors"
            >
              Job Categories
            </a>
            <button
              onClick={onOpenCvHelp}
              className="text-slate-200 hover:text-amber-400 transition-colors flex items-center gap-1"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>CV Assistance</span>
            </button>
            <a
              href="#about-section"
              className="text-slate-200 hover:text-amber-400 transition-colors"
            >
              About
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center space-x-3">
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
              className="inline-flex items-center gap-2 bg-[#229ED9] hover:bg-[#1E88E5] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md hover:shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Send className="w-4 h-4 fill-white" />
              <span>Telegram Channel</span>
              <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold">LIVE</span>
            </a>

            {/* Admin Dashboard / Login Button */}
            <button
              onClick={onOpenAdmin}
              className={`inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2.5 rounded-lg border transition-all ${
                isAdmin
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {isAdmin ? (
                <>
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Admin Panel</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Admin Portal</span>
                </>
              )}
            </button>
          </div>

          {/* Mobile menu toggle */}
          <div className="flex lg:hidden items-center gap-2">
            <a
              href={siteSettings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopia'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Join Our Telegram Channel @DreamBigJobsEthiopia"
              className="p-2.5 rounded-xl bg-[#229ED9] text-white hover:bg-[#1E88E5] transition-colors cursor-pointer shadow-sm"
            >
              <Send className="w-4 h-4 fill-white" />
            </a>
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
          <button
            onClick={() => {
              onHomeClick();
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 text-slate-200 font-medium hover:text-amber-400"
          >
            Home
          </button>
          <button
            onClick={() => {
              onOpenLocations();
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2 w-full text-left py-2 text-slate-200 font-bold hover:text-amber-400"
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
              className="flex items-center gap-2 w-full text-left py-2 text-slate-200 font-bold hover:text-amber-400"
            >
              <Heart className={`w-4 h-4 ${savedCount > 0 ? 'text-rose-500 fill-current' : 'text-slate-400'}`} />
              <span>Saved Vacancies ({savedCount})</span>
            </button>
          )}
          <a
            href="#categories-section"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-200 font-medium hover:text-amber-400"
          >
            All 16 Job Categories
          </a>
          <button
            onClick={() => {
              onOpenCvHelp();
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 text-slate-200 font-medium hover:text-amber-400"
          >
            CV & Cover Letter Tips
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
              <span>Join Dream Big Jobs on Telegram</span>
            </a>
            <button
              onClick={() => {
                onOpenAdmin();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 text-slate-200 font-semibold text-sm py-2.5 rounded-lg border border-slate-700"
            >
              <Shield className="w-4 h-4 text-amber-400" />
              {isAdmin ? 'Admin Dashboard (Logged in)' : 'Administrator Login'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
