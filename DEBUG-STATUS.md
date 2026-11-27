# SignStudio debug package status

**Classification: debug-ready diagnostic package. Not release-ready.**

## Verified from this package in the preparation environment
- Unit tests: 63 passed, 0 failed.
- Production build: not verified in this environment because dependency installation timed out and `vite` was unavailable after the timeout.
- Playwright: not executed in this environment; Chromium availability was not established.
- The user previously ran the production build successfully on Windows.
- The user's Playwright run was manually closed during test 6. The provided output has no final report, so exact failure assertions and the final test count cannot be reconstructed from that log.

## Confirmed source-level conflicts
The current `src/main.js` opens IndexedDB, loads the encrypted library and personal profiles, initializes the passphrase lock, and reads/writes localStorage. The current `index.html` exposes library, backup, profile and recovery UI. These conflict with the approved transient workflow.

## Active diagnostic tests
1. Production shell and asset loading at `/SignStudio/`.
2. No persistent browser storage writes or IndexedDB startup.
3. No persistent library/profile/password/backup/recovery UI.
4. Offline app-shell reload.

Tests 2 and 3 are expected to fail against the current source until the application refactor is completed. They are intentional regression gates, not flaky tests to delete.

## Previous E2E tests
The old suite is preserved at `tests/retired/signing-workflow.legacy.spec.js`. It is not active because it asserts the retired library, trash, profiles, passphrase and backup workflows. A test retirement list is in `tests/retired/README.md`.
