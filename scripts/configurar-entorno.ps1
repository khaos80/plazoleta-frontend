#Requires -Version 7.0
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$dir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Plazoleta'
$path = Join-Path $dir 'entorno.local.json'
$names = @('DB_USERNAME','DB_PASSWORD','JWT_PRIVATE_KEY','JWT_PUBLIC_KEY','INTERNAL_SERVICE_TOKEN')
if (-not (Test-Path -LiteralPath $path)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $rsa = [System.Security.Cryptography.RSA]::Create(2048)
    try {
        $config = [ordered]@{
            DB_USERNAME = 'plazoleta_app'
            DB_PASSWORD = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
            JWT_PRIVATE_KEY = [Convert]::ToBase64String($rsa.ExportPkcs8PrivateKey())
            JWT_PUBLIC_KEY = [Convert]::ToBase64String($rsa.ExportSubjectPublicKeyInfo())
            INTERNAL_SERVICE_TOKEN = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
        }
        # CreateNew prevents overwriting an existing configuration.
        $stream = [System.IO.File]::Open($path, [System.IO.FileMode]::CreateNew)
        try {
            $writer = [System.IO.StreamWriter]::new($stream)
            try { $writer.Write(($config | ConvertTo-Json)) } finally { $writer.Dispose() }
        } finally { $stream.Dispose() }
        Write-Host 'Configuracion local generada.'
    } finally { $rsa.Dispose() }
} else { Write-Host 'Reutilizando configuracion local existente.' }
$config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json -AsHashtable
foreach ($name in $names) {
    if ([string]::IsNullOrWhiteSpace([string]$config[$name])) { throw "Configuracion incompleta: $name. No se regeneraran las claves automaticamente." }
}
$rsa = [System.Security.Cryptography.RSA]::Create()
try {
    $read = 0
    $rsa.ImportPkcs8PrivateKey([Convert]::FromBase64String($config.JWT_PRIVATE_KEY), [ref]$read)
    if ([Convert]::ToBase64String($rsa.ExportSubjectPublicKeyInfo()) -cne $config.JWT_PUBLIC_KEY) { throw 'Las claves RSA no corresponden al mismo par.' }
} finally { $rsa.Dispose() }
if ($config.INTERNAL_SERVICE_TOKEN.Length -lt 32) { throw 'Token interno demasiado corto.' }
foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, [string]$config[$name], 'Process') }
Write-Host "Configuracion cargada desde: $path"
foreach ($name in $names) { Write-Host "${name}: configurada" }
