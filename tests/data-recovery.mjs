import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const app = readFileSync(resolve(root, 'app.js'), 'utf8');
const start = app.indexOf('class EventRepository {');
const end = app.indexOf('/* ── CROSS-TAB SYNCHRONIZATION ── */');
assert.ok(start > 0 && end > start);
const architecture = app.slice(start, end);

function checksum(raw) {
  let fnv = 0x811c9dc5;
  let djb = 5381;
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    fnv ^= code;
    fnv = Math.imul(fnv, 0x01000193);
    djb = Math.imul(djb, 33) ^ code;
  }
  return `${raw.length.toString(36)}-${(fnv >>> 0).toString(16).padStart(8, '0')}-${(djb >>> 0).toString(16).padStart(8, '0')}`;
}

class Storage {
  constructor(raw) {
    this.values = new Map();
    if (raw !== null) this.values.set('events', raw);
    this.readFailure = null;
    this.writeFailureKey = null;
    this.removeFailureKey = null;
  }
  getItem(key) {
    if (this.readFailure === key) throw new Error('synthetischer Lesefehler');
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.writeFailureKey === key) throw new DOMException('synthetisch voll', 'QuotaExceededError');
    this.values.set(key, String(value));
  }
  removeItem(key) {
    if (this.removeFailureKey === key) throw new Error('synthetische Löschsperre');
    this.values.delete(key);
  }
}

function fixture(raw, { locks = true } = {}) {
  const storage = new Storage(raw);
  const calls = [];
  const lockManager = { request: async (name, options, callback) => {
    calls.push({ name, mode: options.mode });
    return callback();
  } };
  let nextId = 0;
  const context = vm.createContext({
    console: { warn() {}, error() {} },
    JSON, Date, DOMException, TextEncoder,
    window: { localStorage: storage, navigator: locks ? { locks: lockManager } : {} },
    STORAGE_KEYS: { events: 'events', quarantine: 'quarantine', quarantineMeta: 'quarantine-meta' },
    DATA_LIMITS: { maxEventDataBytes: 1024 * 1024, maxQuarantineRawChars: 10000, maxQuarantineEntries: 5 },
    DATA_SCHEMA_VERSION: 2, EVENT_WRITE_LOCK_NAME: 'tageszaehler-events-v2-write',
    createEventId: () => `synthetic-${++nextId}`,
    hashString: checksum,
    isQuotaExceededError: error => error?.name === 'QuotaExceededError',
    normalizeEventCollection: events => {
      if (!Array.isArray(events)) return { ok: false, events: [], invalidCount: 0, code: 'not-an-array' };
      const valid = events.filter(event => event && typeof event.name === 'string');
      return { ok: true, events: valid, invalidCount: events.length - valid.length };
    },
    serializeEventCollection: (events, formatted) => JSON.stringify(events, null, formatted ? 2 : undefined),
    utf8ByteLength: value => new TextEncoder().encode(value).byteLength,
    freezeEvents: events => Object.freeze(events.map(event => Object.freeze({ ...event }))),
    eventsEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  });
  vm.runInContext(`${architecture}\nthis.Repository = EventRepository; this.Store = EventStore;`, context);
  const repository = new context.Repository();
  const snapshot = repository.loadCurrent();
  const store = new context.Store(repository, snapshot);
  return { repository, store, snapshot, storage, calls };
}

test('unlesbares JSON bleibt aktiv und wird als unveränderte Rettungskopie exportierbar', () => {
  const raw = '{kaputt';
  const { repository, snapshot, store, storage } = fixture(raw);
  assert.equal(snapshot.ok, false);
  assert.equal(store.state.writeProtected, true);
  assert.equal(storage.getItem('events'), raw);
  const sources = repository.readRecoverySources().sources;
  assert.deepEqual(Array.from(sources, source => source.raw), [raw, raw]);
});

test('teilweise ungültige Ereignisse sperren stille Mutation; Rohkopie bleibt nach Wiederherstellung', async () => {
  const raw = JSON.stringify([{ id: 'a', name: 'Gültig' }, { id: 'b', invalid: true }]);
  const { repository, snapshot, store, storage, calls } = fixture(raw);
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.invalidCount, 1);
  assert.equal(store.state.loadState, 'partial');
  assert.equal((await store.upsert({ id: 'c', name: 'Neu' })).code, 'write-protected');
  const result = await store.recoverReplaceAll(snapshot.events, raw);
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(storage.getItem('events')), [{ id: 'a', name: 'Gültig' }]);
  assert.equal(repository.readRecoverySources().sources.filter(source => source.id.startsWith('copy:')).length, 1);
  assert.ok(calls.every(call => call.mode === 'exclusive' && call.name === 'tageszaehler-events-v2-write'));
});

test('nicht schreibbare Quarantäne sperrt Mutation und lässt aktives Original exportierbar', async () => {
  const { repository, storage, store } = fixture(JSON.stringify([{ invalid: true }]));
  storage.values.delete('quarantine');
  storage.writeFailureKey = 'quarantine';
  const snapshot = repository.loadCurrent();
  assert.equal(snapshot.writeProtected, true);
  assert.equal(repository.readRecoverySources().sources.length, 1);
  assert.equal((await store.recoverReplaceAll([], storage.getItem('events'))).ok, true);
});

test('mehrfache identische Fehler erzeugen keine zusätzlichen Rohkopien', () => {
  const { repository, storage } = fixture('{defekt');
  repository.loadCurrent();
  repository.loadCurrent();
  assert.equal(JSON.parse(storage.getItem('quarantine')).entries.length, 1);
});

test('gültige Daten mit gleicher Revision heben vorübergehenden Schreibschutz auf', async () => {
  const raw = JSON.stringify([{ id: 'a', name: 'Aktiv' }]);
  const { repository, store, storage } = fixture(raw);
  const revision = store.state.revision;
  storage.readFailure = 'events';
  store.protectAfterExternalLoadFailure(repository.loadCurrent(), 'storage-error');
  assert.equal(store.state.revision, revision);
  assert.equal(store.state.loadState, 'read-error');
  storage.readFailure = null;
  const result = store.applyExternal(repository.loadCurrent(), 'storage');
  assert.equal(result.ok, true);
  assert.equal(store.state.revision, revision);
  assert.equal(store.state.writeProtected, false);
  assert.equal((await store.upsert({ id: 'b', name: 'Wieder möglich' })).ok, true);
});

test('Wiederherstellung bricht bei geändertem aktivem Rohbestand und ohne Lock ab', async () => {
  const raw = '{defekt';
  const { store, storage } = fixture(raw);
  storage.setItem('events', JSON.stringify([{ id: 'x', name: 'Anderer Tab' }]));
  assert.equal((await store.recoverReplaceAll([{ id: 'a', name: 'Rettung' }], raw)).code, 'collection-conflict');
  assert.equal(JSON.parse(storage.getItem('events'))[0].id, 'x');
  const noLock = fixture(raw, { locks: false });
  assert.equal((await noLock.store.recoverReplaceAll([], raw)).code, 'lock-unavailable');
  assert.equal(noLock.storage.getItem('events'), raw);
});

test('Quota-Fehler beim Rettungsschreiben bestätigt keinen Erfolg und bewahrt Quellen', async () => {
  const raw = '{defekt';
  const { store, storage } = fixture(raw);
  const copies = storage.getItem('quarantine');
  storage.writeFailureKey = 'events';
  const result = await store.recoverReplaceAll([{ id: 'a', name: 'Rettung' }], raw);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'quota');
  assert.equal(storage.getItem('events'), raw);
  assert.equal(storage.getItem('quarantine'), copies);
});

test('gezielte Löschung lässt aktive Ereignisse und fremde Schlüssel unangetastet', async () => {
  const { repository, storage } = fixture('{defekt');
  storage.setItem('theme', 'dark');
  const copies = storage.getItem('quarantine');
  const metadata = storage.getItem('quarantine-meta');
  const result = await repository.deleteRecoveryCopies(copies, metadata);
  assert.equal(result.ok, true);
  assert.equal(storage.getItem('events'), '{defekt');
  assert.equal(storage.getItem('theme'), 'dark');
  assert.equal(storage.getItem('quarantine'), null);
});

test('abgebrochene und fehlgeschlagene Löschvarianten melden verbliebene Kopien', async () => {
  const { repository, storage, store } = fixture('{defekt');
  const copies = storage.getItem('quarantine');
  storage.removeFailureKey = 'quarantine';
  const failed = await repository.deleteRecoveryCopies(copies, null);
  assert.equal(failed.ok, false);
  assert.equal(failed.remaining[0].present, true);
  assert.equal(storage.getItem('quarantine'), copies);
  assert.equal(storage.getItem('events'), '{defekt');
  storage.removeFailureKey = null;
  storage.setItem('quarantine', '{anderer-tab');
  const conflict = await repository.deleteRecoveryCopies(copies, null);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.remaining[0].present, true);
  assert.equal(storage.getItem('quarantine'), '{anderer-tab');
  assert.equal((await store.recoverReplaceAll([], '{defekt')).ok, true);
  assert.equal(storage.getItem('quarantine'), '{anderer-tab', 'aktive Löschung löscht Kopien nicht still');
});

test('Rettungsdialog besitzt eindeutige Labels, Fokusziele und Abbrechen', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  for (const id of ['recovery-heading', 'recovery-source', 'recovery-message', 'recovery-confirm-btn', 'recovery-cancel-btn', 'recovery-close-btn']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /<dialog[^>]+aria-labelledby="recovery-heading"/);
  assert.match(app, /recoveryDialog\.showModal\(\)/);
  assert.match(app, /recoveryDialog\.addEventListener\('close'/);
  assert.match(app, /restoreModalFocus\(recoveryReturnFocus\)/);
  assert.match(app, /function cancelRecoveryConfirmation\(\) \{\s*recoveryPendingAction = null;/);
  assert.match(app, /document\.getElementById\('recovery-cancel-btn'\)\.focus\(\)/);
  assert.match(app, /function handleGlobalKeydown\(event\) \{\s*if \(recoveryDialog\.open \|\| aboutDialog\.open\) return;/);
});
