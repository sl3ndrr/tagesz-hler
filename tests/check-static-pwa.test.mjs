import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import './event-write-conflicts.mjs';
import './controller-ui.mjs';
import './event-list-renderer.mjs';
import './calendar-clock-changes.mjs';
import './data-validation.mjs';
import './data-recovery.mjs';
import './image-processing.mjs';
import './installation-storage.mjs';
import './service-worker-cache.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const checker = resolve(projectRoot, 'scripts/check-static-pwa.mjs');

function fixture() {
  const directory = mkdtempSync(resolve(projectRoot, '.test-pwa-check-'));
  for (const file of ['index.html', 'styles.css', 'theme.js', 'app.js', 'manifest.webmanifest', 'sw.js']) {
    cpSync(resolve(projectRoot, file), resolve(directory, file));
  }
  cpSync(resolve(projectRoot, 'icons'), resolve(directory, 'icons'), { recursive: true });
  execFileSync('git', ['init', '--quiet'], { cwd: directory });
  execFileSync('git', ['config', 'user.email', 'tests@example.invalid'], { cwd: directory });
  execFileSync('git', ['config', 'user.name', 'PWA-Prüftest'], { cwd: directory });
  execFileSync('git', ['add', '.'], { cwd: directory });
  execFileSync('git', ['commit', '--quiet', '-m', 'Basis'], { cwd: directory });
  return directory;
}

function run(directory, env = {}) {
  return spawnSync(process.execPath, [checker, directory], {
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

test('akzeptiert eine gültige statische PWA', () => {
  const directory = fixture();
  try {
    const result = run(directory);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('erkennt einen JavaScript-Syntaxfehler', () => {
  const directory = fixture();
  try {
    writeFileSync(resolve(directory, 'theme.js'), 'const = ;\n');
    const result = run(directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JavaScript-Syntaxfehler in theme\.js/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('erkennt ein fehlendes App-Shell-Asset', () => {
  const directory = fixture();
  try {
    rmSync(resolve(directory, 'app.js'));
    const result = run(directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Erforderliche Datei fehlt: app\.js/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('erkennt eine unveränderte CACHE_VERSION nach App-Shell-Änderung', () => {
  const directory = fixture();
  try {
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
    writeFileSync(resolve(directory, 'theme.js'), '/* synthetische Änderung */\n' + readFileSync(resolve(directory, 'theme.js')));
    writeFileSync(resolve(directory, 'sw.js'), readFileSync(resolve(directory, 'sw.js')) + '\n/* ohne Versionswechsel */\n');
    const result = run(directory, { PWA_BASE_SHA: base });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CACHE_VERSION wurde nicht erhöht/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
