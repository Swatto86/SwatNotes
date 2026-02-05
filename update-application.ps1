# SwatNotes Release Script
# Usage: .\update-application.ps1 -Version "0.2.0" -Notes "Bug fixes and improvements"
# Or run without parameters to be prompted for the version and release notes
#
# WHAT THIS SCRIPT DOES:
# 1. Updates version in: Cargo.toml, tauri.conf.json, package.json, config.ts, about.html
# 2. Commits the version changes
# 3. Deletes ALL previous git tags and GitHub releases (keeps only the new release)
# 4. Creates a new annotated git tag with your release notes
# 5. Pushes to GitHub, triggering the build workflow
#
# RELEASE NOTES FLOW:
# 1. The Notes parameter you provide is stored in an annotated Git tag
# 2. GitHub Actions extracts the tag annotation and creates a GitHub Release with it
# 3. When users check for updates, the app fetches the release notes from GitHub API
# 4. The notes are displayed in the update window under "What's New"
#
# REQUIREMENTS:
# - Git must be installed and configured
# - GitHub CLI (gh) is recommended for deleting old releases (optional but recommended)
#
# NOTE: This works with the public SwatNotes repository - no authentication needed!

param(
    [string]$Version,
    [string]$Notes
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host $msg -ForegroundColor Yellow }

# Change to project root directory (script is at root level)
$projectRoot = $PSScriptRoot
Set-Location $projectRoot
Write-Host "Working directory: $projectRoot" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "   SwatNotes Release Script" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Get version if not provided
if (-not $Version) {
    $Version = Read-Host "Enter the new version (e.g., 0.2.0)"
}

# Validate version format
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Invalid version format. Please use semantic versioning (e.g., 0.2.0)"
    exit 1
}

Write-Info "Releasing version: v$Version"
Write-Host ""

# Get release notes if not provided
if (-not $Notes) {
    Write-Host "Enter release notes (what's new in this version)." -ForegroundColor Cyan
    Write-Host "These notes will be shown to users when the update window appears." -ForegroundColor Yellow
    Write-Host "You can enter multiple lines. Type 'END' on a new line when done:" -ForegroundColor Gray
    Write-Host ""

    $noteLines = @()
    while ($true) {
        $line = Read-Host
        if ($line -eq 'END') {
            break
        }
        $noteLines += $line
    }
    $Notes = $noteLines -join "`n"
}

if (-not $Notes -or $Notes.Trim() -eq '') {
    $Notes = "Release v$Version"
}

Write-Host ""
Write-Info "Release notes:"
Write-Host "---"
Write-Host $Notes
Write-Host "---"
Write-Host ""

$confirm = Read-Host "Proceed with these release notes? (Y/n)"
if ($confirm -eq 'n' -or $confirm -eq 'N') {
    Write-Host "Aborted." -ForegroundColor Red
    exit 1
}
Write-Host ""

# Check for uncommitted changes
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Warn "Warning: You have uncommitted changes:"
    Write-Host $gitStatus
    $confirm = Read-Host "Do you want to continue anyway? (Y/n)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "Aborted." -ForegroundColor Red
        exit 1
    }
}

# File paths
$cargoToml = "src-tauri\Cargo.toml"
$tauriConf = "src-tauri\tauri.conf.json"
$packageJson = "package.json"
$configTs = "src\config.ts"
$aboutHtml = "pages\about.html"

# Check files exist
if (-not (Test-Path $cargoToml)) {
    Write-Error "File not found: $cargoToml"
    exit 1
}
if (-not (Test-Path $tauriConf)) {
    Write-Error "File not found: $tauriConf"
    exit 1
}
if (-not (Test-Path $packageJson)) {
    Write-Error "File not found: $packageJson"
    exit 1
}
if (-not (Test-Path $configTs)) {
    Write-Error "File not found: $configTs"
    exit 1
}
if (-not (Test-Path $aboutHtml)) {
    Write-Error "File not found: $aboutHtml"
    exit 1
}

# Update Cargo.toml
Write-Info "Updating $cargoToml..."
$cargoContent = Get-Content $cargoToml -Raw
$cargoContent = $cargoContent -replace '(?m)^version = "[^"]+"', "version = `"$Version`""
Set-Content $cargoToml $cargoContent -NoNewline
Write-Success "  Updated Cargo.toml"

# Update tauri.conf.json
Write-Info "Updating $tauriConf..."
$tauriContent = Get-Content $tauriConf -Raw
$tauriJson = $tauriContent | ConvertFrom-Json
$tauriJson.version = $Version
$tauriContent = $tauriJson | ConvertTo-Json -Depth 10
Set-Content $tauriConf $tauriContent
Write-Success "  Updated tauri.conf.json"

# Update package.json
Write-Info "Updating $packageJson..."
$packageContent = Get-Content $packageJson -Raw
$packageJson_obj = $packageContent | ConvertFrom-Json
$packageJson_obj.version = $Version
$packageContent = $packageJson_obj | ConvertTo-Json -Depth 10
Set-Content $packageJson $packageContent
Write-Success "  Updated package.json"

# Update src/config.ts
Write-Info "Updating $configTs..."
$configContent = Get-Content $configTs -Raw
$configContent = $configContent -replace "APP_VERSION = '[^']+'", "APP_VERSION = '$Version'"
Set-Content $configTs $configContent -NoNewline
Write-Success "  Updated src/config.ts"

# Update pages/about.html
Write-Info "Updating $aboutHtml..."
$aboutContent = Get-Content $aboutHtml -Raw
$aboutContent = $aboutContent -replace 'Version \d+\.\d+\.\d+', "Version $Version"
Set-Content $aboutHtml $aboutContent -NoNewline
Write-Success "  Updated pages/about.html"

# Stage and commit version changes
Write-Info "Committing version changes..."
git add $cargoToml $tauriConf $packageJson $configTs $aboutHtml
git commit -m "chore: bump version to $Version"
Write-Success "  Committed version bump"

# Delete all previous tags and releases
Write-Info "Cleaning up previous releases and tags..."

# Get all existing tags
$existingTags = git tag -l "v*"
if ($existingTags) {
    Write-Info "  Found existing tags: $($existingTags -join ', ')"
    
    # Check if GitHub CLI is available for deleting releases
    $ghAvailable = $null -ne (Get-Command gh -ErrorAction SilentlyContinue)
    
    if ($ghAvailable) {
        # Delete GitHub releases first (before deleting tags)
        Write-Info "  Deleting GitHub releases..."
        $ErrorActionPreference = "Continue"
        foreach ($tag in $existingTags) {
            $tag = $tag.Trim()
            if ($tag) {
                # Try to delete the release (may not exist)
                gh release delete $tag --yes 2>&1 | Out-Null
            }
        }
        $ErrorActionPreference = "Stop"
        Write-Success "  Deleted GitHub releases"
    } else {
        Write-Warn "  GitHub CLI (gh) not found - skipping release deletion"
        Write-Warn "  You may need to manually delete old releases from GitHub"
    }
    
    # Delete local tags
    Write-Info "  Deleting local tags..."
    foreach ($tag in $existingTags) {
        $tag = $tag.Trim()
        if ($tag) {
            git tag -d $tag 2>&1 | Out-Null
        }
    }
    Write-Success "  Deleted local tags"
    
    # Delete remote tags
    Write-Info "  Deleting remote tags..."
    $ErrorActionPreference = "Continue"
    foreach ($tag in $existingTags) {
        $tag = $tag.Trim()
        if ($tag) {
            git push origin --delete $tag 2>&1 | Out-Null
        }
    }
    $ErrorActionPreference = "Stop"
    Write-Success "  Deleted remote tags"
} else {
    Write-Info "  No existing tags found"
}

# Create git tag with release notes (annotated tag)
Write-Info "Creating git tag v$Version with release notes..."

# Create annotated tag with release notes
# Write notes to temp file to handle multi-line messages properly
$tempFile = [System.IO.Path]::GetTempFileName()
Set-Content $tempFile $Notes -NoNewline
git tag -a "v$Version" -F $tempFile
Remove-Item $tempFile
Write-Success "  Created annotated tag v$Version"

# Push changes and tag
Write-Info "Pushing to origin..."
# Temporarily disable error action to handle git's stderr output
$ErrorActionPreference = "Continue"
git push origin HEAD 2>&1 | Out-Null
git push origin "v$Version" 2>&1 | Out-Null
$ErrorActionPreference = "Stop"
Write-Success "  Pushed commits and tag"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Success "Release v$Version created successfully!"
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Info "GitHub Actions will now build and publish the release."
Write-Info "Check progress at: https://github.com/Swatto86/SwatNotes/actions"
Write-Host ""
