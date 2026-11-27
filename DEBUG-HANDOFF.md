# SignStudio consolidated debug handoff

## Purpose
This is a **debug-ready diagnostic package**, not a release candidate. It removes the old, misleading E2E suite from the active test discovery path and preserves it under `tests/retired/` for traceability. The active Playwright suite checks the GitHub Pages base path, persistent-storage policy, retired UI, and offline app shell.

## Known application gap
The source still initializes IndexedDB, the encrypted signature library, personal profiles, passphrase lock, backups, recovery, and localStorage preferences. These conflict with the approved transient workflow. The new tests intentionally report these gaps rather than hiding them or changing assertions to make the suite green.

## Run once on Windows
From PowerShell:

```powershell
Set-Location D:\SignStudio
.\scripts\Run-SignStudio-Debug.ps1
```

To reuse already-installed npm dependencies and Chromium:

```powershell
.\scripts\Run-SignStudio-Debug.ps1 -SkipInstall -SkipBrowserInstall
```

The runner executes one pass in this order: `npm ci`, Playwright browser check/install, unit tests, production build, and Playwright E2E. It captures the output in `artifacts/`, generates an HTML report, and exits non-zero if a check fails. It does not push, deploy, publish, or modify GitHub.

## Expected diagnostic failures
The storage and obsolete-UI tests are expected to fail until the application refactor removes the legacy persistence and related UI. The Pages shell and offline test should pass if the base path and static cache are correct. A failure is evidence to investigate, not a reason to weaken the test.

## Retired E2E suite
`tests/retired/signing-workflow.legacy.spec.js` is the previous suite. It asserts password setup, saved signatures, library/trash/version history, personal profiles and backup recovery. Those are not target features under the approved transient workflow. It remains in the package as an audit reference and is not run by Playwright.

## Release gate
No GitHub push, deployment, or publication is authorized by this package. Wait for the user's explicit `Approve-Release` instruction.
