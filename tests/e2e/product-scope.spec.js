import { test, expect } from '@playwright/test';

test('home presents only the approved image and PDF tools', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /work with your files/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /image background cleaner/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /pdf filler/i })).toBeVisible();
  await expect(page.getByText(/my signatures|saved details|backup password|app password|document archive/i)).toHaveCount(0);
});

test('image cleaner accepts an image and exposes a transparent PNG export', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /image background cleaner/i }).click();
  await expect(page.getByRole('heading', { name: /clean an image and export a transparent png/i })).toBeVisible();
  await expect(page.getByLabel(/choose image/i)).toHaveAttribute('accept', /image/);
  await expect(page.getByRole('button', { name: /download transparent png/i })).toBeDisabled();
  await expect(page.getByRole('group', { name: /preview background/i })).toBeVisible();
});

test('PDF filler supports form fields and basic page edits without signature placement', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /pdf filler/i }).click();
  await expect(page.getByRole('heading', { name: /fill and edit pdf documents/i })).toBeVisible();
  await expect(page.getByLabel(/choose pdf/i)).toHaveAttribute('accept', 'application/pdf');
  await expect(page.getByText(/add your signature|saved signature|signature library/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /place text on page/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /add photo to pdf/i })).toBeVisible();
});

test('app does not access persistent storage or register a service worker', async ({ page }) => {
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
    if (navigator.serviceWorker?.register) {
      navigator.serviceWorker.register = (...args) => {
        audit.serviceWorkers.push(String(args[0]));
        return Promise.reject(new Error('Service workers are disabled in this app.'));
      };
    }
  });
  await page.goto('./');
  const audit = await page.evaluate(() => window.__signStudioAudit);
  expect(audit.localStorage).toEqual([]);
  expect(audit.sessionStorage).toEqual([]);
  expect(audit.indexedDB).toEqual([]);
  expect(audit.serviceWorkers).toEqual([]);
});
