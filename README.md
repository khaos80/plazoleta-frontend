
# Plaza de Comidas — Sistema de Gestión de Pedidos

Sistema de gestión de restaurantes, platos, usuarios y pedidos, desarrollado mediante una arquitectura de microservicios con Spring Boot y un frontend Angular.

El proyecto permite administrar restaurantes, gestionar su menú, registrar pedidos, controlar su preparación, realizar entregas mediante un PIN de seguridad y consultar la trazabilidad de cada pedido.

## 1. Información general

| Característica | Tecnología |
|---|---|
| Backend | Java 21 |
| Framework backend | Spring Boot |
| Arquitectura | Microservicios + Arquitectura Hexagonal |
| Base de datos | MySQL |
| Persistencia | Spring Data JPA / Hibernate |
| Seguridad | Spring Security + JWT |
| API | REST |
| Documentación API | Swagger / OpenAPI |
| Frontend | Angular 21 |
| Lenguaje frontend | TypeScript |
| Gestor frontend | npm |
| Construcción backend | Maven |
| Control de versiones | Git y GitHub |
| Entorno de desarrollo | Visual Studio Code |

### Objetivo

Desarrollar un sistema que permita gestionar las operaciones de una plaza de comidas, separando las responsabilidades en servicios independientes y proporcionando interfaces específicas para cada tipo de usuario.

El sistema contempla el proceso desde la creación de un restaurante hasta la entrega de un pedido al cliente.

---

## 2. Arquitectura del sistema

La solución utiliza una arquitectura distribuida compuesta por cuatro microservicios independientes y una aplicación frontend.

```text
                  USUARIOS
                     |
                     v
              FRONTEND ANGULAR
               localhost:4200
                     |
                     | HTTP / REST / JWT
                     |
       +-------------+-------------+
       |             |             |
       v             v             v
  USER-SERVICE  RESTAURANT-SERVICE  DISH-SERVICE
    :8081            :8082            :8083
       |             |             |
       +-------------+-------------+
                     |
                     v
                ORDER-SERVICE
                    :8084
                     |
                     v
                   MySQL
```

Este diagrama representa una vista conceptual. Las llamadas reales se realizan desde el frontend hacia las API correspondientes y entre microservicios cuando una operación requiere validar información de otro dominio.

### Microservicios

**user-service**

Responsable de la gestión de usuarios, autenticación, credenciales, roles y emisión de tokens JWT.

**restaurant-service**

Responsable de la creación y administración de restaurantes y la validación de sus propietarios.

**dish-service**

Responsable de la gestión del catálogo de platos, precios, descripciones, categorías y disponibilidad.

**order-service**

Responsable de la creación de pedidos, asignación de empleados, preparación, cambios de estado, cancelaciones, entregas y trazabilidad.

### Independencia

Cada microservicio:

- Tiene su propio proyecto Spring Boot.
- Dispone de un archivo `pom.xml`.
- Organiza su lógica siguiendo arquitectura hexagonal.
- Expone endpoints REST.
- Implementa las validaciones correspondientes a su dominio.
- Puede compilarse y ejecutarse mediante un archivo JAR.
- Se mantiene en un repositorio Git independiente.

---

## 3. Arquitectura hexagonal

Los microservicios se desarrollaron siguiendo el patrón de arquitectura hexagonal, también conocido como Ports and Adapters.

El objetivo es separar las reglas de negocio de los detalles técnicos, como HTTP, persistencia y comunicación externa.

### Dominio

Contiene los modelos, enumeraciones y excepciones propias del negocio.

El dominio no debe depender de Spring Boot, controladores REST ni implementaciones de base de datos.

### Aplicación

Contiene los casos de uso y los puertos que definen las operaciones necesarias para ejecutar las reglas de negocio.

Los casos de uso coordinan las validaciones y las operaciones del dominio.

### Adaptadores

Conectan la aplicación con las tecnologías externas.

**Adaptadores de entrada:**

- Controladores REST.
- Recepción de solicitudes HTTP.
- Validación y transformación de DTO.
- Respuestas HTTP.

**Adaptadores de salida:**

- Repositorios JPA.
- Persistencia MySQL.
- Clientes HTTP para otros microservicios.
- Integraciones externas cuando correspondan.

### Estructura conceptual

```text
src/
├── main/
│   ├── java/com/plazoleta/<servicio>/
│   │   ├── domain/
│   │   │   ├── model/
│   │   │   ├── enums/
│   │   │   └── exception/
│   │   ├── application/
│   │   │   ├── port/
│   │   │   └── usecase/
│   │   └── infrastructure/
│   │       ├── input/
│   │       └── output/
│   └── resources/
│       └── application.properties
└── test/
    └── java/com/plazoleta/<servicio>/tests/
        ├── adapter/
        ├── controller/
        ├── integration/
        └── usecase/
```

La estructura anterior representa las responsabilidades arquitectónicas. Los nombres exactos de los subpaquetes pueden variar entre servicios.

### Principios aplicados

- Separación de responsabilidades.
- Inversión de dependencias.
- Encapsulamiento de reglas de negocio.
- Independencia del framework.
- Uso de interfaces para los puertos.
- Validación de datos de entrada.
- Manejo centralizado de excepciones.
- Código organizado para facilitar pruebas y mantenimiento.

Los mensajes de error utilizados por los casos de uso se referencian mediante constantes centralizadas en `MensajesError`.

---

## 4. Roles del sistema

La aplicación contempla cuatro roles.

| Rol | Responsabilidad |
|---|---|
| ADMINISTRADOR | Administrar restaurantes y cuentas de propietarios |
| PROPIETARIO | Gestionar platos, empleados y operaciones de sus restaurantes |
| EMPLEADO | Gestionar la preparación y entrega de pedidos |
| CLIENTE | Consultar restaurantes, realizar pedidos y seguir su estado |

### ADMINISTRADOR

Permite realizar operaciones administrativas como:

- Registrar restaurantes.
- Crear cuentas de propietarios.
- Asociar propietarios a los restaurantes.
- Gestionar información administrativa permitida.

### PROPIETARIO

Permite gestionar las operaciones de sus restaurantes:

- Crear platos.
- Actualizar información de platos.
- Modificar precios.
- Activar o desactivar platos.
- Gestionar empleados.
- Consultar información de los pedidos.
- Consultar información de tiempos operativos.

Las operaciones deben respetar la propiedad del restaurante.

### EMPLEADO

Participa en el ciclo operativo del pedido:

- Consultar pedidos pendientes.
- Asignarse pedidos.
- Iniciar la preparación.
- Marcar pedidos como listos.
- Gestionar la entrega.
- Confirmar entregas mediante PIN.

### CLIENTE

Permite:

- Consultar restaurantes.
- Explorar los platos disponibles.
- Seleccionar productos y cantidades.
- Crear pedidos.
- Consultar pedidos.
- Cancelar pedidos cuando las reglas lo permitan.
- Consultar la trazabilidad de un pedido.

---

## 5. Funcionalidades principales

### 5.1. Gestión de usuarios

El servicio de usuarios centraliza la información de las personas que interactúan con el sistema.

La autenticación utiliza JWT para identificar al usuario y controlar su acceso a las operaciones protegidas.

### 5.2. Gestión de restaurantes

Permite registrar y consultar restaurantes.

El sistema utiliza validaciones para comprobar la existencia de los restaurantes y la relación entre un propietario y su establecimiento.

### 5.3. Gestión de platos

Permite administrar el catálogo de alimentos ofrecidos por los restaurantes.

Las operaciones de modificación están restringidas a usuarios autorizados.

Se contemplan datos como:

- Nombre.
- Descripción.
- Precio.
- Categoría.
- Imagen.
- Disponibilidad.
- Restaurante asociado.

### 5.4. Gestión de pedidos

El cliente selecciona los platos de un restaurante y registra un pedido.

El sistema valida las reglas correspondientes antes de permitir su creación.

Una de las reglas principales es que un cliente no puede mantener más de un pedido activo simultáneamente.

### 5.5. Asignación de empleados

Los empleados consultan los pedidos pendientes y pueden participar en su gestión.

La asignación debe respetar las reglas de autorización y los estados del pedido.

### 5.6. Preparación

Una vez iniciado el proceso de preparación, el pedido avanza al estado correspondiente.

El backend controla las transiciones para evitar operaciones inconsistentes.

### 5.7. Entrega mediante PIN

El proceso de entrega incorpora un código PIN de seguridad para confirmar la operación.

El PIN forma parte del mecanismo de validación de la entrega y no debe exponerse indiscriminadamente.

### 5.8. Cancelación

El cliente puede solicitar la cancelación de un pedido cuando las condiciones de negocio lo permitan.

La cancelación no debe ejecutarse si el pedido se encuentra en un estado que prohíba dicha operación.

### 5.9. Trazabilidad

La aplicación permite consultar el historial de estados de un pedido.

El frontend presenta la información de seguimiento mediante una interfaz visual, evitando mostrar únicamente la respuesta JSON de la API.

La trazabilidad permite identificar el avance del pedido y consultar la información temporal registrada por el backend.

---

## 6. Ciclo de vida de un pedido

Los estados del pedido son:

| Estado | Descripción |
|---|---|
| PENDIENTE | El pedido fue registrado y espera gestión |
| EN_PREPARACION | Un empleado está preparando el pedido |
| LISTO | El pedido terminó su preparación |
| ENTREGADO | Se confirmó la entrega |
| CANCELADO | El pedido fue cancelado |

### Flujo principal

```text
PENDIENTE
    |
    v
EN_PREPARACION
    |
    v
  LISTO
    |
    v
ENTREGADO
```

### Flujo de cancelación

```text
PENDIENTE
    |
    v
CANCELADO
```

La posibilidad de cancelar depende de las reglas de negocio implementadas.

### Reglas importantes

1. El pedido debe pertenecer a un cliente válido.
2. Los platos solicitados deben ser válidos.
3. Los platos del pedido deben corresponder al restaurante seleccionado.
4. Las cantidades deben ser válidas.
5. Un cliente no puede mantener dos pedidos activos al mismo tiempo.
6. Los empleados deben estar autorizados para operar sobre el pedido.
7. Las transiciones de estado deben respetar el flujo de negocio.
8. La entrega debe validarse mediante el mecanismo de PIN correspondiente.
9. Las operaciones sobre pedidos deben preservar la integridad de la información.
10. La trazabilidad debe reflejar los eventos realmente registrados.

---

## 7. Frontend Angular

El frontend es una aplicación Angular desarrollada con TypeScript y componentes standalone.

Su propósito es ofrecer una interfaz visual para las operaciones del sistema, consumiendo las API REST de los microservicios.

### Repositorio

https://github.com/khaos80/plazoleta-frontend

### Características

- Interfaces diferenciadas por rol.
- Integración HTTP con el backend.
- Autenticación mediante JWT.
- Navegación y funcionalidades según permisos.
- Formularios para operaciones del sistema.
- Visualización de restaurantes y platos.
- Gestión visual de pedidos.
- Seguimiento de pedidos.
- Consulta de trazabilidad.
- Presentación de respuestas y errores.

### Panel del administrador

Permite acceder a las operaciones administrativas de restaurantes y propietarios.

### Panel del propietario

Permite gestionar el catálogo de platos y las operaciones correspondientes a sus restaurantes.

### Panel del empleado

Permite consultar y gestionar pedidos pendientes, en preparación y listos, según las operaciones disponibles.

### Panel del cliente

Permite explorar restaurantes, consultar platos, crear pedidos y realizar seguimiento de sus solicitudes.

### Seguimiento del cliente

El apartado de seguimiento permite consultar la información de un pedido mediante su identificador y utilizar las opciones disponibles para consultar pedidos de la sesión.

La información de trazabilidad se representa visualmente para facilitar la comprensión de los estados.

---

## 8. Seguridad

La aplicación utiliza Spring Security y JSON Web Tokens (JWT).

### Autenticación

El usuario se autentica utilizando el mecanismo implementado en `user-service`.

Una vez autenticado, el sistema utiliza el token JWT para identificar al usuario en las solicitudes protegidas.

### Autorización

Los microservicios verifican los permisos necesarios para ejecutar las operaciones.

Los roles utilizados son:

```text
ADMINISTRADOR
PROPIETARIO
EMPLEADO
CLIENTE
```

El claim `rol` del JWT se utiliza para representar la autoridad correspondiente mediante el prefijo `ROLE_` en la configuración de seguridad que aplica esta conversión.

### Encabezado de autorización

```http
Authorization: Bearer <TOKEN_JWT>
```

### Consideraciones

- No almacenar contraseñas en texto plano.
- No publicar claves de firma JWT.
- No incluir credenciales reales en GitHub.
- Validar permisos desde el backend.
- No confiar únicamente en la visibilidad de botones del frontend.
- Evitar que un usuario acceda a recursos que no le corresponden.
- Utilizar respuestas HTTP apropiadas para accesos denegados.

---

## 9. Base de datos

El proyecto utiliza MySQL como motor de base de datos relacional.

La persistencia de los microservicios se realiza mediante las tecnologías configuradas en cada proyecto.

### Configuración

Cada servicio debe contar con su configuración de conexión a la base de datos.

Ejemplo de configuración orientativa:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/NOMBRE_BASE_DATOS
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}
```

`NOMBRE_BASE_DATOS` debe reemplazarse por el esquema real configurado en cada microservicio.

Los nombres de los esquemas, las tablas y las relaciones deben consultarse en las entidades y archivos de configuración de los servicios.

### Requisitos

- MySQL instalado y en ejecución.
- Bases de datos requeridas por los servicios.
- Usuario de MySQL con permisos suficientes.
- Configuración de conexión válida.
- Puerto de MySQL disponible, normalmente 3306.

No debe asumirse que todos los servicios comparten un mismo esquema de base de datos.

---

## 10. Requisitos para ejecutar el proyecto

Se recomienda disponer de:

| Herramienta | Requisito |
|---|---|
| Java | JDK 21 |
| Maven | Maven Wrapper del proyecto o Maven compatible |
| MySQL | Servidor compatible con la configuración |
| Node.js | Versión compatible con Angular 21 |
| npm | Versión compatible con Node.js y el proyecto |
| Git | Instalación funcional |
| IDE | Visual Studio Code o equivalente |

### Verificar Java

```powershell
java -version
```

Debe utilizarse Java 21.

### Verificar Node.js

```powershell
node -v
```

### Verificar npm

```powershell
npm -v
```

### Verificar Git

```powershell
git --version
```

Para compilar con Maven Wrapper no es obligatorio instalar Maven globalmente, siempre que el wrapper del proyecto esté completo y pueda descargar su distribución.

---

## 11. Descargar el proyecto

Los microservicios se mantienen en repositorios independientes.

Se recomienda organizar los proyectos de la siguiente forma:

```text
PlazaDeComidas/
├── user-service/
├── restaurant-service/
├── dish-service/
├── order-service/
└── plazoleta-frontend/
```

Esta estructura es una organización local recomendada; no obliga a modificar la estructura interna de cada repositorio.

### Clonar el frontend

```powershell
git clone https://github.com/khaos80/plazoleta-frontend.git
```

### Microservicios

Clonar cada microservicio utilizando la URL de su repositorio correspondiente.

```powershell
git clone <URL_USER_SERVICE>
git clone <URL_RESTAURANT_SERVICE>
git clone <URL_DISH_SERVICE>
git clone <URL_ORDER_SERVICE>
```

Las URL deben sustituirse por los repositorios reales del proyecto.

---

## 12. Configurar el backend

Antes de ejecutar los microservicios:

1. Iniciar MySQL.
2. Crear o verificar los esquemas requeridos.
3. Configurar las credenciales de base de datos.
4. Verificar las claves y parámetros de seguridad JWT.
5. Revisar las direcciones de comunicación entre microservicios.
6. Verificar los puertos.
7. Comprobar que Java 21 esté disponible.

Los valores efectivos se encuentran en los archivos `application.properties` o `application.yml` de cada servicio.

### Puertos del entorno local

| Aplicación | Puerto |
|---|---|
| user-service | 8081 |
| restaurant-service | 8082 |
| dish-service | 8083 |
| order-service | 8084 |
| Angular | 4200 |

Estos son los puertos utilizados en el entorno de desarrollo documentado. Deben coincidir con los valores efectivos de configuración.

---

## 13. Compilar los microservicios

Cada microservicio se compila de manera independiente.

Los siguientes comandos están orientados a Windows PowerShell.

### 13.1. user-service

Abrir una terminal dentro de `user-service`.

```powershell
.\mvnw.cmd clean package -DskipTests
```

### 13.2. restaurant-service

Abrir una terminal dentro de `restaurant-service`.

```powershell
.\mvnw.cmd clean package -DskipTests
```

### 13.3. dish-service

Abrir una terminal dentro de `dish-service`.

```powershell
.\mvnw.cmd clean package -DskipTests
```

### 13.4. order-service

Abrir una terminal dentro de `order-service`.

```powershell
.\mvnw.cmd clean package -DskipTests
```

La opción `-DskipTests` permite compilar sin ejecutar las pruebas. Para una validación completa de entrega se recomienda ejecutar las pruebas por separado.

### Verificar los archivos generados

Desde la raíz de cada microservicio:

```powershell
Get-ChildItem .\target\*.jar
```

Se debe identificar el JAR ejecutable de Spring Boot, evitando archivos auxiliares que no correspondan a la aplicación.

---

## 14. Ejecutar los microservicios mediante JAR

**Importante: el procedimiento de ejecución de este proyecto utiliza archivos JAR compilados.**

No es necesario utilizar `spring-boot:run` para iniciar los servicios.

Cada microservicio debe ejecutarse en una terminal independiente.

### 14.1. Iniciar user-service

Desde su carpeta raíz:

```powershell
# user-service
java -Xms64m -Xmx256m -jar .\target\user-service-0.0.1-SNAPSHOT.jar
```

### 14.2. Iniciar restaurant-service

```powershell
# restaurant-service
java -Xms64m -Xmx256m -jar .\target\restaurant-service-0.0.1-SNAPSHOT.jar
```

### 14.3. Iniciar dish-service

```powershell
java -Xms64m -Xmx256m -jar .\target\dish-service-0.0.1-SNAPSHOT.jar
```

### 14.4. Iniciar order-service

```powershell
# order-service
java -Xms64m -Xmx256m -jar .\target\order-service-0.0.1-SNAPSHOT.jar
```

Reemplazar cada nombre por el archivo JAR real generado en la carpeta `target`.

Los parámetros `-Xms64m` y `-Xmx256m` son una configuración de memoria para un entorno local de recursos limitados. Pueden ajustarse según los requisitos de ejecución.

### Orden recomendado

1. MySQL.
2. user-service.
3. restaurant-service.
4. dish-service.
5. order-service.
6. Frontend Angular.

Este orden facilita comprobar las dependencias funcionales entre servicios.

### Verificación

Cada aplicación debe mostrar en consola que Spring Boot inició correctamente y que el servidor HTTP está escuchando en el puerto configurado.

No cerrar las terminales mientras se utiliza el sistema.

---

## 15. Ejecutar el frontend Angular

Abrir una terminal en la carpeta `plazoleta-frontend`.

### Instalar dependencias

```powershell
npm install
```

### Iniciar Angular

```powershell
npx ng serve
```

### Abrir la aplicación

```text
http://localhost:4200
```

### Compilar el frontend

Para generar una compilación de producción:

```powershell
npx ng build --configuration production
```

El resultado se genera en el directorio de salida configurado por Angular, normalmente dentro de `dist/`.

### Conexión con el backend

Las URL utilizadas por el frontend deben corresponder a los puertos de los microservicios.

El frontend necesita que los servicios requeridos estén disponibles para ejecutar sus operaciones.

La configuración CORS del backend debe permitir el origen del frontend en el entorno local.

---

## 16. Documentación de API con Swagger

Los microservicios utilizan Swagger/OpenAPI para facilitar la exploración y prueba de endpoints.

En una configuración estándar de Springdoc, las interfaces se encuentran en:

| Servicio | Dirección |
|---|---|
| user-service | http://localhost:8081/swagger-ui/index.html |
| restaurant-service | http://localhost:8082/swagger-ui/index.html |
| dish-service | http://localhost:8083/swagger-ui/index.html |
| order-service | http://localhost:8084/swagger-ui/index.html |

Estas rutas deben verificarse contra la configuración de Springdoc de cada servicio.

### Probar endpoints protegidos

1. Iniciar los microservicios.
2. Autenticarse utilizando el endpoint correspondiente.
3. Obtener el JWT.
4. Abrir Swagger.
5. Utilizar la opción de autorización.
6. Enviar las solicitudes con el token.
7. Comprobar las respuestas HTTP.

### Códigos HTTP habituales

| Código | Significado |
|---|---|
| 200 | Operación exitosa |
| 201 | Recurso creado |
| 400 | Solicitud inválida |
| 401 | Usuario no autenticado |
| 403 | Acceso no autorizado para el rol |
| 404 | Recurso no encontrado |
| 409 | Conflicto con una regla de negocio |
| 500 | Error interno |

La respuesta concreta depende de los controladores y manejadores de excepciones implementados.

---

## 17. Comunicación entre microservicios

La solución utiliza comunicación HTTP/REST para operaciones que requieren consultar información de otros servicios.

Ejemplos de responsabilidades de validación:

- Comprobar que un usuario exista y tenga los permisos correspondientes.
- Verificar la existencia de un restaurante.
- Verificar la relación entre propietario y restaurante.
- Consultar la información necesaria de los platos.
- Validar información requerida para registrar pedidos.

### Endpoints de referencia

En `restaurant-service` se contemplan las siguientes consultas:

```http
GET /api/v1/restaurantes/{id}
```

Permite consultar información de existencia del restaurante.

```http
GET /api/v1/restaurantes/{id}/propietarios/{usuarioId}
```

Permite validar la relación entre un restaurante y un propietario.

En `dish-service`, la creación de platos utiliza:

```http
POST /api/v1/platos
```

Las operaciones de actualización incluyen rutas bajo:

```http
PATCH /api/v1/platos/*
```

La autorización de creación y modificación corresponde al rol PROPIETARIO.

Para consultar el catálogo completo de endpoints de todos los servicios, utilizar las interfaces Swagger de cada microservicio. Estas representan la documentación ejecutable de las API.

---

## 18. Trazabilidad de pedidos

La trazabilidad permite conocer la evolución del pedido a través de sus estados.

### Información de seguimiento

Según los eventos almacenados por el backend, la trazabilidad permite representar:

- Identificador del pedido.
- Estado del pedido.
- Secuencia de cambios.
- Fecha y hora de los eventos.
- Información temporal disponible.

### Ejemplo de seguimiento

```text
Pedido #1

[1] PENDIENTE
    Pedido recibido

[2] EN_PREPARACION
    Preparación iniciada

[3] LISTO
    Preparación finalizada

[4] ENTREGADO
    Entrega confirmada
```

Este ejemplo representa un pedido completado, no un historial real.

### Interfaz de seguimiento

El frontend dispone de una sección para consultar el seguimiento de pedidos.

La información se muestra de manera visual, con el propósito de facilitar su interpretación por parte del cliente.

La información presentada debe provenir de las respuestas reales de `order-service`.

---

## 19. Pruebas

El proyecto contempla pruebas organizadas según la responsabilidad del componente.

### Estructura

```text
src/test/java/com/plazoleta/<servicio>/tests/
├── adapter/
├── controller/
├── integration/
└── usecase/
```

**Importante:** el paquete raíz de pruebas se denomina `tests`, en plural.

### Pruebas de casos de uso

Permiten comprobar las reglas de negocio de manera aislada.

### Pruebas de controladores

Verifican el comportamiento de las operaciones HTTP, validaciones y respuestas.

### Pruebas de adaptadores

Comprueban las responsabilidades de integración y transformación de datos.

### Pruebas de integración

Permiten comprobar el comportamiento conjunto de componentes y dependencias cuando el entorno de pruebas está configurado.

### Ejecutar pruebas

Desde la raíz de cada microservicio:

```powershell
.\mvnw.cmd test
```

### Compilar ejecutando pruebas

```powershell
.\mvnw.cmd clean verify
```

### Consideraciones

- Las pruebas deben respetar la estructura real de paquetes.
- Las dependencias de prueba deben estar declaradas en `pom.xml`.
- Las pruebas de integración pueden requerir configuración adicional.
- Una compilación con `-DskipTests` no demuestra que las pruebas hayan pasado.

---

## 20. Validación funcional del sistema

Para comprobar el funcionamiento completo, se recomienda realizar el siguiente recorrido.

### Escenario 1. Administración

1. Autenticarse como administrador.
2. Registrar un propietario.
3. Crear un restaurante.
4. Verificar la información del restaurante.

### Escenario 2. Propietario

1. Autenticarse como propietario.
2. Acceder al restaurante correspondiente.
3. Crear platos.
4. Consultar el catálogo.
5. Modificar información de platos.
6. Verificar la disponibilidad de los platos.
7. Gestionar los empleados según las opciones disponibles.

### Escenario 3. Cliente

1. Autenticarse como cliente.
2. Consultar restaurantes.
3. Seleccionar un restaurante.
4. Consultar sus platos.
5. Seleccionar productos y cantidades.
6. Registrar un pedido.
7. Consultar el identificador generado.
8. Verificar que el pedido se encuentre en estado PENDIENTE.

### Escenario 4. Empleado

1. Autenticarse como empleado.
2. Consultar los pedidos pendientes.
3. Seleccionar un pedido.
4. Realizar su asignación.
5. Iniciar la preparación.
6. Cambiar el estado a LISTO.
7. Gestionar la entrega utilizando el mecanismo de PIN.

### Escenario 5. Trazabilidad

1. Ingresar al panel del cliente.
2. Abrir la sección de seguimiento.
3. Consultar el pedido.
4. Verificar la secuencia de estados.
5. Comprobar que la información visual coincida con los eventos del backend.

### Escenario 6. Validaciones

Comprobar el rechazo de operaciones inválidas, como:

- Acceder sin autenticación.
- Utilizar un rol sin permisos.
- Solicitar recursos inexistentes.
- Crear pedidos con información inválida.
- Intentar registrar un segundo pedido activo.
- Realizar transiciones de estado no permitidas.
- Intentar cancelar un pedido fuera de las condiciones autorizadas.
- Confirmar una entrega con información de seguridad inválida.

---

## 21. Manejo de errores

Los casos de uso utilizan constantes centralizadas en `MensajesError`.

Esta organización evita duplicar mensajes de error y facilita su mantenimiento.

Las excepciones deben representar las condiciones de negocio y transformarse en respuestas HTTP apropiadas desde la infraestructura.

El frontend debe interpretar las respuestas de error y presentar mensajes comprensibles al usuario.

### Recomendaciones

- No exponer trazas internas de excepciones al usuario final.
- No devolver información sensible.
- Diferenciar errores de validación, autorización y negocio.
- Mantener consistencia en las respuestas.
- Registrar información técnica suficiente para diagnóstico.

---

## 22. Solución de problemas frecuentes

### Java no se reconoce

Verificar que JDK 21 esté instalado y configurado en `JAVA_HOME` y `PATH`.

```powershell
java -version
```

### Maven no se reconoce

Utilizar Maven Wrapper desde la carpeta del microservicio:

```powershell
.\mvnw.cmd clean package
```

Si el wrapper no está disponible, instalar y configurar una versión compatible de Maven.

### Error de conexión a MySQL

Comprobar:

- Que MySQL esté ejecutándose.
- Que el puerto configurado sea correcto.
- Que el esquema exista.
- Que el usuario y contraseña sean válidos.
- Que la configuración JDBC corresponda al entorno.

### Puerto ocupado

En Windows, identificar el proceso:

```powershell
netstat -ano | findstr :8084
```

Consultar el PID antes de finalizar cualquier proceso.

### El frontend no se conecta al backend

Comprobar:

- Que el microservicio esté iniciado.
- Que la URL y el puerto sean correctos.
- Que CORS esté configurado.
- Que el token JWT sea válido.
- Que el usuario tenga permisos.
- Que no existan errores de red en las herramientas de desarrollo del navegador.

### Error 401

La solicitud no dispone de autenticación válida.

Revisar el token JWT y el encabezado `Authorization`.

### Error 403

El usuario está autenticado, pero no tiene los permisos necesarios para ejecutar la operación.

### No aparecen pedidos pendientes

Verificar:

- Que el pedido exista.
- Que su estado sea PENDIENTE.
- Que el empleado tenga acceso al restaurante correspondiente.
- Que el frontend consulte el endpoint correcto.
- Que el backend devuelva los pedidos esperados.
- Que no existan errores de autenticación o autorización.

### La trazabilidad no muestra información

Verificar:

- El identificador del pedido.
- La respuesta del servicio de pedidos.
- Los registros de trazabilidad existentes.
- El procesamiento de la respuesta en Angular.
- La consola del navegador.

---

## 23. Buenas prácticas aplicadas

El proyecto incorpora principios y prácticas orientados a mantener una solución organizada y escalable:

- Arquitectura hexagonal.
- Separación por microservicios.
- Responsabilidades delimitadas.
- Uso de interfaces y puertos.
- Inyección de dependencias.
- Validación de reglas de negocio.
- Autenticación mediante JWT.
- Autorización basada en roles.
- Persistencia relacional.
- Documentación mediante OpenAPI.
- Pruebas organizadas por componente.
- Manejo centralizado de errores.
- Integración frontend/backend mediante HTTP.
- Repositorios Git independientes.

---

## 24. Alcance y consideraciones

El sistema está orientado a la gestión de operaciones de restaurantes y pedidos dentro de una plaza de comidas.

La solución contempla los procesos de administración, selección de platos, registro de pedidos, preparación, entrega y seguimiento.

### Fuera del alcance principal

El reto original no exige implementar:

- Procesamiento de pagos en línea.
- Pasarelas bancarias.
- Facturación electrónica.
- Gestión contable.
- Aplicaciones móviles nativas.

Las integraciones externas, como notificaciones mediante servicios de mensajería, deben evaluarse según la implementación y configuración efectiva de los microservicios.

### Entorno de ejecución

Las instrucciones de este documento están orientadas principalmente a desarrollo y demostración local.

La puesta en producción requiere medidas adicionales de seguridad, gestión de secretos, monitoreo, infraestructura y despliegue.

---

## 25. Repositorios del proyecto

### Frontend

https://github.com/khaos80/plazoleta-frontend

### Backend

El backend se divide en los siguientes repositorios independientes:

| Microservicio | Responsabilidad |
|---|---|
| user-service | Usuarios, autenticación y roles |
| restaurant-service | Restaurantes y propietarios |
| dish-service | Catálogo de platos |
| order-service | Pedidos, preparación, entrega y trazabilidad |

Las URL definitivas de los cuatro repositorios deben incorporarse a esta sección.

---

## 26. Resumen de ejecución

Para iniciar el proyecto completo en un entorno local:

**1. Iniciar MySQL.**

**2. Configurar las conexiones y variables de los microservicios.**

**3. Compilar cada microservicio:**

```powershell
.\mvnw.cmd clean package -DskipTests
```

**4. Ejecutar los cuatro JAR en terminales independientes:**

```powershell
java -Xms64m -Xmx256m -jar .\target\NOMBRE_JAR.jar
```

**5. Iniciar Angular:**

```powershell
npm install
npx ng serve
```

**6. Abrir el sistema:**

http://localhost:4200

**7. Autenticarse con un usuario válido y realizar las pruebas funcionales correspondientes.**

---

## 27. Conclusión

Plaza de Comidas integra una aplicación frontend Angular con un backend de cuatro microservicios desarrollados con Java y Spring Boot.

La arquitectura hexagonal permite mantener separadas las reglas de negocio, los casos de uso y las implementaciones técnicas.

La aplicación proporciona operaciones diferenciadas para administradores, propietarios, empleados y clientes, cubriendo el ciclo de vida de los pedidos desde su creación hasta su entrega.

La implementación incorpora seguridad mediante JWT, persistencia MySQL, documentación de API con Swagger y funcionalidades de trazabilidad para facilitar el seguimiento de las operaciones.

El proyecto constituye una solución modular que puede extenderse con nuevas capacidades sin concentrar todas las responsabilidades en una única aplicación.
