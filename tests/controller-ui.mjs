import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(resolve(import.meta.dirname, '../app.js'), 'utf8');
const start = source.indexOf('class EventUIController {');
const end = source.indexOf('function createEventControllerUI()', start);
assert.ok(start >= 0 && end > start, 'Controller-Grenzen fehlen.');
const context = vm.createContext({ console });
vm.runInContext(`${source.slice(start, end)}\nthis.EventUIController = EventUIController;`, context);

function fixture() {
  const calls = [];
  let listener;
  let onSnapshot;
  let onLegacyPeer;
  let nextResult = { ok: true };
  const baseEvent = { id: 'a', name: 'Ausgang' };
  const store = {
    state: { loadState: 'ok' },
    subscribe(callback) { listener = callback; return () => {}; },
    getEvent(id) { calls.push(['getEvent', id]); return baseEvent; },
    upsert(event, options) { calls.push(['upsert', event, options]); return Promise.resolve(nextResult); },
    remove(id, base) { calls.push(['remove', id, base]); return Promise.resolve(nextResult); },
    replaceAll(events) { calls.push(['replaceAll', events]); return Promise.resolve(nextResult); },
    protectAfterExternalLoadFailure() { calls.push(['protect']); },
    applyExternal() { calls.push(['apply']); return { ok: true }; },
    blockWritesForLegacyPeer() { calls.push(['block']); return true; }
  };
  const sync = {
    start(snapshot, legacy) { onSnapshot = snapshot; onLegacyPeer = legacy; },
    publish(revision) { calls.push(['publish', revision]); }
  };
  const ui = {
    notify(message) { calls.push(['notify', message]); },
    getEditBaseEvent() { calls.push(['base']); return baseEvent; },
    closeAfterSave() { calls.push(['close']); },
    openRecovery() { calls.push(['recovery']); },
    reportFailure(message) { calls.push(['failure', message]); },
    refresh(change, owner) { calls.push(['refresh', change.origin, owner === store]); }
  };
  const controller = new context.EventUIController(store, sync, ui);
  controller.connect();
  return { calls, store, controller, emit: change => listener(change), snapshot: (value, origin) => onSnapshot(value, origin), legacy: () => onLegacyPeer(), fail: code => { nextResult = { ok: false, code }; } };
}

test('Anlegen und Bearbeiten reichen Ausgangsdatensatz nur bei Bearbeitung weiter und schließen nach Erfolg', async () => {
  const f = fixture();
  await f.controller.upsert({ id: 'n' }, false);
  await f.controller.upsert({ id: 'a' }, true);
  assert.deepEqual(f.calls.filter(call => call[0] === 'upsert').map(call => call[2].requireExisting), [false, true]);
  assert.equal(f.calls.filter(call => call[0] === 'base').length, 1);
  assert.equal(f.calls.filter(call => call[0] === 'close').length, 2);
  assert.deepEqual(f.calls.filter(call => call[0] === 'notify').map(call => call[1]), ['Erstellt.', 'Geändert.']);
});

test('Konflikt und Speicherfehler lassen den Editor offen; Löschen und Import melden erst bestätigten Erfolg', async () => {
  const f = fixture();
  f.fail('edit-conflict');
  assert.equal(await f.controller.upsert({ id: 'a' }, true), false);
  assert.equal(f.calls.some(call => call[0] === 'close'), false);
  assert.match(f.calls.at(-1)[1], /Entwurf bleibt geöffnet/);
  f.fail('lock-unavailable');
  assert.equal(await f.controller.importEvents([{ id: 'n' }]), false);
  assert.match(f.calls.at(-1)[1], /nicht unterstützt/);
  const g = fixture();
  await g.controller.deleteById('a');
  await g.controller.importEvents([{ id: 'n' }]);
  assert.equal(g.calls.find(call => call[0] === 'remove')[2], g.store.getEvent('a'));
  assert.deepEqual(g.calls.filter(call => call[0] === 'notify').map(call => call[1]), ['Gelöscht.', '1 Ereignis importiert.']);
});

test('Store-, Rettungs- und Synchronisationszustände laufen über kontrollierte UI-Callbacks', async () => {
  const f = fixture();
  f.emit({ origin: 'local', revision: 'r1', action: 'create' });
  f.emit({ origin: 'storage', revision: 'r2', action: 'replace', state: { loadState: 'ok' } });
  assert.deepEqual(f.calls.filter(call => call[0] === 'refresh').map(call => call.slice(1)), [['local', true], ['storage', true]]);
  assert.deepEqual(f.calls.filter(call => call[0] === 'publish').map(call => call[1]), ['r1']);
  f.snapshot({ ok: false }, 'storage');
  f.store.state.loadState = 'read-error';
  f.snapshot({ ok: true, writeProtected: false }, 'broadcast');
  f.legacy();
  await f.controller.clearAll();
  assert.equal(f.calls.filter(call => call[0] === 'recovery').length, 1);
  assert.equal(f.calls.filter(call => call[0] === 'protect').length, 1);
  assert.equal(f.calls.filter(call => call[0] === 'apply').length, 1);
  assert.equal(f.calls.filter(call => call[0] === 'block').length, 1);
  assert.ok(f.calls.filter(call => call[0] === 'notify').some(call => /Schreibschutz ist aufgehoben/.test(call[1])));
});
