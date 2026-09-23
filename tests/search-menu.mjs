import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

function fixture() {
  let focus = null;
  const element = (dataset = {}) => {
    const classes = new Set();
    const attributes = new Map();
    return {
      dataset, hidden: false, inert: false, value: '', textContent: '', style: {}, offsetHeight: 0,
      classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: (...names) => names.forEach(name => classes.delete(name)), toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) },
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: name => attributes.get(name),
      removeAttribute: name => attributes.delete(name),
      toggleAttribute: (name, value) => value ? attributes.set(name, '') : attributes.delete(name),
      focus() { focus = this; }, contains: () => false,
      querySelector: () => element(),
      closest: () => null
    };
  };
  const elements = new Map();
  const el = name => { if (!elements.has(name)) elements.set(name, element()); return elements.get(name); };
  const state = { time: 'all', kind: 'all' };
  const chips = [['time', 'future'], ['time', 'past'], ['kind', 'all-day'], ['kind', 'timed']].map(([filter, value]) => element({ filter, value }));
  const timers = new Map();
  const context = vm.createContext({
    String, Array, parseFloat, HTMLElement: Object, getComputedStyle: () => ({ getPropertyValue: () => '200ms' }),
    setTimeout: callback => { const id = Symbol(); timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id), requestAnimationFrame: callback => callback(),
    document: { activeElement: null, getElementById: el, querySelector: selector => selector === 'dialog[open]' ? null : el('app-bar'), body: el('body') },
    eventFilterState: state, filterChips: chips, eventSearchInput: el('event-search'),
    eventFilterReset: el('event-filter-reset'), eventFilterStatus: el('event-filter-status'),
    searchToggleBtn: el('search-toggle-btn'), searchDock: el('event-search-panel'), searchClearBtn: el('event-search-clear'),
    searchDockOpen: false, searchCloseTimer: null, searchInputTimer: null, activeTab: 0,
    listCaptions: [el('caption')], defaultListCaptions: ['Standard'], reducedMotionQuery: { matches: false },
    menuPopup: el('menu-popup'), menuLevel: 'root', menuModalActive: false,
    mobileMenuQuery: { matches: true }, backdrop: el('backdrop'),
    recoveryDialog: { open: false }, editSheet: el('edit-sheet'), detailSheet: el('detail-sheet'),
    getOpenSheet: () => null, setModalBackgroundInert: inert => { el('app').inert = inert; },
    renderEvents: () => vm.runInContext('updateEventFilterStatus(2, 5, getEventFilter()); updateSearchTriggerState();', context)
  });
  context.trapFocus = () => {};
  context.tabBar = { contains: () => false };
  context.document.activeElement = { closest: () => null, matches: () => false };
  const helpers = source.slice(source.indexOf('function normalizeSearchText(value) {'), source.indexOf('function getEventRenderKey(event) {'));
  const ui = source.slice(source.indexOf('function setSearchDockOpen('), source.indexOf('/* ── PREFERENCES'));
  const keyboard = source.slice(source.indexOf('function handleGlobalKeydown(event) {'), source.indexOf('function trapFocus(event) {'));
  vm.runInContext(helpers + ui + keyboard, context);
  return { context, state, chips, el, timers, run: code => vm.runInContext(code, context), focus: () => focus };
}

test('P19: Chips bilden alte Filterwerte ab, sind exklusiv und abwählbar', () => {
  const f = fixture();
  const handler = source.slice(source.indexOf('    const { filter, value } = chip.dataset;'), source.indexOf("  document.getElementById('menu-close-btn').addEventListener"));
  const body = handler.slice(0, handler.lastIndexOf('  }));'));
  const click = index => { f.context.chip = f.chips[index]; f.run(`(() => { ${body} })()`); };
  click(0); click(2);
  assert.equal(f.run('getEventFilter().time'), 'future');
  assert.equal(f.run('getEventFilter().kind'), 'all-day');
  click(1);
  assert.equal(f.chips[0].getAttribute('aria-pressed'), 'false');
  assert.equal(f.run('getEventFilter().time'), 'past');
  click(1); click(3); click(3);
  assert.equal(f.run('getEventFilter().time'), 'all');
  assert.equal(f.run('getEventFilter().kind'), 'all');
  f.el('event-search').value = 'MÜLLER Straße';
  assert.equal(JSON.stringify(f.run('getEventFilter().terms')), '["muller","strasse"]');
});

test('P19: Schließen bewahrt Filter und erklärt Treffer; Reset leert alle Gruppen', () => {
  const f = fixture();
  f.el('event-search').value = 'Urlaub'; f.state.kind = 'timed';
  f.run('setSearchDockOpen(true)');
  assert.equal(f.focus(), f.el('event-search'));
  f.run('setSearchDockOpen(false)');
  assert.equal(f.run('getEventFilter().kind'), 'timed');
  assert.equal(f.el('search-toggle-btn').getAttribute('aria-label'), 'Suche öffnen, Filter aktiv');
  assert.equal(f.el('caption').textContent, '2 von 5 Ereignissen gefunden.');
  assert.equal(f.focus(), f.el('search-toggle-btn'));
  f.run('resetEventFilters()');
  assert.equal(f.el('event-search').value, '');
  assert.equal(f.state.kind, 'all');
  assert.equal(f.el('caption').textContent, 'Standard');
  assert.equal(f.el('event-filter-reset').hidden, true);
});

test('P19: Rechner und offene Dialoge sperren die Suche', () => {
  const f = fixture();
  f.run('activeTab = 2; setSearchDockOpen(true)');
  assert.equal(f.run('searchDockOpen'), false);
  f.run('activeTab = 0; recoveryDialog.open = true; setSearchDockOpen(true)');
  assert.equal(f.run('searchDockOpen'), false);
});

test('P19: Menüwechsel setzt Inertheit, Rückfokus und mobilen Modalzustand', () => {
  const f = fixture();
  f.run('setMenuOpen(true); setMenuLevel("data")');
  assert.equal(f.el('app').inert, true);
  assert.equal(f.el('menu-root').inert, true);
  assert.equal(f.el('menu-data').inert, false);
  assert.equal(f.el('menu-popup').getAttribute('aria-modal'), 'true');
  assert.equal(f.focus(), f.el('menu-back-btn'));
  f.run('setMenuLevel("root")');
  assert.equal(f.focus(), f.el('menu-data-btn'));
  f.run('setMenuLevel("data"); setMenuOpen(false)');
  assert.equal(f.run('menuLevel'), 'root');
  assert.equal(f.el('app').inert, false);
  assert.equal(f.el('menu-popup').inert, true);
  f.run('mobileMenuQuery.matches = false; setMenuOpen(true)');
  assert.equal(f.el('menu-popup').getAttribute('aria-modal'), undefined);
});

test('P19: Pfeiltasten, Home und End wechseln Radioauswahl und Fokus', () => {
  const f = fixture();
  const buttons = [0, 1, 2].map(i => ({ click() { this.selected = true; }, focus() { f.context.document.activeElement = this; } }));
  const group = { querySelectorAll: () => buttons };
  f.context.document.activeElement = buttons[0];
  f.context.event = { key: 'ArrowLeft', currentTarget: group, preventDefault() {} };
  f.run('handleRadioGroupKeydown(event)');
  assert.equal(f.context.document.activeElement, buttons[2]);
  f.context.event.key = 'Home'; f.run('handleRadioGroupKeydown(event)');
  assert.equal(f.context.document.activeElement, buttons[0]);
});

test('P19: Datenaktionen liegen ausschließlich auf Ebene zwei, alle IDs bleiben eindeutig', () => {
  const data = markup.slice(markup.indexOf('id="menu-data"'), markup.indexOf('<div class="backdrop"'));
  for (const id of ['install-btn', 'backup-export-btn', 'export-btn', 'calendar-export-btn', 'import-btn', 'recovery-btn', 'clear-btn']) {
    assert.ok(data.includes(`id="${id}"`));
    assert.equal(markup.split(`id="${id}"`).length, 2);
  }
  assert.match(data, /class="menu-group menu-danger-group"[^>]+aria-labelledby="danger-heading"/);
  assert.match(data, /id="recovery-btn"[\s\S]*<\/section>\s*<section class="menu-group menu-danger-group"[\s\S]*id="clear-btn"/);
  assert.match(source, /async clearAll\(\) \{\s*this\.ui\.openRecovery\(\)/);
  assert.match(source, /function prepareRecoveryDeletion\(variant\)/);
  assert.match(markup, /id="recovery-confirm-btn"/);
  assert.doesNotMatch(markup, /event-time-filter|event-kind-filter|class="event-filter"/);
  assert.match(markup, /id="event-search"[^>]+aria-label="Ereignisse durchsuchen"/);
  assert.match(markup, /id="search-toggle-btn" class="search-anchor/);
  assert.match(styles, /\.search-dock \{\s*position: fixed/);
  assert.equal((markup.match(/role="radio"/g) || []).length, 5);
  assert.doesNotMatch(markup, /<style| style=| onclick=/);
});


test('P19: Menüüffnung schließt die Suche, Escape führt über Datenebene zurück', () => {
  const f = fixture();
  f.context.event = { key: 'Escape', preventDefault() {} };
  f.run('setSearchDockOpen(true); setMenuOpen(true); setMenuLevel("data"); handleGlobalKeydown(event)');
  assert.equal(f.run('menuLevel'), 'root');
  assert.equal(f.el('menu-popup').classList.contains('open'), true);
  assert.equal(f.run('searchDockOpen'), false);
  f.run('handleGlobalKeydown(event)');
  assert.equal(f.el('menu-popup').classList.contains('open'), false);
  f.run('setSearchDockOpen(true); handleGlobalKeydown(event)');
  assert.equal(f.run('searchDockOpen'), false);
});

test('P19: Suchkürzel respektieren Eingabefelder, Rechner und Menü', () => {
  const f = fixture();
  f.context.event = { key: '/', preventDefault() {} };
  f.run('handleGlobalKeydown(event)');
  assert.equal(f.run('searchDockOpen'), true);
  f.run('setSearchDockOpen(false)');
  f.context.document.activeElement.closest = () => ({});
  f.run('handleGlobalKeydown(event)');
  assert.equal(f.run('searchDockOpen'), false);
  f.context.document.activeElement.closest = () => null;
  f.context.event = { key: 'k', ctrlKey: true, preventDefault() {} };
  f.run('handleGlobalKeydown(event)');
  assert.equal(f.run('searchDockOpen'), true);
  f.run('setSearchDockOpen(false); activeTab = 2; handleGlobalKeydown(event)');
  assert.equal(f.run('searchDockOpen'), false);
  f.run('activeTab = 0; setMenuOpen(true); handleGlobalKeydown(event)');
  assert.equal(f.run('searchDockOpen'), false);
});

test('P19: Eingaben bündeln Rendern und Zurücksetzen verwirft ausstehende Eingaben', () => {
  const f = fixture();
  const start = source.indexOf("  eventSearchInput.addEventListener('input', () => {");
  const body = source.slice(source.indexOf('{', start) + 1, source.indexOf('  });', start));
  f.run(`(() => { ${body} })()`);
  f.run(`(() => { ${body} })()`);
  assert.equal(f.timers.size, 1);
  f.run('resetEventFilters()');
  assert.equal(f.timers.size, 0);
});


test('P19: Neue Häkchen überschreiben das versteckte Basissymbol des Editors', () => {
  assert.match(styles, /\.chip-check \{ display: none;/);
  assert.match(styles, /\.filter-chip \.chip-check \{ display: block;/);
  assert.match(styles, /#menu-popup \.color-btn \.chip-check \{ display: block;/);
  assert.match(styles, /\.filter-chip\[aria-pressed="true"\] \.chip-check \{[^}]*transform: scale\(1\)/);
  assert.match(styles, /\.color-btn:not\(\.active\) \.chip-check \{ visibility: hidden;/);
});
