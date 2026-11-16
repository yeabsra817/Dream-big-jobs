import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  ExternalLink,
  Settings,
  Briefcase,
  Circle,
} from 'lucide-react';
import {
  NotificationPermissionState,
  NotificationPreferencesRecord,
  UserNotificationItem,
} from '../types/jobSeeker';

interface Props {
  notifications: UserNotificationItem[];
  unreadCount: number;
  prefs: NotificationPreferencesRecord | null;
  browserPermission: NotificationPermissionState;
  hasActiveDevicePush: boolean;
  onMarkRead: (notificationId: string, read: boolean) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onOpenNotification: (notification: UserNotificationItem) => void;
  onOpenPreferences: () => void;
  onPromptEnableNotifications: () => void;
}

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const NotificationCenterPopover: React.FC<Props> = ({
  notifications,
  unreadCount,
  prefs,
  browserPermission,
  hasActiveDevicePush,
  onMarkRead,
  onMarkAllRead,
  onOpenNotification,
  onOpenPreferences,
  onPromptEnableNotifications,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const displayedNotifications =
    filterMode === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const needsPushActivation =
    browserPermission !== 'unsupported' &&
    (!hasActiveDevicePush || prefs?.permissionStatus !== 'granted');

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        className="relative min-h-[40px] min-w-[40px] px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 inline-flex items-center justify-center transition-colors cursor-pointer"
        title="Job Alert Notifications"
      >
        <Bell className="w-4 h-4 text-amber-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black font-mono tabular-nums flex items-center justify-center border border-[#0B132B]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-[420px] max-h-[80vh] bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-2xl z-50 flex flex-col overflow-hidden"
          role="region"
          aria-label="Notification Center"
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-[#0B132B] text-white flex items-center justify-between gap-2 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white">Job Alerts</h3>
                <span className="text-xs font-mono tabular-nums text-amber-300 font-bold">
                  {unreadCount} unread
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Matched opportunities across verified sectors
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => onMarkAllRead()}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenPreferences();
                }}
                aria-label="Open Notification Preferences"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Notification Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Push Activation Banner if not yet active on this device */}
          {needsPushActivation && (
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2 text-xs shrink-0">
              <span className="text-amber-950 font-medium leading-snug">
                {browserPermission === 'denied'
                  ? 'Push notifications blocked in browser settings.'
                  : 'Turn on push alerts on this device for instant matches.'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onPromptEnableNotifications();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#0B132B] text-white font-bold text-[11px] hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {browserPermission === 'denied' ? 'How to Fix' : 'Enable Push'}
              </button>
            </div>
          )}

          {/* Filter Bar */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('unread')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  filterMode === 'unread'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenPreferences();
              }}
              className="text-[11px] font-bold text-slate-700 hover:text-amber-700 cursor-pointer whitespace-nowrap"
            >
              View All History &rarr;
            </button>
          </div>

          {/* Notification Items List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {displayedNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Briefcase className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">
                  {filterMode === 'unread'
                    ? 'You are all caught up'
                    : 'No job notifications yet'}
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Whenever a verified vacancy matches your skills, education, or preferred sectors, an alert appears here automatically.
                </p>
              </div>
            ) : (
              displayedNotifications.slice(0, 20).map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 transition-colors flex items-start justify-between gap-2.5 ${
                    notif.read ? 'bg-white hover:bg-slate-50' : 'bg-amber-50/45 hover:bg-amber-50/80'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenNotification(notif);
                    }}
                    className="flex-1 text-left space-y-1 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-label="Unread" />
                      )}
                      <span className="font-bold text-emerald-700 font-mono tabular-nums">
                        {notif.matchScore}% match
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{notif.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0 font-mono tabular-nums">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>

                    <div className="font-extrabold text-xs text-slate-900 line-clamp-1">
                      {notif.title}
                    </div>

                    <div className="text-[11px] text-slate-600 truncate">
                      {notif.employer} · {notif.location}
                      {notif.salary ? ` · ${notif.salary}` : ''}
                    </div>

                    {notif.matchReasonSummary && (
                      <div className="text-[11px] text-emerald-800 line-clamp-1 font-medium">
                        {notif.matchReasonSummary}
                      </div>
                    )}

                    {notif.missingMandatoryQualifications && notif.missingMandatoryQualifications.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-800 font-semibold">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          Note: {notif.missingMandatoryQualifications[0]}
                        </span>
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 flex items-center gap-2 pt-0.5">
                      <span>Deadline: {notif.deadline || 'Open'}</span>
                      <span className="inline-flex items-center gap-0.5 text-slate-700 font-bold">
                        <span>Open Vacancy</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onMarkRead(notif.id, !notif.read)}
                    aria-label={notif.read ? 'Mark as unread' : 'Mark as read'}
                    title={notif.read ? 'Mark as unread' : 'Mark as read'}
                    className="p-2 rounded-lg text-slate-400 hover:text-[#0B132B] hover:bg-slate-100 shrink-0 cursor-pointer"
                  >
                    {notif.read ? (
                      <Circle className="w-3.5 h-3.5" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
