$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot'
    $env:NODE_ENV = 'production'
    $installedAndroidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    $localAndroidSdk = Join-Path (Resolve-Path '..').Path '.tmp/android-sdk'
    New-Item -ItemType Directory -Path $localAndroidSdk -Force | Out-Null
    if (-not (Test-Path -LiteralPath (Join-Path $localAndroidSdk 'licenses'))) {
        Copy-Item -LiteralPath (Join-Path $installedAndroidSdk 'licenses') -Destination (Join-Path $localAndroidSdk 'licenses') -Recurse
    }
    foreach ($sdkPart in @('platforms', 'platform-tools')) {
        $localPart = Join-Path $localAndroidSdk $sdkPart
        if (-not (Test-Path -LiteralPath $localPart)) {
            New-Item -ItemType Junction -Path $localPart -Target (Join-Path $installedAndroidSdk $sdkPart) | Out-Null
        }
    }
    $env:ANDROID_HOME = $localAndroidSdk
    $env:GRADLE_USER_HOME = Join-Path (Resolve-Path '..').Path '.tmp/gradle'
    $env:ANDROID_USER_HOME = Join-Path (Resolve-Path '..').Path '.tmp/android-home'
    $env:GRADLE_OPTS = "-Duser.home=$((Resolve-Path '..').Path) -Dkotlin.compiler.execution.strategy=in-process"
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

