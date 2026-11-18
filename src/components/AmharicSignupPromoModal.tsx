import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  UserPlus,
  X,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Share,
  PlusSquare,
  ExternalLink,
} from 'lucide-react';
import jobAlertPromoImg from '../assets/images/job_alert_promo_1794910907405.jpg';
import {
  getBrowserNotificationPermission,
  isIosSafariNeedsInstall,
  isRunningInEmbeddedIframe,
  buildStandalonePushActivationUrl,
  requestAndEnableNotifications,
} from '../lib/notificationService';
import { NotificationPermissionState } from '../types/jobSeeker';
import { AppBrandLogo } from './AppBrandLogo';

interface Props {
  isOpen: boolean;
  appLogoUrl?: string | null;
  hasActiveDevicePush?: boolean;
  onClose: (dismissed: boolean) => void;
  onSignUpClick: () => void;
  onNotificationsEnabled?: () => void;
}

const BENEFITS = [
  {
    am: 'በነፃ ይመዝገቡ።',
    en: 'Register free in seconds',
  },
  {
    am: 'የግል ፕሮፋይልዎን ይሙሉ።',
    en: 'Complete your professional profile',
  },
  {
    am: 'የስራ ፍላጎትዎን ይምረጡ።',
    en: 'Select your target career sectors',
  },
  {
    am: 'በየቀኑ አዳዲስ የስራ ማሳወቂያዎችን ያግኙ።',
    en: 'Receive matching daily job alerts',
  },
];

export const AmharicSignupPromoModal: React.FC<Props> = ({
  isOpen,
  appLogoUrl,
  hasActiveDevicePush = false,
  onClose,
  onSignUpClick,
  onNotificationsEnabled,
}) => {
  const [imgError, setImgError] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(hasActiveDevicePush);
  const [permState, setPermState] = useState<NotificationPermissionState>(() =>
    getBrowserNotificationPermission()
  );
  const [notifFeedback, setNotifFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPermState(getBrowserNotificationPermission());
      setNotifEnabled(hasActiveDevicePush);
      setNotifFeedback(null);
    }
  }, [isOpen, hasActiveDevicePush]);

  if (!isOpen) return null;

  const isInIframe = isRunningInEmbeddedIframe();
  const isIosNeedsInstall = isIosSafariNeedsInstall();
  const isBlocked = !isIosNeedsInstall && permState === 'denied';
  const standaloneUrl = buildStandalonePushActivationUrl();

  const handleEnableNotificationsClick = async () => {
    const livePerm = getBrowserNotificationPermission();
    setPermState(livePerm);

    if (isIosNeedsInstall) {
      setNotifFeedback({
        type: 'info',
        text: 'በ iPhone / iPad Safari ላይ Share -> Add to Home Screen በመጫን መተግበሪያውን ካስገቡ በኋላ ማሳወቂያውን ያብሩ።',
      });
      return;
    }

    if (livePerm === 'denied' && isInIframe) {
      setNotifFeedback({
        type: 'info',
        text: 'Chrome በዚህ ቅድመ እይታ መስኮት (preview frame) ውስጥ የማሳወቂያ ጥያቄን ይገድባል። ከታች "Open in Chrome Tab" የሚለውን ይጫኑ።',
      });
      return;
    }

    if (livePerm === 'denied') {
      setNotifFeedback({
        type: 'error',
        text: 'የድረገጽ ማሳወቂያ በብራውዘርዎ ተዘግቷል። ከአድራሻ ባሩ አጠገብ ያለውን ቁልፍ ተጭነው Notifications -> Allow ይምረጡ።',
      });
      return;
    }

    setIsSubscribing(true);
    setNotifFeedback(null);
    try {
      const res = await requestAndEnableNotifications(null, {
        emailAlerts: false,
        websiteBell: true,
      });
      setPermState(res.permissionStatus);
      if (res.success && res.subscriptionActive) {
        setNotifEnabled(true);
        setNotifFeedback({
          type: 'success',
          text: 'ማሳወቂያዎች በተሳካ ሁኔታ ተከፍተዋል! አሁን ከታች Sign Up / Register በመጫን ፕሮፋይልዎን ይሙሉ።',
        });
        onNotificationsEnabled?.();
      } else {
        setNotifFeedback({
          type: res.permissionStatus === 'denied' ? 'error' : 'info',
          text: res.message,
        });
      }
    } catch (err: any) {
      setNotifFeedback({
        type: 'error',
        text: err?.message || 'Unable to enable notifications right now.',
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="amharic-promo-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(true);
      }}
    >
      <div
        className="bg-[#FBFBFA] rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-auto font-['Noto_Sans_Ethiopic','Plus_Jakarta_Sans',sans-serif]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand Navy Header */}
        <div className="bg-[#0B132B] text-white px-5 py-4 sm:px-6 sm:py-5 relative">
          <button
            type="button"
            onClick={() => onClose(true)}
            aria-label="Close"
            className="absolute top-3.5 right-3.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2 pr-10">
            <AppBrandLogo logoUrl={appLogoUrl} size="xs" variant="amber" />
            <span className="text-xs font-extrabold tracking-wider text-amber-400 uppercase">
              HOPELAND JOBS · ETHIOPIA
            </span>
          </div>

          <h2
            id="amharic-promo-title"
            className="text-lg sm:text-xl font-extrabold text-white leading-snug pr-8"
          >
            🔔 የስራ እድሎችን አያምልጥዎ!
          </h2>
          <p className="text-xs sm:text-sm text-slate-200 mt-1.5 leading-relaxed">
            በየቀኑ አዳዲስ የስራ ማስታወቂያዎችን በቀጥታ ለማግኘት አሁኑኑ ይመዝገቡ!
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Benefits List */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 space-y-2">
            {BENEFITS.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-[13px] leading-snug">
                  <span className="font-bold text-slate-900">{item.am}</span>
                  <span className="text-slate-500 ml-1.5 text-[11px]">({item.en})</span>
                </div>
              </div>
            ))}
          </div>

          {/* Highly Visible Notification Activation Section with Illustration & Bell Icon */}
          <div className="rounded-xl border border-amber-300 bg-amber-50/85 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 p-3.5 sm:p-4">
              {/* Illustration Visual */}
              <div className="sm:col-span-5">
                {!imgError ? (
                  <img
                    src={jobAlertPromoImg}
                    alt="HopelandJobs Daily Job Alert Notification"
                    onError={() => setImgError(true)}
                    className="w-full h-24 sm:h-28 object-cover rounded-lg border border-slate-900/10 shadow-xs bg-[#0B132B]"
                  />
                ) : (
                  <div className="w-full h-24 sm:h-28 rounded-lg bg-[#0B132B] flex flex-col items-center justify-center text-white p-3">
                    <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center mb-1.5">
                      <Bell className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-amber-300">Daily Job Alerts</span>
                  </div>
                )}
              </div>

              {/* Notification Callout + Enable Notifications CTA */}
              <div className="sm:col-span-7 space-y-2.5">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 mt-0.5">
                    {isBlocked ? <ShieldAlert className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                  </div>
                  <p className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug">
                    🔔 የስራ ማሳወቂያዎችን በየቀኑ ለማግኘት ከታች ያለውን ፍቃድ ይስጡ።
                  </p>
                </div>

                {notifEnabled ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-extrabold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Notifications Enabled on This Device</span>
                  </div>
                ) : isIosNeedsInstall ? (
                  <div className="text-[11px] text-amber-950 bg-white/80 rounded-lg p-2 border border-amber-200 leading-relaxed">
                    <div className="font-bold flex items-center gap-1 mb-0.5">
                      <Smartphone className="w-3.5 h-3.5 text-amber-700" />
                      <span>iPhone / iPad Safari Setup:</span>
                    </div>
                    <span>
                      Tap <Share className="w-3 h-3 inline mx-0.5 text-sky-700" /> <strong>Share</strong> →{' '}
                      <PlusSquare className="w-3 h-3 inline mx-0.5" /> <strong>Add to Home Screen</strong>, then open the app to enable alerts.
                    </span>
                  </div>
                ) : isInIframe && isBlocked ? (
                  <a
                    href={standaloneUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs inline-flex items-center justify-center gap-2 transition-colors shadow-xs whitespace-nowrap"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span>Open in Chrome Tab</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnableNotificationsClick}
                    disabled={isSubscribing}
                    className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs inline-flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    <Bell className="w-4 h-4 shrink-0" />
                    <span>{isSubscribing ? 'Enabling Alerts...' : 'Enable Notifications'}</span>
                  </button>
                )}
              </div>
            </div>

            {notifFeedback && (
              <div
                className={`px-3.5 py-2.5 border-t text-[11px] font-semibold leading-relaxed ${
                  notifFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : notifFeedback.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-white border-amber-200 text-slate-800'
                }`}
              >
                {notifFeedback.text}
              </div>
            )}
          </div>

          {/* Primary & Secondary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onSignUpClick}
              className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Sign Up / Register</span>
            </button>

            <button
              type="button"
              onClick={() => onClose(true)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-200/80 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
