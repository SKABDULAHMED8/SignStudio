# Changelog: release preparation

## Added
- `public/logo.svg`, `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `social-preview.png`.
- `public/site.webmanifest` with SignStudio identity and Pages-scoped paths.
- `.github/workflows/deploy.yml` for gated build/test/Pages deployment on `main` or manual dispatch.
- `RELEASE-PREPARATION-STATUS.md` with verified work and explicit release blockers.

## Changed
- Vite base path is fixed to `/SignStudio/`.
- Service worker now caches only build-time allowlisted assets. It ignores arbitrary same-origin requests, including user documents.
- `index.html` now contains canonical, Open Graph, Twitter, JSON-LD and theme metadata, plus a factual How it works and Privacy section.
- `robots.txt` and `sitemap.xml` point to the planned GitHub Pages URL.
- README and `.gitignore` updated.

## Not completed
- Persistent library, personal profiles, backups, recovery and passphrase UI have not yet been removed from the application runtime.
- The transient workflow, full test migration and browser cleanup are not complete.
- No dependencies were added. Existing `LICENSE` was not edited.
- No tests/build/preview were completed because dependency installation could not be completed in this environment.
- No deployment, push or publication occurred.
