import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
test('GitHub Pages web manifest uses scoped paths and required icon sizes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../public/site.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'SignStudio');
  assert.equal(manifest.short_name, 'SignStudio');
  assert.equal(manifest.start_url, '/SignStudio/');
  assert.equal(manifest.scope, '/SignStudio/');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  await access(new URL('../../public/icon-192.png', import.meta.url));
  await access(new URL('../../public/icon-512.png', import.meta.url));
});
