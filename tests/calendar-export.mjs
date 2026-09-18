import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function fixture() {
  const element = {
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    style: { setProperty() {} }, dataset: {}, addEventListener() {}, removeAttribute() {},
    setAttribute() {}, appendChild() {}, remove() {}, querySelectorAll() { return []; }
  };
  const document = {
    currentScript: { src: 'https://example.test/tageszaehler/app.js' },
    documentElement: { dataset: {} }, body: element, hidden: false,
    getElementById: () => element, querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ ...element }), createElementNS: () => ({ ...element }),
    addEventListener() {}, removeEventListener() {}
  };
  const context = vm.createContext({
    Date, Intl, URL, TextEncoder, DOMException, Blob, document,
    window: { localStorage: {}, navigator: {}, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    localStorage: {}, HTMLElement: class {}, console: { warn() {}, error() {} },
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: callback => callback(),
    history: { pushState() {}, back() {} }, confirm: () => true,
    getComputedStyle: () => ({ getPropertyValue: () => '0ms' })
  });
  vm.runInContext(source.replace(/\ninit\(\);\s*$/, ''), context);
  return vm.runInContext(`({ serializeICalendar, escapeICalendarText, foldICalendarLine })`, context);
}

function allDay(patch = {}) {
  return {
    id: 'all-day', name: 'Ganztag', kind: 'all-day', date: '2026-06-15',
    time: '', timeZone: '', disambiguation: '', refDate: '', desc: '',
    units: ['days'], img: null, ...patch
  };
}

function timed(patch = {}) {
  return {
    ...allDay(), id: 'timed', name: 'Uhrzeit', kind: 'timed', date: '2026-06-15',
    time: '12:00', timeZone: 'Europe/Berlin', disambiguation: 'earlier', ...patch
  };
}

test('P17: UTF-8, Textmaskierung, CRLF und 75-Oktett-Faltung', () => {
  const { serializeICalendar, escapeICalendarText } = fixture();
  assert.equal(escapeICalendarText('A\\B, C; D\r\nZeile 2'), 'A\\\\B\\, C\\; D\\nZeile 2');
  const calendar = serializeICalendar([allDay({
    name: `Langer Titel ${'😀'.repeat(30)}`,
    desc: 'Erste Zeile\nZweite Zeile mit Umlauten: äöü, Semikolon; und \\.'
  })], Date.parse('2026-01-02T03:04:05Z'));
  assert.ok(calendar.endsWith('\r\n'));
  assert.doesNotMatch(calendar.replaceAll('\r\n', ''), /\n|\r/);
  calendar.split('\r\n').filter(Boolean).forEach(line => {
    assert.ok(new TextEncoder().encode(line).byteLength <= 75, line);
  });
  assert.match(calendar, /DTSTAMP:20260102T030405Z/);
  assert.match(calendar.replace(/\r\n /g, ''), /DESCRIPTION:Erste Zeile\\nZweite Zeile mit Umlauten: äöü\\, Semikolon\\; und \\\\\./);
});

test('P17: Ganztag und einzelne Uhrzeiten einschließlich beider Fold-Instanzen', () => {
  const { serializeICalendar } = fixture();
  const calendar = serializeICalendar([
    allDay(),
    timed({ id: 'fold-early', date: '2026-10-25', time: '02:30' }),
    timed({ id: 'fold-late', date: '2026-10-25', time: '02:30', disambiguation: 'later' }),
    timed({ id: 'new-york', date: '2026-07-04', time: '09:15', timeZone: 'America/New_York' })
  ], 0);
  assert.match(calendar, /DTSTART;VALUE=DATE:20260615/);
  assert.match(calendar, /DTSTART:20261025T003000Z/);
  assert.match(calendar, /DTSTART:20261025T013000Z/);
  assert.match(calendar, /DTSTART:20260704T131500Z/);
  const uids = [...calendar.matchAll(/UID:([^\r]+)/g)].map(match => match[1]);
  assert.equal(new Set(uids).size, 4);
});

test('P17: jährlicher Schaltag verwendet die P16-Klemmregel', () => {
  const { serializeICalendar } = fixture();
  const calendar = serializeICalendar([allDay({ date: '2000-02-29', recurrence: 'yearly' })], 0);
  assert.match(calendar, /DTSTART;VALUE=DATE:20000229/);
  assert.match(calendar, /RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1/);
});

test('P17: jährliche Lücken und spätere Fold-Instanzen erhalten UTC-Korrekturen', () => {
  const { serializeICalendar } = fixture();
  const calendar = serializeICalendar([
    timed({ id: 'gap', date: '2026-03-29', time: '02:30', recurrence: 'yearly' }),
    timed({ id: 'later', date: '2025-10-25', time: '02:30', disambiguation: 'later', recurrence: 'yearly' })
  ], 0).replace(/\r\n /g, '');
  assert.match(calendar, /DTSTART;TZID=Europe\/Berlin:20260329T023000/);
  assert.match(calendar, /EXDATE;TZID=Europe\/Berlin:[^\r]*20260329T023000/);
  assert.match(calendar, /RDATE:[^\r]*20260329T013000Z/);
  assert.match(calendar, /EXDATE;TZID=Europe\/Berlin:[^\r]*20261025T023000/);
  assert.match(calendar, /RDATE:[^\r]*20261025T013000Z/);
});
