/* HOPELAND JOBS Service Worker — Real Web Push, Notification Deep-Linking, and Reconnect Sync */

const CACHE_NAME = 'hopelandjobs-shell-v8';
const APP_SHELL_URLS = [
  '/pwa-192x192.png',
  '/pwa-badge-96x96.png',
];

function isPreviewOrDevHost() {
  try {
    const h = (self.location && self.location.hostname || '').toLowerCase();
    return (
      h.includes('ais-dev-') ||
      h.includes('ais-pre-') ||
      h.endsWith('.run.app') ||
      h.endsWith('.usercontent.goog') ||
      h === 'localhost' ||
      h === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => (isPreviewOrDevHost() ? Promise.resolve() : cache.addAll(APP_SHELL_URLS).catch(() => {})))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => isPreviewOrDevHost() || k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Never intercept any requests inside AI Studio preview / dev environments
  if (isPreviewOrDevHost()) return;

  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept API calls (including /api/manifest.webmanifest & /api/pwa-icon/*), dev/Vite scripts, or third-party endpoints
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/__aistudio') ||
    url.pathname === '/_aistudio-iframe.js' ||
    url.pathname === '/warmup.html'
  ) {
    return;
  }

  // Network-first for HTML navigation; never cache redirects, non-OK, warmup, or Vite dev HTML
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response && response.type !== 'opaqueredirect' && response.ok && response.status === 200) {
            try {
              const previewClone = response.clone();
              const htmlText = await previewClone.text();
              const isDevOrWarmup =
                htmlText.includes('/@vite/client') ||
                htmlText.includes('<title>Starting Server...</title>') ||
                htmlText.includes('/warmup.html');
              if (!isDevOrWarmup) {
                const cacheClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put('/', cacheClone)).catch(() => {});
              }
            } catch {}
          }
          return response;
        })
        .catch(async () => {
          const fallback = (await caches.match(request)) || (await caches.match('/'));
          return fallback || Response.error();
        })
    );
    return;
  }

  // Stale-while-revalidate only for built static assets & hashed assets
  if (
    !url.search &&
    (url.pathname.endsWith('.png') ||
      url.pathname.startsWith('/assets/'))
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || fetched;
      })
    );
  }
});

// Real Web Push Handler (Mobile Status Bar & Desktop Notification Panel)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Hopeland Jobs · New Job Recommendation for You',
    body: 'A new job matching your profile and qualifications is open. Tap to view the details and apply.',
    url: '/',
    jobId: '',
    notificationId: '',
    tag: 'hopelandjobs-alert',
    badge: '/pwa-badge-96x96.png',
    icon: '/api/pwa-icon/pwa-192x192.png',
    actionType: 'open_job',
    topJobs: null,
    timestamp: Date.now(),
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    try {
      const text = event.data ? event.data.text() : '';
      if (text) payload.body = text;
    } catch {}
  }

  const jobId = payload.jobId || payload.vacancyId || '';
  const hasTopJobs = Array.isArray(payload.topJobs) && payload.topJobs.length > 0;
  const isRecommendationsDigest = payload.actionType === 'open_recommendations' || hasTopJobs;
  const defaultUrl = isRecommendationsDigest
    ? `/?view=top-recommendations${payload.notificationId ? `&notificationId=${encodeURIComponent(payload.notificationId)}` : ''}`
    : jobId
    ? `/?jobId=${encodeURIComponent(jobId)}&apply=1${payload.notificationId ? `&notificationId=${encodeURIComponent(payload.notificationId)}` : ''}`
    : '/';

  const primaryActionTitle =
    isRecommendationsDigest && Array.isArray(payload.topJobs) && payload.topJobs.length > 1
      ? `View Top ${payload.topJobs.length} & Apply`
      : 'View & Apply';

  const options = {
    body: payload.body,
    icon: payload.icon || '/api/pwa-icon/pwa-192x192.png',
    badge: payload.badge || '/pwa-badge-96x96.png',
    tag: payload.tag || (isRecommendationsDigest ? 'hopeland-inactive-top3' : jobId ? `vacancy-${jobId}` : 'hopelandjobs-alert'),
    renotify: true,
    requireInteraction: false,
    silent: false,
    timestamp: Number(payload.timestamp) || Date.now(),
    vibrate: [200, 80, 200],
    data: {
      url: payload.url || defaultUrl,
      jobId,
      vacancyId: jobId,
      notificationId: payload.notificationId || '',
      actionType: isRecommendationsDigest ? 'open_recommendations' : 'open_job',
      topJobs: hasTopJobs ? payload.topJobs : [],
    },
    actions: [
      { action: isRecommendationsDigest ? 'open_recommendations' : 'open_job', title: primaryActionTitle },
      { action: 'dismiss', title: 'Later' },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Notification Click Deep-Linking Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  const targetUrl = data.url || '/';
  const resolvedJobId = data.vacancyId || data.jobId || '';
  const resolvedNotifId = data.notificationId || '';
  const isRecommendationsTap =
    data.actionType === 'open_recommendations' ||
    event.action === 'open_recommendations' ||
    String(targetUrl).includes('view=top-recommendations');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      let targetOrigin = self.location.origin;
      try {
        targetOrigin = new URL(targetUrl, self.location.origin).origin;
      } catch {}

      if (targetOrigin === self.location.origin) {
        for (const client of clientsList) {
          try {
            const clientUrl = new URL(client.url);
            if (clientUrl.origin === self.location.origin && 'focus' in client) {
              if (isRecommendationsTap) {
                client.postMessage({
                  type: 'HOPELAND_OPEN_RECOMMENDATIONS_FROM_NOTIFICATION',
                  url: targetUrl,
                  notificationId: resolvedNotifId,
                  topJobs: Array.isArray(data.topJobs) ? data.topJobs : [],
                });
              } else {
                client.postMessage({
                  type: 'HOPELAND_OPEN_JOB_FROM_NOTIFICATION',
                  url: targetUrl,
                  jobId: resolvedJobId,
                  vacancyId: resolvedJobId,
                  notificationId: resolvedNotifId,
                });
              }
              return client.focus();
            }
          } catch {}
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

// Allow developer logo updates to purge stale cached manifest/icons immediately
self.addEventListener('message', (event) => {
  if (event.data?.type === 'HOPELAND_PURGE_ICON_CACHE') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const keys = await cache.keys();
        await Promise.all(
          keys
            .filter((req) => {
              const p = new URL(req.url).pathname;
              return (
                p.includes('manifest.webmanifest') ||
                p.includes('/api/pwa-icon/') ||
                p.includes('pwa-') ||
                p.includes('apple-touch-icon') ||
                p.includes('favicon-32x32')
              );
            })
            .map((req) => cache.delete(req))
        );
      })
    );
  }
});

// Background Sync on Internet Restoration
self.addEventListener('sync', (event) => {
  if (event.tag === 'hopeland-reconnect-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
        clientsList.forEach((client) => {
          client.postMessage({ type: 'HOPELAND_RECONNECT_SYNC_TRIGGER' });
        });
      })
    );
  }
});
