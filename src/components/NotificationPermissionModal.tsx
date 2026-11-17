import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Smartphone,
  ShieldAlert,
  X,
  RefreshCw,
  Share,
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
  uid: string;
  userEmail?: string | null;
  reason: 'first_time' | 'not_enabled_yet' | 'renew_device' | 'blocked_in_browser' | 'unsupported';
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

  if (!isOpen) return null;

  const isIosInstallNeeded = isIosSafariNeedsInstall();
  const isBlocked = reason === 'blocked_in_browser' || currentPerm === 'denied';

  const handleEnableClick = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const result = await requestAndEnableNotifications(uid, {
        emailAlerts: false,
        websiteBell: true,
        email: userEmail,
      });
      setCurrentPerm(result.permissionStatus);
      if (result.success) {
        onEnabled(result.preferences, result.message);
      } else {
        setFeedback({
          type: result.permissionStatus === 'denied' ? 'error' : 'info',
          text: result.message,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Unable to activate notifications right now.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckAgain = async () => {
    const fresh = getBrowserNotificationPermission();
    setCurrentPerm(fresh);
    if (fresh === 'granted' || fresh === 'default') {
      await handleEnableClick();
    } else {
      setFeedback({
        type: 'error',
        text: 'Notifications are still blocked in your browser settings. Please allow notifications for this site, then try again.',
      });
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
                {isBlocked
                  ? 'Unblock Instant Job Push Alerts'
                  : reason === 'renew_device'
                  ? 'Activate Push Alerts on This Device'
                  : 'Instant Job Push Notifications'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {reason === 'renew_device'
                  ? 'Reconnect browser & mobile push alerts so newly published matching jobs arrive directly.'
                  : 'Real-time Web Push straight to your Android or desktop notification panel — no email needed.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose(true)}
            aria-label="Close notification setup"
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {isBlocked ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2 text-xs text-rose-950">
              <p className="font-bold">Browser permission was previously blocked</p>
              <ol className="list-decimal pl-4 space-y-1.5 text-rose-900 leading-relaxed">
                <li>Click the lock or site-settings icon in your browser address bar.</li>
                <li>Locate <strong>Notifications</strong> and switch it to <strong>Allow</strong>.</li>
                <li>Click <strong>Check Again</strong> below to activate push alerts on this device.</li>
              </ol>
            </div>
          ) : isIosInstallNeeded ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-950">
              <div className="flex items-center gap-2 font-bold">
                <Share className="w-4 h-4 text-amber-700 shrink-0" />
                <span>iPhone / iPad Push Setup</span>
              </div>
              <p className="text-amber-900 leading-relaxed">
                In Safari on iOS, tap the <strong>Share</strong> icon and choose{' '}
                <strong>Add to Home Screen</strong> to receive iOS lock-screen push notifications.
                Your Website Notification Bell will work right away!
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Instant push alerts delivered the moment a vacancy matches your education, experience, industry, and desired position.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Delivered directly to Android &amp; desktop notification panels with 1-tap open to apply.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Focused &amp; spam-free: max 3 job alerts per day, 1 notification per matching job, zero email required.</span>
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
                <span>{isLoading ? 'Checking...' : 'Check Again'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEnableClick}
                disabled={isLoading}
                className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs tracking-wide inline-flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span>
                  {isLoading
                    ? 'Enabling...'
                    : isIosInstallNeeded
                    ? 'Enable Notification Bell'
                    : 'ENABLE PUSH NOTIFICATIONS'}
                </span>
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
