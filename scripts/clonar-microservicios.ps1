#Requires -Version 7.0

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

# ============================================================
# 1. VERIFICAR GIT
# ============================================================

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git no esta instalado o no se encuentra en el PATH.'
}

git --version

# ============================================================
# 2. DEFINIR DIRECTORIO PRINCIPAL
# ============================================================

$frontend = Split-Path $PSScriptRoot -Parent
$workspace = Split-Path $frontend -Parent

Write-Host "Directorio principal: $workspace"

# ============================================================
# 3. DEFINIR REPOSITORIOS
# ============================================================

$repositorios = [ordered]@{
    'user-service' = 'https://github.com/khaos80/user-service.git'
    'restaurant-service' = 'https://github.com/khaos80/restaurant-service.git'
    'dish-service' = 'https://github.com/khaos80/dish-service.git'
    'order-service' = 'https://github.com/khaos80/order-service.git'
}

# ============================================================
# 4. CLONAR MICROSERVICIOS
# ============================================================

foreach ($repo in $repositorios.GetEnumerator()) {

    $nombre = $repo.Key
    $url = $repo.Value
    $destino = Join-Path $workspace $nombre

    Write-Host ''
    Write-Host "Verificando: $nombre"

    if (Test-Path -LiteralPath $destino) {

        if (-not (Test-Path -LiteralPath (Join-Path $destino '.git'))) {
            throw "El directorio $destino existe, pero no es un repositorio Git valido."
        }

        $remote = git -C $destino remote get-url origin

        if ($LASTEXITCODE -ne 0) {
            throw "No se pudo verificar el origen de $nombre."
        }

        if (($remote -replace '\.git$', '') -ne ($url -replace '\.git$', '')) {
            throw "El repositorio $nombre tiene un origen diferente al esperado."
        }

        if (-not (Test-Path -LiteralPath (Join-Path $destino 'pom.xml'))) {
            throw "No se encontro el pom.xml de $nombre."
        }

        Write-Host "Repositorio existente: $nombre" `
            -ForegroundColor Green

        Write-Host 'Se conservaran los archivos y cambios locales.'

        continue
    }

    Write-Host "Clonando $nombre..."

    git clone --branch main -- $url $destino

    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo clonar $nombre."
    }

    if (-not (Test-Path -LiteralPath (Join-Path $destino 'pom.xml'))) {
        throw "El repositorio clonado no contiene pom.xml: $nombre"
    }

    Write-Host "Repositorio clonado: $nombre" `
        -ForegroundColor Green
}

# ============================================================
# 5. VALIDACION FINAL
# ============================================================

Write-Host ''
Write-Host '====================================================' `
    -ForegroundColor Green

Write-Host 'REPOSITORIOS VERIFICADOS CORRECTAMENTE' `
    -ForegroundColor Green

Write-Host '====================================================' `
    -ForegroundColor Green

Write-Host 'Microservicios disponibles: 4'
Write-Host "Directorio principal: $workspace"
Write-Host 'No se modificaron los repositorios existentes.'