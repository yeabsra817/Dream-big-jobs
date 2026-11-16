import React, { useEffect, useRef, useState } from 'react';
import {
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  X,
  Lock,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import {
  auth,
  googleProvider,
  signInWithRedirect,
  ADMIN_EMAIL,
  isUserAdmin,
  verifyDeveloperPasswordServer,
  establishDeveloperGoogleSession,
} from '../lib/firebase';

interface Props {
  isOwnerAuthorized: boolean;
  onLoginSuccess: (email: string) => void;
  onOpenDashboard: () => void;
  onLogout: () => Promise<void> | void;
}

export const HiddenDeveloperLogin: React.FC<Props> = ({
  isOwnerAuthorized,
  onLoginSuccess,
  onOpenDashboard,
  onLogout,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isRevealed) return;
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsRevealed(false);
        setError(null);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsRevealed(false);
        setError(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRevealed]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Enter your developer password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await verifyDeveloperPasswordServer(password.trim());
      if (result.success) {
        setPassword('');
        setIsRevealed(false);
        onLoginSuccess(result.email || ADMIN_EMAIL);
      } else {
        setError(result.error || 'Access Denied: Invalid developer password.');
      }
    } catch {
      setError('Authentication service unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
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
      if (isUserAdmin(user)) {
        const email = user.email || ADMIN_EMAIL;
        await establishDeveloperGoogleSession(email);
        setPassword('');
        setIsRevealed(false);
        onLoginSuccess(email);
      } else {
        setError('Access Denied: This Google account is not authorized for developer access.');
      }
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain') {
        setError('Google Sign-In is unavailable on this domain. Use your developer password above.');
      } else {
        setError('Google Sign-In was cancelled or blocked. Use your developer password above.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="fixed bottom-2.5 left-2.5 z-40">
      {!isRevealed ? (
        <button
          type="button"
          onClick={() => setIsRevealed(true)}
          tabIndex={0}
          className={`flex items-center justify-center rounded-lg select-none cursor-pointer transition-all duration-300 ${
            isOwnerAuthorized
              ? 'px-2.5 py-1.5 bg-[#0B132B]/70 text-amber-400/80 border border-amber-400/25 backdrop-blur-sm opacity-45 hover:opacity-100'
              : 'w-14 h-7 bg-slate-900/15 text-slate-400/40 backdrop-blur-md blur-[4px] opacity-[0.04] hover:opacity-[0.14] hover:blur-[2px] focus-visible:opacity-90 focus-visible:blur-none'
          }`}
          aria-label="Developer Access"
        >
          <Lock className="w-3 h-3" />
        </button>
      ) : (
        <div className="w-[min(340px,calc(100vw-1.25rem))] rounded-2xl bg-[#0B132B] text-white border border-slate-700/90 shadow-2xl overflow-hidden animate-in fade-in duration-150">
          <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center">
                <Shield className="w-4 h-4 fill-current" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-white tracking-wide">
                  Developer Login
                </h3>
                <p className="text-[10px] text-slate-400">
                  Authorized Developer Access Only
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsRevealed(false);
                setError(null);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Hide developer login"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isOwnerAuthorized ? (
            <div className="p-4 space-y-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-semibold">
                Developer session active
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRevealed(false);
                  onOpenDashboard();
                }}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Open Developer Dashboard</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsRevealed(false);
                  await onLogout();
                }}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-rose-950/70 hover:text-rose-300 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Lock &amp; Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {error && (
                <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-[11px] text-rose-200 flex items-start gap-2 leading-relaxed">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Developer Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={inputRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter developer password..."
                      autoComplete="current-password"
                      className="w-full pl-8 pr-9 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-400 text-xs text-white placeholder-slate-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
                >
                  <span>{loading ? 'Verifying...' : 'Unlock Developer Dashboard'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">OR</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-[11px] flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                <span>Authorized Google Sign-In</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
