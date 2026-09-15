import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const app = readFileSync(resolve(import.meta.dirname, '..', 'app.js'), 'utf8');
const model = app.slice(app.indexOf('function normalizeImageSource('), app.indexOf('/* ── CIVIL DATE'));
const processing = app.slice(app.indexOf('/* ── IMAGE HANDLING ── */'), app.indexOf('/* ── DATENRETTUNG: ROHDATEN'));
assert.ok(model.length > 100 && processing.length > 100);

const fixtures = {
  png: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFElEQVR4nGOU96llYGBgYmBgQFAAES4A7negcZoAAAAASUVORK5CYII=',
  jpeg: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAADAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDg6KKK9w8g/9k=',
  gif: 'R0lGODdhAgADAIEAAB9MfQAAAAAAAAAAACwAAAAAAgADAAAIBgABCBwYEAA7',
  webp: 'UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoCAAMAAUAmJZgCdLoAA5gA/vWJH/4hzoc6HL/3/Ys5bAsQAAA='
};

function source(format) {
  return `data:image/${format};base64,${fixtures[format]}`;
}

function harness() {
  const requests = [];
  const timers = new Map();
  const elements = new Map();
  let nextTimer = 0;
  class FakeImage {
    set src(value) { this.url = value; if (value) requests.push(value); }
    removeAttribute(name) { if (name === 'src') this.url = ''; }
  }
  const preview = new FakeImage();
  const wrap = { style: {}, replaceChildren(node) { elements.set('img-preview', node); } };
  const urlInput = {
    value: '', validity: { typeMismatch: false }, setCustomValidity() {},
    removeAttribute() {}
  };
  for (const [id, value] of [
    ['img-preview', preview], ['img-preview-wrap', wrap],
    ['img-clear-btn', { style: {} }], ['img-file-error', { textContent: '' }],
    ['f-img-url-error', { textContent: '' }]
  ]) elements.set(id, value);
  const context = vm.createContext({
    Blob, AbortController, DOMException, Uint8Array, DataView, URL, atob,
    location: { origin: 'https://pages.example', href: 'https://pages.example/app/' },
    DATA_LIMITS: { maxImageSourceChars: 1_500_000, maxUrlChars: 4096 },
    imagePreviewToken: 0, imagePreviewTimer: null, imageCompressionController: null,
    imageCompressionToken: 0, imageProcessing: false, eventSavePending: false, imgData: null,
    imageUrlInput: urlInput, imageFileInput: { value: '' },
    editSaveBtn: { disabled: false, setAttribute() {}, textContent: '' },
    imageFileBtn: { setAttribute() {} },
    editorErrorElements: new Map([[urlInput, elements.get('f-img-url-error')]]),
    clearEditorError: () => { elements.get('f-img-url-error').textContent = ''; },
    showSnackbar: () => {},
    document: { getElementById: id => elements.get(id) },
    Image: FakeImage,
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(`${model}\n${processing}\nthis.api = { normalizeImageSource, inspectImageBytes, compressImage, validateEmbeddedImages, handleImageUrlInput, handleImageUpload, clearImage, setPreview };`, context);
  return { api: context.api, context, elements, requests, timers, urlInput };
}

test('validiert vollständiges Base64, MIME, Bildstruktur und Grenzen vor dem Dekodieren', async () => {
  const { api, context } = harness();
  for (const format of Object.keys(fixtures)) assert.equal(api.normalizeImageSource(source(format)), source(format));
  const legacyJpg = 'data:image/jpg;base64,' + fixtures.jpeg;
  assert.equal(api.normalizeImageSource(legacyJpg), legacyJpg);
  assert.equal(api.normalizeImageSource('data:image/png;base64,@@@@'), null);
  assert.equal(api.normalizeImageSource('data:image/jpeg;base64,' + fixtures.png), null);
  assert.equal(api.normalizeImageSource(source('png').slice(0, -8)), null);
  const tooWide = Buffer.from(fixtures.png, 'base64');
  tooWide.writeUInt32BE(100_000, 16);
  assert.equal(api.normalizeImageSource('data:image/png;base64,' + tooWide.toString('base64')), null);
  const tooManyPixels = Buffer.from(fixtures.png, 'base64');
  tooManyPixels.writeUInt32BE(6000, 16);
  tooManyPixels.writeUInt32BE(6000, 20);
  assert.equal(api.normalizeImageSource('data:image/png;base64,' + tooManyPixels.toString('base64')), null);

  let reads = 0;
  let decodes = 0;
  vm.runInContext('decodeImageFile = async () => { this.decodedCalls++; return { width: 2, height: 3, source: {}, release() {} }; }', context);
  context.decodedCalls = 0;
  const huge = { type: 'image/png', size: 21 * 1024 * 1024, arrayBuffer: () => { reads++; } };
  // Ein echtes Blob mit überhöhter size weist die Grenze vor arrayBuffer nach.
  const oversize = new Blob([], { type: 'image/png' });
  Object.defineProperty(oversize, 'size', { value: huge.size });
  oversize.arrayBuffer = huge.arrayBuffer;
  await assert.rejects(api.compressImage(oversize), /zu groß/);
  const file = new Blob([tooManyPixels], { type: 'image/png' });
  await assert.rejects(api.compressImage(file), /Abmessungen/);
  assert.equal(context.decodedCalls, decodes);
  assert.equal(reads, 0);
  const wrongType = new Blob([Buffer.from(fixtures.png, 'base64')], { type: 'image/jpeg' });
  await assert.rejects(api.compressImage(wrongType), /Dateityp/);
  assert.equal(context.decodedCalls, 0);
});

test('importierte eingebettete Bilder erfordern eine erfolgreiche Dekodierung', async () => {
  const { api, context } = harness();
  vm.runInContext('decodeImageFile = async () => { this.decodeCount++; return { width: 2, height: 3, release() {} }; }', context);
  context.decodeCount = 0;
  await api.validateEmbeddedImages([{ img: source('png') }, { img: source('png') }, { img: source('gif') }]);
  assert.equal(context.decodeCount, 2);
  vm.runInContext('decodeImageFile = async () => { throw new Error("synthetisch beschädigt"); }', context);
  await assert.rejects(api.validateEmbeddedImages([{ img: source('png') }]), /beschädigt/);
});

test('gültige Uploadformate komprimieren erst nach der Headerprüfung', async () => {
  const { api, context } = harness();
  context.output = source('jpeg');
  context.document.createElement = () => ({
    width: 0, height: 0,
    getContext: () => ({ fillRect() {}, drawImage() {}, set fillStyle(value) {} })
  });
  vm.runInContext(`decodeImageFile = async () => {
    this.decodeCount++;
    return { source: {}, width: 2, height: 3, release: () => { this.releases++; } };
  };
  canvasToBlob = async () => new Blob([new Uint8Array(20)], { type: 'image/jpeg' });
  blobToDataUrl = async () => this.output;`, context);
  context.decodeCount = 0;
  context.releases = 0;
  for (const format of Object.keys(fixtures)) {
    const file = new Blob([Buffer.from(fixtures[format], 'base64')], { type: `image/${format}` });
    assert.equal(await api.compressImage(file), source('jpeg'));
  }
  assert.equal(context.decodeCount, 4);
  assert.equal(context.releases, 4);
});

test('URL-Zwischenstände, relative Pfade und schnelle Wechsel erzeugen keine veraltete Vorschau', () => {
  const { api, elements, requests, timers, urlInput } = harness();
  for (const value of ['https://', '/bild.png', 'bild.png', 'https://example', 'https://user@example.com/a.png']) {
    urlInput.value = value;
    api.handleImageUrlInput({ target: urlInput });
    assert.equal(timers.size, 0);
  }
  assert.equal(requests.length, 0);
  urlInput.value = 'https://example.com/alt.png';
  api.handleImageUrlInput({ target: urlInput });
  assert.equal(requests.length, 0);
  { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); }
  const old = elements.get('img-preview');
  assert.equal(old.referrerPolicy, 'no-referrer');
  urlInput.value = 'https://example.com/neu.png';
  api.handleImageUrlInput({ target: urlInput });
  old.onload();
  assert.equal(elements.get('img-preview-wrap').style.display, 'none');
  { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); }
  const current = elements.get('img-preview');
  current.onerror();
  assert.match(elements.get('f-img-url-error').textContent, /nicht als Bild/);
  assert.deepEqual(requests, ['https://example.com/alt.png', 'https://example.com/neu.png']);
  api.clearImage();
  current.onload();
  assert.equal(elements.get('img-preview-wrap').style.display, 'none');
});

test('Upload, Abbruch und folgende URL-Auswahl verwerfen alte Bildresultate', async () => {
  const { api, context, elements, urlInput, requests } = harness();
  const pending = [];
  context.pending = pending;
  vm.runInContext('compressImage = () => new Promise(resolve => this.pending.push(resolve))', context);
  const first = api.handleImageUpload({ target: { files: [new Blob([], { type: 'image/png' })] } });
  api.clearImage();
  pending.shift()(source('png'));
  await first;
  assert.equal(context.imgData, null);
  assert.equal(requests.length, 0);

  const second = api.handleImageUpload({ target: { files: [new Blob([], { type: 'image/png' })] } });
  urlInput.value = 'https://example.com/aktuell.png';
  api.handleImageUrlInput({ target: urlInput });
  pending.shift()(source('png'));
  await second;
  assert.equal(context.imgData, null);
  assert.equal(elements.get('img-preview-wrap').style.display, 'none');
  assert.equal(urlInput.value, 'https://example.com/aktuell.png');
});
