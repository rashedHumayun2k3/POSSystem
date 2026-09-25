$ErrorActionPreference = 'Stop'
$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
$adbPath = if ($adbCommand) { $adbCommand.Source } else { Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe' }
if (-not (Test-Path -LiteralPath $adbPath)) { throw 'Install Android SDK Platform Tools first.' }
& $adbPath reverse tcp:5018 tcp:5018
if ($LASTEXITCODE -ne 0) { throw 'Unlock your phone, enable USB debugging, and authorize this computer.' }
Write-Host 'USB backend forwarding enabled: phone localhost:5018 -> computer localhost:5018'
try {
    $response = Invoke-WebRequest 'http://127.0.0.1:5018/api/v1/health' -UseBasicParsing -TimeoutSec 10
    Write-Host "Backend health: $($response.StatusCode)"
} catch {
    Write-Host 'Start the backend from the repository root: dotnet run --project backend/src/ResellerApi --launch-profile http'
}
