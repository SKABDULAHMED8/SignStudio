import { test, expect } from '@playwright/test';

test('home presents the two approved SignStudio tools', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /work with your files/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /image background cleaner/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /pdf filler/i })).toBeVisible();
});

test('image background cleaner supports upload, preview and transparent PNG export', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /image background cleaner/i }).click();
  await expect(page.getByRole('heading', { name: /clean an image and export a transparent png/i })).toBeVisible();
  await expect(page.getByLabel(/choose image/i)).toHaveAttribute('accept', /image/);
  await expect(page.getByRole('button', { name: /download transparent png/i })).toBeDisabled();
  await expect(page.getByRole('group', { name: /preview background/i })).toBeVisible();
});

test('PDF filler is available without signature placement or saved profile features', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /pdf filler/i }).click();
  await expect(page.getByRole('heading', { name: /fill and edit pdf documents/i })).toBeVisible();
  await expect(page.getByLabel(/choose pdf/i)).toHaveAttribute('accept', 'application/pdf');
  await expect(page.getByText(/add your signature/i)).toHaveCount(0);
  await expect(page.getByText(/saved details/i)).toHaveCount(0);
});

test('application does not access persistent browser storage or register a service worker', async ({ page }) => {
  await page.addInitScript(() => {
    const audit = { localStorage: [], sessionStorage: [], indexedDB: [], serviceWorkers: [] };
    Object.defineProperty(window, '__signStudioAudit', { value: audit });
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      audit[this === localStorage ? 'localStorage' : 'sessionStorage'].push(String(key));
      return setItem.call(this, key, value);
    };
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, ...args) {
      audit.indexedDB.push(String(name));
      return open.call(this, name, ...args);
    };
    const register = navigator.serviceWorker?.register?.bind(navigator.serviceWorker);
    if (register) navigator.serviceWorker.register = (...args) => {
      audit.serviceWorkers.push(String(args[0]));
      return register(...args);
    };
  });
  await page.goto('./');
  const audit = await page.evaluate(() => window.__signStudioAudit);
  expect(audit.localStorage).toEqual([]);
  expect(audit.sessionStorage).toEqual([]);
  expect(audit.indexedDB).toEqual([]);
  expect(audit.serviceWorkers).toEqual([]);
});
