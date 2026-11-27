# Local development and browser inspection

This guide covers the current `debug-package-integration` branch.

## 1. Stack and project map

| Area | Current implementation |
|---|---|
| App shell | `index.html` |
| UI | Vanilla JavaScript ES modules and CSS |
| Dev/build server | Vite 7 |
| PDF rendering | PDF.js (`pdfjs-dist`) |
| PDF writing | `pdf-lib` |
| Unit tests | Node.js built-in test runner |
| Browser tests | Playwright with Chromium |
| Styling | `styles/app.css` and related stylesheets |
| Browser code | `src/` |
| Static assets | `public/` |
| Unit tests | `tests/unit/` |
| End-to-end tests | `tests/e2e/` |
| Browser test config | `playwright.config.js` |
| Build config | `vite.config.js` |

Useful source folders include `src/studio/` for signature creation, `src/signature/` for image/signature processing, `src/pdf/` for PDF workflows, `src/ui/` for dialogs and navigation, and `src/platform/` for browser capabilities and file handling. Some legacy `src/library/`, `src/security/` and `src/recovery/` code remains. It is not compliant with the approved no-persistent-user-data target and must be removed in the privacy refactor.

## 2. Requirements and environment

Install Node.js 22 LTS or newer. npm is included with Node.js. Git is required to pull branch changes.

The current app does not require a `.env` file or environment variables. Do not create API keys or backend credentials for local preview.

Verify the tools:

```powershell
node --version
npm --version
git --version
```

## 3. Get the current branch

Run from the local repository folder:

```powershell
Set-Location "D:\SignStudio-GitHub-Integration"
git switch debug-package-integration
git pull --ff-only origin debug-package-integration
git status --short --branch
git log -1 --oneline
```

If your clone is in another folder, change only the `Set-Location` path. Confirm that the branch printed by Git is `debug-package-integration`.

Install exact locked dependencies:

```powershell
npm ci
```

Use `npm ci` after a fresh clone or when the lockfile changes. It installs from `package-lock.json` and removes an existing `node_modules` folder first.

## 4. Run the development server (recommended)

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5173/SignStudio/
```

Keep the terminal running. Vite serves source modules directly. Save a CSS, HTML or JavaScript file and Vite updates the page through HMR. Some changes require a full page reload. This is the best mode for normal UI development.

The default server binds to `127.0.0.1`, not every network interface. This avoids exposing a local document-processing app to other devices on the network.

## 5. Production-build preview

Use two commands:

```powershell
npm run build
npm run preview
```

Open:

```text
http://127.0.0.1:4173/SignStudio/
```

Preview serves the generated `dist/` directory. It does not rebuild when source files change. After a source edit, stop the preview process, run `npm run build`, then restart `npm run preview`.

## 6. Current page and route model

The current project has a single entry document and switches view panels with JavaScript. It does not implement a multi-page router.

| Browser URL | What it displays |
|---|---|
| `http://127.0.0.1:5173/SignStudio/` | Main app shell and initial signature workspace |
| Same URL, **Fill a PDF** navigation | PDF workspace panel |
| Same URL, **My signatures** navigation | Legacy library panel |
| Same URL, Settings | Legacy settings flow |

The panels are not independent URL routes. Do not try `/pdf`, `/library` or `/settings`; those routes are not implemented. Use the navigation inside the app. The library and settings panels are temporary legacy UI and are scheduled for removal under the privacy plan.

## 7. Browser DevTools workflow

Open Chrome or Edge DevTools with `F12`.

### Elements and layout

- Select an element with the element picker.
- Inspect the DOM hierarchy and accessibility attributes.
- In **Styles**, identify the CSS rule that sets the property.
- In **Computed**, inspect final values and the box model.
- Check width, height, margin, padding, gap, line-height, overflow and positioning.
- Toggle CSS declarations to test a layout adjustment before editing source.

### Responsive viewports

Toggle Device Toolbar with `Ctrl+Shift+M`. Test at least:

| Target | Viewport |
|---|---:|
| Mobile | 390 × 844 |
| Small mobile | 360 × 800 |
| Tablet | 768 × 1024 |
| Desktop | 1440 × 900 |

Check horizontal overflow, clipped controls, text wrapping, navigation, canvas sizing, dialogs and touch target size. Use browser zoom and keyboard navigation too. Device emulation does not fully reproduce physical-device performance or touch behaviour.

### Console

- Keep **Console** open while using the signature and PDF workflows.
- Fix uncaught exceptions and failed module imports.
- Expand stack traces and use source maps in development.
- Clear the console only after recording the first error.

### Network

- Open **Network** and enable **Disable cache**.
- Reload the page.
- Filter by **JS**, **CSS**, **Img** and **Fetch/XHR**.
- Check failed requests, 404s, MIME errors, unexpected third-party requests and unusually large assets.
- Inspect the **Initiator** column to trace which module requested an asset.

### Performance

- Open **Performance**, record a page load or interaction, then stop recording.
- Inspect long tasks, scripting time, layout shifts and paint activity.
- Treat tasks over 50 ms as candidates for investigation.
- Compare measurements at the same viewport and with the same test file.

## 8. Automated tests and debugging

Install Chromium once:

```powershell
npx playwright install chromium
```

Run the test suites:

```powershell
npm test
npm run build
npm run test:e2e
```

Useful interactive commands:

```powershell
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:debug
npm run test:e2e:report
```

Playwright starts the production preview server on port 4173. The browser test base URL is `http://127.0.0.1:4173/SignStudio/`. Test traces, screenshots, videos and reports are written to `test-results/` and `playwright-report/` when configured by the test run.

For an E2E failure, open the HTML report first. Then inspect the screenshot and trace. Reproduce the same flow manually in the development server and inspect Console and Network.

## 9. Confirm the local preview matches GitHub

A running Vite process does not pull GitHub changes. Pull first, then restart if needed:

```powershell
git switch debug-package-integration
git pull --ff-only origin debug-package-integration
git rev-parse HEAD
git status --short
npm ci
npm run dev
```

Compare the full commit SHA from `git rev-parse HEAD` with the latest commit SHA shown on the GitHub branch page. The local server then serves the code checked out at that commit. If the working tree is dirty, local changes may differ from GitHub; inspect `git status --short`.

## 10. Troubleshooting

| Symptom | Action |
|---|---|
| Port 5173 is busy | Stop the previous Vite process with `Ctrl+C`; check listeners with `Get-NetTCPConnection -LocalPort 5173 -State Listen` |
| Port 4173 is busy | Stop the previous preview process; check `Get-NetTCPConnection -LocalPort 4173 -State Listen` |
| Page returns 404 | Open the exact `/SignStudio/` base path |
| HMR does not update | Check the Vite terminal; save again; hard reload with `Ctrl+Shift+R`; restart Vite if needed |
| Stale production preview | Run `npm run build` again before starting preview |
| Missing package | Run `npm ci` from the repository root |
| Chromium missing | Run `npx playwright install chromium` |
| PDF module fails | Inspect Console and Network for the PDF.js worker/module request and its response |

## 11. Privacy warning for this branch

The branch still contains legacy IndexedDB, Web Storage, saved signature/profile, password/recovery and service-worker code. The strict privacy refactor is not complete. Do not use this branch with sensitive documents until storage and network audits pass. The local preview is for development inspection, not a privacy certification.

A browser website cannot clear the user's download history or guarantee physical zeroization of memory. The application can only release references and resources it owns.
