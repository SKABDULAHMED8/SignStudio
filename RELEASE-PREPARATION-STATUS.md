# SignStudio release preparation

## Current state

The application is being prepared on `debug-package-integration`. The latest full diagnostics run before the SEO metadata update passed both Windows/Node 22/Playwright and Gitleaks. The metadata update is under verification; do not treat this release candidate as cleared until the new run passes.

## Implemented

- Browser-only image cleanup and PDF editing workflows.
- No persistent browser storage, account system, document library, service worker, analytics or file-upload endpoint in the runtime checks.
- GitHub Pages Vite base path: `/SignStudio/`.
- Local favicon, Apple touch icon, PNG app icons and social preview assets.
- Canonical URL, Open Graph, Twitter card and SoftwareApplication structured data.
- Visible workflow, privacy information and factual product FAQ.
- `robots.txt`, sitemap, web app manifest and `llms.txt` discovery files.
- Gitleaks and Windows/Node 22/Playwright diagnostics.

## Release gates

- Latest full unit, build and E2E workflow must pass after all current changes.
- Confirm the GitHub Pages artifact contains correctly rooted `/SignStudio/` asset paths.
- Validate the deployed favicon, manifest, sitemap, robots file and social preview after release.
- Check the canonical URL and social preview with external validators after the site is live.
- Search indexing, rich-result eligibility and AI crawler citations cannot be guaranteed by repository changes alone.
- Do not merge to `main` or deploy until the project owner explicitly sends `Approve-Release`.

## Local checks

`npm ci`, `npm test`, `npm run build`, and `npm run test:e2e`.
