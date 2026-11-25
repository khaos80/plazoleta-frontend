
#Requires -Version 7.0

[CmdletBinding()]
param(
    [switch]$EjecutarPruebas,
    [switch]$OmitirCompilacion,
    [switch]$NoAbrirNavegador,
    [switch]$ReconfigurarAdministrador,
    [switch]$OmitirAdministrador
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

# ============================================================
# 1. DIRECTORIOS DEL PROYECTO
# ============================================================

$frontend = Split-Path $PSScriptRoot -Parent
$workspace = Split-Path $frontend -Parent

$localDir = Join-Path $env:LOCALAPPDATA 'Plazoleta'
$logsDir = Join-Path $localDir 'logs'
$procesosFile = Join-Path $localDir 'procesos.local.json'
$adminFile = Join-Path $localDir 'administrador.local.json'

New-Item -ItemType Directory -Path $localDir -Force | Out-Null
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

$procesos = [System.Collections.Generic.List[object]]::new()

$servicios = @(
    @{ Nombre = 'user-service'; Puerto = 8081 },
    @{ Nombre = 'restaurant-service'; Puerto = 8082 },
    @{ Nombre = 'dish-service'; Puerto = 8083 },
    @{ Nombre = 'order-service'; Puerto = 8084 }
)

if ($OmitirAdministrador -and $ReconfigurarAdministrador) {
    throw 'No puede omitir y reconfigurar el administrador simultaneamente.'
}

if ($EjecutarPruebas -and $OmitirCompilacion) {
    throw 'No puede ejecutar pruebas y omitir la compilacion simultaneamente.'
}

# ============================================================
# 2. FUNCIONES AUXILIARES
# ============================================================

function Show-Seccion {

    param([string]$Titulo)

    Write-Host ''
    Write-Host '====================================================' `
        -ForegroundColor Cyan

    Write-Host $Titulo -ForegroundColor Cyan

    Write-Host '====================================================' `
        -ForegroundColor Cyan
}

function Save-Procesos {

    ConvertTo-Json `
        -InputObject @($procesos.ToArray()) `
        -Depth 5 |
        Set-Content -LiteralPath $procesosFile -Encoding utf8
}

# ------------------------------------------------------------
# VERIFICAR PUERTOS IPV4 E IPV6
# ------------------------------------------------------------

function Test-Puerto {

    param([int]$Puerto)

    foreach ($direccion in @('127.0.0.1', '::1')) {

        $ip = [System.Net.IPAddress]::Parse($direccion)

        $cliente = [System.Net.Sockets.TcpClient]::new(
            $ip.AddressFamily
        )

        try {

            $conexion = $cliente.ConnectAsync($ip, $Puerto)

            if ($conexion.Wait(1000) -and $cliente.Connected) {

                return $true
            }
        }
        catch {

            # Intentar con la siguiente direccion.
        }
        finally {

            $cliente.Dispose()
        }
    }

    return $false
}

function Register-Proceso {

    param(
        [string]$Nombre,
        [int]$Puerto,
        [System.Diagnostics.Process]$Proceso
    )

    $procesos.Add(
        [PSCustomObject]@{
            Nombre = $Nombre
            Puerto = $Puerto
            PID = $Proceso.Id
            Inicio = $Proceso.StartTime.ToUniversalTime().ToString('o')
        }
    )

    Save-Procesos
}

function Wait-Servicio {

    param(
        [string]$Nombre,
        [int]$Puerto,
        [System.Diagnostics.Process]$Proceso,
        [int]$Timeout = 180
    )

    $limite = (Get-Date).AddSeconds($Timeout)

    Write-Host "Esperando disponibilidad de $Nombre..."

    while ((Get-Date) -lt $limite) {

        $Proceso.Refresh()

        if ($Proceso.HasExited) {

            throw "$Nombre finalizo inesperadamente. Revise los logs."
        }

        if (Test-Puerto -Puerto $Puerto) {

            Start-Sleep -Seconds 3

            $Proceso.Refresh()

            if ($Proceso.HasExited) {

                throw "$Nombre finalizo durante su inicializacion."
            }

            Write-Host "$Nombre disponible en puerto $Puerto." `
                -ForegroundColor Green

            return
        }

        Start-Sleep -Seconds 2
    }

    throw "Tiempo de espera agotado para $Nombre."
}

function Stop-ProcesosIniciados {

    for ($i = $procesos.Count - 1; $i -ge 0; $i--) {

        $registro = $procesos[$i]

        $proceso = Get-Process `
            -Id $registro.PID `
            -ErrorAction SilentlyContinue

        if ($proceso) {

            try {

                $inicio = $proceso.StartTime.
                    ToUniversalTime().
                    ToString('o')

                if ($inicio -eq $registro.Inicio) {

                    & taskkill.exe /PID $registro.PID /T /F |
                        Out-Null

                    if ($LASTEXITCODE -eq 0) {

                        Write-Host "Proceso detenido: $($registro.Nombre)"
                    }
                    else {

                        Write-Warning "No se pudo detener $($registro.Nombre)."
                    }
                }
            }
            catch {

                Write-Warning "No se pudo verificar o detener $($registro.Nombre)."
            }
        }
    }
}

function Read-CampoAdministrador {

    param(
        [string]$Etiqueta,
        [string]$Patron,
        [string]$MensajeError
    )

    while ($true) {

        $valor = (Read-Host $Etiqueta).Trim()

        if (
            -not [string]::IsNullOrWhiteSpace($valor) -and
            $valor -cmatch $Patron
        ) {

            return $valor
        }

        Write-Host $MensajeError -ForegroundColor Yellow
    }
}

# ============================================================
# 3. VERIFICAR REQUISITOS
# ============================================================

Show-Seccion 'VERIFICANDO REQUISITOS'

foreach ($comando in @('git', 'java.exe', 'node.exe', 'npm.cmd')) {

    if (-not (Get-Command $comando -ErrorAction SilentlyContinue)) {

        throw "No se encontro el comando requerido: $comando"
    }

    Write-Host "Disponible: $comando" -ForegroundColor Green
}

$javaExe = (Get-Command java.exe).Source
$nodeExe = (Get-Command node.exe).Source
$npmExe = (Get-Command npm.cmd).Source

$javaVersion = & $javaExe -version 2>&1 | Out-String

if ($javaVersion -notmatch 'version "21(?:\.|")') {

    throw 'El proyecto requiere Java 21.'
}

if (
    [string]::IsNullOrWhiteSpace($env:JAVA_HOME) -or
    -not (Test-Path (Join-Path $env:JAVA_HOME 'bin\javac.exe'))
) {

    throw 'JAVA_HOME no apunta a un JDK valido.'
}

$nodeVersion = & $nodeExe --version

if ($nodeVersion -notmatch '^v24\.') {

    throw 'Para esta instalacion se requiere Node.js 24.'
}

Write-Host 'Java 21: correcto.' -ForegroundColor Green
Write-Host "Node.js: $nodeVersion" -ForegroundColor Green

# ============================================================
# 4. VERIFICAR PROCESOS Y PUERTOS
# ============================================================

Show-Seccion 'VERIFICANDO PUERTOS'

if (Test-Path -LiteralPath $procesosFile) {

    $anteriores = Get-Content `
        -LiteralPath $procesosFile `
        -Raw | ConvertFrom-Json -DateKind String

    foreach ($registro in $anteriores) {

        $proceso = Get-Process `
            -Id $registro.PID `
            -ErrorAction SilentlyContinue

        if ($proceso) {

            $inicio = $proceso.StartTime.
                ToUniversalTime().
                ToString('o')

            if ($inicio -eq $registro.Inicio) {

                throw 'Existen procesos registrados del proyecto. Detengalos antes de continuar.'
            }
        }
    }
}

foreach ($puerto in @(8081, 8082, 8083, 8084, 4200)) {

    $ocupado = Get-NetTCPConnection `
        -LocalPort $puerto `
        -State Listen `
        -ErrorAction SilentlyContinue

    if ($ocupado) {

        throw "El puerto $puerto se encuentra ocupado."
    }

    Write-Host "Puerto $puerto disponible." -ForegroundColor Green
}

# ============================================================
# 5. CLONAR O VERIFICAR MICROSERVICIOS
# ============================================================

Show-Seccion 'VERIFICANDO REPOSITORIOS'

& (Join-Path $PSScriptRoot 'clonar-microservicios.ps1')

# ============================================================
# 6. CARGAR CONFIGURACIONES
# ============================================================

Show-Seccion 'CONFIGURANDO ENTORNO'

& (Join-Path $PSScriptRoot 'configurar-entorno.ps1')

Show-Seccion 'CONFIGURANDO TWILIO'

& (Join-Path $PSScriptRoot 'configurar-twilio.ps1')

Show-Seccion 'CONFIGURANDO MYSQL'

& (Join-Path $PSScriptRoot 'configurar-mysql.ps1')

# ============================================================
# 7. CONFIGURAR ADMINISTRADOR INICIAL
# ============================================================

Show-Seccion 'CONFIGURANDO ADMINISTRADOR INICIAL'

$bootstrapHabilitado = $false
$bootstrapJson = $null

if ($OmitirAdministrador) {

    Write-Host 'Inicializacion del administrador omitida.'
}
else {

    if (
        $ReconfigurarAdministrador -or
        -not (Test-Path -LiteralPath $adminFile)
    ) {

        $crearAdministrador = $ReconfigurarAdministrador.IsPresent

        if (-not $crearAdministrador) {

            Write-Host ''
            Write-Host 'Desea configurar un administrador inicial?'
            Write-Host 'S: ingresar datos personalizados.'
            Write-Host 'N: conservar un administrador existente u omitir el bootstrap.'

            do {

                $respuesta = (Read-Host 'Seleccione S/N').Trim()

            } until ($respuesta -match '^[sSnN]$')

            $crearAdministrador = $respuesta -match '^[sS]$'
        }

        if ($crearAdministrador) {

            Write-Host ''
            Write-Host 'CONFIGURACION DEL ADMINISTRADOR INICIAL' `
                -ForegroundColor Cyan

            Write-Host 'Ingrese los datos del administrador del sistema.'
            Write-Host 'Si ya existe un administrador en MySQL, no sera modificado.'
            Write-Host ''

            # ------------------------------------------------
            # DATOS PERSONALES
            # ------------------------------------------------

            $nombre = Read-CampoAdministrador `
                -Etiqueta 'Nombre' `
                -Patron '^.{1,50}$' `
                -MensajeError 'Ingrese un nombre valido de hasta 50 caracteres.'

            $apellido = Read-CampoAdministrador `
                -Etiqueta 'Apellido' `
                -Patron '^.{1,50}$' `
                -MensajeError 'Ingrese un apellido valido de hasta 50 caracteres.'

            $documento = Read-CampoAdministrador `
                -Etiqueta 'Documento de identidad' `
                -Patron '^[0-9]+$' `
                -MensajeError 'El documento debe contener solamente numeros.'

            # ------------------------------------------------
            # CELULAR COLOMBIANO
            # ------------------------------------------------

            $celular = Read-CampoAdministrador `
                -Etiqueta 'Celular' `
                -Patron '^(?:\+57)?3[0-9]{9}$' `
                -MensajeError 'Ingrese un celular colombiano valido, con o sin +57.'

            # ------------------------------------------------
            # FECHA DE NACIMIENTO
            # ------------------------------------------------

            while ($true) {

                $fechaNacimiento = Read-Host `
                    'Fecha de nacimiento (AAAA-MM-DD)'

                $fecha = [datetime]::MinValue

                $fechaValida = [datetime]::TryParseExact(
                    $fechaNacimiento,
                    'yyyy-MM-dd',
                    [System.Globalization.CultureInfo]::InvariantCulture,
                    [System.Globalization.DateTimeStyles]::None,
                    [ref]$fecha
                )

                if (
                    $fechaValida -and
                    $fecha.Date -le (Get-Date).Date.AddYears(-18)
                ) {

                    break
                }

                Write-Host `
                    'Ingrese una fecha valida. El administrador debe ser mayor de edad.' `
                    -ForegroundColor Yellow
            }

            # ------------------------------------------------
            # CORREO ELECTRONICO
            # ------------------------------------------------

            $correo = Read-CampoAdministrador `
                -Etiqueta 'Correo electronico' `
                -Patron '^[^@\s]+@[^@\s]+\.[^@\s]+$' `
                -MensajeError 'Ingrese un correo electronico valido.'

            # ------------------------------------------------
            # CONTRASENA
            # ------------------------------------------------

            while ($true) {

                $contrasena = Read-Host `
                    'Contrasena del administrador' `
                    -MaskInput

                if (
                    [string]::IsNullOrWhiteSpace($contrasena) -or
                    $contrasena.Length -lt 8 -or
                    [Text.Encoding]::UTF8.GetByteCount($contrasena) -gt 72
                ) {

                    Write-Host `
                        'La contrasena debe tener al menos 8 caracteres y un maximo de 72 bytes UTF-8.' `
                        -ForegroundColor Yellow

                    $contrasena = $null

                    continue
                }

                $confirmacion = Read-Host `
                    'Confirme la contrasena' `
                    -MaskInput

                if ($contrasena -cne $confirmacion) {

                    Write-Host 'Las contrasenas no coinciden.' `
                        -ForegroundColor Yellow

                    $confirmacion = $null
                    $contrasena = $null

                    continue
                }

                $confirmacion = $null

                break
            }

            # ------------------------------------------------
            # PROTEGER CONTRASENA MEDIANTE DPAPI
            # ------------------------------------------------

            $secureAdmin = ConvertTo-SecureString `
                -String $contrasena `
                -AsPlainText `
                -Force

            try {

                $contrasenaCifrada = $secureAdmin |
                    ConvertFrom-SecureString
            }
            finally {

                $secureAdmin.Dispose()
                $contrasena = $null
            }

            # ------------------------------------------------
            # GUARDAR CONFIGURACION LOCAL
            # ------------------------------------------------

            $admin = [ordered]@{
                nombre = $nombre
                apellido = $apellido
                documento = $documento
                celular = $celular
                'fecha-nacimiento' = $fechaNacimiento
                correo = $correo
                contrasenaCifrada = $contrasenaCifrada
            }

            $tempAdmin = "$adminFile.$([guid]::NewGuid()).tmp"

            try {

                $admin | ConvertTo-Json -Depth 5 |
                    Set-Content `
                        -LiteralPath $tempAdmin `
                        -Encoding utf8

                Move-Item `
                    -LiteralPath $tempAdmin `
                    -Destination $adminFile `
                    -Force
            }
            finally {

                Remove-Item `
                    -LiteralPath $tempAdmin `
                    -Force `
                    -ErrorAction SilentlyContinue
            }

            Write-Host ''
            Write-Host 'Configuracion del administrador guardada.' `
                -ForegroundColor Green

            $bootstrapHabilitado = $true
        }
        else {

            Write-Host 'No se configurara un administrador inicial.'
        }
    }
    else {

        Write-Host 'Reutilizando configuracion del administrador inicial.'

        $bootstrapHabilitado = $true
    }
}

# ------------------------------------------------------------
# CARGAR CONFIGURACION DEL ADMINISTRADOR
# ------------------------------------------------------------

if ($bootstrapHabilitado) {

    $admin = Get-Content `
        -LiteralPath $adminFile `
        -Raw | ConvertFrom-Json -AsHashtable -DateKind String

    foreach ($campo in @(
        'nombre',
        'apellido',
        'documento',
        'celular',
        'fecha-nacimiento',
        'correo',
        'contrasenaCifrada'
    )) {

        if ([string]::IsNullOrWhiteSpace([string]$admin[$campo])) {

            throw "Configuracion de administrador incompleta: $campo. Ejecute con -ReconfigurarAdministrador."
        }
    }

    $secureAdmin = ConvertTo-SecureString `
        -String $admin['contrasenaCifrada']

    try {

        $passwordAdmin = [System.Net.NetworkCredential]::new(
            '',
            $secureAdmin
        ).Password

        $bootstrapJson = @{
            bootstrap = @{
                admin = @{
                    enabled = $true
                    nombre = $admin['nombre']
                    apellido = $admin['apellido']
                    documento = $admin['documento']
                    celular = $admin['celular']
                    'fecha-nacimiento' = $admin['fecha-nacimiento']
                    correo = $admin['correo']
                    contrasena = $passwordAdmin
                }
            }
        } | ConvertTo-Json -Depth 10 -Compress
    }
    finally {

        $secureAdmin.Dispose()
        $passwordAdmin = $null
    }

    Write-Host "Correo configurado para bootstrap: $($admin['correo'])"

    Write-Host 'Configuracion de administrador preparada.' `
        -ForegroundColor Green
}
else {

    $bootstrapJson = @{
        bootstrap = @{
            admin = @{
                enabled = $false
            }
        }
    } | ConvertTo-Json -Depth 10 -Compress

    Write-Warning 'Bootstrap deshabilitado. Si no existe un administrador en MySQL, no podra iniciar sesion como administrador.'
}

# ============================================================
# 8. COMPILAR MICROSERVICIOS
# ============================================================

Show-Seccion 'COMPILANDO MICROSERVICIOS'

foreach ($servicio in $servicios) {

    $nombre = $servicio.Nombre
    $directorio = Join-Path $workspace $nombre

    $wrapper = Join-Path $directorio 'mvnw.cmd'

    if (-not (Test-Path -LiteralPath $wrapper)) {

        throw "No se encontro Maven Wrapper en $nombre."
    }

    if ($OmitirCompilacion) {

        Write-Host "Compilacion omitida: $nombre"

        continue
    }

    Write-Host "Compilando $nombre..."

    Push-Location $directorio

    try {

        if ($EjecutarPruebas) {

            & $wrapper clean package
        }
        else {

            & $wrapper clean package '-DskipTests'
        }

        if ($LASTEXITCODE -ne 0) {

            throw "Error de compilacion en $nombre."
        }

        Write-Host "Compilacion correcta: $nombre" `
            -ForegroundColor Green
    }
    finally {

        Pop-Location
    }
}

# ============================================================
# 9. LOCALIZAR ARCHIVOS JAR
# ============================================================

Show-Seccion 'LOCALIZANDO ARCHIVOS JAR'

foreach ($servicio in $servicios) {

    $target = Join-Path `
        (Join-Path $workspace $servicio.Nombre) `
        'target'

    if (-not (Test-Path -LiteralPath $target)) {

        throw "No existe el directorio target de $($servicio.Nombre)."
    }

    $jars = @(
        Get-ChildItem `
            -LiteralPath $target `
            -Filter '*.jar' `
            -File |
            Where-Object {

                $_.Name -notmatch '-(sources|javadoc|tests|plain)\.jar$'
            }
    )

    if ($jars.Count -ne 1) {

        throw "No se encontro un JAR unico para $($servicio.Nombre)."
    }

    $servicio['Jar'] = $jars[0].FullName

    Write-Host "JAR localizado: $($jars[0].Name)" `
        -ForegroundColor Green
}

# ============================================================
# 10. INSTALAR DEPENDENCIAS DEL FRONTEND
# ============================================================

Show-Seccion 'VERIFICANDO DEPENDENCIAS DE ANGULAR'

$angularCli = Join-Path `
    $frontend `
    'node_modules\@angular\cli\bin\ng.js'

if (-not (Test-Path -LiteralPath $angularCli)) {

    Push-Location $frontend

    try {

        if (-not (Test-Path 'package-lock.json')) {

            throw 'No se encontro package-lock.json.'
        }

        Write-Host 'Instalando dependencias de Angular...'

        & $npmExe ci

        if ($LASTEXITCODE -ne 0) {

            throw 'No se pudieron instalar las dependencias de Angular.'
        }
    }
    finally {

        Pop-Location
    }
}
else {

    Write-Host 'Dependencias de Angular existentes.'
}

if (-not (Test-Path -LiteralPath $angularCli)) {

    throw 'No se encontro Angular CLI local.'
}

# ============================================================
# 11. INICIAR MICROSERVICIOS
# ============================================================

try {

    Show-Seccion 'INICIANDO MICROSERVICIOS'

    Save-Procesos

    foreach ($servicio in $servicios) {

        $nombre = $servicio.Nombre
        $puerto = $servicio.Puerto
        $jar = $servicio.Jar

        $directorio = Join-Path $workspace $nombre

        $logSalida = Join-Path $logsDir "$nombre.log"
        $logError = Join-Path $logsDir "$nombre-error.log"

        $argumentos = @(
            '-Xms64m',
            '-Xmx256m',
            '-jar',
            "`"$jar`"",
            "--server.port=$puerto"
        )

        Write-Host ''
        Write-Host "Iniciando $nombre..."

        $jsonAnterior = $env:SPRING_APPLICATION_JSON

        try {

            if ($nombre -eq 'user-service') {

                $env:SPRING_APPLICATION_JSON = $bootstrapJson
            }
            else {

                Remove-Item Env:SPRING_APPLICATION_JSON `
                    -ErrorAction SilentlyContinue
            }

            $proceso = Start-Process `
                -FilePath $javaExe `
                -ArgumentList $argumentos `
                -WorkingDirectory $directorio `
                -RedirectStandardOutput $logSalida `
                -RedirectStandardError $logError `
                -WindowStyle Hidden `
                -PassThru
        }
        finally {

            if ($null -eq $jsonAnterior) {

                Remove-Item Env:SPRING_APPLICATION_JSON `
                    -ErrorAction SilentlyContinue
            }
            else {

                $env:SPRING_APPLICATION_JSON = $jsonAnterior
            }
        }

        Register-Proceso `
            -Nombre $nombre `
            -Puerto $puerto `
            -Proceso $proceso

        Wait-Servicio `
            -Nombre $nombre `
            -Puerto $puerto `
            -Proceso $proceso

        # ----------------------------------------------------
        # VERIFICAR BOOTSTRAP DEL ADMINISTRADOR
        # ----------------------------------------------------

        if (
            $nombre -eq 'user-service' -and
            $bootstrapHabilitado
        ) {

            $limiteBootstrap = (Get-Date).AddSeconds(60)
            $bootstrapCorrecto = $false

            while ((Get-Date) -lt $limiteBootstrap) {

                $proceso.Refresh()

                if ($proceso.HasExited) {

                    throw 'user-service finalizo durante el bootstrap.'
                }

                if (Test-Path -LiteralPath $logSalida) {

                    $adminExistente = Select-String `
                        -Path $logSalida `
                        -Pattern 'Bootstrap: ya existe un administrador.' `
                        -SimpleMatch `
                        -Quiet

                    $adminCreado = Select-String `
                        -Path $logSalida `
                        -Pattern 'Bootstrap: administrador inicial creado correctamente.' `
                        -SimpleMatch `
                        -Quiet

                    if ($adminExistente) {

                        Write-Host 'Se conserva el administrador existente.' `
                            -ForegroundColor Green

                        $bootstrapCorrecto = $true

                        break
                    }

                    if ($adminCreado) {

                        Write-Host 'Administrador inicial creado correctamente.' `
                            -ForegroundColor Green

                        Write-Host "Correo: $($admin['correo'])"

                        $bootstrapCorrecto = $true

                        break
                    }
                }

                Start-Sleep -Seconds 2
            }

            if (-not $bootstrapCorrecto) {

                throw 'No se pudo confirmar la inicializacion del administrador.'
            }
        }

        if ($nombre -eq 'user-service') {

            $bootstrapJson = $null
        }
    }

    # ========================================================
    # 12. INICIAR FRONTEND ANGULAR
    # ========================================================

    Show-Seccion 'INICIANDO FRONTEND ANGULAR'

    $frontendLog = Join-Path $logsDir 'frontend.log'
    $frontendErrorLog = Join-Path $logsDir 'frontend-error.log'

    Write-Host 'Iniciando Angular mediante IPv4...'
    Write-Host 'Direccion de escucha: 127.0.0.1'
    Write-Host 'Puerto: 4200'

    # Deshabilitar solicitudes interactivas y evitar que
    # Angular reciba las credenciales de los microservicios.

    $frontendEntorno = @{
        CI = 'true'
        NG_CLI_ANALYTICS = 'false'
        DB_USERNAME = $null
        DB_PASSWORD = $null
        JWT_PRIVATE_KEY = $null
        JWT_PUBLIC_KEY = $null
        INTERNAL_SERVICE_TOKEN = $null
        TWILIO_ACCOUNT_SID = $null
        TWILIO_AUTH_TOKEN = $null
        TWILIO_FROM_NUMBER = $null
        SPRING_APPLICATION_JSON = $null
    }

    $frontendProceso = Start-Process `
        -FilePath $nodeExe `
        -ArgumentList @(
            "`"$angularCli`"",
            'serve',
            '--host',
            '127.0.0.1',
            '--port',
            '4200'
        ) `
        -WorkingDirectory $frontend `
        -Environment $frontendEntorno `
        -RedirectStandardOutput $frontendLog `
        -RedirectStandardError $frontendErrorLog `
        -WindowStyle Hidden `
        -PassThru

    Register-Proceso `
        -Nombre 'plazoleta-frontend' `
        -Puerto 4200 `
        -Proceso $frontendProceso

    Wait-Servicio `
        -Nombre 'plazoleta-frontend' `
        -Puerto 4200 `
        -Proceso $frontendProceso `
        -Timeout 180

    # --------------------------------------------------------
    # VERIFICAR RESPUESTA HTTP DEL FRONTEND
    # --------------------------------------------------------

    Write-Host 'Verificando respuesta HTTP de Angular...'

    $respuestaHttp = Invoke-WebRequest `
        -Uri 'http://localhost:4200' `
        -TimeoutSec 30 `
        -NoProxy

    if ($respuestaHttp.StatusCode -ne 200) {

        throw "Angular devolvio un estado HTTP inesperado: $($respuestaHttp.StatusCode)"
    }

    Write-Host 'Frontend disponible. HTTP 200 OK.' `
        -ForegroundColor Green

    # ========================================================
    # 13. RESULTADO FINAL
    # ========================================================

    Show-Seccion 'PROYECTO INICIADO CORRECTAMENTE'

    Write-Host 'Frontend:           http://localhost:4200'
    Write-Host 'User Service:       http://localhost:8081'
    Write-Host 'Restaurant Service: http://localhost:8082'
    Write-Host 'Dish Service:       http://localhost:8083'
    Write-Host 'Order Service:      http://localhost:8084'

    Write-Host ''
    Write-Host "Logs: $logsDir"
    Write-Host "Registro de procesos: $procesosFile"

    if ($bootstrapHabilitado) {

        Write-Host ''
        Write-Host "Configuracion del administrador: $adminFile"

        Write-Host 'Si ya existia un administrador, conserve sus credenciales originales.'
    }
    else {

        Write-Host ''
        Write-Host 'Inicializacion del administrador omitida.'
    }

    if (-not $NoAbrirNavegador) {

        try {

            Start-Process 'http://localhost:4200'
        }
        catch {

            Write-Warning 'Abra el frontend manualmente en el navegador.'
        }
    }
}
catch {

    Write-Host ''
    Write-Host 'ERROR DURANTE EL INICIO DEL PROYECTO' `
        -ForegroundColor Red

    Write-Host $_.Exception.Message -ForegroundColor Red

    Write-Host 'Deteniendo procesos iniciados por este script...'

    Stop-ProcesosIniciados

    Write-Host "Consulte los logs en: $logsDir"

    throw
}
finally {

    $bootstrapJson = $null
}
