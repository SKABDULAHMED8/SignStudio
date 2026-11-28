import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const exists = async path => {
  try { await access(new URL(path, root)); return true; }
  catch { return false; }
};

test('application entry point does not use persistent browser storage or service workers', async () => {
  const source = await read('src/main.js');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|serviceWorker|caches\./i);
});

test('legacy storage, account, password, backup and signing-service modules are absent', async () => {
  for (const path of [
    'src/library', 'src/library-view', 'src/recovery', 'src/security',
    'src/studio', 'src/core', 'src/platform/service-worker.js',
    'src/platform/storage-estimate.js', 'src/platform/capabilities.js',
    'public/site.webmanifest', 'public/manifest.webmanifest',
    'tests/retired'
  ]) assert.equal(await exists(path), false, path + ' must be removed');
});

test('home page presents the approved tools and no persistent document features', async () => {
  const html = await read('index.html');
  assert.match(html, /Image Background Cleaner/);
  assert.match(html, /PDF Filler/);
  assert.doesNotMatch(html, /My signatures|vault|backup|password lock|saved profile|document archive|signing service/i);
  assert.doesNotMatch(html, /manifest\.webmanifest|service-worker/i);
});

test('runtime source has no persistent storage or remote upload APIs', async () => {
  const forbidden = /\b(localStorage|sessionStorage|indexedDB|navigator\.serviceWorker|caches\.open|fetch\s*\(|XMLHttpRequest|sendBeacon)\b/i;
  const files = [
    'src/main.js', 'src/platform/file-io.js', 'src/platform/worker-client.js',
    'src/pdf/simple-pdf-filler.js', 'src/pdf/forms.js', 'src/pdf/pdf-export.js',
    'src/pdf/pdf-module.js'
  ];
  for (const path of files) assert.doesNotMatch(await read(path), forbidden, path);
});
