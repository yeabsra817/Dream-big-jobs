import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Bell,
  Share,
  PlusSquare,
  ExternalLink,
  X,
  CheckCircle2,
  MoreVertical,
} from 'lucide-react';
import { AppBrandLogo } from './AppBrandLogo';
import { buildStandalonePushActivationUrl, isRunningInEmbeddedIframe } from '../lib/notificationService';

interface Props {
  isOpen: boolean;
  appLogoUrl?: string | null;
  canInstallNative: boolean;
  isIOS: boolean;
  onInstallNative: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  onDismiss: () => void;
}

export const PWAInstallPromptModal: React.FC<Props> = ({
  isOpen,
  appLogoUrl,
  canInstallNative,
  isIOS,
  onInstallNative,
  onDismiss,
}) => {
  const [installing, setInstalling] = useState(false);
  const [manualFallback, setManualFallback] = useState(false);

  if (!isOpen) return null;

  const isInIframe = isRunningInEmbeddedIframe();
  const standaloneUrl = buildStandalonePushActivationUrl();

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      const outcome = await onInstallNative();
      if (outcome === 'accepted') {
        onDismiss();
      } else if (outcome === 'unavailable') {
        setManualFallback(true);
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#0B132B] text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AppBrandLogo logoUrl={appLogoUrl} size="lg" variant="green" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 id="pwa-install-title" className="text-base font-extrabold text-white truncate">
                  Download HopelandJobs App
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Install on your phone for instant job bar alerts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close download invitation"
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-2 text-xs text-slate-800">
            <div className="flex items-start gap-2">
              <Bell className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
              <span>
                <strong>Phone Bar Notifications:</strong> Receive matched banking, NGO &amp; visa job alerts right in your mobile notification bar.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Smartphone className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
              <span>
                <strong>1-Tap Home Screen Access:</strong> Open verified jobs fast like a native app without searching the browser.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
              <span>
                <strong>Fast 1-Click Website Apply:</strong> Apply directly with your saved profile &amp; CV.
              </span>
            </div>
          </div>

          {isIOS ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2 leading-relaxed">
              <p className="font-extrabold text-slate-900">How to Install on iPhone / iPad Safari:</p>
              <ol className="space-y-1.5 list-decimal pl-4">
                <li>
                  Tap the <Share className="w-3.5 h-3.5 inline mx-0.5 text-sky-700" /> <strong>Share</strong> icon in Safari.
                </li>
                <li>
                  Tap <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-slate-800" /> <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                </li>
              </ol>
            </div>
          ) : isInIframe ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2 leading-relaxed">
              <p className="font-extrabold text-slate-900">Download from Chrome Browser Tab:</p>
              <p>
                Preview frames restrict direct app downloads. Tap below to open HopelandJobs in your main browser tab and tap <strong>Install / Add to Home screen</strong>.
              </p>
            </div>
          ) : !canInstallNative || manualFallback ? (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
              <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <MoreVertical className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                <span>Quick Browser Install Steps:</span>
              </p>
              <p>
                Tap your browser menu (<strong>⋮</strong> or <strong>Install icon</strong> in the address bar) and choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {isInIframe ? (
              <a
                href={standaloneUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onDismiss}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>Open Chrome to Download</span>
              </a>
            ) : canInstallNative && !isIOS ? (
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={installing}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>{installing ? 'Installing App...' : 'Download & Install App'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onDismiss}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>{isIOS ? 'Got It — Add Now' : 'Install via Browser Menu'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onDismiss}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
