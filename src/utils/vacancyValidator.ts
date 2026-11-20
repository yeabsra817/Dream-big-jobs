import type { Vacancy } from '../types/job';

export type DirectApplyChannel = 'link' | 'email' | 'physical';

export interface ParsedDeadlineInfo {
  hasValidDeadline: boolean;
  parsedDate: Date | null;
  normalizedText: string;
  isExpired: boolean;
}

export interface DirectChannelCheckResult {
  valid: boolean;
  channels: DirectApplyChannel[];
  directUrl?: string;
  directEmail?: string;
  physicalAddress?: string;
}

export interface VacancyValidationResult {
  valid: boolean;
  hasValidDeadline: boolean;
  isExpired: boolean;
  missingFields: string[];
  reasons: string[];
  channels: DirectApplyChannel[];
}

const PLACEHOLDER_REGEX =
  /^(?:not\s+specified(?:\s+in\s+the\s+(?:accessible\s+)?original\s+vacancy)?|not\s+stated(?:\s+in\s+the\s+(?:accessible\s+)?official\s+announcement)?|not\s+mentioned|not\s+available|not\s+disclosed|not\s+provided|none|nil|n\/?a|tbd|tba|unknown|unspecified|various|untitled(?:\s+vacancy)?|job\s+vacancy|open\s+position|ethiopian\s+organization|company|employer|confidential|open\s+until\s+filled|until\s+filled|ongoing|rolling|asap|as\s+soon\s+as\s+possible|continuous|open|no\s+deadline|-+|—+|\.+)$/i;

const GENERIC_INSTRUCTIONS_BOILERPLATE_REGEX =
  /^(?:submit\s+application(?:\s+by\s+email\s+or\s+in\s+person)?\s+as\s+indicated\s+in\s+(?:the\s+)?vacancy\s+description|please\s+follow\s+employer\s+instructions\s+carefully|apply\s+directly|apply\s+now|see\s+description|refer\s+to\s+(?:the\s+)?(?:vacancy|job)\s+description|interested\s+and\s+qualified\s+applicants\s+should\s+submit\s+their\s+credentials\s+following\s+the\s+official\s+application\s+link\s+or\s+contact\s+details\s+provided\s+above)\.?$/i;

const OWN_SITE_URL_REGEX =
  /(?:hopelandjobs\.tech|dreambigjobs|healmorin\.com|localhost|127\.0\.0\.1|t\.me\/dreambigjobsethiopia)/i;

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function stripEdgePunctuation(val?: string | null): string {
  return String(val || '')
    .trim()
    .replace(/^[\s\-–—:;,.•*]+|[\s\-–—:;,.]+$/g, '')
    .trim();
}

export function isMeaningfulVacancyValue(val?: string | null): boolean {
  const cleaned = stripEdgePunctuation(val);
  if (!cleaned) return false;
  return !PLACEHOLDER_REGEX.test(cleaned);
}

/**
 * Strictly parses a vacancy application deadline into a real calendar Date.
 * Any missing, placeholder, or open-ended string ("Not stated", "Open until filled", "ASAP", etc.)
 * returns hasValidDeadline: false so it is rejected on upload and permanently deleted if already posted.
 */
export function parseValidDeadline(deadline?: string | null): ParsedDeadlineInfo {
  const raw = String(deadline || '').trim();
  const cleaned = stripEdgePunctuation(
    raw
      .replace(/^(?:application\s+)?(?:deadline|closing\s+date|apply\s+before|closes?\s+on|due\s+date)\s*[:\-–—]?\s*/i, '')
      .replace(/(\d{1,2})(?:st|nd|rd|th)\b/gi, '$1')
  );

  if (!cleaned || PLACEHOLDER_REGEX.test(cleaned)) {
    return {
      hasValidDeadline: false,
      parsedDate: null,
      normalizedText: '',
      isExpired: false,
    };
  }

  if (
    /\b(?:not\s+specified|not\s+stated|not\s+mentioned|not\s+available|open\s+until\s+filled|until\s+filled|ongoing|rolling|as\s+soon\s+as\s+possible|asap|tbd|tba|no\s+deadline|continuous)\b/i.test(
      cleaned
    )
  ) {
    return {
      hasValidDeadline: false,
      parsedDate: null,
      normalizedText: '',
      isExpired: false,
    };
  }

  let year = 0;
  let monthIdx = -1;
  let day = 0;

  // 1. YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = cleaned.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    monthIdx = parseInt(isoMatch[2], 10) - 1;
    day = parseInt(isoMatch[3], 10);
  }

  // 2. DD Month YYYY (e.g., "23 November 2026", "5 Dec 2026")
  if (year === 0) {
    const dmyText = cleaned.match(
      /\b(\d{1,2})\s+([A-Za-z]{3,9})[.,]?\s*,?\s*(\d{4})\b/
    );
    if (dmyText) {
      const m = MONTH_NAME_MAP[dmyText[2].toLowerCase()];
      if (m !== undefined) {
        day = parseInt(dmyText[1], 10);
        monthIdx = m;
        year = parseInt(dmyText[3], 10);
      }
    }
  }

  // 3. Month DD, YYYY (e.g., "November 23, 2026", "Nov 23 2026")
  if (year === 0) {
    const mdyText = cleaned.match(
      /\b([A-Za-z]{3,9})[.,]?\s+(\d{1,2})\s*,?\s*(\d{4})\b/
    );
    if (mdyText) {
      const m = MONTH_NAME_MAP[mdyText[1].toLowerCase()];
      if (m !== undefined) {
        monthIdx = m;
        day = parseInt(mdyText[2], 10);
        year = parseInt(mdyText[3], 10);
      }
    }
  }

  // 4. DD/MM/YYYY or DD-MM-YYYY (common in Ethiopia)
  if (year === 0) {
    const dmyNum = cleaned.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
    if (dmyNum) {
      const first = parseInt(dmyNum[1], 10);
      const second = parseInt(dmyNum[2], 10);
      year = parseInt(dmyNum[3], 10);
      if (first > 12 && second <= 12) {
        day = first;
        monthIdx = second - 1;
      } else if (second > 12 && first <= 12) {
        monthIdx = first - 1;
        day = second;
      } else {
        // Default to DD/MM/YYYY for Ethiopian convention
        day = first;
        monthIdx = second - 1;
      }
    }
  }

  let parsedDate: Date | null = null;
  if (year >= 2020 && year <= 2100 && monthIdx >= 0 && monthIdx <= 11 && day >= 1 && day <= 31) {
    const candidate = new Date(year, monthIdx, day, 23, 59, 59, 999);
    if (
      !Number.isNaN(candidate.getTime()) &&
      candidate.getFullYear() === year &&
      candidate.getMonth() === monthIdx &&
      candidate.getDate() === day
    ) {
      parsedDate = candidate;
    }
  } else {
    // Fallback to native Date.parse ONLY if string contains a 4-digit year and a month/separator
    if (/\b20\d{2}\b/.test(cleaned)) {
      const ts = Date.parse(cleaned);
      if (!Number.isNaN(ts)) {
        const d = new Date(ts);
        if (d.getFullYear() >= 2020 && d.getFullYear() <= 2100) {
          d.setHours(23, 59, 59, 999);
          parsedDate = d;
        }
      }
    }
  }

  if (!parsedDate) {
    return {
      hasValidDeadline: false,
      parsedDate: null,
      normalizedText: '',
      isExpired: false,
    };
  }

  const isExpired = Date.now() > parsedDate.getTime();
  return {
    hasValidDeadline: true,
    parsedDate,
    normalizedText: cleaned,
    isExpired,
  };
}

export function hasValidVacancyDeadline(vacancy?: Partial<Vacancy> | null): boolean {
  if (!vacancy) return false;
  return parseValidDeadline(vacancy.applicationDeadline).hasValidDeadline;
}

function isValidExternalApplyUrl(raw?: string | null): string | undefined {
  const s = String(raw || '').trim().replace(/[),.;]+$/, '');
  if (!s || !isMeaningfulVacancyValue(s)) return undefined;
  if (!/^https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?(?:\/\S*)?$/i.test(s)) {
    return undefined;
  }
  if (OWN_SITE_URL_REGEX.test(s)) return undefined;
  return s;
}

function extractExternalUrlFromText(text?: string | null): string | undefined {
  const matches = String(text || '').match(/https?:\/\/[^\s"'<>)\]]+/gi);
  if (!matches) return undefined;
  for (const m of matches) {
    const valid = isValidExternalApplyUrl(m);
    if (valid) return valid;
  }
  return undefined;
}

function extractValidEmail(raw?: string | null): string | undefined {
  const s = String(raw || '').trim();
  if (!s) return undefined;
  const match = s.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (!match) return undefined;
  const email = match[0].toLowerCase();
  // Exclude placeholder/admin emails
  if (/example\.com|test\.com|nexusitsoultion@gmail\.com/i.test(email)) return undefined;
  return match[0];
}

const PHYSICAL_ADDRESS_SIGNAL_REGEX =
  /\b(?:p\.?\s*o\.?\s*box|po\s*box|head\s*office|hr\s*(?:office|department|dept)|human\s*resource(?:s)?\s*(?:office|department)|branch\s*office|district\s*office|regional\s*office|in[\s-]?person|physically|physical\s+address|walk[\s-]?in|floor|room\s*(?:no\.?|#)?\s*\d*|building|bldg|tower|plaza|compound|campus|sub[\s-]?city|woreda|kebele|street|road|avenue|bole|kazanchis|piassa|mexico|sarbet|megenagna|gerji|kotebe|akaki|kality|kirkos|arada|yeka|lemi\s*kura|gullele|lideta|kolfe|nifas\s*silk|airport|hospital|university|college|ministry|bureau|office\s+no)\b/i;

function isBareGenericCityOnly(val: string): boolean {
  const cleaned = stripEdgePunctuation(val).toLowerCase();
  return /^(?:addis\s+ababa(?:\s*,\s*ethiopia)?|ethiopia|hawassa|adama|dire\s+dawa|bahir\s+dar|mekelle|jimma|gondar|bishoftu|dessie|jigjiga|harar|arba\s+minch|shashemene|remote(?:\s*\/\s*ethiopia)?|various|multiple\s+locations)$/.test(
    cleaned
  );
}

/**
 * Verifies that the vacancy includes at least one direct employer application channel:
 * 1. Direct Employer Link (applicationUrl or URL in instructions/contact)
 * 2. Direct Employer Email (applicationEmail or email in instructions/contact)
 * 3. Direct Employer Physical / Postal Submission Address (physicalAddress, or real office/P.O. Box address in instructions/contact)
 */
export function extractDirectEmployerChannels(
  vacancy?: Partial<Vacancy> | null
): DirectChannelCheckResult {
  if (!vacancy) return { valid: false, channels: [] };

  const channels: DirectApplyChannel[] = [];

  const directUrl =
    isValidExternalApplyUrl(vacancy.applicationUrl) ||
    isValidExternalApplyUrl((vacancy as any).directApplicationUrl) ||
    extractExternalUrlFromText(vacancy.applicationInstructions) ||
    extractExternalUrlFromText(vacancy.contactInfo);

  if (directUrl) {
    channels.push('link');
  }

  const directEmail =
    extractValidEmail(vacancy.applicationEmail) ||
    extractValidEmail(vacancy.applicationInstructions) ||
    extractValidEmail(vacancy.contactInfo);

  if (directEmail) {
    channels.push('email');
  }

  let physicalAddress: string | undefined;
  const explicitPhysical = stripEdgePunctuation(vacancy.physicalAddress);
  if (
    explicitPhysical &&
    explicitPhysical.length >= 6 &&
    isMeaningfulVacancyValue(explicitPhysical) &&
    !isBareGenericCityOnly(explicitPhysical)
  ) {
    physicalAddress = explicitPhysical;
  } else {
    const methodLower = String(vacancy.applicationMethod || '').toLowerCase();
    const isPhysicalMethod = /in[\s-]?person|physical|postal|mail/i.test(methodLower);
    const contactClean = stripEdgePunctuation(vacancy.contactInfo);
    const instrClean = stripEdgePunctuation(vacancy.applicationInstructions);

    if (
      contactClean &&
      isMeaningfulVacancyValue(contactClean) &&
      !isBareGenericCityOnly(contactClean) &&
      (PHYSICAL_ADDRESS_SIGNAL_REGEX.test(contactClean) || (isPhysicalMethod && contactClean.length >= 10))
    ) {
      physicalAddress = contactClean;
    } else if (
      instrClean &&
      isMeaningfulVacancyValue(instrClean) &&
      !GENERIC_INSTRUCTIONS_BOILERPLATE_REGEX.test(instrClean) &&
      PHYSICAL_ADDRESS_SIGNAL_REGEX.test(instrClean) &&
      instrClean.length >= 12
    ) {
      physicalAddress = instrClean;
    }
  }

  if (physicalAddress) {
    channels.push('physical');
  }

  return {
    valid: channels.length > 0,
    channels,
    directUrl,
    directEmail,
    physicalAddress,
  };
}

/**
 * Verifies that real job requirements are present (education, field of study, experience,
 * required skills, special requirements, or substantive requirements inside the description).
 */
export function hasVacancyRequirements(vacancy?: Partial<Vacancy> | null): boolean {
  if (!vacancy) return false;

  if (isMeaningfulVacancyValue(vacancy.educationQualification) && String(vacancy.educationQualification).trim().length >= 3) {
    return true;
  }
  if (isMeaningfulVacancyValue(vacancy.requiredFieldOfStudy) && String(vacancy.requiredFieldOfStudy).trim().length >= 3) {
    return true;
  }
  if (isMeaningfulVacancyValue(vacancy.experienceYears) && String(vacancy.experienceYears).trim().length >= 2) {
    return true;
  }
  if (
    Array.isArray(vacancy.requiredSkills) &&
    vacancy.requiredSkills.some((s) => isMeaningfulVacancyValue(s) && String(s).trim().length >= 2)
  ) {
    return true;
  }
  if (isMeaningfulVacancyValue(vacancy.specialRequirements) && String(vacancy.specialRequirements).trim().length >= 5) {
    return true;
  }

  // Fallback: check if description itself contains genuine requirements text (not just a 1-line stub)
  const desc = stripEdgePunctuation(vacancy.description);
  if (
    desc.length >= 45 &&
    isMeaningfulVacancyValue(desc) &&
    /\b(?:degree|diploma|bachelor|master|bsc|ba\b|msc|mba|phd|tvet|level\s+[iv1-5]|qualification|requirement|experience|years?|skills?|proficiency|certification|license|competenc|background|knowledge|focus\s*:)/i.test(
      desc
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Verifies that the vacancy explicitly specifies a real Method to Apply (not blank or boilerplate).
 */
export function hasVacancyMethodToApply(vacancy?: Partial<Vacancy> | null): boolean {
  if (!vacancy) return false;

  const method = stripEdgePunctuation(vacancy.applicationMethod);
  const instructions = stripEdgePunctuation(vacancy.applicationInstructions);
  const hasRealMethod = Boolean(method && isMeaningfulVacancyValue(method));
  const hasRealInstructions = Boolean(
    instructions &&
      instructions.length >= 8 &&
      isMeaningfulVacancyValue(instructions) &&
      !GENERIC_INSTRUCTIONS_BOILERPLATE_REGEX.test(instructions)
  );

  // Must have a real application method AND genuine instructions (or a direct apply channel paired with a specific method)
  return hasRealMethod && hasRealInstructions;
}

function isInvalidHeaderOnlyTitle(title: string, org: string): boolean {
  const t = stripEdgePunctuation(title).toLowerCase();
  const o = stripEdgePunctuation(org).toLowerCase();
  if (!t || t.length < 3) return true;
  if (/\bjob\s+vacancies\b|\bvacancies\s*[–—-]\s*ethiopia\b|^vacancy\s+announcement\s*\d*$/i.test(t)) {
    return true;
  }
  if (t === o && /\bvacancies\b|\bjobs\b/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Strict Mandatory Vacancy Gatekeeper enforced across:
 * - Single Vacancy Upload (ManualPostModal)
 * - Bulk Vacancy Upload (BulkImportSystem & TelegramPublishQueue Bulk Import)
 * - Server Sync & Persistence
 * - Telegram Broadcasting (Single, Batch, Queue, & Auto-Publish)
 */
export function validateVacancyStrict(
  vacancy?: Partial<Vacancy> | null,
  options?: { allowExpired?: boolean }
): VacancyValidationResult {
  const missingFields: string[] = [];
  const reasons: string[] = [];

  if (!vacancy || typeof vacancy !== 'object') {
    return {
      valid: false,
      hasValidDeadline: false,
      isExpired: false,
      missingFields: [
        'Position / Job Title',
        'Employer Name',
        'Application Deadline',
        'Requirements',
        'Method to Apply',
        'Employer Direct Link, Email, or Physical Address',
      ],
      reasons: ['Vacancy data is empty.'],
      channels: [],
    };
  }

  const title = stripEdgePunctuation(vacancy.title);
  const org = stripEdgePunctuation(vacancy.organization);

  // 1. Position / Job Title
  if (!title || !isMeaningfulVacancyValue(title) || isInvalidHeaderOnlyTitle(title, org)) {
    missingFields.push('Position / Job Title');
    reasons.push('Position / Job Title is missing or invalid.');
  }

  // 2. Employer Name
  if (!org || org.length < 2 || !isMeaningfulVacancyValue(org)) {
    missingFields.push('Employer Name');
    reasons.push('Employer / Organization Name is missing.');
  }

  // 3. Application Deadline (STRICT — no deadline = rejected & permanently deleted)
  const deadlineInfo = parseValidDeadline(vacancy.applicationDeadline);
  if (!deadlineInfo.hasValidDeadline) {
    missingFields.push('Application Deadline');
    reasons.push(
      'Application Deadline is missing or not a valid calendar date (jobs without a real deadline are never allowed and are permanently deleted).'
    );
  } else if (!options?.allowExpired && deadlineInfo.isExpired) {
    missingFields.push('Open Future Deadline (Current deadline expired)');
    reasons.push(`Application Deadline (${vacancy.applicationDeadline}) has already expired.`);
  }

  // 4. Requirements
  if (!hasVacancyRequirements(vacancy)) {
    missingFields.push('Requirements (Education, Experience, or Skills)');
    reasons.push('Job requirements (qualification, experience, field of study, or skills) are missing.');
  }

  // 5. Method to Apply
  if (!hasVacancyMethodToApply(vacancy)) {
    missingFields.push('Method to Apply & Instructions');
    reasons.push('Method to apply and clear application instructions are missing.');
  }

  // 6. Employer Direct Link, Email, or Physical Address
  const channelCheck = extractDirectEmployerChannels(vacancy);
  if (!channelCheck.valid) {
    missingFields.push('Employer Direct Link, Email, or Physical Address');
    reasons.push(
      'At least one direct employer apply channel is required (official employer direct URL, employer email address, or physical submission address).'
    );
  }

  return {
    valid: missingFields.length === 0,
    hasValidDeadline: deadlineInfo.hasValidDeadline,
    isExpired: deadlineInfo.isExpired,
    missingFields,
    reasons,
    channels: channelCheck.channels,
  };
}

/**
 * Splits a list of vacancies into those with a real deadline vs those without a deadline
 * (which must be permanently deleted from the website and database).
 */
export function partitionVacanciesByDeadline<T extends Partial<Vacancy>>(
  vacancies: T[]
): { withDeadline: T[]; withoutDeadline: T[] } {
  const withDeadline: T[] = [];
  const withoutDeadline: T[] = [];
  for (const v of vacancies || []) {
    if (hasValidVacancyDeadline(v)) {
      withDeadline.push(v);
    } else {
      withoutDeadline.push(v);
    }
  }
  return { withDeadline, withoutDeadline };
}

/**
 * Strict Pre-Send Telegram Content Audit:
 * Guarantees that NO links, URLs, emails, phone numbers, physical addresses, or application methods
 * are EVER printed inside Telegram channel posts (applicants must tap "Apply Now" to view them inside the website).
 */
export function validateTelegramPostContentStrict(plainText: string): {
  safe: boolean;
  violations: string[];
} {
  const text = String(plainText || '');
  const violations: string[] = [];

  if (/https?:\/\/\S+/i.test(text) || /\bwww\.[^\s]+/i.test(text) || /\bt\.me\/\S+/i.test(text)) {
    violations.push('Contains a URL or web link in Telegram post text.');
  }
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
    violations.push('Contains an email address in Telegram post text.');
  }
  if (/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|et|tech|io|co|gov|edu|info)(?:\/\S*)?/i.test(text)) {
    violations.push('Contains a website domain in Telegram post text.');
  }
  if (/(?:\+251[\s-]?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4}|\b0[19]\d[\s-]?\d{3}[\s-]?\d{4}\b)/.test(text)) {
    violations.push('Contains a phone number in Telegram post text.');
  }
  if (
    /\b(?:how\s+to\s+apply\s*:|application\s+method\s*:|method\s+to\s+apply\s*:|apply\s+via\s*:|send\s+(?:your\s+)?cv\s+to|submit\s+in\s+person|p\.?\s*o\.?\s*box\s*\d+)\b/i.test(
      text
    )
  ) {
    violations.push('Contains application method or submission instructions in Telegram post text.');
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}
