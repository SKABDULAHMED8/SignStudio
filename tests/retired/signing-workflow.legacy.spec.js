import { test, expect } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function createSamplePdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('SignStudio browser test document', { x: 48, y: 790, size: 16, font });
  const form = pdf.getForm();
  const name = form.createTextField('FullName');
  name.addToPage(page, { x: 48, y: 700, width: 240, height: 28, font });
  const agree = form.createCheckBox('Agree');
  agree.addToPage(page, { x: 48, y: 650, width: 18, height: 18 });
  return Buffer.from(await pdf.save());
}

async function createSavedSignature(page, name = 'Browser QA Signature') {
  await page.getByRole('tab', { name: 'Draw signature' }).click();
  const canvas = page.locator('#drawing-canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + 65, bounds.y + 100);
  await page.mouse.down();
  for (const [x, y] of [[105, 88], [145, 116], [185, 96], [225, 108], [265, 90]]) await page.mouse.move(bounds.x + x, bounds.y + y, { steps: 3 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Remove background' }).click();
  await expect(page.locator('#export-button')).toBeEnabled();
  await page.getByRole('button', { name: 'Save to my library' }).click();
  await page.locator('#dialog-content input').fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

test('sequential prompts keep each native dialog visible until its own action completes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.locator('#app-dialog')).toBeVisible();
  await page.locator('#dialog-content input').fill('dialog lifecycle passphrase 123');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#app-dialog')).toBeVisible();
  await expect(page.locator('#dialog-content input')).toBeVisible();
  await page.locator('#dialog-content input').fill('dialog lifecycle passphrase 123');
  await page.getByRole('button', { name: 'Enable lock' }).click();
  await expect(page.locator('#app-dialog')).toBeHidden();
});

test('studio creates, saves, trashes and restores a signature', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Create a clean signature' })).toBeVisible();
  await createSavedSignature(page);
  await page.getByRole('button', { name: 'Save to my library' }).click();
  await page.getByRole('button', { name: 'Replace existing' }).click();
  await page.locator('#dialog-content input').fill('Browser QA Signature');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await expect(page.getByText('Browser QA Signature', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Version history' }).click();
  await page.getByRole('button', { name: /Restore “Browser QA Signature”/ }).click();
  await expect(page.getByText('Browser QA Signature', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Move to Trash' }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('Browser QA Signature', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await expect(page.getByText('Browser QA Signature', { exact: true })).toBeVisible();
});

test('PDF workspace fills AcroForm fields, places a saved signature and exports a flattened PDF', async ({ page }) => {
  await page.goto('/');
  await createSavedSignature(page, 'PDF QA Signature');
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await page.locator('.personal-profile-section summary').click();
  await page.locator('#profile-name').fill('QA Personal Profile');
  await page.locator('#profile-full-name').fill('Ada Lovelace');
  await page.locator('#profile-mobile').fill('9876543210');
  await page.locator('#profile-save').click();
  await expect(page.locator('#profile-select option')).toHaveCount(1);
  await page.getByRole('button', { name: 'PDF Workspace' }).click();
  const pdf = await createSamplePdf();
  await page.locator('#pdf-picker').setInputFiles({ name: 'sample-form.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.locator('#pdf-workspace')).toBeVisible();
  await page.locator('#pdf-detect-boxes').click();
  await expect(page.locator('#toast-region')).toContainText(/Found|No clear printed boxes/);
  await expect(page.getByLabel('FullName')).toBeVisible();
  await page.locator('#pdf-profile-select').selectOption({ label: 'QA Personal Profile' });
  await page.getByRole('button', { name: 'Add saved details to matching boxes' }).click();
  await expect(page.getByLabel('FullName')).toHaveValue('Ada Lovelace');
  await page.getByLabel('Agree').check();
  await page.getByLabel('Choose a saved signature').selectOption({ label: 'PDF QA Signature' });
  await page.waitForFunction(() => document.querySelector('#pdf-overlay')?.dataset.signatureReady === 'true');
  const overlay = page.locator('#pdf-overlay');
  const bounds = await overlay.boundingBox();
  await overlay.click({ position: { x: Math.min(300, bounds.width - 40), y: Math.min(520, bounds.height - 40) } });
  await page.getByRole('button', { name: 'Add a tick' }).click();
  await overlay.click({ position: { x: 100, y: 150 } });
  await expect(page.locator('#pdf-undo')).toBeEnabled();
  await page.locator('#pdf-undo').click();
  await page.locator('#pdf-redo').click();
  await page.getByRole('button', { name: 'Add a cross' }).click();
  await overlay.click({ position: { x: 135, y: 150 } });
  await page.locator('#pdf-date-value').fill('2026-11-25');
  await page.getByRole('button', { name: 'Add a date' }).click();
  await overlay.click({ position: { x: 210, y: 150 } });
  await page.locator('#pdf-grid-value').fill('AB123');
  await page.getByRole('button', { name: 'Text in boxes' }).click();
  await overlay.click({ position: { x: 300, y: 150 } });
  await page.locator('#pdf-photo-picker').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64')
  });
  await expect(page.locator('#toast-region')).toContainText('Photo ready');
  await overlay.click({ position: { x: 360, y: 200 } });
  const editableDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export completed PDF' }).click();
  const editableDownload = await editableDownloadPromise;
  const editableBytes = await readFile(await editableDownload.path());
  const editablePdf = await PDFDocument.load(editableBytes);
  expect(editablePdf.getForm().getTextField('FullName').getText()).toBe('Ada Lovelace');
  expect(editablePdf.getForm().getCheckBox('Agree').isChecked()).toBe(true);
  expect(editableBytes.byteLength).toBeGreaterThan(pdf.byteLength);
  await page.locator('#pdf-flatten').check();
  const flattenedDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export completed PDF' }).click();
  const flattenedDownload = await flattenedDownloadPromise;
  const flattenedBytes = await readFile(await flattenedDownload.path());
  const flattenedPdf = await PDFDocument.load(flattenedBytes);
  expect(flattenedPdf.getPageCount()).toBe(1);
  expect(flattenedPdf.getForm().getFields()).toHaveLength(0);
});

test('service worker installs the complete app shell and reloads offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Create a clean signature' })).toBeVisible();
  await page.waitForFunction(() => 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.some(name => name.startsWith('signstudio-shell-'))).toBeTruthy();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Create a clean signature' })).toBeVisible();
  await context.setOffline(false);
});


test('startup passphrase lock rejects a wrong phrase and accepts the correct phrase', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.locator('#dialog-content input').fill('browser qa passphrase 123');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('#dialog-content input').fill('browser qa passphrase 123');
  await page.getByRole('button', { name: 'Enable lock' }).click();
  await expect(page.locator('#toast-region')).toContainText(
    'Passphrase lock enabled. You will need it next time you open SignStudio.'
  );
  await page.reload();
  await page.locator('#dialog-content input').waitFor();
  await page.locator('#dialog-content input').fill('wrong passphrase');
  await page.getByRole('button', { name: 'Unlock library' }).click();
  await page.getByRole('button', { name: 'Try again' }).waitFor();
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.locator('#dialog-content input').fill('browser qa passphrase 123');
  await page.getByRole('button', { name: 'Unlock library' }).click();
  await expect(page.locator('[data-panel="recovery"]')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Create a clean signature' })).toBeVisible();
});

test('encrypted backup restores a signature into a separate browser profile', async ({ page, browser }) => {
  await page.goto('/');
  await createSavedSignature(page, 'Backup QA Signature');
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await page.getByRole('button', { name: 'Export encrypted backup' }).click();
  await page.locator('#dialog-content input').fill('backup qa passphrase 123');
  await page.getByRole('button', { name: 'Create encrypted backup' }).click();
  await page.locator('#dialog-content input').fill('backup qa passphrase 123');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Confirm' }).click();
  const download = await downloadPromise;
  const backupBytes = await readFile(await download.path());
  const restoreContext = await browser.newContext();
  const restorePage = await restoreContext.newPage();
  await restorePage.goto('/');
  await restorePage.getByRole('button', { name: 'My Library', exact: true }).click();
  await restorePage.getByRole('button', { name: 'Restore backup' }).click();
  await restorePage.locator('#backup-picker').setInputFiles({ name: 'signstudio-backup.ssbackup', mimeType: 'application/octet-stream', buffer: backupBytes });
  await restorePage.locator('#dialog-content input').fill('backup qa passphrase 123');
  await restorePage.getByRole('button', { name: 'Verify backup' }).click();
  await expect(restorePage.getByText('Backup QA Signature')).toBeVisible();
  await restoreContext.close();
});

test('locked library can be recovered from an encrypted backup when its passphrase is forgotten', async ({ page, browser }) => {
  await page.goto('/');
  await createSavedSignature(page, 'Lock Recovery Signature');
  await page.getByRole('button', { name: 'My Library', exact: true }).click();
  await page.getByRole('button', { name: 'Export encrypted backup' }).click();
  await page.locator('#dialog-content input').fill('lock recovery backup passphrase');
  await page.getByRole('button', { name: 'Create encrypted backup' }).click();
  await page.locator('#dialog-content input').fill('lock recovery backup passphrase');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Confirm' }).click();
  const download = await downloadPromise;
  const backupBytes = await readFile(await download.path());

  const recoveryContext = await browser.newContext();
  const recoveryPage = await recoveryContext.newPage();
  await recoveryPage.goto('/');
  await recoveryPage.getByRole('button', { name: 'Open settings' }).click();
  await recoveryPage.locator('#dialog-content input').fill('forgotten local lock phrase');
  await recoveryPage.getByRole('button', { name: 'Continue' }).click();
  await recoveryPage.locator('#dialog-content input').fill('forgotten local lock phrase');
  await recoveryPage.getByRole('button', { name: 'Enable lock' }).click();
  await expect(recoveryPage.locator('#toast-region')).toContainText(
    'Passphrase lock enabled. You will need it next time you open SignStudio.'
  );
  await recoveryPage.reload();
  await recoveryPage.locator('#dialog-content input').fill('not the correct phrase');
  await recoveryPage.getByRole('button', { name: 'Unlock library' }).click();
  await recoveryPage.getByRole('button', { name: 'Restore encrypted backup' }).waitFor();
  const chooserPromise = recoveryPage.waitForEvent('filechooser');
  await recoveryPage.getByRole('button', { name: 'Restore encrypted backup' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'recovery.ssbackup', mimeType: 'application/octet-stream', buffer: backupBytes });
  await recoveryPage.locator('#dialog-content input').fill('lock recovery backup passphrase');
  recoveryPage.once('dialog', dialog => dialog.accept());
  await recoveryPage.getByRole('button', { name: 'Verify backup' }).click();
  await recoveryPage.getByRole('button', { name: 'Open SignStudio' }).waitFor();
  await recoveryPage.getByRole('button', { name: 'Open SignStudio' }).click();
  await recoveryPage.getByRole('button', { name: 'My Library', exact: true }).click();
  await expect(recoveryPage.getByText('Lock Recovery Signature')).toBeVisible();
  await recoveryContext.close();
});

test('layout has no horizontal overflow at phone, tablet and desktop widths', async ({ page }) => {
  await page.goto('/');
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Create a clean signature' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }
});


test('production shell loads its stylesheet, brand artwork and responsive layout', async ({ page }) => {
  const failedLocalAssets = [];
  page.on('requestfailed', request => {
    if (new URL(request.url()).origin === 'http://127.0.0.1:4173') {
      failedLocalAssets.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto('/');
  await expect(page.locator('.brand-wordmark')).toBeVisible();
  await expect.poll(() => page.locator('.brand-wordmark').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);

  const visualState = await page.evaluate(() => ({
    bodyFont: getComputedStyle(document.body).fontFamily,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    dropzoneBorder: getComputedStyle(document.querySelector('#dropzone')).borderStyle,
    dropzoneHeight: document.querySelector('#dropzone').getBoundingClientRect().height,
    stylesheetCount: [...document.styleSheets].filter(sheet => {
      try { return [...sheet.cssRules].length > 0; } catch { return false; }
    }).length
  }));

  expect(visualState.bodyFont).toMatch(/system-ui|Segoe UI|Inter/i);
  expect(visualState.dropzoneBorder).toBe('dashed');
  expect(visualState.dropzoneHeight).toBeGreaterThanOrEqual(220);
  expect(visualState.stylesheetCount).toBeGreaterThan(0);
  expect(failedLocalAssets).toEqual([]);

  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `test-results/signstudio-${width}px.png`, fullPage: true });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
  }
});


test('PDF workspace places and exports text on a non-fillable printed form', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'PDF Workspace' }).click();
  const pdf = await PDFDocument.create();
  const pdfPage = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdfPage.drawText('BANK ACCOUNT HOLDER', { x: 48, y: 760, size: 14, font });
  pdfPage.drawRectangle({ x: 48, y: 710, width: 280, height: 28, borderWidth: 1 });
  const bytes = Buffer.from(await pdf.save());
  await page.locator('#pdf-picker').setInputFiles({ name: 'printed-bank-form.pdf', mimeType: 'application/pdf', buffer: bytes });
  await expect(page.locator('#pdf-workspace')).toBeVisible();
  await expect(page.getByText(/No interactive fields were detected/)).toBeVisible();
  await page.getByLabel('Text to place on PDF').fill('Abdul Ahmed');
  await page.getByRole('button', { name: 'Place text on PDF' }).click();
  const overlay = page.locator('#pdf-overlay');
  const bounds = await overlay.boundingBox();
  await overlay.click({ position: { x: Math.min(70, bounds.width - 20), y: Math.min(140, bounds.height - 20) } });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export completed PDF' }).click();
  const download = await downloadPromise;
  const exportedBytes = await readFile(await download.path());
  const parsed = await pdfjs.getDocument({ data: new Uint8Array(exportedBytes) }).promise;
  const content = await (await parsed.getPage(1)).getTextContent();
  expect(content.items.map(item => item.str).join(' ')).toContain('Abdul Ahmed');
  await parsed.destroy();
});
