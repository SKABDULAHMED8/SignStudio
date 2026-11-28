# SignStudio release preparation

## Verified state

- Branch: `debug-package-integration`
- Latest completed verification: commit `9ac1a1c51141d482179e733ef8f0545ba72c4f0b`
- GitHub Actions run #31: Windows/Node 22 diagnostics and Gitleaks both passed.
- Unit tests, production build and six Playwright Chromium E2E tests passed.
- GitHub Pages preview was served and tested at `/SignStudio/`.

## Implemented

- Browser-only image cleanup and PDF editing workflows.
- Runtime checks for no persistent browser storage, accounts, document library, service worker, analytics or remote upload APIs.
- Vite Pages base path `/SignStudio/`.
- Local favicon, Apple touch icon, PNG app icons, social preview and web app manifest.
- Canonical URL, Open Graph, Twitter card and SoftwareApplication structured data.
- Visible workflow, privacy information and factual product FAQ.
- `robots.txt`, sitemap and `llms.txt` discovery files.
- GitHub Pages workflow configures Pages, installs locked dependencies, tests, builds, tests the production preview, then uploads `dist`.

## Remaining release checks

- Verify GitHub repository Pages settings use **GitHub Actions** as the build and deployment source.
- After the approved deployment, validate the live favicon, manifest, sitemap, robots file and social preview.
- Submit the canonical URL and sitemap in Google Search Console and Bing Webmaster Tools. Indexing and ranking are not guaranteed.
- Check public social previews in the relevant platform debuggers after the site is live.
- AEO/GEO markup improves machine readability; it does not guarantee inclusion or citation by search engines or AI systems.

## Release protection

Do not merge to `main` or deploy until the project owner explicitly sends `Approve-Release`.
