import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { AppBrandLogo } from './AppBrandLogo';

interface Props {
  isOpen: boolean;
  appLogoUrl?: string | null;
  isDesktop?: boolean;
  onDirectDownload: () => Promise<void>;
  onDismiss: () => void;
}

export const AppDownloadReminderBanner: React.FC<Props> = ({
  isOpen,
  appLogoUrl,
  isDesktop = false,
  onDirectDownload,
  onDismiss,
}) => {
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const handleTouchDownload = async () => {
    setDownloading(true);
    try {
      await onDirectDownload();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Download HopelandJobs application"
      className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-[65] w-[calc(100%-1.5rem)] max-w-md animate-in fade-in slide-in-from-top-3 duration-200 font-['Plus_Jakarta_Sans',sans-serif]"
    >
      <div className="bg-[#0B132B]/95 backdrop-blur-md text-white rounded-2xl border border-white/15 shadow-[0_14px_40px_rgba(11,19,43,0.45)] px-3.5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <AppBrandLogo logoUrl={appLogoUrl} size="sm" variant="green" />
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400/85 shadow-[0_0_8px_rgba(74,222,128,0.85)] animate-pulse"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-white truncate">
              Download HopelandJobs App
            </p>
            <p className="text-[11px] text-slate-300 truncate">
              {isDesktop
                ? 'Install directly on your computer'
                : 'Direct 1-tap install for your phone'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleTouchDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.98] text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>{downloading ? 'Downloading...' : 'Download'}</span>
          </button>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close download prompt"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
