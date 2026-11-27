# Retired end-to-end suite

`signing-workflow.legacy.spec.js` is retained for audit and historical reference. It is not discovered by the active Playwright configuration.

Its scenarios cover:
- Sequential app-password dialogs.
- Saved signature lifecycle, versions, trash and restore.
- PDF filling using saved signatures and personal profiles.
- Startup passphrase lock.
- Encrypted backup restore.
- Forgotten-passphrase recovery.

These scenarios are retired because the approved product direction is a transient Upload → Convert → Edit → Save → Close workflow with no persistent user data. The PDF form filling, signature placement, PDF export, responsive layout and offline app-shell requirements remain in scope and must receive replacement coverage during implementation.
