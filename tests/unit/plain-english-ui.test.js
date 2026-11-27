import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const pdf = readFileSync(new URL('../../src/pdf/document-view.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const icons = readFileSync(new URL('../../public/icons/ui.svg', import.meta.url), 'utf8');

test('main screen does not show technical security terms to users', () => {
  assert.doesNotMatch(html, /encrypted|encryption|AcroForm/i);
  assert.doesNotMatch(main, /toast\(['"`][^'"`]*(?:encrypted|encryption|passphrase|device-key)[^'"`]*['"`]/i);
});

test('PDF tools use short names and real icons', () => {
  for (const label of ['Add a tick', 'Add a cross', 'Add a date', 'Text in boxes', 'Find boxes']) {
    assert.ok(pdf.includes(label), `Missing plain-English tool name: ${label}`);
  }
  for (const icon of ['check', 'x-square', 'calendar', 'type', 'scan-search', 'download']) {
    assert.ok(pdf.includes(`'${icon}'`), `Missing icon: ${icon}`);
    assert.ok(icons.includes(`<symbol id="${icon}"`), `Icon drawing is missing: ${icon}`);
  }
});

test('privacy and backup labels explain the action in simple English', () => {
  assert.match(html, /Your signatures stay private on this device/);
  assert.match(html, /Download a backup/);
  assert.match(html, /Open a backup/);
  assert.match(main, /Your signatures are kept private in this browser/);
});
