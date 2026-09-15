/* Offline-App-Shell. CACHE_VERSION bei Änderungen an statischen Dateien erhöhen. */
const CACHE_VERSION = 'v11';
const scopeUrl = new URL(self.registration.scope);
const CACHE_PREFIX = `tageszaehler:${encodeURIComponent(scopeUrl.pathname)}:shell-`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const LEGACY_CACHE_PREFIX = 'tageszaehler-v';
const NAVIGATION_TIMEOUT_MS = 5000;
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './theme.js',
  './app.js',
  './manifest.webmanifest',
  './icons/favicon-32.png',
  './icons/apple-touch-icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

const appShellRequests = APP_SHELL.map(path => new Request(new URL(path, scopeUrl), { cache: 'reload' }));
const appShellUrls = new Set(appShellRequests.map(request => request.url));
const navigationFallbackUrl = new URL('./index.html', scopeUrl).href;

async function installAppShell() {
  await caches.delete(CACHE_NAME);
  const cache = await caches.open(CACHE_NAME);

  try {
    for (const request of appShellRequests) {
      const response = await fetch(request);
      if (!response.ok) throw new Error(`App-Shell-Asset nicht verfügbar: ${request.url} (${response.status})`);
      await cache.put(request, response);
    }

    const cachedResponses = await Promise.all(appShellRequests.map(request => cache.match(request)));
    if (cachedResponses.some(response => !response)) throw new Error('App-Shell wurde nicht vollständig gespeichert.');
  } catch (error) {
    await caches.delete(CACHE_NAME);
    throw error;
  }
}

async function activateAppShell() {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
  // Alte globale Caches nur dann entfernen, wenn ihre Inhalte eindeutig zu diesem Scope gehören.
  for (const key of keys.filter(key => key.startsWith(LEGACY_CACHE_PREFIX))) {
    try {
      const cache = await caches.open(key);
      const requests = await cache.keys();
      if (requests.length && requests.every(request => {
        const url = new URL(request.url);
        return url.origin === scopeUrl.origin && url.pathname.startsWith(scopeUrl.pathname);
      })) await caches.delete(key);
    } catch (error) {
      console.warn('Alter Cache konnte nicht eindeutig geprüft werden; er bleibt erhalten.', error);
    }
  }
}

async function matchActiveShell(requestOrUrl) {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(requestOrUrl, { ignoreSearch: true });
}

function unavailableResponse() {
  return new Response('Die App-Shell ist derzeit nicht verfügbar.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const abortFromRequest = () => controller.abort(request.signal.reason);
  if (request.signal.aborted) abortFromRequest();
  else request.signal.addEventListener('abort', abortFromRequest, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener('abort', abortFromRequest);
  }
}

async function handleNavigation(request) {
  const cachedResponse = await matchActiveShell(navigationFallbackUrl);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    return networkResponse.ok ? networkResponse : unavailableResponse();
  } catch {
    return unavailableResponse();
  }
}

async function handleAppShellRequest(request) {
  return (await matchActiveShell(request)) || unavailableResponse();
}

self.addEventListener('install', event => {
  event.waitUntil(installAppShell());
});

self.addEventListener('activate', event => {
  event.waitUntil(activateAppShell());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== scopeUrl.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  url.search = '';
  url.hash = '';
  if (appShellUrls.has(url.href)) {
    event.respondWith(handleAppShellRequest(request));
  }
});
