# Development guide

## Stack

| Area | Implementation |
|---|---|
| UI | Vanilla JavaScript ES modules and CSS |
| Build | Vite 7 |
| PDF rendering | PDF.js |
| PDF writing | pdf-lib |
| Unit tests | Node.js built-in test runner |
| Browser tests | Playwright Chromium |

## Local setup

```powershell
Set-Location "D:\SignStudio-GitHub-Integration"
git switch debug-package-integration
git pull --ff-only origin debug-package-integration
npm ci
npm run dev
```

Open http://127.0.0.1:5173/SignStudio/.

## Verification

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Privacy rules

- No IndexedDB, localStorage, sessionStorage, cookies or Cache Storage for app data.
- No service worker, background sync, saved workspace, history, profiles, vault, passwords, backup or archive.
- No server upload, API call, analytics, telemetry, CDN or third-party runtime script.
- Process selected files in browser memory.
- Revoke Blob URLs, terminate workers, clear canvases and release app-owned references when the user clears a workspace or leaves the page.
- Do not claim secure physical memory erasure. Do not claim that the app can clear browser downloads or browser-managed caches.
- Do not promise offline reopening.

## Local preview

```powershell
npm run build
npm run preview
```

Open http://127.0.0.1:4173/SignStudio/.

## Release control

Do not merge to `main` or deploy until the project owner gives the exact approval: `Approve-Release`.
