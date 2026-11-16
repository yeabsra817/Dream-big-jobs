import React, { useState, useEffect } from 'react';
import {
  Radio,
  CheckCircle2,
  AlertCircle,
  Send,
  RefreshCw,
  Save,
  XCircle,
  ShieldCheck,
  Clock,
  ListChecks,
  Bot,
  Hash,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SiteSettings, Vacancy } from '../../types/job';
import {
  ChannelVerificationResult,
  ServerQueueStatusResponse,
  verifyTelegramConnectionClient,
  sendTelegramTestMessageClient,
  normalizeTelegramChatId,
} from '../../utils/telegramClient';

interface Props {
  siteSettings: SiteSettings;
  vacancies: Vacancy[];
  queueStatus: ServerQueueStatusResponse | null;
  onSaveSettings?: (settings: SiteSettings) => Promise<void>;
  onRetryFailed?: () => Promise<void>;
  onCancelQueue?: () => Promise<void>;
  onChannelVerified?: (result: ChannelVerificationResult) => void;
  onRefreshQueueStatus?: () => Promise<void>;
}

export const TelegramStatusPanel: React.FC<Props> = ({
  siteSettings,
  vacancies,
  queueStatus,
  onSaveSettings,
  onRetryFailed,
  onCancelQueue,
  onChannelVerified,
  onRefreshQueueStatus,
}) => {
  const [channelInput, setChannelInput] = useState(
    siteSettings.telegramChannelName || siteSettings.telegramChannelId || '@DreamBigJobsEthiopia'
  );
  const [verification, setVerification] = useState<ChannelVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSavingChannel, setIsSavingChannel] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    const target = siteSettings.telegramChannelName || siteSettings.telegramChannelId;
    if (target) {
      setChannelInput(target);
    }
  }, [siteSettings.telegramChannelName, siteSettings.telegramChannelId]);

  const handleVerifyConnection = async (overrideChannel?: string) => {
    setIsVerifying(true);
    setActionFeedback(null);
    try {
      const res = await verifyTelegramConnectionClient(overrideChannel ?? channelInput);
      setVerification(res);
      if (onChannelVerified) onChannelVerified(res);

      if (res.ok && res.chat) {
        const displayChan = res.chat.username ? `@${res.chat.username}` : String(res.chat.id);
        setActionFeedback({
          type: 'success',
          text: `${res.statusLabel || 'Connected successfully'}: "${res.chat.title}" (${displayChan}, ID: ${res.chat.id}) via @${res.bot?.username || 'DreamBigJobsEthiopiaBot'}.`,
        });
      } else {
        setActionFeedback({
          type: 'error',
          text: `${res.statusLabel || 'Verification failed'}${res.error ? ` — ${res.error}` : ''}`,
        });
      }
      if (onRefreshQueueStatus) await onRefreshQueueStatus();
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    // Run automatic truthful connection check on initial mount
    handleVerifyConnection(siteSettings.telegramChannelName || siteSettings.telegramChannelId || '@DreamBigJobsEthiopia');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendTestMessage = async () => {
    setIsSendingTest(true);
    setActionFeedback(null);
    try {
      const res = await sendTelegramTestMessageClient(channelInput);
      if (res.success) {
        setActionFeedback({
          type: 'success',
          text: res.message || `Real test message delivered (Msg #${res.telegramMessageId})!`,
        });
        await handleVerifyConnection(channelInput);
      } else {
        setActionFeedback({
          type: 'error',
          text: `${res.statusLabel ? `${res.statusLabel}: ` : ''}${res.error || 'Failed to send test message.'}`,
        });
      }
      if (onRefreshQueueStatus) await onRefreshQueueStatus();
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSaveChannelSettings = async () => {
    const normalized = normalizeTelegramChatId(channelInput);
    if (normalized.isInviteLink) {
      setActionFeedback({
        type: 'error',
        text: normalized.error || 'Private invite links (t.me/+...) cannot be used as a bot chat_id.',
      });
      return;
    }

    setIsSavingChannel(true);
    setActionFeedback(null);
    try {
      const updated: SiteSettings = {
        ...siteSettings,
        telegramChannelName: normalized.chatId,
        ...(normalized.isNumeric ? { telegramChannelId: normalized.chatId } : {}),
        ...(normalized.slug ? { telegramChannelUrl: `https://t.me/${normalized.slug}` } : {}),
        updatedAt: new Date().toISOString(),
      };
      if (onSaveSettings) {
        await onSaveSettings(updated);
      } else {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
      }
      setChannelInput(normalized.chatId);
      setActionFeedback({
        type: 'info',
        text: `Saved target channel ${normalized.chatId}. Verifying connection & admin rights...`,
      });
      await handleVerifyConnection(normalized.chatId);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: `Failed to save channel settings: ${err?.message || String(err)}`,
      });
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleRetryFailedClick = async () => {
    if (!onRetryFailed) return;
    setIsRetrying(true);
    try {
      await onRetryFailed();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCancelQueueClick = async () => {
    if (!onCancelQueue) return;
    setIsCancelling(true);
    try {
      await onCancelQueue();
    } finally {
      setIsCancelling(false);
    }
  };

  // Compute unified metrics combining website vacancies and persistent server queue/records
  const totalPublished = Math.max(
    vacancies.filter((v) => v.telegramPublished).length,
    queueStatus?.totalPublishedAllTime || 0
  );
  const failedVacancyCount = Math.max(
    vacancies.filter((v) => !v.telegramPublished && Boolean(v.telegramPublishError)).length,
    queueStatus?.summary?.failed || 0
  );
  const pendingVacancies =
    queueStatus?.queueState?.status === 'running'
      ? (queueStatus.summary.pending || 0) + (queueStatus.summary.processing || 0) + (queueStatus.summary.retrying || 0)
      : vacancies.filter((v) => !v.telegramPublished && v.status === 'published').length;

  const latestVacancyPublishedAt = vacancies
    .map((v) => v.telegramPublishedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];
  const lastPublishedAt = queueStatus?.lastSuccessfulPublication || latestVacancyPublishedAt || '';

  const connectedChannelDisplay =
    verification?.chat?.username
      ? `@${verification.chat.username}`
      : verification?.normalizedChannel || siteSettings.telegramChannelName || siteSettings.telegramChannelId || '@DreamBigJobsEthiopia';

  const botUsernameDisplay = verification?.bot?.username
    ? `@${verification.bot.username}`
    : siteSettings.telegramBotUsername
    ? `@${siteSettings.telegramBotUsername.replace(/^@/, '')}`
    : '@DreamBigJobsEthiopiaBot';

  const isQueueRunning = queueStatus?.queueState?.status === 'running';
  const statusLabel = verification?.statusLabel || (isVerifying ? 'Checking connection...' : 'Not verified yet');
  const statusOk = Boolean(verification?.ok);
  const logs = queueStatus?.logs || [];

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
      {/* Header + 7-State Connection Status Badge */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0B132B] text-amber-400 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              Telegram Channel Status &amp; Diagnostics Panel
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live server-verified status for <strong>{connectedChannelDisplay}</strong> via{' '}
              <strong>{botUsernameDisplay}</strong>
              {verification?.chat?.id ? (
                <span className="ml-1.5 font-mono text-[11px] text-slate-600">
                  (ID: {verification.chat.id})
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
              statusOk
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : isVerifying
                ? 'bg-sky-50 text-sky-800 border-sky-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {statusOk ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : isVerifying ? (
              <RefreshCw className="w-4 h-4 text-sky-600 animate-spin" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{statusLabel}</span>
          </span>

          <button
            type="button"
            onClick={() => handleVerifyConnection()}
            disabled={isVerifying}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-amber-400 font-black text-xs shadow-xs disabled:opacity-50"
          >
            <ShieldCheck className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'VERIFYING...' : 'VERIFY TELEGRAM CONNECTION'}</span>
          </button>

          <button
            type="button"
            onClick={handleSendTestMessage}
            disabled={isSendingTest}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#229ED9] hover:bg-[#1c8cc2] text-white font-black text-xs shadow-xs disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSendingTest ? 'Sending Test...' : 'Send Test Message'}</span>
          </button>
        </div>
      </div>

      {/* Key Operational Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Hash className="w-3 h-3" />
            <span>Connected Channel</span>
          </div>
          <div className="font-extrabold text-slate-900 mt-1 truncate" title={connectedChannelDisplay}>
            {connectedChannelDisplay}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Bot className="w-3 h-3" />
            <span>Bot Username</span>
          </div>
          <div className="font-extrabold text-slate-900 mt-1 truncate">{botUsernameDisplay}</div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Last Publication</span>
          </div>
          <div className="font-bold text-slate-800 mt-1 truncate">
            {lastPublishedAt
              ? new Date(lastPublishedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'None yet'}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
          <div className="text-[10px] font-bold uppercase text-emerald-700">Total Published</div>
          <div className="text-lg font-black text-emerald-900 mt-0.5">{totalPublished}</div>
        </div>

        <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200">
          <div className="text-[10px] font-bold uppercase text-rose-700">Total Failed</div>
          <div className="text-lg font-black text-rose-900 mt-0.5">{failedVacancyCount}</div>
        </div>

        <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200">
          <div className="text-[10px] font-bold uppercase text-amber-800">Pending Vacancies</div>
          <div className="text-lg font-black text-amber-950 mt-0.5">{pendingVacancies}</div>
        </div>
      </div>

      {/* Channel Destination Input & Action Controls */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Channel @username, Private -100... Channel ID, or Private Post Link (t.me/c/...):
            </label>
            <input
              type="text"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="@DreamBigJobsEthiopia or -1001234567890 or https://t.me/c/1234567890/1"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:border-amber-500 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:pt-5">
            <button
              type="button"
              onClick={handleSaveChannelSettings}
              disabled={isSavingChannel || !channelInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingChannel ? 'Saving...' : 'Save Channel Settings'}</span>
            </button>

            {onRetryFailed && (
              <button
                type="button"
                onClick={handleRetryFailedClick}
                disabled={isRetrying || failedVacancyCount === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-xs disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>Retry Failed ({failedVacancyCount})</span>
              </button>
            )}

            {onCancelQueue && (
              <button
                type="button"
                onClick={handleCancelQueueClick}
                disabled={isCancelling || !isQueueRunning}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-xs shadow-xs disabled:opacity-40"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Queue</span>
              </button>
            )}
          </div>
        </div>

        {/* Discovered Channels (if chat not found) */}
        {verification && !verification.ok && verification.discoveredChats && verification.discoveredChats.length > 0 && (
          <div className="p-3 rounded-xl bg-white border border-amber-300 text-xs space-y-2">
            <div className="font-extrabold text-slate-900">
              Discovered Channels Accessible by {botUsernameDisplay} (Click to Connect):
            </div>
            <div className="flex flex-wrap gap-2">
              {verification.discoveredChats.map((dc) => (
                <button
                  key={dc.id}
                  type="button"
                  onClick={async () => {
                    const target = dc.username || dc.id;
                    setChannelInput(target);
                    if (onSaveSettings) {
                      await onSaveSettings({
                        ...siteSettings,
                        telegramChannelName: target,
                        telegramChannelId: String(dc.id),
                        ...(dc.username ? { telegramChannelUrl: `https://t.me/${dc.username.replace('@', '')}` } : {}),
                        updatedAt: new Date().toISOString(),
                      });
                    }
                    await handleVerifyConnection(target);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-400 text-emerald-950 font-bold text-[11px]"
                >
                  Use &ldquo;{dc.title}&rdquo; ({dc.username || dc.id})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Diagnostic / Action Result Banner */}
      {(actionFeedback || (verification && !verification.ok && verification.diagnosis)) && (
        <div
          className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
            actionFeedback?.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : actionFeedback?.type === 'info'
              ? 'bg-blue-50 border-blue-300 text-blue-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {actionFeedback && <div className="font-bold">{actionFeedback.text}</div>}
          {verification && !verification.ok && verification.diagnosis && (
            <p className="text-[11px] leading-relaxed">{verification.diagnosis}</p>
          )}
        </div>
      )}

      {/* Persistent Publishing Logs Collapsible Drawer */}
      <div className="border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowLogs((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-700 hover:text-slate-950"
        >
          <ListChecks className="w-4 h-4 text-amber-600" />
          <span>Timestamped Telegram Publishing Logs ({logs.length})</span>
          {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showLogs && (
          <div className="mt-3 max-h-60 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 text-[11px]">
            {logs.length === 0 ? (
              <div className="p-4 text-center text-slate-500">No publishing logs recorded yet.</div>
            ) : (
              logs.slice(0, 40).map((log) => (
                <div key={log.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-extrabold text-slate-900">{log.title}</span>
                    <span className="text-slate-500 ml-2">
                      [{log.action}] • {log.channel}
                    </span>
                    {log.error && (
                      <div className="text-rose-700 font-semibold mt-0.5 truncate">{log.error}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full font-black uppercase text-[10px] border ${
                        log.status === 'published'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : log.status === 'failed'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {log.status}
                      {log.telegramMessageId ? ` #${log.telegramMessageId}` : ''}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
