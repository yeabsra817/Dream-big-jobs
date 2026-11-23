import React, { useEffect, useState } from 'react';
import { AlertCircle, RotateCw, X } from 'lucide-react';
import {
  BackgroundVacancySyncState,
  clearBackgroundVacancySyncError,
  getBackgroundVacancySyncState,
  retryBackgroundVacancySync,
  subscribeToBackgroundVacancySyncState,
} from '../../lib/firebase';

interface BackgroundSyncIndicatorProps {
  isAdmin: boolean;
}

const IDLE_STATE: BackgroundVacancySyncState = {
  status: 'idle',
  isSyncing: false,
  errorMessage: null,
  failedCount: 0,
};

/**
 * Subtle, non-intrusive bottom-screen indicator visible ONLY to authenticated
 * admin users while background vacancy uploads are in progress or when an
 * upload fails (with a one-click Retry action).
 * Returns null for all regular visitors and whenever idle.
 */
export const BackgroundSyncIndicator: React.FC<BackgroundSyncIndicatorProps> = ({
  isAdmin,
}) => {
  const [syncState, setSyncState] = useState<BackgroundVacancySyncState>(() =>
    isAdmin ? getBackgroundVacancySyncState() : IDLE_STATE
  );

  useEffect(() => {
    if (!isAdmin) {
      setSyncState(IDLE_STATE);
      return;
    }
    setSyncState(getBackgroundVacancySyncState());
    return subscribeToBackgroundVacancySyncState(setSyncState);
  }, [isAdmin]);

  if (!isAdmin || syncState.status === 'idle') {
    return null;
  }

  if (syncState.status === 'error') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed bottom-4 right-4 z-40 select-none"
      >
        <div className="w-60 rounded-md border border-rose-200 bg-white/95 backdrop-blur-xs px-3 py-2 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="text-[11px] font-semibold tracking-wide text-rose-700 truncate">
                Sync Error
              </span>
            </div>
            <button
              type="button"
              onClick={() => clearBackgroundVacancySyncError()}
              className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              aria-label="Dismiss sync error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500 line-clamp-2">
            {syncState.errorMessage || 'Background vacancy upload failed.'}
          </p>
          <div className="mt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                void retryBackgroundVacancySync();
              }}
              className="inline-flex items-center gap-1.5 rounded-sm border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-700 transition-colors cursor-pointer"
            >
              <RotateCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-40 pointer-events-none select-none"
    >
      <div className="w-44 rounded-md border border-slate-200/90 bg-white/95 backdrop-blur-xs px-3 py-2 shadow-sm">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium tracking-wide text-slate-600">
            Syncing...
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Background vacancy sync in progress"
          className="w-full h-1 rounded-xs bg-slate-100 overflow-hidden"
        >
          <div className="h-full rounded-xs bg-emerald-600 sync-progress-indeterminate" />
        </div>
      </div>
    </div>
  );
};
