import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Briefcase,
  FileCheck2,
} from 'lucide-react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getAdditionalUserInfo,
  fetchJobSeekerProfile,
  saveJobSeekerProfile,
} from '../lib/firebase';
import { DEFAULT_JOB_SEEKER_PROFILE, JobSeekerProfile } from '../types/jobSeeker';
import { trackAnalyticsEvent } from '../lib/analyticsTracker';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup' | 'forgot';
  onSuccess?: (user: any, profile?: JobSeekerProfile) => void;
  message?: string;
}

export const UserAuthModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
  onSuccess,
  message,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(
    initialMode === 'signup' ? 'signup' : 'signin'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Synchronize internal mode with initialMode prop when modal is opened or mode switched
  React.useEffect(() => {
    setMode(initialMode === 'signup' ? 'signup' : 'signin');
    setError(null);
    setSuccessMsg(null);
  }, [initialMode, isOpen]);

  // Lock background scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const mapAuthError = (err: any): string => {
    const code = err?.code || '';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    switch (code) {
      case 'auth/too-many-requests':
        return 'Too many unsuccessful attempts. Please wait a few moments and try again.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in popup was closed before completing authentication. Please try again.';
      case 'auth/cancelled-popup-request':
        return 'Another sign-in window is already open or was interrupted. Please click Continue with Google again.';
      case 'auth/popup-blocked':
        return 'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
      case 'auth/network-request-failed':
        return 'Network error while connecting to Google Authentication. Please check your internet connection and try again.';
      case 'auth/operation-not-allowed':
        return 'Google Sign-In is not currently enabled in Firebase Authentication providers.';
      case 'auth/unauthorized-domain': {
        const domainHint =
          hostname && hostname !== 'hopelandjobs.tech' && hostname !== 'www.hopelandjobs.tech'
            ? `"${hostname}", "hopelandjobs.tech", and "www.hopelandjobs.tech"`
            : '"hopelandjobs.tech" and "www.hopelandjobs.tech"';
        return `Google Sign-In is blocked by Firebase for "${hostname}". Add ${domainHint} under Firebase Console → Authentication → Settings → Authorized domains (Project: gen-lang-client-0056760370).`;
      }
      default:
        return err?.message || 'Google authentication error. Please try again.';
    }
  };

  // Real Firebase Google Account Selection Popup Sign-In & Registration (with mobile redirect fallback)
  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let result;
      try {
        result = await signInWithPopup(auth, googleProvider);
      } catch (popupErr: any) {
        if (
          popupErr?.code === 'auth/popup-blocked' ||
          popupErr?.code === 'auth/operation-not-supported-in-this-environment'
        ) {
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        throw popupErr;
      }
      const user = result.user;
      const additionalInfo = getAdditionalUserInfo(result);
      const isNewUser = Boolean(additionalInfo?.isNewUser);
      const now = new Date().toISOString();

      let profile = await fetchJobSeekerProfile(user.uid);
      if (!profile) {
        profile = {
          ...DEFAULT_JOB_SEEKER_PROFILE,
          uid: user.uid,
          email: user.email || '',
          fullName: user.displayName || user.email?.split('@')[0] || 'Job Seeker',
          photoUrl: user.photoURL || undefined,
          phone: user.phoneNumber || '',
          authProvider: 'google',
          emailVerified: user.emailVerified,
          createdAt: now,
          updatedAt: now,
        };
        await saveJobSeekerProfile(profile);
      } else {
        const syncedFullName =
          !profile.fullName || profile.fullName === 'Job Seeker'
            ? user.displayName || profile.fullName
            : profile.fullName;
        const syncedPhotoUrl = user.photoURL || profile.photoUrl;
        const syncedEmail = user.email || profile.email;
        const needsSync =
          syncedFullName !== profile.fullName ||
          syncedPhotoUrl !== profile.photoUrl ||
          syncedEmail !== profile.email ||
          !profile.emailVerified;

        if (needsSync) {
          profile = {
            ...profile,
            fullName: syncedFullName,
            photoUrl: syncedPhotoUrl,
            email: syncedEmail,
            authProvider: profile.authProvider || 'google',
            emailVerified: user.emailVerified || profile.emailVerified,
            updatedAt: now,
          };
          await saveJobSeekerProfile(profile);
        }
      }

      // Track registration/login in GA4
      trackAnalyticsEvent(
        isNewUser || mode === 'signup' ? 'job_seeker_register' : 'job_seeker_login',
        {
          method: 'google',
          title: isNewUser ? 'Google Sign-Up' : 'Google Sign-In',
        }
      );

      setSuccessMsg(
        isNewUser
          ? `Account created! Welcome, ${user.displayName || profile.fullName || 'Job Seeker'}!`
          : `Welcome back, ${user.displayName || profile.fullName || 'Job Seeker'}!`
      );

      if (onSuccess) {
        await onSuccess(user, profile);
      }
      onClose();
    } catch (err: any) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/85 flex min-h-full items-center justify-center p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden relative my-auto animate-in fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Hopeland branding */}
        <div className="bg-[#0B132B] text-white p-6 relative">
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center text-slate-950 font-black">
              <Sparkles className="w-4 h-4 fill-current text-slate-950" />
            </div>
            <span className="font-extrabold text-sm tracking-wide text-white">
              HOPELAND <span className="text-amber-400">JOBS</span>
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white">
            {mode === 'signup' ? 'Create Your Free Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {mode === 'signup'
              ? 'Register instantly with your Google account — no passwords required.'
              : 'Sign in with your Google account to apply for vacancies and track applications.'}
          </p>
        </div>

        {/* Informational Message Banner if provided */}
        {message && (
          <div className="bg-amber-50 px-6 py-2.5 border-b border-amber-200 flex items-center gap-2 text-xs font-bold text-amber-900">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <div className="p-6 sm:p-7 space-y-5">
          {/* Account benefits summary */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-2.5">
            <div className="flex items-start gap-2.5 text-xs text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Verified Google Account Only:</strong> Instant sign-up or sign-in using your Google profile.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-700">
              <Briefcase className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Tailored Job Matches:</strong> Personalized Ethiopian vacancies matched to your experience.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-700">
              <FileCheck2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>10GB Document Vault:</strong> Store your CV & certificates for fast 1-click applications.
              </span>
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google One-Click Auth Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border-2 border-slate-300 hover:border-amber-400 bg-white hover:bg-amber-50/40 transition-all font-extrabold text-sm text-slate-900 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>
              {loading
                ? 'Connecting to Google...'
                : mode === 'signup'
                  ? 'Sign Up with Google'
                  : 'Continue with Google'}
            </span>
          </button>

          {/* Toggle context between Sign In / Sign Up */}
          <div className="pt-3 text-center text-xs text-slate-600 border-t border-slate-100 space-y-1.5">
            {mode === 'signin' ? (
              <p>
                New to Hopeland Jobs?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setMode('signup');
                  }}
                  className="font-extrabold text-amber-600 hover:text-amber-700 underline"
                >
                  Register with Google
                </button>
              </p>
            ) : (
              <p>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setMode('signin');
                  }}
                  className="font-extrabold text-amber-600 hover:text-amber-700 underline"
                >
                  Sign In with Google
                </button>
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              Accounts are created and verified exclusively via Google Authentication.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
