import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const app = readFileSync(resolve(root, 'app.js'), 'utf8');
const theme = readFileSync(resolve(root, 'theme.js'), 'utf8');
const constants = app.slice(0, app.indexOf('const DATA_LIMITS ='));
const architecture = app.slice(app.indexOf('class EventRepository {'), app.indexOf('/* ── UI CONTROLLER ── */'));
const preferences = app.slice(app.indexOf('function safeStorageGet('), app.indexOf('function applyPreferences('));
const legacyPreferences = app.slice(app.indexOf('const LEGACY_PREFERENCE_VALUES ='), app.indexOf('function importRecoveryFile('));

class Storage {
  constructor() {
    this.data = new Map([['other-project', 'unverändert']]);
    this.failKey = null;
    this.readFailKey = null;
    this.afterWrite = null;
  }
  getItem(key) {
    if (key === this.readFailKey) throw new Error('synthetischer Lesefehler');
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    if (key === this.failKey) throw new DOMException('synthetisch voll', 'QuotaExceededError');
    this.data.set(key, String(value));
    this.afterWrite?.(key);
  }
  removeItem(key) { this.data.delete(key); }
}

class Locks {
  constructor() { this.calls = []; }
  async request(name, options, callback) {
    this.calls.push({ name, mode: options.mode });
    return callback();
  }
}

function hashString(value) {
  let fnv = 0x811c9dc5;
  let djb = 5381;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    fnv ^= code;
    fnv = Math.imul(fnv, 0x01000193);
    djb = Math.imul(djb, 33) ^ code;
  }
  return `${value.length.toString(36)}-${(fnv >>> 0).toString(16).padStart(8, '0')}-${(djb >>> 0).toString(16).padStart(8, '0')}`;
}

function fixture(path, storage = new Storage(), locks = new Locks(), channels = null) {
  const script = `https://example.test${path}app.js`;
  const window = {
    localStorage: storage,
    navigator: locks ? { locks } : {},
    BroadcastChannel: channels || undefined,
    addEventListener() {},
    removeEventListener() {}
  };
  const context = vm.createContext({
    console: { warn() {}, error() {} }, JSON, Date, URL, DOMException, TextEncoder,
    document: { currentScript: { src: script } }, window, localStorage: storage,
    DATA_LIMITS: { maxEventDataBytes: 1024 * 1024, maxQuarantineRawChars: 10000, maxQuarantineEntries: 5 },
    createEventId: () => 'synthetic-id', hashString,
    isQuotaExceededError: error => error?.name === 'QuotaExceededError',
    normalizeEventCollection: events => Array.isArray(events)
      ? { ok: true, events: events.filter(item => typeof item?.name === 'string'), invalidCount: events.filter(item => typeof item?.name !== 'string').length }
      : { ok: false, code: 'invalid' },
    serializeEventCollection: (events, formatted) => JSON.stringify(events, null, formatted ? 2 : undefined),
    utf8ByteLength: value => new TextEncoder().encode(value).byteLength,
    freezeEvents: events => Object.freeze(events.map(item => Object.freeze({ ...item }))),
    eventsEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  });
  vm.runInContext(`${constants}\n${architecture}\nthis.Repository=EventRepository; this.Store=EventStore; this.Sync=EventSync; this.keys=STORAGE_KEYS; this.legacyKeys=LEGACY_STORAGE_KEYS; this.lockName=EVENT_WRITE_LOCK_NAME; this.channelName=EVENT_CHANNEL_NAME; this.prefKey=preferenceKey;`, context);
  const repository = new context.Repository();
  const store = new context.Store(repository, repository.loadCurrent());
  return { context, repository, store, storage, locks, window };
}

test('zwei Unterpfade trennen Ereignisse, Präferenzen, Lock und Channel', async () => {
  const storage = new Storage();
  const locks = new Locks();
  const a = fixture('/a/', storage, locks);
  const b = fixture('/b/', storage, locks);
  assert.notEqual(a.context.keys.events, b.context.keys.events);
  assert.notEqual(a.context.prefKey('theme'), b.context.prefKey('theme'));
  assert.notEqual(a.context.lockName, b.context.lockName);
  assert.notEqual(a.context.channelName, b.context.channelName);
  for (const context of [a.context, b.context]) {
    context.showSnackbar = () => {};
    vm.runInContext(preferences, context);
  }
  assert.equal(a.context.persistPreference('theme', 'dark').ok, true);
  assert.equal(b.context.persistPreference('theme', 'light').ok, true);
  assert.equal(storage.getItem(a.context.prefKey('theme')), 'dark');
  assert.equal(storage.getItem(b.context.prefKey('theme')), 'light');
  assert.equal((await a.store.upsert({ id: 'a', name: 'A' })).ok, true);
  assert.equal((await b.store.upsert({ id: 'b', name: 'B' })).ok, true);
  assert.deepEqual(JSON.parse(storage.getItem(a.context.keys.events)), [{ id: 'a', name: 'A' }]);
  assert.deepEqual(JSON.parse(storage.getItem(b.context.keys.events)), [{ id: 'b', name: 'B' }]);
  assert.deepEqual(locks.calls.map(call => call.name), [a.context.lockName, b.context.lockName]);
  assert.equal(storage.getItem('other-project'), 'unverändert');
});

test('Theme-Start verwendet denselben kanonischen Pfad bei Verzeichnis, index.html und Query', () => {
  const storage = new Storage();
  storage.setItem('tageszaehler:%2Fa%2F:theme', 'dark');
  storage.setItem('tageszaehler:%2Fa%2F:color', 'green');
  storage.setItem('theme', 'light');
  for (const page of ['/a/', '/a/index.html?x=1#y']) {
    const root = { dataset: {} };
    vm.runInNewContext(theme, {
      document: { documentElement: root, currentScript: { src: 'https://example.test/a/theme.js' } },
      localStorage: storage, URL
    });
    assert.equal(root.dataset.theme, 'dark', page);
    assert.equal(root.dataset.color, 'green', page);
    assert.equal(root.dataset.view, 'cards', page);
  }
});

test('alte gemeinsame Rohquelle wird nur ausdrücklich und einmalig unter beiden Locks übernommen', async () => {
  const storage = new Storage();
  const raw = JSON.stringify([{ id: 'alt', name: 'Alt' }]);
  storage.setItem('events', raw);
  const a = fixture('/a/', storage);
  assert.deepEqual(Array.from(a.store.getEvents()), []);
  const sources = a.repository.readRecoverySources().sources;
  assert.equal(sources.find(source => source.id === 'legacy-active').raw, raw);
  const result = await a.store.migrateLegacy('legacy-active', raw, [{ id: 'alt', name: 'Alt' }]);
  assert.equal(result.ok, true);
  assert.deepEqual(a.locks.calls.map(call => call.name), ['tageszaehler-events-v2-write', a.context.lockName]);
  assert.equal(storage.getItem('events'), raw);
  assert.equal((await a.store.migrateLegacy('legacy-active', raw, [{ id: 'alt', name: 'Alt' }])).code, 'target-not-empty');
  assert.deepEqual(JSON.parse(storage.getItem(a.context.keys.events)), [{ id: 'alt', name: 'Alt' }]);
  assert.equal(storage.getItem('other-project'), 'unverändert');
});

test('Migration bricht bei Quellenänderung, Quota, Ziellesefehler und fehlendem Lock ohne Zielschreiben ab', async () => {
  const raw = JSON.stringify([{ id: 'alt', name: 'Alt' }]);
  for (const mode of ['changed', 'quota', 'read-error', 'no-lock']) {
    const storage = new Storage();
    storage.setItem('events', raw);
    const a = fixture('/a/', storage, mode === 'no-lock' ? null : new Locks());
    if (mode === 'changed') storage.setItem('events', '[]');
    if (mode === 'quota') storage.failKey = a.context.keys.events;
    if (mode === 'read-error') storage.readFailKey = a.context.keys.events;
    const result = await a.store.migrateLegacy('legacy-active', raw, [{ id: 'alt', name: 'Alt' }]);
    assert.equal(result.ok, false, mode);
    storage.readFailKey = null;
    assert.equal(storage.getItem(a.context.keys.events), null, mode);
    assert.equal(storage.getItem('other-project'), 'unverändert');
  }
});

test('nach einem nicht kooperierenden Alt-Tab-Schreiben wird Teilpersistierung ausdrücklich erkannt', async () => {
  const storage = new Storage();
  const raw = JSON.stringify([{ id: 'alt', name: 'Alt' }]);
  storage.setItem('events', raw);
  const a = fixture('/a/', storage);
  storage.afterWrite = key => {
    if (key === a.context.keys.events) storage.data.set('events', '[{"id":"neu","name":"Alt-Tab"}]');
  };
  const result = await a.store.migrateLegacy('legacy-active', raw, [{ id: 'alt', name: 'Alt' }]);
  assert.equal(result.code, 'legacy-source-raced-after-write');
  assert.equal(result.persisted, true);
  assert.deepEqual(a.store.getEvents().map(item => item.id), ['alt']);
  assert.equal(storage.getItem('events').includes('neu'), true);
});

test('alter Kanal und alter Storage-Schlüssel sperren Schreiben, ohne fremde Installation zu laden', () => {
  const storage = new Storage();
  const channels = new Map();
  class Channel {
    constructor(name) { this.name = name; channels.set(name, this); }
    addEventListener(_type, callback) { this.callback = callback; }
    close() {}
    postMessage() {}
  }
  const a = fixture('/a/', storage, new Locks(), Channel);
  const sync = new a.context.Sync(a.repository, 'tab-a');
  let legacy = 0, reload = 0;
  sync.start(() => { reload++; }, () => { legacy++; a.store.blockWritesForLegacyPeer(); });
  channels.get('tageszaehler-events-v2').callback({ data: { type: 'events-updated' } });
  assert.equal(legacy, 1);
  assert.equal(reload, 0);
  assert.equal(a.store.legacyPeerDetected, true);
  sync.onStorage({ key: 'events' });
  assert.equal(legacy, 2);
  assert.equal(reload, 0);
  sync.stop();
});

test('fehlgeschlagene Präferenzpersistierung gibt Status und dezenten Hinweis trotz sichtbarer Auswahl', () => {
  const storage = new Storage();
  const a = fixture('/a/', storage);
  const messages = [];
  a.context.showSnackbar = message => messages.push(message);
  vm.runInContext(preferences, a.context);
  a.context.persist = name => a.context.persistPreference(name, 'dark');
  storage.failKey = a.context.prefKey('theme');
  const failed = a.context.persist('theme');
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'quota');
  assert.match(messages[0], /nur in diesem Tab/);
  assert.equal(storage.getItem(a.context.prefKey('theme')), null);
  storage.failKey = null;
  assert.equal(a.context.persist('theme').ok, true);
  assert.equal(storage.getItem(a.context.prefKey('theme')), 'dark');
});

test('ausbleibendes Read-back einer Einstellung wird nicht als gespeichert bestätigt', () => {
  const storage = new Storage();
  const a = fixture('/a/', storage);
  a.context.showSnackbar = () => {};
  vm.runInContext(preferences, a.context);
  storage.afterWrite = key => {
    if (key === a.context.prefKey('view')) storage.data.delete(key);
  };
  assert.equal(a.context.persistPreference('view', 'compact').code, 'read-back');
  assert.equal(storage.getItem(a.context.prefKey('view')), null);
});

test('alte Einstellungen brauchen Bestätigung, überspringen bestehende Werte und bleiben erhalten', async () => {
  const storage = new Storage();
  storage.setItem('theme', 'dark');
  storage.setItem('color', 'green');
  const a = fixture('/a/', storage);
  storage.setItem(a.context.prefKey('theme'), 'light');
  let action;
  a.context.requestRecoveryConfirmation = (_message, callback) => { action = callback; };
  a.context.setRecoveryMessage = () => {};
  a.context.applyPreferences = () => {};
  a.context.showSnackbar = () => {};
  vm.runInContext(`${preferences}\n${legacyPreferences}`, a.context);
  a.context.prepareLegacyPreferences();
  assert.equal(storage.getItem(a.context.prefKey('color')), null, 'vor Bestätigung keine Übernahme');
  const result = await action();
  assert.equal(result.ok, true);
  assert.equal(storage.getItem(a.context.prefKey('theme')), 'light');
  assert.equal(storage.getItem(a.context.prefKey('color')), 'green');
  assert.equal(storage.getItem('theme'), 'dark');
  assert.equal(storage.getItem('color'), 'green');
});
