# SignStudio

SignStudio is a browser-based application for creating transparent digital signatures and filling PDF forms. The intended privacy model keeps selected documents and generated results in browser memory and does not upload them to a SignStudio server.

**Planned live URL:** https://skabdulahmed8.github.io/SignStudio/  
**Development branch:** `debug-package-integration`  
**Release status:** Not approved for production. The current branch still contains legacy persistence features that must be removed and verified before the privacy target is met.

## Requirements

- Node.js 22 LTS or newer
- npm (included with Node.js)
- Git for branch updates

No environment variables, API keys, backend services, or database are required for the current frontend.

## Run the live development server

Open PowerShell in the project folder:

```powershell
git switch debug-package-integration
git pull --ff-only origin debug-package-integration
node --version
npm --version
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/SignStudio/**.

Vite serves the source files and provides hot-module replacement (HMR). Keep this terminal open while you work. Edit a file and save it. The browser updates automatically. JavaScript changes that cannot be safely hot-reloaded may trigger a full page reload.

The development server binds to `127.0.0.1`. It is available only on this computer by default.

## Preview the production build

Use this when you need to inspect the built files rather than Vite's development modules:

```powershell
npm run build
npm run preview
```

Open **http://127.0.0.1:4173/SignStudio/**.

The preview command serves the latest `dist` output. Run `npm run build` again after source changes before refreshing this preview.

## Browser test commands

```powershell
npm test
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:debug
npm run test:e2e:report
npm run test:all
```

The Playwright configuration starts the production preview server on port 4173. Install Chromium once if needed:

```powershell
npx playwright install chromium
```

## Pages and navigation

This branch currently uses one HTML entry point and client-side view panels. It is not a multi-page router.

- `/SignStudio/`: application entry point and signature workspace
- **Make a signature**: create a signature from a photo or draw it
- **My signatures**: legacy local library panel; scheduled for removal under the strict no-persistent-storage plan
- **Fill a PDF**: open the PDF workspace from the navigation
- Settings and recovery panels are legacy features and are also scheduled for removal

Use the app navigation to switch panels. Do not expect separate URLs such as `/pdf` or `/library` in the current implementation.

## Browser inspection

1. Open Chrome or Edge at the development URL.
2. Press `F12` to open Developer Tools.
3. Use **Elements** to inspect DOM structure and computed CSS.
4. Use **Console** to find JavaScript errors and warnings.
5. Use **Network**, enable **Disable cache**, then reload to inspect asset requests and status codes.
6. Use **Performance** and record a page load or interaction to find long tasks and rendering delays.
7. Toggle the Device Toolbar with `Ctrl+Shift+M`. Test common viewport sizes such as 390×844 (mobile), 768×1024 (tablet), and 1440×900 (desktop). These are viewport simulations, not substitutes for testing on physical devices.

For layout checks, select an element in **Elements**, inspect its box model, and review computed `display`, `width`, `height`, `margin`, `padding`, `gap`, `font` and breakpoint rules. Use the responsive viewport controls to check overflow, wrapping, touch target size and sticky/fixed elements.

## Keep the local branch in sync

Before starting a work session:

```powershell
git status --short --branch
git switch debug-package-integration
git pull --ff-only origin debug-package-integration
git log -1 --oneline
```

After pulling, compare the latest commit shown by `git log` with the branch's latest commit on GitHub. The local preview uses local files only; it does not automatically fetch new commits. Pull changes before expecting remote branch updates to appear locally.

To see which branch and commit the preview is using:

```powershell
git branch --show-current
git rev-parse --short HEAD
```

## Troubleshooting

- **Port 5173 or 4173 is already in use:** stop the other Vite process with `Ctrl+C`, or identify the process using `Get-NetTCPConnection -LocalPort 5173,4173 -State Listen`.
- **Dependencies are missing or inconsistent:** run `npm ci` from the project root.
- **The browser shows an old production build:** stop preview, run `npm run build`, then run `npm run preview` again.
- **A module or asset returns 404:** confirm you opened the URL with the `/SignStudio/` base path.
- **HMR stops responding:** check the Vite terminal for errors, then hard reload with `Ctrl+Shift+R`. Restart `npm run dev` if required.
- **Playwright cannot launch Chromium:** run `npx playwright install chromium`.

## Privacy status

The intended flow is **Upload → Configure → Process → Preview → Download → Clear workspace**. Browser memory is temporary, but browsers control memory reclamation. A website cannot guarantee secure physical zeroization, clear browser download history, or control browser-managed caches. The current branch still contains legacy IndexedDB, Web Storage, service-worker and saved-library code. Do not use this branch for sensitive documents until the privacy refactor and its tests are complete.

## License

MIT. See [LICENSE](LICENSE).
