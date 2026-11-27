import { test, expect } from '@playwright/test';

// These tests deliberately verify the approved target behavior. Failures are
// diagnostic: they identify legacy persistence/UI that still needs refactoring.

test('production shell and assets load from the GitHub Pages base path', async ({ page }) => {
  const failedLocalRequests = [];
  page.on('requestfailed', request => {
    if (new URL(request.url()).origin === 'http://127.0.0.1:4173') {
      failedLocalRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`);
    }
  });

  const response = await page.goto('./');
  expect(response?.ok(), 'the Pages base path should return HTTP 200').toBeTruthy();
  await expect(page.getByRole('heading', { name: /Make a clear digital signature/i })).toBeVisible();
  await expect(page.locator('.brand-wordmark')).toBeVisible();
  await expect.poll(() => page.locator('.brand-wordmark').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  expect(failedLocalRequests, 'local assets must not fail under /SignStudio/').toEqual([]);
  expect(new URL(page.url()).pathname).toBe('/SignStudio/');
});

test('the app does not write user data to persistent browser storage', async ({ page }) => {
  await page.addInitScript(() => {
    const writes = { localStorage: [], sessionStorage: [], indexedDB: [] };
    Object.defineProperty(window, '__signStudioStorageAudit', { value: writes, configurable: false });

    const localSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === window.localStorage) writes.localStorage.push(String(key));
      if (this === window.sessionStorage) writes.sessionStorage.push(String(key));
      return localSet.call(this, key, value);
    };

    const idbOpen = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, ...args) {
      writes.indexedDB.push(String(name));
      return idbOpen.call(this, name, ...args);
    };
  });

  await page.goto('./');
  await expect(page.getByRole('heading', { name: /Make a clear digital signature/i })).toBeVisible();
  const audit = await page.evaluate(() => window.__signStudioStorageAudit);
  expect(audit.localStorage, 'localStorage writes are not allowed').toEqual([]);
  expect(audit.sessionStorage, 'sessionStorage writes are not allowed').toEqual([]);
  expect(audit.indexedDB, 'IndexedDB must not be opened for user data').toEqual([]);
});

test('the UI does not expose persistent library, profile, password or backup features', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /Make a clear digital signature/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fill a PDF' })).toBeVisible();
  await expect(page.getByRole('button', { name: /My signatures/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Save to my library/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Open settings/i })).toHaveCount(0);
  await expect(page.locator('[data-panel="library"]')).toHaveCount(0);
  await expect(page.locator('[data-panel="recovery"]')).toHaveCount(0);
});

test('the app shell can reload offline after its static assets are cached', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /Make a clear digital signature/i })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 20_000 });
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.some(name => name.startsWith('signstudio-shell-'))).toBeTruthy();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Make a clear digital signature/i })).toBeVisible();
  await context.setOffline(false);
});
