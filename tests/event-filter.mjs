import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(resolve(import.meta.dirname, '../app.js'), 'utf8');
const start = source.indexOf('function normalizeSearchText(value) {');
const end = source.indexOf('function getEventRenderKey(event) {', start);
assert.ok(start >= 0 && end > start, 'Such- und Filterhelfer fehlen.');

const context = vm.createContext({ String });
vm.runInContext(`${source.slice(start, end)}\nthis.normalizeSearchText = normalizeSearchText; this.matchesEventFilter = matchesEventFilter;`, context);

test('findet deutsche Sonderzeichen und mehrteilige Eingaben nach der dokumentierten UND-Regel', () => {
  const event = { name: 'Müllers große Reise', desc: 'Straße zum Südsee-Urlaub', kind: 'all-day' };
  const model = { isPast: false };
  assert.equal(context.normalizeSearchText('MÜLLER ß'), 'muller ss');
  assert.equal(context.matchesEventFilter(event, model, { terms: ['muller', 'strasse'], time: 'all', kind: 'all' }), true);
  assert.equal(context.matchesEventFilter(event, model, { terms: ['muller', 'feier'], time: 'all', kind: 'all' }), false);
});

test('kombiniert Zeitlagen- und Artfilter ohne Datenänderung', () => {
  const allDay = { name: 'Urlaub', desc: '', kind: 'all-day' };
  const timed = { name: 'Termin', desc: '', kind: 'timed' };
  assert.equal(context.matchesEventFilter(allDay, { isPast: false }, { terms: [], time: 'future', kind: 'all-day' }), true);
  assert.equal(context.matchesEventFilter(timed, { isPast: false }, { terms: [], time: 'future', kind: 'all-day' }), false);
  assert.equal(context.matchesEventFilter(allDay, { isPast: true }, { terms: [], time: 'future', kind: 'all-day' }), false);
});
