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

// Check if current visit is considered internal / admin traffic
export function isInternalAdminVisit(isAdminLoggedIn: boolean = false): boolean {
  if (typeof window === 'undefined') return false;

  // Check explicit admin exclusion setting in localStorage
  const setting = localStorage.getItem(EXCLUDE_ADMIN_KEY);
  if (setting === 'false') {
    return false; // Admin explicitly un-checked exclusion
  }

  // Default is true if admin is logged in or if on admin path or debug param
  if (isAdminLoggedIn) return true;
  if (window.location.search.includes('admin=true') || window.location.search.includes('is_admin=true')) {
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
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(EXCLUDE_ADMIN_KEY);
  return val === null ? true : val === 'true'; // Default true for security
}

// Initialize official GA4 script tag dynamically
let isGaInitialized = false;
export function initGoogleAnalytics4(measurementId?: string, isInternal: boolean = false) {
  if (typeof window === 'undefined' || !measurementId || measurementId.trim() === '') return;
  if (isGaInitialized) return;

  const cleanId = measurementId.trim();
  if (!cleanId.startsWith('G-')) return;

  try {
    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer?.push(args);
    }
    window.gtag = gtag;

    gtag('js', new Date());

    // Configure GA4 measurement with internal traffic flag if admin visit
    gtag('config', cleanId, {
      send_page_view: false, // We control page_view dispatch for accurate routing
      traffic_type: isInternal ? 'internal' : undefined,
      debug_mode: isInternal ? true : undefined,
      cookie_domain: 'auto',
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${cleanId}`;
    document.head.appendChild(script);

    isGaInitialized = true;
    console.info(`[Analytics] Google Analytics 4 initialized successfully with ID: ${cleanId}`);
  } catch (err) {
    console.warn('[Analytics] Failed to initialize GA4:', err);
  }
}

// Send event to backend telemetry store and GA4
export async function trackAnalyticsEvent(
  eventType: AnalyticsEvent['eventType'],
  details: {
    path?: string;
    title?: string;
    jobId?: string;
    jobTitle?: string;
    organization?: string;
    category?: string;
    applyUrl?: string;
    applyMethod?: string;
    isAdminLoggedIn?: boolean;
    gaMeasurementId?: string;
  }
) {
  if (typeof window === 'undefined') return;

  const { visitorId } = getOrCreateVisitorId();
  const sessionId = getOrCreateSessionId();
  const deviceType = detectDeviceType();
  const { source, utmSource, utmMedium, utmCampaign } = detectTrafficSource();
  const isInternal = isInternalAdminVisit(details.isAdminLoggedIn);

  // Send to GA4 if initialized
  if (typeof window.gtag === 'function' && details.gaMeasurementId) {
    try {
      if (eventType === 'page_view') {
        window.gtag('event', 'page_view', {
          page_location: window.location.href,
          page_path: details.path || window.location.pathname,
          page_title: details.title || document.title,
          traffic_type: isInternal ? 'internal' : undefined,
        });
      } else if (eventType === 'vacancy_view') {
        window.gtag('event', 'view_item', {
          item_id: details.jobId,
          item_name: details.jobTitle,
          item_category: details.category,
          item_brand: details.organization,
        });
      } else if (eventType === 'category_view') {
        window.gtag('event', 'select_content', {
          content_type: 'job_category',
          item_id: details.category,
        });
      } else if (eventType === 'click_apply_link') {
        window.gtag('event', 'click_apply_link', {
          job_id: details.jobId,
          job_title: details.jobTitle,
          employer: details.organization,
          apply_url: details.applyUrl,
          apply_method: details.applyMethod,
        });
      } else if (eventType === 'share_telegram') {
        window.gtag('event', 'share', {
          method: 'telegram',
          content_type: 'vacancy',
          item_id: details.jobId,
        });
      }
    } catch (gaErr) {
      console.warn('[Analytics] GA4 event error:', gaErr);
    }
  }

  // Send to first-party verified event recorder
  const eventPayload: AnalyticsEvent = {
    id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    visitorId,
    sessionId,
    eventType,
    path: details.path || window.location.pathname,
    title: details.title || document.title,
    jobId: details.jobId,
    jobTitle: details.jobTitle,
    organization: details.organization,
    category: details.category,
    applyUrl: details.applyUrl,
    applyMethod: details.applyMethod,
    source,
    utmSource,
    utmMedium,
    utmCampaign,
    deviceType,
    timestamp: new Date().toISOString(),
    isInternal,
  };

  try {
    const bodyStr = JSON.stringify(eventPayload);
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
  } catch (err) {
    // Non-blocking telemetry
  }
}
