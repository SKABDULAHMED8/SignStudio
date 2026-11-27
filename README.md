# SignStudio

SignStudio is a browser-only document workspace with two separate tools:

1. **Signature Photo Cleaner**: removes paper background and uneven lighting from a signature photo, lets you adjust cleanup, and exports a transparent PNG.
2. **PDF Filler**: fills supported interactive PDF fields and adds text, dates, ticks and crosses to PDF pages. It does not create or place handwritten signatures.

**Development URL:** https://skabdulahmed8.github.io/SignStudio/  
**Development branch:** \`debug-package-integration\`  
**Production status:** Not approved for release. The live \`main\` branch remains unchanged until explicit \`Approve-Release\` approval.

## Privacy model

- Selected files are processed locally in the browser.
- SignStudio does not upload documents or generated results to a SignStudio server.
- The app does not create accounts, profiles, a document library, saved signatures, backups, passwords, or document history.
- The app does not use IndexedDB, localStorage, sessionStorage, or a service worker for user data.
- Files and intermediate results exist temporarily in browser memory. Download results before clearing the workspace or closing the tab.
- Clearing the workspace releases app-owned references, canvases, workers and Blob URLs where possible. Browser memory reclamation is controlled by the browser. This is not a guarantee of secure physical memory erasure. Browser downloads and browser-managed caches are outside the app's control.

## Requirements

- Node.js 22 or newer
- npm
- Git

No API keys, backend, account, database or environment variables are required.

## Local development

In PowerShell:

\`\`\`powershell
Set-Location "D:\\SignStudio-GitHub-Integration"
git switch debug-package-integration
git pull --ff-only origin debug-package-integration
npm ci
npm run dev
\`\`\`

Open http://127.0.0.1:5173/SignStudio/ and keep the terminal open.

## Production build preview

\`\`\`powershell
npm run build
npm run preview
\`\`\`

Open http://127.0.0.1:4173/SignStudio/. Preview serves the latest \`dist\` output. Rebuild after source changes.

## Verification

\`\`\`powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
\`\`\`

The CI workflow runs on Windows with Node.js 22. It checks secrets, installs locked dependencies, builds the app, runs unit tests and runs Playwright Chromium tests.

## Project structure

- \`src/main.js\`: application navigation and tool lifecycle
- \`src/signature/processing/\`: signature image cleanup pipeline
- \`src/platform/worker-client.js\`: worker-based image processing
- \`src/pdf/simple-pdf-filler.js\`: PDF field and page-editing workspace
- \`src/pdf/forms.js\`: AcroForm field discovery and value application
- \`src/pdf/pdf-export.js\`: PDF output generation
- \`styles/app.css\`: application styles
- \`tests/unit/\`: unit tests
- \`tests/e2e/\`: browser acceptance tests

## Release guard

Do not merge this branch into \`main\` or deploy it until the user gives the exact approval: \`Approve-Release\`.
