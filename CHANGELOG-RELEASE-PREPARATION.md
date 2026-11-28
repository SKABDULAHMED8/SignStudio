# SignStudio release-preparation changelog

## Current release candidate

The candidate is maintained on `debug-package-integration`. No merge to `main` or deployment has been performed.

## SEO, AEO and social metadata

- Canonical URL and accurate title/description metadata.
- Open Graph and Twitter large-image card metadata for link previews in chat and social apps.
- Local favicon SVG/ICO, Apple touch icon, PNG app icons and web app manifest.
- `SoftwareApplication` JSON-LD with supported feature descriptions.
- Visible workflow, privacy explanations and factual FAQ content.
- `robots.txt`, sitemap and `llms.txt` discovery resources.

## GitHub Pages release workflow

- Configures Pages for Actions-based deployment.
- Uses `npm ci` for reproducible dependency installation.
- Runs unit tests, builds the static site, then runs Playwright against the production preview.
- Uploads the verified `dist` folder and deploys only from `main`.

## Verification

GitHub Actions run #31 passed on commit `9ac1a1c51141d482179e733ef8f0545ba72c4f0b`: unit tests, production build, six Chromium E2E tests, and Gitleaks.

## Boundaries

- No analytics, tracking, remote file processing, account system, or persistent user-file storage.
- The image tool targets handwriting/ink on plain paper; it is not a general photo cutout tool.
- The PDF tool does not create handwritten signatures or apply digital certificates.
- Search ranking, indexing, AI citations and third-party chat preview caches cannot be guaranteed by repository changes alone.
- Deployment requires the explicit owner approval phrase `Approve-Release`.
