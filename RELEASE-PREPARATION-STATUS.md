# Release preparation status

This archive contains the GitHub Pages base-path, metadata, branding asset, static service-worker caching and Pages workflow preparation changes. It is **not release-ready**.

## Verified in this workspace

- Vite configuration uses `/SignStudio/` as its base path.
- `public/site.webmanifest`, robots.txt and sitemap.xml were added/updated.
- Favicon ICO contains 16, 32 and 48 pixel entries; PNG icons were generated at 180, 192 and 512 pixels; social preview is 1200×630.
- Service worker generation now precaches only an explicit build asset list and ignores all other requests. It no longer runtime-caches arbitrary same-origin GET responses.
- GitHub Pages workflow is prepared for push to `main` and manual dispatch. It runs unit tests, Playwright and build before deployment.
- No push, deployment or publication was performed.

## Blocking items

- The current `src/main.js` still initializes IndexedDB, saved-signature library, personal profiles, passphrase lock and backup/recovery. These are incompatible with the approved no-persistence workflow and have not yet been removed.
- The current Studio and PDF views still have library-dependent controls and integration. The transient Upload → Convert → Edit → Save → Close workflow is not complete.
- Legacy tests and selectors have not all been reconciled with the revised UI.
- `npm ci` could not complete in the build environment because the npm registry package download timed out; offline installation also failed because the required packages were not cached. Therefore unit tests, Playwright, production build and `/SignStudio/` preview were not run.
- The workflow references official GitHub Pages actions but has not been tested by GitHub Actions.

Do not enable deployment or publish this archive. Complete the blockers, run all tests and inspect the Pages-path preview first.
