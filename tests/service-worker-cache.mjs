import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const projectRoot = resolve(import.meta.dirname, '..');
const serviceWorkerSource = readFileSync(resolve(projectRoot, 'sw.js'), 'utf8');
const appSource = readFileSync(resolve(projectRoot, 'app.js'), 'utf8');

function requestUrl(value) {
  return typeof value === 'string' ? value : value.url;
}

function comparableUrl(value, ignoreSearch = false) {
  const url = new URL(requestUrl(value));
  if (ignoreSearch) url.search = '';
  url.hash = '';
  return url.href;
}

class MemoryCache {
  constructor(storage, name) {
    this.storage = storage;
    this.name = name;
    this.entries = new Map();
  }

  async put(request, response) {
    this.storage.putCalls.push({ cacheName: this.name, url: requestUrl(request) });
    if (this.storage.rejectPut?.(this.name, request)) throw new Error('synthetischer cache.put-Fehler');
    this.entries.set(comparableUrl(request), response.clone());
  }

  async match(request, options = {}) {
    const wanted = comparableUrl(request, options.ignoreSearch);
    for (const [url, response] of this.entries) {
      if (comparableUrl(url, options.ignoreSearch) === wanted) return response.clone();
    }
    return undefined;
  }
}

class MemoryCacheStorage {
  constructor() {
    this.stores = new Map();
    this.deleteCalls = [];
    this.putCalls = [];
    this.rejectPut = null;
  }

  async open(name) {
    if (!this.stores.has(name)) this.stores.set(name, new MemoryCache(this, name));
    return this.stores.get(name);
  }

  async delete(name) {
    this.deleteCalls.push(name);
    return this.stores.delete(name);
  }

  async keys() {
    return [...this.stores.keys()];
  }
}

function createWorkerHarness({
  version = 'v6',
  caches = new MemoryCacheStorage(),
  scope = 'https://example.test/tagesz-hler/',
  timeoutMs = 20,
  fetchImpl = request => Promise.resolve(new Response(`asset:${requestUrl(request)}`))
} = {}) {
  const listeners = new Map();
  let currentFetch = fetchImpl;
  const self = {
    registration: { scope },
    addEventListener: (type, listener) => listeners.set(type, listener)
  };
  const source = serviceWorkerSource
    .replace(/const CACHE_VERSION = '[^']+';/, `const CACHE_VERSION = '${version}';`)
    .replace('const NAVIGATION_TIMEOUT_MS = 5000;', `const NAVIGATION_TIMEOUT_MS = ${timeoutMs};`);
  const context = vm.createContext({
    AbortController,
    Error,
    Promise,
    Request,
    Response,
    Set,
    URL,
    caches,
    clearTimeout,
    fetch: (...args) => currentFetch(...args),
    self,
    setTimeout
  });
  vm.runInContext(source, context);

  return {
    caches,
    scope,
    setFetch(nextFetch) {
      currentFetch = nextFetch;
    },
    async dispatchExtendable(type) {
      let lifetime;
      listeners.get(type)({ waitUntil: promise => { lifetime = Promise.resolve(promise); } });
      assert.ok(lifetime, `${type} muss event.waitUntil verwenden`);
      return lifetime;
    },
    async dispatchFetch(path, { mode = 'same-origin', method = 'GET' } = {}) {
      const controller = new AbortController();
      const request = { method, mode, signal: controller.signal, url: new URL(path, scope).href };
      let responsePromise;
      listeners.get('fetch')({
        request,
        respondWith: value => { responsePromise = Promise.resolve(value); }
      });
      return responsePromise ? responsePromise : null;
    }
  };
}

test('installiert nur eine vollständige App-Shell und nutzt relative Pages-Unterpfade', async () => {
  const requested = [];
  const worker = createWorkerHarness({
    fetchImpl: request => {
      requested.push(request.url);
      return Promise.resolve(new Response(`v6:${request.url}`));
    }
  });

  await worker.dispatchExtendable('install');

  assert.equal(requested.length, 12);
  assert.ok(requested.every(url => url.startsWith(worker.scope)));
  assert.equal(worker.caches.putCalls.length, 12);
  assert.deepEqual(await worker.caches.keys(), ['tageszaehler-v6']);
});

test('verwirft die Installation bei einem fehlenden Precache-Asset', async () => {
  const worker = createWorkerHarness({
    fetchImpl: request => Promise.resolve(new Response(
      request.url.endsWith('/app.js') ? 'fehlt' : 'ok',
      { status: request.url.endsWith('/app.js') ? 404 : 200 }
    ))
  });

  await assert.rejects(worker.dispatchExtendable('install'), /App-Shell-Asset nicht verfügbar/);
  assert.deepEqual(await worker.caches.keys(), []);
  assert.equal(worker.caches.deleteCalls.at(-1), 'tageszaehler-v6');
});

test('bindet abgelehntes cache.put an die Installation und räumt den Teilcache auf', async () => {
  const caches = new MemoryCacheStorage();
  caches.rejectPut = (_name, request) => request.url.endsWith('/styles.css');
  const worker = createWorkerHarness({ caches });

  await assert.rejects(worker.dispatchExtendable('install'), /synthetischer cache\.put-Fehler/);
  assert.deepEqual(await caches.keys(), []);
  assert.equal(caches.deleteCalls.at(-1), 'tageszaehler-v6');
});

test('hält Version N aktiv, während N+1 mit mehreren offenen Clients wartet', async () => {
  const caches = new MemoryCacheStorage();
  const workerN = createWorkerHarness({
    version: 'v-test-n',
    caches,
    fetchImpl: request => Promise.resolve(new Response(`N:${request.url}`))
  });
  await workerN.dispatchExtendable('install');
  await workerN.dispatchExtendable('activate');

  const firstClient = await workerN.dispatchFetch('./', { mode: 'navigate' });
  const secondClientScript = await workerN.dispatchFetch('./app.js');
  assert.match(await firstClient.text(), /^N:/);
  assert.match(await secondClientScript.text(), /^N:/);

  const workerNext = createWorkerHarness({
    version: 'v-test-next',
    caches,
    fetchImpl: request => Promise.resolve(new Response(`N+1:${request.url}`))
  });
  await workerNext.dispatchExtendable('install');

  const stillOldHtml = await workerN.dispatchFetch('./', { mode: 'navigate' });
  const stillOldScript = await workerN.dispatchFetch('./app.js?erneut=1');
  assert.match(await stillOldHtml.text(), /^N:/);
  assert.match(await stillOldScript.text(), /^N:/);

  await workerNext.dispatchExtendable('activate');
  const newHtml = await workerNext.dispatchFetch('./', { mode: 'navigate' });
  const newScript = await workerNext.dispatchFetch('./app.js');
  assert.match(await newHtml.text(), /^N\+1:/);
  assert.match(await newScript.text(), /^N\+1:/);
  assert.deepEqual(await caches.keys(), ['tageszaehler-v-test-next']);
});

test('liefert Navigation bei HTTP 503, Netzabbruch und hängendem Netz sofort aus der aktiven Shell', async () => {
  const worker = createWorkerHarness();
  await worker.dispatchExtendable('install');

  const failures = [
    () => Promise.resolve(new Response('nicht verfügbar', { status: 503 })),
    () => Promise.reject(new Error('synthetischer Netzabbruch')),
    () => new Promise(() => {})
  ];
  for (const failure of failures) {
    let networkCalls = 0;
    worker.setFetch(request => {
      networkCalls += 1;
      return failure(request);
    });
    const response = await worker.dispatchFetch('./beliebiger-direktzugriff', { mode: 'navigate' });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /index\.html/);
    assert.equal(networkCalls, 0);
  }
});

test('begrenzt Laufzeitzugriffe auf das Netz und schreibt sie nicht in den Cache', async () => {
  const worker = createWorkerHarness();
  await worker.dispatchExtendable('install');
  const putsAfterInstall = worker.caches.putCalls.length;

  const response = await worker.dispatchFetch('./nicht-zur-shell.json');

  assert.equal(response, null);
  assert.equal(worker.caches.putCalls.length, putsAfterInstall);
});

test('startet nach erfolgreichem Erstladen offline aus demselben Versionscache neu', async () => {
  const worker = createWorkerHarness();
  await worker.dispatchExtendable('install');
  worker.setFetch(() => Promise.reject(new Error('offline')));

  const html = await worker.dispatchFetch('./', { mode: 'navigate' });
  const css = await worker.dispatchFetch('./styles.css');
  const script = await worker.dispatchFetch('./app.js');

  assert.equal(html.status, 200);
  assert.equal(css.status, 200);
  assert.equal(script.status, 200);
});

test('begrenzt die Netzrettung bei fehlender Shell zeitlich', async () => {
  const worker = createWorkerHarness({ timeoutMs: 10 });
  worker.setFetch((_request, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('abgebrochen')), { once: true });
  }));

  const response = await worker.dispatchFetch('./', { mode: 'navigate' });

  assert.equal(response.status, 503);
});

test('behält den wartenden Update-Ablauf und die enge Trusted-Types-Policy bei', () => {
  assert.doesNotMatch(serviceWorkerSource, /\bskipWaiting\s*\(/);
  assert.doesNotMatch(serviceWorkerSource, /\bcaches\.match\s*\(/);
  assert.match(appSource, /createPolicy\('tageszaehler-sw'/);
  assert.match(appSource, /const source = '\.\/sw\.js';/);
  assert.match(appSource, /Schließen aller App-Tabs aktiviert/);
  assert.match(appSource, /Offene Eingaben bleiben erhalten/);
});
