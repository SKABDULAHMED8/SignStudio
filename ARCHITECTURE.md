# SignStudio architecture

## Product structure

Signature Studio is the primary workspace. PDF Workspace is optional and lazy-loaded. Both workspaces use the same encrypted device library. Session-only records remain isolated in memory.

## Module flow

1. `main.js` checks secure-context capabilities, opens IndexedDB, handles startup lock/recovery and creates the workspace controllers.
2. `studio/` owns photo input, drawing, preview, settings and save actions.
3. `signature/processing/` contains pure pixel operations. `signature/workers/` runs the extraction pipeline off the UI thread.
4. `security/` manages the non-exportable AES-GCM device key and the optional PBKDF2 startup access gate.
5. `library/` encrypts signature image bytes separately from encrypted metadata and thumbnails before IndexedDB writes. The list view reads thumbnails and fingerprints only; full images load on demand. The library manages similarity detection, up to 10 encrypted versions, Trash and passphrase-encrypted backups.
6. `library-view/` renders saved and session records, storage estimates, encrypted backup import/export and the 60-second Trash Undo list.
7. `pdf/` is dynamically imported only when the PDF workspace is opened. PDF.js renders pages; pdf-lib reads/fills standard AcroForm fields and exports signature placements.
8. `platform/service-worker.js` generates the production service worker during the Vite build. It precaches the core app and caches same-origin runtime assets on first use. PDF chunks are excluded from initial precache and cached when the PDF workspace is first opened online.

## Security model

- Device signatures, thumbnails, settings and pixel buffers are encrypted with AES-GCM-256 before persistent writes. The non-exportable CryptoKey is stored in IndexedDB.
- The optional passphrase lock is an app-level startup gate verified with PBKDF2-SHA-256 (600,000 iterations). It does not wrap the device key and does not protect against code running in the same origin or a person with access to an unlocked browser profile. This limitation is stated in the UI.
- Backup files use a separate PBKDF2-derived AES-GCM key. A backup can recover data after local database/key loss.
- The app makes no network request for signature, image or PDF content. Service-worker requests are limited to same-origin app assets.

## Data lifecycle

- Saved signatures: encrypted IndexedDB records; they survive normal browser restarts but may be removed by site-data cleanup or browser eviction.
- Session-only signatures: memory only; cleared on page exit.
- Trash: recoverable for 60 seconds; expiration is timestamp-based and purged on startup/library operations.
- Core app shell: Cache Storage after first online installation. PDF chunks are cached on first online PDF use.

## PDF coordinate model

PDF.js uses a top-left viewport origin. Signature placement is stored in page-local CSS viewport coordinates, with the viewport dimensions recorded at placement time. Export converts those coordinates to pdf-lib's bottom-left page coordinate system. Zoom changes rescale the preview coordinates while preserving the corresponding PDF placement.

## Deployment

Vite emits a static `dist/` directory. The service worker is generated with the build's actual chunk list and repository base path. GitHub Pages project paths are configured by `GITHUB_PAGES=true`. Deployment is deliberately not automated until the project owner approves the final build.


## PDF form-filling additions (2026-11-25)

- `src/pdf/editor-model.js` defines typed placement validation and character-grid distribution.
- `src/pdf/history.js` provides bounded undo/redo history.
- `src/pdf/form-detection.js` performs local geometric detection of axis-aligned printed rectangles. It does not perform semantic OCR.
- `src/pdf/form-detection.worker.js` runs detection away from the main UI thread.
- `src/pdf/document-view.js` exposes text, tick, cross, date, character-grid, photo and signature placement tools.
- `src/pdf/pdf-export.js` exports the new vector and image overlay types.
- `src/library/personal-profiles.js` encrypts optional reusable profile fields with the existing device AES-GCM key.
- IndexedDB is upgraded additively from version 1 to version 2 with a `personal-profiles` store. Existing signature records are not rewritten.
- Existing signature backup format version 1 is unchanged. Personal profiles are excluded from it. During backup restore, profiles are re-encrypted under the replacement device key; rollback restores their original ciphertext if recovery fails.
