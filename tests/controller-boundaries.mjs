import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const app = readFileSync(resolve(root, 'app.js'), 'utf8');
const start = app.indexOf('class EventUIController {');
const end = app.indexOf('function createEventControllerUi() {');
assert.ok(start > 0 && end > start);
const controllerSource = app.slice(start, end);

function fixture(events, { detail, editor } = {}) {
  const calls = [];
  const store = {
    state: { loadState: 'ok' },
    getEvent: id => events.get(id) || null,
    subscribe: () => () => {},
    upsert: async () => ({ ok: true }),
    remove: async () => ({ ok: true }),
    replaceAll: async () => ({ ok: true })
  };
  const sync = { publish: revision => calls.push(['publish', revision]), start: () => {} };
  const ui = {
    getDetailState: () => detail || { id: null, isOpen: false },
    getEditorState: () => editor || { id: null, isOpen: false },
    resetEditorState: () => calls.push(['reset-editor']),
    closeSheets: () => calls.push(['close-sheets']),
    updateDetail: event => calls.push(['update-detail', event.id]),
    setEditorStatus: message => calls.push(['editor-status', message]),
    renderEvents: () => calls.push(['render']),
    updateRecoveryStatus: () => calls.push(['recovery-status']),
    showMessage: message => calls.push(['message', message]),
    reportMutationFailure: message => calls.push(['failure', message]),
    openRecoveryDialog: () => calls.push(['open-recovery'])
  };
  const context = vm.createContext({
    console: { warn() {}, error() {} },
    eventsEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right)
  });
  vm.runInContext(`${controllerSource}\nthis.Controller = EventUIController;`, context);
  return { controller: new context.Controller(store, sync, ui), calls };
}

test('Controller aktualisiert Details über die explizite UI-Schnittstelle', () => {
  const event = { id: 'detail-1', name: 'Synthetisch' };
  const { controller, calls } = fixture(new Map([[event.id, event]]), {
    detail: { id: event.id, isOpen: true }
  });

  controller.handleStoreChange({ origin: 'storage', action: 'replace', revision: 'r1', state: { loadState: 'ok' } });

  assert.deepEqual(calls, [
    ['update-detail', 'detail-1'],
    ['render'],
    ['recovery-status'],
    ['message', 'Daten aus einem anderen Tab wurden übernommen.']
  ]);
});

test('Controller bewahrt einen extern geänderten Editorentwurf ohne DOM-Nachbildung', () => {
  const baseEvent = { id: 'edit-1', name: 'Alt' };
  const changedEvent = { id: 'edit-1', name: 'Neu' };
  const { controller, calls } = fixture(new Map([[changedEvent.id, changedEvent]]), {
    editor: { id: changedEvent.id, baseEvent, isOpen: true }
  });

  controller.handleStoreChange({ origin: 'broadcast', action: 'replace', revision: 'r2', state: { loadState: 'ok' } });

  assert.deepEqual(calls.slice(0, 3), [
    ['editor-status', 'Dieses Ereignis wurde in einem anderen Tab geändert. Dein Entwurf bleibt bis zur Konfliktentscheidung geöffnet.'],
    ['render'],
    ['recovery-status']
  ]);
});

test('Controller erhält den Bearbeitungskonflikt als expliziten Basisdatensatz', async () => {
  const event = { id: 'edit-2', name: 'Entwurf' };
  const baseEvent = { id: 'edit-2', name: 'Ausgang' };
  const { controller, calls } = fixture(new Map());
  controller.store.upsert = async (next, options) => {
    assert.equal(next, event);
    assert.equal(options.requireExisting, true);
    assert.deepEqual(options.baseEvent, baseEvent);
    return { ok: false, code: 'edit-conflict' };
  };

  const result = await controller.upsert(event, { wasEdit: true, baseEvent });

  assert.equal(result, false);
  assert.deepEqual(calls, [['failure', 'Dieses Ereignis wurde in einem anderen Tab geändert. Dein Entwurf bleibt geöffnet.']]);
});

test('Entfernte Normalisierungs- und Metadatenverträge haben keine Verbraucher mehr', () => {
  assert.doesNotMatch(app, /normalizeEvent\(raw, index/);
  assert.doesNotMatch(app, /updatedAt/);
  assert.doesNotMatch(app, /\bmigrated\b/);
  assert.match(app, /schemaVersion === DATA_SCHEMA_VERSION && Array\.isArray\(parsed\.events\)/);
});
