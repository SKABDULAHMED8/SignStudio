# SignStudio development guide

## Product scope

SignStudio is one website with separate tool workspaces. It currently provides:

- **Signature Photo Cleaner**: automatic paper-background and lighting cleanup, manual adjustment, preview background selection, and transparent PNG export.
- **PDF Filler**: supported interactive form fields plus basic page editing for text, dates, ticks, crosses and photos where supported by the PDF export layer.

The PDF tool must not expose handwritten-signature creation, saved-signature selection or signature placement. Keep photo cleanup separate from PDF filling. Future converters can be added as independent tools without changing this product model.

## Privacy and lifecycle

The intended workflow is:

\`Upload → Configure → Process → Preview → Download → Clear workspace\`

Selected files are processed locally in browser memory. The app must not upload files or use persistent user-data storage. Do not add accounts, IndexedDB, Web Storage, document history, saved profiles, saved signatures, backups, passwords, recovery flows or service-worker storage.

Clear workspace code should release app-owned Blob URLs, workers, canvases, ImageBitmaps and object references where possible. It cannot promise physical memory zeroization or erase browser-managed downloads and caches.

## Environment

- Node.js 22 or newer
- npm
- Git
- Vanilla JavaScript ES modules
- Vite 7
- PDF.js for rendering
- pdf-lib for PDF modification
- Playwright with Chromium for end-to-end tests

No backend, database, API key or \`.env\` file is required.

## Start locally

\`\`\`powershell
Set-Location "D:\\SignStudio-GitHub-Integration"
git switch debug-package-integration
git pull --ff-only origin debug-package-integration
npm ci
npm run dev
\`\`\`

Open http://127.0.0.1:5173/SignStudio/.

## Build and preview

\`\`\`powershell
npm run build
npm run preview
\`\`\`

Open http://127.0.0.1:4173/SignStudio/. Rebuild after every source change before checking the production preview.

## Test

\`\`\`powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
\`\`\`

Run the focused test first when changing behaviour. Then run the full unit suite, production build and browser tests. CI runs on Windows with Node 22.

## Main files

| File | Responsibility |
|---|---|
| \`index.html\` | App shell and tool workspaces |
| \`src/main.js\` | Navigation, image processing lifecycle and PDF lifecycle |
| \`src/platform/worker-client.js\` | Image worker communication |
| \`src/signature/processing/pipeline.js\` | Paper detection, lighting correction, ink mask, alpha and crop |
| \`src/pdf/simple-pdf-filler.js\` | PDF rendering, form controls and page placements |
| \`src/pdf/forms.js\` | Interactive PDF field support |
| \`src/pdf/pdf-export.js\` | Final PDF generation |
| \`vite.config.js\` | GitHub Pages base path and production build |
| \`tests/e2e/product-scope.spec.js\` | Product-scope acceptance tests |
| \`tests/e2e/signstudio-debug.spec.js\` | Base-path, privacy and PDF scope checks |

## Browser verification

Use Chrome or Edge DevTools:

1. Check Console for uncaught errors.
2. Check Network for failed local assets and unexpected third-party requests.
3. Test mobile widths around 360–390 px, tablet at 768 px and desktop at 1440 px.
4. Test a clean, high-contrast signature photo and a difficult photo with uneven lighting.
5. Verify the PNG has transparent pixels and inspect fine pen edges on checker, white and dark preview backgrounds.
6. Test a PDF with AcroForm fields and a PDF with no interactive fields.
7. Verify final PDF preview before download.
8. Clear each workspace and confirm the app no longer holds active object URLs, workers or document references.

## Release control

All implementation work stays on \`debug-package-integration\`. Do not merge into \`main\` or deploy without the exact user approval \`Approve-Release\`.
