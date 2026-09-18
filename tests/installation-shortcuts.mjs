import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const projectRoot = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'manifest.webmanifest'), 'utf8'));
const app = readFileSync(resolve(projectRoot, 'app.js'), 'utf8');
const serviceWorker = readFileSync(resolve(projectRoot, 'sw.js'), 'utf8');

test('beschreibt echte Installationsansicht und bekannte Direktstarts', () => {
  const screenshot = manifest.screenshots?.[0];
  assert.deepEqual(screenshot, {
    src: './screenshots/tageszaehler-beispiel-1363x936.png',
    sizes: '1363x936',
    type: 'image/png',
    form_factor: 'wide',
    label: 'Tageszähler mit synthetischem Beispielereignis'
  });
  assert.equal(existsSync(resolve(projectRoot, screenshot.src.replace('./', ''))), true);
  assert.match(serviceWorker, /'\.\/screenshots\/tageszaehler-beispiel-1363x936\.png'/);

  assert.deepEqual(manifest.shortcuts, [
    {
      name: 'Neues Ereignis',
      short_name: 'Neu',
      description: 'Öffnet direkt den Editor für ein neues Ereignis.',
      url: './?action=new-event'
    },
    {
      name: 'Rechner',
      short_name: 'Rechner',
      description: 'Öffnet den Datumsrechner.',
      url: './?action=calculator'
    }
  ]);

  assert.match(app, /function applyDirectStart\(\)/);
  assert.match(app, /action === 'new-event'/);
  assert.match(app, /action === 'calculator'/);
  assert.match(app, /applyDirectStart\(\);/);
});
