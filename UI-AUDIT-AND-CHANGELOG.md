# SignStudio UI audit and implementation notes

## Root cause

The browser screenshot was taken at `http://127.0.0.1:4173/` after a build configured with `GITHUB_PAGES=true`.

In `vite.config.js:20`, that build uses `/SignStudio/` as Vite's `base`. `index.html` uses `%BASE_URL%` for the entry module, brand image, icons and manifest. Therefore the built page expects those assets below `/SignStudio/`. Previewing it at `/` requests the wrong paths and produces missing CSS, JavaScript and images.

The current source archive includes `styles/app.css` and its imported stylesheets. `src/main.js:1` imports `../styles/app.css`. The logo exists at `public/brand/signstudio-wordmark.png`.

Correct preview for a GitHub Pages build:
- Build with `GITHUB_PAGES=true`.
- Open `http://127.0.0.1:4173/SignStudio/`.

For a local root build, omit `GITHUB_PAGES` and open `http://127.0.0.1:4173/`.

## Changes made

- Added `styles/polish.css` and imported it from `styles/app.css`.
- Refined the existing document utility layout, card hierarchy, responsive spacing and PDF workspace.
- Improved muted text contrast tokens in `styles/tokens.css`.
- Styled native file selector buttons as a fallback while retaining the existing custom dropzone actions.
- Added accessible names to hidden image, camera, PDF and backup file inputs in `index.html`.
- Disabled public production source maps in `vite.config.js`.
- Added a Playwright regression test for stylesheet application, logo loading, failed local requests and 360/768/1440px screenshots.

## Preserved

No encryption, IndexedDB schema, signature record format, backup format, PDF processing, offline service-worker logic, or network upload behavior was intentionally changed. No dependencies were added.

## Verification status

- Unit tests: 48 passed, 0 failed.
- JavaScript syntax checks: passed.
- CSS import path check: passed.
- Referenced public asset existence check: passed.
- Production build: not verified in this environment because `npm ci` timed out and Vite was not installed here.
- Playwright: not run in this environment because dependencies could not be installed.
- Visual screenshots: the regression test is included, but screenshots could not be generated here.
- WCAG 2.2 AA: not certified. Contrast tokens were adjusted and focus/labels were reviewed at source level; a browser accessibility audit is still required.

## Release gate

No deployment or publication was performed. Release remains blocked until the user explicitly replies `Approve-Release`.
