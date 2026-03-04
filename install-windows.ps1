# Sync Cursor settings, MCP, extensions, and agent skills from t-configs to Windows.
# Run from repo root: .\install-windows.ps1
# Set REF_API_KEY in the environment before running if you use the Ref MCP server:
#   $env:REF_API_KEY = "your-key"; .\install-windows.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot
$Dotfiles = Join-Path $RepoRoot "dotfiles"

if (-not (Test-Path (Join-Path $Dotfiles ".config\Cursor\User\settings.json"))) {
    Write-Error "Dotfiles not found at $Dotfiles. Run from repo root."
}

# Cursor User dir (Windows)
$CursorUserDir = Join-Path $env:APPDATA "Cursor\User"
$null = New-Item -ItemType Directory -Force -Path $CursorUserDir

# 1. Settings
Copy-Item -Path (Join-Path $Dotfiles ".config\Cursor\User\settings.json") -Destination (Join-Path $CursorUserDir "settings.json") -Force
Write-Host "[ok]   Cursor settings.json synced"

# 2. MCP config
$MCPTemplate = Join-Path $Dotfiles ".cursor\mcp.json.template"
$CursorDir = Join-Path $env:USERPROFILE ".cursor"
$null = New-Item -ItemType Directory -Force -Path $CursorDir
$MCPDest = Join-Path $CursorDir "mcp.json"

$mcpContent = Get-Content -Raw -Path $MCPTemplate
if ($env:REF_API_KEY) {
    $mcpContent = $mcpContent -replace "REF_API_KEY_PLACEHOLDER", $env:REF_API_KEY
    Write-Host "[ok]   Cursor MCP config generated with API key"
} else {
    Write-Host "[warn] REF_API_KEY not set; mcp.json will contain REF_API_KEY_PLACEHOLDER (edit or set env and re-run)"
}
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($MCPDest, $mcpContent, $utf8NoBom)

# 3. Extensions
$ExtFile = Join-Path $Dotfiles ".config\Cursor\extensions.txt"
if ((Test-Path $ExtFile) -and (Get-Command cursor -ErrorAction SilentlyContinue)) {
    Get-Content $ExtFile | ForEach-Object {
        $line = ($_ -replace "#.*", "").Trim()
        if ($line) {
            cursor --install-extension $line 2>$null
        }
    }
    Write-Host "[ok]   Cursor extensions processed"
} elseif (Test-Path $ExtFile) {
    Write-Host "[warn] Cursor CLI not in PATH; skip extension install or add Cursor to PATH and re-run"
}

# 4. Agent skills (junction so repo is source of truth)
$SkillsSource = (Resolve-Path (Join-Path $Dotfiles ".agent\skills")).Path
$SkillsDest = Join-Path $CursorDir "skills"
$AntigravityDest = Join-Path $env:USERPROFILE ".gemini\antigravity\skills"

if (Test-Path $SkillsDest) { Remove-Item $SkillsDest -Force }
New-Item -ItemType Junction -Path $SkillsDest -Target $SkillsSource | Out-Null
Write-Host "[ok]   Agent skills linked to .cursor\skills"

$null = New-Item -ItemType Directory -Force -Path (Split-Path $AntigravityDest -Parent)
if (Test-Path $AntigravityDest) { Remove-Item $AntigravityDest -Force }
New-Item -ItemType Junction -Path $AntigravityDest -Target $SkillsSource | Out-Null
Write-Host "[ok]   Agent skills linked to .gemini\antigravity\skills"

# 5. Gitconfig (optional)
Copy-Item -Path (Join-Path $Dotfiles ".gitconfig") -Destination (Join-Path $env:USERPROFILE ".gitconfig") -Force
Write-Host "[ok]   .gitconfig copied to %USERPROFILE%"

Write-Host ""
Write-Host "Done. Set Python interpreter and paths in Cursor if needed (repo settings.json has Mac paths)."
