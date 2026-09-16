import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const projectRoot = resolve(import.meta.dirname, '..');
const index = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');
const styles = readFileSync(resolve(projectRoot, 'styles.css'), 'utf8');
const serviceWorker = readFileSync(resolve(projectRoot, 'sw.js'), 'utf8');

test('stellt Roboto Flex ohne Google-Fonts-Anfrage lokal und precached bereit', () => {
  assert.doesNotMatch(index, /https:\/\/fonts\.(?:googleapis|gstatic)\.com/);
  assert.match(index, /style-src 'self' 'unsafe-inline'; style-src-elem 'self';/);
  assert.match(index, /font-src 'self' data:/);

  for (const file of [
    'roboto-flex-latin-ext-full-normal.woff2',
    'roboto-flex-latin-full-normal.woff2'
  ]) {
    const path = resolve(projectRoot, 'fonts', file);
    assert.equal(existsSync(path), true, `Lokale Schriftdatei fehlt: ${file}`);
    assert.ok(statSync(path).size > 0, `Lokale Schriftdatei ist leer: ${file}`);
    assert.match(styles, new RegExp(`url\\('./fonts/${file.replaceAll('.', '\\.')}\\')`));
    assert.match(serviceWorker, new RegExp(`'./fonts/${file.replaceAll('.', '\\.')}'`));
  }

  assert.match(styles, /font-family: 'Roboto Flex';/);
  assert.match(styles, /font-weight: 300 800;/);
  assert.match(styles, /font-stretch: 75% 125%;/);
});
