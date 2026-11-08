import { Vacancy } from '../types/job';

const LOCAL_STORAGE_TOKEN_KEY = 'dreambigjobs_telegram_bot_token';

/**
 * Robust sanitizer for Telegram bot tokens:
 * - Strips all whitespace, tabs, newlines (including spaces before/after colon from mobile keyboards)
 * - Removes zero-width Unicode characters, quotes, and invalid symbols
 */
export function cleanTelegramToken(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\s\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

/**
 * Validates Telegram bot token structure: <number>:<alphanumeric_secret>
 */
export function isValidTelegramTokenFormat(token: string): boolean {
  const cleaned = cleanTelegramToken(token);
  return /^\d{6,14}:[A-Za-z0-9_-]{20,}$/.test(cleaned);
}

/**
 * Mask token for safe UI display (e.g., 922825••••••••u1ep)
 */
export function maskTelegramToken(token: string): string {
  const cleaned = cleanTelegramToken(token);
  if (cleaned.length < 10) return '••••••••';
  return `${cleaned.substring(0, 6)}••••••••${cleaned.slice(-4)}`;
}

/**
 * Escape HTML special characters for Telegram HTML parse mode
 */
function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format telegram message HTML
 */
export function buildTelegramJobHtml(vacancy: any, appUrl = 'https://dreambigjobs.et'): string {
  const vacancyLink = `${appUrl}/?jobId=${encodeURIComponent(vacancy.id)}&utm_source=telegram&utm_medium=social&utm_campaign=job_posting`;
  const applyUrlLine =
    vacancy.applicationUrl &&
    vacancy.applicationUrl !== 'Not specified in the original vacancy' &&
    String(vacancy.applicationUrl).trim() !== ''
      ? `🌐 <b>Official Apply Link:</b> ${escapeHtml(vacancy.applicationUrl)}\n`
      : '';
  const applyEmailLine =
    vacancy.applicationEmail &&
    vacancy.applicationEmail !== 'Not specified in the original vacancy' &&
    String(vacancy.applicationEmail).trim() !== ''
      ? `✉️ <b>Apply Email:</b> ${escapeHtml(vacancy.applicationEmail)}\n`
      : '';

  return `🌟 <b>NEW JOB VACANCY | DREAM BIG JOBS 🇪🇹</b>
━━━━━━━━━━━━━━━━━━━━
💼 <b>Position:</b> ${escapeHtml(vacancy.title || 'Job Vacancy')}
🏢 <b>Organization:</b> ${escapeHtml(vacancy.organization || 'Ethiopian Employer')}
📂 <b>Category:</b> ${escapeHtml(vacancy.category || 'General')}
📍 <b>Location:</b> ${escapeHtml(vacancy.location || 'Addis Ababa, Ethiopia')}
⏳ <b>Deadline:</b> ${escapeHtml(vacancy.applicationDeadline || 'See description')}
💰 <b>Salary:</b> ${escapeHtml(vacancy.salary || 'Attractive / Company Scale')}
📜 <b>Experience:</b> ${escapeHtml(vacancy.experienceYears || 'Relevant experience')}
${applyUrlLine}${applyEmailLine}
🔗 <b>Full Job Details & Requirements on Website:</b>
${escapeHtml(vacancyLink)}

━━━━━━━━━━━━━━━━━━━━
👉 <b>Join DREAM BIG JOBS Channel:</b> @DreamBigJobsEthiopia
<b>Dream Big. Find Your Opportunity.</b>`;
}

/**
 * Format telegram message plain text (safe fallback if HTML parse fails)
 */
export function buildTelegramJobPlainText(vacancy: any, appUrl = 'https://dreambigjobs.et'): string {
  const vacancyLink = `${appUrl}/?jobId=${encodeURIComponent(vacancy.id)}&utm_source=telegram&utm_medium=social&utm_campaign=job_posting`;
  const applyUrlLine =
    vacancy.applicationUrl &&
    vacancy.applicationUrl !== 'Not specified in the original vacancy' &&
    String(vacancy.applicationUrl).trim() !== ''
      ? `🌐 Official Apply Link: ${vacancy.applicationUrl}\n`
      : '';
  const applyEmailLine =
    vacancy.applicationEmail &&
    vacancy.applicationEmail !== 'Not specified in the original vacancy' &&
    String(vacancy.applicationEmail).trim() !== ''
      ? `✉️ Apply Email: ${vacancy.applicationEmail}\n`
      : '';

  return `🌟 NEW JOB VACANCY | DREAM BIG JOBS 🇪🇹
━━━━━━━━━━━━━━━━━━━━
💼 Position: ${vacancy.title || 'Job Vacancy'}
🏢 Organization: ${vacancy.organization || 'Ethiopian Employer'}
📂 Category: ${vacancy.category || 'General'}
📍 Location: ${vacancy.location || 'Addis Ababa, Ethiopia'}
⏳ Deadline: ${vacancy.applicationDeadline || 'See description'}
💰 Salary: ${vacancy.salary || 'Attractive / Company Scale'}
📜 Experience: ${vacancy.experienceYears || 'Relevant experience'}
${applyUrlLine}${applyEmailLine}
🔗 Full Job Details & Requirements on Website:
${vacancyLink}

━━━━━━━━━━━━━━━━━━━━
👉 Join DREAM BIG JOBS Channel: @DreamBigJobsEthiopia
Dream Big. Find Your Opportunity.`;
}

/**
 * Direct Telegram Bot API caller (CORS-enabled from browser directly to https://api.telegram.org)
 */
export async function directTelegramApiCall(token: string, method: string, payload?: Record<string, any>): Promise<any> {
  const clean = cleanTelegramToken(token);
  const url = `https://api.telegram.org/bot${clean}/${method}`;

  const options: RequestInit = {
    method: payload ? 'POST' : 'GET',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  };

  const res = await fetch(url, options);
  const text = await res.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Telegram API returned non-JSON response (${res.status}): ${text.substring(0, 100)}`);
  }

  return data;
}

/**
 * Authenticate and verify Telegram Bot Token with dual-channel fallback:
 * 1. Tries server backend proxy (/api/telegram/configure-token)
 * 2. If server returns 404/HTML (e.g. static Vercel deployment), falls back seamlessly to direct Telegram API
 */
export async function verifyTelegramBotToken(rawToken: string): Promise<{
  success: boolean;
  bot?: {
    id: number;
    first_name: string;
    username: string;
  };
  maskedToken?: string;
  cleanToken: string;
  error?: string;
  directMode?: boolean;
}> {
  const clean = cleanTelegramToken(rawToken);

  if (!isValidTelegramTokenFormat(clean)) {
    return {
      success: false,
      cleanToken: clean,
      error: 'Invalid Telegram bot token format. Token must follow <id>:<secret> without spaces (e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ).',
    };
  }

  // Channel 1: Try server backend proxy
  try {
    const res = await fetch('/api/telegram/configure-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: clean }),
    });

    const text = await res.text();
    // Check if response is valid JSON (not an HTML error page like "The page could not be found")
    if (res.ok && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      try {
        const data = JSON.parse(text);
        if (data.success && data.bot) {
          try {
            localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, clean);
          } catch {}
          return {
            success: true,
            bot: data.bot,
            maskedToken: data.maskedToken || maskTelegramToken(clean),
            cleanToken: clean,
            directMode: false,
          };
        } else if (data.error) {
          return { success: false, cleanToken: clean, error: data.error };
        }
      } catch {
        // Fall through to Channel 2
      }
    }
  } catch {
    // Fall through to Channel 2
  }

  // Channel 2: Direct browser-to-Telegram call (CORS supported)
  try {
    const data = await directTelegramApiCall(clean, 'getMe');
    if (data.ok && data.result) {
      try {
        localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, clean);
      } catch {}
      return {
        success: true,
        bot: {
          id: data.result.id,
          first_name: data.result.first_name,
          username: data.result.username,
        },
        maskedToken: maskTelegramToken(clean),
        cleanToken: clean,
        directMode: true,
      };
    } else {
      return {
        success: false,
        cleanToken: clean,
        error: `Telegram authentication rejected: ${data.description || 'Invalid token. Please check @BotFather.'}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      cleanToken: clean,
      error: `Could not reach Telegram: ${err.message || String(err)}`,
    };
  }
}

/**
 * Check current Telegram connection status with dual-channel fallback
 */
export async function checkTelegramConnectionStatus(savedToken?: string): Promise<{
  configured: boolean;
  connected: boolean;
  bot?: { id: number; first_name: string; username: string };
  maskedToken?: string;
  error?: string;
  directMode?: boolean;
}> {
  // Channel 1: Check server backend
  try {
    const res = await fetch('/api/telegram/status');
    const text = await res.text();
    if (res.ok && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      try {
        const data = JSON.parse(text);
        if (data.configured && data.connected) {
          return data;
        }
      } catch {}
    }
  } catch {}

  // Channel 2: Check local storage or saved token
  const token = cleanTelegramToken(
    savedToken || (typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY) || '' : '')
  );

  if (!token) {
    return {
      configured: false,
      connected: false,
      error: 'TELEGRAM_BOT_TOKEN is not configured yet.',
    };
  }

  try {
    const data = await directTelegramApiCall(token, 'getMe');
    if (data.ok && data.result) {
      return {
        configured: true,
        connected: true,
        bot: {
          id: data.result.id,
          first_name: data.result.first_name,
          username: data.result.username,
        },
        maskedToken: maskTelegramToken(token),
        directMode: true,
      };
    } else {
      return {
        configured: true,
        connected: false,
        error: data.description || 'Bot token was rejected by Telegram API.',
      };
    }
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      error: `Connection error: ${err.message || String(err)}`,
    };
  }
}

/**
 * Test Connection Ping with latency measurement
 */
export async function testTelegramPing(token?: string): Promise<{
  success: boolean;
  latencyMs: number;
  bot?: { id: number; first_name: string; username: string };
  error?: string;
}> {
  const start = Date.now();

  // Try server first
  try {
    const res = await fetch('/api/telegram/test-connection', { method: 'POST' });
    const text = await res.text();
    if (res.ok && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      try {
        const data = JSON.parse(text);
        if (data.success) {
          return data;
        }
      } catch {}
    }
  } catch {}

  // Fallback to direct client ping
  const effectiveToken = cleanTelegramToken(
    token || (typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY) || '' : '')
  );

  if (!effectiveToken) {
    return { success: false, latencyMs: 0, error: 'No token configured to ping.' };
  }

  try {
    const data = await directTelegramApiCall(effectiveToken, 'getMe');
    const latencyMs = Date.now() - start;
    if (data.ok && data.result) {
      return {
        success: true,
        latencyMs,
        bot: {
          id: data.result.id,
          first_name: data.result.first_name,
          username: data.result.username,
        },
      };
    } else {
      return { success: false, latencyMs, error: data.description || 'Ping test failed' };
    }
  } catch (err: any) {
    return { success: false, latencyMs: Date.now() - start, error: err.message || String(err) };
  }
}

/**
 * Universal job broadcast to Telegram channel:
 * 1. Attempts server backend proxy (/api/admin/telegram-publish)
 * 2. If server returns 404/HTML (e.g. static hosting on Vercel), sends directly via Telegram Bot API
 */
export async function broadcastJobToTelegram(
  vacancy: Vacancy,
  channelName: string,
  botToken?: string,
  forceRetry = false
): Promise<{
  success: boolean;
  telegramMessageId?: number;
  telegramPublishedAt?: string;
  error?: string;
  alreadyPublished?: boolean;
}> {
  const cleanChan = channelName.trim().startsWith('@')
    ? channelName.trim()
    : `@${channelName.trim()}`;

  // Channel 1: Try server backend proxy
  try {
    const res = await fetch('/api/admin/telegram-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vacancy,
        channelName: cleanChan,
        botToken: botToken ? cleanTelegramToken(botToken) : undefined,
        forceRetry,
      }),
    });

    const text = await res.text();
    if (res.ok && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      try {
        const data = JSON.parse(text);
        return data;
      } catch {}
    }
  } catch {}

  // Channel 2: Direct browser-to-Telegram broadcast
  const effectiveToken = cleanTelegramToken(
    botToken || (typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY) || '' : '')
  );

  if (!effectiveToken) {
    return {
      success: false,
      error: 'Telegram Bot Token is not configured. Please paste your token in Bot Config & Test.',
    };
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://dreambigjobs.et';
  const htmlMsg = buildTelegramJobHtml(vacancy, appUrl);
  const plainMsg = buildTelegramJobPlainText(vacancy, appUrl);

  try {
    // Attempt HTML delivery
    const data = await directTelegramApiCall(effectiveToken, 'sendMessage', {
      chat_id: cleanChan,
      text: htmlMsg,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    });

    if (data.ok && data.result) {
      return {
        success: true,
        telegramMessageId: data.result.message_id,
        telegramPublishedAt: new Date().toISOString(),
      };
    }

    // If HTML entity parsing fails, retry with safe plain text
    const fallbackData = await directTelegramApiCall(effectiveToken, 'sendMessage', {
      chat_id: cleanChan,
      text: plainMsg,
      disable_web_page_preview: false,
    });

    if (fallbackData.ok && fallbackData.result) {
      return {
        success: true,
        telegramMessageId: fallbackData.result.message_id,
        telegramPublishedAt: new Date().toISOString(),
      };
    }

    return {
      success: false,
      error: fallbackData.description || data.description || 'Telegram channel broadcast failed. Check bot channel admin rights.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Telegram broadcast error: ${err.message || String(err)}`,
    };
  }
}
