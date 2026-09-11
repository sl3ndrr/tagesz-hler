#!/usr/bin/env node
/**
 * Prüft die statische PWA ohne Build- oder Paketabhängigkeiten.
 *
 * Mit PWA_BASE_SHA wird zusätzlich geprüft, ob bei Änderungen an einer
 * gecachten App-Shell-Datei die CACHE_VERSION in sw.js erhöht wurde.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = resolve(process.cwd(), process.argv[2] || '.');
const requiredFiles = ['index.html', 'styles.css', 'theme.js', 'app.js', 'manifest.webmanifest', 'sw.js'];
const javascriptFiles = ['theme.js', 'app.js', 'sw.js'];
const errors = [];

function readText(path) {
  const file = resolve(root, path);
  if (!existsSync(file)) {
    errors.push(`Erforderliche Datei fehlt: ${path}`);
    return '';
  }
  return readFileSync(file, 'utf8');
}

function localPath(value) {
  if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return null;
  return value.split(/[?#]/, 1)[0].replace(/^\.\//, '');
}

function requireLocalFile(path, source) {
  const local = localPath(path);
  if (!local) return;
  if (!existsSync(resolve(root, local))) {
    errors.push(`Referenzierte lokale Datei fehlt: ${local} (aus ${source})`);
  }
}

function git(command) {
  try {
    return execFileSync('git', command, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

for (const file of requiredFiles) readText(file);

for (const file of javascriptFiles) {
  try {
    execFileSync(process.execPath, ['--check', resolve(root, file)], { stdio: 'pipe' });
  } catch (error) {
    const detail = String(error.stderr || error.message).trim();
    errors.push(`JavaScript-Syntaxfehler in ${file}: ${detail}`);
  }
}

const index = readText('index.html');
const manifestText = readText('manifest.webmanifest');
const serviceWorker = readText('sw.js');

let manifest;
try {
  manifest = JSON.parse(manifestText);
} catch (error) {
  errors.push(`Manifest ist nicht parsebar: ${error.message}`);
}

if (manifest) {
  for (const key of ['name', 'short_name', 'start_url', 'scope']) {
    if (typeof manifest[key] !== 'string' || manifest[key].trim() === '') {
      errors.push(`Manifestfeld fehlt oder ist ungültig: ${key}`);
    }
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    errors.push('Manifest enthält keine Icons.');
  } else {
    manifest.icons.forEach((icon, index) => {
      if (!icon || typeof icon.src !== 'string') {
        errors.push(`Manifest-Icon ${index + 1} besitzt kein src.`);
      } else {
        requireLocalFile(icon.src, 'manifest.webmanifest');
      }
    });
  }
}

for (const match of index.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
  requireLocalFile(match[1], 'index.html');
}

if (/<script\b(?![^>]*\bsrc\s*=)[^>]*>/i.test(index)) {
  errors.push('index.html enthält ein Inline-Script.');
}
if (/\son[a-z][a-z0-9_-]*\s*=/i.test(index)) {
  errors.push('index.html enthält einen Inline-Eventhandler.');
}
if (/\b(?:href|src)\s*=\s*["']\s*javascript:/i.test(index)) {
  errors.push('index.html enthält eine javascript:-URL.');
}
if (!/script-src-attr\s+'none'/.test(index)) {
  errors.push("CSP sperrt Script-Attribute nicht mit script-src-attr 'none'.");
}
if (!/require-trusted-types-for\s+'script'/.test(index)) {
  errors.push("CSP erzwingt Trusted Types für Script-Sinks nicht.");
}
if (!/trusted-types\s+tageszaehler-sw(?:\s|")/.test(index)) {
  errors.push('CSP erlaubt nicht ausschließlich die Policy tageszaehler-sw.');
}

const cacheVersion = serviceWorker.match(/const\s+CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!cacheVersion) errors.push('sw.js definiert keine CACHE_VERSION.');

const shellMatch = serviceWorker.match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\];/);
const appShell = shellMatch
  ? [...shellMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1])
  : [];
if (!shellMatch) {
  errors.push('sw.js definiert keine APP_SHELL.');
} else {
  appShell.forEach(path => {
    if (path !== './') requireLocalFile(path, 'sw.js APP_SHELL');
  });
}

const baseSha = process.env.PWA_BASE_SHA;
if (baseSha && !/^0+$/.test(baseSha)) {
  const changedOutput = git(['diff', '--name-only', baseSha]);
  if (changedOutput === null) {
    errors.push(`Vergleichsstand kann nicht gelesen werden: ${baseSha}`);
  } else {
    const changed = changedOutput.split('\n').filter(Boolean);
    const cachedFiles = new Set(appShell.map(path => localPath(path)).filter(Boolean));
    if (changed.some(file => cachedFiles.has(file))) {
      if (!changed.includes('sw.js')) {
        errors.push('Eine gecachte App-Shell-Datei wurde geändert, aber sw.js nicht.');
      } else {
        const baseServiceWorker = git(['show', `${baseSha}:sw.js`]);
        const baseVersion = baseServiceWorker?.match(/const\s+CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
        if (baseVersion && cacheVersion && baseVersion[1] === cacheVersion[1]) {
          errors.push('Eine gecachte App-Shell-Datei wurde geändert, aber CACHE_VERSION wurde nicht erhöht.');
        }
      }
    }
  }
} else {
  console.log('CACHE_VERSION-Vergleich übersprungen: kein sinnvoller Vergleichsstand (Initiallauf).');
}

if (errors.length > 0) {
  console.error('Statische PWA-Prüfung fehlgeschlagen:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Statische PWA-Prüfung erfolgreich (${relative(process.cwd(), root) || '.'}).`);
}
