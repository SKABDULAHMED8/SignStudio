# SignStudio architecture

## Product scope

SignStudio provides three browser-only capabilities:

1. Image background cleanup and transparent PNG export.
2. PDF form filling and basic page editing.
3. Handwritten signature capture and placement on PDF pages.

The app creates handwritten signature images in a temporary canvas and places them on PDF pages. It does not persist signatures, apply cryptographic digital certificates or verify signer identity. It does not provide accounts, profiles, vaults, password locks, backups, archives, remote signing services or document management.

## Runtime

- Vanilla JavaScript ES modules and CSS.
- Vite builds a static site.
- PDF.js renders PDF pages.
- pdf-lib fills supported AcroForm fields and writes edited PDFs.
- Image processing runs in a temporary Web Worker.
- Signature input uses a pointer-enabled canvas. Export produces a transparent PNG Blob in memory, then passes it to the existing PDF photo-placement and export pipeline.
- Image decoding uses browser image APIs and canvas.
- All selected user files remain in browser memory during the active task.

## Data lifecycle

1. The user selects a local file.
2. The browser reads it into memory.
3. The app processes it locally.
4. The user reviews the result.
5. The user downloads the output or clears the workspace.

The app does not write user content to IndexedDB, Web Storage, cookies, Cache Storage or any server. It does not register a service worker. It does not promise offline reopening.

Clear actions terminate workers, release Blob URLs, clear canvases and drop app-owned references where possible. Browser memory reclamation is not under application control. Browser download history, browser-managed HTTP cache and OS-level files are outside the app's control.

## Security boundaries

- Validate file type and size before processing.
- Bound image pixel count and PDF size.
- Use local bundled dependencies only.
- Do not add analytics, telemetry, remote APIs, third-party scripts or CDN assets.
- Do not place user content in URLs, logs or telemetry.
- Use safe DOM APIs for user-provided field labels and values.
- Treat browser cleanup as best effort, not secure physical erasure.

## PDF coordinate model

PDF.js renders pages in a top-left viewport coordinate system. The PDF export layer maps user placements to PDF page coordinates before writing the output.

## Deployment

Vite emits a static `dist/` directory. GitHub Pages deployment remains gated by explicit `Approve-Release` approval.
