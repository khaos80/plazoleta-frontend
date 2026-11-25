
#Requires -Version 7.5

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

# ============================================================
# 1. DIRECTORIOS Y REGISTRO DE PROCESOS
# ============================================================

$localDir = Join-Path $env:LOCALAPPDATA 'Plazoleta'
$procesosFile = Join-Path $localDir 'procesos.local.json'
$logsDir = Join-Path $localDir 'logs'

$detenidos = 0
$inactivos = 0
$omitidos = 0

$pendientes = [System.Collections.Generic.List[object]]::new()

Write-Host ''
Write-Host '====================================================' `
    -ForegroundColor Cyan

Write-Host 'DETENIENDO PROYECTO PLAZOLETA' `
    -ForegroundColor Cyan

Write-Host '====================================================' `
    -ForegroundColor Cyan

# ============================================================
# 2. VERIFICAR REGISTRO DE PROCESOS
# ============================================================

if (-not (Test-Path -LiteralPath $procesosFile)) {

    Write-Host 'No existen procesos registrados del proyecto.' `
        -ForegroundColor Yellow

    Write-Host 'No se detendra ningun proceso del equipo.'

    return
}

$registros = @(
    Get-Content `
        -LiteralPath $procesosFile `
        -Raw |
        ConvertFrom-Json -DateKind String
)

if ($registros.Count -eq 0) {

    Write-Host 'No hay procesos registrados para detener.'

    return
}

$serviciosPermitidos = @{
    'user-service' = 8081
    'restaurant-service' = 8082
    'dish-service' = 8083
    'order-service' = 8084
    'plazoleta-frontend' = 4200
}

# ============================================================
# 3. DETENER PROCESOS EN ORDEN INVERSO
# ============================================================

for ($i = $registros.Count - 1; $i -ge 0; $i--) {

    $registro = $registros[$i]

    $nombre = [string]$registro.Nombre
    $puerto = $registro.Puerto

    Write-Host ''
    Write-Host "Verificando: $nombre"

    # --------------------------------------------------------
    # VALIDAR QUE EL SERVICIO PERTENECE AL PROYECTO
    # --------------------------------------------------------

    if (
        -not $serviciosPermitidos.ContainsKey($nombre) -or
        $serviciosPermitidos[$nombre] -ne $puerto
    ) {

        Write-Warning "Registro desconocido: $nombre. No se detendra."

        $pendientes.Add($registro)
        $omitidos++

        continue
    }

    $procesoId = 0

    if (
        -not [int]::TryParse(
            [string]$registro.PID,
            [ref]$procesoId
        ) -or
        $procesoId -le 0
    ) {

        Write-Warning "PID invalido para $nombre."

        $pendientes.Add($registro)
        $omitidos++

        continue
    }

    # --------------------------------------------------------
    # VERIFICAR EXISTENCIA DEL PROCESO
    # --------------------------------------------------------

    $proceso = Get-Process `
        -Id $procesoId `
        -ErrorAction SilentlyContinue

    if (-not $proceso) {

        Write-Host "$nombre ya se encuentra detenido." `
            -ForegroundColor Yellow

        $inactivos++

        continue
    }

    try {

        # ----------------------------------------------------
        # VERIFICAR IDENTIDAD DEL PROCESO
        # ----------------------------------------------------

        $inicioActual = $proceso.StartTime.
            ToUniversalTime().
            ToString('o')

        if ($inicioActual -cne [string]$registro.Inicio) {

            Write-Warning "El PID $procesoId pertenece a otro proceso."

            Write-Host 'No se detendra este proceso.'

            $omitidos++

            continue
        }

        $ejecutableEsperado = if (
            $nombre -eq 'plazoleta-frontend'
        ) {
            'node'
        }
        else {
            'java'
        }

        if ($proceso.ProcessName -ne $ejecutableEsperado) {

            Write-Warning "Ejecutable inesperado para $nombre."

            $pendientes.Add($registro)
            $omitidos++

            continue
        }

        # ----------------------------------------------------
        # DETENER PROCESO Y SUS PROCESOS HIJOS
        # ----------------------------------------------------

        Write-Host "Deteniendo $nombre (PID: $procesoId)..."

        & taskkill.exe /PID $procesoId /T /F 2>&1 |
            Out-Null

        $codigoSalida = $LASTEXITCODE

        if ($codigoSalida -ne 0) {

            $proceso.Refresh()

            if (-not $proceso.HasExited) {

                throw "taskkill devolvio codigo $codigoSalida."
            }
        }

        if (-not $proceso.WaitForExit(10000)) {

            throw 'El proceso no finalizo dentro del tiempo esperado.'
        }

        Write-Host "Proceso detenido: $nombre" `
            -ForegroundColor Green

        $detenidos++
    }
    catch {

        Write-Warning "No se pudo detener $nombre."

        Write-Warning $_.Exception.Message

        $pendientes.Add($registro)
        $omitidos++
    }
    finally {

        $proceso.Dispose()
    }
}

# ============================================================
# 4. ACTUALIZAR REGISTRO DE PROCESOS
# ============================================================

if ($pendientes.Count -eq 0) {

    Remove-Item `
        -LiteralPath $procesosFile `
        -Force

    Write-Host ''
    Write-Host 'Registro de procesos eliminado correctamente.' `
        -ForegroundColor Green
}
else {

    $registrosPendientes = $pendientes.ToArray()

    [array]::Reverse($registrosPendientes)

    ConvertTo-Json `
        -InputObject @($registrosPendientes) `
        -Depth 5 |
        Set-Content `
            -LiteralPath $procesosFile `
            -Encoding utf8

    Write-Warning 'Se conservaron los registros pendientes.'
}

# ============================================================
# 5. VERIFICAR LIBERACION DE PUERTOS
# ============================================================

Write-Host ''
Write-Host 'VERIFICANDO PUERTOS DEL PROYECTO' `
    -ForegroundColor Cyan

Start-Sleep -Seconds 2

$puertosOcupados = @()

foreach ($puerto in @(4200, 8084, 8083, 8082, 8081)) {

    $conexion = Get-NetTCPConnection `
        -LocalPort $puerto `
        -State Listen `
        -ErrorAction SilentlyContinue

    if ($conexion) {

        Write-Warning "Puerto $puerto permanece ocupado."

        $puertosOcupados += $puerto
    }
    else {

        Write-Host "Puerto $puerto liberado." `
            -ForegroundColor Green
    }
}

# ============================================================
# 6. VERIFICAR MYSQL
# ============================================================

$mysqlActivo = Get-NetTCPConnection `
    -LocalPort 3306 `
    -State Listen `
    -ErrorAction SilentlyContinue

if ($mysqlActivo) {

    Write-Host 'MySQL permanece activo en el puerto 3306.' `
        -ForegroundColor Green
}
else {

    Write-Warning 'No se detecto MySQL en el puerto 3306.'
}

# ============================================================
# 7. RESULTADO FINAL
# ============================================================

Write-Host ''
Write-Host '====================================================' `
    -ForegroundColor Cyan

if (
    $pendientes.Count -eq 0 -and
    $puertosOcupados.Count -eq 0
) {

    Write-Host 'PROYECTO DETENIDO CORRECTAMENTE' `
        -ForegroundColor Green
}
else {

    Write-Host 'DETENCION FINALIZADA CON ADVERTENCIAS' `
        -ForegroundColor Yellow
}

Write-Host '====================================================' `
    -ForegroundColor Cyan

Write-Host "Procesos detenidos: $detenidos"
Write-Host "Procesos previamente inactivos: $inactivos"
Write-Host "Procesos omitidos: $omitidos"
Write-Host "Registros pendientes: $($pendientes.Count)"
Write-Host "Puertos ocupados: $($puertosOcupados.Count)"

Write-Host ''
Write-Host 'Las bases de datos no fueron modificadas.'
Write-Host 'El servicio MySQL no fue detenido.'
Write-Host 'Las configuraciones locales se conservaron.'
Write-Host "Logs disponibles en: $logsDir"

if (
    $pendientes.Count -gt 0 -or
    $puertosOcupados.Count -gt 0
) {

    throw 'La detencion requiere una revision adicional.'
}
