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
  Laptop,
} from 'lucide-react';
import { AppBrandLogo } from './AppBrandLogo';
import { buildStandaloneAppInstallUrl, isRunningInEmbeddedIframe } from '../lib/notificationService';
import type { DesktopOsType } from '../hooks/usePWAInstall';

interface Props {
  isOpen: boolean;
  appLogoUrl?: string | null;
  customDomain?: string | null;
  canInstallNative: boolean;
  isIOS: boolean;
  isDesktop?: boolean;
  desktopOs?: DesktopOsType;
  isInAppBrowser?: boolean;
  onInstallNative: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  onDismiss: () => void;
}

function buildAndroidChromeIntentUrl(customDomain?: string | null): string {
  const cleanHost = String(customDomain || 'www.hopelandjobs.tech')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '') || 'www.hopelandjobs.tech';
  const host = cleanHost === 'hopelandjobs.tech' ? 'www.hopelandjobs.tech' : cleanHost;
  return `intent://${host}/?installApp=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
    `https://${host}/?installApp=1`
  )};end`;
}

export const PWAInstallPromptModal: React.FC<Props> = ({
  isOpen,
  appLogoUrl,
  customDomain,
  canInstallNative,
  isIOS,
  isDesktop = false,
  desktopOs = 'windows',
  isInAppBrowser = false,
  onInstallNative,
  onDismiss,
}) => {
  const [installing, setInstalling] = useState(false);
  const [manualFallback, setManualFallback] = useState(false);
  const [downloadStartedMsg, setDownloadStartedMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isInIframe = isRunningInEmbeddedIframe();
  const standaloneUrl = buildStandaloneAppInstallUrl(customDomain);
  const chromeIntentUrl = buildAndroidChromeIntentUrl(customDomain);
  const desktopDownloadUrl = `/api/download/desktop-app?os=${encodeURIComponent(desktopOs)}`;
  const iosProfileDownloadUrl = '/api/download/ios-app-profile';

  const desktopOsLabel =
    desktopOs === 'mac' ? 'Mac' : desktopOs === 'linux' ? 'Linux' : 'Windows';

  const triggerDirectFileDownload = (href: string, message: string) => {
    setDownloadStartedMsg(message);
    if (typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.href = href;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (typeof window !== 'undefined') {
      window.location.href = href;
    }
  };

  const handlePrimaryDownloadClick = async () => {
    setInstalling(true);
    setDownloadStartedMsg(null);
    try {
      // 1. iPhone / iPad -> immediately trigger native iOS App WebClip profile download
      if (isIOS) {
        triggerDirectFileDownload(
          iosProfileDownloadUrl,
          'Download started! Tap "Allow", then open iPhone Settings → Profile Downloaded → Install (or tap Share → Add to Home Screen in Safari).'
        );
        return;
      }

      // 2. Android inside Telegram / Facebook / Instagram in-app WebView -> jump directly into Chrome installer
      if (isInAppBrowser && !isDesktop) {
        setDownloadStartedMsg('Opening Google Chrome to start your HopelandJobs app download...');
        window.location.href = chromeIntentUrl;
        return;
      }

      // 3. Try native OS PWA install prompt first (Android Chrome/Edge/Samsung + Windows/Mac Chrome/Edge)
      const outcome = await onInstallNative();
      if (outcome === 'accepted') {
        onDismiss();
        return;
      }
      if (outcome === 'dismissed') {
        return;
      }

      // 4. Computer fallback (Firefox, Safari Mac, or Chrome prompt cooldown) -> immediate real Desktop App launcher download
      if (isDesktop) {
        triggerDirectFileDownload(
          desktopDownloadUrl,
          `Download started for ${desktopOsLabel}! Open the downloaded HopelandJobs app file — or click the Install icon in Chrome/Edge's address bar.`
        );
        setManualFallback(true);
        return;
      }

      // 5. Android browser fallback (if Chrome cooldown is active or non-Chromium mobile browser)
      setManualFallback(true);
      setDownloadStartedMsg(
        'Opening Chrome install view — or tap Chrome menu (⋮) at top-right → "Install app" to install immediately.'
      );
      window.location.href = chromeIntentUrl;
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
        className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans','Noto_Sans_Ethiopic',sans-serif] max-h-[92vh] overflow-y-auto"
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
                {isIOS
                  ? 'iPhone & iPad Ready · ለአይፎን እና አይፓድ'
                  : isDesktop
                  ? `Ready for ${desktopOsLabel} Computer · ለኮምፒውተር`
                  : 'Android, iPhone & Computer Ready · ለስልክ እና ለኮምፒውተር'}
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
                  <strong className="text-[#0B132B]">Phone &amp; Computer Ready:</strong> Works on Android, iPhone, Windows, and Mac with instant launch.
                </p>
                <p className="font-semibold text-[#15803D]">
                  በአንድሮይድ፣ በአይፎን እና በኮምፒውተር ላይ በቀላሉ ይጫናል።
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Bell className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p>
                  <strong className="text-[#0B132B]">Instant Phone-Bar Job Alerts:</strong> Get matched banking, NGO, health &amp; engineering jobs directly on your screen.
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
                  <strong className="text-[#0B132B]">100% Optional &amp; Fast:</strong> Uses less mobile data and opens jobs instantly — or keep using the website anytime.
                </p>
                <p className="font-semibold text-[#15803D]">
                  ሙሉ በሙሉ አማራጭ ነው — ፈጣን እና አነስተኛ ዳታ ይጠቀማል።
                </p>
              </div>
            </div>
          </div>

          {downloadStartedMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-semibold leading-relaxed flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{downloadStartedMsg}</span>
            </div>
          )}

          {isIOS ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2 leading-relaxed">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-700" />
                <span>iPhone / iPad Install · በአይፎን ላይ ለመጫን:</span>
              </p>
              <p className="text-slate-800">
                Tap <strong>Download iPhone App</strong> below to start downloading directly, OR use Safari&apos;s quick 2-tap install:
              </p>
              <ol className="space-y-1 list-decimal pl-4">
                <li>
                  Tap <Share className="w-3.5 h-3.5 inline mx-0.5 text-sky-700" /> <strong>Share</strong> in Safari (የShare ቁልፍን ይጫኑ).
                </li>
                <li>
                  Tap <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-slate-800" /> <strong>Add to Home Screen</strong> → <strong>Add</strong>.
                </li>
              </ol>
            </div>
          ) : isInIframe ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1.5 leading-relaxed">
              <p className="font-bold text-slate-900">Open Full Browser Tab to Download:</p>
              <p>
                Tap below to open HopelandJobs directly in your browser so the native app download starts immediately.
              </p>
            </div>
          ) : isInAppBrowser && !isDesktop ? (
            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 space-y-1.5 leading-relaxed">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                <span>Telegram / In-App Browser Detected · በChrome ይጫኑ:</span>
              </p>
              <p>
                Tap <strong>Open in Chrome &amp; Download</strong> below so Android starts downloading &amp; installing the HopelandJobs app directly to your Home Screen.
              </p>
            </div>
          ) : !canInstallNative || manualFallback ? (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                {isDesktop ? (
                  <Laptop className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                ) : (
                  <MoreVertical className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                )}
                <span>
                  {isDesktop
                    ? `Download on ${desktopOsLabel} Computer · ለኮምፒውተር:`
                    : 'Install on Android Phone · በአንድሮይድ ስልክ:'}
                </span>
              </p>
              {isDesktop ? (
                <p>
                  Click <strong>Download for {desktopOsLabel}</strong> below to download the HopelandJobs launcher immediately — or click the <strong>Install</strong> icon in the Chrome / Edge address bar.
                </p>
              ) : (
                <p>
                  Tap <strong>Download App Now</strong> below — or tap Chrome&apos;s top-right menu (<strong>⋮</strong>) → <strong>Install app</strong> (<strong>Add to Home screen</strong>).
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
                <span>Open &amp; Download App · ያውርዱ</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={handlePrimaryDownloadClick}
                disabled={installing}
                className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#16A34A] to-[#059669] hover:from-[#15803D] hover:to-[#047857] text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/25 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>
                  {installing
                    ? 'Starting Download...'
                    : isIOS
                    ? 'Download iPhone App · ለአይፎን ያውርዱ'
                    : isInAppBrowser && !isDesktop
                    ? 'Open in Chrome & Download · ያውርዱ'
                    : canInstallNative
                    ? isDesktop
                      ? `Install on ${desktopOsLabel} · አሁን ጫን`
                      : 'Download & Install App · አፑን ያውርዱ'
                    : isDesktop
                    ? `Download for ${desktopOsLabel} · ያውርዱ`
                    : 'Download App Now · አፑን ያውርዱ'}
                </span>
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
