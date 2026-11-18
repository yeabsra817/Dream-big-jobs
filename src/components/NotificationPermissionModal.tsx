import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Smartphone,
  ShieldAlert,
  X,
  RefreshCw,
  Share,
  PlusSquare,
  ExternalLink,
} from 'lucide-react';
import {
  NotificationPermissionState,
  NotificationPreferencesRecord,
} from '../types/jobSeeker';
import {
  isIosSafariNeedsInstall,
  isRunningInEmbeddedIframe,
  buildStandalonePushActivationUrl,
  requestAndEnableNotifications,
  getBrowserNotificationPermission,
} from '../lib/notificationService';
import { AppBrandLogo } from './AppBrandLogo';

interface Props {
  isOpen: boolean;
  uid?: string | null;
  userEmail?: string | null;
  appLogoUrl?: string | null;
  reason:
    | 'first_time'
    | 'not_enabled_yet'
    | 'renew_device'
    | 'blocked_in_browser'
    | 'ios_install_required'
    | 'unsupported';
  initialEmailAlerts?: boolean;
  onClose: (dismissed: boolean) => void;
  onEnabled: (prefs: NotificationPreferencesRecord | null, msg: string) => void;
}

export const NotificationPermissionModal: React.FC<Props> = ({
  isOpen,
  uid,
  userEmail,
  appLogoUrl,
  reason,
  onClose,
  onEnabled,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'info' | 'success'; text: string } | null>(null);
  const [currentPerm, setCurrentPerm] = useState<NotificationPermissionState>(() =>
    getBrowserNotificationPermission()
  );

  useEffect(() => {
    if (isOpen) {
      setCurrentPerm(getBrowserNotificationPermission());
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isInIframe = isRunningInEmbeddedIframe();
  const isIosInstallNeeded = reason === 'ios_install_required' || isIosSafariNeedsInstall();
  const isBlockedOrDenied = !isIosInstallNeeded && (reason === 'blocked_in_browser' || currentPerm === 'denied');
  const isIframeBlocked = isInIframe && isBlockedOrDenied;
  const isBrowserBlocked = !isInIframe && isBlockedOrDenied;
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'hopelandjobs.tech';
  const standaloneUrl = buildStandalonePushActivationUrl();

  const handleEnableClick = async () => {
    const livePerm = getBrowserNotificationPermission();
    setCurrentPerm(livePerm);

    setIsLoading(true);
    setFeedback(null);
    try {
      const result = await requestAndEnableNotifications(uid || null, {
        emailAlerts: false,
        websiteBell: true,
        email: userEmail || null,
      });
      setCurrentPerm(result.permissionStatus);
      if (result.success && result.subscriptionActive) {
        onEnabled(result.preferences, result.message);
      } else {
        setFeedback({
          type: result.permissionStatus === 'denied' && !isInIframe ? 'error' : 'info',
          text:
            isInIframe && result.permissionStatus !== 'granted'
              ? `Chrome blocks notification popups inside this embedded preview frame (even when Notifications are set to "Ask first"). Tap "Open App in Chrome Tab" below to activate phone bar alerts for ${currentHost}.`
              : result.message,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: isInIframe
          ? 'Embedded preview blocked the permission dialog. Tap "Open App in Chrome Tab" below to allow notifications.'
          : err?.message || 'Unable to activate notifications right now.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckAgain = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      let fresh = getBrowserNotificationPermission();
      setCurrentPerm(fresh);

      if (isIosSafariNeedsInstall()) {
        setFeedback({
          type: 'info',
          text: 'Please tap Share -> Add to Home Screen in Safari, then open the installed HopelandJobs app from your Home Screen.',
        });
        return;
      }

      // Re-query Permissions API in case Android Chrome updated permission after returning from Site Settings
      if (fresh === 'denied' && typeof navigator !== 'undefined' && navigator.permissions?.query) {
        try {
          const permQuery = await navigator.permissions.query({ name: 'notifications' as PermissionName });
          if (permQuery?.state === 'granted') {
            fresh = 'granted';
          } else if (permQuery?.state === 'prompt') {
            fresh = 'default';
          }
          setCurrentPerm(fresh);
        } catch {}
      }

      if (fresh === 'granted' || fresh === 'default') {
        setIsLoading(false);
        await handleEnableClick();
        return;
      }

      // Inside embedded iframe on Chrome, requestPermission is blocked by iframe policy regardless of Chrome settings
      if (isInIframe) {
        setFeedback({
          type: 'info',
          text: `Chrome Site Settings is fine, but Android Chrome blocks notification prompts inside this preview frame. Tap "Open App in Chrome Tab" below to allow phone bar notifications on ${currentHost}.`,
        });
        return;
      }

      // Top-level browser where Chrome still reports denied: attempt one safe user-gesture check in case browser unlocked
      if (typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function') {
        try {
          const reqRes = await Notification.requestPermission();
          if (reqRes === 'granted') {
            setCurrentPerm('granted');
            setIsLoading(false);
            await handleEnableClick();
            return;
          }
        } catch {}
      }

      setFeedback({
        type: 'error',
        text: `Notifications are still blocked in Chrome for ${currentHost}. Tap the tune/lock icon in Chrome's address bar -> Permissions -> Notifications -> Allow, then return and tap Check Again.`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-permission-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose(true);
      }}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[calc(100dvh-1.5rem)] flex flex-col font-['Plus_Jakarta_Sans',sans-serif]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0B132B] text-white px-5 py-4 sm:px-6 sm:py-5 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {isIframeBlocked || isBrowserBlocked ? (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                {isIframeBlocked ? (
                  <ExternalLink className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>
            ) : appLogoUrl ? (
              <AppBrandLogo logoUrl={appLogoUrl} size="lg" variant="amber" />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            )}
            <div className="min-w-0">
              <h2 id="notif-permission-title" className="text-sm sm:text-base font-extrabold text-white leading-snug">
                {isIframeBlocked
                  ? 'Open Chrome Tab for Phone Alerts'
                  : isBrowserBlocked
                  ? 'Notifications Blocked in Browser'
                  : 'Never Miss a Job Opportunity!'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {isIframeBlocked
                  ? 'Preview frame pauses Chrome permission popups — one tap opens the full site tab.'
                  : isBrowserBlocked
                  ? `Allow browser notifications for ${currentHost} to receive instant Hopeland Jobs alerts.`
                  : 'Hopeland Jobs — Instant Phone Bar & 3-Day Apply Reminders'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose(true)}
            aria-label="Not Now"
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {isIframeBlocked ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5 text-xs text-amber-950">
              <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Why &ldquo;Check Again&rdquo; Didn&rsquo;t Pop Up Here:</span>
              </p>
              <p className="text-amber-900 leading-relaxed">
                Your Chrome Site Settings for Notifications is fine (<strong>Ask first / Allow</strong>), but Chrome does{' '}
                <strong>not</strong> allow notification prompts inside embedded preview windows.
              </p>
              <p className="text-amber-900 leading-relaxed font-semibold">
                Tap <strong>Open App in Chrome Tab</strong> below — Chrome will immediately ask for notification permission and deliver real job alerts + every-3-days Apply reminders directly to your phone bar.
              </p>
            </div>
          ) : isBrowserBlocked ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2.5 text-xs text-rose-950">
              <p className="font-bold">How to enable notifications for {currentHost}:</p>
              <ol className="list-decimal pl-4 space-y-1.5 text-rose-900 leading-relaxed">
                <li>
                  <strong>Android Chrome:</strong> Tap the tune/lock icon to the left of the address bar →{' '}
                  <strong>Permissions</strong> → <strong>Notifications</strong> → select <strong>Allow</strong>.
                  (If Notifications is already Allow/Ask on All Sites, check <strong>Settings → Site settings → Notifications → {currentHost}</strong>.)
                </li>
                <li>
                  <strong>Desktop Chrome / Edge:</strong> Click the tune/lock icon left of the URL →{' '}
                  <strong>Site settings</strong> → set <strong>Notifications</strong> to <strong>Allow</strong>.
                </li>
                <li>
                  <strong>iPhone / iPad App (iOS 16.4+):</strong> Open iPhone <strong>Settings → Notifications → HopelandJobs</strong> and toggle <strong>Allow Notifications</strong>.
                </li>
                <li>
                  Tap <strong>Check Again</strong> below to finish activating phone bar delivery.
                </li>
              </ol>
            </div>
          ) : isIosInstallNeeded ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                Enable instant job alerts and get reminded every 3 days to apply for open jobs matching your qualifications and expertise.
              </p>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3 text-xs text-amber-950">
                <div className="flex items-center gap-2 font-extrabold text-slate-900">
                  <Smartphone className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>iPhone &amp; iPad Lock-Screen Push Setup (iOS 16.4+)</span>
                </div>
                <ol className="space-y-2 text-amber-950 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Tap the <Share className="w-3.5 h-3.5 inline mx-0.5 text-sky-700" /> <strong>Share</strong> icon in Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Scroll down and tap <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-slate-800" /> <strong>Add to Home Screen</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Open <strong>HopelandJobs</strong> from your iPhone/iPad Home Screen and tap <strong>Enable Notifications</strong>.
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                Phone bar job alerts are active by default once you fill your mandatory experience, years of experience, and job expertise (you can disable them anytime in Alert Preferences).
              </p>
              <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-start gap-2.5">
                  <Smartphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Delivered directly to your Android phone notification bar, iPhone Home Screen app, Windows, or Mac.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Strictly qualified matches only (max 3/day) — plus automatic Apply reminders every 3 days until you apply or the job closes.</span>
                </div>
              </div>
            </div>
          )}

          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border leading-relaxed ${
                feedback.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {isInIframe && !isIosInstallNeeded && (
            <a
              href={standaloneUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>Open App in Chrome Tab (Enable Phone Bar)</span>
            </a>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            {isBlockedOrDenied ? (
              <button
                type="button"
                onClick={handleCheckAgain}
                disabled={isLoading}
                className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Verifying...' : 'Check Again'}</span>
              </button>
            ) : isIosInstallNeeded ? (
              <button
                type="button"
                onClick={handleCheckAgain}
                disabled={isLoading}
                className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs tracking-wide inline-flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <PlusSquare className="w-4 h-4" />
                <span>I Added It / Check Status</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEnableClick}
                disabled={isLoading}
                className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs tracking-wide inline-flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span>{isLoading ? 'Subscribing...' : 'Allow Phone Notifications'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onClose(true)}
              disabled={isLoading}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

