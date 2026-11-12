param([string]$Version = '1.4.115')
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid release version.' }
$desktopRoot = $PSScriptRoot
$releaseRoot = Join-Path $desktopRoot "publish-$Version"
dotnet publish (Join-Path $desktopRoot 'HomeSecurityDesktop.csproj') -c Release -r win-x64 --self-contained true -o $releaseRoot
if ($LASTEXITCODE -ne 0) { throw 'Desktop publish failed.' }
dotnet publish (Join-Path $desktopRoot '../agent/HomeSecurityAgent.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o (Join-Path $releaseRoot "Agent/$Version")
if ($LASTEXITCODE -ne 0) { throw 'Agent publish failed.' }
if (!(Test-Path -LiteralPath (Join-Path $releaseRoot "Agent/$Version/HomeSecurityAgent.exe"))) { throw 'Agent missing from release.' }
# Public pages packed in Panel/ reference WebP variants that GitHub Pages generates only at deploy
# time (scripts/optimize-marketing-images.mjs). Generate the same files for the installer; otherwise
# BundledPanel answers 404 and the Windows app shows broken logos and hero images.
$repoRoot = (Resolve-Path (Join-Path $desktopRoot '..')).Path
Push-Location $repoRoot
try {
  if (!(Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules/sharp'))) {
    npm install --no-save --no-package-lock sharp@0.34.5
    if ($LASTEXITCODE -ne 0) { throw 'Installing sharp for WebP variants failed.' }
  }
  $variants = Join-Path ([IO.Path]::GetTempPath()) ("hs-panel-webp-" + [Guid]::NewGuid().ToString('N'))
  node (Join-Path $repoRoot 'scripts/optimize-marketing-images.mjs') $variants
  if ($LASTEXITCODE -ne 0) { throw 'Generating WebP variants for the Windows panel failed.' }
} finally { Pop-Location }
$panelAssets = Join-Path $releaseRoot 'Panel/assets'
Copy-Item -Path (Join-Path $variants 'kamera/assets/*.webp') -Destination $panelAssets -Force
Remove-Item -LiteralPath $variants -Recurse -Force
foreach ($name in @('ds-logo-96.webp', 'ds-logo-192.webp', 'home-security-hero.webp', 'home-security-hero-640.webp', 'home-security-how-it-works.webp', 'home-security-how-it-works-640.webp')) {
  if (!(Test-Path -LiteralPath (Join-Path $panelAssets $name))) { throw "Panel image missing from release: $name" }
}
Write-Output "Release prepared: $releaseRoot"
