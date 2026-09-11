import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const styles = readFileSync(resolve(root, 'styles.css'), 'utf8');
const app = readFileSync(resolve(root, 'app.js'), 'utf8');
const index = readFileSync(resolve(root, 'index.html'), 'utf8');

function hslToRgb(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] = segment < 1 ? [chroma, x, 0]
    : segment < 2 ? [x, chroma, 0]
      : segment < 3 ? [0, chroma, x]
        : segment < 4 ? [0, x, chroma]
          : segment < 5 ? [x, 0, chroma]
            : [chroma, 0, x];
  const match = l - chroma / 2;
  return [red + match, green + match, blue + match];
}

function luminance(rgb) {
  const linear = channel => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

function contrast(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

test('Akzentrollen erreichen auf ihren verwendeten hellen und dunklen Flächen mindestens 4,5:1', () => {
  const accents = [[257, 38], [211, 58], [151, 46], [28, 70]];
  accents.forEach(([hue, saturation]) => {
    const lightPrimary = hslToRgb(hue, saturation, 32);
    const darkPrimary = hslToRgb(hue, 72, 82);
    const darkOnPrimary = hslToRgb(hue, 62, 22);
    assert.ok(contrast(lightPrimary, [1, 1, 1]) >= 4.5, `heller Akzent ${hue} auf Weiß`);
    assert.ok(contrast(lightPrimary, hslToRgb(0, 0, 92.5)) >= 4.5, `heller Akzent ${hue} auf Surface`);
    assert.ok(contrast(darkPrimary, darkOnPrimary) >= 4.5, `dunkler Akzent ${hue} auf on-primary`);
    assert.ok(contrast(darkPrimary, hslToRgb(0, 0, 8.2)) >= 4.5, `dunkler Akzent ${hue} auf Surface`);
  });
});

test('Rechnerstatus bleibt außerhalb der visuellen Flip-Ziffern bestehen', () => {
  assert.match(index, /id="calc-result-status" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(app, /const calcResultStatus = document\.getElementById\('calc-result-status'\)/);
  assert.match(app, /const summary = isCalculatorOutput \? calcResultStatus : document\.createElement\('span'\)/);
  assert.match(app, /calcResultStatus\.textContent = message/);
});

test('beide Flip-Varianten, Textumbrüche und reduzierte Bewegung teilen die zugänglichen Regeln', () => {
  assert.match(styles, /:is\(\.flip-digit-wrap, \.detail-flip-digit-wrap\)\.flipping/);
  assert.match(styles, /--flip-animation-duration: 0ms/);
  assert.match(styles, /#detail-desc \{ white-space: pre-wrap; \}/);
  assert.match(styles, /overflow-wrap: anywhere/);
});
