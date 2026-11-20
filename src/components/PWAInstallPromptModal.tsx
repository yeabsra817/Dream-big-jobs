import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Monitor,
  Bell,
  Share,
  PlusSquare,
  ExternalLink,
  X,
  CheckCircle2,
  MoreVertical,
} from 'lucide-react';
import { AppBrandLogo } from './AppBrandLogo';
import { buildStandaloneAppInstallUrl, isRunningInEmbeddedIframe } from '../lib/notificationService';

interface Props {
  isOpen: boolean;
  appLogoUrl?: string | null;
  customDomain?: string | null;
  canInstallNative: boolean;
  isIOS: boolean;
  isDesktop?: boolean;
  onInstallNative: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  onDismiss: () => void;
}

export const PWAInstallPromptModal: React.FC<Props> = ({
  isOpen,
  appLogoUrl,
  customDomain,
  canInstallNative,
  isIOS,
  isDesktop = false,
  onInstallNative,
  onDismiss,
}) => {
  const [installing, setInstalling] = useState(false);
  const [manualFallback, setManualFallback] = useState(false);

  if (!isOpen) return null;

  const isInIframe = isRunningInEmbeddedIframe();
  const standaloneUrl = buildStandaloneAppInstallUrl(customDomain);

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
        className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans','Noto_Sans_Ethiopic',sans-serif]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#0B132B] via-[#132959] to-[#0B132B] text-white px-5 py-4 flex items-center justify-between gap-3 border-b border-amber-400/25">
          <div className="flex items-center gap-3 min-w-0">
            <AppBrandLogo logoUrl={appLogoUrl} size="lg" variant="green" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-amber-300">
                Optional App · አማራጭ መተግበሪያ
              </p>
              <h2 id="pwa-install-title" className="text-[15px] sm:text-base font-extrabold text-white leading-snug">
                Download HopelandJobs · አፑን ያውርዱ
              </h2>
              <p className="text-xs font-medium text-emerald-200 mt-0.5">
                {isDesktop
                  ? 'Works on Windows, Mac & Mobile · ለኮምፒውተር እና ለስልክ'
                  : 'Works on Phone & Computer · ለስልክ እና ለኮምፒውተር'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close download dialog"
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-gradient-to-br from-emerald-50/80 via-white to-amber-50/60 border-2 border-emerald-200/80 p-4 space-y-3 text-xs text-slate-800">
            <p className="font-extrabold text-[#0B132B] text-[13px]">
              Why Download? · <span className="text-[#15803D]">አፑን የማውረድ ጥቅሞች</span>
            </p>
            <div className="flex items-start gap-2.5">
              <Monitor className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p>
                  <strong className="text-[#0B132B]">Phone &amp; Computer Ready:</strong> Install on Android, iPhone, Windows, or Mac with one tap.
                </p>
                <p className="font-semibold text-[#15803D]">
                  በስልክዎም ሆነ በኮምፒውተርዎ ላይ በ1 ንክኪ ይጫናል።
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Bell className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p>
                  <strong className="text-[#0B132B]">Instant Phone-Bar Job Alerts:</strong> Get matched banking, NGO &amp; visa openings directly on your screen.
                </p>
                <p className="font-semibold text-[#15803D]">
                  አዳዲስ የስራ ማስታወቂያዎች በስልክዎ ባር ላይ ቀጥታ ይደርስዎታል።
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p>
                  <strong className="text-[#0B132B]">100% Optional &amp; Fast:</strong> Saves data and opens instantly — or keep using the website anytime.
                </p>
                <p className="font-semibold text-[#15803D]">
                  ሙሉ በሙሉ አማራጭ ነው — ፈጣን እና አነስተኛ ዳታ ይጠቀማል።
                </p>
              </div>
            </div>
          </div>

          {isIOS ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2 leading-relaxed">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-700" />
                <span>Install on iPhone / iPad Safari · በአይፎን ላይ ለመጫን:</span>
              </p>
              <ol className="space-y-1.5 list-decimal pl-4">
                <li>
                  Tap the <Share className="w-3.5 h-3.5 inline mx-0.5 text-sky-700" /> <strong>Share</strong> icon in Safari (የShare ቁልፍን ይጫኑ).
                </li>
                <li>
                  Tap <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-slate-800" /> <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                </li>
              </ol>
            </div>
          ) : isInIframe ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1.5 leading-relaxed">
              <p className="font-bold text-slate-900">Open Full Browser Tab to Install:</p>
              <p>
                Tap below to open HopelandJobs in Chrome or Edge on your phone or computer and tap <strong>Download App</strong>.
              </p>
            </div>
          ) : !canInstallNative || manualFallback ? (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                {isDesktop ? (
                  <Monitor className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                ) : (
                  <MoreVertical className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                )}
                <span>
                  {isDesktop
                    ? 'Install on Your Computer (Chrome / Edge):'
                    : 'Install on Your Phone (Chrome / Browser):'}
                </span>
              </p>
              {isDesktop ? (
                <p>
                  Click the <strong>Install icon</strong> in the right side of the browser address bar (or open menu <strong>⋮ → Install HopelandJobs</strong>) to add it to your Desktop, Start Menu, or Dock.
                </p>
              ) : (
                <p>
                  Tap Chrome&apos;s menu (<strong>⋮</strong>) at the top-right and tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
                </p>
              )}
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {isInIframe ? (
              <a
                href={standaloneUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onDismiss}
                className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#0B132B] font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-all shadow-sm whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>Open Full Tab to Install</span>
              </a>
            ) : canInstallNative && !isIOS ? (
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={installing}
                className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#0B132B] font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>
                  {installing
                    ? 'Downloading...'
                    : isDesktop
                    ? 'Download for Computer · ያውርዱ'
                    : 'Download App · አፑን ያውርዱ'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onDismiss}
                className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#16A34A] to-[#059669] hover:from-[#15803D] hover:to-[#047857] text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Got It · እሺ</span>
              </button>
            )}

            <button
              type="button"
              onClick={onDismiss}
              className="min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              Not Now · በኋላ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
