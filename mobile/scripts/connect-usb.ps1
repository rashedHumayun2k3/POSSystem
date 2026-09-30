$ErrorActionPreference = 'Stop'
$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
$adbPath = if ($adbCommand) { $adbCommand.Source } else { Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe' }
if (-not (Test-Path -LiteralPath $adbPath)) { throw 'Install Android SDK Platform Tools first.' }
& $adbPath reverse tcp:5018 tcp:5018
if ($LASTEXITCODE -ne 0) { throw 'Unlock your phone, enable USB debugging, and authorize this computer.' }
& $adbPath reverse tcp:5090 tcp:5090
if ($LASTEXITCODE -ne 0) { throw 'Could not forward the media service port 5090.' }
Write-Host 'USB forwarding enabled: phone localhost:5018 -> computer localhost:5018'
Write-Host 'USB forwarding enabled: phone localhost:5090 -> computer localhost:5090'
try {
    $response = Invoke-WebRequest 'http://127.0.0.1:5018/api/v1/health' -UseBasicParsing -TimeoutSec 10
    Write-Host "Backend health: $($response.StatusCode)"
} catch {
    Write-Host 'Start the backend from the repository root: dotnet run --project backend/src/ResellerApi --launch-profile http'
}
try {
    $response = Invoke-WebRequest 'http://127.0.0.1:5090/api/v1/health' -UseBasicParsing -TimeoutSec 10
    Write-Host "Media service health: $($response.StatusCode)"
} catch {
    Write-Host 'Start ResellerApi.MediaService on http://localhost:5090 in Visual Studio to enable image uploads.'
}
