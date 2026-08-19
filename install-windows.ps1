# Sync Claude Code config, VS Code settings, and .gitconfig from t-configs to Windows.
# Run from repo root: .\install-windows.ps1
#
# Directories use junctions, which need no special privileges. Single files need a
# real symlink, and Windows only allows those with Developer Mode on or an elevated
# shell — so each file falls back to a plain copy, with a warning that edits made in
# the copy will NOT flow back to the repo.

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot
$Dotfiles = Join-Path $RepoRoot "dotfiles"

if (-not (Test-Path (Join-Path $Dotfiles ".claude"))) {
    Write-Error "Dotfiles not found at $Dotfiles. Run this from the repo root."
}

function Link-Directory {
    param($Source, $Dest)
    if (-not (Test-Path $Source)) {
        Write-Host "[warn] not in repo, skipped: $Source"
        return
    }
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $Dest -Parent)
    if (Test-Path $Dest) { Remove-Item $Dest -Force -Recurse }
    $null = New-Item -ItemType Junction -Path $Dest -Target (Resolve-Path $Source).Path
    Write-Host "[ok]   linked: $Dest"
}

function Link-File {
    param($Source, $Dest)
    if (-not (Test-Path $Source)) {
        Write-Host "[warn] not in repo, skipped: $Source"
        return
    }
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $Dest -Parent)
    if (Test-Path $Dest) { Remove-Item $Dest -Force }
    try {
        $null = New-Item -ItemType SymbolicLink -Path $Dest -Target (Resolve-Path $Source).Path -ErrorAction Stop
        Write-Host "[ok]   linked: $Dest"
    } catch {
        Copy-Item -Path $Source -Destination $Dest -Force
        Write-Host "[warn] copied (not linked): $Dest — edits here will not reach the repo."
        Write-Host "       Turn on Developer Mode or run elevated to get a real symlink."
    }
}

$ClaudeDir = Join-Path $env:USERPROFILE ".claude"

# Claude Code config. ~/.claude is the single source for skills, rules and agents.
Link-Directory (Join-Path $Dotfiles ".claude\skills")        (Join-Path $ClaudeDir "skills")
Link-Directory (Join-Path $Dotfiles ".claude\rules")         (Join-Path $ClaudeDir "rules")
Link-Directory (Join-Path $Dotfiles ".claude\agents")        (Join-Path $ClaudeDir "agents")
Link-Directory (Join-Path $Dotfiles ".claude\commands")      (Join-Path $ClaudeDir "commands")
Link-Directory (Join-Path $Dotfiles ".claude\scripts")       (Join-Path $ClaudeDir "scripts")
Link-Directory (Join-Path $Dotfiles ".claude\output-styles") (Join-Path $ClaudeDir "output-styles")
Link-File      (Join-Path $Dotfiles ".claude\CLAUDE.md")     (Join-Path $ClaudeDir "CLAUDE.md")

# settings.json is SEEDED once, then owned by this machine — never linked and never
# synced back. Claude Code rewrites it in place, which a symlink would break. Shared
# changes go in settings.base.json; machine-only ones in settings.local.json.
$SettingsDest = Join-Path $ClaudeDir "settings.json"
if (Test-Path $SettingsDest) {
    Write-Host "[info] settings.json already exists (machine-owned, left untouched)"
} else {
    Copy-Item -Path (Join-Path $Dotfiles ".claude\settings.base.json") -Destination $SettingsDest -Force
    Write-Host "[ok]   settings.json seeded from settings.base.json (now machine-owned)"
}

# VS Code User settings
Link-File (Join-Path $Dotfiles ".config\editors\settings.json") (Join-Path $env:APPDATA "Code\User\settings.json")

# Git config. Copied, not linked: git reads it before any of this matters, and the
# work identity it includes lives outside the repo anyway.
Copy-Item -Path (Join-Path $Dotfiles ".gitconfig") -Destination (Join-Path $env:USERPROFILE ".gitconfig") -Force
Write-Host "[ok]   .gitconfig copied to %USERPROFILE%"

Write-Host ""
Write-Host "Done. The repo settings.json uses Mac paths — set the Python interpreter and"
Write-Host "workspace paths in VS Code once if they look wrong."
