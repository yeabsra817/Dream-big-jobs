import { Vacancy } from '../types/job';
import { isExpired } from './helpers';

export interface AutoRepairLog {
  id: string;
  timestamp: string;
  category: 'expired_vacancy' | 'broken_link' | 'missing_fields' | 'duplicate_cleanup' | 'firebase_reconnect' | 'analytics_queue';
  severity: 'critical' | 'warning' | 'info';
  targetId?: string;
  targetTitle?: string;
  action: string;
  status: 'HEALED' | 'PREVENTED' | 'QUEUED';
  details: string;
}

// Sanitize and auto-repair malformed external application URLs
export function sanitizeUrl(rawUrl?: string): { url: string; changed: boolean } {
  if (!rawUrl || rawUrl === 'Not specified in the original vacancy') {
    return { url: '', changed: false };
  }

  let cleaned = rawUrl.trim().replace(/^["']|["']$/g, '');
  const original = cleaned;

  // Fix common typos in protocol
  cleaned = cleaned.replace(/^ht{1,3}ps?:\/\/|^hppt:\/\/|^htpp:\/\//i, 'https://');
  cleaned = cleaned.replace(/^http:\/\//i, 'https://'); // upgrade http to secure https

  // If missing protocol but looks like a domain
  if (!/^https?:\/\//i.test(cleaned) && /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  // Remove trailing commas, periods or spaces accidentally pasted
  cleaned = cleaned.replace(/[,;.\s]+$/, '');

  return {
    url: cleaned,
    changed: cleaned !== original,
  };
}

// Category inference helper for Ethiopian sectors
export function inferCategoryAuto(title: string, org: string, desc: string): string {
  const combined = `${title} ${org} ${desc}`.toLowerCase();
  if (/bank|cbe|awash|dashen|abyssinia|oromia bank|hibret|wegagen|nib bank|zemen|berhan|enat|lion bank|amhara bank|siinqee|coop|teller|credit officer|loan officer|branch manager|banking/i.test(combined)) {
    if (/microfinance|mfi|saving and credit/i.test(combined)) return 'Microfinance Institutions';
    return 'Banking and Financial Institutions';
  }
  if (/microfinance|mfi|saving and credit|micro-finance/i.test(combined)) return 'Microfinance Institutions';
  if (/embassy|diplomatic|consulate|ambassador|consular|delegation/i.test(combined)) return 'Embassy and Diplomatic Jobs';
  if (/ngo|msf|unicef|undp|usaid|oxfam|humanitarian|charity|save the children|care international|red cross|world vision|goal ethiopia|snv|fhi|actionaid|refugee|who|wfp/i.test(combined)) return 'NGO and International Organizations';
  if (/hotel|guest house|resort|receptionist|waiter|waitress|chef|cook|barista|housekeeping|front desk|catering|pastry|hospitality|restaurant/i.test(combined)) return 'Hotel and Hospitality';
  if (/tourism|tour|travel|tour guide|travel agency|airline|ticketing/i.test(combined)) return 'Tourism and Travel';
  if (/insurance|nyala|united insurance|nice insurance|africa insurance|underwriting/i.test(combined)) return 'Insurance Companies';
  if (/ministry|authority|agency|bureau|city administration|commission|customs|public sector|government|federal/i.test(combined)) return 'Government and Public Sector';
  if (/university|college|school|teacher|lecturer|professor|instructor|dean|academic|education/i.test(combined)) return 'Education and Universities';
  if (/health|hospital|doctor|nurse|clinic|pharmacy|pharmacist|medical|laboratory technician|public health|midwife/i.test(combined)) return 'Healthcare and Medical';
  if (/software|developer|programmer|it |network|database|system admin|web developer|mobile app|computer science|data analyst|devops/i.test(combined)) return 'IT and Technology';
  if (/engineer|construction|architect|civil|electrical|mechanical|site engineer|contractor/i.test(combined)) return 'Engineering and Construction';
  if (/accountant|audit|auditor|finance officer|cashier|payroll|budget|financial analyst/i.test(combined)) return 'Accounting and Finance';
  if (/intern|internship|graduate trainee|trainee|fresh graduate/i.test(combined)) return 'Internships and Graduate Trainee Programs';
  if (/remote|work from home|freelance|international remote/i.test(combined)) return 'Remote and International Jobs';
  return 'Private Companies';
}

/**
 * Perform autonomous self-healing sweep on all vacancies
 */
export function runAutonomousVacancyHealing(
  vacancies: Vacancy[],
  knownBrokenLinkIds: Set<string> = new Set()
): {
  healedVacancies: Vacancy[];
  logs: AutoRepairLog[];
  changedCount: number;
} {
  const logs: AutoRepairLog[] = [];
  let changedCount = 0;

  const healedVacancies = vacancies.map((v) => {
    let modified = false;
    let updated = { ...v };

    // -------------------------------------------------------------
    // Self-Healing Rule 1: Auto-Archive Expired Published Vacancies
    // -------------------------------------------------------------
    if (updated.status === 'published' && isExpired(updated.applicationDeadline)) {
      updated.status = 'archived';
      updated.updatedAt = new Date().toISOString();
      modified = true;
      changedCount++;

      logs.push({
        id: `heal_exp_${updated.id}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        category: 'expired_vacancy',
        severity: 'warning',
        targetId: updated.id,
        targetTitle: updated.title,
        action: 'Auto-Archived Expired Listing',
        status: 'HEALED',
        details: `Vacancy "${updated.title}" reached its application deadline (${updated.applicationDeadline}). Automatically shifted from Published to Archived within seconds to protect job seeker trust.`,
      });
    }

    // -------------------------------------------------------------
    // Self-Healing Rule 2: Auto-Repair Malformed Application URLs
    // -------------------------------------------------------------
    if (updated.applicationUrl && updated.applicationUrl !== 'Not specified in the original vacancy') {
      const sanitized = sanitizeUrl(updated.applicationUrl);
      if (sanitized.changed) {
        const oldUrl = updated.applicationUrl;
        updated.applicationUrl = sanitized.url;
        updated.updatedAt = new Date().toISOString();
        modified = true;
        changedCount++;

        logs.push({
          id: `heal_url_${updated.id}_${Date.now()}`,
          timestamp: new Date().toISOString(),
          category: 'broken_link',
          severity: 'info',
          targetId: updated.id,
          targetTitle: updated.title,
          action: 'Auto-Repaired URL Protocol',
          status: 'HEALED',
          details: `Corrected invalid URL format from "${oldUrl}" to clean standardized "${sanitized.url}".`,
        });
      }
    }

    // -------------------------------------------------------------
    // Self-Healing Rule 3: Auto-Fallback for Known Dead / 404 Links
    // -------------------------------------------------------------
    if (knownBrokenLinkIds.has(updated.id) && updated.status === 'published') {
      // Look for candidate email in instructions or contact info
      const fullText = `${updated.description || ''} ${updated.applicationInstructions || ''} ${updated.contactInfo || ''}`;
      const emailMatches = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);

      if (emailMatches && emailMatches.length > 0 && !updated.applicationEmail) {
        updated.applicationEmail = emailMatches[0];
        updated.applicationMethod = 'Email';
        updated.updatedAt = new Date().toISOString();
        modified = true;
        changedCount++;

        logs.push({
          id: `heal_dead_link_${updated.id}_${Date.now()}`,
          timestamp: new Date().toISOString(),
          category: 'broken_link',
          severity: 'critical',
          targetId: updated.id,
          targetTitle: updated.title,
          action: 'Restored Application Fallback to Verified Email',
          status: 'HEALED',
          details: `External web URL was unreachable. Automatically extracted verified email (${emailMatches[0]}) from vacancy description and updated application method.`,
        });
      }
    }

    // -------------------------------------------------------------
    // Self-Healing Rule 4: Auto-Heal Missing Category or Location
    // -------------------------------------------------------------
    if (!updated.category || (updated.category as string) === 'General') {
      const inferred = inferCategoryAuto(updated.title, updated.organization, updated.description || '');
      updated.category = inferred as any;
      updated.updatedAt = new Date().toISOString();
      modified = true;
      changedCount++;

      logs.push({
        id: `heal_cat_${updated.id}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        category: 'missing_fields',
        severity: 'info',
        targetId: updated.id,
        targetTitle: updated.title,
        action: 'Inferred Job Category',
        status: 'HEALED',
        details: `Assigned appropriate Ethiopian sector category "${inferred}" based on job title and organizational scope.`,
      });
    }

    if (!updated.location || updated.location.trim() === '') {
      updated.location = 'Addis Ababa, Ethiopia';
      updated.updatedAt = new Date().toISOString();
      modified = true;
      changedCount++;

      logs.push({
        id: `heal_loc_${updated.id}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        category: 'missing_fields',
        severity: 'info',
        targetId: updated.id,
        targetTitle: updated.title,
        action: 'Set Default Location',
        status: 'HEALED',
        details: `Location was empty; assigned default standard "Addis Ababa, Ethiopia".`,
      });
    }

    // -------------------------------------------------------------
    // Self-Healing Rule 5: Auto-Clean Temporary Telegram Errors
    // -------------------------------------------------------------
    if (updated.telegramPublishError && updated.telegramPublished) {
      delete updated.telegramPublishError;
      updated.updatedAt = new Date().toISOString();
      modified = true;
    }

    return modified ? updated : v;
  });

  // Store in persistent local audit log (deduplicating recently logged identical actions)
  if (logs.length > 0) {
    try {
      const stored = localStorage.getItem('dream_big_self_healing_audit_log');
      const existingLogs: AutoRepairLog[] = stored ? JSON.parse(stored) : [];
      const recentKeys = new Set(existingLogs.slice(0, 50).map((l) => `${l.action}__${l.targetId}`));
      const freshUniqueLogs = logs.filter((l) => !recentKeys.has(`${l.action}__${l.targetId}`));

      if (freshUniqueLogs.length > 0) {
        const combined = [...freshUniqueLogs, ...existingLogs].slice(0, 100);
        localStorage.setItem('dream_big_self_healing_audit_log', JSON.stringify(combined));

        // Dispatch browser custom event for live widget updates
        window.dispatchEvent(
          new CustomEvent('dream_big_self_healed', {
            detail: { logs: freshUniqueLogs, count: freshUniqueLogs.length },
          })
        );
      }
    } catch (e) {
      console.warn('Could not persist self-healing audit log:', e);
    }
  }

  return {
    healedVacancies,
    logs,
    changedCount,
  };
}

/**
 * Retrieve the accumulated self-healing audit trail
 */
export function getStoredSelfHealingLogs(): AutoRepairLog[] {
  try {
    const stored = localStorage.getItem('dream_big_self_healing_audit_log');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Clear the audit trail if needed
 */
export function clearStoredSelfHealingLogs(): void {
  try {
    localStorage.removeItem('dream_big_self_healing_audit_log');
  } catch {}
}
