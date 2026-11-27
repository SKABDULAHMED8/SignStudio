# PDF Form Filler Implementation Changelog

Date: 2026-11-25

## Added
- Typed PDF overlay placement model and bounds validation.
- Character-grid distribution with explicit overflow and space handling.
- Bounded undo/redo history model and PDF workspace undo/redo controls.
- Local geometric printed-rectangle detection with a dedicated Web Worker.
- PDF tools for tick, cross, date, character-grid, photo and signature placement.
- Export support for tick/cross vector marks, dates, character-grid text and photos.
- Optional encrypted personal profiles (up to five), with explicit profile-to-AcroForm text-field application.
- Additive IndexedDB v2 migration for a `personal-profiles` store.
- Backup-restore rekeying for profiles, with rollback protection.
- Responsive PDF tool dock and personal-profile styles.
- Unit tests for placement validation, character distribution, detection, history, encrypted profiles, profile mapping and profile key rotation.
- Playwright coverage additions for new PDF tools, photo placement and undo/redo.

## Compatibility
- Existing signature record schema is unchanged.
- Existing encrypted signature backup format version 1 is unchanged.
- Personal profiles are not included in signature backups.
- No new npm dependencies.
- No network upload of PDFs or profile values.

## Limitations requiring further verification
- Detection is geometric and does not identify printed labels or perform OCR.
- The detector is optimized for axis-aligned rectangles. Skewed/faint/broken boxes can require manual placement.
- Detected rectangles are not yet a full semantic field map. Character-grid placement uses the selected detected rectangle or a manually chosen region.
- Photo placement supports local image placement and resizing; dedicated crop handles are not implemented.
- Font embedding for Hindi/Indic/RTL scripts has not been added or verified.
- PDF page rotation/crop-box coordinate behavior needs dedicated fixture tests.
- Build and Playwright browser tests could not be run in this environment because the extracted dependency tree is incomplete and npm package installation timed out. Run `npm ci`, `npm run test:all` and `npm run build` on the Windows development machine before treating this as release-ready.


## Windows verification commands

Run from the extracted `SignStudio` project folder in PowerShell:

```powershell
npm ci
npm test
npx playwright install chromium
npm run test:e2e
$env:GITHUB_PAGES = 'true'
npm run build
Remove-Item Env:GITHUB_PAGES
```

Do not publish the `dist` folder or configure GitHub Pages until the owner replies with `Approve-Release`.


## Plain-English UI update (2026-11-25)

- Replaced technical words in the app screens with short everyday English.
- The app now says "app password" and "backup password" instead of "passphrase".
- The app explains that saved signatures and details stay private on this device. It does not ask users to understand how encryption works.
- Renamed PDF tools to direct actions: Add a tick, Add a cross, Add a date, Add words, Text in boxes, Find boxes and Add a photo.
- Added real SVG icons to the PDF tools, saved-details form and edit controls.
- Added simple step-by-step user guide: `QUICK-START-GUIDE.md`.
- Added tests to check user-facing wording and the presence of the matching icon drawings.
