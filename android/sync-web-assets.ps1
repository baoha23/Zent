$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $PSScriptRoot "assets\www"

New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null

Copy-Item -Path (Join-Path $projectRoot "index.html") -Destination (Join-Path $assetsDir "index.html") -Force
Copy-Item -Path (Join-Path $projectRoot "styles.css") -Destination (Join-Path $assetsDir "styles.css") -Force
Copy-Item -Path (Join-Path $projectRoot "app.js") -Destination (Join-Path $assetsDir "app.js") -Force

$sourceAssetsSubdir = Join-Path $projectRoot "assets"
$targetAssetsSubdir = Join-Path $assetsDir "assets"
if (Test-Path $targetAssetsSubdir) {
  Remove-Item -Path $targetAssetsSubdir -Recurse -Force
}
if (Test-Path $sourceAssetsSubdir) {
  Copy-Item -Path $sourceAssetsSubdir -Destination $targetAssetsSubdir -Recurse -Force
}

Write-Host "Synced web files to $assetsDir"
