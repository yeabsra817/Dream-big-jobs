import { Vacancy } from '../types/job';
import { AnalyticsEvent } from '../types/analytics';

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

const VISITOR_ID_KEY = 'dbj_vid';
const RETURNING_VISITOR_KEY = 'dbj_has_visited';
const SESSION_ID_KEY = 'dbj_sid';
const SESSION_TIMESTAMP_KEY = 'dbj_session_ts';
const EXCLUDE_ADMIN_KEY = 'dbj_exclude_admin_traffic';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

// Get or create anonymous persistent unique visitor ID
export function getOrCreateVisitorId(): { visitorId: string; isReturning: boolean } {
  if (typeof window === 'undefined') {
    return { visitorId: 'server', isReturning: false };
  }

  let vid = localStorage.getItem(VISITOR_ID_KEY);
  const hasVisited = localStorage.getItem(RETURNING_VISITOR_KEY) === 'true';

  if (!vid) {
    vid = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(VISITOR_ID_KEY, vid);
    localStorage.setItem(RETURNING_VISITOR_KEY, 'false');
    return { visitorId: vid, isReturning: false };
  }

  // Mark as returning visitor if it wasn't already
  if (!hasVisited) {
    localStorage.setItem(RETURNING_VISITOR_KEY, 'true');
  }

  return { visitorId: vid, isReturning: true };
}

// Get or create session ID (sessions timeout after 30 min of inactivity)
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'sid_server';

  const now = Date.now();
  const storedSid = sessionStorage.getItem(SESSION_ID_KEY);
  const storedTs = sessionStorage.getItem(SESSION_TIMESTAMP_KEY);

  if (storedSid && storedTs) {
    const lastActive = parseInt(storedTs, 10);
    if (now - lastActive < SESSION_TIMEOUT_MS) {
      sessionStorage.setItem(SESSION_TIMESTAMP_KEY, String(now));
      return storedSid;
    }
  }

  const newSid = `sid_${now}_${Math.random().toString(36).substring(2, 8)}`;
  sessionStorage.setItem(SESSION_ID_KEY, newSid);
  sessionStorage.setItem(SESSION_TIMESTAMP_KEY, String(now));
  return newSid;
}

// Detect device category
export function detectDeviceType(): 'mobile' | 'desktop' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua)) {
    return 'tablet';
  }
  if (/(mobi|ipod|phone|blackberry|opera mini|fennec|minimo|symbian|psp|nintendo ds)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

// Detect referral traffic source and UTM tags
export function detectTrafficSource(): {
  source: AnalyticsEvent['source'];
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
} {
  if (typeof window === 'undefined') return { source: 'direct' };

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source')?.toLowerCase();
    const utmMedium = urlParams.get('utm_medium')?.toLowerCase();
    const utmCampaign = urlParams.get('utm_campaign')?.toLowerCase();

    // Check UTM first
    if (utmSource) {
      if (utmSource.includes('telegram') || utmSource === 'tg') {
        return { source: 'telegram', utmSource, utmMedium, utmCampaign };
      }
      if (utmSource.includes('google')) {
        return { source: 'google', utmSource, utmMedium, utmCampaign };
      }
      if (utmSource.includes('facebook') || utmSource === 'fb') {
        return { source: 'facebook', utmSource, utmMedium, utmCampaign };
      }
      return { source: 'referral', utmSource, utmMedium, utmCampaign };
    }

    // Check HTTP Referrer
    const referrer = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : '';

    if (!referrer || referrer === window.location.hostname) {
      return { source: 'direct' };
    }
    if (referrer.includes('t.me') || referrer.includes('telegram')) {
      return { source: 'telegram' };
    }
    if (referrer.includes('google')) {
      return { source: 'google' };
    }
    if (referrer.includes('facebook') || referrer.includes('fb.com')) {
      return { source: 'facebook' };
    }
    return { source: 'referral' };
  } catch {
    return { source: 'direct' };
  }
}

// Sanitize inputs to ensure no PII (passwords, emails, phone numbers) is ever sent to GA4 or telemetry
export function sanitizeAnalyticsValue(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]')
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,9}/g, '[REDACTED_PHONE]')
    .replace(/(password|passcode|token|key)=\S+/gi, '$1=[REDACTED]')
    .trim()
    .slice(0, 150);
}

// Check if current visit is considered internal / admin traffic
// Note: ONLY genuine admin dashboard activity is marked internal; public visitors are NEVER excluded
export function isInternalAdminVisit(isAdminLoggedIn: boolean = false): boolean {
  if (typeof window === 'undefined') return false;

  // Check explicit admin exclusion setting in localStorage
  const setting = localStorage.getItem(EXCLUDE_ADMIN_KEY);
  if (setting === 'false') {
    return false; // Admin explicitly wants to record their visits
  }

  // True only if admin is logged in AND actively on admin interface, or explicit debug param
  if (isAdminLoggedIn && (window.location.search.includes('admin=true') || window.location.hash.includes('admin') || window.location.pathname.startsWith('/admin'))) {
    return true;
  }
  if (window.location.search.includes('is_admin_test=true')) {
    return true;
  }

  return false;
}

export function setInternalTrafficExclusion(exclude: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(EXCLUDE_ADMIN_KEY, exclude ? 'true' : 'false');
  }
}

export function getInternalTrafficExclusion(): boolean {
  if (typeof window === 'undefined') return false;
  const val = localStorage.getItem(EXCLUDE_ADMIN_KEY);
  // Default to false so public traffic is never accidentally suppressed
  return val === 'true';
}

export const DEFAULT_GA_MEASUREMENT_ID = 'G-KH6X73105S';

// Initialize official GA4 script tag dynamically for continuous 24/7 tracking
let isGaInitialized = false;
let currentGaMeasurementId: string = DEFAULT_GA_MEASUREMENT_ID;
let currentAnalyticsUserId: string | null = null;

// Sanitize non-PII Firebase UID so no email address or phone ever leaks into analytics
function normalizeNonPiiUserId(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('@')) return null;
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || null;
}

// Track user ID across different Google accounts so each user is counted
export function setAnalyticsUserId(userId: string | null) {
  if (typeof window === 'undefined') return;
  const safeUid = normalizeNonPiiUserId(userId);
  currentAnalyticsUserId = safeUid;
  const gaId = currentGaMeasurementId || DEFAULT_GA_MEASUREMENT_ID;
  if (typeof window.gtag === 'function') {
    try {
      if (safeUid) {
        window.gtag('set', 'user_properties', {
          user_id: safeUid,
          account_linked: 1,
        });
        window.gtag('config', gaId, {
          user_id: safeUid,
        });
      } else {
        window.gtag('set', 'user_properties', {
          user_id: null,
          account_linked: 0,
        });
      }
    } catch (e) {
      console.warn('[Analytics] Failed to set user_id:', e);
    }
  }
}

export function initGoogleAnalytics4(measurementId?: string, isInternal: boolean = false) {
  if (typeof window === 'undefined') return;

  const idToUse =
    measurementId ||
    (import.meta as any).env?.VITE_GA_MEASUREMENT_ID ||
    (window as any).__GA_MEASUREMENT_ID__ ||
    DEFAULT_GA_MEASUREMENT_ID;

  const cleanId = String(idToUse).trim().toUpperCase();
  if (!cleanId.startsWith('G-')) return;
  if (isGaInitialized && currentGaMeasurementId === cleanId) return;

  try {
    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer?.push(args);
    }
    window.gtag = gtag;

    gtag('js', new Date());

    // Continuous 24/7 GA4 configuration without full reload requirements
    gtag('config', cleanId, {
      send_page_view: false, // We dispatch page_view manually for SPA navigation
      traffic_type: isInternal ? 'internal' : undefined,
      debug_mode: isInternal ? true : undefined,
      cookie_domain: 'auto',
      cookie_flags: 'SameSite=None;Secure',
      anonymize_ip: true,
    });

    // Check if script tag already exists in head to prevent duplicates
    const existingScript = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${cleanId}"]`);
    if (!existingScript) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${cleanId}`;
      document.head.appendChild(script);
    }

    isGaInitialized = true;
    currentGaMeasurementId = cleanId;
    (window as any).__GA_MEASUREMENT_ID__ = cleanId;
  } catch (err) {
    console.warn('[Analytics] Failed to initialize GA4:', err);
  }
}

export interface TrackEventDetails {
  path?: string;
  title?: string;
  jobId?: string;
  jobTitle?: string;
  organization?: string;
  category?: string;
  applyUrl?: string;
  applyMethod?: string;
  searchTerm?: string;
  resultsCount?: number;
  hasResults?: boolean;
  itemRank?: number;
  filterType?: string;
  filterValue?: string;
  sortBy?: string;
  channel?: string;
  method?: string;
  isAdminLoggedIn?: boolean;
  gaMeasurementId?: string;
}

// Send event to backend telemetry store and GA4
export async function trackAnalyticsEvent(
  eventType: AnalyticsEvent['eventType'],
  details: TrackEventDetails
) {
  if (typeof window === 'undefined') return;

  const { visitorId, isReturning } = getOrCreateVisitorId();
  const sessionId = getOrCreateSessionId();
  const deviceType = detectDeviceType();
  const { source, utmSource, utmMedium, utmCampaign } = detectTrafficSource();
  const isInternal = isInternalAdminVisit(details.isAdminLoggedIn);
  const gaId = details.gaMeasurementId || currentGaMeasurementId || (window as any).__GA_MEASUREMENT_ID__;

  // Sanitize values to prevent PII leakage
  const safeSearchTerm = sanitizeAnalyticsValue(details.searchTerm);
  const safeJobTitle = sanitizeAnalyticsValue(details.jobTitle);
  const safeOrg = sanitizeAnalyticsValue(details.organization);
  const safePath = details.path || window.location.pathname;

  // 1. Dual-track to Google Analytics 4 (GA4) with strict PII protections
  if (typeof window.gtag === 'function') {
    try {
      switch (eventType) {
        case 'page_view':
          window.gtag('event', 'page_view', {
            page_location: window.location.href,
            page_path: safePath,
            page_title: details.title || document.title,
            traffic_type: isInternal ? 'internal' : undefined,
            is_returning: isReturning ? 1 : 0,
            device_category: deviceType,
            traffic_source: source,
          });
          break;

        case 'vacancy_view':
          window.gtag('event', 'view_item', {
            item_id: details.jobId,
            item_name: safeJobTitle,
            item_category: details.category,
            item_brand: safeOrg,
            currency: 'ETB',
            source: source,
          });
          break;

        case 'category_view':
          window.gtag('event', 'select_content', {
            content_type: 'job_category',
            item_id: details.category,
          });
          break;

        case 'location_view':
          window.gtag('event', 'select_content', {
            content_type: 'job_location',
            item_id: details.filterValue || details.title,
          });
          break;

        case 'search':
          window.gtag('event', 'search', {
            search_term: safeSearchTerm || '',
            results_count: details.resultsCount ?? 0,
            has_results: details.hasResults ? 1 : 0,
            search_category: details.category || 'all',
          });
          break;

        case 'view_search_results':
          window.gtag('event', 'view_search_results', {
            search_term: safeSearchTerm || '',
            results_count: details.resultsCount ?? 0,
          });
          break;

        case 'select_search_result':
          window.gtag('event', 'select_item', {
            item_id: details.jobId,
            item_name: safeJobTitle,
            item_category: details.category,
            item_brand: safeOrg,
            item_list_name: 'search_results',
            index: details.itemRank || 1,
          });
          break;

        case 'search_no_results':
          window.gtag('event', 'search_no_results', {
            search_term: safeSearchTerm || '',
          });
          break;

        case 'click_apply_link':
          window.gtag('event', 'click_apply_link', {
            job_id: details.jobId,
            job_title: safeJobTitle,
            employer: safeOrg,
            apply_method: details.applyMethod,
          });
          break;

        case 'click_telegram_link':
          window.gtag('event', 'click_telegram_link', {
            channel: details.channel || '@DreamBigJobsEthiopia',
            job_id: details.jobId,
          });
          break;

        case 'share_telegram':
          window.gtag('event', 'share', {
            method: 'telegram',
            content_type: 'vacancy',
            item_id: details.jobId,
          });
          break;

        case 'filter_change':
          window.gtag('event', 'filter_change', {
            filter_type: details.filterType,
            filter_value: details.filterValue,
          });
          break;

        case 'sort_change':
          window.gtag('event', 'sort_change', {
            sort_by: details.sortBy,
          });
          break;

        case 'ai_assist':
          window.gtag('event', 'ai_assist', {
            ai_task: details.filterType || 'general',
            job_id: details.jobId,
            search_category: details.category,
          });
          break;

        default:
          break;
      }
    } catch (gaErr) {
      console.warn('[Analytics] GA4 event dispatch error:', gaErr);
    }
  }

  // 2. Dual-track to First-Party Database Event Store (Addis Ababa Timezone & 24/7 Logging)
  const eventPayload: AnalyticsEvent = {
    id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    visitorId,
    ...(currentAnalyticsUserId ? { userId: currentAnalyticsUserId } : {}),
    sessionId,
    eventType,
    path: safePath,
    title: details.title || document.title,
    jobId: details.jobId,
    jobTitle: safeJobTitle,
    organization: safeOrg,
    category: details.category,
    applyUrl: details.applyUrl,
    applyMethod: details.applyMethod,
    searchTerm: safeSearchTerm,
    resultsCount: details.resultsCount,
    hasResults: details.hasResults,
    itemRank: details.itemRank,
    filterType: details.filterType,
    filterValue: details.filterValue,
    sortBy: details.sortBy,
    channel: details.channel,
    source,
    utmSource,
    utmMedium,
    utmCampaign,
    deviceType,
    timestamp: new Date().toISOString(),
    isInternal,
  };

  // If currently offline, queue event in persistent storage for automatic replay when back online
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    queueOfflineEvent(eventPayload, details);
    return;
  }

  try {
    const bodyStr = JSON.stringify(eventPayload);
    if (navigator.sendBeacon) {
      const blob = new Blob([bodyStr], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/analytics/track', blob);
      if (!sent) queueOfflineEvent(eventPayload, details);
    } else {
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true,
      }).catch(() => {
        queueOfflineEvent(eventPayload, details);
      });
    }
  } catch {
    queueOfflineEvent(eventPayload, details);
  }
}

const OFFLINE_QUEUE_KEY = 'hopelandjobs_offline_analytics_queue';

function queueOfflineEvent(payload: AnalyticsEvent, details: TrackEventDetails) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ payload, details, queuedAt: Date.now() });
    if (queue.length > 100) queue.shift();
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export function flushOfflineAnalyticsQueue() {
  if (typeof window === 'undefined' || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;
    const queue = JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) return;
    localStorage.removeItem(OFFLINE_QUEUE_KEY);

    queue.forEach(({ payload, details }) => {
      // Replay to GA4 if window.gtag is available
      if (typeof window.gtag === 'function') {
        try {
          window.gtag('event', payload.eventType, {
            ...details,
            offline_replayed: 1,
            replayed_at: new Date().toISOString(),
          });
        } catch {}
      }

      // Replay to First-Party Database
      try {
        const bodyStr = JSON.stringify(payload);
        if (navigator.sendBeacon) {
          const blob = new Blob([bodyStr], { type: 'application/json' });
          navigator.sendBeacon('/api/analytics/track', blob);
        } else {
          fetch('/api/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyStr,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    });
  } catch {}
}

// Automatically listen for reconnect events to sync all offline analytics
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflineAnalyticsQueue();
  });
  // Also attempt flush on startup
  setTimeout(() => flushOfflineAnalyticsQueue(), 2000);
}

