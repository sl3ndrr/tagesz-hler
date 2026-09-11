import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const projectRoot = resolve(import.meta.dirname, '..');
const appSource = readFileSync(resolve(projectRoot, 'app.js'), 'utf8');
const dataStart = appSource.indexOf('function createEventId()');
const dataEnd = appSource.indexOf('/* ── EVENT STORE ── */');

assert.notEqual(dataStart, -1, 'Datenmodell fehlt in app.js');
assert.notEqual(dataEnd, -1, 'Ende des Datenmodells fehlt in app.js');

const dataSource = appSource.slice(dataStart, dataEnd);

function createDataContext(maxEventDataBytes = 8 * 1024 * 1024) {
  const storage = new Map();
  const context = vm.createContext({
    Array,
    Date,
    DOMException,
    Error,
    JSON,
    Math,
    Number,
    Object,
    String,
    TextEncoder,
    ALLOWED_UNITS: ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'],
    DATA_SCHEMA_VERSION: 2,
    DATA_LIMITS: {
      maxEvents: 1000,
      maxEventDataBytes,
      maxNameChars: 200,
      maxDescriptionChars: 4000,
      maxIdChars: 128,
      maxImageSourceChars: 1_500_000,
      maxTotalImageChars: 4_000_000,
      maxUrlChars: 4096,
      maxQuarantineEntries: 5,
      maxQuarantineRawChars: 1_500_000
    },
    STORAGE_KEYS: { events: 'events', quarantine: 'quarantine', quarantineMeta: 'quarantine-meta' },
    compareDateKeys: (left, right) => left.localeCompare(right),
    getSystemTimeZone: () => 'Europe/Berlin',
    isValidDateInput: value => /^\d{4}-\d{2}-\d{2}$/.test(value),
    isValidTimeInput: value => value === '' || /^\d{2}:\d{2}$/.test(value),
    isValidTimeZone: value => value === 'Europe/Berlin',
    normalizeImageSource: value => typeof value === 'string' && value ? value : null,
    resolveStartOfZonedDay: () => ({ instant: 0 }),
    resolveZonedDateTime: () => ({ ok: true, instant: 1 }),
    window: {
      localStorage: {
        getItem: key => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, String(value))
      }
    }
  });
  vm.runInContext(`${dataSource}\nthis.normalizeEvent = normalizeEvent; this.normalizeEventCollection = normalizeEventCollection; this.EventRepository = EventRepository; this.serializeEventCollection = serializeEventCollection; this.utf8ByteLength = utf8ByteLength;`, context);
  return { context, storage };
}

function event(overrides = {}) {
  return {
    id: 'synthetic-id',
    name: 'Synthetisches Ereignis',
    kind: 'all-day',
    date: '2026-09-12',
    time: '',
    timeZone: '',
    disambiguation: '',
    refDate: '',
    desc: '',
    units: ['days'],
    img: '',
    ...overrides
  };
}

test('weist ungültige ID-Typen kontrolliert in den Quarantänepfad', () => {
  const { context, storage } = createDataContext();
  storage.set('events', JSON.stringify([event({ id: { toString: null } })]));

  const snapshot = new context.EventRepository().loadCurrent();

  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.events.length, 0);
  assert.match(snapshot.warning, /ungültige Ereignisse/);
  assert.equal(JSON.parse(storage.get('quarantine')).entries[0].stage, 'partial-validation');
});

test('lehnt vorhandene optionale Werte mit falschem Typ ab, akzeptiert aber leere Altformate', () => {
  const { context } = createDataContext();

  assert.equal(context.normalizeEventCollection([event({ time: 123 })]).invalidCount, 1);
  assert.equal(context.normalizeEventCollection([event({ refDate: 123 })]).invalidCount, 1);

  const legacy = context.normalizeEvent(event({ id: 17, time: null, refDate: null, kind: undefined }));
  assert.equal(legacy.id, '17');
  assert.equal(legacy.kind, 'all-day');
  assert.equal(legacy.time, '');
  assert.equal(legacy.refDate, '');
});

test('misst Unicode am formatierten Exportformat in UTF-8-Bytes', () => {
  const { context } = createDataContext(600);
  const unicode = event({ name: 'Ärger 😀 東京'.repeat(10) });
  const exported = context.serializeEventCollection([unicode], true);

  assert.equal(context.utf8ByteLength(exported), Buffer.byteLength(exported, 'utf8'));
  assert.equal(context.normalizeEventCollection(JSON.parse(exported)).ok, true);

  const emptyExport = context.serializeEventCollection([event({ img: '' })], true);
  const exactImage = 'a'.repeat(600 - context.utf8ByteLength(emptyExport));
  const exactExport = context.serializeEventCollection([event({ img: exactImage })], true);
  assert.equal(context.utf8ByteLength(exactExport), 600);
  assert.equal(context.normalizeEventCollection(JSON.parse(exactExport)).ok, true);
  assert.equal(context.normalizeEventCollection([event({ img: `${exactImage}a` })]).code, 'data-too-large');
  assert.equal(context.normalizeEventCollection([event({ img: '😀'.repeat(120) })]).code, 'data-too-large');
});

test('enthält nur einen DST-Aktualisierungspfad und prüft native Teilschritte vor Leerwerten', () => {
  assert.doesNotMatch(appSource, /eventDateInput\.addEventListener\('input', updateDateTimeDisambiguation\)/);
  assert.doesNotMatch(appSource, /eventTimeInput\.addEventListener\('input', updateDateTimeDisambiguation\)/);
  assert.match(appSource, /eventDateInput\.validity\.badInput/);
  assert.match(appSource, /eventTimeInput\.validity\.badInput/);
  assert.match(appSource, /eventRefDateInput\.validity\.badInput/);
  assert.match(appSource, /field === eventDateInput \|\| field === eventTimeInput \|\| field === dstChoiceInput/);
});
