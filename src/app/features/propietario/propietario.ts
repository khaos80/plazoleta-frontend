
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth';
import { RestauranteService } from '../../core/services/restaurante';
import {
  PlatoService, Plato, CrearPlatoRequest, ModificarPlatoRequest
} from '../../core/services/plato';
import {
  EficienciaService, EficienciaPedido, EficienciaEmpleado
} from '../../core/services/eficiencia';
import {
  EmpleadoService, CrearEmpleadoRequest
} from '../../core/services/empleado';
import { obtenerMensajeHttp } from '../../core/utils/http-error';

type Seccion = 'platos' | 'empleados' | 'estadisticas';
type Apartado = 'disponibles' | 'deshabilitados' | 'crear';
type CampoPlato =
  'nombre' | 'precio' | 'descripcion' | 'urlImagen' | 'categoria';
type CampoEmpleado =
  'nombre' | 'apellido' | 'documentoIdentidad' |
  'celular' | 'correo' | 'clave' | 'confirmarClave';

interface FormularioPlato {
  nombre: string;
  precio: string;
  descripcion: string;
  urlImagen: string;
  categoria: string;
}

interface FormularioEmpleado {
  nombre: string;
  apellido: string;
  documentoIdentidad: string;
  celular: string;
  correo: string;
  clave: string;
  confirmarClave: string;
}

interface PlatoGuardado {
  id: number;
  restauranteId: number;
  nombre: string;
  categoria: string;
  precio: number;
  descripcion: string;
  urlImagen: string | null;
}

@Component({
  selector: 'app-propietario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './propietario.html',
  styleUrl: './propietario.scss'
})
export class Propietario {
  private readonly auth = inject(AuthService);
  private readonly restaurantesApi = inject(RestauranteService);
  private readonly platosApi = inject(PlatoService);
  private readonly eficienciaApi = inject(EficienciaService);
  private readonly empleadosApi = inject(EmpleadoService);

  readonly seccion = signal<Seccion>('platos');
  readonly apartado = signal<Apartado>('disponibles');

  readonly restauranteId = signal('');
  readonly restauranteTocado = signal(false);
  readonly restauranteActivo = signal<number | null>(null);
  readonly verificandoRestaurante = signal(false);
  readonly errorRestaurante = signal('');

  readonly platos = signal<Plato[]>([]);
  readonly platosDeshabilitados = signal<PlatoGuardado[]>([]);
  readonly busqueda = signal('');
  readonly categoriaFiltro = signal('');
  readonly imagenesFallidas = signal<Record<number, boolean>>({});
  readonly cargandoPlatos = signal(false);
  readonly errorPlatos = signal('');
  readonly pagina = signal(0);
  readonly totalPaginas = signal(0);
  readonly totalElementos = signal(0);
  readonly idRecuperacion = signal('');
  readonly procesandoId = signal<number | null>(null);

  readonly modoFormulario = signal<'crear' | 'editar' | null>(null);
  readonly platoEditando = signal<Plato | null>(null);
  readonly formulario = signal<FormularioPlato>(this.formularioVacio());
  readonly tocados = signal<Record<string, boolean>>({});
  readonly guardando = signal(false);
  readonly errorFormulario = signal('');

  readonly empleado = signal<FormularioEmpleado>(this.empleadoVacio());
  readonly tocadosEmpleado = signal<Record<string, boolean>>({});
  readonly mostrarClaveEmpleado = signal(false);
  readonly guardandoEmpleado = signal(false);
  readonly errorEmpleado = signal('');
  readonly exitoEmpleado = signal('');

  readonly mensajeExito = signal('');
  readonly errorOperacion = signal('');
  readonly operacionIndeterminada = signal(false);
  readonly descripcionOperacionIncierta = signal('');

  readonly eficienciaPedidos = signal<EficienciaPedido[]>([]);
  readonly ranking = signal<EficienciaEmpleado[]>([]);
  readonly cargandoEstadisticas = signal(false);
  readonly errorEstadisticas = signal('');

  private solicitudPlatos = 0;
  private solicitudEstadisticas = 0;
  private solicitudRestaurante = 0;

  readonly platosFiltrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const categoria = this.categoriaFiltro().trim().toLowerCase();

    return this.platos().filter(plato => {
      const texto =
        !termino ||
        plato.nombre.toLowerCase().includes(termino) ||
        String(plato.id).includes(termino) ||
        plato.descripcion.toLowerCase().includes(termino);

      const tipo =
        !categoria ||
        plato.categoria.toLowerCase() === categoria;

      return texto && tipo;
    });
  });

  readonly categorias = computed(() =>
    [...new Set(this.platos().map(p => p.categoria))]
      .sort((a, b) => a.localeCompare(b, 'es'))
  );

  private formularioVacio(): FormularioPlato {
    return {
      nombre: '', precio: '', descripcion: '',
      urlImagen: '', categoria: ''
    };
  }

  private empleadoVacio(): FormularioEmpleado {
    return {
      nombre: '',
      apellido: '',
      documentoIdentidad: '',
      celular: '',
      correo: '',
      clave: '',
      confirmarClave: ''
    };
  }

  private obtenerUsuarioId(): number | null {
    const sub = this.auth.usuario()?.sub;
    const id = Number(sub);

    return sub && Number.isSafeInteger(id) && id > 0
      ? id : null;
  }

  private claveAlmacenamiento(restauranteId: number): string {
    return `plazoleta-platos-inactivos-v1-${this.obtenerUsuarioId()}-${restauranteId}`;
  }

  private cargarDeshabilitados(restauranteId: number): void {
    try {
      const contenido = localStorage.getItem(
        this.claveAlmacenamiento(restauranteId)
      );
      const datos: unknown = contenido ? JSON.parse(contenido) : [];

      if (!Array.isArray(datos)) {
        this.platosDeshabilitados.set([]);
        return;
      }

      const validos = datos.filter((item): item is PlatoGuardado =>
        !!item &&
        typeof item === 'object' &&
        Number.isSafeInteger(item.id) &&
        item.id > 0 &&
        item.restauranteId === restauranteId &&
        typeof item.nombre === 'string' &&
        typeof item.categoria === 'string' &&
        typeof item.precio === 'number' &&
        typeof item.descripcion === 'string'
      );

      this.platosDeshabilitados.set(validos);
    } catch {
      this.platosDeshabilitados.set([]);
      this.errorOperacion.set(
        'No fue posible recuperar las referencias locales de platos.'
      );
    }
  }

  private guardarDeshabilitados(lista: PlatoGuardado[]): void {
    const id = this.restauranteActivo();
    if (id === null) return;

    this.platosDeshabilitados.set(lista);

    try {
      localStorage.setItem(
        this.claveAlmacenamiento(id),
        JSON.stringify(lista)
      );
    } catch {
      this.errorOperacion.set(
        'La operación se completó, pero no fue posible guardar ' +
        'la referencia local. Conserva el ID del plato.'
      );
    }
  }

  private agregarDeshabilitado(plato: Plato): void {
    const registro: PlatoGuardado = {
      id: plato.id,
      restauranteId: plato.restauranteId,
      nombre: plato.nombre,
      categoria: plato.categoria,
      precio: plato.precio,
      descripcion: plato.descripcion,
      urlImagen: plato.urlImagen
    };

    this.guardarDeshabilitados([
      ...this.platosDeshabilitados().filter(p => p.id !== plato.id),
      registro
    ]);
  }

  private quitarDeshabilitado(id: number): void {
    this.guardarDeshabilitados(
      this.platosDeshabilitados().filter(p => p.id !== id)
    );
  }

  cambiarRestauranteId(valor: string): void {
    this.restauranteId.set(valor);
    this.restauranteTocado.set(true);
    this.restauranteActivo.set(null);
    this.errorRestaurante.set('');
    this.errorOperacion.set('');
    this.mensajeExito.set('');
    this.errorEmpleado.set('');
    this.exitoEmpleado.set('');
    this.platos.set([]);
    this.platosDeshabilitados.set([]);
    this.eficienciaPedidos.set([]);
    this.ranking.set([]);
    this.modoFormulario.set(null);
    this.operacionIndeterminada.set(false);
    ++this.solicitudPlatos;
    ++this.solicitudEstadisticas;
    ++this.solicitudRestaurante;
  }

  errorIdRestaurante(): string {
    const valor = this.restauranteId().trim();

    if (!/^[1-9]\d*$/.test(valor)) {
      return 'Ingresa un ID entero y positivo.';
    }

    if (!Number.isSafeInteger(Number(valor))) {
      return 'El ID indicado no es válido.';
    }

    return '';
  }

  verificarRestaurante(): void {
    this.restauranteTocado.set(true);
    this.errorRestaurante.set('');

    if (this.errorIdRestaurante() || this.verificandoRestaurante()) {
      return;
    }

    const usuarioId = this.obtenerUsuarioId();

    if (usuarioId === null) {
      this.errorRestaurante.set(
        'No se pudo identificar al propietario. Inicia sesión nuevamente.'
      );
      return;
    }

    const restauranteId = Number(this.restauranteId());
    const solicitud = ++this.solicitudRestaurante;
    this.verificandoRestaurante.set(true);

    this.restaurantesApi.verificarPropietario(
      restauranteId, usuarioId
    ).subscribe({
      next: autorizado => {
        if (solicitud !== this.solicitudRestaurante) return;
        this.verificandoRestaurante.set(false);

        if (!autorizado) {
          this.errorRestaurante.set(
            'Este restaurante no pertenece al propietario autenticado.'
          );
          return;
        }

        this.restauranteActivo.set(restauranteId);
        this.seccion.set('platos');
        this.apartado.set('disponibles');
        this.cargarDeshabilitados(restauranteId);
        this.cargarPlatos(0);
      },
      error: error => {
        if (solicitud !== this.solicitudRestaurante) return;
        this.verificandoRestaurante.set(false);
        this.errorRestaurante.set(obtenerMensajeHttp(error));
      }
    });
  }

  seleccionarSeccion(seccion: Seccion): void {
    if (this.restauranteActivo() === null) return;

    this.seccion.set(seccion);
    this.errorOperacion.set('');

    if (seccion === 'estadisticas') {
      this.cargarEstadisticas();
    }
  }

  seleccionarApartado(apartado: Apartado): void {
    if (this.restauranteActivo() === null || this.guardando()) return;

    this.apartado.set(apartado);
    this.errorFormulario.set('');
    this.modoFormulario.set(null);

    if (apartado === 'crear') {
      this.formulario.set(this.formularioVacio());
      this.tocados.set({});
    }

    if (apartado === 'disponibles') {
      this.cargarPlatos(this.pagina());
    }
  }

  cargarPlatos(pagina = 0): void {
    const id = this.restauranteActivo();
    if (id === null || pagina < 0) return;

    const solicitud = ++this.solicitudPlatos;
    this.cargandoPlatos.set(true);
    this.errorPlatos.set('');

    this.platosApi.listar(id, pagina, 10).subscribe({
      next: respuesta => {
        if (
          solicitud !== this.solicitudPlatos ||
          this.restauranteActivo() !== id
        ) return;

        this.platos.set(respuesta.contenido ?? []);
        this.pagina.set(respuesta.paginaActual ?? pagina);
        this.totalPaginas.set(respuesta.totalPaginas ?? 0);
        this.totalElementos.set(respuesta.totalElementos ?? 0);
        this.cargandoPlatos.set(false);
      },
      error: error => {
        if (solicitud !== this.solicitudPlatos) return;
        this.errorPlatos.set(obtenerMensajeHttp(error));
        this.cargandoPlatos.set(false);
      }
    });
  }

  cambiarBusqueda(valor: string): void {
    this.busqueda.set(valor);
  }

  cambiarCategoria(valor: string): void {
    this.categoriaFiltro.set(valor);
  }

  marcarImagenFallida(id: number): void {
    this.imagenesFallidas.update(actual => ({
      ...actual, [id]: true
    }));
  }

  abrirEditar(plato: Plato): void {
    if (
      this.restauranteActivo() !== plato.restauranteId ||
      plato.eliminado
    ) return;

    this.platoEditando.set(plato);
    this.formulario.set({
      nombre: plato.nombre,
      precio: String(plato.precio),
      descripcion: plato.descripcion,
      urlImagen: plato.urlImagen ?? '',
      categoria: plato.categoria
    });
    this.tocados.set({});
    this.errorFormulario.set('');
    this.modoFormulario.set('editar');
  }

  cerrarFormulario(): void {
    if (this.guardando()) return;
    this.modoFormulario.set(null);
    this.platoEditando.set(null);
    this.errorFormulario.set('');
  }

  cambiarCampo(campo: CampoPlato, valor: string): void {
    this.formulario.update(actual => ({
      ...actual, [campo]: valor
    }));
    this.tocados.update(actual => ({
      ...actual, [campo]: true
    }));
    this.errorFormulario.set('');
  }

  tocarCampo(campo: CampoPlato): void {
    this.tocados.update(actual => ({
      ...actual, [campo]: true
    }));
  }

  errorCampo(campo: CampoPlato): string {
    const valor = this.formulario()[campo].trim();

    if (!valor) return 'Este campo es obligatorio.';

    if (campo === 'precio') {
      if (!/^\d+$/.test(valor)) {
        return 'El precio debe ser un número entero.';
      }

      const precio = Number(valor);

      if (
        !Number.isSafeInteger(precio) ||
        precio < 1 ||
        precio > 2147483647
      ) {
        return 'El precio debe estar entre 1 y 2.147.483.647 COP.';
      }
    }

    if (campo === 'urlImagen') {
      try {
        const url = new URL(valor);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return 'La URL debe utilizar HTTP o HTTPS.';
        }
      } catch {
        return 'Ingresa una URL válida.';
      }
    }

    return '';
  }

  formularioValido(): boolean {
    const campos: CampoPlato[] = this.modoFormulario() === 'editar'
      ? ['precio', 'descripcion']
      : ['nombre', 'precio', 'descripcion', 'urlImagen', 'categoria'];

    return campos.every(campo => !this.errorCampo(campo));
  }

  guardarPlato(): void {
    const id = this.restauranteActivo();
    const modo = this.modoFormulario() ??
      (this.apartado() === 'crear' ? 'crear' : null);

    if (
      id === null ||
      !modo ||
      this.guardando() ||
      this.operacionIndeterminada()
    ) return;

    const campos: CampoPlato[] = modo === 'editar'
      ? ['precio', 'descripcion']
      : ['nombre', 'precio', 'descripcion', 'urlImagen', 'categoria'];

    this.tocados.set(
      Object.fromEntries(campos.map(campo => [campo, true]))
    );

    if (!campos.every(campo => !this.errorCampo(campo))) return;

    const datos = this.formulario();
    this.guardando.set(true);
    this.errorFormulario.set('');
    this.mensajeExito.set('');

    if (modo === 'crear') {
      const solicitud: CrearPlatoRequest = {
        nombre: datos.nombre.trim(),
        precio: Number(datos.precio),
        descripcion: datos.descripcion.trim(),
        urlImagen: datos.urlImagen.trim(),
        categoria: datos.categoria.trim(),
        restauranteId: id
      };

      this.platosApi.crear(solicitud).subscribe({
        next: respuesta => {
          this.guardando.set(false);
          this.mensajeExito.set(
            `${respuesta.mensaje || 'Plato creado.'} ID: ${respuesta.id}.`
          );
          this.formulario.set(this.formularioVacio());
          this.tocados.set({});
          this.apartado.set('disponibles');
          this.cargarPlatos(0);
        },
        error: error => {
          this.guardando.set(false);
          this.errorFormulario.set(obtenerMensajeHttp(error));
          this.bloquearSiIncierto(error, 'creación de plato');
        }
      });

      return;
    }

    const plato = this.platoEditando();

    if (!plato) {
      this.guardando.set(false);
      return;
    }

    const solicitud: ModificarPlatoRequest = {
      precio: Number(datos.precio),
      descripcion: datos.descripcion.trim()
    };

    this.platosApi.modificar(plato.id, solicitud).subscribe({
      next: respuesta => {
        this.guardando.set(false);
        this.modoFormulario.set(null);
        this.platoEditando.set(null);
        this.mensajeExito.set(respuesta.mensaje || 'Plato actualizado.');
        this.cargarPlatos(this.pagina());
      },
      error: error => {
        this.guardando.set(false);
        this.errorFormulario.set(obtenerMensajeHttp(error));
        this.bloquearSiIncierto(error, 'modificación de plato');
      }
    });
  }

  cambiarEstado(plato: Plato): void {
    if (plato.activo) {
      this.deshabilitarPlato(plato);
    } else {
      this.habilitarPorId(plato.id);
    }
  }

  deshabilitarPlato(plato: Plato): void {
    if (
      this.procesandoId() !== null ||
      this.operacionIndeterminada() ||
      plato.eliminado
    ) return;

    if (!window.confirm(
      `¿Deshabilitar "${plato.nombre}" (ID ${plato.id})?`
    )) return;

    this.procesandoId.set(plato.id);
    this.errorOperacion.set('');
    this.mensajeExito.set('');

    this.platosApi.deshabilitar(plato.id).subscribe({
      next: respuesta => {
        this.procesandoId.set(null);
        this.agregarDeshabilitado(plato);
        this.mensajeExito.set(
          respuesta.mensaje || `Plato #${plato.id} deshabilitado.`
        );
        this.cargarPlatos(0);
      },
      error: error => {
        this.procesandoId.set(null);
        this.errorOperacion.set(obtenerMensajeHttp(error));
        this.bloquearSiIncierto(
          error, `deshabilitación del plato #${plato.id}`
        );
      }
    });
  }

  habilitarPorId(id: number): void {
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      this.procesandoId() !== null ||
      this.operacionIndeterminada()
    ) return;

    if (!window.confirm(
      `¿Habilitar el plato #${id}? Comprueba que pertenece a tu restaurante.`
    )) return;

    this.procesandoId.set(id);
    this.errorOperacion.set('');
    this.mensajeExito.set('');

    this.platosApi.habilitar(id).subscribe({
      next: respuesta => {
        this.procesandoId.set(null);
        this.quitarDeshabilitado(id);
        this.idRecuperacion.set('');
        this.mensajeExito.set(
          respuesta.mensaje || `Plato #${id} habilitado.`
        );
        this.cargarPlatos(0);
      },
      error: error => {
        this.procesandoId.set(null);
        this.errorOperacion.set(obtenerMensajeHttp(error));
        this.bloquearSiIncierto(
          error, `habilitación del plato #${id}`
        );
      }
    });
  }

  recuperarIdManual(): void {
    const valor = this.idRecuperacion().trim();

    if (
      !/^[1-9]\d*$/.test(valor) ||
      !Number.isSafeInteger(Number(valor))
    ) {
      this.errorOperacion.set('Ingresa un ID entero positivo válido.');
      return;
    }

    this.habilitarPorId(Number(valor));
  }

  eliminarPlato(plato: Plato): void {
    if (
      this.procesandoId() !== null ||
      this.operacionIndeterminada() ||
      plato.eliminado
    ) return;

    if (!window.confirm(
      `¿Eliminar lógicamente "${plato.nombre}" (ID ${plato.id})? ` +
      'Esta operación no tiene restauración disponible.'
    )) return;

    this.procesandoId.set(plato.id);
    this.errorOperacion.set('');
    this.mensajeExito.set('');

    this.platosApi.eliminar(plato.id).subscribe({
      next: respuesta => {
        this.procesandoId.set(null);
        this.mensajeExito.set(
          respuesta.mensaje || `Plato #${plato.id} eliminado.`
        );
        this.cargarPlatos(0);
      },
      error: error => {
        this.procesandoId.set(null);
        this.errorOperacion.set(obtenerMensajeHttp(error));
        this.bloquearSiIncierto(
          error, `eliminación del plato #${plato.id}`
        );
      }
    });
  }

  // GESTIÓN DE EMPLEADOS

  cambiarEmpleado(campo: CampoEmpleado, valor: string): void {
    this.empleado.update(actual => ({
      ...actual, [campo]: valor
    }));
    this.errorEmpleado.set('');
    this.exitoEmpleado.set('');
  }

  tocarEmpleado(campo: CampoEmpleado): void {
    this.tocadosEmpleado.update(actual => ({
      ...actual, [campo]: true
    }));
  }

  errorCampoEmpleado(campo: CampoEmpleado): string {
    const datos = this.empleado();
    const valor = datos[campo].trim();

    if (!valor) return 'Este campo es obligatorio.';

    switch (campo) {
      case 'nombre':
      case 'apellido':
        if (valor.length < 2 || valor.length > 80) {
          return 'Debe contener entre 2 y 80 caracteres.';
        }
        return '';

      case 'documentoIdentidad':
        return /^\d{6,10}$/.test(valor)
          ? '' : 'Ingresa un documento de 6 a 10 dígitos.';

      case 'celular':
        return /^\+?\d{10,13}$/.test(valor)
          ? '' : 'Ingresa un celular de 10 a 13 dígitos.';

      case 'correo':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)
          ? '' : 'Ingresa un correo electrónico válido.';

      case 'clave':
        return valor.length >= 8
          ? '' : 'La contraseña debe tener al menos 8 caracteres.';

      case 'confirmarClave':
        return datos.confirmarClave === datos.clave
          ? '' : 'Las contraseñas no coinciden.';
    }
  }

  empleadoValido(): boolean {
    const campos: CampoEmpleado[] = [
      'nombre', 'apellido', 'documentoIdentidad',
      'celular', 'correo', 'clave', 'confirmarClave'
    ];

    return campos.every(campo => !this.errorCampoEmpleado(campo));
  }

  registrarEmpleado(): void {
    const restauranteId = this.restauranteActivo();

    if (
      restauranteId === null ||
      this.guardandoEmpleado() ||
      this.operacionIndeterminada()
    ) return;

    const campos: CampoEmpleado[] = [
      'nombre', 'apellido', 'documentoIdentidad',
      'celular', 'correo', 'clave', 'confirmarClave'
    ];

    this.tocadosEmpleado.set(
      Object.fromEntries(campos.map(campo => [campo, true]))
    );

    if (!this.empleadoValido()) {
      this.errorEmpleado.set(
        'Corrige los campos señalados antes de registrar al empleado.'
      );
      return;
    }

    const datos = this.empleado();

    const solicitud: CrearEmpleadoRequest = {
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim(),
      documentoIdentidad: datos.documentoIdentidad.trim(),
      celular: datos.celular.trim(),
      correo: datos.correo.trim().toLowerCase(),
      clave: datos.clave,
      idRol: 'EMPLEADO',
      restauranteId
    };

    this.guardandoEmpleado.set(true);
    this.errorEmpleado.set('');
    this.exitoEmpleado.set('');

    this.empleadosApi.crear(solicitud).subscribe({
      next: respuesta => {
        this.guardandoEmpleado.set(false);
        this.empleado.set(this.empleadoVacio());
        this.tocadosEmpleado.set({});
        this.exitoEmpleado.set(
          respuesta.mensaje ||
          'Empleado registrado correctamente.'
        );
      },
      error: error => {
        this.guardandoEmpleado.set(false);
        this.errorEmpleado.set(obtenerMensajeHttp(error));
        this.bloquearSiIncierto(error, 'registro de empleado');
      }
    });
  }

  limpiarEmpleado(): void {
    if (this.guardandoEmpleado()) return;
    this.empleado.set(this.empleadoVacio());
    this.tocadosEmpleado.set({});
    this.errorEmpleado.set('');
    this.exitoEmpleado.set('');
  }

  private bloquearSiIncierto(error: unknown, accion: string): void {
    if (
      error instanceof HttpErrorResponse &&
      (error.status === 0 ||
       error.status === 408 ||
       error.status >= 500)
    ) {
      this.operacionIndeterminada.set(true);
      this.descripcionOperacionIncierta.set(accion);
    }
  }

  revisarEstadoActual(): void {
    this.operacionIndeterminada.set(false);
    this.descripcionOperacionIncierta.set('');
    this.errorOperacion.set('');
    this.cargarPlatos(this.pagina());
  }

  cargarEstadisticas(): void {
    const id = this.restauranteActivo();
    if (id === null) return;

    const solicitud = ++this.solicitudEstadisticas;
    this.cargandoEstadisticas.set(true);
    this.errorEstadisticas.set('');

    forkJoin({
      pedidos: this.eficienciaApi.consultarPedidos(id),
      empleados: this.eficienciaApi.consultarRanking(id)
    }).subscribe({
      next: respuesta => {
        if (
          solicitud !== this.solicitudEstadisticas ||
          this.restauranteActivo() !== id
        ) return;

        this.eficienciaPedidos.set(respuesta.pedidos ?? []);
        this.ranking.set(respuesta.empleados ?? []);
        this.cargandoEstadisticas.set(false);
      },
      error: error => {
        if (solicitud !== this.solicitudEstadisticas) return;
        this.errorEstadisticas.set(obtenerMensajeHttp(error));
        this.cargandoEstadisticas.set(false);
      }
    });
  }

  promedioPreparacion(): number | null {
    const valores = this.eficienciaPedidos()
      .map(p => p.tiempoPreparacionSegundos)
      .filter((v): v is number => v !== null);

    return valores.length
      ? valores.reduce((a, b) => a + b, 0) / valores.length
      : null;
  }

  promedioTotal(): number | null {
    const valores = this.eficienciaPedidos()
      .map(p => p.tiempoTotalSegundos)
      .filter((v): v is number => v !== null);

    return valores.length
      ? valores.reduce((a, b) => a + b, 0) / valores.length
      : null;
  }

  formatearTiempo(segundos: number | null): string {
    if (segundos === null || !Number.isFinite(segundos)) {
      return 'Sin datos';
    }

    return segundos < 60
      ? `${Math.round(segundos)} s`
      : `${(segundos / 60).toFixed(1)} min`;
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }
}
