import {
  SiteSettings,
  TelegramDistributionMode,
  TelegramPublishLogEntry,
  TelegramQueueState,
  TelegramVerificationStatusCode,
  Vacancy,
} from '../types/job';
import {
  extractDirectEmployerChannels,
  parseValidDeadline,
  validateTelegramPostContentStrict,
  validateVacancyStrict,
} from './vacancyValidator';
import { encodeTelegramVacancySnapshot } from './telegramSnapshot';

/**
 * Determine whether a vacancy is genuinely a Banking / Financial Institution job.
 */
export function isBankingVacancyClient(v: Partial<Vacancy>): boolean {
  const cat = String(v.category || '').toLowerCase();
  const title = String(v.title || '').toLowerCase();
  const org = String(v.organization || '').toLowerCase();
  const desc = String(v.description || '').toLowerCase();
  const ngoExplicit = cat.includes('ngo') || cat.includes('embassies') || cat.includes('diplomatic');
  if (ngoExplicit) return false;
  if (cat.includes('banking') || cat.includes('microfinance') || cat.includes('insurance')) {
    return true;
  }
  if (/\b(bank|microfinance|savings and credit|cooperative bank|national bank|development bank)\b/i.test(org)) {
    return true;
  }
  if (/\b(branch manager|banker|teller|loan officer|credit analyst|treasury|kyc|aml|core banking|banking operations)\b/i.test(title)) {
    return true;
  }
  if (/\bcommercial bank|dashen bank|awash bank|bank of abyssinia|wegagen bank|hibret bank|nib bank|oromia bank|tsedey bank|zemen bank|berhan bank|enat bank|bunna bank|siinqee bank|amhara bank\b/i.test(`${org} ${desc}`)) {
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
  if (/\b(unicef|undp|unhcr|wfp|who|fao|ilo|unesco|usaid|giz|msf|médecins sans frontières|save the children|world vision|care international|oxfam|plan international|nrc|irc|international rescue committee|mercy corps|icrc|red cross|pathfinder|fhi 360|crs|catholic relief|action against hunger|danish refugee|norwegian refugee|goal ethiopia|tearfund|sos children|amref|jhpiego|psi|engenderhealth|pact|rti|chemonics|helvetas|snv|lutheran world)\b/i.test(org)) {
    return true;
  }
  if (/\b(ngo|ingo|international organization|non-governmental|humanitarian|donor funded|embassy|diplomatic mission)\b/i.test(`${org} ${title}`)) {
    return true;
  }
  return false;
}

/**
 * Classify a vacancy into one of System 1's 3 broad sectors: Banking, NGO, or Other.
 */
export function classifyVacancyBroadSectorClient(v: Partial<Vacancy>): 'Banking' | 'NGO' | 'Other' {
  if (isNgoVacancyClient(v)) return 'NGO';
  if (isBankingVacancyClient(v)) return 'Banking';
  return 'Other';
}

/**
 * Determine whether a verified NGO/INGO vacancy is genuinely related to WASH
 * (Water, Sanitation and Hygiene) by inspecting title, responsibilities, and description.
 * Never classifies non-WASH NGO positions (e.g., Accountant, Child Protection) as WASH.
 */
export function isWashNgoVacancyClient(v: Partial<Vacancy>): boolean {
  if (!isNgoVacancyClient(v)) return false;
  const responsibilitiesText = Array.isArray(v.responsibilities) ? v.responsibilities.join(' ') : String(v.responsibilities || '');
  const skillsText = Array.isArray(v.requiredSkills) ? v.requiredSkills.join(' ') : String(v.requiredSkills || '');
  const combined = `${v.title || ''} ${v.description || ''} ${responsibilitiesText} ${v.requiredFieldOfStudy || ''} ${skillsText} ${v.specialRequirements || ''}`;
  return /\b(wash|water,?\s*sanitation\s*(?:and|&)\s*hygiene|water\s+and\s+sanitation|sanitation\s+and\s+water\s+supply|hygiene\s+promotion|sanitation\s+and\s+hygiene|wash\s+officer|wash\s+coordinator|wash\s+manager|wash\s+project\s+manager|wash\s+engineer(?:ing)?|emergency\s+wash|humanitarian\s+wash|community\s+water\s+and\s+sanitation|latrine\s+construction|borehole\s+rehabilitation|water\s+supply\s+scheme|water\s+quality\s+monitoring)\b/i.test(
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
  const parsed = parseValidDeadline(deadline);
  if (!parsed.hasValidDeadline) return false;
  return parsed.isExpired;
}

export function hasOfficialApplicationMethodClient(v: Partial<Vacancy>): boolean {
  return extractDirectEmployerChannels(v).valid;
}

/**
 * Enforces Telegram 4-option distribution setting + strict 6-field quality/deadline/content separation checks.
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
  if (!forceRetry && vacancy.telegramPublished) {
    return { allowed: false, reason: 'Blocked: Already published to Telegram (duplicate protection).' };
  }
  if (vacancy.status === 'expired' || vacancy.status === 'archived' || vacancy.status === 'draft' || vacancy.status === 'duplicate') {
    return { allowed: false, reason: `Blocked: Vacancy status is "${vacancy.status}". Only open published vacancies can be posted to Telegram.` };
  }

  // STRICT MANDATORY GATE: Deadline + Employer Name + Position + Requirements + Method to Apply + Direct Link/Email/Physical Address
  const strictCheck = validateVacancyStrict(vacancy, { allowExpired: false });
  if (!strictCheck.valid) {
    return {
      allowed: false,
      reason: `Blocked: Incomplete vacancy cannot be posted to Telegram. Missing: ${strictCheck.missingFields.join(', ')}.`,
    };
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

export interface NormalizedTelegramChat {
  chatId: string;
  isNumeric: boolean;
  isInviteLink: boolean;
  slug?: string;
  error?: string;
}

/**
 * Canonical Telegram chat_id normalizer:
 * - Preserves numeric channel/group IDs (e.g. "-1001234567890") WITHOUT prepending "@"
 * - Heals accidentally mangled "@-1001234567890" -> "-1001234567890"
 * - Converts private post links ("https://t.me/c/1234567890/45") -> "-1001234567890"
 * - Extracts "@username" from full URLs ("https://t.me/HopeLandJobs" or "t.me/HopeLandJobs/12")
 * - Flags private invite links ("t.me/+...") with an actionable error instead of corrupting into "@https://..."
 */
export function normalizeTelegramChatId(input?: string): NormalizedTelegramChat {
  const raw = (input || '').trim();
  if (!raw) {
    return {
      chatId: '@DreamBigJobsEthiopia',
      isNumeric: false,
      isInviteLink: false,
      slug: 'DreamBigJobsEthiopia',
    };
  }

  // Numeric channel/group/chat ID (with or without accidental leading @)
  const numericCandidate = raw.replace(/^@/, '').trim();
  if (/^-?\d+$/.test(numericCandidate)) {
    return {
      chatId: numericCandidate,
      isNumeric: true,
      isInviteLink: false,
    };
  }

  // URL forms (including accidentally prefixed "@https://t.me/...")
  const urlCandidate = raw.replace(/^@/, '').trim();
  const inviteMatch = urlCandidate.match(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(?:\+|joinchat\/)([A-Za-z0-9_-]+)/i);
  if (inviteMatch) {
    return {
      chatId: raw,
      isNumeric: false,
      isInviteLink: true,
      error:
        'Private Telegram invite links (t.me/+...) cannot be used as a bot chat_id. Paste a private post link (https://t.me/c/<id>/<msg>), enter the numeric -100... Channel ID, or verify a public @username.',
    };
  }

  // Private supergroup/channel message link: https://t.me/c/1234567890/45 -> -1001234567890
  const privatePostMatch = urlCandidate.match(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/c\/(\d+)(?:\/\d+)?(?:[/?#].*)?$/i);
  if (privatePostMatch) {
    return {
      chatId: `-100${privatePostMatch[1]}`,
      isNumeric: true,
      isInviteLink: false,
    };
  }

  const publicUrlMatch = urlCandidate.match(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{3,})(?:[/?#].*)?$/i);
  if (publicUrlMatch) {
    const slug = publicUrlMatch[1];
    return {
      chatId: `@${slug}`,
      isNumeric: false,
      isInviteLink: false,
      slug,
    };
  }

  const bare = urlCandidate.replace(/\/+$/, '').trim();
  return {
    chatId: `@${bare}`,
    isNumeric: false,
    isInviteLink: false,
    slug: bare,
  };
}

export function isFatalTelegramConfigError(errorMsg?: string): boolean {
  const msg = String(errorMsg || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('chat not found') ||
    msg.includes('unauthorized') ||
    msg.includes('bot was kicked') ||
    msg.includes('bot is not a member') ||
    msg.includes('need administrator rights') ||
    msg.includes('not enough rights') ||
    msg.includes('bot token is not configured') ||
    msg.includes('private telegram invite links')
  );
}

export interface DiscoveredTelegramChat {
  id: string;
  title: string;
  username?: string;
  type: string;
  botStatus?: string;
}

export interface ChannelVerificationResult {
  ok: boolean;
  statusCode?: TelegramVerificationStatusCode;
  statusLabel?: string;
  chatExists?: boolean;
  normalizedChannel?: string;
  isAdmin?: boolean;
  canPost?: boolean;
  webhookActive?: boolean;
  chat?: {
    id: number | string;
    title: string;
    username?: string;
    type: string;
  };
  bot?: {
    id: number;
    first_name: string;
    username: string;
  };
  discoveredChats?: DiscoveredTelegramChat[];
  error?: string;
  diagnosis?: string;
  unreachableServer?: boolean;
}

export interface ServerQueueStatusResponse {
  success: boolean;
  queueState: TelegramQueueState;
  summary: {
    total: number;
    pending: number;
    processing: number;
    retrying: number;
    published: number;
    failed: number;
    progressPercent: number;
  };
  lastSuccessfulPublication?: string;
  totalPublishedAllTime: number;
  totalFailedLogs: number;
  publishedRecords?: Record<
    string,
    {
      vacancyId: string;
      telegramMessageId: number;
      publishedAt: string;
      channel: string;
      title: string;
    }
  >;
  logs: TelegramPublishLogEntry[];
  requeuedCount?: number;
  message?: string;
  error?: string;
}

export async function verifyTelegramConnectionClient(channelName?: string): Promise<ChannelVerificationResult> {
  const normalized = normalizeTelegramChatId(channelName);
  if (normalized.isInviteLink) {
    return {
      ok: false,
      statusCode: 'channel_not_found',
      statusLabel: 'Channel not found',
      chatExists: false,
      normalizedChannel: normalized.chatId,
      error: normalized.error,
    };
  }

  try {
    const res = await fetch('/api/telegram/verify-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName: normalized.chatId }),
    });
    const text = await res.text();
    if (!text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      return JSON.parse(text) as ChannelVerificationResult;
    }
  } catch (err: any) {
    return {
      ok: false,
      statusCode: 'api_connection_failed',
      statusLabel: 'Telegram API connection failed',
      unreachableServer: true,
      normalizedChannel: normalized.chatId,
      error: `Could not reach verification endpoint: ${err?.message || String(err)}`,
    };
  }

  return {
    ok: false,
    statusCode: 'api_connection_failed',
    statusLabel: 'Telegram API connection failed',
    unreachableServer: true,
    normalizedChannel: normalized.chatId,
    error: 'Could not reach server channel verification endpoint.',
  };
}

export async function verifyTelegramChannelClient(channelName?: string): Promise<ChannelVerificationResult> {
  return verifyTelegramConnectionClient(channelName);
}

export async function sendTelegramTestMessageClient(channelName?: string): Promise<{
  success: boolean;
  statusCode?: TelegramVerificationStatusCode;
  statusLabel?: string;
  telegramMessageId?: number;
  resolvedChatId?: string;
  normalizedChannel?: string;
  timestamp?: string;
  message?: string;
  error?: string;
  diagnosis?: string;
  discoveredChats?: DiscoveredTelegramChat[];
}> {
  const normalized = normalizeTelegramChatId(channelName);
  if (normalized.isInviteLink) {
    return {
      success: false,
      statusCode: 'channel_not_found',
      statusLabel: 'Channel not found',
      error: normalized.error,
    };
  }

  try {
    const res = await fetch('/api/telegram/send-test-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName: normalized.chatId }),
    });
    const text = await res.text();
    if (!text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      return JSON.parse(text);
    }
  } catch (err: any) {
    return {
      success: false,
      statusCode: 'api_connection_failed',
      statusLabel: 'Telegram API connection failed',
      error: err?.message || 'Could not reach test message endpoint.',
    };
  }
  return {
    success: false,
    statusCode: 'api_connection_failed',
    statusLabel: 'Telegram API connection failed',
    error: 'Server returned invalid response.',
  };
}

export async function fetchTelegramQueueStatusClient(): Promise<ServerQueueStatusResponse | null> {
  try {
    const res = await fetch('/api/telegram/queue/status');
    if (res.ok) {
      return (await res.json()) as ServerQueueStatusResponse;
    }
  } catch {}
  return null;
}

export async function fetchTelegramLogsClient(): Promise<TelegramPublishLogEntry[]> {
  try {
    const res = await fetch('/api/telegram/logs');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.logs)) return data.logs;
    }
  } catch {}
  return [];
}

export async function startServerTelegramQueueClient(params: {
  vacancies: Vacancy[];
  channelName?: string;
  distributionMode?: TelegramDistributionMode;
  forceRetry?: boolean;
}): Promise<ServerQueueStatusResponse> {
  const res = await fetch('/api/telegram/queue/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vacancies: params.vacancies,
      channelName: params.channelName ? normalizeTelegramChatId(params.channelName).chatId : undefined,
      distributionMode: params.distributionMode || 'all_jobs',
      forceRetry: Boolean(params.forceRetry),
    }),
  });
  return (await res.json()) as ServerQueueStatusResponse;
}

export async function retryFailedServerQueueClient(vacancyIds?: string[]): Promise<ServerQueueStatusResponse> {
  const res = await fetch('/api/telegram/queue/retry-failed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vacancyIds }),
  });
  return (await res.json()) as ServerQueueStatusResponse;
}

export async function cancelServerTelegramQueueClient(): Promise<ServerQueueStatusResponse> {
  const res = await fetch('/api/telegram/queue/cancel', { method: 'POST' });
  return (await res.json()) as ServerQueueStatusResponse;
}

export async function discoverTelegramChatsClient(): Promise<{
  ok: boolean;
  chats: DiscoveredTelegramChat[];
  bot?: { id: number; first_name: string; username: string };
  webhookActive?: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/telegram/discover-chats');
    const text = await res.text();
    if (!text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      try {
        return JSON.parse(text);
      } catch {}
    }
  } catch {}
  return { ok: false, chats: [], error: 'Failed to query discovered chats.' };
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

function truncateTextClient(val: string | null | undefined, maxLen: number): string {
  const s = String(val || '').trim();
  if (!s) return '';
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

function isMeaningfulClientField(val?: string | null): boolean {
  const s = String(val || '').trim();
  if (!s || s === '-' || s === '—') return false;
  return !/^(?:not specified(?:\s+in\s+the\s+original\s+vacancy)?|not stated|not mentioned|not available|not disclosed|unknown|tbd|n\/a|none)$/i.test(s);
}

/**
 * Normalizes user-configured domain or URL into a clean base URL (default: hopelandjobs.tech)
 */
export function normalizeWebsiteDomain(domainOrUrl?: string): string {
  const raw = (domainOrUrl || '').trim();
  if (!raw) {
    return 'https://www.hopelandjobs.tech';
  }
  const cleanHost = raw
    .replace(/^https?:\/\//i, '')
    .split(/[/?#]/)[0]
    .trim()
    .toLowerCase();
  if (
    !cleanHost ||
    cleanHost === 'healmorin.com' ||
    cleanHost === 'www.healmorin.com' ||
    cleanHost === 'hopelandjobs.tech' ||
    cleanHost === 'www.hopelandjobs.tech' ||
    cleanHost.startsWith('localhost') ||
    cleanHost.startsWith('127.0.0.1') ||
    cleanHost.includes('ais-dev-') ||
    cleanHost.includes('ais-pre-') ||
    cleanHost.endsWith('.run.app') ||
    cleanHost.endsWith('.usercontent.goog')
  ) {
    return 'https://www.hopelandjobs.tech';
  }
  return `https://${cleanHost}`;
}

export function buildTelegramVacancyUrl(
  baseUrl: string,
  vacancy: any,
  includeApplyAction = true
): string {
  const cleanBase = normalizeWebsiteDomain(baseUrl).replace(/\/+$/, '');
  const rawId = String(vacancy?.id || '').trim();
  const safeId = encodeURIComponent(rawId || 'latest');
  const applyParam = includeApplyAction ? 'apply=1&' : '';
  const baseLink = `${cleanBase}/jobs/${safeId}?jobId=${safeId}&${applyParam}utm_source=telegram&utm_medium=channel&utm_campaign=vacancy`;
  const remainingBudget = Math.max(0, 1850 - baseLink.length - 3);
  if (remainingBudget >= 280) {
    const encodedSnap = encodeTelegramVacancySnapshot(vacancy, Math.min(1450, remainingBudget));
    if (encodedSnap) {
      return `${baseLink}&v=${encodedSnap}`;
    }
  }
  return baseLink;
}

function stripUrlsAndEmailsClient(text: string): string {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bwww\.[^\s]+/gi, '')
    .replace(/\bt\.me\/\S+/gi, '')
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '')
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|et|tech|io|co|gov|edu|info)(?:\/\S*)?/gi, '')
    .replace(/(?:\+251[\s-]?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4}|\b0[19]\d[\s-]?\d{3}[\s-]?\d{4}\b)/g, '')
    .replace(/\b(?:how\s+to\s+apply\s*:|application\s+method\s*:|method\s+to\s+apply\s*:|apply\s+via\s*:|send\s+(?:your\s+)?cv\s+to|submit\s+in\s+person|p\.?\s*o\.?\s*box\s*\d+)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatDeadlineForTelegramClient(rawDeadline?: string | null): string {
  const clean = stripUrlsAndEmailsClient(rawDeadline || '');
  if (!clean || !isMeaningfulClientField(clean)) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parsed = new Date(clean);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  return truncateTextClient(clean, 80);
}

export function buildTelegramJobHtml(
  vacancy: any,
  _customDomainOrUrl = 'www.hopelandjobs.tech',
  _channelUsername = '@DreamBigJobsEthiopia'
): string {
  const cleanOrg = stripUrlsAndEmailsClient(vacancy?.organization || '') || 'Employer';
  const cleanTitle = stripUrlsAndEmailsClient(vacancy?.title || '') || 'Open Position';
  const cleanSalary = isMeaningfulClientField(vacancy?.salary)
    ? stripUrlsAndEmailsClient(vacancy.salary)
    : '';
  const cleanCity = isMeaningfulClientField(vacancy?.location)
    ? stripUrlsAndEmailsClient(vacancy.location)
    : '';
  const cleanDeadline = formatDeadlineForTelegramClient(vacancy?.applicationDeadline);

  const orgName = escapeHtml(truncateTextClient(cleanOrg, 140));
  const positionTitle = escapeHtml(truncateTextClient(cleanTitle, 180));
  const washPrefix = isWashNgoVacancyClient(vacancy) ? '🟢⭐ <b>WASH JOB</b>\n\n' : '';

  const lines: string[] = [
    `🏢 <b>Employer:</b> ${orgName}`,
    `💼 <b>Position:</b> ${positionTitle}`,
  ];

  if (cleanSalary) {
    lines.push(`💰 <b>Salary:</b> ${escapeHtml(truncateTextClient(cleanSalary, 100))}`);
  }
  if (cleanCity) {
    lines.push(`📍 <b>City of Work:</b> ${escapeHtml(truncateTextClient(cleanCity, 100))}`);
  }
  if (cleanDeadline) {
    lines.push(`📅 <b>Deadline:</b> ${escapeHtml(cleanDeadline)}`);
  }

  return `${washPrefix}${lines.join('\n')}\n\nFull vacancy details are inside our website. Tap <b>Apply Now</b> below.`;
}

export function buildTelegramJobPlainText(
  vacancy: any,
  _customDomainOrUrl = 'www.hopelandjobs.tech',
  _channelUsername = '@DreamBigJobsEthiopia'
): string {
  const cleanOrg = stripUrlsAndEmailsClient(vacancy?.organization || '') || 'Employer';
  const cleanTitle = stripUrlsAndEmailsClient(vacancy?.title || '') || 'Open Position';
  const cleanSalary = isMeaningfulClientField(vacancy?.salary)
    ? stripUrlsAndEmailsClient(vacancy.salary)
    : '';
  const cleanCity = isMeaningfulClientField(vacancy?.location)
    ? stripUrlsAndEmailsClient(vacancy.location)
    : '';
  const cleanDeadline = formatDeadlineForTelegramClient(vacancy?.applicationDeadline);

  const orgName = truncateTextClient(cleanOrg, 140);
  const positionTitle = truncateTextClient(cleanTitle, 180);
  const washPrefix = isWashNgoVacancyClient(vacancy) ? '🟢⭐ WASH JOB\n\n' : '';

  const lines: string[] = [
    `Employer: ${orgName}`,
    `Position: ${positionTitle}`,
  ];

  if (cleanSalary) {
    lines.push(`Salary: ${truncateTextClient(cleanSalary, 100)}`);
  }
  if (cleanCity) {
    lines.push(`City of Work: ${truncateTextClient(cleanCity, 100)}`);
  }
  if (cleanDeadline) {
    lines.push(`Deadline: ${cleanDeadline}`);
  }

  return `${washPrefix}${lines.join('\n')}\n\nFull vacancy details are inside our website. Tap Apply Now below.`;
}

/**
 * Automatic WASH Classification & Pre-Publish Validator:
 * Ensures verified WASH NGO vacancies always display 🟢⭐ WASH JOB at the beginning BEFORE the job title,
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
    if (!nextHtml.includes('🟢⭐') || !nextHtml.includes('WASH JOB')) {
      nextHtml = `🟢⭐ <b>WASH JOB</b>\n\n${nextHtml.replace(/^🟢(?:\s*⭐)?\s*(?:<b>)?WASH[^<\n]*(?:<\/b>)?\s*/i, '')}`;
    }
    if (!nextPlain.includes('🟢⭐ WASH JOB')) {
      nextPlain = `🟢⭐ WASH JOB\n\n${nextPlain.replace(/^🟢(?:\s*⭐)?\s*WASH[^\n]*\s*/i, '')}`;
    }
    const labelPos = nextPlain.indexOf('🟢⭐ WASH JOB');
    const titlePos = vacancy.title ? nextPlain.indexOf(vacancy.title) : nextPlain.indexOf('Vacancy at');
    if (labelPos < 0 || (titlePos >= 0 && labelPos > titlePos)) {
      return {
        valid: false,
        isWashNgo: true,
        hasWashLabel: false,
        html: nextHtml,
        plainText: nextPlain,
        reason: 'Blocked by Pre-Publish WASH Gate: Missing 🟢⭐ WASH JOB marker before job title.',
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
    hasWashLabel: nextPlain.includes('🟢⭐ WASH JOB'),
    html: nextHtml,
    plainText: nextPlain,
  };
}

/**
 * Server-only token configuration & verification (never persists raw token in browser storage).
 */
export async function verifyTelegramBotToken(rawToken: string): Promise<{
  success: boolean;
  bot?: { id: number; first_name: string; username: string };
  maskedToken?: string;
  error?: string;
}> {
  const clean = cleanTelegramToken(rawToken);

  if (!isValidTelegramTokenFormat(clean)) {
    return {
      success: false,
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
    if (!text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      const data = JSON.parse(text);
      if (res.ok && data.success && data.bot) {
        return {
          success: true,
          bot: data.bot,
          maskedToken: data.maskedToken || maskTelegramToken(clean),
        };
      }
      return {
        success: false,
        error: data.error || 'Telegram rejected the provided Bot Token.',
      };
    }
    return { success: false, error: 'Invalid response from server token configuration endpoint.' };
  } catch (err: any) {
    return {
      success: false,
      error: `Could not reach server Telegram endpoint: ${err?.message || String(err)}`,
    };
  }
}

export async function checkTelegramConnectionStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  bot?: { id: number; first_name: string; username: string };
  maskedToken?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/telegram/status');
    const text = await res.text();
    if (res.ok && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      return JSON.parse(text);
    }
  } catch (err: any) {
    return {
      configured: false,
      connected: false,
      error: `Connection error: ${err?.message || String(err)}`,
    };
  }

  return {
    configured: false,
    connected: false,
    error: 'TELEGRAM_BOT_TOKEN is not configured on the server.',
  };
}

export async function testTelegramPing(): Promise<{
  success: boolean;
  latencyMs: number;
  bot?: { id: number; first_name: string; username: string };
  error?: string;
}> {
  const start = Date.now();
  try {
    const res = await fetch('/api/telegram/test-connection', { method: 'POST' });
    const text = await res.text();
    if (!text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      return JSON.parse(text);
    }
    return { success: false, latencyMs: Date.now() - start, error: 'Invalid server response.' };
  } catch (err: any) {
    return { success: false, latencyMs: Date.now() - start, error: err?.message || String(err) };
  }
}

export async function broadcastJobToTelegram(
  vacancy: Vacancy,
  channelName: string,
  forceRetry = false,
  customDomain?: string,
  settingsOverride?: Partial<SiteSettings>,
  contentType: 'vacancy' | 'international_job' | 'immigration' | 'scholarship' = 'vacancy',
  action: 'auto_publish' | 'manual_publish' | 'retry' = 'manual_publish'
): Promise<{
  success: boolean;
  telegramMessageId?: number;
  telegramPublishedAt?: string;
  error?: string;
  alreadyPublished?: boolean;
  blockedByRule?: boolean;
  resolvedChatId?: string;
  usedPhoto?: boolean;
  discoveredChats?: DiscoveredTelegramChat[];
}> {
  const normalizedTarget = normalizeTelegramChatId(channelName);
  if (normalizedTarget.isInviteLink) {
    return {
      success: false,
      error: normalizedTarget.error,
    };
  }
  const cleanChan = normalizedTarget.chatId;

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

  const gateCheck = evaluateVacancyForTelegramClient(vacancy, storedSettings, forceRetry, contentType);
  if (!gateCheck.allowed) {
    return {
      success: false,
      blockedByRule: true,
      error: gateCheck.reason || 'Blocked by Telegram publishing rules.',
    };
  }

  const contentAudit = validateTelegramPostContentStrict(
    buildTelegramJobPlainText(vacancy, effectiveDomain, cleanChan)
  );
  if (!contentAudit.safe) {
    return {
      success: false,
      blockedByRule: true,
      error: `Blocked by Strict Telegram Policy: ${contentAudit.violations.join(' ')}`,
    };
  }

  try {
    const res = await fetch('/api/admin/telegram-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vacancy,
        channelName: cleanChan,
        channelId: storedSettings.telegramChannelId,
        forceRetry,
        customDomain: effectiveDomain,
        distributionMode,
        contentType,
        action: forceRetry ? 'retry' : action,
        includeImmigration: Boolean(storedSettings.telegramIncludeInternationalImmigration),
        includeScholarships: Boolean(storedSettings.telegramIncludeScholarships),
      }),
    });

    const text = await res.text();
    if (!text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
      return JSON.parse(text);
    }
    return {
      success: false,
      error: 'Telegram publishing server returned an unexpected non-JSON response.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to reach server Telegram publisher: ${err?.message || String(err)}`,
    };
  }
}
