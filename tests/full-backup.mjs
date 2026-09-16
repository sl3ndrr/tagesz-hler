import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const app = readFileSync(resolve(root, 'app.js'), 'utf8');
const theme = readFileSync(resolve(root, 'theme.js'), 'utf8');
const helperStart = app.indexOf('/* ── VERSIONED FULL BACKUP & RESTORE JOURNAL ── */');
const helperEnd = app.indexOf('/* ── STORAGE REPOSITORY ── */');
const repositoryStart = app.indexOf('class EventRepository {');
const repositoryEnd = app.indexOf('/* ── EVENT STORE ── */');

assert.notEqual(helperStart, -1, 'Backup-Helfer fehlen');
assert.notEqual(helperEnd, -1, 'Ende der Backup-Helfer fehlt');
assert.notEqual(repositoryStart, -1, 'EventRepository fehlt');
assert.notEqual(repositoryEnd, -1, 'Ende des Repository-Abschnitts fehlt');

class Storage {
  constructor(entries = []) {
    this.data = new Map(entries);
    this.writes = new Map();
    this.failOnWrite = new Map();
  }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) {
    const count = (this.writes.get(key) || 0) + 1;
    this.writes.set(key, count);
    if (this.failOnWrite.get(key) === count) {
      throw new DOMException('synthetisch voll', 'QuotaExceededError');
    }
    this.data.set(key, String(value));
  }
  removeItem(key) { this.data.delete(key); }
}

class Locks {
  async request(_name, _options, callback) { return callback(); }
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${value.length.toString(36)}-${(hash >>> 0).toString(16)}`;
}

function fixture() {
  const namespace = 'tageszaehler:%2Ftest%2F:';
  const keys = {
    events: `${namespace}events`,
    quarantine: `${namespace}events:quarantine:v1`,
    quarantineMeta: `${namespace}events:quarantine-meta:v1`,
    backupRestore: `${namespace}backup-restore:v1`
  };
  const storage = new Storage();
  const window = { localStorage: storage, navigator: { locks: new Locks() } };
  const context = vm.createContext({
    Array, Date, DOMException, Error, JSON, Math, Number, Object, Set, String, TextEncoder,
    console: { warn() {}, error() {} },
    document: { documentElement: { dataset: { theme: 'dark', color: 'green', view: 'compact' } } },
    window,
    localStorage: storage,
    BACKUP_FORMAT: 'tageszaehler-backup',
    BACKUP_VERSION: 1,
    BACKUP_PREFERENCE_VALUES: Object.freeze({
      theme: ['system', 'light', 'dark'],
      color: ['purple', 'blue', 'green', 'orange'],
      view: ['cards', 'compact']
    }),
    DATA_LIMITS: { maxBackupBytes: 10 * 1024 * 1024, maxEventDataBytes: 8 * 1024 * 1024 },
    STORAGE_KEYS: keys,
    LEGACY_STORAGE_KEYS: { events: 'events', quarantine: 'quarantine', quarantineMeta: 'quarantine-meta' },
    DATA_SCHEMA_VERSION: 2,
    EVENT_WRITE_LOCK_NAME: `${namespace}events-v2-write`,
    preferenceKey: name => `${namespace}${name}`,
    normalizeEventCollection(events) {
      if (!Array.isArray(events)) return { ok: false, code: 'events', events: [], invalidCount: 0 };
      const valid = events.filter(event => event && event.valid === true && typeof event.id === 'string');
      return {
        ok: true,
        events: valid.map(event => ({ ...event })),
        invalidCount: events.length - valid.length
      };
    },
    serializeEventCollection: events => JSON.stringify(events),
    utf8ByteLength: value => new TextEncoder().encode(value).byteLength,
    hashString,
    isQuotaExceededError: error => error?.name === 'QuotaExceededError',
    createEventId: () => 'synthetic-id',
    freezeEvents: events => events,
    eventsEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right)
  });
  const helpers = app.slice(helperStart, helperEnd);
  const repository = app.slice(repositoryStart, repositoryEnd);
  vm.runInContext(`${helpers}\n${repository}\nthis.Repository = EventRepository; this.api = { createFullBackupDocument, validateFullBackupDocument, readBackupRestoreJournal, rollbackBackupRestoreJournal, recoverInterruptedBackupRestore }; `, context);
  return { context, storage, keys };
}

function event(id = 'synthetic-event', overrides = {}) {
  return { id, valid: true, name: 'Synthetisch 😀', ...overrides };
}

function preferences(overrides = {}) {
  return { theme: 'dark', color: 'green', view: 'compact', ...overrides };
}

test('exportiert und validiert Ereignisse samt Theme, Farbe und Ansicht', () => {
  const { context } = fixture();
  const backup = context.api.createFullBackupDocument([event()]);
  const result = context.api.validateFullBackupDocument(backup);
  assert.equal(result.ok, true);
  assert.equal(result.backup.format, 'tageszaehler-backup');
  assert.equal(result.backup.version, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.preferences)),
    preferences()
  );
  assert.match(result.serialized, /Synthetisch 😀/);
});

test('lehnt unbekannte Version, ungültiges Ereignis und falsche Präferenztypen vollständig ab', () => {
  const { context } = fixture();
  const base = context.api.createFullBackupDocument([event()], preferences());
  assert.equal(context.api.validateFullBackupDocument({ ...base, version: 99 }).code, 'version');
  assert.equal(context.api.validateFullBackupDocument({
    ...base,
    data: { ...base.data, events: [{ id: 'broken', valid: false }] }
  }).ok, false);
  assert.equal(context.api.validateFullBackupDocument({
    ...base,
    data: { ...base.data, preferences: preferences({ view: 7 }) }
  }).code, 'preference-view');
});

test('misst das vollständige Unicode-Backup in UTF-8 und erzwingt das Backup-Limit', () => {
  const { context } = fixture();
  const backup = context.api.createFullBackupDocument([event('unicode', { name: '東京😀'.repeat(80) })], preferences());
  context.DATA_LIMITS.maxBackupBytes = 400;
  assert.equal(context.api.validateFullBackupDocument(backup).code, 'backup-too-large');
});

test('schreibt Journal, Ereignisse und Präferenzen und entfernt das Journal erst nach Commit', async () => {
  const { context, storage, keys } = fixture();
  const beforeRaw = JSON.stringify([event('before')]);
  storage.setItem(keys.events, beforeRaw);
  storage.setItem(context.preferenceKey('theme'), 'light');
  storage.setItem(context.preferenceKey('color'), 'blue');
  storage.setItem(context.preferenceKey('view'), 'cards');
  const repository = new context.Repository();
  repository.extractRevision = () => 'before';
  repository.persist = events => {
    const raw = JSON.stringify(events);
    storage.setItem(keys.events, raw);
    return { ok: true, events, revision: `data:${hashString(raw)}` };
  };
  const result = await repository.restoreFullBackup(
    beforeRaw,
    { theme: 'light', color: 'blue', view: 'cards' },
    [event('after')],
    preferences(),
    'writer'
  );
  assert.equal(result.ok, true);
  assert.equal(storage.getItem(keys.backupRestore), null);
  assert.deepEqual(JSON.parse(storage.getItem(keys.events)).map(item => item.id), ['after']);
  assert.equal(storage.getItem(context.preferenceKey('theme')), 'dark');
  assert.equal(storage.getItem(context.preferenceKey('color')), 'green');
  assert.equal(storage.getItem(context.preferenceKey('view')), 'compact');
});

test('Quota-Fehler beim Staging verändert keine produktiven Schlüssel', async () => {
  const { context, storage, keys } = fixture();
  const beforeRaw = JSON.stringify([event('before')]);
  storage.setItem(keys.events, beforeRaw);
  storage.failOnWrite.set(keys.backupRestore, 1);
  const repository = new context.Repository();
  const result = await repository.restoreFullBackup(
    beforeRaw,
    { theme: null, color: null, view: null },
    [event('after')],
    preferences(),
    'writer'
  );
  assert.equal(result.code, 'staging-failed');
  assert.equal(storage.getItem(keys.events), beforeRaw);
  assert.equal(storage.getItem(keys.backupRestore), null);
});

test('Schreibfehler bei einer Präferenz rollt Ereignisse und alle Präferenzen zurück', async () => {
  const { context, storage, keys } = fixture();
  const beforeRaw = JSON.stringify([event('before')]);
  storage.setItem(keys.events, beforeRaw);
  for (const [name, value] of Object.entries({ theme: 'light', color: 'blue', view: 'cards' })) {
    storage.setItem(context.preferenceKey(name), value);
  }
  storage.failOnWrite.set(context.preferenceKey('color'), 2);
  const repository = new context.Repository();
  repository.extractRevision = () => 'before';
  repository.persist = events => {
    const raw = JSON.stringify(events);
    storage.setItem(keys.events, raw);
    return { ok: true, events, revision: 'after' };
  };
  const result = await repository.restoreFullBackup(
    beforeRaw,
    { theme: 'light', color: 'blue', view: 'cards' },
    [event('after')],
    preferences(),
    'writer'
  );
  assert.equal(result.code, 'preference-write-failed');
  assert.equal(result.rolledBack, true);
  assert.equal(storage.getItem(keys.events), beforeRaw);
  assert.equal(storage.getItem(context.preferenceKey('theme')), 'light');
  assert.equal(storage.getItem(context.preferenceKey('color')), 'blue');
  assert.equal(storage.getItem(context.preferenceKey('view')), 'cards');
  assert.equal(storage.getItem(keys.backupRestore), null);
});

test('Neustart rollt einen erkennbaren Mischzustand zurück und lässt Rettungsschlüssel stehen', async () => {
  const { context, storage, keys } = fixture();
  const beforeRaw = JSON.stringify([event('before')]);
  const targetRaw = JSON.stringify([event('after')]);
  const journal = {
    schemaVersion: 1,
    state: 'committing',
    createdAt: new Date().toISOString(),
    before: {
      events: beforeRaw,
      preferences: { theme: 'light', color: 'blue', view: 'cards' }
    },
    target: {
      eventsChecksum: hashString(targetRaw),
      preferences: preferences()
    }
  };
  storage.setItem(keys.backupRestore, JSON.stringify(journal));
  storage.setItem(keys.events, targetRaw);
  storage.setItem(context.preferenceKey('theme'), 'dark');
  storage.setItem(context.preferenceKey('color'), 'blue');
  storage.setItem(context.preferenceKey('view'), 'cards');
  storage.setItem(keys.quarantine, 'synthetische-rettung');
  const result = await context.api.recoverInterruptedBackupRestore();
  assert.equal(result.ok, true);
  assert.equal(storage.getItem(keys.events), beforeRaw);
  assert.equal(storage.getItem(context.preferenceKey('theme')), 'light');
  assert.equal(storage.getItem(keys.backupRestore), null);
  assert.equal(storage.getItem(keys.quarantine), 'synthetische-rettung');
});

test('früher Theme-Start zeigt während Journalzuständen keinen unbemerkten Präferenzmix', () => {
  const namespace = 'tageszaehler:%2Ftest%2F:';
  const storage = new Storage([
    [`${namespace}theme`, 'dark'],
    [`${namespace}color`, 'green'],
    [`${namespace}view`, 'compact']
  ]);
  const before = { theme: 'light', color: null, view: 'cards' };
  const target = preferences();
  const journal = {
    schemaVersion: 1,
    state: 'committing',
    before: { events: null, preferences: before },
    target: { eventsChecksum: 'synthetic', preferences: target }
  };
  storage.setItem(`${namespace}backup-restore:v1`, JSON.stringify(journal));
  const firstRoot = { dataset: {} };
  vm.runInNewContext(theme, {
    document: {
      documentElement: firstRoot,
      currentScript: { src: 'https://example.test/test/theme.js' }
    },
    localStorage: storage,
    JSON,
    URL
  });
  assert.deepEqual(firstRoot.dataset, { theme: 'light', color: 'purple', view: 'cards' });

  journal.state = 'committed';
  storage.setItem(`${namespace}backup-restore:v1`, JSON.stringify(journal));
  const committedRoot = { dataset: {} };
  vm.runInNewContext(theme, {
    document: {
      documentElement: committedRoot,
      currentScript: { src: 'https://example.test/test/theme.js' }
    },
    localStorage: storage,
    JSON,
    URL
  });
  assert.deepEqual(committedRoot.dataset, target);
});

test('bestehende Ereignis-Array-Exporte bleiben als eigener Importpfad erhalten', () => {
  assert.match(app, /if \(Array\.isArray\(data\)\)[\s\S]*importLegacyEventArray\(data\)/);
  assert.match(app, /Darstellungseinstellungen bleiben unverändert/);
});
