import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const projectRoot = resolve(import.meta.dirname, '..');
const appSource = readFileSync(resolve(projectRoot, 'app.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Startmarke fehlt: ${startMarker}`);
  assert.notEqual(end, -1, `Endmarke fehlt: ${endMarker}`);
  return appSource.slice(start, end);
}

function createCalendarContext() {
  const civilSource = sourceBetween('const MS_PER_SECOND', '/* ── CALCULATOR ── */');
  const differenceSource = sourceBetween(
    'function resolveCompatibleZonedComponents',
    'const flipClockStates'
  );
  const context = vm.createContext({ Date, Intl, Map, Math, Number, Object, Set, String });
  vm.runInContext(`${civilSource}\n${differenceSource}\n
    this.resolveZonedDateTime = resolveZonedDateTime;
    this.getZonedParts = getZonedParts;
    this.addZonedCalendarUnit = addZonedCalendarUnit;
    this.countWholeInstantUnits = countWholeInstantUnits;
    this.getDiff = getDiff;
  `, context);
  return context;
}

const calendar = createCalendarContext();
const allUnits = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'];

function values(diff) {
  return Object.fromEntries(diff.map(part => [part.unit, part.val]));
}

function parts(value) {
  return { ...value };
}

function zonedInstant(date, time, zone, disambiguation = 'earlier') {
  const result = calendar.resolveZonedDateTime(date, time, zone, disambiguation);
  assert.equal(result.ok, true, `${date} ${time} in ${zone} muss auflösbar sein`);
  return result.instant;
}

test('bewahrt beide Instanzen einer wiederholten Stunde bei Nulladdition', () => {
  const first = zonedInstant('2026-10-25', '02:30', 'Europe/Berlin', 'earlier');
  const second = zonedInstant('2026-10-25', '02:30', 'Europe/Berlin', 'later');

  assert.notEqual(first, second);
  for (const instant of [first, second]) {
    for (const unit of ['years', 'months', 'days']) {
      assert.equal(calendar.addZonedCalendarUnit(instant, 0, unit, 'Europe/Berlin'), instant);
    }
    assert.deepEqual(values(calendar.getDiff(instant, instant, allUnits)), {
      years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0
    });
  }
});

test('behält einen absoluten Minutenabstand in der zweiten Fold-Instanz bei', () => {
  const second = zonedInstant('2026-10-25', '02:30', 'Europe/Berlin', 'later');
  assert.deepEqual(values(calendar.getDiff(second + 60_000, second, allUnits)), {
    years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 1, seconds: 0
  });
});

test('verwendet bei Kalenderaddition in eine DST-Lücke die kompatibel verschobene Uhrzeit', () => {
  const start = zonedInstant('2026-03-28', '02:30', 'Europe/Berlin');
  const shifted = calendar.addZonedCalendarUnit(start, 1, 'days', 'Europe/Berlin');

  assert.deepEqual(
    parts(calendar.getZonedParts(shifted, 'Europe/Berlin')),
    { year: 2026, month: 3, day: 29, hour: 3, minute: 30, second: 0 }
  );
  assert.deepEqual(values(calendar.getDiff(shifted, start, ['days', 'hours', 'minutes'])), {
    days: 1, hours: 0, minutes: 0
  });
});

test('behält die bestehende frühere Wahl bei Addition in eine Fold-Stunde bei', () => {
  const start = zonedInstant('2026-10-24', '02:30', 'Europe/Berlin');
  const added = calendar.addZonedCalendarUnit(start, 1, 'days', 'Europe/Berlin');
  const firstFold = zonedInstant('2026-10-25', '02:30', 'Europe/Berlin', 'earlier');

  assert.equal(added, firstFold);
});

test('klemmt Monatsenden und Schalttage weiterhin kalendergerecht', () => {
  const januaryEnd = zonedInstant('2025-01-31', '12:00', 'Europe/Berlin');
  const leapDay = zonedInstant('2024-02-29', '12:00', 'Europe/Berlin');

  assert.deepEqual(parts(calendar.getZonedParts(
    calendar.addZonedCalendarUnit(januaryEnd, 1, 'months', 'Europe/Berlin'),
    'Europe/Berlin'
  )), { year: 2025, month: 2, day: 28, hour: 12, minute: 0, second: 0 });
  assert.deepEqual(parts(calendar.getZonedParts(
    calendar.addZonedCalendarUnit(leapDay, 1, 'years', 'Europe/Berlin'),
    'Europe/Berlin'
  )), { year: 2025, month: 2, day: 28, hour: 12, minute: 0, second: 0 });
});

function createTemporalTrackerContext() {
  let timeZone = 'Europe/Berlin';
  const trackerSource = sourceBetween('function getMonotonicTime', 'function detailNeedsSecondUpdates');
  const context = vm.createContext({
    Date,
    Math,
    CLOCK_JUMP_TOLERANCE_MS: 5000,
    getSystemTimeZone: () => timeZone,
    formatInstantDateKey: instant => new Date(instant).toISOString().slice(0, 10),
    performance: { now: () => 0 }
  });
  vm.runInContext(`${trackerSource}\nthis.TemporalContextTracker = TemporalContextTracker;`, context);
  return { context, setTimeZone: value => { timeZone = value; } };
}

test('erkennt Vorwärts- und Rückwärtssprünge der sichtbaren Systemuhr', () => {
  const { context } = createTemporalTrackerContext();
  const start = Date.UTC(2026, 5, 1, 12);
  const tracker = new context.TemporalContextTracker(start, 1000);

  assert.equal(tracker.observe(start + 30_000, 31_000).changed, false);
  const forward = tracker.observe(start + 2 * 86_400_000, 61_000);
  assert.equal(forward.changed, true);
  assert.equal(forward.clockJumped, true);
  assert.equal(forward.markerChanged, true);

  tracker.reset(start, 1000);
  const backward = tracker.observe(start - 3_600_000, 31_000);
  assert.equal(backward.changed, true);
  assert.equal(backward.clockJumped, true);
});

test('erkennt Mitternacht und einen Wechsel der Systemzeitzone', () => {
  const { context, setTimeZone } = createTemporalTrackerContext();
  const beforeMidnight = Date.UTC(2026, 5, 1, 23, 59, 50);
  const tracker = new context.TemporalContextTracker(beforeMidnight, 1000);

  const midnight = tracker.observe(beforeMidnight + 20_000, 21_000);
  assert.equal(midnight.changed, true);
  assert.equal(midnight.clockJumped, false);
  assert.equal(midnight.markerChanged, true);

  tracker.reset(beforeMidnight, 1000);
  setTimeZone('America/New_York');
  const zone = tracker.observe(beforeMidnight + 30_000, 31_000);
  assert.equal(zone.changed, true);
  assert.equal(zone.clockJumped, false);
  assert.equal(zone.markerChanged, true);
});

function createCadenceContext() {
  const cadenceSource = sourceBetween('function detailNeedsSecondUpdates', 'function tick');
  const state = {
    detailOpen: false,
    detailEvent: null,
    listNeedsSeconds: false
  };
  const context = vm.createContext({
    ACTIVE_UPDATE_INTERVAL_MS: 1000,
    TEMPORAL_CHECK_INTERVAL_MS: 30_000,
    sheetState: { detail: { id: null } },
    detailSheet: { classList: { contains: () => state.detailOpen } },
    eventStore: { getEvent: () => state.detailEvent },
    eventRenderer: { needsSecondUpdates: () => state.listNeedsSeconds },
    liveScheduler: null
  });
  vm.runInContext(`${cadenceSource}\nthis.getLiveUpdateIntervalMs = getLiveUpdateIntervalMs;`, context);
  return { context, state };
}

test('verwendet für leere und reine Ganztagslisten keinen Sekundentakt', () => {
  const { context, state } = createCadenceContext();
  assert.equal(context.getLiveUpdateIntervalMs(), 30_000);
  state.detailOpen = true;
  context.sheetState.detail.id = 'all-day';
  state.detailEvent = { kind: 'all-day', units: ['days'], refDate: '' };
  assert.equal(context.getLiveUpdateIntervalMs(), 30_000);
});

test('aktiviert den Sekundentakt nur für sichtbaren Sekunden- oder Fortschrittsbedarf', () => {
  const { context, state } = createCadenceContext();
  state.listNeedsSeconds = true;
  assert.equal(context.getLiveUpdateIntervalMs(), 1000);

  state.listNeedsSeconds = false;
  state.detailOpen = true;
  context.sheetState.detail.id = 'timed';
  state.detailEvent = { kind: 'timed', units: ['minutes'], refDate: '' };
  assert.equal(context.getLiveUpdateIntervalMs(), 30_000);

  state.detailEvent = { kind: 'timed', units: ['seconds'], refDate: '' };
  assert.equal(context.getLiveUpdateIntervalMs(), 1000);
  state.detailEvent = { kind: 'timed', units: ['minutes'], refDate: '2026-01-01' };
  assert.equal(context.getLiveUpdateIntervalMs(), 1000);
});

test('bewertet nur sichtbare Karten als sekündlich aktualisierungsbedürftig', () => {
  const rendererSource = sourceBetween('class EventListRenderer', 'function renderEvents');
  const context = vm.createContext({});
  vm.runInContext(`${rendererSource}\nthis.EventListRenderer = EventListRenderer;`, context);
  const renderer = Object.create(context.EventListRenderer.prototype);
  renderer.views = new Map([
    ['hidden', {
      isVisible: false,
      event: { kind: 'timed', units: ['seconds'], refDate: '' }
    }],
    ['all-day', {
      isVisible: true,
      event: { kind: 'all-day', units: ['seconds'], refDate: '2026-01-01' }
    }]
  ]);
  assert.equal(renderer.needsSecondUpdates(), false);

  renderer.views.set('visible', {
    isVisible: true,
    event: { kind: 'timed', units: ['minutes'], refDate: '2026-01-01' }
  });
  assert.equal(renderer.needsSecondUpdates(), true);
});

test('pausiert den Live-Timer verborgen und prüft beim Wiedereinblenden sofort', () => {
  const schedulerSource = sourceBetween('class SelfCorrectingScheduler', 'function nextLocalDayBoundary');
  let nextTimerId = 0;
  const timers = new Map();
  const listeners = new Map();
  const document = {
    hidden: false,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type)
  };
  const context = vm.createContext({
    Date,
    Math,
    document,
    setTimeout: (callback, delay) => {
      const id = ++nextTimerId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(`${schedulerSource}\nthis.SelfCorrectingScheduler = SelfCorrectingScheduler;`, context);

  const calls = [];
  const scheduler = new context.SelfCorrectingScheduler(force => calls.push(force), 30_000);
  scheduler.start();
  assert.deepEqual(calls, [true]);
  assert.equal(timers.size, 1);

  document.hidden = true;
  listeners.get('visibilitychange')();
  assert.equal(timers.size, 0);

  document.hidden = false;
  listeners.get('visibilitychange')();
  assert.deepEqual(calls, [true, true]);
  assert.equal(timers.size, 1);
});
