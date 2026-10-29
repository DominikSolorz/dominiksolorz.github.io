param([string]$Version = '1.4.26')
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid release version.' }
$desktopRoot = $PSScriptRoot
$releaseRoot = Join-Path $desktopRoot "publish-$Version"
dotnet publish (Join-Path $desktopRoot 'HomeSecurityDesktop.csproj') -c Release -r win-x64 --self-contained true -o $releaseRoot
if ($LASTEXITCODE -ne 0) { throw 'Desktop publish failed.' }
dotnet publish (Join-Path $desktopRoot '../agent/HomeSecurityAgent.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o (Join-Path $releaseRoot "Agent/$Version")
if ($LASTEXITCODE -ne 0) { throw 'Agent publish failed.' }
if (!(Test-Path -LiteralPath (Join-Path $releaseRoot "Agent/$Version/HomeSecurityAgent.exe"))) { throw 'Agent missing from release.' }
Write-Output "Release prepared: $releaseRoot"
