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
      className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-[65] w-[calc(100%-1.5rem)] max-w-md animate-in fade-in slide-in-from-top-3 duration-200 font-['Plus_Jakarta_Sans','Noto_Sans_Ethiopic',sans-serif]"
    >
      <div className="bg-gradient-to-r from-[#0B132B] via-[#132959] to-[#0B132B] backdrop-blur-md text-white rounded-2xl border-2 border-amber-400/45 shadow-[0_16px_44px_rgba(11,19,43,0.5)] px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <AppBrandLogo logoUrl={appLogoUrl} size="sm" variant="green" className="shrink-0" />
          <div className="min-w-0">
            <p className="text-xs sm:text-[13px] font-extrabold text-white truncate">
              Download App · <span className="text-amber-300">አፑን ያውርዱ</span>
            </p>
            <p className="text-[11px] font-semibold text-emerald-200 truncate">
              {isDesktop
                ? 'Fast access & alerts on PC (Optional)'
                : 'Instant phone-bar job alerts (Optional)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleTouchDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] text-[#0B132B] font-extrabold text-xs transition-all shadow-sm shadow-amber-500/30 cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>{downloading ? 'Downloading...' : 'Download'}</span>
          </button>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close download prompt"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
