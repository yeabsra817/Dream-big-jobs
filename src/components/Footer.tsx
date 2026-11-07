import React from 'react';
import {
  Send,
  Sparkles,
  Shield,
  Heart,
  MapPin,
  Mail,
  Phone,
  ArrowRight,
} from 'lucide-react';
import { OFFICIAL_CATEGORIES, ETHIOPIAN_LOCATIONS, SiteSettings } from '../types/job';

interface Props {
  siteSettings: SiteSettings;
  onSelectCategory: (name: string) => void;
  onSelectLocation?: (city: string) => void;
  onOpenAdmin: () => void;
}

export const Footer: React.FC<Props> = ({
  siteSettings,
  onSelectCategory,
  onSelectLocation,
  onOpenAdmin,
}) => {
  return (
    <footer className="bg-[#0B132B] text-white border-t border-slate-800">
      {/* Top Banner CTA: Telegram */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-950">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0">
              <Send className="w-6 h-6 fill-amber-400" />
            </div>
            <div>
              <h4 className="font-extrabold text-base sm:text-lg">
                Never Miss a Verified Ethiopian Job Announcement!
              </h4>
              <p className="text-xs font-semibold text-slate-800">
                Join our Telegram channel for instant vacancy alerts in Banking, NGOs, Embassies & Hotels.
              </p>
            </div>
          </div>

          <a
            href={siteSettings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopia'}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join Our Telegram Channel @DreamBigJobsEthiopia"
            className="inline-flex items-center gap-2 bg-[#0B132B] hover:bg-slate-900 text-white font-extrabold text-xs px-6 py-3.5 rounded-xl shadow-lg transition-transform transform hover:scale-105 cursor-pointer"
          >
            <Send className="w-4 h-4 fill-white" />
            <span>JOIN OUR TELEGRAM CHANNEL</span>
          </a>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                <Sparkles className="w-6 h-6 fill-current" />
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-white">
                DREAM BIG <span className="text-amber-400">JOBS</span>
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
              Your trusted destination for banking, embassy, NGO, hospitality, tourism, and other career opportunities in Ethiopia. All vacancies are personally curated and verified by the site administrator.
            </p>

            <div className="space-y-2 text-xs text-slate-300 pt-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{siteSettings.contactAddress || 'Bole Subcity, Addis Ababa, Ethiopia'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{siteSettings.contactEmail || 'nexusitsoultion@gmail.com'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{siteSettings.contactPhone || '+251 91 123 4567'}</span>
              </div>
            </div>
          </div>

          {/* Categories col 1 */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-4">
              Top Sectors
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              {OFFICIAL_CATEGORIES.slice(0, 6).map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => onSelectCategory(cat.name)}
                    className="hover:text-amber-400 transition-colors text-left flex items-center gap-1 group"
                  >
                    <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors" />
                    <span>{cat.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories col 2 */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-4">
              More Sectors
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              {OFFICIAL_CATEGORIES.slice(6, 12).map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => onSelectCategory(cat.name)}
                    className="hover:text-amber-400 transition-colors text-left flex items-center gap-1 group"
                  >
                    <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors" />
                    <span>{cat.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Locations & Trust */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-4">
              Key Regions & Cities
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              {['Addis Ababa', 'Hawassa', 'Adama', 'Dire Dawa', 'Bahir Dar', 'Mekelle', 'Jimma'].map(
                (city) => (
                  <li key={city}>
                    <button
                      onClick={() => onSelectLocation ? onSelectLocation(city) : undefined}
                      className="flex items-center gap-1.5 text-slate-400 hover:text-amber-400 transition-colors group text-left"
                    >
                      <MapPin className="w-3 h-3 text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>{city}</span>
                    </button>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>

        {/* Verification Guarantee & Admin Link */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-center md:text-left">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              100% Admin-Verified Vacancies • Zero Fake Jobs • Accurate Direct Application Links
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onOpenAdmin}
              className="text-slate-400 hover:text-amber-400 text-xs font-semibold flex items-center gap-1"
            >
              <span>Administrator Portal</span>
            </button>
            <span>•</span>
            <span>© {new Date().getFullYear()} DREAM BIG JOBS Ethiopia. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
