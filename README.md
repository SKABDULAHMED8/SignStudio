# SignStudio

SignStudio is a browser-based utility with two tools:

1. **Image Background Cleaner**: isolate handwriting or ink from plain paper in browser memory and export a transparent PNG. It is not a general-purpose photo cutout tool.
2. **PDF Filler**: fill supported interactive PDF fields and add text, dates, ticks, crosses or a photo to PDF pages.

**Development branch:** `debug-package-integration`  
**Production status:** Not approved for release. The live `main` branch remains unchanged until explicit `Approve-Release` approval.

## Privacy and data lifecycle

- Selected files are processed locally in the browser.
- SignStudio does not upload documents, images or generated results to a SignStudio server.
- The application does not create accounts, profiles, a document library, saved files, saved images, passwords, backups, archives or document history.
- The application does not use IndexedDB, localStorage, sessionStorage, cookies or a service worker.
- The application does not register background sync or cache user files.
- Active files and intermediate results exist in browser memory only while the workspace is open.
- Use **Clear workspace** or close the tab when finished. Clearing releases app-owned references and resources where possible. Browser memory reclamation remains browser-controlled. This is not secure physical memory erasure.
- Browser downloads, browser-managed HTTP cache and operating-system files remain under browser/OS control. The website cannot clear download history or guarantee deletion of downloaded files.

This app does not promise offline reopening. It must download its static app files from the website.

## Requirements

- Node.js 22 or newer
- npm
- Git

No API keys, backend, account, database or environment variables are required.

## Local development

```powershell
Set-Location "D:\SignStudio-GitHub-Integration"
git switch debug-package-integration
git pull --ff-only origin debug-package-integration
npm ci
npm run dev
```

Open http://127.0.0.1:5173/SignStudio/ and keep the terminal open.

## Verification

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Project structure

- `src/main.js`: app navigation and active workspace lifecycle
- `src/signature/processing/`: image cleanup pipeline
- `src/platform/worker-client.js`: temporary worker-based image processing
- `src/platform/file-io.js`: image decode and PNG export
- `src/pdf/simple-pdf-filler.js`: PDF rendering, form fields and basic page edits
- `src/pdf/forms.js`: AcroForm field discovery and value application
- `src/pdf/pdf-export.js`: PDF output generation
- `styles/`: application styles
- `tests/unit/`: image, PDF and privacy boundary tests
- `tests/e2e/`: browser acceptance tests

## Release guard

Do not merge this branch into `main` or deploy it until the project owner gives the exact approval: `Approve-Release`.
