$ErrorActionPreference = "Stop"

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

function Resolve-AdbPath {
  $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
  if ($adbCommand) {
    return $adbCommand.Source
  }

  $sdkRoot = if ($env:ANDROID_SDK_ROOT) {
    $env:ANDROID_SDK_ROOT
  } elseif ($env:ANDROID_HOME) {
    $env:ANDROID_HOME
  } else {
    Join-Path $env:LOCALAPPDATA "Android\Sdk"
  }

  $sdkAdb = Join-Path $sdkRoot "platform-tools\adb.exe"
  if (Test-Path $sdkAdb) {
    return $sdkAdb
  }

  return $null
}

$apkPath = Join-Path $PSScriptRoot "build\out\expense-tracker-debug.apk"
if (-not (Test-Path $apkPath)) {
  throw "APK not found: $apkPath. Run npm run android:build first."
}

$adbPath = Resolve-AdbPath
if (-not $adbPath) {
  throw "adb not found. Install Android platform-tools and add adb to PATH."
}

Invoke-External -FilePath $adbPath -Arguments @("devices")
Invoke-External -FilePath $adbPath -Arguments @("install", "-r", $apkPath)

Write-Host "Installed: $apkPath"
