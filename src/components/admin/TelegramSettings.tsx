import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Sparkles,
  Bot,
  Copy,
  Check,
  KeyRound,
  RefreshCw,
  Lock,
  Radio,
  Eye,
  EyeOff,
  Bell,
  MessageSquare,
  HelpCircle,
  Globe,
  Save,
} from 'lucide-react';
import { SiteSettings, TelegramDistributionMode, Vacancy } from '../../types/job';
import {
  cleanTelegramToken,
  verifyTelegramBotToken,
  checkTelegramConnectionStatus,
  testTelegramPing,
  broadcastJobToTelegram,
  isWashNgoVacancyClient,
  getTelegramDistributionModeLabel,
  normalizeTelegramChatId,
  verifyTelegramConnectionClient,
  fetchTelegramQueueStatusClient,
  sendTelegramTestMessageClient,
  ServerQueueStatusResponse,
  ChannelVerificationResult,
  DiscoveredTelegramChat,
} from '../../utils/telegramClient';
import { TelegramStatusPanel } from './TelegramStatusPanel';

interface Props {
  settings: SiteSettings;
  onSaveSettings: (settings: SiteSettings) => Promise<void>;
  sampleVacancy?: Vacancy;
  allVacancies?: Vacancy[];
  onUpdateVacancyTelegramStatus?: (
    vacancyId: string,
    published: boolean,
    messageId?: number,
    error?: string
  ) => Promise<void>;
}

export const TelegramSettings: React.FC<Props> = ({
  settings,
  onSaveSettings,
  sampleVacancy,
  allVacancies = [],
  onUpdateVacancyTelegramStatus,
}) => {
  // Bot Connection State (tokens are strictly stored and read on the backend server)
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [isSendingTestMessage, setIsSendingTestMessage] = useState(false);
  const [isEditingToken, setIsEditingToken] = useState(false);
  const [queueStatus, setQueueStatus] = useState<ServerQueueStatusResponse | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    configured: boolean;
    connected: boolean;
    bot?: {
      id: number;
      first_name: string;
      username: string;
      can_join_groups?: boolean;
      can_read_all_group_messages?: boolean;
    };
    maskedToken?: string;
    error?: string;
    latencyMs?: number;
  }>(() => ({
    configured: Boolean(settings.telegramBotTokenConfigured),
    connected: false,
    bot: settings.telegramBotUsername
      ? {
          id: 0,
          first_name: 'Hopeland Jobs Bot',
          username: settings.telegramBotUsername.replace('@', ''),
        }
      : undefined,
    maskedToken: settings.maskedBotToken || (settings.telegramBotTokenConfigured ? 'Configured on Server' : undefined),
  }));

  // Channel & Broadcast Settings State
  const [channelUsername, setChannelUsername] = useState(
    settings.telegramChannelName || '@DreamBigJobsEthiopia'
  );
  const [customDomain, setCustomDomain] = useState(
    settings.customDomain && settings.customDomain !== 'healmorin.com'
      ? settings.customDomain
      : 'hopelandjobs.tech'
  );
  const [autoPublish, setAutoPublish] = useState(settings.telegramAutoPublish ?? true);
  const [distributionMode, setDistributionMode] = useState<TelegramDistributionMode>(
    settings.telegramDistributionMode || 'all_jobs'
  );
  const [includeImmigration, setIncludeImmigration] = useState(
    Boolean(settings.telegramIncludeInternationalImmigration)
  );
  const [includeScholarships, setIncludeScholarships] = useState(
    Boolean(settings.telegramIncludeScholarships)
  );
  const [botInstructions, setBotInstructions] = useState(settings.botInstructions || '');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isVerifyingChannel, setIsVerifyingChannel] = useState(false);
  const [channelVerification, setChannelVerification] = useState<ChannelVerificationResult | null>(null);

  // Live Broadcast Testing
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>(
    sampleVacancy?.id || (allVacancies[0]?.id ?? '')
  );
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [forceRetry, setForceRetry] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    telegramMessageId?: number;
    formattedMessage?: string;
  } | null>(null);

  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Active vacancy to test broadcast
  const activeBroadcastVacancy =
    allVacancies.find((v) => v.id === selectedVacancyId) ||
    sampleVacancy || {
      id: 'sample_test_job',
      title: 'Senior Banking Operations Specialist',
      organization: 'Commercial Bank of Ethiopia (CBE)',
      category: 'Banking and Financial Institutions' as const,
      location: 'Addis Ababa (Head Office)',
      employmentType: 'Full-time' as const,
      vacanciesCount: '3',
      salary: 'Attractive / Per Bank Scale',
      educationQualification: "Bachelor's Degree in Banking, Finance, or Accounting",
      requiredFieldOfStudy: 'Banking and Finance',
      experienceYears: '4+ Years',
      requiredSkills: ['Core Banking', 'Risk Assessment', 'Customer Relations'],
      description: 'Oversee daily banking transactions, ensure regulatory compliance, and support digital branch operations.',
      responsibilities: ['Reconcile daily branch ledgers', 'Audit cashier transactions'],
      requiredDocuments: ['Degree Certificate', 'Updated CV', 'Work Experience Letters'],
      applicationMethod: 'Online URL' as const,
      applicationUrl: 'https://combanketh.et/careers',
      applicationInstructions: 'Apply through the official CBE career portal before the deadline.',
      applicationDeadline: '2026-12-31',
      contactInfo: 'careers@combanketh.et | +251 11 551 5004',
      status: 'published' as const,
      viewsCount: 142,
      sharesCount: 28,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

  // Check current bot connection status on load (truthful server-only check)
  const checkStatus = async () => {
    try {
      const [tData, qData] = await Promise.all([
        checkTelegramConnectionStatus(),
        fetchTelegramQueueStatusClient(),
      ]);
      if (qData) setQueueStatus(qData);

      if (tData?.connected && tData?.bot) {
        setConnectionStatus({
          configured: true,
          connected: true,
          bot: tData.bot,
          maskedToken: tData.maskedToken || 'Configured on Server (Masked)',
        });
        setFeedbackMessage({
          type: 'success',
          text: `Connected to @${tData.bot.username} (${tData.bot.first_name}). Telegram Bot API is active and secured on the server.`,
        });
        return;
      }
      if (tData?.configured && tData?.connected === false) {
        setConnectionStatus({
          configured: true,
          connected: false,
          bot: tData.bot,
          maskedToken: tData.maskedToken,
          error: tData.error,
        });
        setFeedbackMessage({
          type: 'error',
          text: `Telegram Bot API rejected the server token: ${tData.error || 'Unauthorized'}. Paste a valid Bot Token from @BotFather below.`,
        });
        return;
      }

      setConnectionStatus({ configured: false, connected: false, error: tData?.error });
      setFeedbackMessage({
        type: 'info',
        text: 'Telegram bot token is not configured on the server yet. Paste your Bot Token from @BotFather below to save it securely on the server.',
      });
    } catch (err: any) {
      console.warn('Status check notice:', err);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Securely configure Bot Token on the server (never saved to browser storage or Firestore)
  const handleConfigureToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = cleanTelegramToken(tokenInput);
    if (!cleanToken) {
      setFeedbackMessage({ type: 'error', text: 'Please enter your Telegram Bot Token.' });
      return;
    }

    setIsVerifying(true);
    setFeedbackMessage(null);

    try {
      const data = await verifyTelegramBotToken(cleanToken);

      if (!data.success || !data.bot) {
        setFeedbackMessage({
          type: 'error',
          text: data.error || 'Failed to authenticate token with Telegram Bot API. Please check token from @BotFather.',
        });
        setConnectionStatus((prev) => ({ ...prev, connected: false, error: data.error }));
      } else {
        setConnectionStatus({
          configured: true,
          connected: true,
          bot: data.bot,
          maskedToken: data.maskedToken,
        });
        setTokenInput('');
        setIsEditingToken(false);
        setFeedbackMessage({
          type: 'success',
          text: `Success! Server verified @${data.bot.username} (${data.bot.first_name}) via getMe. Token is stored securely on the backend.`,
        });

        await onSaveSettings({
          ...settings,
          telegramBotTokenConfigured: true,
          maskedBotToken: data.maskedToken,
          telegramBotUsername: data.bot.username,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Authentication error: ${err.message || String(err)}`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Test Connection Ping
  const handleTestPing = async () => {
    setIsTestingPing(true);
    setFeedbackMessage(null);

    try {
      const data = await testTelegramPing();

      if (!data.success) {
        setFeedbackMessage({
          type: 'error',
          text: data.error || 'Connection ping failed.',
        });
      } else {
        setConnectionStatus((prev) => ({
          ...prev,
          connected: true,
          bot: data.bot,
          latencyMs: data.latencyMs,
        }));
        setFeedbackMessage({
          type: 'success',
          text: `Live connection verified! Latency: ${data.latencyMs}ms. Bot @${data.bot?.username || 'verified'} is healthy and responding.`,
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Ping test failed: ${err.message || String(err)}`,
      });
    } finally {
      setIsTestingPing(false);
    }
  };

  // Verify Connection (Bot + Channel + Admin + Post Messages permission)
  const handleVerifyChannel = async (overrideChannel?: string) => {
    setIsVerifyingChannel(true);
    setChannelVerification(null);
    try {
      const result = await verifyTelegramConnectionClient(overrideChannel ?? channelUsername);
      setChannelVerification(result);
      if (result.ok && result.chat) {
        const resolvedHandle = result.chat.username ? `@${result.chat.username}` : String(result.chat.id);
        setChannelUsername(resolvedHandle);
        setFeedbackMessage({
          type: 'success',
          text: `${result.statusLabel || 'Connected successfully'}: "${result.chat.title}" (${resolvedHandle}, ID: ${result.chat.id}). Bot is Administrator with Post Messages enabled.`,
        });
      } else {
        setFeedbackMessage({
          type: 'error',
          text: `${result.statusLabel || 'Verification failed'}: ${result.error || 'Could not verify channel.'}`,
        });
      }
    } finally {
      setIsVerifyingChannel(false);
    }
  };

  const handleSendTestMessageDirect = async () => {
    setIsSendingTestMessage(true);
    setBroadcastResult(null);
    try {
      const res = await sendTelegramTestMessageClient(channelUsername);
      if (res.success) {
        setBroadcastResult({
          success: true,
          telegramMessageId: res.telegramMessageId,
          message: res.message,
        });
        setFeedbackMessage({
          type: 'success',
          text: res.message || `Real test message sent (Msg #${res.telegramMessageId})`,
        });
      } else {
        setBroadcastResult({
          success: false,
          error: res.error || res.statusLabel || 'Failed to send test message.',
        });
        setFeedbackMessage({
          type: 'error',
          text: `${res.statusLabel ? `${res.statusLabel}: ` : ''}${res.error || 'Test message failed.'}`,
        });
      }
      const qData = await fetchTelegramQueueStatusClient();
      if (qData) setQueueStatus(qData);
    } finally {
      setIsSendingTestMessage(false);
    }
  };

  const handleUseDiscoveredChat = async (chat: DiscoveredTelegramChat) => {
    const target = chat.username || chat.id;
    setChannelUsername(target);
    const cleanDomain = customDomain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '') || 'hopelandjobs.tech';
    const newSettings: SiteSettings = {
      ...settings,
      telegramChannelName: target,
      telegramChannelId: String(chat.id),
      telegramChannelUrl: chat.username
        ? `https://t.me/${chat.username.replace('@', '')}`
        : settings.telegramChannelUrl,
      telegramAutoPublish: autoPublish,
      telegramDistributionMode: distributionMode,
      telegramIncludeInternationalImmigration: includeImmigration,
      telegramIncludeScholarships: includeScholarships,
      customDomain: cleanDomain,
      updatedAt: new Date().toISOString(),
    };
    await onSaveSettings(newSettings);
    await handleVerifyChannel(target);
  };

  // Save Channel and Auto-Publish Settings
  const handleSaveChannelSettings = async () => {
    const normalized = normalizeTelegramChatId(channelUsername);
    if (normalized.isInviteLink) {
      setFeedbackMessage({
        type: 'error',
        text: normalized.error || 'Private invite links cannot be used as a bot chat_id.',
      });
      return;
    }

    setIsSavingSettings(true);
    try {
      const cleanChan = normalized.chatId;
      setChannelUsername(cleanChan);
      const cleanDomain = customDomain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '') || 'hopelandjobs.tech';
      const newSettings: SiteSettings = {
        ...settings,
        telegramChannelName: cleanChan,
        ...(normalized.isNumeric ? { telegramChannelId: cleanChan } : {}),
        telegramChannelUrl: normalized.slug
          ? `https://t.me/${normalized.slug}`
          : settings.telegramChannelUrl,
        telegramAutoPublish: autoPublish,
        telegramDistributionMode: distributionMode,
        telegramIncludeInternationalImmigration: includeImmigration,
        telegramIncludeScholarships: includeScholarships,
        botInstructions: botInstructions.trim(),
        customDomain: cleanDomain,
        updatedAt: new Date().toISOString(),
      };
      await onSaveSettings(newSettings);
      const modeLabel = getTelegramDistributionModeLabel(distributionMode);
      setFeedbackMessage({
        type: 'success',
        text: `Settings & bot instructions saved permanently! Target channel: ${cleanChan}. Mode: ${modeLabel}. Domain: ${cleanDomain}. Auto-publish: ${autoPublish ? 'ENABLED' : 'DISABLED'}.`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Failed to save channel settings: ${err.message || String(err)}`,
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Broadcast vacancy to channel via server API with distribution mode check
  const handleBroadcastToChannel = async () => {
    if (!connectionStatus.connected) {
      setFeedbackMessage({
        type: 'error',
        text: 'Please ensure a valid Telegram Bot Token is connected in Step 1 first.',
      });
      return;
    }

    setIsBroadcasting(true);
    setBroadcastResult(null);

    try {
      const cleanDomain = customDomain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '') || 'hopelandjobs.tech';
      const data = await broadcastJobToTelegram(
        activeBroadcastVacancy,
        channelUsername,
        forceRetry,
        cleanDomain,
        {
          ...settings,
          telegramDistributionMode: distributionMode,
          telegramIncludeInternationalImmigration: includeImmigration,
          telegramIncludeScholarships: includeScholarships,
        },
        'vacancy',
        'manual_publish'
      );
      setBroadcastResult(data);

      if (data.success && onUpdateVacancyTelegramStatus && activeBroadcastVacancy.id !== 'sample_test_job') {
        await onUpdateVacancyTelegramStatus(
          activeBroadcastVacancy.id,
          true,
          data.telegramMessageId
        );
      }
      const qData = await fetchTelegramQueueStatusClient();
      if (qData) setQueueStatus(qData);
    } catch (err: any) {
      setBroadcastResult({
        success: false,
        error: `Broadcast error: ${err.message || String(err)}`,
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="space-y-8">
      <TelegramStatusPanel
        siteSettings={settings}
        vacancies={allVacancies}
        queueStatus={queueStatus}
        onSaveSettings={onSaveSettings}
        onRefreshQueueStatus={async () => {
          const qData = await fetchTelegramQueueStatusClient();
          if (qData) setQueueStatus(qData);
        }}
        onChannelVerified={(res) => {
          setChannelVerification(res);
          if (res.bot) {
            setConnectionStatus((prev) => ({
              ...prev,
              configured: true,
              connected: res.statusCode !== 'invalid_token' && res.statusCode !== 'bot_not_found' && res.statusCode !== 'api_connection_failed',
              bot: res.bot,
            }));
          }
        }}
      />

      {/* Step Indicator Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#229ED9]/10 text-[#0288D1] mb-2">
              <Bot className="w-4 h-4" />
              <span>Official Telegram Integration</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0B132B]">
              Telegram Bot & Public Channel Control
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Automate publishing of approved Ethiopian vacancies directly to your official Telegram channel <strong>@DreamBigJobsEthiopia</strong> via your bot <strong>@DreamBigJobsEthiopiaBot</strong>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                connectionStatus.connected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span>{connectionStatus.connected ? 'Bot Connected & Active' : 'Bot Not Connected'}</span>
            </span>

            <a
              href="https://t.me/DreamBigJobsEthiopia"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#229ED9] text-white hover:bg-[#1e8ec3] transition-colors shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Channel (@DreamBigJobsEthiopia)</span>
            </a>
          </div>
        </div>

        {/* Security & Architecture Guarantees */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 block">Server-Side Environment</strong>
              <span className="text-slate-500 text-[11px]">
                Stored strictly in <code className="font-mono text-slate-700">TELEGRAM_BOT_TOKEN</code> on the server.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 block">Zero Frontend Exposure</strong>
              <span className="text-slate-500 text-[11px]">
                Never exposed to client browsers, browser storage, or public logs.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 block">Smart Duplicate Protection</strong>
              <span className="text-slate-500 text-[11px]">
                Prevents double-posting same vacancies to the Telegram channel.
              </span>
            </div>
          </div>
        </div>

        {/* Status Feedback Notice */}
        {feedbackMessage && (
          <div
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-start gap-2.5 leading-relaxed ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : feedbackMessage.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-300'
                : 'bg-blue-50 text-blue-900 border-blue-300'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* =========================================================================
            SECTION 1: Bot Connection & Token Setup
        ========================================================================= */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#0B132B] text-amber-400 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Telegram Bot Token (@DreamBigJobsEthiopiaBot)
              </h3>
            </div>
            {connectionStatus.connected && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                Active & Verified
              </span>
            )}
          </div>

          {/* Bot Verification Card (If Connected) */}
          {connectionStatus.connected && connectionStatus.bot && (
            <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 p-4 rounded-xl border border-emerald-300 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-slate-900">
                        {connectionStatus.bot.first_name}
                      </h4>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold">
                        VERIFIED BOT
                      </span>
                    </div>
                    <p className="text-xs font-bold text-emerald-700">
                      @{connectionStatus.bot.username}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditingToken(!isEditingToken)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-300 shadow-xs transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isEditingToken ? 'Keep Existing' : 'Change Token'}</span>
                  </button>

                  <button
                    onClick={handleTestPing}
                    disabled={isTestingPing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-300 shadow-xs transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingPing ? 'animate-spin' : ''}`} />
                    <span>{isTestingPing ? 'Pinging Telegram...' : 'Test Connection Ping'}</span>
                  </button>
                </div>
              </div>

              {/* Technical details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200 text-xs text-slate-700">
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Bot ID</span>
                  <span className="font-mono font-bold text-slate-900">{connectionStatus.bot.id}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Username</span>
                  <span className="font-mono font-bold text-emerald-800">@{connectionStatus.bot.username}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Token</span>
                  <span className="font-mono text-slate-600">{connectionStatus.maskedToken || 'Configured (Masked)'}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Ping Latency</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {connectionStatus.latencyMs ? `${connectionStatus.latencyMs} ms` : 'Active'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* When already connected, show active notice unless user specifically clicks Change Token */}
          {connectionStatus.connected && !isEditingToken ? (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-xs text-emerald-900">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Bot is connected &amp; ready.</strong> Saved credentials are synchronized across all admin sessions and Cloud Run instances.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingToken(true)}
                className="text-[11px] font-bold text-emerald-800 underline hover:text-emerald-950 shrink-0 ml-3"
              >
                Change Token
              </button>
            </div>
          ) : (
            /* Secure Token Configuration Form */
            <form onSubmit={handleConfigureToken} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    <span>
                      {connectionStatus.connected
                        ? 'Update Telegram Bot Token (DreamBigJobsEthiopiaBot)'
                        : 'Enter Telegram Bot Token (DreamBigJobsEthiopiaBot)'}
                    </span>
                  </label>

                  <span className="text-[11px] text-slate-400">
                    Format: <code className="text-slate-600 font-mono">123456789:ABCdef...</code>
                  </span>
                </div>

                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={
                      connectionStatus.maskedToken
                        ? `Active: ${connectionStatus.maskedToken} (Enter new token to replace)`
                        : 'Paste the token received from @BotFather here...'
                    }
                    className="w-full text-xs font-mono p-3 pr-20 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all bg-white"
                    autoComplete="off"
                    spellCheck={false}
                  />

                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-slate-400 hover:text-slate-700 text-xs font-medium flex items-center gap-1"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showToken ? 'Hide' : 'Show'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  💡 <strong>Where to find your Bot Token:</strong> Open Telegram, message{' '}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0288D1] underline font-bold"
                  >
                    @BotFather
                  </a>
                  , send <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">/mybots</code>, choose <strong>DreamBigJobsEthiopiaBot</strong>, select <strong>API Token</strong>, and paste it here.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {connectionStatus.connected && (
                  <button
                    type="button"
                    onClick={() => setIsEditingToken(false)}
                    className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isVerifying || !tokenInput.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-500 hover:text-slate-950 text-white font-extrabold text-xs transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Bot className="w-4 h-4 text-amber-400" />
                  <span>{isVerifying ? 'Verifying with Telegram...' : 'Connect & Authenticate Token'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* =========================================================================
            SECTION 2: Channel Configuration & Automatic Publishing Settings
        ========================================================================= */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#0B132B] text-amber-400 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Channel Destination & Auto-Publishing Rules
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Target Telegram Channel (@username, t.me link, or numeric -100... ID for private channels):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={channelUsername}
                  onChange={(e) => setChannelUsername(e.target.value)}
                  placeholder="@DreamBigJobsEthiopia or -1001234567890"
                  className="flex-1 text-xs font-bold p-3 rounded-xl border border-slate-300 focus:border-amber-500 outline-none bg-white text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => handleVerifyChannel()}
                  disabled={isVerifyingChannel}
                  className="px-3.5 py-3 rounded-xl bg-[#0B132B] hover:bg-slate-800 disabled:opacity-50 text-amber-400 text-xs font-extrabold whitespace-nowrap transition-colors"
                >
                  {isVerifyingChannel ? 'Checking...' : 'VERIFY TELEGRAM CONNECTION'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Public channels use <code className="bg-slate-200 px-1 rounded">@username</code>. Private channels require a private post link (<code className="bg-slate-200 px-1 rounded">t.me/c/...</code>) or numeric <code className="bg-slate-200 px-1 rounded">-100...</code> Channel ID.
              </p>

              {channelVerification && (
                <div
                  className={`mt-2.5 p-3 rounded-xl border text-[11px] space-y-2 ${
                    channelVerification.ok
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <div className="font-bold">
                    {channelVerification.ok && channelVerification.chat
                      ? `✅ ${channelVerification.statusLabel || 'Connected successfully'}: "${channelVerification.chat.title}" (${channelVerification.normalizedChannel}, ID: ${channelVerification.chat.id})`
                      : `❌ ${channelVerification.statusLabel ? `${channelVerification.statusLabel} — ` : ''}${channelVerification.error || 'Channel verification failed'}`}
                  </div>
                  {channelVerification.diagnosis && (
                    <p className="text-rose-800 leading-relaxed">{channelVerification.diagnosis}</p>
                  )}
                  {channelVerification.discoveredChats && channelVerification.discoveredChats.length > 0 && (
                    <div className="pt-1 space-y-1.5">
                      <div className="font-bold text-slate-800">Discovered Channels for This Bot (Click to Select &amp; Save):</div>
                      <div className="flex flex-wrap gap-1.5">
                        {channelVerification.discoveredChats.map((dc) => (
                          <button
                            key={dc.id}
                            type="button"
                            onClick={() => handleUseDiscoveredChat(dc)}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-amber-500 text-slate-900 font-bold text-[11px] shadow-xs"
                          >
                            Use &ldquo;{dc.title}&rdquo; ({dc.username || dc.id})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Automatic Telegram Broadcasting
                  </span>
                  <span className="text-[11px] text-slate-500 leading-snug">
                    Automatically send jobs to @DreamBigJobsEthiopia whenever you approve or publish a vacancy.
                  </span>
                </div>
                <input
                  type="checkbox"
                  id="autoPublishToggle"
                  checked={autoPublish}
                  onChange={(e) => setAutoPublish(e.target.checked)}
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer mt-0.5"
                />
              </div>

              <div className="text-[10px] text-emerald-700 font-semibold mt-2 pt-2 border-t border-slate-100 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Duplicate protection active (prevents posting same job twice).</span>
              </div>
            </div>

            {/* Custom Domain Configuration */}
            <div className="sm:col-span-2 bg-gradient-to-r from-amber-50 to-orange-50/60 p-4 rounded-xl border border-amber-300 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-amber-600" />
                  <span>Primary Website Domain (for Telegram Posts &amp; Vacancy Links):</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setCustomDomain('hopelandjobs.tech')}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                      customDomain === 'hopelandjobs.tech'
                        ? 'bg-amber-400 text-slate-950 border-amber-500 font-extrabold shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    hopelandjobs.tech
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomDomain('hopelandjobs.com')}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                      customDomain === 'hopelandjobs.com'
                        ? 'bg-amber-400 text-slate-950 border-amber-500 font-extrabold shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    hopelandjobs.com
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center flex-1 bg-white rounded-xl border border-amber-300 focus-within:ring-2 focus-within:ring-amber-500/20 overflow-hidden shadow-xs">
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-2.5 border-r border-slate-200 select-none font-bold">
                    https://
                  </span>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="hopelandjobs.tech"
                    className="flex-1 text-xs font-mono font-bold p-2.5 outline-none bg-white text-slate-900"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveChannelSettings}
                  disabled={isSavingSettings}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-xs transition-colors shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingSettings ? 'Saving...' : 'Save & Update Domain'}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-700 leading-relaxed">
                ✅ When you change or save the domain here, <strong>all Telegram Apply Now buttons and applicant redirects</strong> automatically route to <strong>https://{customDomain || 'hopelandjobs.tech'}</strong> without exposing raw links inside the post text.
              </p>
            </div>
          </div>

          {/* 3-Option Telegram Job Distribution Control */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                  Telegram Job Distribution Mode (Switch Anytime)
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Every broadcast is checked for authenticity, open deadline, non-duplication, and official application method before sending.
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#0B132B] text-amber-300 shrink-0">
                Active: {getTelegramDistributionModeLabel(distributionMode)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 font-semibold flex flex-wrap items-center justify-between gap-2">
              <span>
                🟢⭐ <strong>Mandatory WASH NGO Rule:</strong> Any genuine WASH-related NGO vacancy published under Option A, C, or D automatically receives{' '}
                <code className="px-1.5 py-0.5 bg-white rounded border border-emerald-300 font-extrabold text-emerald-800">🟢⭐ WASH JOB</code>{' '}
                before its title. Under Option B (Banking Only), NGO &amp; WASH jobs are strictly excluded.
              </span>
              <span className="text-[10px] font-bold text-slate-600">
                Applies to System 1 (Telegram/Bulk) only — never controls System 2.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  id: 'all_jobs' as TelegramDistributionMode,
                  code: 'OPTION A',
                  title: 'ALL JOBS',
                  desc: 'Publish every eligible verified vacancy across all sectors.',
                },
                {
                  id: 'banking_only' as TelegramDistributionMode,
                  code: 'OPTION B',
                  title: 'BANKING JOBS ONLY',
                  desc: 'Publish banking & financial institution vacancies only. Excludes NGO and WASH jobs.',
                },
                {
                  id: 'ngo_only' as TelegramDistributionMode,
                  code: 'OPTION C',
                  title: 'NGO JOBS ONLY',
                  desc: 'Publish NGO, INGO & UN vacancies only (qualifying WASH jobs carry 🟢⭐ WASH JOB).',
                },
                {
                  id: 'banking_and_ngo_only' as TelegramDistributionMode,
                  code: 'OPTION D',
                  title: 'BANKING & NGO ONLY',
                  desc: 'Publish banking and NGO vacancies together, excluding all other categories.',
                },
              ].map((opt) => {
                const active = distributionMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDistributionMode(opt.id)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      active
                        ? 'bg-[#0B132B] text-white border-amber-400 ring-2 ring-amber-400/40'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          active ? 'text-amber-400' : 'text-slate-500'
                        }`}
                      >
                        {opt.code}
                      </span>
                      {active && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div className="text-xs font-extrabold">{opt.title}</div>
                    <p
                      className={`text-[11px] mt-1 leading-relaxed ${
                        active ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Content Separation Rule */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-800">
                Channel Content Separation Rule (Protected by Default)
              </div>
              <p className="text-[11px] text-slate-500">
                International Immigration &amp; Permanent Residence items and Experience-Based Scholarships remain strictly separated on their dedicated website sections unless explicitly enabled below.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer text-xs">
                  <span className="font-semibold text-slate-700">Allow Immigration / PR alerts in Jobs Channel</span>
                  <input
                    type="checkbox"
                    checked={includeImmigration}
                    onChange={(e) => setIncludeImmigration(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer text-xs">
                  <span className="font-semibold text-slate-700">Allow Scholarship alerts in Jobs Channel</span>
                  <input
                    type="checkbox"
                    checked={includeScholarships}
                    onChange={(e) => setIncludeScholarships(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Permanent Bot Operational Instructions */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <label className="text-xs font-extrabold text-slate-900 block">
              Permanent Bot Operational Instructions &amp; Rules
            </label>
            <textarea
              rows={3}
              value={botInstructions}
              onChange={(e) => setBotInstructions(e.target.value)}
              placeholder="Enter standing operational instructions for your Telegram bot (e.g. WASH NGO 🟢⭐ labeling rules, posting tone, or channel moderation notes)..."
              className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:border-amber-500 outline-none resize-y"
            />
            <p className="text-[11px] text-slate-500">
              Saved permanently in database and restored automatically after server restarts, refreshes, and deployments.
            </p>
          </div>

          {/* Critical Channel Admin Instructions */}
          <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
            <h4 className="font-bold flex items-center gap-1.5 text-amber-950">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>Required Channel Setup (Do this once in Telegram):</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-800 font-medium">
              <li>Open your channel <strong>@DreamBigJobsEthiopia</strong> in the Telegram app.</li>
              <li>Go to <strong>Channel Settings &gt; Administrators &gt; Add Administrator</strong>.</li>
              <li>Search for <strong>@DreamBigJobsEthiopiaBot</strong> and select it.</li>
              <li>Ensure the <strong>"Post Messages"</strong> permission is enabled, then click Save.</li>
            </ol>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleSaveChannelSettings}
              disabled={isSavingSettings}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-colors shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>{isSavingSettings ? 'Saving...' : 'Save Channel & Auto-Publish Settings'}</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            SECTION 3: Test Broadcast & Vacancy Dispatcher
        ========================================================================= */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#0B132B] text-amber-400 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Test Broadcast to Telegram Channel
                </h3>
                <p className="text-[11px] text-slate-500">
                  Verify broadcasting to <strong>{channelUsername}</strong> with a test or live job.
                </p>
              </div>
            </div>

            {/* Vacancy selector if multiple available */}
            {allVacancies.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-semibold">Select Vacancy:</span>
                <select
                  value={selectedVacancyId}
                  onChange={(e) => setSelectedVacancyId(e.target.value)}
                  className="text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 max-w-xs truncate"
                >
                  <option value="sample_test_job">Standard Test Vacancy (CBE)</option>
                  {allVacancies.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} - {v.organization}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Broadcast Result Banner */}
          {broadcastResult && (
            <div
              className={`p-4 rounded-xl border text-xs font-semibold space-y-2 ${
                broadcastResult.success
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-rose-50 text-rose-900 border-rose-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {broadcastResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>
                    {broadcastResult.success
                      ? `Broadcast Successful! Posted to ${channelUsername} (Telegram Message ID: #${broadcastResult.telegramMessageId || 'N/A'})`
                      : `Broadcast Failed: ${broadcastResult.error || 'Unknown Telegram error'}`}
                  </span>
                </span>

                {broadcastResult.success && (
                  <a
                    href={`https://t.me/${channelUsername.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700"
                  >
                    <span>View in Channel</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {!broadcastResult.success && broadcastResult.error?.includes('chat not found') && (
                <div className="p-2.5 bg-white/80 rounded-lg text-rose-800 text-[11px] font-normal leading-relaxed">
                  <strong>Fix:</strong> Telegram returned <em>chat not found</em>. Ensure that you have created the channel <strong>{channelUsername}</strong> and that <strong>@DreamBigJobsEthiopiaBot</strong> is added as an Administrator.
                </div>
              )}
            </div>
          )}

          {/* Message Preview and Action */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Telegram message mockup preview - Clean structured post with Apply Now button */}
            <div className="bg-[#1C2733] text-white p-4 rounded-2xl shadow-inner font-sans space-y-3 text-xs border border-slate-700/60">
              <div className="flex items-center justify-between text-[10px] text-slate-400 pb-2 border-b border-white/10">
                <span className="flex items-center gap-1 font-bold text-[#229ED9]">
                  <Send className="w-3 h-3" />
                  <span>Telegram Post Preview</span>
                </span>
                <span className="font-mono text-slate-400">Apply button links to website</span>
              </div>
              <div className="space-y-1.5 leading-relaxed text-[11px] whitespace-pre-wrap">
                {isWashNgoVacancyClient(activeBroadcastVacancy) && (
                  <p className="inline-block font-black text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded mb-1">
                    🟢⭐ WASH JOB
                  </p>
                )}
                <p className="text-slate-100">
                  🏢 <strong>Employer:</strong> {activeBroadcastVacancy.organization || 'Employer'}
                </p>
                <p className="text-slate-100">
                  💼 <strong>Position:</strong> {activeBroadcastVacancy.title || 'Open Position'}
                </p>
                {activeBroadcastVacancy.salary &&
                  !/^(?:not specified(?:\s+in\s+the\s+original\s+vacancy)?|not stated|not mentioned|not available|not disclosed|unknown|tbd|n\/a|none|-)$/i.test(
                    activeBroadcastVacancy.salary.trim()
                  ) && (
                    <p className="text-slate-100">
                      💰 <strong>Salary:</strong> {activeBroadcastVacancy.salary}
                    </p>
                  )}
                {activeBroadcastVacancy.location &&
                  !/^(?:not specified(?:\s+in\s+the\s+original\s+vacancy)?|not stated|not mentioned|not available|not disclosed|unknown|tbd|n\/a|none|-)$/i.test(
                    activeBroadcastVacancy.location.trim()
                  ) && (
                    <p className="text-slate-100">
                      📍 <strong>City of Work:</strong> {activeBroadcastVacancy.location}
                    </p>
                  )}
                <p className="pt-2 text-[11px] text-slate-300 border-t border-white/10">
                  Full details &amp; how to apply are on our website. Tap <strong className="text-white">Apply Now</strong> below.
                </p>
              </div>
              <div className="pt-1">
                <div className="w-full py-2.5 px-4 rounded-xl bg-white/10 border border-white/15 text-center font-bold text-xs text-white flex items-center justify-center gap-1.5">
                  <span>Apply Now</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                </div>
              </div>
            </div>

            {/* Broadcast action trigger box */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
              <div>
                <h4 className="font-bold text-xs text-slate-900 mb-1">
                  Send to {channelUsername}
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Click below to publish the selected vacancy or send a standalone connection test message.
                </p>
              </div>

              {activeBroadcastVacancy.telegramPublished && (
                <div className="p-3 bg-blue-50 text-blue-900 rounded-xl text-xs flex items-center justify-between">
                  <span>Already published to Telegram (Msg #{activeBroadcastVacancy.telegramMessageId || 'Yes'})</span>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-blue-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceRetry}
                      onChange={(e) => setForceRetry(e.target.checked)}
                      className="accent-blue-600"
                    />
                    <span>Force Re-send</span>
                  </label>
                </div>
              )}

              <button
                onClick={handleBroadcastToChannel}
                disabled={isBroadcasting || !connectionStatus.connected}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#229ED9] hover:bg-[#1b8ec5] text-white font-extrabold text-xs transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className={`w-4 h-4 ${isBroadcasting ? 'animate-bounce' : ''}`} />
                <span>
                  {isBroadcasting
                    ? 'Publishing to Telegram...'
                    : activeBroadcastVacancy.telegramPublished
                    ? 'Re-broadcast to Channel'
                    : 'Send Live Post to Channel'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleSendTestMessageDirect}
                disabled={isSendingTestMessage}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-amber-400 font-extrabold text-xs transition-colors shadow-xs disabled:opacity-50"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{isSendingTestMessage ? 'Sending Test Message...' : 'Send Test Message'}</span>
              </button>

              {!connectionStatus.connected && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  ⚠️ Configure and verify your Bot Token on the server in Step 1 before broadcasting.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
