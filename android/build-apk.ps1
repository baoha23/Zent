$ErrorActionPreference = "Stop"

function Get-VersionObject {
  param([string]$Name)

  # Force an array so names like "android-36" do not collapse to a scalar
  # and get stuck in the padding loop below.
  $parts = @([regex]::Matches($Name, "\d+") | ForEach-Object { [int]$_.Value })
  while ($parts.Count -lt 4) {
    $parts += 0
  }

  return [version]::new($parts[0], $parts[1], $parts[2], $parts[3])
}

function Resolve-LatestDirectory {
  param(
    [string]$BasePath,
    [string]$Filter = "*"
  )

  if (-not (Test-Path $BasePath)) {
    return $null
  }

  $dirs = Get-ChildItem -Path $BasePath -Directory -Filter $Filter -ErrorAction SilentlyContinue
  if (-not $dirs) {
    return $null
  }

  return $dirs |
    Sort-Object -Property @{ Expression = { Get-VersionObject $_.Name }; Descending = $true }, @{ Expression = { $_.Name }; Descending = $true } |
    Select-Object -First 1
}

function Resolve-ToolPath {
  param([string[]]$Candidates)

  foreach ($candidate in $Candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Invoke-External {
  param(
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $FilePath $($Arguments -join ' ')"
  }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDir = $PSScriptRoot
$srcDir = Join-Path $androidDir "src"
$manifestPath = Join-Path $androidDir "AndroidManifest.xml"
$assetsDir = Join-Path $androidDir "assets"
$resDir = Join-Path $androidDir "res"
$buildDir = Join-Path $androidDir "build"

$sdkRoot = if ($env:ANDROID_SDK_ROOT) {
  $env:ANDROID_SDK_ROOT
} elseif ($env:ANDROID_HOME) {
  $env:ANDROID_HOME
} else {
  Join-Path $env:LOCALAPPDATA "Android\Sdk"
}

if (-not (Test-Path $sdkRoot)) {
  throw "Android SDK not found. Set ANDROID_SDK_ROOT or ANDROID_HOME. Current: $sdkRoot"
}

# Find build-tools with apksigner (try latest first, then fallback)
$buildToolsDirInfo = $null
$buildToolsVersions = Get-ChildItem -Path (Join-Path $sdkRoot "build-tools") -Directory -ErrorAction SilentlyContinue | Sort-Object -Property @{ Expression = { Get-VersionObject $_.Name }; Descending = $true }
foreach ($ver in $buildToolsVersions) {
  if ((Test-Path (Join-Path $ver.FullName "apksigner.exe")) -or (Test-Path (Join-Path $ver.FullName "apksigner.bat"))) {
    $buildToolsDirInfo = $ver
    break
  }
}
if (-not $buildToolsDirInfo) {
  throw "No build-tools with apksigner found under $sdkRoot\build-tools"
}

$platformDirInfo = Resolve-LatestDirectory -BasePath (Join-Path $sdkRoot "platforms") -Filter "android-*"
if (-not $platformDirInfo) {
  throw "No platforms found under $sdkRoot\platforms"
}

$buildToolsDir = $buildToolsDirInfo.FullName
$androidJar = Join-Path $platformDirInfo.FullName "android.jar"

if (-not (Test-Path $androidJar)) {
  throw "Missing android.jar at $androidJar"
}

$aapt = Resolve-ToolPath @(
  (Join-Path $buildToolsDir "aapt.exe"),
  (Join-Path $buildToolsDir "aapt")
)
$d8 = Resolve-ToolPath @(
  (Join-Path $buildToolsDir "d8.bat"),
  (Join-Path $buildToolsDir "d8.cmd"),
  (Join-Path $buildToolsDir "d8")
)
$zipalign = Resolve-ToolPath @(
  (Join-Path $buildToolsDir "zipalign.exe"),
  (Join-Path $buildToolsDir "zipalign")
)
$apksigner = Resolve-ToolPath @(
  (Join-Path $buildToolsDir "apksigner.exe"),
  (Join-Path $buildToolsDir "apksigner.bat"),
  (Join-Path $buildToolsDir "apksigner.cmd"),
  (Join-Path $buildToolsDir "apksigner")
)

if (-not $aapt -or -not $d8 -or -not $zipalign -or -not $apksigner) {
  throw "Missing required Android build tools under $buildToolsDir"
}

& (Join-Path $androidDir "sync-web-assets.ps1")

if (Test-Path $buildDir) {
  Remove-Item -Recurse -Force $buildDir
}

$classesDir = Join-Path $buildDir "classes"
$dexDir = Join-Path $buildDir "dex"
$outDir = Join-Path $buildDir "out"

New-Item -ItemType Directory -Path $classesDir -Force | Out-Null
New-Item -ItemType Directory -Path $dexDir -Force | Out-Null
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$javaFiles = Get-ChildItem -Path $srcDir -Recurse -Filter "*.java" | ForEach-Object { $_.FullName }
if (-not $javaFiles) {
  throw "No Java source files found under $srcDir"
}

Write-Host "Compiling Java sources..."
Write-Host "  Source: $javaFiles"
$javacArgs = @(
  "-source", "8",
  "-target", "8",
  "-classpath", $androidJar,
  "-d", $classesDir
) + $javaFiles
Invoke-External -FilePath "javac" -Arguments $javacArgs

$classesJar = Join-Path $buildDir "classes.jar"
Write-Host "Packaging classes.jar..."
Invoke-External -FilePath "jar" -Arguments @("--create", "--file", $classesJar, "-C", $classesDir, ".")

Write-Host "Converting classes -> dex..."
Invoke-External -FilePath $d8 -Arguments @("--lib", $androidJar, "--output", $dexDir, $classesJar)

$unsignedApk = Join-Path $outDir "expense-tracker-unsigned.apk"
$alignedApk = Join-Path $outDir "expense-tracker-aligned.apk"
$signedApk = Join-Path $outDir "expense-tracker-debug.apk"

Write-Host "Packaging resources and assets..."
Invoke-External -FilePath $aapt -Arguments @(
  "package",
  "-f",
  "-M", $manifestPath,
  "-S", $resDir,
  "-I", $androidJar,
  "-A", $assetsDir,
  "-F", $unsignedApk
)

Write-Host "Adding classes.dex..."
Invoke-External -FilePath "jar" -Arguments @("uf", $unsignedApk, "-C", $dexDir, "classes.dex")

Write-Host "Zipalign..."
Invoke-External -FilePath $zipalign -Arguments @("-f", "4", $unsignedApk, $alignedApk)

$debugKeystore = Join-Path $androidDir ".keystore\debug.keystore"
if (-not (Test-Path $debugKeystore)) {
  New-Item -ItemType Directory -Path (Split-Path -Parent $debugKeystore) -Force | Out-Null
  Invoke-External -FilePath "keytool" -Arguments @(
    "-genkeypair",
    "-v",
    "-keystore", $debugKeystore,
    "-storepass", "android",
    "-alias", "androiddebugkey",
    "-keypass", "android",
    "-dname", "CN=Android Debug,O=Android,C=US",
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000"
  )
}

Write-Host "Signing APK..."
Invoke-External -FilePath $apksigner -Arguments @(
  "sign",
  "--ks", $debugKeystore,
  "--ks-pass", "pass:android",
  "--key-pass", "pass:android",
  "--out", $signedApk,
  $alignedApk
)

Invoke-External -FilePath $apksigner -Arguments @("verify", $signedApk)

Write-Host "APK built: $signedApk"
