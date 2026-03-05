# Install Windows apps from winget-packages.json (run from repo root in PowerShell).
# Usage: .\scripts\install-winget.ps1
# Or:    winget import -i (Join-Path (Split-Path $PSScriptRoot -Parent) winget-packages.json)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$JsonPath = Join-Path $RepoRoot "winget-packages.json"

if (-not (Test-Path $JsonPath)) {
    Write-Error "winget-packages.json not found at $JsonPath"
}

Write-Host "Importing packages from winget-packages.json..."
winget import -i $JsonPath --accept-package-agreements
Write-Host "Done."
Write-Host "Note: Fira Code font is not in winget. Install from https://github.com/tonsky/FiraCode/releases if needed."
