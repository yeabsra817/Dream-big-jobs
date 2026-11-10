import { Vacancy } from '../types/job';

export const LOCAL_STORAGE_TOKEN_KEY = 'dreambigjobs_telegram_bot_token';

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
 * Normalizes user-configured domain or URL into a clean base URL (default: hopelandjobs.tech)
 */
export function normalizeWebsiteDomain(domainOrUrl?: string): string {
  if (!domainOrUrl || !domainOrUrl.trim() || domainOrUrl.trim() === 'healmorin.com') return 'https://hopelandjobs.tech';
  let clean = domainOrUrl.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return `https://${clean}`;
}

/**
 * Format Telegram message HTML - Exact Ethiopian Telegram vacancy template matching Harmeejobs screenshot:
 * <b>Vacancy at [Organization]</b>
 * 🔰 <b>[Organization] ([Amharic Org])</b> invites qualified applicants for the <b>[Position]</b> position.
 * ✅ <b>Education field:</b> [Field & Qualifications]
 * 📌 <b>ስለ ስራው ሙሉ መረጃ ለማየት ይህንን ሊንክ ይጠቀሙ</b>
 * 👉<b>Read Detail:-</b> <a href="[VacancyURL]">[VacancyURL]</a>
 * 🔰 <b>ከተለያዩ ድርጅት የሥራ ማስታወቂያዎች በዚህ ሊንክ ዌብሳይቱ ላይ ይመልከቱ 👇👇</b>
 * =><b>See Detail:-</b> <a href="[BaseURL]">[BaseURL]</a>
 * 🔰 <b>Telegram:-</b> <a href="[ChannelURL]">[ChannelURL]</a>
 */
export function buildTelegramJobHtml(
  vacancy: any,
  customDomainOrUrl = 'hopelandjobs.tech',
  channelUsername = '@DreamBigJobsEthiopia'
): string {
  const baseUrl = normalizeWebsiteDomain(customDomainOrUrl);
  const vacancyLink = `${baseUrl}/?jobId=${encodeURIComponent(vacancy.id)}&utm_source=telegram&utm_medium=channel&utm_campaign=vacancy`;
  const cleanChan = channelUsername.replace(/^@/, '');
  const channelUrl = `https://t.me/${cleanChan}`;

  const orgName = escapeHtml(vacancy.organization || 'Employer');
  const orgAmharic = vacancy.organizationAmharic ? ` (${escapeHtml(vacancy.organizationAmharic)})` : '';
  const positionTitle = escapeHtml(vacancy.title || 'Various Positions');

  // Education field & qualifications description
  const eduParts: string[] = [];
  if (vacancy.requiredFieldOfStudy) eduParts.push(vacancy.requiredFieldOfStudy);
  if (vacancy.educationQualification) eduParts.push(vacancy.educationQualification);
  if (vacancy.requiredSkills && Array.isArray(vacancy.requiredSkills) && vacancy.requiredSkills.length > 0) {
    eduParts.push(vacancy.requiredSkills.join(' / '));
  }
  if (eduParts.length === 0) {
    eduParts.push(vacancy.category || 'Accounting & Finance / Banking / Business / Information Technology / Engineering and related fields');
  }
  if (vacancy.experienceYears) {
    eduParts.push(`${vacancy.experienceYears} experience`);
  }
  const educationFieldText = escapeHtml(eduParts.join(', '));

  return `<b>Vacancy at ${orgName}</b>

🔰 <b>${orgName}${orgAmharic}</b> invites qualified applicants for the <b>${positionTitle}</b> position.

✅ <b>Education field:</b> ${educationFieldText}

📌 <b>ስለ ስራው ሙሉ መረጃ ለማየት ይህንን ሊንክ ይጠቀሙ</b>
👉<b>Read Detail:-</b> <a href="${vacancyLink}">${vacancyLink}</a>

🔰 <b>ከተለያዩ ድርጅት የሥራ ማስታወቂያዎች በዚህ ሊንክ ዌብሳይቱ ላይ ይመልከቱ 👇👇</b>
=&gt;<b>See Detail:-</b> <a href="${baseUrl}">${baseUrl}</a>

🔰 <b>Telegram:-</b> <a href="${channelUrl}">${channelUrl}</a>`;
}

/**
 * Format Telegram message plain text (safe fallback if HTML parse fails)
 */
export function buildTelegramJobPlainText(
  vacancy: any,
  customDomainOrUrl = 'hopelandjobs.tech',
  channelUsername = '@DreamBigJobsEthiopia'
): string {
  const baseUrl = normalizeWebsiteDomain(customDomainOrUrl);
  const vacancyLink = `${baseUrl}/?jobId=${encodeURIComponent(vacancy.id)}&utm_source=telegram&utm_medium=channel&utm_campaign=vacancy`;
  const cleanChan = channelUsername.replace(/^@/, '');
  const channelUrl = `https://t.me/${cleanChan}`;

  const orgName = vacancy.organization || 'Employer';
  const orgAmharic = vacancy.organizationAmharic ? ` (${vacancy.organizationAmharic})` : '';
  const positionTitle = vacancy.title || 'Various Positions';

  const eduParts: string[] = [];
  if (vacancy.requiredFieldOfStudy) eduParts.push(vacancy.requiredFieldOfStudy);
  if (vacancy.educationQualification) eduParts.push(vacancy.educationQualification);
  if (vacancy.requiredSkills && Array.isArray(vacancy.requiredSkills) && vacancy.requiredSkills.length > 0) {
    eduParts.push(vacancy.requiredSkills.join(' / '));
  }
  if (eduParts.length === 0) {
    eduParts.push(vacancy.category || 'Accounting & Finance / Banking / Business / Information Technology / Engineering and related fields');
  }
  if (vacancy.experienceYears) {
    eduParts.push(`${vacancy.experienceYears} experience`);
  }
  const educationFieldText = eduParts.join(', ');

  return `Vacancy at ${orgName}

🔰 ${orgName}${orgAmharic} invites qualified applicants for the ${positionTitle} position.

✅ Education field: ${educationFieldText}

📌 ስለ ስራው ሙሉ መረጃ ለማየት ይህንን ሊንክ ይጠቀሙ
👉Read Detail:- ${vacancyLink}

🔰 ከተለያዩ ድርጅት የሥራ ማስታወቂያዎች በዚህ ሊንክ ዌብሳይቱ ላይ ይመልከቱ 👇👇
=>See Detail:- ${baseUrl}

🔰 Telegram:- ${channelUrl}`;
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
  forceRetry = false,
  customDomain?: string
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

  // Priority for domain: customDomain argument -> localStorage settings -> window.location.hostname -> hopelandjobs.tech
  let effectiveDomain = customDomain;
  if (!effectiveDomain) {
    try {
      const saved = localStorage.getItem('dreambigjobs_site_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.customDomain && parsed.customDomain !== 'healmorin.com') effectiveDomain = parsed.customDomain;
      }
    } catch {}
  }
  if (!effectiveDomain && typeof window !== 'undefined' && window.location.hostname && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('run.app')) {
    effectiveDomain = window.location.hostname;
  }
  if (!effectiveDomain || effectiveDomain === 'healmorin.com') effectiveDomain = 'hopelandjobs.tech';

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
        customDomain: effectiveDomain,
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

  const htmlMsg = buildTelegramJobHtml(vacancy, effectiveDomain, cleanChan);
  const plainMsg = buildTelegramJobPlainText(vacancy, effectiveDomain, cleanChan);

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
