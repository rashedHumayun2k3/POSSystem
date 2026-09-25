$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    $trustStore = Join-Path (Resolve-Path '..').Path '.tmp/android-trust/cacerts'
    if (Test-Path -LiteralPath $trustStore) { $env:JAVA_TOOL_OPTIONS = "-Djavax.net.ssl.trustStore=$trustStore -Djavax.net.ssl.trustStorePassword=changeit" }
    $env:EXPO_OFFLINE = '1'
    & npx.cmd expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Android project generation failed.' }
    Push-Location android
    try {
        & .\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'APK build failed.' }
    } finally { Pop-Location }
    New-Item -ItemType Directory -Path dist -Force | Out-Null
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination 'dist/LavLokshan-usb.apk' -Force
    Write-Host 'APK: mobile/dist/LavLokshan-usb.apk (local testing, development signing key)'
} finally { Pop-Location }

