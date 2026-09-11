/* ── APP STATE & CONSTANTS ── */
const ALLOWED_UNITS = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'];
const DEFAULT_UNITS = ['years', 'months', 'weeks', 'days', 'seconds'];
const DATA_SCHEMA_VERSION = 2;
const EVENT_WRITE_LOCK_NAME = 'tageszaehler-events-v2-write';
const WRITE_PROTOCOL_VERSION = 2;
const STORAGE_KEYS = Object.freeze({
  events: 'events',
  quarantine: 'tageszaehler:events:quarantine:v1',
  quarantineMeta: 'tageszaehler:events:quarantine-meta:v1'
});
const DATA_LIMITS = Object.freeze({
  maxEvents: 1000,
  maxImportBytes: 8 * 1024 * 1024,
  maxStoredJsonChars: 8 * 1024 * 1024,
  maxNameChars: 200,
  maxDescriptionChars: 4000,
  maxIdChars: 128,
  maxImageSourceChars: 1_500_000,
  maxTotalImageChars: 4_000_000,
  maxUrlChars: 4096,
  maxQuarantineEntries: 5,
  maxQuarantineRawChars: 1_500_000
});
let dataLoadWarning = null;
let eventRepository = null;
let eventStore = null;
let eventSync = null;
let eventController = null;
let eventRenderer = null;
let liveScheduler = null;
let midnightScheduler = null;
let activeTab = 0;
let currentDetailId = null;
let detailNextUpdateAt = 0;
let detailNextClockUpdateAt = 0;
let detailNextProgressUpdateAt = 0;
let currentEditId = null;
let currentEditBaseEvent = null;
let currentEditTimeZone = null;
let imgData = null;
let imageCompressionController = null;
let imageCompressionToken = 0;
let imageProcessing = false;
let eventSavePending = false;
let imagePreviewToken = 0;
let deferredInstallPrompt = null;
let modalHistoryActive = false;
let lastFocusedElement = null;
let snackbarTimer = null;
let tabIndicatorFrame = null;
let serviceWorkerRegistration = null;
let serviceWorkerUpdateNotified = false;
let flipSummarySequence = 0;
let eventViewSequence = 0;

const unitTranslations = {
  years: 'Jahre', months: 'Monate', weeks: 'Wochen',
  days: 'Tage', hours: 'Std', minutes: 'Min', seconds: 'Sek'
};
const unitSpokenForms = Object.freeze({
  years: ['Jahr', 'Jahre'],
  months: ['Monat', 'Monate'],
  weeks: ['Woche', 'Wochen'],
  days: ['Tag', 'Tage'],
  hours: ['Stunde', 'Stunden'],
  minutes: ['Minute', 'Minuten'],
  seconds: ['Sekunde', 'Sekunden']
});

/* ── DOM ELEMENTS ── */
const tabBar = document.getElementById('tab-bar');
const tabItems = Array.from(document.querySelectorAll('.tab-item'));
const tabContents = Array.from(document.querySelectorAll('.tab-content'));
const tabIndicator = document.getElementById('tab-indicator');
const mainContent = document.getElementById('main-content');
const backdrop = document.getElementById('backdrop');
const menuPopup = document.getElementById('menu-popup');
const detailSheet = document.getElementById('detail-sheet');
const editSheet = document.getElementById('edit-sheet');
const addBtn = document.getElementById('add-btn');
const installBtn = document.getElementById('install-btn');
const appMenuTitle = document.getElementById('app-menu-title');
const themeColorMeta = document.getElementById('theme-color-meta');
const futureList = document.getElementById('future-list');
const pastList = document.getElementById('past-list');
const futureCount = document.getElementById('future-count');
const pastCount = document.getElementById('past-count');
const nextEventCopy = document.getElementById('next-event-copy');
const detailFlipClock = document.getElementById('detail-flip-clock');
const detailProgressWrap = document.getElementById('detail-progress-wrap');
const detailProgressFill = document.getElementById('detail-progress-fill');
const detailProgressPct = document.getElementById('detail-progress-pct');
const editForm = document.getElementById('event-editor-form');
const editFormStatus = document.getElementById('event-editor-status');
const editSaveBtn = document.getElementById('edit-save-btn');
const imageFileBtn = document.getElementById('img-file-btn');
const imageFileInput = document.getElementById('img-file-input');
const imageUrlInput = document.getElementById('f-img-url');
const eventNameInput = document.getElementById('f-name');
const eventDateInput = document.getElementById('f-date');
const eventTimeInput = document.getElementById('f-time');
const eventRefDateInput = document.getElementById('f-refdate');
const eventDescriptionInput = document.getElementById('f-desc');
const eventUnitWrap = document.getElementById('unit-wrap');
const dstChoiceField = document.getElementById('f-dst-choice-field');
const dstChoiceInput = document.getElementById('f-dst-choice');
const timeZoneHint = document.getElementById('f-time-zone-hint');
const calcDirection = document.getElementById('calc-direction');
const offlineStatus = document.getElementById('offline-status');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
const desktopNavigationQuery = window.matchMedia('(min-width: 900px)');
const modalBackgroundElements = [
  document.querySelector('.skip-link'),
  document.querySelector('.app-container'),
  addBtn,
  menuPopup,
  document.getElementById('file-input'),
  imageFileInput
].filter(Boolean);
const modalBackgroundState = new Map();
const editorErrorElements = new Map([
  [eventNameInput, document.getElementById('f-name-error')],
  [eventDateInput, document.getElementById('f-date-error')],
  [eventTimeInput, document.getElementById('f-time-error')],
  [eventRefDateInput, document.getElementById('f-refdate-error')],
  [eventDescriptionInput, document.getElementById('f-desc-error')],
  [imageUrlInput, document.getElementById('f-img-url-error')]
]);

/* ── INITIALIZE ── */
function init() {
  initializeDataArchitecture();
  applyPreferences();
  updateTodayLabel();
  eventRenderer = new EventListRenderer(futureList, pastList);
  setActiveTab(0);
  updateTabOrientation();
  renderEvents();
  initCalculator();
  initSheetGestures(detailSheet);
  initSheetGestures(editSheet);
  if (document.readyState === 'complete') registerServiceWorker();
  else window.addEventListener('load', registerServiceWorker, { once: true });
  liveScheduler = new SelfCorrectingScheduler(tick, 1000);
  midnightScheduler = new MidnightRefreshScheduler(handleMidnightRefresh);
  liveScheduler.start();
  midnightScheduler.start();

  let resizeFrame = null;
  window.addEventListener('resize', () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      scheduleTabIndicatorUpdate();
    });
  });
  desktopNavigationQuery.addEventListener?.('change', updateTabOrientation);
  systemThemeQuery.addEventListener?.('change', () => {
    if (document.documentElement.dataset.theme === 'system') updateThemeColor();
  });
  updateNetworkStatus(false);
  window.addEventListener('online', () => updateNetworkStatus(true));
  window.addEventListener('offline', () => updateNetworkStatus(true));

  tabItems.forEach(tab => {
    tab.addEventListener('click', () => setActiveTab(Number(tab.dataset.tab)));
  });

  addBtn.addEventListener('click', () => openEditSheet());
  document.addEventListener('click', event => {
    if (event.target.closest('[data-empty-add]')) openEditSheet();
  });
  document.getElementById('menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    setMenuOpen(!menuPopup.classList.contains('open'));
  });
  document.getElementById('detail-close-btn').addEventListener('click', closeSheets);
  document.getElementById('detail-edit-btn').addEventListener('click', () => openEditSheet(currentDetailId));
  document.getElementById('detail-delete-btn').addEventListener('click', deleteCurrentEvent);
  document.getElementById('edit-cancel-btn').addEventListener('click', closeEditSheet);
  document.getElementById('edit-top-close-btn').addEventListener('click', closeEditSheet);
  editForm.addEventListener('submit', event => {
    event.preventDefault();
    void saveEvent();
  });
  editForm.addEventListener('input', handleEditorInput);
  editForm.addEventListener('change', handleEditorInput);

  backdrop.addEventListener('click', () => {
    closeSheets();
    setMenuOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (!menuPopup.contains(e.target) && !e.target.closest('#menu-btn')) setMenuOpen(false);
  });
  document.addEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('focusin', keepFocusInsideOpenSheet);
  window.addEventListener('popstate', () => {
    if (modalHistoryActive) {
      modalHistoryActive = false;
      currentEditId = null;
      currentEditBaseEvent = null;
      currentEditTimeZone = null;
      abortImageProcessing();
      hideSheets(true);
    }
  });

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.themeVal));
  });
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => setColor(btn.dataset.colorVal));
  });
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.viewVal));
  });

  document.querySelectorAll('#unit-wrap .unit-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      chip.setAttribute('aria-pressed', String(chip.classList.contains('selected')));
      if (eventUnitWrap.querySelector('.unit-chip.selected')) clearUnitError();
    });
  });

  eventDateInput.addEventListener('input', updateDateTimeDisambiguation);
  eventTimeInput.addEventListener('input', updateDateTimeDisambiguation);
  dstChoiceInput.addEventListener('change', updateDateTimeDisambiguation);
  imageFileBtn.addEventListener('click', () => imageFileInput.click());
  imageFileInput.addEventListener('change', handleImageUpload);
  imageUrlInput.addEventListener('input', handleImageUrlInput);
  document.getElementById('img-clear-btn').addEventListener('click', clearImage);

  document.getElementById('clear-btn').addEventListener('click', () => { void eventController.clearAll(); });
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('file-input').addEventListener('change', importData);
  installBtn.addEventListener('click', installPwa);

  document.addEventListener('pointerdown', createRipple);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installBtn.hidden = false;
    appMenuTitle.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installBtn.hidden = true;
    appMenuTitle.hidden = true;
    showSnackbar('App installiert.');
  });

  if (dataLoadWarning) showSnackbar(dataLoadWarning);
}

function setActiveTab(index) {
  if (!Number.isInteger(index) || index < 0 || index >= tabContents.length) return;
  activeTab = index;
  tabItems.forEach((tab, i) => {
    const isActive = i === index;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });
  tabContents.forEach((panel, i) => {
    const isActive = i === index;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
    panel.setAttribute('aria-hidden', String(!isActive));
  });
  addBtn.hidden = index === 2;
  if (index === 2) updateCalculator();
  scheduleTabIndicatorUpdate();
}

function updateTabOrientation() {
  tabBar.setAttribute('aria-orientation', desktopNavigationQuery.matches ? 'vertical' : 'horizontal');
  scheduleTabIndicatorUpdate();
}

function setMenuOpen(open) {
  const menuButton = document.getElementById('menu-btn');
  menuPopup.classList.toggle('open', open);
  menuPopup.setAttribute('aria-hidden', String(!open));
  menuPopup.inert = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Einstellungen schließen' : 'Einstellungen öffnen');
  if (open) requestAnimationFrame(() => menuPopup.querySelector('button:not([hidden])')?.focus());
}

/* ── PREFERENCES ── */
function safeStorageGet(key, fallback = null) {
  try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; }
}

function safeStorageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}

function applyPreferences() {
  setTheme(safeStorageGet('theme', 'system'), false);
  setColor(safeStorageGet('color', 'purple'), false);
  setView(safeStorageGet('view', 'cards'), false);
}

function setTheme(theme, persist = true) {
  if (!['system', 'light', 'dark'].includes(theme)) theme = 'system';
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('.theme-btn').forEach(btn => {
    const active = btn.dataset.themeVal === theme;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  if (persist) safeStorageSet('theme', theme);
  updateThemeColor();
}

function setColor(color, persist = true) {
  if (!['purple', 'blue', 'green', 'orange'].includes(color)) color = 'purple';
  document.documentElement.dataset.color = color;
  document.querySelectorAll('.color-btn').forEach(btn => {
    const active = btn.dataset.colorVal === color;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  if (persist) safeStorageSet('color', color);
  updateThemeColor();
}

function setView(view, persist = true) {
  if (!['cards', 'compact'].includes(view)) view = 'cards';
  document.documentElement.dataset.view = view;
  document.querySelectorAll('.view-btn').forEach(btn => {
    const active = btn.dataset.viewVal === view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  if (persist) safeStorageSet('view', view);
}

function updateThemeColor() {
  requestAnimationFrame(() => {
    const primary = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim();
    if (primary) themeColorMeta.setAttribute('content', primary);
  });
}

function updateTodayLabel() {
  const label = document.getElementById('app-bar-date');
  if (!label) return;
  label.textContent = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(new Date());
}

/* ── DATA MODEL ── */
function createEventId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const random = Math.random().toString(36).slice(2, 12);
  return `${Date.now().toString(36)}-${random}`;
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

function isQuotaExceededError(error) {
  return error instanceof DOMException && (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 || error.code === 1014
  );
}

function ensureUniqueEventIds(list) {
  const seen = new Set();
  return list.map(event => {
    let id = event.id;
    while (!id || seen.has(id)) id = createEventId();
    seen.add(id);
    return id === event.id ? event : { ...event, id };
  });
}

function normalizeEvent(raw, index = 0, { regenerateId = false } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (typeof raw.name !== 'string' || raw.name.length > DATA_LIMITS.maxNameChars) return null;
  if (raw.desc != null && (typeof raw.desc !== 'string' || raw.desc.length > DATA_LIMITS.maxDescriptionChars)) return null;
  if (!Array.isArray(raw.units) || raw.units.length === 0 || raw.units.length > ALLOWED_UNITS.length * 2) return null;
  if (raw.img != null && (typeof raw.img !== 'string' || raw.img.length > DATA_LIMITS.maxImageSourceChars)) return null;

  const name = raw.name.trim();
  const date = typeof raw.date === 'string' ? raw.date : '';
  const time = typeof raw.time === 'string' ? raw.time : '';
  const refDate = typeof raw.refDate === 'string' ? raw.refDate : '';
  const desc = typeof raw.desc === 'string' ? raw.desc.trim() : '';
  const rawId = raw.id == null ? '' : String(raw.id);
  const id = regenerateId || !rawId || rawId.length > DATA_LIMITS.maxIdChars ? createEventId() : rawId;
  const units = ALLOWED_UNITS.filter(unit => raw.units.includes(unit));
  const img = normalizeImageSource(raw.img);
  const inferredKind = time === '' ? 'all-day' : 'timed';
  const kind = raw.kind == null ? inferredKind : raw.kind;
  const hasRefDate = refDate !== '';

  if (!name || !isValidDateInput(date) || !isValidTimeInput(time) || (hasRefDate && !isValidDateInput(refDate)) || units.length === 0) return null;
  if (!['all-day', 'timed'].includes(kind) || kind !== inferredKind) return null;
  if (raw.img && !img) return null;

  if (kind === 'all-day') {
    if (hasRefDate && compareDateKeys(refDate, date) >= 0) return null;
    return { id, name, kind, date, time: '', timeZone: '', disambiguation: '', refDate, desc, units, img };
  }

  if (raw.timeZone != null && typeof raw.timeZone !== 'string') return null;
  const timeZone = raw.timeZone ? raw.timeZone : getSystemTimeZone();
  if (!isValidTimeZone(timeZone)) return null;
  if (raw.disambiguation != null && !['earlier', 'later'].includes(raw.disambiguation)) return null;
  const disambiguation = raw.disambiguation || 'earlier';
  const target = resolveZonedDateTime(date, time, timeZone, disambiguation);
  if (!target.ok) return null;

  if (hasRefDate) {
    const reference = resolveStartOfZonedDay(refDate, timeZone);
    if (!reference || reference.instant >= target.instant) return null;
  }

  return { id, name, kind, date, time, timeZone, disambiguation, refDate, desc, units, img };
}

function normalizeEventCollection(rawEvents, { regenerateIds = false } = {}) {
  if (!Array.isArray(rawEvents)) return { ok: false, code: 'not-an-array', events: [], invalidCount: 0 };
  if (rawEvents.length > DATA_LIMITS.maxEvents) return { ok: false, code: 'too-many-events', events: [], invalidCount: rawEvents.length };

  const normalized = [];
  let invalidCount = 0;
  let totalImageChars = 0;

  rawEvents.forEach((raw, index) => {
    const event = normalizeEvent(raw, index, { regenerateId: regenerateIds });
    if (!event) {
      invalidCount++;
      return;
    }
    totalImageChars += event.img?.length || 0;
    normalized.push(event);
  });

  if (totalImageChars > DATA_LIMITS.maxTotalImageChars) {
    return { ok: false, code: 'images-too-large', events: [], invalidCount };
  }

  return {
    ok: true,
    events: ensureUniqueEventIds(normalized),
    invalidCount,
    totalImageChars
  };
}

function freezeEvents(list) {
  return Object.freeze(list.map(event => Object.freeze({ ...event, units: Object.freeze([...event.units]) })));
}

function eventsEqual(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

/* ── STORAGE REPOSITORY ── */
class EventRepository {
  constructor() {
    this.key = STORAGE_KEYS.events;
  }

  getStorage() {
    return window.localStorage;
  }

  loadCurrent({ quarantineOnError = true } = {}) {
    let raw;
    try {
      raw = this.getStorage().getItem(this.key);
    } catch (error) {
      return this.failureResult(null, error, 'storage-read', { quarantineOnError: false, writeProtected: true });
    }

    if (raw == null) {
      return {
        ok: true,
        events: [],
        revision: null,
        updatedAt: 0,
        sourceId: null,
        warning: null,
        writeProtected: false,
        migrated: false
      };
    }
    return this.parseStoredRaw(raw, { quarantineOnError });
  }

  parseStoredRaw(raw, { quarantineOnError = true } = {}) {
    const rawRevision = `raw:${hashString(raw)}`;
    if (raw.length > DATA_LIMITS.maxStoredJsonChars) {
      return this.failureResult(raw, new Error('Gespeicherter Datensatz überschreitet das Größenlimit.'), 'size-check', { quarantineOnError, revision: rawRevision });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return this.failureResult(raw, error, 'json-parse', { quarantineOnError, revision: rawRevision });
    }

    let payload;
    let revision;
    let updatedAt = 0;
    let sourceId = null;
    let migrated = false;

    if (Array.isArray(parsed)) {
      payload = parsed;
      revision = `data:${hashString(raw)}`;
    } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.schemaVersion === DATA_SCHEMA_VERSION && Array.isArray(parsed.events)) {
      payload = parsed.events;
      revision = typeof parsed.revision === 'string' && parsed.revision ? parsed.revision : rawRevision;
      updatedAt = Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0;
      sourceId = typeof parsed.sourceId === 'string' ? parsed.sourceId : null;
      migrated = true;
    } else {
      return this.failureResult(raw, new Error('Unbekanntes oder nicht unterstütztes Datenschema.'), 'schema-migration', { quarantineOnError, revision: rawRevision });
    }

    const collection = normalizeEventCollection(payload);
    if (!collection.ok) {
      return this.failureResult(raw, new Error(`Datensatzvalidierung fehlgeschlagen: ${collection.code}`), 'schema-validation', { quarantineOnError, revision });
    }

    if (collection.invalidCount > 0) {
      const quarantine = quarantineOnError
        ? this.quarantine(raw, new Error(`${collection.invalidCount} ungültige Ereignisse`), 'partial-validation')
        : { stored: false, hasRawCopy: false };
      return {
        ok: true,
        events: collection.events,
        revision,
        updatedAt,
        sourceId,
        migrated,
        warning: quarantine.hasRawCopy
          ? `${collection.invalidCount} ungültige Ereignisse wurden ausgelassen; der Originalbestand liegt in Quarantäne.`
          : `${collection.invalidCount} ungültige Ereignisse wurden ausgelassen. Der Originalbestand blieb unverändert; Änderungen sind vorsorglich gesperrt.`,
        writeProtected: !quarantine.hasRawCopy
      };
    }

    return {
      ok: true,
      events: collection.events,
      revision,
      updatedAt,
      sourceId,
      migrated,
      warning: null,
      writeProtected: false
    };
  }

  failureResult(raw, error, stage, { quarantineOnError = true, revision = null, writeProtected = null } = {}) {
    console.warn(`EventRepository: ${stage} fehlgeschlagen. Originaldaten bleiben unverändert.`, error);
    const quarantine = raw != null && quarantineOnError
      ? this.quarantine(raw, error, stage)
      : { stored: false, hasRawCopy: false };
    const protectedState = writeProtected ?? !quarantine.hasRawCopy;
    return {
      ok: false,
      events: [],
      revision: revision ?? (raw == null ? null : `raw:${hashString(raw)}`),
      updatedAt: 0,
      sourceId: null,
      migrated: false,
      warning: quarantine.hasRawCopy
        ? 'Gespeicherte Daten konnten nicht geladen werden. Das unveränderte Original wurde in Quarantäne gesichert.'
        : 'Gespeicherte Daten konnten nicht geladen werden. Das Original blieb unverändert; Änderungen sind vorsorglich gesperrt.',
      writeProtected: protectedState,
      errorCode: stage
    };
  }

  quarantine(raw, error, stage) {
    const checksum = hashString(raw);
    const hasRawCopy = raw.length <= DATA_LIMITS.maxQuarantineRawChars;
    const entry = {
      id: createEventId(),
      checksum,
      quarantinedAt: new Date().toISOString(),
      sourceKey: this.key,
      stage,
      reason: String(error?.message || error || 'Unbekannter Fehler').slice(0, 500),
      originalLength: raw.length,
      preservedInSourceKey: true,
      hasRawCopy,
      ...(hasRawCopy ? { raw } : {})
    };

    try {
      const storage = this.getStorage();
      const existingRaw = storage.getItem(STORAGE_KEYS.quarantine);
      let quarantineDocument = { schemaVersion: 1, entries: [] };
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw);
        if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries)) throw new Error('Vorhandene Quarantäne ist nicht lesbar.');
        quarantineDocument = parsed;
      }

      const existing = quarantineDocument.entries.find(item => item?.checksum === checksum);
      if (existing) {
        const existingHasRawCopy = typeof existing.raw === 'string' && hashString(existing.raw) === checksum;
        return { stored: true, hasRawCopy: existingHasRawCopy, checksum };
      }
      if (quarantineDocument.entries.length >= DATA_LIMITS.maxQuarantineEntries) {
        this.recordQuarantineMetadata(entry);
        return { stored: false, hasRawCopy: false, checksum };
      }

      quarantineDocument.entries.push(entry);
      storage.setItem(STORAGE_KEYS.quarantine, JSON.stringify(quarantineDocument));
      return { stored: true, hasRawCopy, checksum };
    } catch (quarantineError) {
      console.warn('Quarantäne konnte nicht vollständig geschrieben werden; der Originalschlüssel bleibt unangetastet.', quarantineError);
      this.recordQuarantineMetadata(entry);
      return { stored: false, hasRawCopy: false, checksum };
    }
  }

  recordQuarantineMetadata(entry) {
    const metadata = { ...entry };
    delete metadata.raw;
    metadata.hasRawCopy = false;
    try {
      const storage = this.getStorage();
      const currentRaw = storage.getItem(STORAGE_KEYS.quarantineMeta);
      const current = currentRaw ? JSON.parse(currentRaw) : { schemaVersion: 1, entries: [] };
      if (!current || current.schemaVersion !== 1 || !Array.isArray(current.entries)) return false;
      if (!current.entries.some(item => item?.checksum === metadata.checksum)) current.entries.push(metadata);
      storage.setItem(STORAGE_KEYS.quarantineMeta, JSON.stringify(current));
      return true;
    } catch (error) {
      console.warn('Quarantäne-Metadaten konnten nicht gespeichert werden.', error);
      return false;
    }
  }

  async save(mutate, sourceId) {
    const lockManager = window.navigator?.locks;
    if (!lockManager || typeof lockManager.request !== 'function') {
      return { ok: false, code: 'lock-unavailable' };
    }

    try {
      return await lockManager.request(EVENT_WRITE_LOCK_NAME, { mode: 'exclusive' }, () => {
        const latest = this.loadCurrent({ quarantineOnError: true });
        if (!latest.ok || latest.writeProtected) {
          return { ok: false, code: 'write-protected', latest };
        }

        let mutation;
        try {
          mutation = mutate([...latest.events], latest);
        } catch (error) {
          return { ok: false, code: 'mutation-failed', error, latest };
        }
        if (!mutation?.ok) return { ...mutation, ok: false, latest };
        return this.persist(mutation.events, latest.revision, sourceId);
      });
    } catch (error) {
      return { ok: false, code: 'lock-failed', error };
    }
  }

  persist(events, expectedRevision, sourceId) {
    let storage;
    let currentRaw;
    try {
      storage = this.getStorage();
      currentRaw = storage.getItem(this.key);
    } catch (error) {
      return { ok: false, code: 'storage-unavailable', error };
    }

    const currentRevision = currentRaw == null ? null : this.extractRevision(currentRaw);
    if (currentRevision !== expectedRevision) {
      const latest = currentRaw == null
        ? this.loadCurrent({ quarantineOnError: false })
        : this.parseStoredRaw(currentRaw, { quarantineOnError: true });
      return { ok: false, code: 'write-raced', latest };
    }

    const collection = normalizeEventCollection(events);
    if (!collection.ok || collection.invalidCount > 0 || collection.events.length !== events.length) {
      return { ok: false, code: 'validation' };
    }

    let serialized;
    try {
      // Das kanonische Array-Format bleibt für noch offene Tabs älterer App-Versionen lesbar.
      serialized = JSON.stringify(collection.events);
    } catch (error) {
      return { ok: false, code: 'serialization', error };
    }
    if (serialized.length > DATA_LIMITS.maxStoredJsonChars) return { ok: false, code: 'too-large' };

    const snapshot = {
      schemaVersion: DATA_SCHEMA_VERSION,
      revision: `data:${hashString(serialized)}`,
      updatedAt: Date.now(),
      sourceId,
      events: collection.events
    };

    try {
      storage.setItem(this.key, serialized);
      const persistedRaw = storage.getItem(this.key);
      if (persistedRaw !== serialized) {
        const latest = persistedRaw == null
          ? this.loadCurrent({ quarantineOnError: false })
          : this.parseStoredRaw(persistedRaw, { quarantineOnError: true });
        return { ok: false, code: 'write-raced', latest };
      }
      return { ok: true, ...snapshot, events: collection.events, writeProtected: false };
    } catch (error) {
      return { ok: false, code: isQuotaExceededError(error) ? 'quota' : 'storage-unavailable', error };
    }
  }

  extractRevision(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return `data:${hashString(raw)}`;
      if (parsed && parsed.schemaVersion === DATA_SCHEMA_VERSION && typeof parsed.revision === 'string' && parsed.revision) return parsed.revision;
    } catch (_) {}
    return `raw:${hashString(raw)}`;
  }
}

/* ── EVENT STORE ── */
class EventStore {
  constructor(repository, initialSnapshot) {
    this.repository = repository;
    this.sourceId = createEventId();
    this.listeners = new Set();
    this.legacyPeerDetected = false;
    this.state = {
      events: freezeEvents(initialSnapshot.events || []),
      revision: initialSnapshot.revision ?? null,
      updatedAt: initialSnapshot.updatedAt || 0,
      writeProtected: Boolean(initialSnapshot.writeProtected)
    };
  }

  getEvents() {
    return this.state.events;
  }

  getEvent(id) {
    return this.state.events.find(event => event.id === id) || null;
  }

  getRevision() {
    return this.state.revision;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(change) {
    this.listeners.forEach(listener => {
      try {
        listener({ ...change, state: this.state });
      } catch (error) {
        console.error('EventStore-Listener fehlgeschlagen:', error);
      }
    });
  }

  upsert(event, { requireExisting = false, baseEvent = null } = {}) {
    return this.commit(requireExisting ? 'update' : 'create', currentEvents => {
      const index = currentEvents.findIndex(item => item.id === event.id);
      if (requireExisting) {
        if (index < 0) return { ok: false, code: 'edit-deleted' };
        if (!eventsEqual(currentEvents[index], baseEvent)) return { ok: false, code: 'edit-conflict' };
      } else if (index >= 0) {
        return { ok: false, code: 'create-conflict' };
      }

      const next = [...currentEvents];
      if (index >= 0) next[index] = event;
      else next.push(event);
      return { ok: true, events: next };
    });
  }

  remove(id, baseEvent) {
    return this.commit('delete', currentEvents => {
      const current = currentEvents.find(event => event.id === id);
      if (!current) return { ok: false, code: 'not-found' };
      if (!eventsEqual(current, baseEvent)) return { ok: false, code: 'delete-conflict' };
      return { ok: true, events: currentEvents.filter(event => event.id !== id) };
    });
  }

  clear() {
    const baseRevision = this.state.revision;
    return this.commit('clear', (currentEvents, latest) => {
      if (latest.revision !== baseRevision) return { ok: false, code: 'collection-conflict' };
      return { ok: true, events: [] };
    });
  }

  replaceAll(events) {
    const baseRevision = this.state.revision;
    return this.commit('import', (currentEvents, latest) => {
      if (latest.revision !== baseRevision) return { ok: false, code: 'collection-conflict' };
      return { ok: true, events };
    });
  }

  async commit(action, mutate) {
    if (this.state.writeProtected) return { ok: false, code: 'write-protected' };
    if (this.legacyPeerDetected) return { ok: false, code: 'legacy-peer' };
    const result = await this.repository.save(mutate, this.sourceId);
    if (!result.ok) {
      if (result.latest?.ok) this.applyExternal(result.latest, 'conflict');
      return result;
    }

    this.state = {
      events: freezeEvents(result.events),
      revision: result.revision,
      updatedAt: result.updatedAt,
      writeProtected: false
    };
    this.emit({ origin: 'local', action, revision: result.revision });
    return { ok: true, action, revision: result.revision };
  }

  blockWritesForLegacyPeer() {
    if (this.legacyPeerDetected) return false;
    this.legacyPeerDetected = true;
    return true;
  }

  applyExternal(snapshot, origin = 'external') {
    if (!snapshot?.ok || snapshot.revision === this.state.revision) return { ok: false, code: 'unchanged' };
    this.state = {
      events: freezeEvents(snapshot.events || []),
      revision: snapshot.revision ?? null,
      updatedAt: snapshot.updatedAt || 0,
      writeProtected: Boolean(snapshot.writeProtected)
    };
    this.emit({ origin, action: 'replace', revision: this.state.revision });
    return { ok: true };
  }

  protectAfterExternalLoadFailure(snapshot, origin = 'external-error') {
    this.state = {
      ...this.state,
      revision: snapshot?.revision ?? this.state.revision,
      writeProtected: true
    };
    this.emit({ origin, action: 'write-protect', revision: this.state.revision });
  }
}

/* ── CROSS-TAB SYNCHRONIZATION ── */
class EventSync {
  constructor(repository, sourceId) {
    this.repository = repository;
    this.sourceId = sourceId;
    this.channel = null;
    this.onSnapshot = null;
    this.onStorage = event => {
      if (event.key === this.repository.key || event.key === null) this.reload('storage');
    };
  }

  start(onSnapshot, onLegacyPeer) {
    this.onSnapshot = onSnapshot;
    window.addEventListener('storage', this.onStorage);
    if ('BroadcastChannel' in window) {
      try {
        this.channel = new window.BroadcastChannel('tageszaehler-events-v2');
        this.channel.addEventListener('message', event => {
          if (event.data?.type !== 'events-updated' || event.data.sourceId === this.sourceId) return;
          if (event.data.writeProtocolVersion !== WRITE_PROTOCOL_VERSION) onLegacyPeer?.();
          this.reload('broadcast');
        });
      } catch (error) {
        console.warn('BroadcastChannel ist nicht verfügbar; Synchronisation nutzt das storage-Event.', error);
      }
    }
  }

  reload(origin) {
    const snapshot = this.repository.loadCurrent({ quarantineOnError: true });
    this.onSnapshot?.(snapshot, origin);
  }

  publish(revision) {
    try {
      this.channel?.postMessage({
        type: 'events-updated',
        sourceId: this.sourceId,
        revision,
        writeProtocolVersion: WRITE_PROTOCOL_VERSION
      });
    } catch (error) {
      console.warn('BroadcastChannel-Nachricht fehlgeschlagen; das storage-Event bleibt als Fallback aktiv.', error);
    }
  }

  stop() {
    window.removeEventListener('storage', this.onStorage);
    this.channel?.close();
    this.channel = null;
  }
}

/* ── UI CONTROLLER ── */
class EventUIController {
  constructor(store, sync) {
    this.store = store;
    this.sync = sync;
    this.unsubscribe = null;
  }

  connect() {
    this.unsubscribe = this.store.subscribe(change => this.handleStoreChange(change));
    this.sync.start((snapshot, origin) => {
      if (!snapshot.ok) {
        this.store.protectAfterExternalLoadFailure(snapshot, `${origin}-error`);
        showSnackbar('Externe Datenänderung konnte nicht sicher geladen werden; lokaler Stand bleibt erhalten und Schreibzugriffe sind gesperrt.');
        return;
      }
      this.store.applyExternal(snapshot, origin);
    }, () => {
      if (!this.store.blockWritesForLegacyPeer()) return;
      showSnackbar('Älterer Tab erkannt. Schreibzugriffe bleiben bis zum Neuladen gesperrt; bitte alle Tabs aktualisieren.');
    });
  }

  handleStoreChange(change) {
    const detailEvent = currentDetailId ? this.store.getEvent(currentDetailId) : null;
    if (currentDetailId && !detailEvent && detailSheet.classList.contains('open')) {
      currentEditId = null;
      currentEditBaseEvent = null;
      closeSheets();
    } else if (detailEvent && detailSheet.classList.contains('open')) {
      populateDetailSheet(detailEvent);
    }

    if (currentEditId && editSheet.classList.contains('open') && change.origin !== 'local') {
      const currentEvent = this.store.getEvent(currentEditId);
      if (!currentEvent) {
        editFormStatus.textContent = 'Dieses Ereignis wurde in einem anderen Tab gelöscht. Dein Entwurf bleibt geöffnet.';
      } else if (!eventsEqual(currentEvent, currentEditBaseEvent)) {
        editFormStatus.textContent = 'Dieses Ereignis wurde in einem anderen Tab geändert. Dein Entwurf bleibt bis zur Konfliktentscheidung geöffnet.';
      }
    }

    renderEvents();
    if (change.origin === 'local') this.sync.publish(change.revision);
    if (change.origin === 'storage' || change.origin === 'broadcast') showSnackbar('Daten aus einem anderen Tab wurden übernommen.');
  }

  async upsert(event, wasEdit) {
    const result = await this.store.upsert(event, {
      requireExisting: wasEdit,
      baseEvent: wasEdit ? currentEditBaseEvent : null
    });
    if (!result.ok) return this.handleFailure(result);
    currentEditId = null;
    currentEditBaseEvent = null;
    closeSheets();
    showSnackbar(wasEdit ? 'Geändert.' : 'Erstellt.');
    return true;
  }

  async deleteById(id) {
    const baseEvent = this.store.getEvent(id);
    const result = await this.store.remove(id, baseEvent);
    if (!result.ok) return this.handleFailure(result);
    showSnackbar('Gelöscht.');
    return true;
  }

  async clearAll() {
    if (!this.store.getEvents().length) return showSnackbar('Es sind keine Ereignisse vorhanden.');
    if (!confirm('Wirklich alle Ereignisse löschen?')) return false;
    const result = await this.store.clear();
    if (!result.ok) return this.handleFailure(result);
    setMenuOpen(false);
    showSnackbar('Alle Ereignisse gelöscht.');
    return true;
  }

  async importEvents(importedEvents) {
    const result = await this.store.replaceAll(importedEvents);
    if (!result.ok) return this.handleFailure(result);
    showSnackbar(`${importedEvents.length} Ereignis${importedEvents.length === 1 ? '' : 'se'} importiert.`);
    return true;
  }

  handleFailure(result) {
    const messages = {
      'write-protected': 'Änderung blockiert: Der fehlerhafte Originalbestand konnte nicht vollständig quarantänisiert werden.',
      'edit-conflict': 'Dieses Ereignis wurde in einem anderen Tab geändert. Dein Entwurf bleibt geöffnet.',
      'edit-deleted': 'Dieses Ereignis wurde in einem anderen Tab gelöscht. Dein Entwurf bleibt geöffnet.',
      'delete-conflict': 'Das Ereignis wurde in einem anderen Tab geändert. Löschen wurde abgebrochen.',
      'collection-conflict': 'Der Datenbestand wurde in einem anderen Tab geändert. Der Vorgang wurde abgebrochen.',
      'create-conflict': 'Die Ereignis-ID ist bereits vorhanden. Das neue Ereignis wurde nicht gespeichert.',
      'not-found': 'Ereignis wurde nicht gefunden.',
      quota: 'Speicher voll – Änderung wurde nicht übernommen. Nutze kleinere Bilder oder Bild-URLs.',
      'too-large': 'Der Datensatz ist für den lokalen Speicher zu groß.',
      validation: 'Datenvalidierung fehlgeschlagen; Änderung wurde nicht gespeichert.',
      serialization: 'Daten konnten nicht serialisiert werden.',
      'storage-unavailable': 'Lokaler Speicher ist momentan nicht verfügbar.',
      'lock-unavailable': 'Sicheres Speichern wird von diesem Browser nicht unterstützt. Die Änderung wurde nicht gespeichert.',
      'lock-failed': 'Die Schreibsperre konnte nicht verwendet werden. Die Änderung wurde nicht gespeichert.',
      'write-raced': 'Ein nicht kooperierender Tab hat gleichzeitig geschrieben. Die Änderung wurde nicht als gespeichert bestätigt.',
      'mutation-failed': 'Die Änderung konnte nicht sicher vorbereitet werden.',
      'legacy-peer': 'Ein älterer Tab ist noch geöffnet. Bitte alle Tabs aktualisieren; die Änderung wurde nicht gespeichert.'
    };
    console.warn('Store-Änderung fehlgeschlagen:', result);
    const message = messages[result.code] || 'Änderung konnte nicht sicher gespeichert werden.';
    if (editSheet.classList.contains('open')) editFormStatus.textContent = message;
    showSnackbar(message);
    return false;
  }
}

function initializeDataArchitecture() {
  eventRepository = new EventRepository();
  const initialSnapshot = loadEvents();
  eventStore = new EventStore(eventRepository, initialSnapshot);
  eventSync = new EventSync(eventRepository, eventStore.sourceId);
  eventController = new EventUIController(eventStore, eventSync);
  eventController.connect();
  dataLoadWarning = initialSnapshot.warning;
}

function loadEvents() {
  return eventRepository.loadCurrent({ quarantineOnError: true });
}

function isValidDateInput(value) {
  return parseDateKey(value) !== null;
}

function isValidTimeInput(value) {
  if (value === '') return true;
  return parseTimeKey(value) !== null;
}

function normalizeImageSource(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const src = value.trim();
  if (!src || src.length > DATA_LIMITS.maxImageSourceChars) return null;
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(src)) return src;
  if (src.length > DATA_LIMITS.maxUrlChars) return null;
  try {
    const url = new URL(src, location.href);
    const allowed = url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === location.origin);
    return allowed ? url.href : null;
  } catch (_) {
    return null;
  }
}

/* ── CIVIL DATE & ZONED TIME MODEL ── */
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const zonedFormatterCache = new Map();
const timeZoneValidityCache = new Map();
const zonedResolutionCache = new Map();
const zonedDayStartCache = new Map();

function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month - 1)) return null;
  return { year, month, day };
}

function parseTimeKey(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function createUtcDate(year, monthIndex, day, hour = 0, minute = 0, second = 0) {
  const date = new Date(0);
  date.setUTCHours(hour, minute, second, 0);
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

function daysInMonth(year, monthIndex) {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, monthIndex + 1, 0);
  return date.getUTCDate();
}

function datePartsToKey({ year, month, day }) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function calendarDayNumber(dateKey) {
  const parts = parseDateKey(dateKey);
  return parts ? Math.floor(createUtcDate(parts.year, parts.month - 1, parts.day).getTime() / MS_PER_DAY) : NaN;
}

function compareDateKeys(left, right) {
  return Math.sign(calendarDayNumber(left) - calendarDayNumber(right));
}

function addCalendarDateDays(dateKey, days) {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  const date = createUtcDate(parts.year, parts.month - 1, parts.day + days);
  return datePartsToKey({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
}

function addCalendarDateMonths(dateKey, months) {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  const totalMonths = parts.year * 12 + (parts.month - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonthIndex = ((totalMonths % 12) + 12) % 12;
  const targetDay = Math.min(parts.day, daysInMonth(targetYear, targetMonthIndex));
  return datePartsToKey({ year: targetYear, month: targetMonthIndex + 1, day: targetDay });
}

function addCalendarDateYears(dateKey, years) {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  const targetYear = parts.year + years;
  const targetDay = Math.min(parts.day, daysInMonth(targetYear, parts.month - 1));
  return datePartsToKey({ year: targetYear, month: parts.month, day: targetDay });
}

function getSystemTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (_) {
    return 'UTC';
  }
}

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 100) return false;
  if (timeZoneValidityCache.has(timeZone)) return timeZoneValidityCache.get(timeZone);
  let valid = false;
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(0);
    valid = true;
  } catch (_) {}
  timeZoneValidityCache.set(timeZone, valid);
  return valid;
}

function getZonedFormatter(timeZone) {
  let formatter = zonedFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23'
    });
    zonedFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function getZonedParts(instant, timeZone) {
  const values = {};
  getZonedFormatter(timeZone).formatToParts(new Date(instant)).forEach(part => {
    if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type)) values[part.type] = Number(part.value);
  });
  if (values.hour === 24) values.hour = 0;
  return values;
}

function sameCivilTime(left, right) {
  return left.year === right.year && left.month === right.month && left.day === right.day &&
    left.hour === right.hour && left.minute === right.minute && left.second === right.second;
}

function getZoneOffsetsNearCivilEpoch(civilEpoch, timeZone) {
  const offsets = new Set();
  [-72, -48, -24, -12, 0, 12, 24, 48, 72].forEach(hours => {
    const probe = civilEpoch + hours * MS_PER_HOUR;
    const zoned = getZonedParts(probe, timeZone);
    const representedAsUtc = createUtcDate(
      zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second
    ).getTime();
    offsets.add(representedAsUtc - probe);
  });
  return offsets;
}

function resolveZonedComponents(components, timeZone, disambiguation = 'earlier') {
  if (!isValidTimeZone(timeZone) || !['earlier', 'later'].includes(disambiguation)) {
    return { ok: false, status: 'invalid', candidates: [] };
  }

  const cacheKey = `${timeZone}|${components.year}-${components.month}-${components.day}T${components.hour}:${components.minute}:${components.second}|${disambiguation}`;
  const cached = zonedResolutionCache.get(cacheKey);
  if (cached) return cached;

  const civilEpoch = createUtcDate(
    components.year, components.month - 1, components.day,
    components.hour, components.minute, components.second
  ).getTime();
  const offsets = getZoneOffsetsNearCivilEpoch(civilEpoch, timeZone);

  const candidates = [...offsets]
    .map(offset => civilEpoch - offset)
    .filter(instant => sameCivilTime(getZonedParts(instant, timeZone), components))
    .filter((instant, index, list) => list.indexOf(instant) === index)
    .sort((left, right) => left - right);

  const result = candidates.length === 0
    ? Object.freeze({ ok: false, status: 'nonexistent', candidates: Object.freeze([]) })
    : Object.freeze({
        ok: true,
        status: candidates.length > 1 ? 'ambiguous' : 'exact',
        candidates: Object.freeze(candidates),
        instant: disambiguation === 'later' ? candidates[candidates.length - 1] : candidates[0]
      });

  if (zonedResolutionCache.size > 5000) zonedResolutionCache.clear();
  zonedResolutionCache.set(cacheKey, result);
  return result;
}

function resolveZonedDateTime(dateKey, timeKey, timeZone, disambiguation = 'earlier') {
  const date = parseDateKey(dateKey);
  const time = parseTimeKey(timeKey);
  if (!date || !time) return { ok: false, status: 'invalid', candidates: [] };
  return resolveZonedComponents({ ...date, ...time, second: 0 }, timeZone, disambiguation);
}

function resolveStartOfZonedDay(dateKey, timeZone) {
  const cacheKey = `${timeZone}|${dateKey}`;
  if (zonedDayStartCache.has(cacheKey)) return zonedDayStartCache.get(cacheKey);
  const date = parseDateKey(dateKey);
  if (!date || !isValidTimeZone(timeZone)) return null;

  let result = resolveZonedComponents({ ...date, hour: 0, minute: 0, second: 0 }, timeZone, 'earlier');
  let shifted = false;
  if (!result.ok) {
    shifted = true;
    // Bei einem Mitternachtssprung ist die kompatibel verschobene Zeit der erste Zeitpunkt des Tages.
    const shiftedInstant = resolveCompatibleZonedComponents({ ...date, hour: 0, minute: 0, second: 0 }, timeZone);
    const staysOnRequestedDate = shiftedInstant != null && formatInstantDateKey(shiftedInstant, timeZone) === dateKey;
    result = staysOnRequestedDate
      ? { ok: true, status: 'shifted', instant: shiftedInstant }
      : { ok: false, status: 'skipped-day' };
  }

  const dayStart = result.ok ? Object.freeze({ instant: result.instant, shifted }) : null;
  if (zonedDayStartCache.size > 5000) zonedDayStartCache.clear();
  zonedDayStartCache.set(cacheKey, dayStart);
  return dayStart;
}

function formatInstantDateKey(instant, timeZone = getSystemTimeZone()) {
  const parts = getZonedParts(instant, timeZone);
  return datePartsToKey(parts);
}

function formatCalendarDate(dateKey, options = {}) {
  const parts = parseDateKey(dateKey);
  if (!parts) return '';
  return new Intl.DateTimeFormat('de-DE', { ...options, timeZone: 'UTC' }).format(
    createUtcDate(parts.year, parts.month - 1, parts.day, 12)
  );
}

function localDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateProgress(targetTime, refTime, nowTime) {
  if (refTime == null || !Number.isFinite(refTime) || !Number.isFinite(targetTime) || !Number.isFinite(nowTime)) return 0;
  if (nowTime < refTime) return 0;
  const total = targetTime - refTime;
  return total > 0 ? Math.max(0, Math.min(100, ((nowTime - refTime) / total) * 100)) : 100;
}

function calculateCalendarProgress(targetDate, refDate, currentDate) {
  if (refDate == null || refDate === '') return 0;
  const referenceDay = calendarDayNumber(refDate);
  const targetDay = calendarDayNumber(targetDate);
  const currentDay = calendarDayNumber(currentDate);
  if (![referenceDay, targetDay, currentDay].every(Number.isFinite) || currentDay < referenceDay) return 0;
  const total = targetDay - referenceDay;
  return total > 0 ? Math.max(0, Math.min(100, ((currentDay - referenceDay) / total) * 100)) : 100;
}

/* ── CALCULATOR ── */
function initCalculator() {
  const startInput = document.getElementById('calc-start');
  const endInput = document.getElementById('calc-end');
  const today = localDateInput();
  startInput.value = today;
  endInput.value = today;
  startInput.addEventListener('change', updateCalculator);
  endInput.addEventListener('change', updateCalculator);

  document.querySelectorAll('.calc-unit-chip').forEach(chip => {
    chip.setAttribute('aria-pressed', String(chip.classList.contains('selected')));
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      chip.setAttribute('aria-pressed', String(chip.classList.contains('selected')));
      updateCalculator();
    });
  });
  document.querySelectorAll('#unit-wrap .unit-chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip.classList.contains('selected'))));
  updateCalculator();
}

function updateCalculator() {
  const startVal = document.getElementById('calc-start').value;
  const endVal = document.getElementById('calc-end').value;
  const container = document.getElementById('calc-flip-clock');

  if (!startVal || !endVal || !isValidDateInput(startVal) || !isValidDateInput(endVal)) {
    calcDirection.textContent = '';
    calcDirection.removeAttribute('data-direction');
    renderCalculatorMessage(container, 'Bitte Start- und Enddatum auswählen.');
    return;
  }

  const units = Array.from(document.querySelectorAll('.calc-unit-chip.selected')).map(c => c.dataset.unit);
  if (units.length === 0) {
    calcDirection.textContent = '';
    calcDirection.removeAttribute('data-direction');
    renderCalculatorMessage(container, 'Mindestens eine Zeiteinheit auswählen.');
    return;
  }

  const direction = compareDateKeys(startVal, endVal);
  const startLabel = formatCalendarDate(startVal, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const endLabel = formatCalendarDate(endVal, { day: '2-digit', month: '2-digit', year: 'numeric' });
  calcDirection.dataset.direction = direction < 0 ? 'forward' : direction > 0 ? 'backward' : 'same';
  calcDirection.textContent = direction < 0
    ? `Vorwärts: ${startLabel} → ${endLabel}`
    : direction > 0
      ? `Rückwärts: ${startLabel} → ${endLabel}`
      : `Gleiches Datum: ${startLabel}`;

  renderFlipClock(container, getCalendarDateDiff(startVal, endVal, units), true, 'Zeitdifferenz');
}

function countWholeDateUnits(startDate, endDate, estimate, adder) {
  let count = Math.max(0, estimate);
  let candidate = adder(startDate, count);
  while (count > 0 && (!candidate || compareDateKeys(candidate, endDate) > 0)) {
    count--;
    candidate = adder(startDate, count);
  }
  let next = adder(startDate, count + 1);
  while (next && compareDateKeys(next, endDate) <= 0) {
    count++;
    candidate = next;
    next = adder(startDate, count + 1);
  }
  return { count, date: candidate || startDate };
}

function getCalendarDateDiff(leftDate, rightDate, unitsList) {
  let startDate = compareDateKeys(leftDate, rightDate) <= 0 ? leftDate : rightDate;
  const endDate = startDate === leftDate ? rightDate : leftDate;
  const result = [];

  if (unitsList.includes('years')) {
    const start = parseDateKey(startDate);
    const end = parseDateKey(endDate);
    const part = countWholeDateUnits(startDate, endDate, end.year - start.year, addCalendarDateYears);
    result.push({ unit: 'years', val: part.count });
    startDate = part.date;
  }

  if (unitsList.includes('months')) {
    const start = parseDateKey(startDate);
    const end = parseDateKey(endDate);
    const estimate = (end.year - start.year) * 12 + end.month - start.month;
    const part = countWholeDateUnits(startDate, endDate, estimate, addCalendarDateMonths);
    result.push({ unit: 'months', val: part.count });
    startDate = part.date;
  }

  if (unitsList.includes('weeks')) {
    const estimate = Math.floor((calendarDayNumber(endDate) - calendarDayNumber(startDate)) / 7);
    const part = countWholeDateUnits(startDate, endDate, estimate, (date, weeks) => addCalendarDateDays(date, weeks * 7));
    result.push({ unit: 'weeks', val: part.count });
    startDate = part.date;
  }

  if (unitsList.includes('days')) {
    const days = Math.max(0, calendarDayNumber(endDate) - calendarDayNumber(startDate));
    result.push({ unit: 'days', val: days });
    startDate = endDate;
  }

  let remainder = Math.max(0, calendarDayNumber(endDate) - calendarDayNumber(startDate)) * MS_PER_DAY;
  const factors = { hours: MS_PER_HOUR, minutes: MS_PER_MINUTE, seconds: MS_PER_SECOND };
  ['hours', 'minutes', 'seconds'].forEach(unit => {
    if (!unitsList.includes(unit)) return;
    const value = Math.floor(remainder / factors[unit]);
    result.push({ unit, val: value });
    remainder -= value * factors[unit];
  });

  return result;
}

function renderCalculatorMessage(container, message) {
  clearFlipClock(container);
  const element = document.createElement('div');
  element.className = 'calc-message';
  element.textContent = message;
  container.appendChild(element);
}

function scheduleTabIndicatorUpdate() {
  if (tabIndicatorFrame != null) cancelAnimationFrame(tabIndicatorFrame);
  tabIndicatorFrame = requestAnimationFrame(() => {
    tabIndicatorFrame = null;
    updateTabIndicator();
  });
}

function updateTabIndicator() {
  const active = tabItems[activeTab];
  if (!active) return;
  const first = tabItems[0];
  /* Alle Layout-Reads vor den Writes bündeln, damit kein erzwungener Reflow entsteht. */
  const activeRect = active.getBoundingClientRect();
  const firstRect = first.getBoundingClientRect();
  const desktop = desktopNavigationQuery.matches;
  const width = activeRect.width;
  const height = activeRect.height;
  const x = desktop ? 0 : activeRect.left - firstRect.left;
  const y = desktop ? activeRect.top - firstRect.top : 0;

  tabIndicator.style.width = `${width}px`;
  tabIndicator.style.height = `${height}px`;
  tabIndicator.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

/* ── RENDER & LIVE UPDATES ── */
function setTextIfChanged(element, value) {
  const text = String(value);
  if (element && element.textContent !== text) element.textContent = text;
}

function setAttributeIfChanged(element, name, value) {
  const text = String(value);
  if (element && element.getAttribute(name) !== text) element.setAttribute(name, text);
}

function formatProgressText(value) {
  return `${Number(value).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Prozent`;
}

function createEventTimeModel(
  event,
  nowTime = Date.now(),
  viewerTimeZone = getSystemTimeZone(),
  viewerToday = formatInstantDateKey(nowTime, viewerTimeZone)
) {

  if (event.kind === 'all-day') {
    return {
      kind: 'all-day',
      isPast: compareDateKeys(event.date, viewerToday) < 0,
      targetTime: null,
      targetLocalDate: event.date,
      sortDay: calendarDayNumber(event.date),
      refTime: null,
      viewerToday
    };
  }

  const resolution = resolveZonedDateTime(event.date, event.time, event.timeZone, event.disambiguation);
  if (!resolution.ok) return null;
  const targetLocalDate = formatInstantDateKey(resolution.instant, viewerTimeZone);
  const reference = event.refDate !== '' ? resolveStartOfZonedDay(event.refDate, event.timeZone) : null;
  return {
    kind: 'timed',
    isPast: resolution.instant <= nowTime,
    targetTime: resolution.instant,
    targetLocalDate,
    sortDay: calendarDayNumber(targetLocalDate),
    refTime: reference?.instant ?? null,
    viewerToday
  };
}

function comparePreparedEvents(left, right) {
  if (left.model.sortDay !== right.model.sortDay) return left.model.sortDay - right.model.sortDay;
  if (left.model.kind !== right.model.kind) return left.model.kind === 'all-day' ? -1 : 1;
  if (left.model.targetTime !== right.model.targetTime) return (left.model.targetTime ?? 0) - (right.model.targetTime ?? 0);
  return left.event.id.localeCompare(right.event.id);
}

function formatEventBadgeDate(targetDate, todayDate) {
  const dayDiff = calendarDayNumber(targetDate) - calendarDayNumber(todayDate);
  if (dayDiff === 0) return 'Heute';
  if (dayDiff === 1) return 'Morgen';
  if (dayDiff === -1) return 'Gestern';
  if (dayDiff > 1 && dayDiff <= 31) return `In ${dayDiff} Tagen`;
  if (dayDiff < -1 && dayDiff >= -31) return `Vor ${Math.abs(dayDiff)} Tagen`;
  return formatCalendarDate(targetDate, { day: '2-digit', month: 'short', year: 'numeric' });
}

function createEmptyStateElement(title, body, allowCreate) {
  const element = document.createElement('div');
  element.className = 'empty-state';

  const iconCircle = document.createElement('div');
  iconCircle.className = 'empty-icon-circle';
  iconCircle.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const svgParts = [
    ['rect', { x: '3', y: '4', width: '18', height: '18', rx: '2', ry: '2' }],
    ['line', { x1: '16', y1: '2', x2: '16', y2: '6' }],
    ['line', { x1: '8', y1: '2', x2: '8', y2: '6' }],
    ['line', { x1: '3', y1: '10', x2: '21', y2: '10' }]
  ];
  svgParts.forEach(([tagName, attributes]) => {
    const part = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    Object.entries(attributes).forEach(([name, value]) => part.setAttribute(name, value));
    svg.appendChild(part);
  });
  iconCircle.appendChild(svg);

  const headline = document.createElement('div');
  headline.className = 'empty-headline';
  headline.textContent = title;
  const description = document.createElement('div');
  description.className = 'empty-body';
  description.textContent = body;
  element.append(iconCircle, headline, description);

  if (allowCreate) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'empty-add-btn ripple-host';
    button.dataset.emptyAdd = '';
    button.textContent = 'Erstes Ereignis erstellen';
    element.appendChild(button);
  }
  return element;
}

function eventProgress(event, model, nowTime) {
  if (event.refDate === '') return null;
  return event.kind === 'all-day'
    ? calculateCalendarProgress(event.date, event.refDate, model.viewerToday)
    : calculateProgress(model.targetTime, model.refTime, nowTime);
}

function eventDifference(event, model, nowTime) {
  return event.kind === 'all-day'
    ? getCalendarDateDiff(model.viewerToday, event.date, event.units)
    : getDiff(model.targetTime, nowTime, event.units, event.timeZone);
}

class EventListRenderer {
  constructor(futureContainer, pastContainer) {
    this.futureContainer = futureContainer;
    this.pastContainer = pastContainer;
    this.views = new Map();
    this.emptyFuture = null;
    this.emptyPast = null;
    this.nextTimedBoundaryAt = Infinity;
    this.lastTickTime = Date.now();
    this.observer = 'IntersectionObserver' in window
      ? new IntersectionObserver(entries => this.handleIntersections(entries), { rootMargin: '180px 0px' })
      : null;

    const openFromList = event => {
      const card = event.target.closest('.event-card[data-event-id]');
      if (card) openDetailSheet(card.dataset.eventId);
    };
    this.futureContainer.addEventListener('click', openFromList);
    this.pastContainer.addEventListener('click', openFromList);
  }

  handleIntersections(entries) {
    const now = Date.now();
    const viewerToday = formatInstantDateKey(now, getSystemTimeZone());
    entries.forEach(entry => {
      const view = this.views.get(entry.target.dataset.eventId);
      if (!view) return;
      view.isVisible = entry.isIntersecting;
      if (view.isVisible) this.updateLiveView(view, now, true, viewerToday);
    });
  }

  render(events, nowTime = Date.now()) {
    const viewerTimeZone = getSystemTimeZone();
    const viewerToday = formatInstantDateKey(nowTime, viewerTimeZone);
    const prepared = events
      .map(event => ({ event, model: createEventTimeModel(event, nowTime, viewerTimeZone, viewerToday) }))
      .filter(item => item.model);
    const activeIds = new Set(prepared.map(item => item.event.id));

    this.views.forEach((view, id) => {
      if (activeIds.has(id)) return;
      this.observer?.unobserve(view.element);
      clearFlipClock(view.clock);
      view.element.remove();
      this.views.delete(id);
    });

    const future = [];
    const past = [];
    prepared.forEach(item => {
      let view = this.views.get(item.event.id);
      if (!view) {
        view = this.createView(item.event.id);
        this.views.set(item.event.id, view);
      }
      this.updateView(view, item.event, item.model, nowTime);
      (item.model.isPast ? past : future).push({ ...item, view });
    });

    this.nextTimedBoundaryAt = future.reduce((next, item) =>
      item.model.kind === 'timed' ? Math.min(next, item.model.targetTime) : next, Infinity);
    this.lastTickTime = nowTime;

    future.sort(comparePreparedEvents);
    past.sort((left, right) => comparePreparedEvents(right, left));
    this.reconcileList(this.futureContainer, future, false);
    this.reconcileList(this.pastContainer, past, true);

    setTextIfChanged(futureCount, future.length);
    setTextIfChanged(pastCount, past.length);
    setTextIfChanged(nextEventCopy, future.length
      ? `Als Nächstes: ${future[0].event.name} · ${formatEventBadgeDate(future[0].model.targetLocalDate, future[0].model.viewerToday)}`
      : 'Noch ist alles offen – erschaffe einen Moment, auf den du dich freuen kannst.');
  }

  createView(id) {
    const viewA11yId = ++eventViewSequence;
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'event-card ripple-host stagger-enter no-image';
    element.dataset.eventId = id;

    const background = document.createElement('div');
    background.className = 'card-bg';
    const scrim = document.createElement('div');
    scrim.className = 'card-scrim';
    const content = document.createElement('div');
    content.className = 'card-content';
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const badge = document.createElement('span');
    badge.className = 'card-badge';
    badge.id = `event-badge-${viewA11yId}`;
    meta.appendChild(badge);
    const name = document.createElement('div');
    name.className = 'card-name';
    name.id = `event-name-${viewA11yId}`;
    const clock = document.createElement('div');
    clock.className = 'flip-clock';
    clock.dataset.clockFor = id;
    element.setAttribute('aria-labelledby', name.id);
    element.setAttribute('aria-describedby', badge.id);
    content.append(meta, name, clock);
    element.append(background, scrim, content);

    const view = {
      id, element, background, content, badge, name, clock,
      progressWrap: null, progressBar: null,
      event: null, model: null, imageSource: null, unitsKey: '',
      staggerIndex: null, isVisible: !this.observer,
      nextUpdateAt: 0, nextClockUpdateAt: 0, nextProgressUpdateAt: 0, lastProgressWidth: null
    };
    this.observer?.observe(element);
    return view;
  }

  updateView(view, event, model, nowTime) {
    view.event = event;
    view.model = model;
    setTextIfChanged(view.name, event.name);
    setTextIfChanged(view.badge, formatEventBadgeDate(model.targetLocalDate, model.viewerToday));
    view.element.classList.toggle('no-image', !event.img);

    if (view.imageSource !== event.img) {
      view.imageSource = event.img;
      view.background.style.backgroundImage = event.img ? `url(${JSON.stringify(event.img)})` : '';
    }

    const unitsKey = event.units.join('|');
    if (view.unitsKey !== unitsKey) {
      view.unitsKey = unitsKey;
      clearFlipClock(view.clock);
    }

    const clockSummary = updateFlipClockSummary(
      view.clock,
      eventDifference(event, model, nowTime),
      false,
      model.isPast ? 'Seit dem Ereignis vergangen' : 'Noch bis zum Ereignis'
    );
    setAttributeIfChanged(view.element, 'aria-describedby', `${view.badge.id} ${clockSummary.id}`);

    const hasProgress = event.refDate !== '';
    if (hasProgress && !view.progressWrap) {
      view.progressWrap = document.createElement('div');
      view.progressWrap.className = 'card-progress-wrap';
      view.progressWrap.setAttribute('role', 'progressbar');
      view.progressWrap.setAttribute('aria-valuemin', '0');
      view.progressWrap.setAttribute('aria-valuemax', '100');
      view.progressWrap.setAttribute('aria-valuenow', '0');
      view.progressWrap.setAttribute('aria-valuetext', '0 Prozent');
      view.progressWrap.setAttribute('aria-label', `Fortschritt bis ${event.name}`);
      view.progressBar = document.createElement('div');
      view.progressBar.className = 'card-progress-bar';
      view.progressBar.setAttribute('aria-hidden', 'true');
      view.progressWrap.appendChild(view.progressBar);
      view.content.appendChild(view.progressWrap);
    } else if (!hasProgress && view.progressWrap) {
      view.progressWrap.remove();
      view.progressWrap = null;
      view.progressBar = null;
      view.lastProgressWidth = null;
    }
    if (view.progressWrap) setAttributeIfChanged(view.progressWrap, 'aria-label', `Fortschritt bis ${event.name}`);

    view.nextUpdateAt = 0;
    view.nextClockUpdateAt = 0;
    view.nextProgressUpdateAt = 0;
    if (view.isVisible) this.updateLiveView(view, nowTime, true, model.viewerToday);
  }

  updateLiveView(view, nowTime, force = false, viewerToday = null) {
    if (!view.event || !view.model || (!force && nowTime < view.nextUpdateAt)) return;
    view.model.viewerToday = viewerToday || formatInstantDateKey(nowTime, getSystemTimeZone());
    const clockDue = force || nowTime >= view.nextClockUpdateAt;
    const progressDue = Boolean(view.progressBar) && (force || nowTime >= view.nextProgressUpdateAt);

    if (clockDue) {
      const summary = renderFlipClock(
        view.clock,
        eventDifference(view.event, view.model, nowTime),
        false,
        view.model.isPast ? 'Seit dem Ereignis vergangen' : 'Noch bis zum Ereignis'
      );
      setAttributeIfChanged(view.element, 'aria-describedby', `${view.badge.id} ${summary.id}`);
      let clockCadence = Infinity;
      if (view.event.kind === 'timed') {
        if (view.event.units.includes('seconds')) clockCadence = MS_PER_SECOND;
        else if (view.event.units.some(unit => unit !== 'seconds')) clockCadence = MS_PER_MINUTE;
      }
      view.nextClockUpdateAt = Number.isFinite(clockCadence)
        ? Math.floor(nowTime / clockCadence) * clockCadence + clockCadence
        : Infinity;
    }

    if (progressDue) {
      const progress = eventProgress(view.event, view.model, nowTime) ?? 0;
      const width = progress.toFixed(3);
      if (view.lastProgressWidth !== width) {
        view.progressBar.style.width = `${width}%`;
        view.lastProgressWidth = width;
      }
      setAttributeIfChanged(view.progressWrap, 'aria-valuenow', progress.toFixed(1));
      setAttributeIfChanged(view.progressWrap, 'aria-valuetext', formatProgressText(progress));
      const progressCadence = view.event.kind === 'timed' ? MS_PER_SECOND : Infinity;
      view.nextProgressUpdateAt = Number.isFinite(progressCadence)
        ? Math.floor(nowTime / progressCadence) * progressCadence + progressCadence
        : Infinity;
    } else if (!view.progressBar) {
      view.nextProgressUpdateAt = Infinity;
    }

    view.nextUpdateAt = Math.min(view.nextClockUpdateAt, view.nextProgressUpdateAt);
  }

  reconcileList(container, items, isPast) {
    const emptyKey = isPast ? 'emptyPast' : 'emptyFuture';
    if (items.length === 0) {
      if (!this[emptyKey]) {
        this[emptyKey] = createEmptyStateElement(
          isPast ? 'Noch nichts im Rückblick' : 'Deine Zukunft ist noch ganz offen',
          isPast ? 'Sobald ein Ereignis erreicht ist, wandert es automatisch hierher.' : 'Lege deinen ersten Moment an – vom Urlaub bis zum persönlichen Meilenstein.',
          !isPast
        );
        container.appendChild(this[emptyKey]);
      }
      return;
    }

    this[emptyKey]?.remove();
    this[emptyKey] = null;
    let cursor = container.firstElementChild;
    items.forEach((item, index) => {
      const staggerIndex = String(Math.min(index, 8));
      if (item.view.staggerIndex !== staggerIndex) {
        item.view.staggerIndex = staggerIndex;
        item.view.element.style.setProperty('--stagger-index', staggerIndex);
      }
      if (item.view.element === cursor) {
        cursor = cursor.nextElementSibling;
      } else {
        container.insertBefore(item.view.element, cursor);
      }
    });
  }

  hasTimedBoundaryCrossed(nowTime) {
    const clockMovedBackward = nowTime < this.lastTickTime;
    this.lastTickTime = nowTime;
    return clockMovedBackward || nowTime >= this.nextTimedBoundaryAt;
  }

  updateLive(nowTime = Date.now(), force = false) {
    const viewerToday = formatInstantDateKey(nowTime, getSystemTimeZone());
    this.views.forEach(view => {
      if (view.isVisible) this.updateLiveView(view, nowTime, force, viewerToday);
    });
  }
}

function renderEvents() {
  eventRenderer?.render(eventStore.getEvents(), Date.now());
}

function updateDetailLive(nowTime, force = false) {
  if (!currentDetailId || !detailSheet.classList.contains('open')) return;
  if (!force && nowTime < detailNextUpdateAt) return;
  const event = eventStore.getEvent(currentDetailId);
  if (!event) return;
  const model = createEventTimeModel(event, nowTime);
  if (!model) return;
  const clockDue = force || nowTime >= detailNextClockUpdateAt;
  const progressDue = event.refDate !== '' && (force || nowTime >= detailNextProgressUpdateAt);

  if (clockDue) {
    renderFlipClock(
      detailFlipClock,
      eventDifference(event, model, nowTime),
      true,
      model.isPast ? 'Seit diesem Ereignis vergangen' : 'Noch bis zu diesem Ereignis'
    );
    let clockCadence = Infinity;
    if (event.kind === 'timed') {
      clockCadence = event.units.includes('seconds') ? MS_PER_SECOND : MS_PER_MINUTE;
    }
    detailNextClockUpdateAt = Number.isFinite(clockCadence)
      ? Math.floor(nowTime / clockCadence) * clockCadence + clockCadence
      : Infinity;
  }

  if (progressDue) {
    const progress = eventProgress(event, model, nowTime) ?? 0;
    const width = `${progress.toFixed(3)}%`;
    if (force || detailProgressFill.style.width !== width) detailProgressFill.style.width = width;
    setTextIfChanged(detailProgressPct, `${progress.toFixed(1)}%`);
    setAttributeIfChanged(detailProgressWrap, 'aria-valuenow', progress.toFixed(1));
    setAttributeIfChanged(detailProgressWrap, 'aria-valuetext', formatProgressText(progress));
    const progressCadence = event.kind === 'timed' ? MS_PER_SECOND : Infinity;
    detailNextProgressUpdateAt = Number.isFinite(progressCadence)
      ? Math.floor(nowTime / progressCadence) * progressCadence + progressCadence
      : Infinity;
  } else if (event.refDate === '') {
    detailNextProgressUpdateAt = Infinity;
  }
  detailNextUpdateAt = Math.min(detailNextClockUpdateAt, detailNextProgressUpdateAt);
}

function tick(force = false) {
  if (document.hidden && !force) return;
  const now = Date.now();
  if (eventRenderer?.hasTimedBoundaryCrossed(now)) eventRenderer.render(eventStore.getEvents(), now);
  eventRenderer?.updateLive(now, force);
  updateDetailLive(now, force);
}

class SelfCorrectingScheduler {
  constructor(callback, intervalMs) {
    this.callback = callback;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.running = false;
    this.handleVisibility = () => {
      this.clearTimer();
      if (!document.hidden && this.running) {
        this.callback(true);
        this.scheduleNext();
      }
    };
    this.handleTimeout = () => {
      this.timer = null;
      if (!this.running || document.hidden) return;
      this.callback(false);
      this.scheduleNext();
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    document.addEventListener('visibilitychange', this.handleVisibility);
    if (!document.hidden) {
      this.callback(true);
      this.scheduleNext();
    }
  }

  scheduleNext() {
    this.clearTimer();
    const now = Date.now();
    const nextBoundary = Math.floor(now / this.intervalMs) * this.intervalMs + this.intervalMs;
    this.timer = setTimeout(this.handleTimeout, Math.max(16, nextBoundary - now + 4));
  }

  clearTimer() {
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
  }

  stop() {
    this.running = false;
    this.clearTimer();
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }
}

function nextLocalDayBoundary(nowTime = Date.now()) {
  const timeZone = getSystemTimeZone();
  let dateKey = addCalendarDateDays(formatInstantDateKey(nowTime, timeZone), 1);
  for (let attempts = 0; attempts < 4 && dateKey; attempts++) {
    const start = resolveStartOfZonedDay(dateKey, timeZone);
    if (start && start.instant > nowTime) return start.instant;
    dateKey = addCalendarDateDays(dateKey, 1);
  }
  return nowTime + MS_PER_DAY;
}

class MidnightRefreshScheduler {
  constructor(callback) {
    this.callback = callback;
    this.timer = null;
    this.running = false;
    this.marker = '';
    this.handleVisibility = () => {
      this.clearTimer();
      if (!document.hidden && this.running) {
        this.refreshIfNeeded();
        this.scheduleNext();
      }
    };
    this.handleTimeout = () => {
      this.timer = null;
      if (!this.running || document.hidden) return;
      this.refreshIfNeeded(true);
      this.scheduleNext();
    };
  }

  getMarker(nowTime = Date.now()) {
    const timeZone = getSystemTimeZone();
    return `${timeZone}|${formatInstantDateKey(nowTime, timeZone)}`;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.marker = this.getMarker();
    document.addEventListener('visibilitychange', this.handleVisibility);
    if (!document.hidden) this.scheduleNext();
  }

  refreshIfNeeded(force = false) {
    const nextMarker = this.getMarker();
    if (!force && nextMarker === this.marker) return;
    this.marker = nextMarker;
    this.callback();
  }

  scheduleNext() {
    this.clearTimer();
    const now = Date.now();
    const boundary = nextLocalDayBoundary(now);
    this.timer = setTimeout(this.handleTimeout, Math.max(100, boundary - now + 75));
  }

  clearTimer() {
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
  }

  stop() {
    this.running = false;
    this.clearTimer();
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }
}

function handleMidnightRefresh() {
  updateTodayLabel();
  renderEvents();
  tick(true);
}

/* ── DST-SAFE CALENDAR DIFFERENCE ── */
function resolveCompatibleZonedComponents(components, timeZone) {
  const civilEpoch = createUtcDate(
    components.year, components.month - 1, components.day,
    components.hour, components.minute, components.second
  ).getTime();
  const shiftedCandidates = [...getZoneOffsetsNearCivilEpoch(civilEpoch, timeZone)]
    .map(offset => civilEpoch - offset)
    .map(instant => {
      const zoned = getZonedParts(instant, timeZone);
      const representedCivil = createUtcDate(
        zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second
      ).getTime();
      return { instant, shift: representedCivil - civilEpoch };
    })
    .filter(candidate => candidate.shift > 0)
    .sort((left, right) => left.shift - right.shift || left.instant - right.instant);
  if (shiftedCandidates.length) return shiftedCandidates[0].instant;

  // Defensive fallback for unusual historical transitions not covered by the nearby offsets.
  const initialDate = datePartsToKey(components);
  const initialMinute = components.hour * 60 + components.minute;
  for (let shift = 0; shift <= 180; shift++) {
    const absoluteMinute = initialMinute + shift;
    const dayOffset = Math.floor(absoluteMinute / (24 * 60));
    const minuteOfDay = ((absoluteMinute % (24 * 60)) + 24 * 60) % (24 * 60);
    const shiftedDate = addCalendarDateDays(initialDate, dayOffset);
    const date = parseDateKey(shiftedDate);
    if (!date) return null;
    const result = resolveZonedComponents({
      ...date,
      hour: Math.floor(minuteOfDay / 60),
      minute: minuteOfDay % 60,
      second: components.second
    }, timeZone, 'earlier');
    if (result.ok) return result.instant;
  }
  return null;
}

function addZonedCalendarUnit(instant, amount, unit, timeZone) {
  const parts = getZonedParts(instant, timeZone);
  const milliseconds = ((instant % MS_PER_SECOND) + MS_PER_SECOND) % MS_PER_SECOND;
  const sourceDate = datePartsToKey(parts);
  const targetDate = unit === 'years'
    ? addCalendarDateYears(sourceDate, amount)
    : unit === 'months'
      ? addCalendarDateMonths(sourceDate, amount)
      : addCalendarDateDays(sourceDate, amount);
  const date = parseDateKey(targetDate);
  if (!date) return null;
  const components = { ...date, hour: parts.hour, minute: parts.minute, second: parts.second };
  const resolved = resolveZonedComponents(components, timeZone, 'earlier');
  const resolvedInstant = resolved.ok ? resolved.instant : resolveCompatibleZonedComponents(components, timeZone);
  return resolvedInstant == null ? null : resolvedInstant + milliseconds;
}

function countWholeInstantUnits(start, end, estimate, adder) {
  let count = Math.max(0, estimate);
  let candidate = adder(start, count);
  while (count > 0 && (candidate == null || candidate > end)) {
    count--;
    candidate = adder(start, count);
  }
  let next = adder(start, count + 1);
  while (next != null && next <= end) {
    count++;
    candidate = next;
    next = adder(start, count + 1);
  }
  return { count, instant: candidate ?? start };
}

function getDiff(target, now, unitsList, timeZone = getSystemTimeZone()) {
  const result = [];
  let start = Math.min(target, now);
  const end = Math.max(target, now);
  const safeTimeZone = isValidTimeZone(timeZone) ? timeZone : getSystemTimeZone();

  if (unitsList.includes('years')) {
    const startParts = getZonedParts(start, safeTimeZone);
    const endParts = getZonedParts(end, safeTimeZone);
    const part = countWholeInstantUnits(start, end, endParts.year - startParts.year,
      (instant, years) => addZonedCalendarUnit(instant, years, 'years', safeTimeZone));
    result.push({ unit: 'years', val: part.count });
    start = part.instant;
  }

  if (unitsList.includes('months')) {
    const startParts = getZonedParts(start, safeTimeZone);
    const endParts = getZonedParts(end, safeTimeZone);
    const estimate = (endParts.year - startParts.year) * 12 + endParts.month - startParts.month;
    const part = countWholeInstantUnits(start, end, estimate,
      (instant, months) => addZonedCalendarUnit(instant, months, 'months', safeTimeZone));
    result.push({ unit: 'months', val: part.count });
    start = part.instant;
  }

  if (unitsList.includes('weeks')) {
    const estimate = Math.floor((
      calendarDayNumber(formatInstantDateKey(end, safeTimeZone)) -
      calendarDayNumber(formatInstantDateKey(start, safeTimeZone))
    ) / 7);
    const part = countWholeInstantUnits(start, end, estimate,
      (instant, weeks) => addZonedCalendarUnit(instant, weeks * 7, 'days', safeTimeZone));
    result.push({ unit: 'weeks', val: part.count });
    start = part.instant;
  }

  if (unitsList.includes('days')) {
    const estimate = Math.max(0,
      calendarDayNumber(formatInstantDateKey(end, safeTimeZone)) -
      calendarDayNumber(formatInstantDateKey(start, safeTimeZone))
    );
    const part = countWholeInstantUnits(start, end, estimate,
      (instant, days) => addZonedCalendarUnit(instant, days, 'days', safeTimeZone));
    result.push({ unit: 'days', val: part.count });
    start = part.instant;
  }

  let diffMs = end - start;
  const map = { hours: MS_PER_HOUR, minutes: MS_PER_MINUTE, seconds: MS_PER_SECOND };
  ['hours', 'minutes', 'seconds'].forEach(unit => {
    if (!unitsList.includes(unit)) return;
    const val = Math.floor(diffMs / map[unit]);
    result.push({ unit, val });
    diffMs -= val * map[unit];
  });

  return result;
}

const flipClockStates = new WeakMap();

function cancelFlipDigitAnimation(digit) {
  if (digit?.animationTimer != null) clearTimeout(digit.animationTimer);
  if (digit) {
    digit.animationTimer = null;
    digit.animationToken++;
  }
}

function clearFlipClock(container) {
  const state = flipClockStates.get(container);
  state?.columns.forEach(column => column.digits.forEach(cancelFlipDigitAnimation));
  flipClockStates.delete(container);
  container.replaceChildren();
}

function createFlipDigit(isWide) {
  const wrap = document.createElement('div');
  wrap.className = isWide ? 'detail-flip-digit-wrap wide' : 'flip-digit-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  const faceClass = isWide ? 'detail-flip-face flip-face' : 'flip-face';

  const createFace = className => {
    const face = document.createElement('div');
    face.className = `${faceClass} ${className}`;
    face.textContent = '0';
    return face;
  };

  const topFront = createFace('flip-face-top flip-face-front face-top-front');
  const botFront = createFace('flip-face-bottom flip-face-front face-bot-front');
  const topBack = createFace('flip-face-top flip-face-back face-top-back');
  const botBack = createFace('flip-face-bottom flip-face-back face-bot-back');
  wrap.append(topFront, botFront, topBack, botBack);
  return { wrap, topFront, botFront, topBack, botBack, animationTimer: null, animationToken: 0 };
}

function formatAccessibleDifference(diffObj) {
  const parts = diffObj.map(item => {
    const forms = unitSpokenForms[item.unit] || [item.unit, item.unit];
    const label = Number(item.val) === 1 ? forms[0] : forms[1];
    return `${item.val} ${label}`;
  });
  return parts.length ? parts.join(', ') : '0 Sekunden';
}

function ensureFlipClockState(container, isWide) {
  let state = flipClockStates.get(container);
  if (!state || state.isWide !== isWide) {
    clearFlipClock(container);
    const summary = document.createElement('span');
    summary.className = 'visually-hidden';
    summary.id = `flip-summary-${++flipSummarySequence}`;
    summary.dataset.flipSummary = '';
    const isCalculatorOutput = container.id === 'calc-flip-clock';
    summary.setAttribute('role', isCalculatorOutput ? 'status' : 'timer');
    summary.setAttribute('aria-live', isCalculatorOutput ? 'polite' : 'off');
    summary.setAttribute('aria-atomic', 'true');
    container.appendChild(summary);
    state = { isWide, summary, columns: new Map() };
    flipClockStates.set(container, state);
  }
  return state;
}

function updateFlipClockSummary(container, diffObj, isWide, summaryPrefix = 'Zeitspanne') {
  const state = ensureFlipClockState(container, isWide);
  state.summary.textContent = `${summaryPrefix}: ${formatAccessibleDifference(diffObj)}.`;
  return state.summary;
}

function renderFlipClock(container, diffObj, isWide, summaryPrefix = 'Zeitspanne') {
  const state = ensureFlipClockState(container, isWide);
  updateFlipClockSummary(container, diffObj, isWide, summaryPrefix);

  const activeUnits = new Set(diffObj.map(item => item.unit));
  state.columns.forEach((column, unit) => {
    if (!activeUnits.has(unit)) {
      column.digits.forEach(cancelFlipDigitAnimation);
      column.element.remove();
      state.columns.delete(unit);
    }
  });

  let cursor = state.summary.nextElementSibling;
  diffObj.forEach(item => {
    let column = state.columns.get(item.unit);
    if (!column) {
      const element = document.createElement('div');
      element.className = isWide ? 'detail-flip-col' : 'flip-col';
      element.dataset.unit = item.unit;
      element.setAttribute('aria-hidden', 'true');

      const row = document.createElement('div');
      row.className = isWide ? 'detail-flip-digits-row' : 'flip-digits-row';
      const label = document.createElement('div');
      label.className = isWide ? 'detail-flip-label' : 'flip-label';
      label.textContent = unitTranslations[item.unit];
      element.append(row, label);
      column = { element, row, digits: [] };
      state.columns.set(item.unit, column);
    }
    if (column.element === cursor) {
      cursor = cursor.nextElementSibling;
    } else {
      container.insertBefore(column.element, cursor);
    }

    const valStr = String(item.val).padStart(2, '0');
    while (column.digits.length < valStr.length) {
      const digit = createFlipDigit(isWide);
      column.digits.push(digit);
      column.row.appendChild(digit.wrap);
    }
    while (column.digits.length > valStr.length) {
      const digit = column.digits.pop();
      cancelFlipDigitAnimation(digit);
      digit.wrap.remove();
    }

    for (let index = 0; index < valStr.length; index++) {
      const digit = column.digits[index];
      const newVal = valStr[index];
      const oldVal = digit.wrap.dataset.val;
      if (newVal === oldVal) continue;

      cancelFlipDigitAnimation(digit);
      const animationToken = digit.animationToken;
      digit.wrap.dataset.val = newVal;
      if (oldVal !== undefined && !reducedMotionQuery.matches) {
        digit.wrap.classList.remove('flipping');
        digit.topFront.textContent = oldVal;
        digit.botFront.textContent = oldVal;
        digit.topBack.textContent = newVal;
        digit.botBack.textContent = newVal;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (digit.animationToken === animationToken) digit.wrap.classList.add('flipping');
        }));
        digit.animationTimer = setTimeout(() => {
          if (digit.animationToken !== animationToken) return;
          digit.topFront.textContent = newVal;
          digit.botFront.textContent = newVal;
          digit.wrap.classList.remove('flipping');
          digit.animationTimer = null;
        }, 340);
      } else {
        digit.topFront.textContent = newVal;
        digit.botFront.textContent = newVal;
        digit.topBack.textContent = newVal;
        digit.botBack.textContent = newVal;
      }
    }
  });
  return state.summary;
}

/* ── MODALS & FORMS ── */
function openDetailSheet(id) {
  const ev = eventStore.getEvent(id);
  if (!ev) return;
  if (!modalHistoryActive) lastFocusedElement = document.activeElement;
  currentDetailId = id;
  populateDetailSheet(ev);
  clearFlipClock(detailFlipClock);
  showSheet(detailSheet);
  tick(true);
  requestAnimationFrame(() => document.getElementById('detail-close-btn').focus());
}

function populateDetailSheet(ev) {
  detailNextUpdateAt = 0;
  detailNextClockUpdateAt = 0;
  detailNextProgressUpdateAt = 0;
  document.getElementById('detail-name').textContent = ev.name;
  const heroBg = document.getElementById('detail-hero-bg');
  heroBg.style.backgroundImage = ev.img ? `url(${JSON.stringify(ev.img)})` : 'linear-gradient(145deg, hsl(var(--hue-primary), 48%, 30%), hsl(var(--hue-primary), 38%, 17%))';

  const dateLabel = formatCalendarDate(ev.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  if (ev.kind === 'all-day') {
    document.getElementById('detail-date').textContent = `${dateLabel} · ganztägig`;
  } else {
    const resolution = resolveZonedDateTime(ev.date, ev.time, ev.timeZone, ev.disambiguation);
    const occurrence = resolution.status === 'ambiguous'
      ? ` · ${ev.disambiguation === 'later' ? 'zweites' : 'erstes'} Vorkommen`
      : '';
    document.getElementById('detail-date').textContent = `${dateLabel}, ${ev.time} Uhr · ${ev.timeZone}${occurrence}`;
  }

  const descRow = document.getElementById('detail-desc-row');
  descRow.hidden = !ev.desc;
  document.getElementById('detail-desc').textContent = ev.desc || '';

  if (ev.refDate !== '') {
    detailProgressWrap.hidden = false;
    document.getElementById('detail-progress-label').textContent = `Fortschritt seit ${formatCalendarDate(ev.refDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    detailProgressWrap.setAttribute('aria-label', `Fortschritt bis ${ev.name}`);
  } else {
    detailProgressWrap.hidden = true;
  }
}

function openEditSheet(id = null) {
  const previousFocus = document.activeElement;
  if (!modalHistoryActive) lastFocusedElement = previousFocus;
  hideSheets(false, false);
  currentEditId = id;
  imgData = null;
  clearImage();
  document.getElementById('edit-headline').textContent = id ? 'Ereignis bearbeiten' : 'Neues Ereignis';

  const ev = id ? eventStore.getEvent(id) : null;
  if (id && !ev) {
    currentEditId = null;
    currentEditBaseEvent = null;
    return showSnackbar('Ereignis wurde nicht gefunden.');
  }
  currentEditBaseEvent = ev;
  currentEditTimeZone = ev?.timeZone || getSystemTimeZone();
  eventNameInput.value = ev?.name || '';
  eventDateInput.value = ev?.date || '';
  eventTimeInput.value = ev?.time || '';
  eventRefDateInput.value = ev?.refDate || '';
  eventDescriptionInput.value = ev?.desc || '';
  dstChoiceInput.value = ev?.disambiguation || 'earlier';
  resetEditorValidation();
  updateDateTimeDisambiguation();

  document.querySelectorAll('#unit-wrap .unit-chip').forEach(chip => {
    const selected = ev ? ev.units.includes(chip.dataset.unit) : DEFAULT_UNITS.includes(chip.dataset.unit);
    chip.classList.toggle('selected', selected);
    chip.setAttribute('aria-pressed', String(selected));
  });

  if (ev?.img) {
    if (/^https?:/i.test(ev.img)) document.getElementById('f-img-url').value = ev.img;
    setPreview(ev.img);
    if (ev.img.startsWith('data:image/')) imgData = ev.img;
  }

  showSheet(editSheet);
  setTimeout(() => eventNameInput.focus(), 120);
}

function setModalBackgroundInert(shouldBeInert) {
  if (shouldBeInert) {
    modalBackgroundElements.forEach(element => {
      if (!modalBackgroundState.has(element)) modalBackgroundState.set(element, element.hasAttribute('inert'));
      element.setAttribute('inert', '');
    });
    return;
  }
  modalBackgroundState.forEach((hadInert, element) => {
    if (!element.isConnected) return;
    element.toggleAttribute('inert', hadInert);
  });
  modalBackgroundState.clear();
}

function getOpenSheet() {
  if (editSheet.classList.contains('open')) return editSheet;
  if (detailSheet.classList.contains('open')) return detailSheet;
  return null;
}

const focusableSelector = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'object', 'embed',
  '[contenteditable="true"]', '[tabindex]:not([tabindex="-1"])'
].join(',');

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(focusableSelector)).filter(element => {
    if (!(element instanceof HTMLElement) || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && element.getClientRects().length > 0;
  });
}

function isUsableFocusTarget(element) {
  if (!(element instanceof HTMLElement) || !element.isConnected || element.hidden || element.matches(':disabled')) return false;
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  return getComputedStyle(element).visibility !== 'hidden';
}

function restoreModalFocus(preferredTarget) {
  const fallback = activeTab !== 2 && isUsableFocusTarget(addBtn)
    ? addBtn
    : isUsableFocusTarget(tabItems[activeTab])
      ? tabItems[activeTab]
      : mainContent;
  const target = isUsableFocusTarget(preferredTarget) ? preferredTarget : fallback;
  requestAnimationFrame(() => {
    const finalTarget = isUsableFocusTarget(target)
      ? target
      : isUsableFocusTarget(fallback)
        ? fallback
        : mainContent;
    finalTarget.focus({ preventScroll: false });
  });
}

function keepFocusInsideOpenSheet(event) {
  const openSheet = getOpenSheet();
  if (!openSheet || openSheet.contains(event.target)) return;
  const focusables = getFocusableElements(openSheet);
  (focusables[0] || openSheet).focus();
}

function showSheet(sheet) {
  if (menuPopup.classList.contains('open')) setMenuOpen(false);
  if (!modalHistoryActive) {
    history.pushState({ tageszaehlerModal: true }, '');
    modalHistoryActive = true;
  }
  setModalBackgroundInert(true);
  backdrop.classList.add('open');
  document.body.classList.add('modal-open');
  sheet.removeAttribute('inert');
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
}

function hideSheets(restoreFocus = true, resetIds = true) {
  const focusTarget = lastFocusedElement;
  backdrop.classList.remove('open');
  document.body.classList.remove('modal-open');
  [detailSheet, editSheet].forEach(sheet => {
    sheet.classList.remove('open', 'dragging');
    sheet.style.transform = '';
    sheet.style.transition = '';
    sheet.setAttribute('aria-hidden', 'true');
    sheet.setAttribute('inert', '');
  });
  setModalBackgroundInert(false);
  if (resetIds) currentDetailId = null;
  if (restoreFocus) restoreModalFocus(focusTarget);
}

function closeSheets() {
  abortImageProcessing();
  hideSheets(true, true);
  currentEditId = null;
  currentEditBaseEvent = null;
  currentEditTimeZone = null;
  if (modalHistoryActive) {
    modalHistoryActive = false;
    history.back();
  }
}

function closeEditSheet() {
  const editId = currentEditId;
  abortImageProcessing();
  currentEditId = null;
  currentEditBaseEvent = null;
  currentEditTimeZone = null;
  if (editId) {
    hideSheets(false, false);
    openDetailSheet(editId);
  } else {
    closeSheets();
  }
}

function updateDateTimeDisambiguation() {
  const date = eventDateInput.value;
  const time = eventTimeInput.value;
  const timeZone = isValidTimeZone(currentEditTimeZone) ? currentEditTimeZone : getSystemTimeZone();
  eventTimeInput.setCustomValidity('');
  timeZoneHint.classList.remove('error');

  if (time === '') {
    dstChoiceField.hidden = true;
    timeZoneHint.textContent = 'Ohne Uhrzeit wird das Ereignis als reiner Kalendertag behandelt.';
    return { ok: true, status: 'all-day' };
  }

  timeZoneHint.textContent = `Zeitzone: ${timeZone}`;
  if (!isValidDateInput(date) || !isValidTimeInput(time)) {
    dstChoiceField.hidden = true;
    return { ok: false, status: 'invalid' };
  }

  const resolution = resolveZonedDateTime(date, time, timeZone, dstChoiceInput.value);
  if (!resolution.ok && resolution.status === 'nonexistent') {
    dstChoiceField.hidden = true;
    eventTimeInput.setCustomValidity('Diese Uhrzeit existiert wegen der Zeitumstellung nicht.');
    timeZoneHint.textContent = `Diese Uhrzeit existiert in ${timeZone} wegen der Zeitumstellung nicht.`;
    timeZoneHint.classList.add('error');
  } else if (resolution.status === 'ambiguous') {
    dstChoiceField.hidden = false;
    timeZoneHint.textContent = `Diese Uhrzeit kommt in ${timeZone} zweimal vor. Bitte ein Vorkommen wählen.`;
  } else {
    dstChoiceField.hidden = true;
  }
  return resolution;
}

function clearEditorError(field) {
  if (!(field instanceof HTMLElement)) return;
  field.removeAttribute('aria-invalid');
  if (typeof field.setCustomValidity === 'function') field.setCustomValidity('');
  const errorElement = editorErrorElements.get(field);
  if (errorElement) errorElement.textContent = '';
}

function clearUnitError() {
  eventUnitWrap.removeAttribute('aria-invalid');
  document.getElementById('unit-error').textContent = '';
}

function resetEditorValidation() {
  editorErrorElements.forEach((_, field) => clearEditorError(field));
  clearUnitError();
  editFormStatus.textContent = '';
}

function handleEditorInput(event) {
  const field = event.target;
  if (editorErrorElements.has(field)) clearEditorError(field);
  if (field === eventDateInput || field === eventTimeInput || field === dstChoiceInput) {
    clearEditorError(eventTimeInput);
    clearEditorError(eventRefDateInput);
    updateDateTimeDisambiguation();
  }
  editFormStatus.textContent = '';
}

function validateEditorForm({ focusFirst = true } = {}) {
  resetEditorValidation();

  const name = eventNameInput.value.trim();
  const date = eventDateInput.value;
  const time = eventTimeInput.value;
  const refDate = eventRefDateInput.value;
  const desc = eventDescriptionInput.value.trim();
  const imgUrlInput = imageUrlInput.value.trim();
  const units = Array.from(eventUnitWrap.querySelectorAll('.unit-chip.selected')).map(chip => chip.dataset.unit);
  const invalidTargets = [];

  const invalidate = (field, message, focusTarget = field) => {
    if (typeof field.setCustomValidity === 'function') field.setCustomValidity(message);
    field.setAttribute('aria-invalid', 'true');
    const errorElement = editorErrorElements.get(field);
    if (errorElement) errorElement.textContent = message;
    invalidTargets.push(focusTarget);
  };

  if (!name) invalidate(eventNameInput, 'Bitte einen Namen eingeben.');
  else if (name.length > DATA_LIMITS.maxNameChars || eventNameInput.validity.tooLong) {
    invalidate(eventNameInput, `Der Name darf höchstens ${DATA_LIMITS.maxNameChars} Zeichen enthalten.`);
  }

  const validDate = isValidDateInput(date);
  if (!date) invalidate(eventDateInput, 'Bitte ein Datum auswählen.');
  else if (!validDate) invalidate(eventDateInput, 'Bitte ein gültiges Datum auswählen.');

  if (desc.length > DATA_LIMITS.maxDescriptionChars || eventDescriptionInput.validity.tooLong) {
    invalidate(eventDescriptionInput, `Die Beschreibung darf höchstens ${DATA_LIMITS.maxDescriptionChars} Zeichen enthalten.`);
  }

  const kind = time === '' ? 'all-day' : 'timed';
  const timeZone = kind === 'timed' && isValidTimeZone(currentEditTimeZone)
    ? currentEditTimeZone
    : kind === 'timed'
      ? getSystemTimeZone()
      : '';
  const disambiguation = kind === 'timed' ? dstChoiceInput.value : '';
  const target = updateDateTimeDisambiguation();

  if (time && !isValidTimeInput(time)) {
    invalidate(eventTimeInput, 'Bitte eine gültige Uhrzeit eingeben.');
  } else if (time && target.status === 'nonexistent') {
    invalidate(eventTimeInput, 'Diese Uhrzeit existiert wegen der Zeitumstellung nicht.');
  }

  const hasRefDate = refDate !== '';
  const validRefDate = !hasRefDate || isValidDateInput(refDate);
  if (!validRefDate) invalidate(eventRefDateInput, 'Bitte ein gültiges Referenzdatum auswählen.');

  if (validDate && validRefDate && hasRefDate) {
    if (kind === 'all-day' && compareDateKeys(refDate, date) >= 0) {
      invalidate(eventRefDateInput, 'Das Referenzdatum muss vor dem Ereignistag liegen.');
    } else if (kind === 'timed' && target.ok) {
      const reference = resolveStartOfZonedDay(refDate, timeZone);
      if (!reference || reference.instant >= target.instant) {
        invalidate(eventRefDateInput, 'Das Referenzdatum muss vor dem Ereignis liegen.');
      }
    }
  }

  let normalizedImageUrl = null;
  if (imgUrlInput) {
    normalizedImageUrl = normalizeImageSource(imgUrlInput);
    if (imageUrlInput.validity.tooLong || imgUrlInput.length > DATA_LIMITS.maxUrlChars) {
      invalidate(imageUrlInput, `Die Bild-URL darf höchstens ${DATA_LIMITS.maxUrlChars} Zeichen enthalten.`);
    } else if (imageUrlInput.validity.typeMismatch || !normalizedImageUrl) {
      invalidate(imageUrlInput, 'Bitte eine vollständige, gültige HTTPS-Bild-URL eingeben.');
    }
  }

  if (units.length === 0) {
    eventUnitWrap.setAttribute('aria-invalid', 'true');
    document.getElementById('unit-error').textContent = 'Bitte mindestens eine Zeiteinheit auswählen.';
    invalidTargets.push(eventUnitWrap.querySelector('.unit-chip'));
  }

  if (invalidTargets.length) {
    const errorCount = invalidTargets.length;
    editFormStatus.textContent = errorCount === 1
      ? 'Das Formular enthält einen Fehler. Bitte das markierte Feld prüfen.'
      : `Das Formular enthält ${errorCount} Fehler. Bitte die markierten Felder prüfen.`;
    showSnackbar('Bitte die markierten Eingaben korrigieren.');
    if (focusFirst) requestAnimationFrame(() => invalidTargets[0]?.focus({ preventScroll: false }));
    return { valid: false };
  }

  return {
    valid: true,
    values: { name, date, time, refDate, desc, units, kind, timeZone, disambiguation, normalizedImageUrl }
  };
}

async function saveEvent() {
  if (eventSavePending) return false;
  if (imageProcessing) {
    showSnackbar('Bitte warten, bis das Bild verarbeitet wurde.');
    return false;
  }
  const validation = validateEditorForm();
  if (!validation.valid) return false;
  const { name, date, time, refDate, desc, units, kind, timeZone, disambiguation, normalizedImageUrl } = validation.values;

  let image = imgData;
  if (normalizedImageUrl) image = normalizedImageUrl;

  const event = normalizeEvent({
    id: currentEditId || createEventId(),
    name, kind, date, time, timeZone, disambiguation, refDate, desc, units, img: image
  });
  if (!event) {
    showSnackbar('Ereignis konnte nicht gespeichert werden. Eingaben prüfen.');
    return false;
  }
  const wasEdit = Boolean(currentEditId);
  setEventSavePending(true);
  try {
    return await eventController.upsert(event, wasEdit);
  } finally {
    setEventSavePending(false);
  }
}

async function deleteCurrentEvent() {
  if (!currentDetailId || !confirm('Dieses Ereignis löschen?')) return;
  await eventController.deleteById(currentDetailId);
}

/* ── SHEET GESTURES / ACCESSIBILITY ── */
function initSheetGestures(sheet) {
  const handle = sheet.querySelector('.sheet-handle');
  if (!handle) return;
  let startY = 0;
  let deltaY = 0;
  let pointerId = null;

  handle.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerId = event.pointerId;
    startY = event.clientY;
    deltaY = 0;
    handle.setPointerCapture(pointerId);
    sheet.classList.add('dragging');
  });
  handle.addEventListener('pointermove', event => {
    if (pointerId !== event.pointerId) return;
    deltaY = Math.max(0, event.clientY - startY);
    const centeredSheet = window.matchMedia('(min-width: 700px)').matches;
    sheet.style.transform = centeredSheet ? `translate3d(-50%, ${deltaY}px, 0)` : `translate3d(0, ${deltaY}px, 0)`;
  });
  const finish = event => {
    if (pointerId !== event.pointerId) return;
    try { handle.releasePointerCapture(pointerId); } catch (_) {}
    pointerId = null;
    sheet.classList.remove('dragging');
    if (deltaY > 90) {
      closeSheets();
    } else {
      sheet.style.transform = '';
    }
  };
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape') {
    if (menuPopup.classList.contains('open')) {
      setMenuOpen(false);
      document.getElementById('menu-btn').focus();
    } else if (editSheet.classList.contains('open')) {
      closeEditSheet();
    } else if (detailSheet.classList.contains('open')) {
      closeSheets();
    }
    return;
  }
  if (event.key === 'Tab') {
    trapFocus(event);
    return;
  }

  const focusedTab = document.activeElement;
  if (!(focusedTab instanceof HTMLElement) || !focusedTab.matches('[role="tab"]') || !tabBar.contains(focusedTab)) return;
  const vertical = tabBar.getAttribute('aria-orientation') === 'vertical';
  const focusedIndex = tabItems.indexOf(focusedTab);
  let next = null;
  if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabItems.length - 1;
  else if (!vertical && event.key === 'ArrowRight') next = (focusedIndex + 1) % tabItems.length;
  else if (!vertical && event.key === 'ArrowLeft') next = (focusedIndex - 1 + tabItems.length) % tabItems.length;
  else if (vertical && event.key === 'ArrowDown') next = (focusedIndex + 1) % tabItems.length;
  else if (vertical && event.key === 'ArrowUp') next = (focusedIndex - 1 + tabItems.length) % tabItems.length;

  if (next == null) return;
  event.preventDefault();
  setActiveTab(next);
  tabItems[next].focus();
}

function trapFocus(event) {
  const openSheet = getOpenSheet();
  if (!openSheet) return;
  const focusables = getFocusableElements(openSheet);
  if (!focusables.length) {
    event.preventDefault();
    openSheet.focus();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const activeElement = document.activeElement;
  const activeIndex = focusables.indexOf(activeElement);
  if (!openSheet.contains(activeElement) || activeIndex === -1) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/* ── IMAGE HANDLING ── */
function abortError() {
  return new DOMException('Vorgang abgebrochen.', 'AbortError');
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function setImageProcessingState(processing) {
  imageProcessing = processing;
  const busy = imageProcessing || eventSavePending;
  editSaveBtn.disabled = busy;
  editSaveBtn.setAttribute('aria-busy', String(busy));
  editSaveBtn.textContent = imageProcessing ? 'Bild wird verarbeitet…' : eventSavePending ? 'Speichert…' : 'Speichern';
  imageFileBtn.setAttribute('aria-busy', String(processing));
}

function setEventSavePending(pending) {
  eventSavePending = pending;
  setImageProcessingState(imageProcessing);
}

function abortImageProcessing() {
  if (imageCompressionController) {
    imageCompressionController.abort();
    imageCompressionController = null;
    imageCompressionToken++;
  }
  setImageProcessingState(false);
}

function loadImageElement(file, signal) {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      image.src = '';
      cleanup();
      reject(abortError());
    };
    image.onload = () => {
      cleanup();
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release() {}
      });
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('Bildformat konnte nicht verarbeitet werden.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    image.src = objectUrl;
  });
}

async function decodeImageFile(file, signal) {
  throwIfAborted(signal);
  if (typeof createImageBitmap === 'function') {
    let bitmap = null;
    try {
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (error) {
        throwIfAborted(signal);
        bitmap = await createImageBitmap(file);
      }
      throwIfAborted(signal);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch (error) {
      bitmap?.close();
      if (error?.name === 'AbortError') throw error;
    }
  }
  return loadImageElement(file, signal);
}

function canvasToBlob(canvas, type, quality, signal) {
  throwIfAborted(signal);
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, quality }).then(blob => {
      throwIfAborted(signal);
      return blob;
    });
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal?.addEventListener('abort', onAbort, { once: true });
    canvas.toBlob(blob => {
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) return reject(abortError());
      if (!blob) return reject(new Error('Bild konnte nicht komprimiert werden.'));
      resolve(blob);
    }, type, quality);
  });
}

function blobToDataUrl(blob, signal) {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const reader = new FileReader();
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const onAbort = () => {
      reader.abort();
      cleanup();
      reject(abortError());
    };
    reader.onload = () => {
      cleanup();
      resolve(String(reader.result || ''));
    };
    reader.onerror = () => {
      cleanup();
      reject(new Error('Komprimiertes Bild konnte nicht gelesen werden.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    reader.readAsDataURL(blob);
  });
}

async function compressImage(file, { signal } = {}) {
  if (!(file instanceof Blob) || !file.type.startsWith('image/')) throw new Error('Bitte eine Bilddatei auswählen.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Das Bild ist zu groß. Bitte maximal 20 MB verwenden.');

  const decoded = await decodeImageFile(file, signal);
  try {
    throwIfAborted(signal);
    if (!decoded.width || !decoded.height || decoded.width * decoded.height > 100_000_000) {
      throw new Error('Das Bild hat ungültige oder zu große Abmessungen.');
    }

    const maxDimension = 1000;
    const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = typeof OffscreenCanvas === 'function' && typeof OffscreenCanvas.prototype.convertToBlob === 'function'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
    let context = null;
    try {
      context = canvas.getContext('2d', { alpha: false });
    } catch (_) {
      context = canvas.getContext('2d');
    }
    if (!context) context = canvas.getContext('2d');
    if (!context) throw new Error('Bildverarbeitung wird von diesem Browser nicht unterstützt.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);
    throwIfAborted(signal);

    const maxBlobBytes = Math.floor((DATA_LIMITS.maxImageSourceChars - 128) * 3 / 4);
    let blob = null;
    for (const quality of [0.76, 0.64, 0.52]) {
      blob = await canvasToBlob(canvas, 'image/jpeg', quality, signal);
      if (blob.size <= maxBlobBytes) break;
    }
    if (!blob || blob.size > maxBlobBytes) throw new Error('Das komprimierte Bild ist noch zu groß. Bitte ein kleineres Motiv verwenden.');

    const dataUrl = await blobToDataUrl(blob, signal);
    if (!normalizeImageSource(dataUrl)) throw new Error('Das komprimierte Bild überschreitet das Speicherlimit.');
    return dataUrl;
  } finally {
    decoded.release();
  }
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  abortImageProcessing();
  const token = ++imageCompressionToken;
  const controller = new AbortController();
  imageCompressionController = controller;
  setImageProcessingState(true);

  try {
    const compressedDataUrl = await compressImage(file, { signal: controller.signal });
    if (controller.signal.aborted || token !== imageCompressionToken) return;
    imgData = compressedDataUrl;
    imageUrlInput.value = '';
    clearEditorError(imageUrlInput);
    setPreview(imgData);
  } catch (error) {
    if (error?.name !== 'AbortError') {
      imageFileInput.value = '';
      showSnackbar(error?.message || 'Bild konnte nicht verarbeitet werden.');
    }
  } finally {
    if (token === imageCompressionToken) {
      imageCompressionController = null;
      setImageProcessingState(false);
    }
  }
}

function handleImageUrlInput(event) {
  abortImageProcessing();
  imgData = null;
  imageFileInput.value = '';
  setPreview(event.target.value.trim(), true);
}

function setPreview(src, allowUnvalidatedUrl = false) {
  const wrap = document.getElementById('img-preview-wrap');
  const img = document.getElementById('img-preview');
  const clear = document.getElementById('img-clear-btn');
  if (!src) return clearImage();
  if (!allowUnvalidatedUrl && !normalizeImageSource(src)) return clearImage();
  const token = ++imagePreviewToken;

  img.onload = () => {
    if (token !== imagePreviewToken) return;
    wrap.style.display = 'block';
    clear.style.display = 'block';
  };
  img.onerror = () => {
    if (token !== imagePreviewToken) return;
    wrap.style.display = 'none';
    if (allowUnvalidatedUrl) clear.style.display = 'block';
  };
  img.src = src;
}

function clearImage() {
  abortImageProcessing();
  imagePreviewToken++;
  imgData = null;
  imageUrlInput.value = '';
  clearEditorError(imageUrlInput);
  imageFileInput.value = '';
  const preview = document.getElementById('img-preview');
  preview.removeAttribute('src');
  document.getElementById('img-preview-wrap').style.display = 'none';
  document.getElementById('img-clear-btn').style.display = 'none';
}

/* ── IMPORT / EXPORT ── */
function exportData() {
  const events = eventStore.getEvents();
  const data = JSON.stringify(events, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `tageszaehler_export_${localDateInput()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setMenuOpen(false);
  showSnackbar(`${events.length} Ereignis${events.length === 1 ? '' : 'se'} exportiert.`);
}

function importData(event) {
  const input = event.target;
  const file = input.files[0];
  if (!file) return;
  if (file.size > DATA_LIMITS.maxImportBytes) {
    input.value = '';
    setMenuOpen(false);
    return showSnackbar(`Import fehlgeschlagen: Datei darf maximal ${Math.floor(DATA_LIMITS.maxImportBytes / 1024 / 1024)} MB groß sein.`);
  }
  const reader = new FileReader();
  reader.onload = async readEvent => {
    try {
      const raw = String(readEvent.target.result || '');
      if (raw.length > DATA_LIMITS.maxStoredJsonChars) throw new Error('Die Datei überschreitet das zulässige Datenlimit.');
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error('Die Datei enthält kein Ereignis-Array.');
      const collection = normalizeEventCollection(data, { regenerateIds: true });
      if (!collection.ok) throw new Error(`Importlimit oder Datenschema verletzt: ${collection.code}.`);
      if (collection.invalidCount) throw new Error(`${collection.invalidCount} ungültige Ereignisse gefunden.`);
      const normalized = collection.events;
      if (!confirm(`${normalized.length} Ereignis${normalized.length === 1 ? '' : 'se'} importieren und aktuelle Daten ersetzen?`)) return;
      await eventController.importEvents(normalized);
    } catch (error) {
      console.error('Import fehlgeschlagen:', error);
      showSnackbar(`Import fehlgeschlagen: ${error.message || 'ungültige Datei'}`);
    } finally {
      input.value = '';
    }
  };
  reader.onerror = () => {
    input.value = '';
    showSnackbar('Datei konnte nicht gelesen werden.');
  };
  reader.readAsText(file);
  setMenuOpen(false);
}

/* ── PWA ── */
function updateNetworkStatus(announce = true) {
  const online = navigator.onLine;
  document.documentElement.dataset.network = online ? 'online' : 'offline';
  offlineStatus.hidden = online;
  if (announce) {
    showSnackbar(online
      ? 'Wieder online.'
      : 'Offline – lokal gespeicherte Daten bleiben verfügbar.');
  }
  if (online) serviceWorkerRegistration?.update().catch(() => {});
}

const observedServiceWorkers = new WeakSet();

function notifyServiceWorkerUpdate() {
  if (serviceWorkerUpdateNotified) return;
  serviceWorkerUpdateNotified = true;
  showSnackbar('Eine neue App-Version ist verfügbar und wird beim nächsten Start aktiviert.');
}

function observeServiceWorker(worker) {
  if (!worker || observedServiceWorkers.has(worker)) return;
  observedServiceWorkers.add(worker);
  worker.addEventListener('statechange', () => {
    if (worker.state !== 'installed') return;
    if (navigator.serviceWorker.controller) notifyServiceWorkerUpdate();
    else showSnackbar('Die App ist jetzt für die Offline-Nutzung vorbereitet.');
  });
}

const serviceWorkerScriptUrl = (() => {
  const source = './sw.js';
  if (!window.trustedTypes) return source;
  const policy = window.trustedTypes.createPolicy('tageszaehler-sw', {
    createScriptURL(value) {
      if (value !== source) throw new TypeError('Nicht erlaubte Service-Worker-URL.');
      return value;
    }
  });
  return policy.createScriptURL(source);
})();

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext || !/^https?:$/.test(location.protocol)) return;
  try {
    const registration = await navigator.serviceWorker.register(serviceWorkerScriptUrl, { scope: './', updateViaCache: 'none' });
    serviceWorkerRegistration = registration;
    observeServiceWorker(registration.installing);
    if (registration.waiting) notifyServiceWorkerUpdate();
    registration.addEventListener('updatefound', () => observeServiceWorker(registration.installing));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      serviceWorkerUpdateNotified = false;
      showSnackbar('Die App wurde im Hintergrund aktualisiert.');
    });
    if (navigator.onLine) registration.update().catch(() => {});
  } catch (error) {
    console.warn('Service Worker konnte nicht registriert werden:', error);
    if (!navigator.onLine) showSnackbar('Offline-Fallback ist noch nicht zwischengespeichert. Diese Sitzung bleibt nutzbar.');
  }
}

async function installPwa() {
  setMenuOpen(false);
  if (!deferredInstallPrompt) {
    return showSnackbar('Installation ist über das Browser-Menü verfügbar.');
  }
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.hidden = true;
  appMenuTitle.hidden = true;
  if (choice.outcome !== 'accepted') showSnackbar('Installation abgebrochen.');
}

/* ── UTILS ── */
function createRipple(event) {
  const target = event.target.closest('.ripple-host');
  if (!target || target.disabled || event.button !== 0 || reducedMotionQuery.matches) return;
  const rect = target.getBoundingClientRect();
  const ripple = document.createElement('span');
  const diameter = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${diameter}px`;
  ripple.style.left = `${event.clientX - rect.left - diameter / 2}px`;
  ripple.style.top = `${event.clientY - rect.top - diameter / 2}px`;
  ripple.classList.add('ripple-wave');
  target.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  setTimeout(() => ripple.remove(), 700);
}

function showSnackbar(message) {
  const snackbar = document.getElementById('snackbar');
  clearTimeout(snackbarTimer);
  snackbar.textContent = message;
  snackbar.classList.add('show');
  snackbarTimer = setTimeout(() => snackbar.classList.remove('show'), 3500);
}

init();
