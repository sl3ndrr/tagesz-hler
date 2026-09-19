import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

// Kleine DOM-Fixture für produktive Editor-/Rendererpfade; kein Browsertest.
class Element {
  constructor() {
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.validity = {};
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => this.classes.add(name)),
      remove: (...names) => names.forEach(name => this.classes.delete(name)),
      contains: name => this.classes.has(name),
      toggle: (name, value = !this.classes.has(name)) => value ? this.classes.add(name) : this.classes.delete(name)
    };
  }
  set className(value) { this.classes = new Set(value.split(' ')); }
  get className() { return [...this.classes].join(' '); }
  append(...items) { items.forEach(item => this.appendChild(item)); }
  appendChild(item) { item.remove(); this.children.push(item); item.parent = this; }
  remove() {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  insertBefore(item, before) {
    item.remove();
    const index = before ? this.children.indexOf(before) : this.children.length;
    this.children.splice(index, 0, item);
    item.parent = this;
  }
  replaceChildren(...items) { this.children.forEach(item => { item.parent = null; }); this.children = []; this.append(...items); }
  get firstElementChild() { return this.children[0] || null; }
  get nextElementSibling() { return this.parent?.children[this.parent.children.indexOf(this) + 1] || null; }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  hasAttribute(key) { return this.attributes.has(key); }
  toggleAttribute(key, value) { if (value) this.setAttribute(key, ''); else this.removeAttribute(key); }
  setCustomValidity(value) { this.validationMessage = value; }
  addEventListener() {}
  focus() {}
  querySelectorAll() { return this.chips || []; }
  querySelector(selector) { return this.queryElements?.get(selector) || this.chips?.[0] || null; }
  contains(element) { return element === this || this.children.some(child => child.contains(element)); }
}

function fixture() {
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, Object.assign(new Element(), { id }));
    return elements.get(id);
  };
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  const document = {
    currentScript: { src: 'https://example.test/p16/app.js' },
    documentElement: { dataset: { theme: 'dark', color: 'blue', view: 'cards' } },
    getElementById: el, querySelectorAll: () => [], querySelector: () => null,
    createElement: () => new Element(), createElementNS: () => new Element(),
    body: new Element(), hidden: false, addEventListener() {}, removeEventListener() {}
  };
  const window = {
    localStorage: storage, navigator: { locks: { request: async (_name, _options, callback) => callback() } },
    matchMedia: () => ({ matches: true, addEventListener() {} }), addEventListener() {}, removeEventListener() {}
  };
  const context = vm.createContext({
    Date, Intl, URL, TextEncoder, DOMException, Blob, atob, document, window, localStorage: storage,
    HTMLElement: Element, console: { warn() {}, error() {} },
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: callback => callback(),
    confirm: () => true, history: { pushState() {}, back() {} },
    getComputedStyle: () => ({ getPropertyValue: () => '0ms' })
  });
  vm.runInContext(source.replace(/\ninit\(\);\s*$/, ''), context);
  const run = code => vm.runInContext(code, context);
  const api = run(`({ normalizeEvent, normalizeEventCollection, normalizeEventDocument, serializeEventCollection,
    createEventTimeModel, annualOccurrence, eventDifference, eventProgress, comparePreparedEvents,
    createFullBackupDocument, validateFullBackupDocument, EventRepository, EventStore, EventListModelCache,
    EventListRenderer, TemporalContextTracker, resolveZonedDateTime, getZonedParts, validateEditorForm,
    updateDateTimeDisambiguation, updateRecurrenceEditor, saveEvent, updateDetailDate,
    importLegacyEventArray, importData, importRecoveryFile, recoverInterruptedBackupRestore, STORAGE_KEYS, preferenceKey })`);
  el('search-toggle-btn').queryElements = new Map([['.icon-btn-dot', new Element()]]);
  el('menu-popup').queryElements = new Map([['.menu-levels', new Element()]]);
  el('f-recurrence').value = 'none';
  el('f-dst-choice').value = 'earlier';
  el('unit-wrap').chips = [{ dataset: { unit: 'days' } }];
  return { api, context, run, el, storage, values };
}

function annual(patch = {}) {
  return {
    id: 'synthetic-annual', name: 'Synthetischer Geburtstag 😀', kind: 'all-day',
    date: '2000-02-29', time: '', timeZone: '', disambiguation: '', refDate: '',
    desc: '', units: ['days'], img: null, recurrence: 'yearly', ...patch
  };
}
function timed(patch = {}) {
  return annual({ kind: 'timed', date: '2000-06-15', time: '12:00', timeZone: 'Europe/Berlin', disambiguation: 'earlier', ...patch });
}
function model(api, event, iso, zone = 'UTC') {
  return api.createEventTimeModel(event, Date.parse(iso), zone);
}

test('P16: 29. Februar vor/am/nach Auftreten, Schaltjahre und Jahrhundertregel', () => {
  const { api } = fixture();
  const event = annual();
  for (const [now, expected, days] of [
    ['2025-02-27T12:00Z', '2025-02-28', 1],
    ['2025-02-28T23:59:59Z', '2025-02-28', 0],
    ['2025-03-01T00:00Z', '2026-02-28', 364],
    ['2028-02-28T12:00Z', '2028-02-29', 1],
    ['2028-02-29T23:59Z', '2028-02-29', 0],
    ['2028-03-01T00:00Z', '2029-02-28', 364],
    ['2100-02-28T12:00Z', '2100-02-28', 0]
  ]) {
    const m = model(api, event, now);
    assert.equal(m.targetDate, expected, now);
    assert.equal(m.isPast, false);
    assert.equal(api.eventDifference(event, m, Date.parse(now))[0].val, days);
  }
  assert.equal(event.date, '2000-02-29');
});

test('P16: Jahreswechsel, zukünftiger Ursprung und Ende des unterstützten Datumsbereichs', () => {
  const { api } = fixture();
  const event = annual({ date: '2000-01-01' });
  assert.equal(model(api, event, '2026-12-31T23:59Z').targetDate, '2027-01-01');
  assert.equal(model(api, event, '2027-01-01T23:59Z').targetDate, '2027-01-01');
  assert.equal(model(api, event, '2027-01-02T00:00Z').targetDate, '2028-01-01');
  assert.equal(model(api, annual({ date: '2030-01-01' }), '2026-12-31T12:00Z').targetDate, '2030-01-01');
  const end = model(api, annual({ date: '2000-02-29' }), '9999-12-31T12:00Z');
  assert.equal(end.exhausted, true);
  assert.equal(end.isPast, true);
  assert.equal(end.targetDate, '9999-02-28');
});

test('P16: zeitgenau vor/am/nach Instant, gespeicherte Zone und Viewerwechsel', () => {
  const { api } = fixture();
  const event = timed();
  const target = Date.parse('2026-06-15T10:00Z');
  for (const zone of ['UTC', 'America/New_York', 'Pacific/Auckland']) {
    assert.equal(api.createEventTimeModel(event, target - 1, zone).targetTime, target);
    const at = api.createEventTimeModel(event, target, zone);
    assert.equal(at.targetTime, target);
    assert.equal(at.isPast, false);
    assert.equal(api.eventDifference(event, at, target)[0].val, 0);
    assert.equal(api.eventProgress(event, at, target), 100);
    const after = api.createEventTimeModel(event, target + 1, zone);
    assert.equal(after.targetDate, '2027-06-15');
    assert.ok(api.eventProgress(event, after, target + 1) < 0.001);
  }
  assert.equal(event.timeZone, 'Europe/Berlin');
  const midnight = timed({ time: '00:30' });
  assert.equal(model(api, midnight, '2026-06-14T10:00Z', 'America/New_York').targetLocalDate, '2026-06-14');
});

test('P16: jährliche DST-Lücke wird verschoben, Einzelereignis bleibt unzulässig', () => {
  const { api } = fixture();
  const event = timed({ date: '2026-03-29', time: '02:30' });
  assert.ok(api.normalizeEvent(event));
  const occurrence = api.annualOccurrence(event, 2026);
  assert.equal(occurrence.instant, Date.parse('2026-03-29T01:30Z'));
  assert.equal(occurrence.status, 'shifted');
  assert.equal(api.getZonedParts(occurrence.instant, event.timeZone).hour, 3);
  assert.equal(api.normalizeEvent({ ...event, recurrence: 'none' }), null);
  // Halbstündige Zeitlücke: nicht pauschal um eine Stunde verschieben.
  const lordHowe = timed({ date: '2026-10-04', time: '02:15', timeZone: 'Australia/Lord_Howe' });
  const parts = api.getZonedParts(api.annualOccurrence(lordHowe, 2026).instant, lordHowe.timeZone);
  assert.equal(parts.hour, 2);
  assert.equal(parts.minute, 45);
});

test('P16: Fold-Wahl gilt auch bei ursprünglich eindeutiger Uhrzeit jedes Jahr', () => {
  const { api } = fixture();
  const earlier = timed({ date: '2025-10-25', time: '02:30' });
  const later = { ...earlier, disambiguation: 'later' };
  assert.equal(api.annualOccurrence(earlier, 2026).instant, Date.parse('2026-10-25T00:30Z'));
  assert.equal(api.annualOccurrence(later, 2026).instant, Date.parse('2026-10-25T01:30Z'));
  assert.equal(model(api, earlier, '2026-10-25T01:00Z').targetDate, '2027-10-25');
  assert.equal(model(api, later, '2026-10-25T01:00Z').targetDate, '2026-10-25');
});

test('P16: Jahresfortschritt verwendet vorheriges Auftreten, keine kumulierte Lebenszeit', () => {
  const { api } = fixture();
  const event = annual();
  const halfway = model(api, event, '2024-08-29T12:00Z');
  assert.equal(halfway.refDate, '2024-02-29');
  assert.equal(halfway.targetDate, '2025-02-28');
  assert.ok(Math.abs(api.eventProgress(event, halfway, 0) - 50) < 1);
  assert.equal(api.normalizeEvent(annual({ refDate: '1999-01-01' })), null);
  const firstYear = model(api, annual({ date: '0001-06-01' }), '0001-01-01T12:00Z');
  assert.equal(firstYear.refDate, '');
  assert.equal(api.eventProgress(event, firstYear, 0), null);
});

test('P16: alte Einzelereignisse behalten Datum, Zeitlage, Differenz und Referenzfortschritt', () => {
  const { api } = fixture();
  const legacy = annual({ date: '2026-06-15', refDate: '2026-06-01' });
  delete legacy.recurrence;
  const normalized = api.normalizeEvent(legacy);
  assert.equal(normalized.recurrence, undefined);
  const before = model(api, normalized, '2026-06-08T12:00Z');
  assert.equal(api.eventProgress(normalized, before, 0), 50);
  assert.equal(model(api, normalized, '2026-06-16T12:00Z').isPast, true);
  const singleTimed = api.normalizeEvent(timed({ recurrence: 'none' }));
  assert.equal(model(api, singleTimed, '2026-06-15T10:00Z').isPast, true);
  const raw = api.serializeEventCollection([normalized]);
  assert.ok(Array.isArray(JSON.parse(raw)));
  assert.equal(api.createFullBackupDocument([normalized]).version, 1);
});

test('P16: Speicherung, Reload, Bearbeiten und Ereignisexport erhalten Wiederholung und Zone', async () => {
  const { api, storage } = fixture();
  const repository = new api.EventRepository();
  const store = new api.EventStore(repository, repository.loadCurrent());
  const event = api.normalizeEvent(timed({ disambiguation: 'later' }));
  assert.equal((await store.upsert(event)).ok, true);
  const raw = storage.getItem(api.STORAGE_KEYS.events);
  assert.equal(JSON.parse(raw).schemaVersion, 3);
  const reloaded = repository.loadCurrent();
  assert.deepEqual(plain(reloaded.events[0]), plain(event));
  assert.equal(reloaded.revision, store.getRevision());
  assert.equal((await store.upsert({ ...event, name: 'Bearbeitet' }, { requireExisting: true, baseEvent: event })).ok, true);
  const exported = api.serializeEventCollection(store.getEvents(), true);
  const imported = api.normalizeEventDocument(JSON.parse(exported), { regenerateIds: true });
  assert.equal(imported.ok, true);
  assert.equal(imported.events[0].recurrence, 'yearly');
  assert.equal(imported.events[0].disambiguation, 'later');
  assert.equal(imported.events[0].timeZone, 'Europe/Berlin');
  const latest = store.getEvents()[0];
  const single = { ...latest }; delete single.recurrence;
  assert.equal((await store.upsert(single, { requireExisting: true, baseEvent: latest })).ok, true);
  assert.ok(Array.isArray(JSON.parse(storage.getItem(api.STORAGE_KEYS.events))));
});

test('P16: Vollbackup v2 rundläuft einschließlich Journal und Präferenzen', async () => {
  const { api, storage } = fixture();
  const events = [api.normalizeEvent(annual()), api.normalizeEvent(timed({ id: 'timed' }))];
  const backup = api.createFullBackupDocument(events);
  assert.equal(backup.version, 2);
  const imported = api.validateFullBackupDocument(JSON.parse(JSON.stringify(backup)));
  assert.equal(imported.ok, true);
  const repository = new api.EventRepository();
  const result = await repository.restoreFullBackup(null, { theme: null, color: null, view: null }, imported.events, imported.preferences, 'synthetic');
  assert.equal(result.ok, true);
  assert.equal(storage.getItem(api.STORAGE_KEYS.backupRestore), null);
  assert.equal(storage.getItem(api.preferenceKey('theme')), 'dark');
  assert.deepEqual(plain(repository.loadCurrent().events), plain(events));
  assert.equal(api.validateFullBackupDocument({ ...backup, version: 1 }).ok, false);
});

test('P16: unbekannte Versionen/Felder/Regeln werden nicht still zu Einzelereignissen', () => {
  const { api, storage } = fixture();
  for (const patch of [{ recurrence: 'monthly' }, { recurrence: null }, { recurrence: {} }, { exceptions: [] }, { clientVersion: 99 }]) {
    assert.equal(api.normalizeEvent(annual(patch)), null);
  }
  assert.equal(api.normalizeEvent(timed({ timeZone: '' })), null);
  assert.equal(api.normalizeEvent(annual({ timeZone: 'Europe/Berlin' })), null);
  assert.equal(api.normalizeEventDocument({ schemaVersion: 99, events: [annual()] }).ok, false);
  assert.equal(api.normalizeEventDocument({ schemaVersion: 3, events: [annual()], futureRule: true }).ok, false);
  const backup = api.createFullBackupDocument([api.normalizeEvent(annual())]);
  assert.equal(api.validateFullBackupDocument({ ...backup, version: 99 }).ok, false);
  assert.equal(api.validateFullBackupDocument({ ...backup, futureRule: true }).ok, false);
  const repository = new api.EventRepository();
  for (const raw of [JSON.stringify({ schemaVersion: 99, events: [annual()] }), JSON.stringify([annual({ recurrence: 'monthly' })])]) {
    storage.setItem(api.STORAGE_KEYS.events, raw);
    assert.equal(repository.loadCurrent().writeProtected, true);
    assert.equal(storage.getItem(api.STORAGE_KEYS.events), raw);
  }
});

test('P16: Versionsschutz für alte v2-/P15-Clients und alte Exportformate', () => {
  const { api } = fixture();
  const events = [api.normalizeEvent(annual())];
  const document = JSON.parse(api.serializeEventCollection(events));
  // Format-Gates des P15-Standes 6e555a6: Array oder schemaVersion === 2;
  // Import ausschließlich Array oder Vollbackup version === 1.
  const oldStorageAccepts = raw => Array.isArray(raw) || (raw?.schemaVersion === 2 && Array.isArray(raw.events));
  const oldImportAccepts = raw => Array.isArray(raw) || (raw?.format === 'tageszaehler-backup' && raw.version === 1);
  assert.equal(oldStorageAccepts(document), false);
  assert.equal(oldImportAccepts(document), false);
  assert.equal(oldImportAccepts(api.createFullBackupDocument(events)), false);
  const single = api.normalizeEvent({ ...annual(), recurrence: 'none' });
  assert.equal(oldStorageAccepts(JSON.parse(api.serializeEventCollection([single]))), true);
  const repository = new api.EventRepository();
  assert.equal(repository.parseStoredRaw(JSON.stringify({ schemaVersion: 2, events: [single], revision: 'old' })).ok, true);
  assert.equal(repository.parseStoredRaw(JSON.stringify({ schemaVersion: 2, events })).ok, false);
});

test('P16: Editor verlangt bewusstes Leeren der Referenz und erhält Fold-Wahl beim Umschalten', async () => {
  const { api, el, run, context } = fixture();
  run("sheetState.editTimeZone = 'Europe/Berlin';");
  el('f-name').value = 'Synthetischer Test';
  el('f-date').value = '2025-10-25';
  el('f-time').value = '02:30';
  el('f-refdate').value = '2024-01-01';
  el('f-recurrence').value = 'yearly';
  el('f-dst-choice').value = 'later';
  assert.equal(api.validateEditorForm({ focusFirst: false }).valid, false);
  assert.match(el('f-refdate-error').textContent, /ausdrücklich leeren/);
  assert.equal(el('f-refdate').value, '2024-01-01');
  el('f-refdate').value = '';
  assert.equal(api.validateEditorForm({ focusFirst: false }).valid, true);
  assert.equal(el('f-dst-choice-field').hidden, false);
  context.saved = [];
  run('eventController = { upsert: async event => { saved.push(event); return true; } };');
  assert.equal(await api.saveEvent(), true);
  assert.equal(context.saved[0].recurrence, 'yearly');
  assert.equal(context.saved[0].disambiguation, 'later');
  el('f-recurrence').value = 'none';
  assert.equal(await api.saveEvent(), true);
  assert.equal(context.saved[1].recurrence, undefined);
  assert.equal(context.saved[1].date, '2025-10-25');
  el('f-recurrence').value = 'yearly';
  el('f-time').value = '';
  assert.equal(await api.saveEvent(), true);
  assert.equal(context.saved[2].kind, 'all-day');
  assert.equal(context.saved[2].timeZone, '');
});

test('P16: Renderer ordnet am Jahresauftreten neu, erhält Knoten und aktualisiert Detaildatum', () => {
  const { api, el } = fixture();
  const event = timed({ date: '2000-06-15', units: ['seconds'] });
  const other = timed({ id: 'other', date: '2000-06-16' });
  const renderer = new api.EventListRenderer(el('future-list'), el('past-list'));
  const at = Date.parse('2026-06-15T10:00Z');
  renderer.render([event, other], at - 1000);
  const card = renderer.views.get(event.id).element;
  assert.equal(el('future-list').firstElementChild, card);
  renderer.render([event, other], at);
  assert.equal(renderer.hasTimedBoundaryCrossed(at + 1), true);
  renderer.render([event, other], at + 1, { forceTemporal: true });
  assert.equal(renderer.views.get(event.id).element, card);
  assert.equal(renderer.views.get(event.id).model.targetDate, '2027-06-15');
  assert.equal(el('future-list').firstElementChild.dataset.eventId, other.id);
  assert.match(renderer.views.get(event.id).badge.textContent, /^Jährlich/);
  api.updateDetailDate(event, renderer.views.get(event.id).model);
  assert.match(el('detail-date').textContent, /2027/);
  assert.equal(el('detail-progress-wrap').hidden, false);
  const filter = { terms: [], time: 'past', kind: 'all' };
  renderer.render([event], at - 1000, { forceTemporal: true, filter });
  assert.equal(renderer.views.size, 0);
  assert.equal(renderer.hasTimedBoundaryCrossed(at + 1), true, 'auch ausgefiltertes Auftreten beobachten');
});

test('P16: Uhrsprung vor/zurück und Mitternacht invalidieren wiederkehrende Modelle', () => {
  const { api, el } = fixture();
  const event = annual({ date: '2000-06-15' });
  const renderer = new api.EventListRenderer(el('future-list'), el('past-list'));
  const before = Date.parse('2026-06-15T12:00Z');
  renderer.render([event], before);
  const tracker = new api.TemporalContextTracker(before, 0);
  const jumped = Date.parse('2029-07-01T12:00Z');
  assert.equal(tracker.observe(jumped, 30000).clockJumped, true);
  renderer.render([event], jumped, { forceTemporal: true });
  assert.equal(renderer.views.get(event.id).model.targetDate, '2030-06-15');
  renderer.render([event], before, { forceTemporal: true });
  assert.equal(renderer.views.get(event.id).model.targetDate, '2026-06-15');
  const utc = model(api, event, '2026-06-15T23:30Z');
  const berlin = model(api, event, '2026-06-15T23:30Z', 'Europe/Berlin');
  assert.equal(utc.targetDate, '2026-06-15');
  assert.equal(berlin.targetDate, '2027-06-15');
});

test('P16: produktiver tick aktualisiert Liste und offenen Detailzähler über das Auftreten', () => {
  const { api, context, run, el } = fixture();
  let now = Date.parse('2026-06-15T09:59:59Z');
  context.Date = class extends Date { static now() { return now; } };
  context.events = [timed({ units: ['seconds'] })];
  run(`eventStore = { getEvents: () => events, getEvent: () => events[0] };
    eventRenderer = new EventListRenderer(futureList, pastList);
    sheetState.detailId = events[0].id;
    detailSheet.classList.add('open');
    renderEvents(); tick(true);`);
  assert.match(el('detail-date').textContent, /2026/);
  now += 1001;
  run('tick();');
  assert.match(el('detail-date').textContent, /2027/);
  assert.equal(run('eventRenderer.views.get(events[0].id).model.targetDate'), '2027-06-15');
  // Rückwärtssprung innerhalb desselben Kalendertages muss das vorige Ziel reaktivieren.
  now -= 2000;
  run('tick();');
  assert.match(el('detail-date').textContent, /2026/);
  assert.equal(run('eventRenderer.views.get(events[0].id).model.targetDate'), '2026-06-15');
  assert.ok(api);
});

test('P16: Ereignisimport nimmt v3 an und weist unbekannte Hüllen vor jeder Ersetzung ab', async () => {
  const { api, context, run } = fixture();
  context.imports = [];
  run('eventController = { importEvents: async events => { imports.push(events); return true; } };');
  await api.importLegacyEventArray(JSON.parse(api.serializeEventCollection([annual()])));
  assert.equal(context.imports.length, 1);
  assert.equal(context.imports[0][0].recurrence, 'yearly');
  await assert.rejects(api.importLegacyEventArray({ schemaVersion: 99, events: [annual()] }), /unsupported-schema/);
  await assert.rejects(api.importLegacyEventArray([annual({ recurrence: 'weekly' })]), /ungültige/);
  assert.equal(context.imports.length, 1);
});

test('P16: Größenlimit umfasst die v3-Hülle und UTF-8', () => {
  const { api, run } = fixture();
  const event = api.normalizeEvent(annual());
  const bytes = Buffer.byteLength(api.serializeEventCollection([event], true), 'utf8');
  // DATA_LIMITS ist produktiv eingefroren: statt Testmanipulation der Konstante
  // prüfen wir den gesamten Export einschließlich seiner Hülle am realen Limit.
  const collection = Array.from({ length: 1000 }, (_, index) => annual({ id: String(index), desc: '😀'.repeat(1000) }));
  assert.ok(bytes > Buffer.byteLength(JSON.stringify([event], null, 2)));
  assert.equal(api.normalizeEventCollection(collection).ok, true);
  assert.ok(Buffer.byteLength(api.serializeEventCollection(collection, true)) <= run('DATA_LIMITS.maxEventDataBytes'));
  const oversized = collection.map(event => ({ ...event, name: '😀'.repeat(100), desc: '😀'.repeat(2000) }));
  assert.equal(api.normalizeEventCollection(oversized).code, 'data-too-large');
});

test('P16: fehlgeschlagene v2-Backup-Wiederherstellung rollt den v3-Bestand vollständig zurück', async () => {
  const { api, storage, values } = fixture();
  const repository = new api.EventRepository();
  const before = api.serializeEventCollection([api.normalizeEvent(annual({ id: 'before' }))]);
  storage.setItem(api.STORAGE_KEYS.events, before);
  const write = storage.setItem;
  let fail = true;
  storage.setItem = (key, value) => {
    if (key === api.preferenceKey('color') && fail) { fail = false; throw new DOMException('synthetisch voll', 'QuotaExceededError'); }
    write(key, value);
  };
  const backup = api.validateFullBackupDocument(api.createFullBackupDocument([api.normalizeEvent(timed())]));
  const result = await repository.restoreFullBackup(before, { theme: null, color: null, view: null }, backup.events, backup.preferences, 'test');
  assert.equal(result.rolledBack, true);
  assert.equal(result.code, 'preference-write-failed');
  assert.equal(storage.getItem(api.STORAGE_KEYS.events), before);
  assert.equal(values.has(api.STORAGE_KEYS.backupRestore), false);
  assert.equal(storage.getItem(api.preferenceKey('theme')), null);
});

test('P16: Dateiauswahl routet v3-Export, v2-Backup und P07-Ersetzung verlustfrei', async () => {
  const { api, context, run, storage, el } = fixture();
  let pending;
  context.FileReader = class {
    readAsText(file) { this.result = file.raw; pending = this.onload({ target: this }); }
  };
  run('initializeDataArchitecture();');
  const document = JSON.parse(api.serializeEventCollection([api.normalizeEvent(annual())], true));
  async function select(raw, callback = api.importData) {
    const text = JSON.stringify(raw);
    const input = { value: 'synthetisch.json', files: [{ raw: text, size: Buffer.byteLength(text) }] };
    callback({ target: input });
    await pending;
    assert.equal(input.value, '');
  }
  await select(document);
  assert.equal(run('eventStore.getEvents()[0].recurrence'), 'yearly');
  const before = storage.getItem(api.STORAGE_KEYS.events);
  await select({ ...document, schemaVersion: 99 });
  assert.equal(storage.getItem(api.STORAGE_KEYS.events), before);
  assert.match(el('backup-status').textContent, /Import fehlgeschlagen/);
  const backup = api.createFullBackupDocument([api.normalizeEvent(timed())]);
  await select(backup);
  assert.equal(run('eventStore.getEvents()[0].timeZone'), 'Europe/Berlin');
  assert.match(el('backup-status').textContent, /vollständig wiederhergestellt/);
  run('recoveryExpectedRaw = window.localStorage.getItem(STORAGE_KEYS.events);');
  await select(document, api.importRecoveryFile);
  assert.equal(run('eventStore.getEvents()[0].kind'), 'timed', 'vor Bestätigung kein Ersatz');
  const result = await run('recoveryPendingAction()');
  assert.equal(result.ok, true);
  assert.equal(run('eventStore.getEvents()[0].kind'), 'all-day');
  assert.equal(run('eventStore.getEvents()[0].recurrence'), 'yearly');
});
