import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const projectRoot = resolve(import.meta.dirname, '..');
const appSource = readFileSync(resolve(projectRoot, 'app.js'), 'utf8');
const architectureStart = appSource.indexOf('class EventRepository {');
const architectureEnd = appSource.indexOf('/* ── CROSS-TAB SYNCHRONIZATION ── */');

assert.notEqual(architectureStart, -1, 'EventRepository fehlt in app.js');
assert.notEqual(architectureEnd, -1, 'Ende der Store-Architektur fehlt in app.js');

const architectureSource = appSource.slice(architectureStart, architectureEnd);

class MemoryStorage {
  constructor(initialEvents = []) {
    this.values = new Map([['events', JSON.stringify(initialEvents)]]);
    this.beforeNextWrite = null;
    this.failNextWrite = null;
    this.replaceNextWriteWith = null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failNextWrite) {
      const error = this.failNextWrite;
      this.failNextWrite = null;
      throw error;
    }
    if (this.beforeNextWrite) {
      const callback = this.beforeNextWrite;
      this.beforeNextWrite = null;
      callback();
    }
    if (this.replaceNextWriteWith != null) {
      const replacement = this.replaceNextWriteWith;
      this.replaceNextWriteWith = null;
      this.values.set(key, replacement);
      return;
    }
    this.values.set(key, String(value));
  }
}

class QueuedLockManager {
  constructor() {
    this.tail = Promise.resolve();
    this.calls = [];
    this.active = 0;
    this.maxActive = 0;
  }

  request(name, options, callback) {
    this.calls.push({ name, options });
    const execute = async () => {
      this.active++;
      this.maxActive = Math.max(this.maxActive, this.active);
      try {
        return await callback({ name, mode: options.mode });
      } finally {
        this.active--;
      }
    };
    const result = this.tail.then(execute, execute);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

function hashString(value) {
  let fnv = 0x811c9dc5;
  let djb = 5381;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    fnv ^= code;
    fnv = Math.imul(fnv, 0x01000193);
    djb = Math.imul(djb, 33) ^ code;
  }
  return `${value.length.toString(36)}-${(fnv >>> 0).toString(16).padStart(8, '0')}-${(djb >>> 0).toString(16).padStart(8, '0')}`;
}

function createArchitecture(storage, lockManager = new QueuedLockManager()) {
  let idSequence = 0;
  const context = vm.createContext({
    console,
    Date,
    DOMException,
    JSON,
    window: { localStorage: storage, navigator: lockManager ? { locks: lockManager } : {} },
    STORAGE_KEYS: { events: 'events', quarantine: 'quarantine', quarantineMeta: 'quarantine-meta' },
    DATA_LIMITS: {
      maxStoredJsonChars: 1024 * 1024,
      maxQuarantineRawChars: 1024 * 1024,
      maxQuarantineEntries: 5
    },
    DATA_SCHEMA_VERSION: 2,
    EVENT_WRITE_LOCK_NAME: 'tageszaehler-events-v2-write',
    createEventId: () => `synthetic-${++idSequence}`,
    hashString,
    isQuotaExceededError: error => error?.name === 'QuotaExceededError',
    normalizeEventCollection: events => Array.isArray(events)
      ? { ok: true, events: events.map(event => ({ ...event })), invalidCount: 0 }
      : { ok: false, events: [], invalidCount: 0 },
    freezeEvents: events => Object.freeze(events.map(event => Object.freeze({ ...event }))),
    eventsEqual: (left, right) => left === right || Boolean(left && right && JSON.stringify(left) === JSON.stringify(right))
  });

  vm.runInContext(`${architectureSource}\nthis.EventRepository = EventRepository; this.EventStore = EventStore;`, context);
  const repository = new context.EventRepository();
  const snapshot = repository.loadCurrent({ quarantineOnError: false });
  return {
    repository,
    store: new context.EventStore(repository, snapshot),
    EventStore: context.EventStore,
    lockManager
  };
}

function secondStore(architecture) {
  const snapshot = architecture.repository.loadCurrent({ quarantineOnError: false });
  return new architecture.EventStore(architecture.repository, snapshot);
}

function storedEvents(storage) {
  return JSON.parse(storage.getItem('events'));
}

test('serialisiert die ursprünglich verschachtelten Schreibvorgänge ohne verlorenes Anlegen', async () => {
  const storage = new MemoryStorage();
  const locks = new QueuedLockManager();
  const architecture = createArchitecture(storage, locks);
  const otherStore = secondStore(architecture);
  let nestedWrite;

  storage.beforeNextWrite = () => {
    nestedWrite = otherStore.upsert({ id: 'b', name: 'Tab B' });
  };

  const first = await architecture.store.upsert({ id: 'a', name: 'Tab A' });
  const second = await nestedWrite;

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(storedEvents(storage).map(event => event.id).sort(), ['a', 'b']);
  assert.equal(locks.maxActive, 1);
  assert.ok(locks.calls.every(call => call.name === 'tageszaehler-events-v2-write' && call.options.mode === 'exclusive'));
});

test('führt parallele Bearbeitungen verschiedener Ereignisse auf dem frischen Bestand zusammen', async () => {
  const initial = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const storage = new MemoryStorage(initial);
  const architecture = createArchitecture(storage);
  const otherStore = secondStore(architecture);

  const baseA = architecture.store.getEvent('a');
  const baseB = otherStore.getEvent('b');
  const [first, second] = await Promise.all([
    architecture.store.upsert({ id: 'a', name: 'A geändert' }, { requireExisting: true, baseEvent: baseA }),
    otherStore.upsert({ id: 'b', name: 'B geändert' }, { requireExisting: true, baseEvent: baseB })
  ]);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(storedEvents(storage), [
    { id: 'a', name: 'A geändert' },
    { id: 'b', name: 'B geändert' }
  ]);
});

test('weist die zweite Bearbeitung desselben Ereignisses als echten Konflikt zurück', async () => {
  const storage = new MemoryStorage([{ id: 'a', name: 'Ausgang' }]);
  const architecture = createArchitecture(storage);
  const otherStore = secondStore(architecture);
  const baseA = architecture.store.getEvent('a');
  const baseB = otherStore.getEvent('a');

  const first = await architecture.store.upsert(
    { id: 'a', name: 'Erster Entwurf' },
    { requireExisting: true, baseEvent: baseA }
  );
  const second = await otherStore.upsert(
    { id: 'a', name: 'Zweiter Entwurf' },
    { requireExisting: true, baseEvent: baseB }
  );

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.code, 'edit-conflict');
  assert.deepEqual(storedEvents(storage), [{ id: 'a', name: 'Erster Entwurf' }]);
  assert.equal(baseB.name, 'Ausgang', 'Die Ausgangsversion des abgewiesenen Entwurfs bleibt erhalten.');
});

test('meldet Bearbeiten gegen Löschen und überschreibt die Löschung nicht', async () => {
  const storage = new MemoryStorage([{ id: 'a', name: 'Ausgang' }]);
  const architecture = createArchitecture(storage);
  const otherStore = secondStore(architecture);
  const deleteBase = architecture.store.getEvent('a');
  const editBase = otherStore.getEvent('a');

  const deletion = await architecture.store.remove('a', deleteBase);
  const edit = await otherStore.upsert(
    { id: 'a', name: 'Entwurf' },
    { requireExisting: true, baseEvent: editBase }
  );

  assert.equal(deletion.ok, true);
  assert.equal(edit.ok, false);
  assert.equal(edit.code, 'edit-deleted');
  assert.deepEqual(storedEvents(storage), []);
});

test('bricht Import gegen eine zwischenzeitliche Änderung ab', async () => {
  const storage = new MemoryStorage([{ id: 'a', name: 'Ausgang' }]);
  const architecture = createArchitecture(storage);
  const importStore = secondStore(architecture);
  const base = architecture.store.getEvent('a');

  const change = architecture.store.upsert(
    { id: 'a', name: 'Parallel geändert' },
    { requireExisting: true, baseEvent: base }
  );
  const imported = importStore.replaceAll([{ id: 'import', name: 'Import' }]);
  const [changeResult, importResult] = await Promise.all([change, imported]);

  assert.equal(changeResult.ok, true);
  assert.equal(importResult.ok, false);
  assert.equal(importResult.code, 'collection-conflict');
  assert.deepEqual(storedEvents(storage), [{ id: 'a', name: 'Parallel geändert' }]);
});

test('meldet Quota-Fehler ohne Zustand oder Speicher als erfolgreich zu ändern', async () => {
  const initial = [{ id: 'a', name: 'Ausgang' }];
  const storage = new MemoryStorage(initial);
  const architecture = createArchitecture(storage);
  storage.failNextWrite = new DOMException('synthetisch voll', 'QuotaExceededError');

  const result = await architecture.store.upsert({ id: 'b', name: 'Nicht gespeichert' });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'quota');
  assert.deepEqual(storedEvents(storage), initial);
  assert.deepEqual(architecture.store.getEvents(), initial);
});

test('meldet allgemeine Schreibfehler ohne falsche Erfolgsmeldung', async () => {
  const initial = [{ id: 'a', name: 'Ausgang' }];
  const storage = new MemoryStorage(initial);
  const architecture = createArchitecture(storage);
  storage.failNextWrite = new Error('synthetischer Schreibfehler');

  const result = await architecture.store.upsert({ id: 'b', name: 'Nicht gespeichert' });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'storage-unavailable');
  assert.deepEqual(storedEvents(storage), initial);
  assert.deepEqual(architecture.store.getEvents(), initial);
});

test('blockiert Schreibvorgänge ohne Web-Locks-Unterstützung', async () => {
  const initial = [{ id: 'a', name: 'Ausgang' }];
  const storage = new MemoryStorage(initial);
  const architecture = createArchitecture(storage, null);

  const result = await architecture.store.upsert({ id: 'b', name: 'Nicht gespeichert' });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'lock-unavailable');
  assert.deepEqual(storedEvents(storage), initial);
});

test('bestätigt eine von einem nicht kooperierenden Schreiber ersetzte Persistierung nicht', async () => {
  const initial = [{ id: 'a', name: 'Ausgang' }];
  const external = [{ id: 'x', name: 'Alter Tab' }];
  const storage = new MemoryStorage(initial);
  const architecture = createArchitecture(storage);
  storage.replaceNextWriteWith = JSON.stringify(external);

  const result = await architecture.store.upsert({ id: 'b', name: 'Neuer Tab' });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'write-raced');
  assert.deepEqual(storedEvents(storage), external);
  assert.deepEqual(architecture.store.getEvents(), external);
});

test('blockiert weitere Schreibvorgänge nach Erkennung eines alten Broadcast-Protokolls', async () => {
  const initial = [{ id: 'a', name: 'Ausgang' }];
  const storage = new MemoryStorage(initial);
  const architecture = createArchitecture(storage);

  assert.equal(architecture.store.blockWritesForLegacyPeer(), true);
  const result = await architecture.store.upsert({ id: 'b', name: 'Nicht gespeichert' });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'legacy-peer');
  assert.deepEqual(storedEvents(storage), initial);
});
