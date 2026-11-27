# DevOps integration notes

## Added workflow

`.github/workflows/debug.yml` runs on pushes to `debug/*` and pull requests targeting `main`. It uses `windows-latest` because `scripts/Run-SignStudio-Debug.ps1` invokes `$env:ComSpec` and `cmd.exe`; running this script on Ubuntu would fail. It installs Node.js 20, runs Gitleaks against the checked-out repository history, installs dependencies and Playwright Chromium, executes the diagnostic script, and uploads `artifacts/`, Playwright HTML reports, and test results with 30-day retention.

## Ignore rules

`.gitignore` excludes dependency/build directories, logs, ZIPs, Playwright output, diagnostic artifacts, temporary directories, caches, and environment files.

## Security scan scope

The imported ZIP was scanned for common private-key headers, GitHub/AWS credentials, generic token assignments, and high-entropy credential-like strings. This is a source-archive scan only. The ZIP does not contain `.git`, so it cannot establish that the GitHub repository's historical commits or remote caches are free of secrets. The CI Gitleaks action scans repository history after integration.

## Repository actions not performed

No clone, remote branch creation, commit, push, pull request, reviewer request, branch protection change, merge, or remote branch deletion was performed. The user previously required the exact `Approve-Release` authorization before any push, deployment, or publication. A team-lead GitHub username was also not supplied, so a review request cannot be addressed yet.
