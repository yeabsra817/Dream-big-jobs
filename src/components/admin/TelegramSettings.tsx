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
} from 'lucide-react';
import { SiteSettings, Vacancy } from '../../types/job';
import {
  cleanTelegramToken,
  isValidTelegramTokenFormat,
  verifyTelegramBotToken,
  checkTelegramConnectionStatus,
  testTelegramPing,
  broadcastJobToTelegram,
} from '../../utils/telegramClient';

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
  // Bot Connection State
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTestingPing, setIsTestingPing] = useState(false);
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
  }>({
    configured: false,
    connected: false,
  });

  // Channel & Broadcast Settings State
  const [channelUsername, setChannelUsername] = useState(
    settings.telegramChannelName || '@DreamBigJobsEthiopia'
  );
  const [autoPublish, setAutoPublish] = useState(settings.telegramAutoPublish ?? true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

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

  // Check current bot connection status on load
  const checkStatus = async () => {
    try {
      const data = await checkTelegramConnectionStatus(settings.telegramBotToken);
      setConnectionStatus(data as any);
      if (data.connected && data.bot) {
        setFeedbackMessage({
          type: 'success',
          text: `Connected to @${data.bot.username} (${data.bot.first_name}). Telegram Bot API is active and ready to broadcast.`,
        });
      } else if (!data.connected) {
        setFeedbackMessage({
          type: 'info',
          text: 'Telegram bot is not connected yet. Paste your Bot Token from @BotFather below and click "Connect & Authenticate Token".',
        });
      }
    } catch (err: any) {
      console.warn('Status check notice:', err);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [settings.telegramBotToken]);

  // Securely configure Bot Token (auto-sanitizes spaces and supports dual-channel verification)
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
        setTokenInput(''); // Clear raw token from client input
        setFeedbackMessage({
          type: 'success',
          text: `Success! Telegram Bot API verified @${data.bot.username} (${data.bot.first_name}). Ready to broadcast vacancies!`,
        });

        // Save bot username and token to settings
        await onSaveSettings({
          ...settings,
          telegramBotToken: cleanToken,
          telegramBotUsername: data.bot.username,
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
      const data = await testTelegramPing(settings.telegramBotToken);

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

  // Save Channel and Auto-Publish Settings
  const handleSaveChannelSettings = async () => {
    setIsSavingSettings(true);
    try {
      const cleanChan = channelUsername.trim().startsWith('@')
        ? channelUsername.trim()
        : `@${channelUsername.trim()}`;
      const channelSlug = cleanChan.replace('@', '');
      const newSettings: SiteSettings = {
        ...settings,
        telegramChannelName: cleanChan,
        telegramChannelUrl: `https://t.me/${channelSlug}`,
        telegramAutoPublish: autoPublish,
        updatedAt: new Date().toISOString(),
      };
      await onSaveSettings(newSettings);
      setFeedbackMessage({
        type: 'success',
        text: `Channel settings saved: Broadcasting to ${cleanChan}. Auto-publish: ${autoPublish ? 'ENABLED' : 'DISABLED'}.`,
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

  // Broadcast vacancy to channel with dual-channel resilience
  const handleBroadcastToChannel = async () => {
    if (!connectionStatus.connected) {
      alert('Please connect and verify your bot token first.');
      return;
    }

    setIsBroadcasting(true);
    setBroadcastResult(null);

    try {
      const data = await broadcastJobToTelegram(
        activeBroadcastVacancy,
        channelUsername,
        settings.telegramBotToken,
        forceRetry
      );
      setBroadcastResult(data);

      if (data.success) {
        if (onUpdateVacancyTelegramStatus && activeBroadcastVacancy.id !== 'sample_test_job') {
          await onUpdateVacancyTelegramStatus(
            activeBroadcastVacancy.id,
            true,
            data.telegramMessageId
          );
        }
      }
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

          {/* Secure Token Configuration Form */}
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

            <div className="flex justify-end pt-1">
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
                Target Telegram Channel Username:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={channelUsername}
                  onChange={(e) => setChannelUsername(e.target.value)}
                  placeholder="@DreamBigJobsEthiopia"
                  className="w-full text-xs font-bold p-3 rounded-xl border border-slate-300 focus:border-amber-500 outline-none bg-white text-slate-900"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Official channel for visitors: <a href="https://t.me/DreamBigJobsEthiopia" target="_blank" rel="noopener noreferrer" className="text-[#0288D1] underline font-bold">https://t.me/DreamBigJobsEthiopia</a>
              </p>
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
            {/* Telegram message mockup preview */}
            <div className="bg-[#2B5278] text-white p-4 rounded-2xl shadow-inner font-sans space-y-2 text-xs">
              <div className="flex items-center justify-between text-[10px] text-slate-300 pb-2 border-b border-white/10">
                <span className="flex items-center gap-1 font-bold">
                  <Send className="w-3 h-3 text-[#229ED9]" />
                  <span>Telegram Message Preview</span>
                </span>
                <span>DREAM BIG JOBS Channel</span>
              </div>
              <div className="space-y-1.5 leading-relaxed">
                <p className="font-bold text-amber-300">🌟 NEW JOB VACANCY | DREAM BIG JOBS 🇪🇹</p>
                <div className="border-t border-white/20 pt-1 text-[11px] space-y-0.5">
                  <p>💼 <strong>Position:</strong> {activeBroadcastVacancy.title}</p>
                  <p>🏢 <strong>Organization:</strong> {activeBroadcastVacancy.organization}</p>
                  <p>📂 <strong>Category:</strong> {activeBroadcastVacancy.category}</p>
                  <p>📍 <strong>Location:</strong> {activeBroadcastVacancy.location}</p>
                  <p>⏳ <strong>Deadline:</strong> {activeBroadcastVacancy.applicationDeadline}</p>
                  <p>💰 <strong>Salary:</strong> {activeBroadcastVacancy.salary}</p>
                  <p>📜 <strong>Experience:</strong> {activeBroadcastVacancy.experienceYears}</p>
                  {activeBroadcastVacancy.applicationUrl && (
                    <p className="text-blue-200">🌐 <strong>Apply Link:</strong> {activeBroadcastVacancy.applicationUrl}</p>
                  )}
                  <p className="text-amber-200 pt-1">
                    🔗 <strong>Full Job Details on Website:</strong> https://dreambigjobs.et/?jobId={activeBroadcastVacancy.id}
                  </p>
                </div>
                <div className="border-t border-white/20 pt-1 text-[10px] text-slate-200">
                  👉 <strong>Join DREAM BIG JOBS Channel:</strong> @DreamBigJobsEthiopia
                  <br />
                  <em>Dream Big. Find Your Opportunity.</em>
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
                  Click the button below to send this vacancy to your Telegram channel via your bot.
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

              {!connectionStatus.connected && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  ⚠️ Configure and authenticate your Bot Token in Step 1 before broadcasting.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
