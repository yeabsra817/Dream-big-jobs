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
} from 'lucide-react';
import {
  NotificationPermissionState,
  NotificationPreferencesRecord,
} from '../types/jobSeeker';
import {
  isIosSafariNeedsInstall,
  requestAndEnableNotifications,
  getBrowserNotificationPermission,
} from '../lib/notificationService';

interface Props {
  isOpen: boolean;
  uid?: string | null;
  userEmail?: string | null;
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

  const isIosInstallNeeded = reason === 'ios_install_required' || isIosSafariNeedsInstall();
  const isBlocked = !isIosInstallNeeded && (reason === 'blocked_in_browser' || currentPerm === 'denied');
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleEnableClick = async () => {
    const livePerm = getBrowserNotificationPermission();
    setCurrentPerm(livePerm);
    if (livePerm === 'denied') {
      setFeedback({
        type: 'error',
        text: 'Notifications are currently blocked by your browser. Follow the steps above to allow them in browser settings.',
      });
      return;
    }

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
          type: result.permissionStatus === 'denied' ? 'error' : 'info',
          text:
            isInIframe && result.permissionStatus !== 'granted'
              ? 'Your browser is inside an embedded preview frame which blocks notification prompts. Tap "Open App in Chrome Tab" below to activate phone bar alerts.'
              : result.message,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text:
          isInIframe
            ? 'Embedded preview blocked the permission dialog. Tap "Open App in Chrome Tab" below to allow notifications.'
            : err?.message || 'Unable to activate notifications right now.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckAgain = async () => {
    const fresh = getBrowserNotificationPermission();
    setCurrentPerm(fresh);
    if (isIosSafariNeedsInstall()) {
      setFeedback({
        type: 'info',
        text: 'Please tap Share -> Add to Home Screen in Safari, then open the installed HopelandJobs app from your Home Screen.',
      });
      return;
    }
    if (fresh === 'denied') {
      setFeedback({
        type: 'error',
        text: 'Notifications are still blocked in your browser settings. Please change Notifications to Allow for hopelandjobs.tech, then tap Check Again.',
      });
      return;
    }
    if (fresh === 'granted' || fresh === 'default') {
      await handleEnableClick();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-permission-title"
    >
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Header */}
        <div className="bg-[#0B132B] text-white px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
              {isBlocked ? <ShieldAlert className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
            </div>
            <div>
              <h2 id="notif-permission-title" className="text-base font-extrabold text-white">
                {isBlocked ? 'Notifications Blocked in Browser' : 'Never Miss a Job Opportunity!'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {isBlocked
                  ? 'Allow browser notifications in your device or site settings to receive instant Hopeland Jobs alerts.'
                  : 'Hopeland Jobs — Instant Phone Bar & Desktop Alerts'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose(true)}
            aria-label="Not Now"
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {isBlocked ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2.5 text-xs text-rose-950">
              <p className="font-bold">How to enable notifications in your browser settings:</p>
              <ol className="list-decimal pl-4 space-y-1.5 text-rose-900 leading-relaxed">
                <li>
                  <strong>Desktop Chrome / Edge (Windows &amp; Mac):</strong> Click the tune/lock icon to the left of the address bar, open{' '}
                  <strong>Site settings</strong> (or Permissions), and set <strong>Notifications</strong> to{' '}
                  <strong>Allow</strong>.
                </li>
                <li>
                  <strong>Android Chrome:</strong> Tap the tune/lock icon next to the URL (or menu <strong>⋮ → Settings → Site settings → Notifications</strong>), select this site, and toggle <strong>Allow notifications</strong>.
                </li>
                <li>
                  <strong>iPhone / iPad App (iOS 16.4+):</strong> Open iPhone <strong>Settings → Notifications → HopelandJobs</strong> and toggle <strong>Allow Notifications</strong>.
                </li>
                <li>
                  Return here and click <strong>Check Again</strong> below to finish activating your subscription.
                </li>
              </ol>
            </div>
          ) : isIosInstallNeeded ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                Enable instant job alerts and get notified whenever new vacancies matching your qualifications, education, experience, and preferred industry are published.
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
                  <span>Strictly qualified matches only — maximum 3 relevant jobs per day, never unrelated openings.</span>
                </div>
              </div>
            </div>
          )}

          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border ${
                feedback.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {isInIframe && !isBlocked && !isIosInstallNeeded && (
            <a
              href={typeof window !== 'undefined' ? window.location.href : '/'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Smartphone className="w-4 h-4 text-emerald-700" />
              <span>Open App in Chrome Tab (for Phone Bar Prompt)</span>
            </a>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            {isBlocked ? (
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
