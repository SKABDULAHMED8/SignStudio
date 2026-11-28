import { test, expect } from '@playwright/test';

test('production shell and local assets load from the GitHub Pages base path', async ({ page }) => {
  const failed = [];
  page.on('requestfailed', request => {
    if (new URL(request.url()).origin === 'http://127.0.0.1:4173') failed.push(request.url());
  });
  const response = await page.goto('./');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: /work with your files/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /image background cleaner/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /pdf filler/i })).toBeVisible();
  expect(failed).toEqual([]);
  expect(new URL(page.url()).pathname).toBe('/SignStudio/');
});

test('PDF input remains a local file picker', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /pdf filler/i }).click();
  expect(await page.getByLabel(/choose pdf/i).getAttribute('accept')).toBe('application/pdf,.pdf');
});
