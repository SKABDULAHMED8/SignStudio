[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipBrowserInstall
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
$ArtifactDir = Join-Path $ProjectRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $ArtifactDir | Out-Null
$RunLog = Join-Path $ArtifactDir ("debug-run-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

function Invoke-LoggedCommand {
    param([Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][string]$Command)
    Write-Host "`n===== $Name =====" -ForegroundColor Cyan
    "`r`n===== $Name =====`r`nPS> $Command`r`n" | Out-File -FilePath $RunLog -Append -Encoding utf8
    & $env:ComSpec /d /s /c "cd /d `"$ProjectRoot`" && $Command" 2>&1 |
        Tee-Object -FilePath $RunLog -Append | Out-Host
    $code = $LASTEXITCODE
    if ($null -eq $code) { $code = 0 }
    if ($code -ne 0) {
        Write-Host "$Name FAILED (exit $code). See $RunLog" -ForegroundColor Red
    } else {
        Write-Host "$Name PASSED" -ForegroundColor Green
    }
    return [int]$code
}

Write-Host 'SignStudio consolidated debug run' -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host "Log: $RunLog"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is not installed or is not on PATH.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is not installed or is not on PATH.' }
node --version
npm --version

if (-not $SkipInstall) {
    $installCode = Invoke-LoggedCommand -Name 'Dependency installation' -Command 'npm ci'
    if ($installCode -ne 0) { exit $installCode }
}

if (-not $SkipBrowserInstall) {
    $browserCode = Invoke-LoggedCommand -Name 'Playwright Chromium verification/installation' -Command 'npx playwright install chromium'
    if ($browserCode -ne 0) { exit $browserCode }
}

$steps = @(
    @{ Name = 'Unit tests'; Command = 'npm test' },
    @{ Name = 'Production build'; Command = 'npm run build' },
    @{ Name = 'GitHub Pages and workflow diagnostic E2E'; Command = 'npm run test:e2e' }
)

$results = @()
foreach ($step in $steps) {
    $code = Invoke-LoggedCommand -Name $step.Name -Command $step.Command
    $status = if ($code -eq 0) { 'PASS' } else { "FAIL ($code)" }
    $results += [pscustomobject]@{ Check = $step.Name; Result = $status }
}

Write-Host "`n===== CONSOLIDATED RESULT =====" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$results | Format-Table -AutoSize | Out-String | Out-File (Join-Path $ArtifactDir 'debug-summary.txt') -Encoding utf8
Write-Host "Full output: $RunLog"
Write-Host 'Playwright HTML report: playwright-report\index.html'
Write-Host 'Trace and screenshots: test-results\'

if (@($results | Where-Object { $_.Result -like 'FAIL*' }).Count -gt 0) { exit 1 }
exit 0
