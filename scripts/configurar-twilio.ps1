#Requires -Version 7.0
param([switch]$Reconfigurar)
$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'Este script requiere Windows.' }
$directorio = Join-Path $env:LOCALAPPDATA 'Plazoleta'
$ruta = Join-Path $directorio 'twilio.local.json'
New-Item -ItemType Directory -Path $directorio -Force | Out-Null
if ($Reconfigurar -or -not (Test-Path -LiteralPath $ruta)) {
    $sid = Read-Host 'Account SID de Twilio'
    if ($sid -cnotmatch '^AC[0-9a-fA-F]{32}$') { throw 'Account SID invalido.' }
    $seguro = Read-Host 'Auth Token de Twilio' -AsSecureString
    $token = [System.Net.NetworkCredential]::new('', $seguro).Password
    if ($token -notmatch '^[0-9a-fA-F]{32}$') { throw 'Auth Token invalido.' }
    $config = [ordered]@{
        TWILIO_ACCOUNT_SID = $sid
        AuthTokenCifrado = (ConvertFrom-SecureString -SecureString $seguro)
        TWILIO_FROM_NUMBER = '+18142818257'
        SMS_PROVEEDOR = 'twilio'
    }
    $config | ConvertTo-Json | Set-Content -LiteralPath $ruta -Encoding utf8
    Write-Host 'Configuracion de Twilio guardada.'
} else {
    Write-Host 'Reutilizando configuracion de Twilio existente.'
}
$config = Get-Content -LiteralPath $ruta -Raw | ConvertFrom-Json
$seguro = ConvertTo-SecureString -String $config.AuthTokenCifrado
$token = [System.Net.NetworkCredential]::new('', $seguro).Password
if ($config.TWILIO_ACCOUNT_SID -cnotmatch '^AC[0-9a-fA-F]{32}$' -or $token -notmatch '^[0-9a-fA-F]{32}$' -or $config.TWILIO_FROM_NUMBER -notmatch '^\+[1-9][0-9]{7,14}$' -or $config.SMS_PROVEEDOR -ne 'twilio') { throw 'Configuracion de Twilio invalida.' }
$env:TWILIO_ACCOUNT_SID = $config.TWILIO_ACCOUNT_SID
$env:TWILIO_AUTH_TOKEN = $token
$env:TWILIO_FROM_NUMBER = $config.TWILIO_FROM_NUMBER
$env:SMS_PROVEEDOR = $config.SMS_PROVEEDOR
Remove-Variable token, seguro
Write-Host 'Variables de Twilio cargadas en la sesion actual.'
Write-Host 'TWILIO_ACCOUNT_SID: configurada'
Write-Host 'TWILIO_AUTH_TOKEN: configurada'
Write-Host 'TWILIO_FROM_NUMBER: configurada'
Write-Host 'SMS_PROVEEDOR: twilio'
