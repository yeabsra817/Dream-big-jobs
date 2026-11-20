import React from 'react';
import {
  Send,
  Shield,
  Briefcase,
  MapPin,
  Mail,
  Phone,
  ArrowRight,
} from 'lucide-react';
import { OFFICIAL_CATEGORIES, SiteSettings } from '../types/job';
import { AppBrandLogo } from './AppBrandLogo';

interface Props {
  siteSettings: SiteSettings;
  onSelectCategory: (name: string) => void;
  onSelectLocation?: (city: string) => void;
  onOpenAdmin: () => void;
  onOpenInternationalJobs?: () => void;
  onOpenImmigration?: () => void;
  onOpenScholarships?: () => void;
}

export const Footer: React.FC<Props> = ({
  siteSettings,
  onSelectCategory,
  onSelectLocation,
  onOpenInternationalJobs,
  onOpenImmigration,
  onOpenScholarships,
}) => {
  return (
    <footer className="bg-[#0B132B] text-white border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <AppBrandLogo logoUrl={siteSettings.appLogoUrl} size="md" variant="green" />
              <span className="font-extrabold text-2xl tracking-tight text-white">
                Hopeland<span className="text-[#4ADE80]">Jobs</span>
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
              {siteSettings.aboutText ||
                'Your trusted destination for banking, embassy, NGO, hospitality, tourism, and corporate career opportunities in Ethiopia. All vacancies are verified.'}
            </p>

            <div className="space-y-2 text-xs text-slate-300 pt-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#4ADE80] shrink-0" />
                <span>{siteSettings.contactAddress || 'Bole Subcity, Addis Ababa, Ethiopia'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#4ADE80] shrink-0" />
                <span>{siteSettings.contactEmail || 'nexusitsoultion@gmail.com'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#4ADE80] shrink-0" />
                <span>{siteSettings.contactPhone || '+251 91 123 4567'}</span>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={siteSettings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopia'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join Our Telegram Channel @DreamBigJobsEthiopia"
                className="inline-flex items-center gap-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-xs px-4 py-2.5 rounded-full transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 fill-white" />
                <span>Join Telegram Job Alerts</span>
              </a>
            </div>
          </div>

          {/* Top Sectors */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#4ADE80] mb-4">
              Top Sectors
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              {OFFICIAL_CATEGORIES.slice(0, 9).map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat.name)}
                    className="hover:text-[#4ADE80] transition-colors text-left flex items-center gap-1.5 group cursor-pointer"
                  >
                    <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-[#4ADE80] transition-colors" />
                    <span>{cat.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* More Sectors */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#4ADE80] mb-4">
              More Sectors
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              {OFFICIAL_CATEGORIES.slice(9).map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat.name)}
                    className="hover:text-[#4ADE80] transition-colors text-left flex items-center gap-1.5 group cursor-pointer"
                  >
                    <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-[#4ADE80] transition-colors" />
                    <span>{cat.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Key Regions & Cities */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#4ADE80] mb-4">
              Key Cities
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              {['Addis Ababa', 'Hawassa', 'Adama', 'Dire Dawa', 'Bahir Dar', 'Mekelle', 'Jimma'].map(
                (city) => (
                  <li key={city}>
                    <button
                      type="button"
                      onClick={() => (onSelectLocation ? onSelectLocation(city) : undefined)}
                      className="flex items-center gap-1.5 text-slate-300 hover:text-[#4ADE80] transition-colors group text-left cursor-pointer"
                    >
                      <MapPin className="w-3 h-3 text-[#4ADE80]" />
                      <span>{city}</span>
                    </button>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>

        {/* Global Portals Strip */}
        {(onOpenInternationalJobs || onOpenImmigration || onOpenScholarships) && (
          <div className="mt-10 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4ADE80]">
              Global Pathways
            </span>
            <div className="flex flex-wrap items-center gap-5">
              {onOpenInternationalJobs && (
                <button
                  type="button"
                  onClick={onOpenInternationalJobs}
                  className="text-slate-300 hover:text-[#4ADE80] font-medium transition-colors cursor-pointer"
                >
                  International Jobs
                </button>
              )}
              {onOpenImmigration && (
                <button
                  type="button"
                  onClick={onOpenImmigration}
                  className="text-slate-300 hover:text-[#4ADE80] font-medium transition-colors cursor-pointer"
                >
                  Immigration &amp; Residence
                </button>
              )}
              {onOpenScholarships && (
                <button
                  type="button"
                  onClick={onOpenScholarships}
                  className="text-slate-300 hover:text-[#4ADE80] font-medium transition-colors cursor-pointer"
                >
                  Scholarships
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quiet Copyright & Verification */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-center md:text-left">
            <Shield className="w-4 h-4 text-[#4ADE80] shrink-0" />
            <span>Verified Ethiopian Vacancies · Direct Official Application Links</span>
          </div>
          <span>© {new Date().getFullYear()} HopelandJobs. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
};
