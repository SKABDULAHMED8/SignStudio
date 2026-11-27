import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServiceWorkerSource } from '../../src/platform/service-worker.js';

test('service worker precaches static build assets under the GitHub Pages scope', () => {
  const source = buildServiceWorkerSource({ base: '/SignStudio/', files: ['index.html', 'assets/app.js', 'assets/app.css', 'site.webmanifest'] });
  assert.match(source, /\/SignStudio\/assets\/app\.js/);
  assert.match(source, /\/SignStudio\/site\.webmanifest/);
  assert.match(source, /skipWaiting/);
  assert.match(source, /clients\.claim/);
  assert.match(source, /signstudio-shell-/);
});

test('service worker does not cache arbitrary same-origin requests or user files', () => {
  const source = buildServiceWorkerSource({ base: '/SignStudio/', files: ['assets/app.js'] });
  assert.match(source, /const allowed=PRECACHE_URLS\.includes\(url\.href\)/);
  assert.match(source, /if\(!allowed\)return/);
  assert.doesNotMatch(source, /cache\.put\(request/);
});
