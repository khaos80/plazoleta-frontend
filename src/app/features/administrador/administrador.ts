
import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/auth/auth';

import {
  AdministracionService,
  CrearPropietarioRequest,
  CrearPropietarioResponse,
  PropietarioResumen
} from '../../core/services/administracion';

import {
  RestauranteService,
  RestauranteResumen,
  CrearRestauranteRequest
} from '../../core/services/restaurante';

import { obtenerMensajeHttp } from '../../core/utils/http-error';

type Seccion = 'propietarios' | 'restaurantes' | 'listado';

type CampoPropietario =
  keyof CrearPropietarioRequest | 'confirmarContrasena';

type CampoRestaurante = keyof CrearRestauranteRequest;

type FormularioPropietario =
  Record<CampoPropietario, string>;

type FormularioRestaurante =
  Record<CampoRestaurante, string>;

interface CampoFormulario<T extends string> {
  campo: T;
  etiqueta: string;
  tipo: string;
  placeholder: string;
  ayuda?: string;
}

@Component({
  selector: 'app-administrador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './administrador.html',
  styleUrl: './administrador.scss'
})
export class Administrador implements OnInit {

  private readonly auth = inject(AuthService);

  private readonly administracionApi =
    inject(AdministracionService);

  private readonly restaurantesApi =
    inject(RestauranteService);

  readonly seccion = signal<Seccion>('propietarios');

  readonly propietariosDisponibles = signal<PropietarioResumen[]>([]);
  readonly cargandoPropietarios = signal(false);
  readonly errorPropietarios = signal('');
  private solicitudPropietarios = 0;

  readonly guardando = signal(false);
  readonly error = signal('');
  readonly exito = signal('');
  readonly resultadoIndeterminado = signal(false);

  // Resultado real confirmado por user-service.
  readonly propietarioCreado =
    signal<CrearPropietarioResponse | null>(null);

  readonly propietario = signal<FormularioPropietario>(
    this.nuevoPropietario()
  );

  readonly restaurante = signal<FormularioRestaurante>(
    this.nuevoRestaurante()
  );

  readonly tocadosPropietario =
    signal<Record<string, boolean>>({});

  readonly tocadosRestaurante =
    signal<Record<string, boolean>>({});

  readonly mostrarContrasenas = signal(false);

  readonly busqueda = signal('');

  readonly imagenesFallidas =
    signal<Record<number, boolean>>({});

  readonly restaurantes = signal<RestauranteResumen[]>([]);
  readonly propietariosListado = signal<PropietarioResumen[]>([]);

  readonly cargandoListado = signal(false);
  readonly errorListado = signal('');

  readonly pagina = signal(0);
  readonly totalPaginas = signal(0);
  readonly totalElementos = signal(0);

  nombrePropietario(id: number): string {
    const propietario = this.propietariosListado().find(p => p.id === id);
    return propietario
      ? `${propietario.nombre} ${propietario.apellido}`
      : `Propietario #${id}`;
  }

  readonly restaurantesFiltrados = computed(() => {
    const termino = this.busqueda()
      .trim()
      .toLocaleLowerCase('es');

    if (!termino) {
      return this.restaurantes();
    }

    return this.restaurantes().filter(item =>
      item.nombre.toLocaleLowerCase('es').includes(termino) ||
      String(item.id).includes(termino) ||
      item.nit.includes(termino) ||
      this.nombrePropietario(item.propietarioId).toLocaleLowerCase('es').includes(termino)
    );
  });

  readonly totalVisibles = computed(
    () => this.restaurantesFiltrados().length
  );

  readonly camposPropietario:
    CampoFormulario<CampoPropietario>[] = [
      {
        campo: 'nombre',
        etiqueta: 'Nombre',
        tipo: 'text',
        placeholder: 'Ej. Carlos'
      },
      {
        campo: 'apellido',
        etiqueta: 'Apellido',
        tipo: 'text',
        placeholder: 'Ej. Martínez'
      },
      {
        campo: 'documentoIdentidad',
        etiqueta: 'Documento de identidad',
        tipo: 'text',
        placeholder: 'Entre 6 y 10 dígitos'
      },
      {
        campo: 'celular',
        etiqueta: 'Celular',
        tipo: 'tel',
        placeholder: 'Ej. 3001234567'
      },
      {
        campo: 'fechaNacimiento',
        etiqueta: 'Fecha de nacimiento',
        tipo: 'date',
        placeholder: '',
        ayuda: 'El propietario debe ser mayor de edad.'
      },
      {
        campo: 'correo',
        etiqueta: 'Correo electrónico',
        tipo: 'email',
        placeholder: 'correo@ejemplo.com'
      },
      {
        campo: 'contrasena',
        etiqueta: 'Contraseña',
        tipo: 'password',
        placeholder: 'Mínimo 8 caracteres'
      },
      {
        campo: 'confirmarContrasena',
        etiqueta: 'Confirmar contraseña',
        tipo: 'password',
        placeholder: 'Repite la contraseña'
      }
    ];

  readonly camposRestaurante:
    CampoFormulario<CampoRestaurante>[] = [
      {
        campo: 'nombre',
        etiqueta: 'Nombre del restaurante',
        tipo: 'text',
        placeholder: 'Ej. Sabor del Caribe'
      },
      {
        campo: 'nit',
        etiqueta: 'NIT',
        tipo: 'text',
        placeholder: 'NIT del establecimiento'
      },
      {
        campo: 'direccion',
        etiqueta: 'Dirección',
        tipo: 'text',
        placeholder: 'Dirección completa'
      },
      {
        campo: 'telefono',
        etiqueta: 'Teléfono',
        tipo: 'tel',
        placeholder: 'Teléfono de contacto'
      },
      {
        campo: 'urlLogo',
        etiqueta: 'URL del logo',
        tipo: 'url',
        placeholder: 'https://ejemplo.com/logo.png',
        ayuda: 'Utiliza una URL pública HTTP o HTTPS.'
      },
      {
        campo: 'propietarioId',
        etiqueta: 'Propietario disponible',
        tipo: 'select',
        placeholder: 'Selecciona un propietario',
        ayuda: 'Solo aparecen propietarios sin restaurante asignado.'
      }
    ];

  private solicitudListado = 0;

  ngOnInit(): void {
    this.cargarRestaurantes();
    this.cargarPropietariosDisponibles();
  }

  private nuevoPropietario(): FormularioPropietario {
    return {
      nombre: '',
      apellido: '',
      documentoIdentidad: '',
      celular: '',
      fechaNacimiento: '',
      correo: '',
      contrasena: '',
      confirmarContrasena: ''
    };
  }

  private nuevoRestaurante(): FormularioRestaurante {
    return {
      nombre: '',
      nit: '',
      direccion: '',
      telefono: '',
      urlLogo: '',
      propietarioId: ''
    };
  }

  seleccionarSeccion(valor: Seccion): void {
    if (this.guardando()) {
      return;
    }

    this.seccion.set(valor);
    this.error.set('');
    this.exito.set('');

    // No se elimina automáticamente el estado incierto.
    // Solo se desbloquea después de verificar la operación.
    if (valor === 'restaurantes') {
      this.cargarPropietariosDisponibles();
    }

    if (valor === 'listado') {
      this.cargarRestaurantes(this.pagina());
    }
  }

  cargarPropietariosDisponibles(): void {
    const solicitud = ++this.solicitudPropietarios;
    this.cargandoPropietarios.set(true);
    this.errorPropietarios.set('');

    forkJoin({
      propietarios: this.administracionApi.listarPropietarios(),
      asignados: this.restaurantesApi.listarPropietariosAsignados()
    }).pipe(
      finalize(() => {
        if (solicitud === this.solicitudPropietarios) {
          this.cargandoPropietarios.set(false);
        }
      })
    ).subscribe({
      next: ({ propietarios, asignados }) => {
        if (solicitud !== this.solicitudPropietarios) return;

        const ocupados = new Set(asignados);
        const disponibles = propietarios.filter(
          propietario => !ocupados.has(propietario.id)
        );
        this.propietariosDisponibles.set(disponibles);

        const seleccionado = Number(this.restaurante().propietarioId);
        if (!disponibles.some(p => p.id === seleccionado)) {
          const creado = this.propietarioCreado();
          const preferido = creado && disponibles.find(p => p.id === creado.id);
          this.restaurante.update(actual => ({
            ...actual,
            propietarioId: preferido ? String(preferido.id) : ''
          }));
        }
      },
      error: error => {
        if (solicitud !== this.solicitudPropietarios) return;
        this.propietariosDisponibles.set([]);
        this.errorPropietarios.set(obtenerMensajeHttp(error));
      }
    });
  }

  cambiarPropietario(
    campo: CampoPropietario,
    valor: string
  ): void {
    this.propietario.update(actual => ({
      ...actual,
      [campo]: valor
    }));

    this.tocarPropietario(campo);
    this.error.set('');
    this.exito.set('');

    // Una nueva edición inicia otro intento de registro.
    // No se reutiliza la confirmación anterior.
    this.propietarioCreado.set(null);
  }

  tocarPropietario(campo: CampoPropietario): void {
    this.tocadosPropietario.update(actual => ({
      ...actual,
      [campo]: true
    }));
  }

  cambiarRestaurante(
    campo: CampoRestaurante,
    valor: string
  ): void {
    this.restaurante.update(actual => ({
      ...actual,
      [campo]: valor
    }));

    this.tocarRestaurante(campo);
    this.error.set('');
    this.exito.set('');
  }

  tocarRestaurante(campo: CampoRestaurante): void {
    this.tocadosRestaurante.update(actual => ({
      ...actual,
      [campo]: true
    }));
  }

  alternarVisibilidadContrasenas(): void {
    this.mostrarContrasenas.update(actual => !actual);
  }

  tipoCampoPropietario(
    item: CampoFormulario<CampoPropietario>
  ): string {
    if (
      item.tipo === 'password' &&
      this.mostrarContrasenas()
    ) {
      return 'text';
    }

    return item.tipo;
  }

  cambiarBusqueda(valor: string): void {
    this.busqueda.set(valor);
  }

  marcarImagenFallida(id: number): void {
    this.imagenesFallidas.update(actual => ({
      ...actual,
      [id]: true
    }));
  }

  imagenDisponible(item: RestauranteResumen): boolean {
    return !!item.urlLogo &&
      !this.imagenesFallidas()[item.id];
  }

  private validarUrl(valor: string): boolean {
    try {
      const url = new URL(valor);

      return (
        url.protocol === 'http:' ||
        url.protocol === 'https:'
      );
    } catch {
      return false;
    }
  }

  private esMayorDeEdad(fecha: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return false;
    }

    const partes = fecha.split('-').map(Number);
    const [anio, mes, dia] = partes;

    const nacimiento = new Date(anio, mes - 1, dia);

    if (
      nacimiento.getFullYear() !== anio ||
      nacimiento.getMonth() !== mes - 1 ||
      nacimiento.getDate() !== dia
    ) {
      return false;
    }

    const hoy = new Date();

    let edad = hoy.getFullYear() - anio;

    if (
      hoy.getMonth() + 1 < mes ||
      (
        hoy.getMonth() + 1 === mes &&
        hoy.getDate() < dia
      )
    ) {
      edad--;
    }

    return edad >= 18 && edad <= 120;
  }

  errorPropietario(campo: CampoPropietario): string {
    const datos = this.propietario();
    const valor = datos[campo].trim();

    if (!valor) {
      return 'Este campo es obligatorio.';
    }

    switch (campo) {
      case 'nombre':
      case 'apellido':
        return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/.test(valor)
          ? ''
          : 'Utiliza solamente letras y espacios.';

      case 'documentoIdentidad':
        return /^\d{6,10}$/.test(valor)
          ? ''
          : 'El documento debe tener entre 6 y 10 dígitos.';

      case 'celular':
        return /^(?:\+57)?3\d{9}$/.test(valor)
          ? ''
          : 'Ingresa un celular colombiano válido.';

      case 'fechaNacimiento':
        return this.esMayorDeEdad(valor)
          ? ''
          : 'Debe tener al menos 18 años. Verifica la fecha.';

      case 'correo':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)
          ? ''
          : 'Ingresa un correo electrónico válido.';

      case 'contrasena':
        return datos.contrasena.length >= 8
          ? ''
          : 'La contraseña debe tener al menos 8 caracteres.';

      case 'confirmarContrasena':
        return datos.confirmarContrasena === datos.contrasena
          ? ''
          : 'Las contraseñas no coinciden.';

      default:
        return '';
    }
  }

  errorRestaurante(campo: CampoRestaurante): string {
    const valor = this.restaurante()[campo].trim();

    if (!valor) {
      return 'Este campo es obligatorio.';
    }

    switch (campo) {
      case 'propietarioId':
        return this.propietariosDisponibles().some(
          propietario => String(propietario.id) === valor
        ) ? '' : 'Selecciona un propietario disponible.';

      case 'urlLogo':
        return this.validarUrl(valor)
          ? ''
          : 'Ingresa una URL HTTP o HTTPS válida.';

      default:
        return '';
    }
  }

  propietarioValido(): boolean {
    return this.camposPropietario.every(
      item => !this.errorPropietario(item.campo)
    );
  }

  restauranteValido(): boolean {
    return this.camposRestaurante.every(
      item => !this.errorRestaurante(item.campo)
    );
  }

  registrarPropietario(): void {
    this.tocadosPropietario.set(
      Object.fromEntries(
        this.camposPropietario.map(
          item => [item.campo, true]
        )
      )
    );

    if (
      !this.propietarioValido() ||
      this.guardando() ||
      this.resultadoIndeterminado()
    ) {
      return;
    }

    const datos = this.propietario();

    const solicitud: CrearPropietarioRequest = {
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim(),
      documentoIdentidad: datos.documentoIdentidad.trim(),
      celular: datos.celular.trim(),
      fechaNacimiento: datos.fechaNacimiento,
      correo: datos.correo.trim(),
      contrasena: datos.contrasena
    };

    this.guardando.set(true);
    this.error.set('');
    this.exito.set('');
    this.propietarioCreado.set(null);

    this.administracionApi
      .crearPropietario(solicitud)
      .pipe(
        finalize(() => this.guardando.set(false))
      )
      .subscribe({
        next: respuesta => {

          // Confirmar que el backend devolvió un ID válido.
          if (
            !Number.isSafeInteger(respuesta.id) ||
            respuesta.id <= 0
          ) {
            this.resultadoIndeterminado.set(true);

            this.error.set(
              'El servidor respondió, pero no devolvió ' +
              'un ID de propietario válido. Verifica ' +
              'si el usuario fue registrado antes de ' +
              'intentar nuevamente.'
            );

            return;
          }

          this.propietarioCreado.set(respuesta);
          this.propietariosDisponibles.update(actual => {
            if (actual.some(item => item.id === respuesta.id)) return actual;
            return [...actual, {
              id: respuesta.id, nombre: respuesta.nombre,
              apellido: respuesta.apellido, correo: respuesta.correo
            }];
          });

          this.propietario.set(this.nuevoPropietario());
          this.tocadosPropietario.set({});
          this.mostrarContrasenas.set(false);

          // El ID queda listo para crear su restaurante.
          this.restaurante.update(actual => ({
            ...actual,
            propietarioId: String(respuesta.id)
          }));

          this.tocadosRestaurante.update(actual => {
            const copia = { ...actual };
            delete copia['propietarioId'];
            return copia;
          });
        },

        error: error => {
          this.manejarErrorRegistro(error);
        }
      });
  }

  // Navega a la creación del restaurante y conserva
  // los demás datos que el administrador haya ingresado.
  crearRestauranteParaPropietario(): void {
    const creado = this.propietarioCreado();

    if (!creado || this.guardando()) {
      return;
    }

    this.restaurante.update(actual => ({
      ...actual,
      propietarioId: String(creado.id)
    }));

    this.seleccionarSeccion('restaurantes');
  }

  // Permite comenzar un nuevo registro sin conservar
  // el resultado anterior en pantalla.
  nuevoRegistroPropietario(): void {
    if (this.guardando()) {
      return;
    }

    this.propietarioCreado.set(null);
    this.propietario.set(this.nuevoPropietario());
    this.tocadosPropietario.set({});
    this.mostrarContrasenas.set(false);
    this.error.set('');
    this.exito.set('');
  }

  crearRestaurante(): void {
    this.tocadosRestaurante.set(
      Object.fromEntries(
        this.camposRestaurante.map(
          item => [item.campo, true]
        )
      )
    );

    if (
      !this.restauranteValido() ||
      this.guardando() ||
      this.resultadoIndeterminado() ||
      this.cargandoPropietarios() ||
      !!this.errorPropietarios()
    ) {
      return;
    }

    const datos = this.restaurante();

    const solicitud: CrearRestauranteRequest = {
      nombre: datos.nombre.trim(),
      nit: datos.nit.trim(),
      direccion: datos.direccion.trim(),
      telefono: datos.telefono.trim(),
      urlLogo: datos.urlLogo.trim(),
      propietarioId: Number(datos.propietarioId)
    };

    this.guardando.set(true);
    this.error.set('');
    this.exito.set('');

    this.restaurantesApi
      .crear(solicitud)
      .pipe(
        finalize(() => this.guardando.set(false))
      )
      .subscribe({
        next: respuesta => {
          this.exito.set(
            `${respuesta.mensaje || 'Restaurante creado.'} ` +
            `ID asignado: ${respuesta.id}.`
          );

          this.restaurante.set(this.nuevoRestaurante());
          this.tocadosRestaurante.set({});

          this.propietarioCreado.set(null);
          this.cargarPropietariosDisponibles();
          this.cargarRestaurantes(0);
        },

        error: error => {
          this.manejarErrorRegistro(error);
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.cargarPropietariosDisponibles();
          }
        }
      });
  }

  private manejarErrorRegistro(error: unknown): void {
    const mensaje = obtenerMensajeHttp(error);

    if (error instanceof HttpErrorResponse) {
      const estado = error.status;

      if (
        estado === 0 ||
        estado === 408 ||
        estado === 502 ||
        estado === 503 ||
        estado === 504 ||
        estado >= 500
      ) {
        this.resultadoIndeterminado.set(true);

        this.error.set(
          'No se pudo confirmar el resultado del registro. ' +
          'Comprueba si la operación se completó antes ' +
          'de volver a intentarlo. ' +
          mensaje
        );

        return;
      }
    }

    this.error.set(mensaje);
  }

  confirmarRevisionResultado(): void {
    if (this.guardando()) {
      return;
    }

    this.resultadoIndeterminado.set(false);
    this.error.set('');
    this.exito.set('');
  }

  cargarRestaurantes(pagina = 0): void {
    if (!Number.isInteger(pagina) || pagina < 0) {
      return;
    }

    const solicitud = ++this.solicitudListado;

    this.cargandoListado.set(true);
    this.errorListado.set('');

    forkJoin({
      respuesta: this.restaurantesApi.listar(pagina, 10),
      propietarios: this.administracionApi.listarPropietarios()
    }).subscribe({
      next: ({ respuesta, propietarios }) => {
        if (solicitud !== this.solicitudListado) {
          return;
        }

        this.restaurantes.set(respuesta.contenido ?? []);
        this.propietariosListado.set(propietarios);
        this.pagina.set(respuesta.paginaActual ?? pagina);
        this.totalPaginas.set(respuesta.totalPaginas ?? 0);
        this.totalElementos.set(respuesta.totalElementos ?? 0);

        this.imagenesFallidas.set({});
        this.cargandoListado.set(false);
      },

      error: error => {
        if (solicitud !== this.solicitudListado) {
          return;
        }

        this.errorListado.set(obtenerMensajeHttp(error));
        this.cargandoListado.set(false);
      }
    });
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }
}
