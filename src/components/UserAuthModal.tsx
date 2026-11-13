import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Phone,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
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
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Synchronize internal mode with initialMode prop when modal is opened or mode switched
  React.useEffect(() => {
    setMode(initialMode);
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

  const resetForm = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const mapAuthError = (err: any): string => {
    const code = err?.code || '';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account already exists with this email address. Please sign in instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please verify your details.';
      case 'auth/too-many-requests':
        return 'Too many unsuccessful attempts. Please wait a few moments and try again.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in popup was closed before completing authentication. Please try again.';
      case 'auth/cancelled-popup-request':
        return 'Another sign-in window is already open or was interrupted. Please click Continue with Google again.';
      case 'auth/popup-blocked':
        return 'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using email & password. Please sign in with your email and password below.';
      case 'auth/network-request-failed':
        return 'Network error while connecting to Google Authentication. Please check your internet connection and try again.';
      case 'auth/operation-not-allowed':
        return 'Google Sign-In is not currently enabled in Firebase Authentication providers.';
      case 'auth/unauthorized-domain':
        return `Google Sign-In is not authorized yet for "${hostname}". Add "${hostname}" under Firebase Console → Authentication → Settings → Authorized domains (Project: gen-lang-client-0056760370).`;
      default:
        return err?.message || 'Authentication error. Please try again.';
    }
  };

  // Real Firebase Google Account Selection Popup Sign-In & Registration
  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
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
      trackAnalyticsEvent(isNewUser || mode === 'signup' ? 'job_seeker_register' : 'job_seeker_login', {
        method: 'google',
        title: isNewUser ? 'Google Sign-Up' : 'Google Sign-In',
      });

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

  // Email & Password Submit
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) {
          throw new Error('Please enter your full name.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }

        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: fullName.trim() });

        const newProfile: JobSeekerProfile = {
          ...DEFAULT_JOB_SEEKER_PROFILE,
          uid: cred.user.uid,
          email: cred.user.email || email.trim(),
          fullName: fullName.trim(),
          phone: phone.trim(),
          authProvider: 'email',
          emailVerified: cred.user.emailVerified,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveJobSeekerProfile(newProfile);

        trackAnalyticsEvent('job_seeker_register', {
          method: 'email',
          title: 'Email Registration',
        });

        setSuccessMsg('Account created successfully! Welcome to Hopeland Jobs.');
        if (onSuccess) {
          await onSuccess(cred.user, newProfile);
        }
        onClose();
      } else if (mode === 'signin') {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

        // Ensure profile exists
        let profile = await fetchJobSeekerProfile(cred.user.uid);
        if (!profile) {
          profile = {
            ...DEFAULT_JOB_SEEKER_PROFILE,
            uid: cred.user.uid,
            email: cred.user.email || email.trim(),
            fullName: cred.user.displayName || 'Job Seeker',
            authProvider: 'email',
            emailVerified: cred.user.emailVerified,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await saveJobSeekerProfile(profile);
        }

        trackAnalyticsEvent('job_seeker_login', {
          method: 'email',
          title: 'Email Login',
        });

        setSuccessMsg('Welcome back!');
        if (onSuccess) {
          await onSuccess(cred.user, profile);
        }
        onClose();
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email.trim());
        setSuccessMsg('Password reset link sent! Check your inbox to set a new password.');
      }
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
            {mode === 'signin' && 'Welcome Back'}
            {mode === 'signup' && 'Create Your Free Account'}
            {mode === 'forgot' && 'Reset Your Password'}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {mode === 'signin' && 'Sign in to apply for genuine vacancies and track your applications.'}
            {mode === 'signup' && 'Join thousands of Ethiopian professionals finding verified jobs.'}
            {mode === 'forgot' && "Enter your email address and we'll send you a password reset link."}
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
          {/* Google One-Click Auth Button */}
          {mode !== 'forgot' && (
            <div>
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-300 hover:border-amber-400 hover:bg-slate-50 transition-all font-bold text-xs text-slate-800 shadow-xs cursor-pointer group disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                <span>{loading ? 'Connecting to Google...' : 'Continue with Google'}</span>
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-bold">Or continue with email</span>
                </div>
              </div>
            </div>
          )}

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

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Abebe Bikila"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+251 91 123 4567"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Password *
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setMode('forgot');
                      }}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white font-extrabold text-xs transition-colors shadow-md disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <>
                  <span>
                    {mode === 'signin' && 'Sign In to Hopeland Jobs'}
                    {mode === 'signup' && 'Create Free Account'}
                    {mode === 'forgot' && 'Send Password Reset Link'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle between Sign In / Sign Up */}
          <div className="pt-2 text-center text-xs text-slate-600 border-t border-slate-100">
            {mode === 'signin' && (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMode('signup');
                  }}
                  className="font-extrabold text-amber-600 hover:text-amber-700 underline"
                >
                  Create free account
                </button>
              </p>
            )}

            {mode === 'signup' && (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMode('signin');
                  }}
                  className="font-extrabold text-amber-600 hover:text-amber-700 underline"
                >
                  Sign In
                </button>
              </p>
            )}

            {mode === 'forgot' && (
              <p>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMode('signin');
                  }}
                  className="font-extrabold text-amber-600 hover:text-amber-700 underline"
                >
                  Back to Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
