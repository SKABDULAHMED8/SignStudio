# Start here: SignStudio debug package

This ZIP contains the full project source plus a single-run Windows diagnostic runner.

## Run one consolidated pass

Open PowerShell in the extracted folder and run:

```powershell
.\scripts\Run-SignStudio-Debug.ps1
```

The script performs dependency installation, Chromium setup, all unit tests, one production build, and the Playwright diagnostic suite. It records output under `artifacts\`, writes an HTML Playwright report, and exits with code 1 if any stage fails.

If dependencies and Chromium are already installed:

```powershell
.\scripts\Run-SignStudio-Debug.ps1 -SkipInstall -SkipBrowserInstall
```

## Expected outcome today

The current source still has IndexedDB/localStorage persistence and persistent library/password/backup UI. Therefore, the two corresponding diagnostic tests should fail. That is the exact known refactor gap. The test runner does not hide these failures.

See `DEBUG-HANDOFF.md` and `DEBUG-STATUS.md` for the scope, evidence and release boundary. Do not push or deploy this package.
