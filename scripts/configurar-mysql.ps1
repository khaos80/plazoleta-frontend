#Requires -Version 7.0

[CmdletBinding()]
param(
    [string]$MySqlExe,
    [string]$Servicio,
    [string]$UsuarioAdmin = 'root'
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

# ============================================================
# 1. CARGAR CONFIGURACION DEL ENTORNO
# ============================================================

& (Join-Path $PSScriptRoot 'configurar-entorno.ps1')

if (
    $env:DB_USERNAME -cne 'plazoleta_app' -or
    [string]::IsNullOrWhiteSpace($env:DB_PASSWORD)
) {
    throw 'Credenciales locales invalidas; no se ejecutara SQL.'
}

# ============================================================
# 2. LOCALIZAR MYSQL
# ============================================================

if (-not $MySqlExe) {

    $cmd = Get-Command mysql.exe -ErrorAction SilentlyContinue

    if ($cmd) {
        $MySqlExe = $cmd.Source
    }
    else {
        $candidates = @(
            Get-ChildItem `
                (Join-Path $env:ProgramFiles 'MySQL') `
                -Filter mysql.exe `
                -Recurse `
                -File `
                -ErrorAction SilentlyContinue
        )

        if ($candidates.Count -ne 1) {
            throw 'No se encontro un cliente unico. Indique -MySqlExe con la ruta completa.'
        }

        $MySqlExe = $candidates[0].FullName
    }
}

if (-not (Test-Path -LiteralPath $MySqlExe -PathType Leaf)) {
    throw 'mysql.exe no encontrado.'
}

Write-Host "Cliente MySQL localizado: $MySqlExe"

# ============================================================
# 3. VERIFICAR SERVICIO MYSQL
# ============================================================

if (-not $Servicio) {

    $services = @(
        Get-Service -Name '*mysql*' -ErrorAction SilentlyContinue
    )

    if ($services.Count -ne 1) {
        throw 'No se encontro un servicio MySQL unico. Indique -Servicio con el nombre del servicio MySQL.'
    }

    $Servicio = $services[0].Name
}

$servicioMySql = Get-Service `
    -Name $Servicio `
    -ErrorAction Stop

if ($servicioMySql.Status -ne 'Running') {

    Write-Host "Iniciando servicio $Servicio..."

    try {

        Start-Service -Name $Servicio -ErrorAction Stop

        $servicioMySql.WaitForStatus(
            'Running',
            [TimeSpan]::FromSeconds(30)
        )

    }
    catch {
        throw "No se pudo iniciar el servicio $Servicio. Solicite al administrador de Windows que inicie el servicio MySQL. Detalle: $($_.Exception.Message)"
    }
}

Write-Host "Servicio MySQL activo: $Servicio"

if (-not (Test-NetConnection localhost -Port 3306 -InformationLevel Quiet)) {
    throw 'MySQL no responde en el puerto 3306.'
}

Write-Host 'Puerto 3306 disponible.'

# ============================================================
# 4. DEFINIR BASES DE DATOS Y TABLAS
# ============================================================

$dbDir = Join-Path `
    (Split-Path $PSScriptRoot -Parent) `
    'database'

$files = @(
    '01-crear-bases-datos.sql',
    '02-crear-tabla-usuarios.sql',
    '03-crear-tabla-restaurantes.sql',
    '04-crear-tabla-platos.sql',
    '05-crear-tablas-pedidos.sql'
)

$schemas = @(
    'plazoleta_usuarios',
    'plazoleta_restaurantes',
    'plazoleta_platos',
    'plazoleta_pedidos'
)

$expected = @(
    'plazoleta_usuarios.usuarios',
    'plazoleta_restaurantes.restaurantes',
    'plazoleta_platos.platos',
    'plazoleta_pedidos.pedidos',
    'plazoleta_pedidos.detalles_pedido',
    'plazoleta_pedidos.pedido_estado_historial',
    'plazoleta_pedidos.bloqueos_cliente'
)

$rutaConfig = Join-Path `
    $env:LOCALAPPDATA `
    'Plazoleta\entorno.local.json'

# ============================================================
# 5. FUNCION PARA EJECUTAR INSTRUCCIONES MYSQL
# ============================================================

function Invoke-MySql {

    param(
        [string]$User,
        [string]$Password,
        [string]$Sql
    )

    $path = Join-Path `
        ([Environment]::GetFolderPath('LocalApplicationData')) `
        ('Plazoleta/mysql-' + [guid]::NewGuid() + '.cnf')

    $escaped = $Password.
        Replace('\', '\\').
        Replace('"', '\"').
        Replace("`n", '\n').
        Replace("`r", '\r').
        Replace("`t", '\t')

    try {

        [IO.File]::WriteAllText(
            $path,
            "[client]`npassword=`"$escaped`"`n",
            [Text.UTF8Encoding]::new($false)
        )

        $result = $Sql | & $MySqlExe `
            "--defaults-file=$path" `
            --protocol=TCP `
            --host=localhost `
            --port=3306 `
            "--user=$User" `
            --batch `
            --skip-column-names `
            --default-character-set=utf8mb4

        if ($LASTEXITCODE -ne 0) {
            throw "MySQL devolvio codigo $LASTEXITCODE."
        }

        return $result
    }
    finally {

        Remove-Item `
            -LiteralPath $path `
            -Force `
            -ErrorAction SilentlyContinue
    }
}

# ============================================================
# 6. FUNCION PARA VALIDAR CREDENCIALES
# ============================================================

function Test-ConexionMySql {

    param(
        [string]$User,
        [string]$Password
    )

    try {

        Invoke-MySql `
            -User $User `
            -Password $Password `
            -Sql 'SELECT 1;' 2>$null | Out-Null

        return $true
    }
    catch {
        return $false
    }
}

# ============================================================
# 7. FUNCION PARA VERIFICAR TABLAS
# ============================================================

function Test-TablasMySql {

    param(
        [string]$User,
        [string]$Password
    )

    try {

        foreach ($table in $expected) {

            Invoke-MySql `
                -User $User `
                -Password $Password `
                -Sql "SELECT 1 FROM $table LIMIT 0;" `
                2>$null | Out-Null
        }

        return $true
    }
    catch {
        return $false
    }
}

# ============================================================
# 8. FUNCION PARA GUARDAR CONTRASENA EXISTENTE
# ============================================================

function Save-PasswordMySql {

    param(
        [string]$Password
    )

    $config = Get-Content `
        -LiteralPath $rutaConfig `
        -Raw | ConvertFrom-Json

    $config.DB_PASSWORD = $Password

    $tempConfig = "$rutaConfig.$([guid]::NewGuid()).tmp"

    try {
        $config | ConvertTo-Json -Depth 10 |
            Set-Content -LiteralPath $tempConfig -Encoding utf8

        Move-Item `
            -LiteralPath $tempConfig `
            -Destination $rutaConfig `
            -Force
    }
    finally {
        Remove-Item `
            -LiteralPath $tempConfig `
            -Force `
            -ErrorAction SilentlyContinue
    }

    $env:DB_PASSWORD = $Password

    Write-Host 'Credenciales locales actualizadas correctamente.'
}

# ============================================================
# 9. FUNCION PARA MOSTRAR TABLAS VERIFICADAS
# ============================================================

function Show-TablasVerificadas {

    foreach ($table in $expected) {
        Write-Host "Verificada: $table" -ForegroundColor Green
    }
}

# ============================================================
# 10. COMPROBAR CONFIGURACION EXISTENTE
# ============================================================

Write-Host ''
Write-Host 'Verificando configuracion existente de MySQL...'

$conexionValida = Test-ConexionMySql `
    -User $env:DB_USERNAME `
    -Password $env:DB_PASSWORD

if ($conexionValida) {

    $tablasValidas = Test-TablasMySql `
        -User $env:DB_USERNAME `
        -Password $env:DB_PASSWORD

    if ($tablasValidas) {

        Show-TablasVerificadas

        Write-Host ''
        Write-Host 'MySQL ya se encuentra configurado.' -ForegroundColor Green
        Write-Host 'Conexion de aplicacion verificada.'
        Write-Host 'No se requiere la contrasena administrativa.'

        return
    }
}

# ============================================================
# 11. RECUPERAR CREDENCIALES EXISTENTES SIN ROOT
# ============================================================

if (-not $conexionValida) {

    Write-Host ''
    Write-Host 'No se pudo autenticar el usuario de aplicacion.' `
        -ForegroundColor Yellow

    $respuesta = Read-Host 'Ya existe el usuario plazoleta_app y conoce su contrasena? (S/N)'

    if ($respuesta -match '^[sS]$') {

        $passwordExistente = Read-Host `
            'Contrasena actual de plazoleta_app' `
            -MaskInput

        try {

            if ([string]::IsNullOrWhiteSpace($passwordExistente)) {
                throw 'La contrasena no puede estar vacia.'
            }

            if (-not (Test-ConexionMySql `
                -User $env:DB_USERNAME `
                -Password $passwordExistente)) {

                throw 'La contrasena proporcionada no es valida.'
            }

            Save-PasswordMySql -Password $passwordExistente

            $conexionValida = $true

            $tablasValidas = Test-TablasMySql `
                -User $env:DB_USERNAME `
                -Password $env:DB_PASSWORD

            if ($tablasValidas) {

                Show-TablasVerificadas

                Write-Host ''
                Write-Host 'MySQL ya se encuentra configurado.' `
                    -ForegroundColor Green

                Write-Host 'No se requiere la contrasena administrativa.'

                return
            }
        }
        finally {
            $passwordExistente = $null
        }
    }
}

# ============================================================
# 12. VALIDAR ARCHIVOS SQL
# ============================================================

$sql = foreach ($file in $files) {

    $filePath = Join-Path $dbDir $file

    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        throw "No se encontro el archivo SQL: $filePath"
    }

    Get-Content -LiteralPath $filePath -Raw
}

# ============================================================
# 13. SOLICITAR ACCESO ADMINISTRATIVO
# ============================================================

Write-Host ''
Write-Host 'Se requiere completar la configuracion de MySQL.' `
    -ForegroundColor Yellow

Write-Host "Usuario administrativo: $UsuarioAdmin"

$secure = Read-Host `
    "Contrasena administrativa de MySQL ($UsuarioAdmin)" `
    -AsSecureString

$adminPassword = [System.Net.NetworkCredential]::new(
    '',
    $secure
).Password

try {

    # --------------------------------------------------------
    # 14. VALIDAR CONEXION ADMINISTRATIVA
    # --------------------------------------------------------

    if (-not (Test-ConexionMySql `
        -User $UsuarioAdmin `
        -Password $adminPassword)) {

        throw 'No se pudo autenticar el usuario administrativo de MySQL.'
    }

    Write-Host 'Conexion administrativa verificada.'

    # --------------------------------------------------------
    # 15. VERIFICAR USUARIO DE APLICACION
    # --------------------------------------------------------

    $exists = Invoke-MySql `
        -User $UsuarioAdmin `
        -Password $adminPassword `
        -Sql "SELECT COUNT(*) FROM mysql.user WHERE User='plazoleta_app' AND Host='localhost';"

    if ([int]$exists -gt 0) {

        Write-Host 'El usuario plazoleta_app ya existe.'

        if (-not (Test-ConexionMySql `
            -User $env:DB_USERNAME `
            -Password $env:DB_PASSWORD)) {

            $passwordExistente = Read-Host `
                'Ingrese la contrasena actual de plazoleta_app' `
                -MaskInput

            try {

                if ([string]::IsNullOrWhiteSpace($passwordExistente)) {
                    throw 'La contrasena no puede estar vacia.'
                }

                if (-not (Test-ConexionMySql `
                    -User $env:DB_USERNAME `
                    -Password $passwordExistente)) {

                    throw 'La contrasena existente no es valida. No se modificara el usuario.'
                }

                Save-PasswordMySql -Password $passwordExistente
            }
            finally {
                $passwordExistente = $null
            }
        }
    }
    else {

        # Solo se permiten contrasenas hexadecimales generadas
        # automaticamente para la creacion de usuarios nuevos.

        if ($env:DB_PASSWORD -cnotmatch '^[0-9A-F]{48}$') {
            throw 'Para crear un usuario nuevo se requiere una contrasena generada automaticamente.'
        }
    }

    # --------------------------------------------------------
    # 16. EJECUTAR SCRIPTS SQL
    # --------------------------------------------------------

    Write-Host ''
    Write-Host 'Configurando bases de datos y tablas...'

    for ($i = 0; $i -lt $files.Count; $i++) {

        Invoke-MySql `
            -User $UsuarioAdmin `
            -Password $adminPassword `
            -Sql $sql[$i] | Out-Null

        Write-Host "Ejecutado: $($files[$i])" `
            -ForegroundColor Green
    }

    # --------------------------------------------------------
    # 17. CREAR USUARIO SI NO EXISTE
    # --------------------------------------------------------

    if ([int]$exists -eq 0) {

        Invoke-MySql `
            -User $UsuarioAdmin `
            -Password $adminPassword `
            -Sql "CREATE USER IF NOT EXISTS 'plazoleta_app'@'localhost' IDENTIFIED BY '$env:DB_PASSWORD';" |
            Out-Null

        Write-Host 'Usuario plazoleta_app creado correctamente.' `
            -ForegroundColor Green
    }

    # --------------------------------------------------------
    # 18. ASIGNAR PERMISOS
    # --------------------------------------------------------

    foreach ($schema in $schemas) {

        Invoke-MySql `
            -User $UsuarioAdmin `
            -Password $adminPassword `
            -Sql "GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON $schema.* TO 'plazoleta_app'@'localhost';" |
            Out-Null

        Write-Host "Permisos asignados: $schema" `
            -ForegroundColor Green
    }
}
finally {

    $adminPassword = $null
    $secure.Dispose()
}

# ============================================================
# 19. VALIDACION FINAL
# ============================================================

Write-Host ''
Write-Host 'Validando conexion y tablas de aplicacion...'

if (-not (Test-ConexionMySql `
    -User $env:DB_USERNAME `
    -Password $env:DB_PASSWORD)) {

    throw 'No se pudo establecer la conexion final con plazoleta_app.'
}

if (-not (Test-TablasMySql `
    -User $env:DB_USERNAME `
    -Password $env:DB_PASSWORD)) {

    throw 'No se pudo verificar el acceso a todas las tablas.'
}

Show-TablasVerificadas

# ============================================================
# 20. CONFIGURACION COMPLETADA
# ============================================================

Write-Host ''
Write-Host '====================================================' `
    -ForegroundColor Green

Write-Host 'CONFIGURACION MYSQL COMPLETADA CORRECTAMENTE' `
    -ForegroundColor Green

Write-Host '====================================================' `
    -ForegroundColor Green

Write-Host 'Bases de datos: 4'
Write-Host 'Tablas verificadas: 7'
Write-Host "Usuario de aplicacion: $env:DB_USERNAME"
Write-Host 'Conexion de aplicacion verificada.'