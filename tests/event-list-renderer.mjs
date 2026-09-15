import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(resolve(import.meta.dirname, '../app.js'), 'utf8');
const cacheStart = source.indexOf('function getEventRenderKey(event) {');
const cacheEnd = source.indexOf('class EventListRenderer {', cacheStart);
const differenceStart = source.indexOf('function getCachedViewDifference(view, nowTime) {');
const differenceEnd = source.indexOf('class EventListRenderer {', differenceStart);
assert.ok(cacheStart >= 0 && cacheEnd > cacheStart, 'Renderer-Modellcache fehlt.');
assert.ok(differenceStart >= 0 && differenceEnd > differenceStart, 'Differenzcache fehlt.');

const cacheContext = vm.createContext({ Map, Set });
vm.runInContext(`${source.slice(cacheStart, cacheEnd)}
this.EventListModelCache = EventListModelCache;`, cacheContext);
const differenceContext = vm.createContext({
  eventDifference(event, model, nowTime) {
    differenceContext.calls++;
    return [{ unit: 'seconds', val: nowTime + model.offset + event.offset }];
  },
  calls: 0
});
vm.runInContext(`${source.slice(differenceStart, differenceEnd)}
this.getCachedViewDifference = getCachedViewDifference;`, differenceContext);

function event(id, patch = {}) {
  return {
    id, name: `Ereignis ${id}`, kind: 'timed', date: '2030-01-01', time: '12:00',
    timeZone: 'Europe/Berlin', disambiguation: 'earlier', refDate: '', img: '', units: ['days'],
    ...patch
  };
}

function prepare(cache, events, patch = {}, createModel) {
  return cache.prepare(events, {
    nowTime: 1000,
    viewerTimeZone: 'Europe/Berlin',
    viewerToday: '2030-01-01',
    forceTemporal: false,
    ...patch
  }, createModel);
}

test('bereitet bei einer Einzeländerung nur das betroffene synthetische Ereignis neu vor', () => {
  const cache = new cacheContext.EventListModelCache();
  let calls = 0;
  const createModel = item => ({ id: item.id, version: ++calls });
  const initial = [event('a'), event('b'), event('c')];

  prepare(cache, initial, {}, createModel);
  assert.equal(calls, 3);
  const changed = initial.map(item => item.id === 'b' ? event('b', { name: 'Geändert' }) : { ...item });
  const result = prepare(cache, changed, {}, createModel);

  assert.equal(calls, 4);
  assert.equal(result.stats.modelCalculations, 1);
  assert.equal(result.stats.reusedModels, 2);
  assert.equal(result.stats.removedEntries, 0);
  assert.equal(result.stats.temporalChanged, false);
  assert.equal(result.prepared.find(item => item.event.id === 'a').model.version, 1);
  assert.equal(result.prepared.find(item => item.event.id === 'b').model.version, 4);
});

test('grenzt Modellzwischenwerte auf aktive Ereignisse ein und skaliert bei großen Sammlungen', () => {
  const cache = new cacheContext.EventListModelCache();
  let calls = 0;
  const createModel = item => ({ id: item.id, version: ++calls });
  const initial = Array.from({ length: 400 }, (_, index) => event(`e-${index}`));

  prepare(cache, initial, {}, createModel);
  const changed = initial.map(item => item.id === 'e-211' ? event(item.id, { units: ['hours'] }) : { ...item });
  const oneChange = prepare(cache, changed, {}, createModel);
  assert.equal(oneChange.stats.modelCalculations, 1);
  assert.equal(oneChange.stats.reusedModels, 399);

  const withoutDeleted = changed.filter(item => item.id !== 'e-399');
  const deletion = prepare(cache, withoutDeleted, {}, createModel);
  assert.equal(deletion.stats.removedEntries, 1);
  assert.equal(cache.entries.has('e-399'), false);
  assert.equal(cache.entries.size, 399);
});

test('Zeit-, Tages- und Zeitzonenwechsel invalidieren die wiederverwendeten Modelle', () => {
  const cache = new cacheContext.EventListModelCache();
  let calls = 0;
  const createModel = item => ({ id: item.id, version: ++calls });
  const events = Array.from({ length: 5 }, (_, index) => event(`t-${index}`));

  prepare(cache, events, {}, createModel);
  const sameStep = prepare(cache, events.map(item => ({ ...item })), {}, createModel);
  assert.equal(sameStep.stats.modelCalculations, 0);
  assert.equal(sameStep.stats.reusedModels, 5);

  const midnight = prepare(cache, events, { viewerToday: '2030-01-02' }, createModel);
  assert.equal(midnight.stats.modelCalculations, 5);
  const zone = prepare(cache, events, { viewerTimeZone: 'America/New_York', viewerToday: '2030-01-01' }, createModel);
  assert.equal(zone.stats.modelCalculations, 5);
  const clock = prepare(cache, events, { forceTemporal: true }, createModel);
  assert.equal(clock.stats.modelCalculations, 5);
});

test('teilt berechnete Differenzen innerhalb eines Schritts und hält Sichtbarkeits- und Ansichtswechsel gezielt', () => {
  const view = {
    event: { offset: 1 },
    model: { viewerToday: '2030-01-01', offset: 2 },
    difference: null,
    differenceKey: '',
    differenceCalculations: 0
  };
  differenceContext.calls = 0;
  differenceContext.getCachedViewDifference(view, 1000);
  differenceContext.getCachedViewDifference(view, 1000);
  assert.equal(differenceContext.calls, 1);
  assert.equal(view.differenceCalculations, 1);
  differenceContext.getCachedViewDifference(view, 1001);
  assert.equal(differenceContext.calls, 2);

  assert.match(source, /if \(view\.isVisible\) this\.updateLiveView\(view, now, true, viewerToday\);/);
  assert.match(source, /const viewModeChanged = view\.viewModeKey !== viewMode;/);
  assert.match(source, /if \(eventRenderer && eventStore\) renderEvents\(\);/);
});
