import React from 'react';
import {
  X,
  Heart,
  Building,
  MapPin,
  Calendar,
  Trash2,
  ExternalLink,
  Clock,
  Briefcase,
  ChevronRight,
  Send,
} from 'lucide-react';
import { Vacancy } from '../types/job';
import { getDaysLeft } from '../utils/helpers';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  savedVacancies: Vacancy[];
  onRemoveSaved: (id: string) => void;
  onClearAll: () => void;
  onSelectVacancy: (vacancy: Vacancy) => void;
  telegramUrl: string;
}

export const SavedJobsDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  savedVacancies,
  onRemoveSaved,
  onClearAll,
  onSelectVacancy,
  telegramUrl,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="bg-[#0B132B] text-white p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                Saved Vacancies ({savedVacancies.length})
              </h2>
              <p className="text-[11px] text-slate-400">
                Bookmarked opportunities stored locally on your device
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Saved Jobs List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {savedVacancies.length === 0 ? (
            <div className="py-20 text-center max-w-xs mx-auto space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                No Saved Vacancies Yet
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Click the heart icon on any job card to save it for easy access later. Saved jobs stay
                here even if you close the browser.
              </p>
            </div>
          ) : (
            savedVacancies.map((vacancy) => {
              const daysInfo = getDaysLeft(vacancy.applicationDeadline);

              return (
                <div
                  key={vacancy.id}
                  onClick={() => {
                    onSelectVacancy(vacancy);
                    onClose();
                  }}
                  className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer space-y-2 relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 line-clamp-1">
                      {vacancy.category}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSaved(vacancy.id);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                      title="Remove from saved jobs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors leading-snug line-clamp-2">
                    {vacancy.title}
                  </h4>

                  <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="line-clamp-1">{vacancy.organization}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-500">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="line-clamp-1">{vacancy.location}</span>
                    </div>

                    <div className="flex items-center gap-1 font-semibold text-slate-700">
                      <Clock className="w-3 h-3" />
                      <span>{daysInfo.text}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        {savedVacancies.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <button
              onClick={onClearAll}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>

            <a
              href={telegramUrl || 'https://t.me/DreamBigJobsEthiopia'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5 fill-current" />
              <span>Telegram Alerts</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
