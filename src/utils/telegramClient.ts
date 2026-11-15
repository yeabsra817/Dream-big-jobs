import { SiteSettings, TelegramDistributionMode, Vacancy } from '../types/job';

export const LOCAL_STORAGE_TOKEN_KEY = 'dreambigjobs_telegram_bot_token';

/**
 * Determine whether a vacancy is genuinely a Banking / Financial Institution job.
 */
export function isBankingVacancyClient(v: Partial<Vacancy>): boolean {
  const cat = String(v.category || '').toLowerCase();
  const title = String(v.title || '').toLowerCase();
  const org = String(v.organization || '').toLowerCase();
  const desc = String(v.description || '').toLowerCase();
  if (cat.includes('banking') || cat.includes('microfinance') || cat.includes('insurance')) {
    return true;
  }
  if (/\b(bank|microfinance|s\.?c\.?|savings and credit|cooperative bank|national bank|development bank)\b/i.test(org)) {
    return true;
  }
  if (/\b(branch manager|banker|teller|loan officer|credit analyst|treasury|kyc|aml|core banking|banking operations)\b/i.test(title)) {
    return true;
  }
  if (/\bcommercial bank|dashen bank|awash bank|abyssinia|wegagen|hibret|nib bank|oromia bank|tsedey bank|zemen bank|berhan bank|enat bank|bunna bank\b/i.test(`${org} ${desc}`)) {
    return true;
  }
  return false;
}

/**
 * Determine whether a vacancy is genuinely an NGO / UN / Diplomatic / International Organization job.
 */
export function isNgoVacancyClient(v: Partial<Vacancy>): boolean {
  const cat = String(v.category || '').toLowerCase();
  const title = String(v.title || '').toLowerCase();
  const org = String(v.organization || '').toLowerCase();
  if (cat.includes('ngo') || cat.includes('civil society') || cat.includes('embassies') || cat.includes('diplomatic')) {
    return true;
  }
  if (/\b(unicef|undp|unhcr|wfp|who|fao|ilo|unesco|usaid|giz|msf|médecins sans frontières|save the children|world vision|care|oxfam|plan international|nrc|irc|mercy corps|icrc|red cross|pathfinder|fhi 360|crs|catholic relief|action against hunger|danish refugee|goal|tearfund|sos children|amref|jhpiego|psi|engenderhealth|pact|rti|chemonics)\b/i.test(org)) {
    return true;
  }
  if (/\b(ngo|international organization|non-governmental|humanitarian|donor funded|embassy|diplomatic mission)\b/i.test(`${org} ${title}`)) {
    return true;
  }
  return false;
}

/**
 * Determine whether a verified NGO/INGO vacancy is genuinely related to WASH
 * (Water, Sanitation and Hygiene) by inspecting title, responsibilities, and description.
 * Never classifies non-WASH NGO positions (e.g., Accountant, Child Protection) as WASH.
 */
export function isWashNgoVacancyClient(v: Partial<Vacancy>): boolean {
  if (!isNgoVacancyClient(v)) return false;
  const responsibilitiesText = Array.isArray(v.responsibilities) ? v.responsibilities.join(' ') : '';
  const skillsText = Array.isArray(v.requiredSkills) ? v.requiredSkills.join(' ') : '';
  const combined = `${v.title || ''} ${v.description || ''} ${responsibilitiesText} ${v.requiredFieldOfStudy || ''} ${skillsText} ${v.specialRequirements || ''}`;
  return /\b(wash|water,?\s*sanitation\s*(?:and|&)\s*hygiene|water\s+and\s+sanitation|sanitation\s+and\s+water\s+supply|hygiene\s+promotion|sanitation\s+and\s+hygiene|wash\s+officer|wash\s+coordinator|wash\s+project\s+manager|wash\s+engineer(?:ing)?|emergency\s+wash|community\s+water\s+and\s+sanitation|latrine\s+construction|borehole\s+rehabilitation|water\s+supply\s+scheme|water\s+quality\s+monitoring)\b/i.test(
    combined
  );
}

export function getTelegramDistributionModeLabel(mode?: TelegramDistributionMode): string {
  switch (mode) {
    case 'banking_only':
      return 'OPTION B: BANKING JOBS ONLY';
    case 'ngo_only':
      return 'OPTION C: NGO JOBS ONLY';
    case 'banking_and_ngo_only':
      return 'OPTION D: BANKING AND NGO JOBS ONLY';
    case 'all_jobs':
    default:
      return 'OPTION A: ALL JOBS';
  }
}

export function isVacancyDeadlineExpiredClient(deadline?: string): boolean {
  if (!deadline) return false;
  const trimmed = deadline.trim();
  if (!trimmed || /not stated|open until filled|ongoing|rolling/i.test(trimmed)) return false;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(23, 59, 59, 999);
  return parsed.getTime() < today.getTime();
}

export function hasOfficialApplicationMethodClient(v: Partial<Vacancy>): boolean {
  const url = String(v.applicationUrl || '').trim();
  const email = String(v.applicationEmail || '').trim();
  const instr = String(v.applicationInstructions || '').trim();
  const contact = String(v.contactInfo || '').trim();
  return Boolean(url.length > 6 || email.includes('@') || instr.length > 8 || contact.length > 5);
}

/**
 * Enforces Telegram 4-option distribution setting + pre-publish quality/deadline/content separation checks.
 */
export function evaluateVacancyForTelegramClient(
  vacancy: Partial<Vacancy>,
  settings?: Partial<SiteSettings>,
  forceRetry = false,
  contentType: 'vacancy' | 'international_job' | 'immigration' | 'scholarship' = 'vacancy'
): { allowed: boolean; reason?: string } {
  const mode: TelegramDistributionMode = settings?.telegramDistributionMode || 'all_jobs';

  if (contentType === 'immigration' && !settings?.telegramIncludeInternationalImmigration) {
    return {
      allowed: false,
      reason: 'Blocked by Content Separation Rule: International Immigration & Permanent Residence items are never sent to the Jobs Telegram channel unless explicitly enabled.',
    };
  }
  if (contentType === 'scholarship' && !settings?.telegramIncludeScholarships) {
    return {
      allowed: false,
      reason: 'Blocked by Content Separation Rule: Scholarship opportunities are never sent to the Jobs Telegram channel unless explicitly enabled.',
    };
  }
  if (!vacancy.title || !vacancy.organization) {
    return { allowed: false, reason: 'Blocked: Missing job title or employer.' };
  }
  if (!forceRetry && vacancy.telegramPublished) {
    return { allowed: false, reason: 'Blocked: Already published to Telegram (duplicate protection).' };
  }
  if (vacancy.status === 'expired' || isVacancyDeadlineExpiredClient(vacancy.applicationDeadline)) {
    return { allowed: false, reason: `Blocked: Application deadline (${vacancy.applicationDeadline || 'expired'}) is closed.` };
  }
  if (!hasOfficialApplicationMethodClient(vacancy)) {
    return { allowed: false, reason: 'Blocked: Official employer application method (URL, email, or verified instructions) is missing.' };
  }
  if (mode === 'banking_only' && !isBankingVacancyClient(vacancy)) {
    return { allowed: false, reason: 'Filtered out by OPTION B (BANKING JOBS ONLY): Not a verified banking/financial vacancy.' };
  }
  if (mode === 'ngo_only' && !isNgoVacancyClient(vacancy)) {
    return { allowed: false, reason: 'Filtered out by OPTION C (NGO JOBS ONLY): Not a verified NGO/UN/diplomatic vacancy.' };
  }
  if (mode === 'banking_and_ngo_only' && !isBankingVacancyClient(vacancy) && !isNgoVacancyClient(vacancy)) {
    return {
      allowed: false,
      reason: 'Filtered out by OPTION D (BANKING AND NGO JOBS ONLY): Excluded because vacancy is neither Banking nor NGO/INGO.',
    };
  }

  return { allowed: true };
}

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

export function buildTelegramJobHtml(
  vacancy: any,
  customDomainOrUrl = 'hopelandjobs.tech',
  _channelUsername = '@DreamBigJobsEthiopia'
): string {
  const baseUrl = normalizeWebsiteDomain(customDomainOrUrl);
  const vacancyLink = `${baseUrl}/?jobId=${encodeURIComponent(vacancy.id)}&utm_source=telegram&utm_medium=channel&utm_campaign=vacancy`;

  const orgName = escapeHtml(vacancy.organization || 'Employer');
  const orgAmharic = vacancy.organizationAmharic ? ` (${escapeHtml(vacancy.organizationAmharic)})` : '';
  const positionTitle = escapeHtml(vacancy.title || 'Various Positions');

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
  const washPrefix = isWashNgoVacancyClient(vacancy) ? '🟢 <b>WASH OPPORTUNITY</b>\n\n' : '';

  return `${washPrefix}<b>Vacancy at ${orgName}</b>

🔰 <b>${orgName}${orgAmharic}</b> invites qualified applicants for the <b>${positionTitle}</b> position.

✅ <b>Education field:</b> ${educationFieldText}

📌 <b>ስለ ስራው ሙሉ መረጃ ለማየት ይህንን ሊንክ ይጠቀሙ</b>
👉<b>Read Detail:-</b> <a href="${vacancyLink}">${vacancyLink}</a>

🔰 <b>ከተለያዩ ድርጅት የሥራ ማስታወቂያዎች በዚህ ሊንክ ዌብሳይቱ ላይ ይመልከቱ 👇👇</b>
=&gt;<b>See Detail:-</b> <a href="${baseUrl}">${baseUrl}</a>`;
}

export function buildTelegramJobPlainText(
  vacancy: any,
  customDomainOrUrl = 'hopelandjobs.tech',
  _channelUsername = '@DreamBigJobsEthiopia'
): string {
  const baseUrl = normalizeWebsiteDomain(customDomainOrUrl);
  const vacancyLink = `${baseUrl}/?jobId=${encodeURIComponent(vacancy.id)}&utm_source=telegram&utm_medium=channel&utm_campaign=vacancy`;

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
  const washPrefix = isWashNgoVacancyClient(vacancy) ? '🟢 WASH OPPORTUNITY\n\n' : '';

  return `${washPrefix}Vacancy at ${orgName}

🔰 ${orgName}${orgAmharic} invites qualified applicants for the ${positionTitle} position.

✅ Education field: ${educationFieldText}

📌 ስለ ስራው ሙሉ መረጃ ለማየት ይህንን ሊንክ ይጠቀሙ
👉Read Detail:- ${vacancyLink}

🔰 ከተለያዩ ድርጅት የሥራ ማስታወቂያዎች በዚህ ሊንክ ዌብሳይቱ ላይ ይመልከቱ 👇👇
=>See Detail:- ${baseUrl}`;
}

/**
 * Automatic WASH Classification & Gate C Pre-Publish Validator:
 * Ensures verified WASH NGO vacancies always display 🟢 WASH OPPORTUNITY near top BEFORE job title,
 * and non-WASH NGO vacancies never carry the marker.
 */
export function applyAndValidateWashLabelClient(
  vacancy: Partial<Vacancy>,
  htmlMsg: string,
  plainMsg: string
): {
  valid: boolean;
  isWashNgo: boolean;
  hasWashLabel: boolean;
  html: string;
  plainText: string;
  reason?: string;
} {
  const isWash = isWashNgoVacancyClient(vacancy);
  let nextHtml = htmlMsg;
  let nextPlain = plainMsg;

  if (isWash) {
    if (!nextHtml.includes('🟢') || !nextHtml.includes('WASH OPPORTUNITY')) {
      nextHtml = `🟢 <b>WASH OPPORTUNITY</b>\n\n${nextHtml}`;
    }
    if (!nextPlain.includes('🟢 WASH OPPORTUNITY')) {
      nextPlain = `🟢 WASH OPPORTUNITY\n\n${nextPlain}`;
    }
    const labelPos = nextPlain.indexOf('🟢 WASH OPPORTUNITY');
    const titlePos = vacancy.title ? nextPlain.indexOf(vacancy.title) : nextPlain.indexOf('Vacancy at');
    if (labelPos < 0 || (titlePos >= 0 && labelPos > titlePos)) {
      return {
        valid: false,
        isWashNgo: true,
        hasWashLabel: false,
        html: nextHtml,
        plainText: nextPlain,
        reason: 'Blocked by Pre-Publish WASH Gate: Missing 🟢 WASH OPPORTUNITY marker before job title.',
      };
    }
    return {
      valid: true,
      isWashNgo: true,
      hasWashLabel: true,
      html: nextHtml,
      plainText: nextPlain,
    };
  }

  return {
    valid: true,
    isWashNgo: false,
    hasWashLabel: nextPlain.includes('🟢 WASH OPPORTUNITY'),
    html: nextHtml,
    plainText: nextPlain,
  };
}

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

export async function verifyTelegramBotToken(rawToken: string): Promise<{
  success: boolean;
  bot?: { id: number; first_name: string; username: string };
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

  try {
    const res = await fetch('/api/telegram/configure-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: clean }),
    });

    const text = await res.text();
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
      } catch {}
    }
  } catch {}

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

export async function checkTelegramConnectionStatus(savedToken?: string): Promise<{
  configured: boolean;
  connected: boolean;
  bot?: { id: number; first_name: string; username: string };
  maskedToken?: string;
  error?: string;
  directMode?: boolean;
}> {
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

export async function testTelegramPing(token?: string): Promise<{
  success: boolean;
  latencyMs: number;
  bot?: { id: number; first_name: string; username: string };
  error?: string;
}> {
  const start = Date.now();

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

export async function broadcastJobToTelegram(
  vacancy: Vacancy,
  channelName: string,
  botToken?: string,
  forceRetry = false,
  customDomain?: string,
  settingsOverride?: Partial<SiteSettings>,
  contentType: 'vacancy' | 'international_job' | 'immigration' | 'scholarship' = 'vacancy'
): Promise<{
  success: boolean;
  telegramMessageId?: number;
  telegramPublishedAt?: string;
  error?: string;
  alreadyPublished?: boolean;
  blockedByRule?: boolean;
}> {
  const cleanChan = channelName.trim().startsWith('@')
    ? channelName.trim()
    : `@${channelName.trim()}`;

  let storedSettings: Partial<SiteSettings> = settingsOverride || {};
  let effectiveDomain = customDomain;
  try {
    const saved = localStorage.getItem('dreambigjobs_site_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      storedSettings = { ...parsed, ...storedSettings };
      if (!effectiveDomain && parsed.customDomain && parsed.customDomain !== 'healmorin.com') {
        effectiveDomain = parsed.customDomain;
      }
    }
  } catch {}

  if (!effectiveDomain && typeof window !== 'undefined' && window.location.hostname && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('run.app')) {
    effectiveDomain = window.location.hostname;
  }
  if (!effectiveDomain || effectiveDomain === 'healmorin.com') effectiveDomain = 'hopelandjobs.tech';

  const distributionMode: TelegramDistributionMode = storedSettings.telegramDistributionMode || 'all_jobs';

  // Local client pre-publish guard matching server gatekeeper
  const gateCheck = evaluateVacancyForTelegramClient(vacancy, storedSettings, forceRetry, contentType);
  if (!gateCheck.allowed) {
    return {
      success: false,
      blockedByRule: true,
      error: gateCheck.reason || 'Blocked by Telegram publishing rules.',
    };
  }

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
        distributionMode,
        contentType,
        includeImmigration: Boolean(storedSettings.telegramIncludeInternationalImmigration),
        includeScholarships: Boolean(storedSettings.telegramIncludeScholarships),
      }),
    });

    const text = await res.text();
    if (!text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      try {
        const data = JSON.parse(text);
        if (res.ok || data.blockedByRule || data.alreadyPublished) {
          return data;
        }
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

  const rawHtmlMsg = buildTelegramJobHtml(vacancy, effectiveDomain, cleanChan);
  const rawPlainMsg = buildTelegramJobPlainText(vacancy, effectiveDomain, cleanChan);
  const washValidation = applyAndValidateWashLabelClient(vacancy, rawHtmlMsg, rawPlainMsg);
  if (!washValidation.valid) {
    return {
      success: false,
      blockedByRule: true,
      error: washValidation.reason || 'Blocked by pre-publish WASH classification check.',
    };
  }
  const htmlMsg = washValidation.html;
  const plainMsg = washValidation.plainText;

  try {
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
