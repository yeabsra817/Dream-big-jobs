/* HOPELAND JOBS Service Worker — Real Web Push, Notification Deep-Linking, and Reconnect Sync */

const CACHE_NAME = 'hopelandjobs-shell-v1';
const APP_SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS).catch(() => {}))
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
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache API calls, dev scripts, or third-party endpoints
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // Network-first for HTML navigation so fresh deploys are always picked up immediately
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', clone)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/') || caches.match(request))
    );
    return;
  }

  // Stale-while-revalidate for static assets & icons
  if (
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.startsWith('/assets/')
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
          .catch(() => cached);
        return cached || fetched;
      })
    );
  }
});

// Real Web Push Handler
self.addEventListener('push', (event) => {
  let payload = {
    title: 'HOPELAND JOBS — New Matching Vacancy',
    body: 'A verified job matching your professional profile has just been published.',
    url: '/',
    jobId: '',
    tag: 'hopelandjobs-alert',
    badge: '/pwa-192x192.png',
    icon: '/pwa-192x192.png',
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

  const options = {
    body: payload.body,
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    tag: payload.tag || (payload.jobId ? `vacancy-${payload.jobId}` : 'hopelandjobs-alert'),
    renotify: true,
    requireInteraction: false,
    data: {
      url: payload.url || (payload.jobId ? `/?jobId=${encodeURIComponent(payload.jobId)}` : '/'),
      jobId: payload.jobId || '',
    },
    actions: [
      { action: 'open_job', title: 'View Vacancy' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Notification Click Deep-Linking Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin && 'focus' in client) {
            client.postMessage({
              type: 'HOPELAND_OPEN_JOB_FROM_NOTIFICATION',
              url: targetUrl,
              jobId: event.notification.data?.jobId || '',
            });
            return client.focus();
          }
        } catch {}
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
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
