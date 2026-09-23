import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'app.js'), 'utf8');
const model = source.match(/const APP_RELEASES = \[[\s\S]*?\n\];\nconst APP_VERSION = APP_RELEASES\[0\]\.version;/)?.[0];

test('Versionsmodell enthält gültige Veröffentlichungen und die aktuelle Nummer', () => {
  assert.ok(model, 'Versionsdaten aus app.js extrahierbar');
  const { releases, version } = runInNewContext(`${model}\n({ releases: APP_RELEASES, version: APP_VERSION })`);
  assert.ok(releases.length > 0);
  assert.equal(version, releases[0].version);
  releases.forEach(release => {
    assert.ok(typeof release.version === 'string' && release.version.length > 0);
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Array.isArray(release.changes));
    release.changes.forEach(change => assert.ok(['neu', 'verbessert', 'behoben'].includes(change.kind)));
  });
});

test('sichtbare Version wird ausschließlich zur Laufzeit im Einstellungsmenü gesetzt', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const header = html.match(/<header\b[^>]*class="app-bar"[^>]*>[\s\S]*?<\/header>/)?.[0] || '';
  assert.match(html, /id="menu-root"[\s\S]*?id="version-btn"[^>]*aria-controls="about-dialog"/);
  assert.doesNotMatch(header, /id="version-btn"/);
  assert.match(html, /id="about-dialog"[^>]*aria-labelledby="about-heading"/);
  assert.doesNotMatch(html, /<footer\b[^>]*class="app-footer"/);
  assert.doesNotMatch(html, /<button[^>]*id="version-btn"[^>]*>\s*1\.0/);
});

test('Über-Dialog zentriert sich und verwischt den Backdrop', () => {
  const css = readFileSync(resolve(root, 'styles.css'), 'utf8');
  assert.match(css, /\.about-dialog\s*\{[\s\S]*?margin:\s*auto;/);
  assert.match(css, /\.about-dialog::backdrop\s*\{[\s\S]*?backdrop-filter:\s*blur\(8px\)/);
  assert.match(css, /\.about-dialog::backdrop\s*\{[\s\S]*?-webkit-backdrop-filter:\s*blur\(8px\)/);
});
