import { deflateSync } from 'node:zlib';
import { test, expect } from '@playwright/test';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function createPngFixture() {
  const width = 64;
  const height = 64;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    rows[row] = 0;
    for (let x = 0; x < width; x++) {
      const pixel = row + 1 + x * 4;
      const ink = y >= 29 && y <= 33 && x >= 12 && x <= 51;
      rows[pixel] = ink ? 20 : 255;
      rows[pixel + 1] = ink ? 55 : 255;
      rows[pixel + 2] = ink ? 120 : 255;
      rows[pixel + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

test('home presents only the approved image and PDF tools', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /work with your files/i })).toBeVisible();
  await expect(page.locator('[data-open="cleaner"]')).toBeVisible();
  await expect(page.locator('[data-open="pdf"]')).toBeVisible();
  await expect(page.getByText(/my signatures|saved details|backup password|app password|document archive/i)).toHaveCount(0);
});

test('image cleaner accepts an image and exposes a transparent PNG export', async ({ page }) => {
  await page.goto('./');
  await page.locator('[data-open="cleaner"]').click();
  await expect(page.getByRole('heading', { name: /clean an image and export a transparent png/i })).toBeVisible();
  const imagePicker = page.getByLabel(/choose image/i);
  await expect(imagePicker).toHaveAttribute('accept', /image/);
  await imagePicker.setInputFiles({ name: 'test-image.png', mimeType: 'image/png', buffer: createPngFixture() });
  await expect(page.locator('#image-work')).toBeVisible();
  await expect(page.getByRole('group', { name: /preview background/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /download transparent png/i })).toBeEnabled();
});

test('PDF filler supports form fields and basic page edits without signature placement', async ({ page }) => {
  await page.goto('./');
  await page.locator('[data-open="pdf"]').click();
  await expect(page.getByRole('heading', { name: /fill and edit pdf documents/i })).toBeVisible();
  await expect(page.getByLabel(/choose pdf/i)).toHaveAttribute('accept', /application\/pdf/);
  await expect(page.getByRole('button', { name: /signature/i })).toHaveCount(0);
  await expect(page.getByLabel(/signature/i)).toHaveCount(0);
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
