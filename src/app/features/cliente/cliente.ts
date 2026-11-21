
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import {
  RestauranteService,
  RestauranteResumen
} from '../../core/services/restaurante';
import { PlatoService, Plato } from '../../core/services/plato';
import {
  PedidoService,
  PedidoCreadoResponse
} from '../../core/services/pedido';
import { AuthService } from '../../core/auth/auth';
import { obtenerMensajeHttp } from '../../core/utils/http-error';

type SeccionCliente = 'catalogo' | 'seguimiento';

interface ItemCarrito {
  plato: Plato;
  cantidad: number;
}

@Component({
  selector: 'app-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cliente.html',
  styleUrl: './cliente.scss'
})
export class Cliente implements OnInit {
  private readonly restaurantesApi = inject(RestauranteService);
  private readonly platosApi = inject(PlatoService);
  private readonly pedidosApi = inject(PedidoService);
  private readonly auth = inject(AuthService);

  readonly seccion = signal<SeccionCliente>('catalogo');

  readonly restaurantes = signal<RestauranteResumen[]>([]);
  readonly restaurante = signal<RestauranteResumen | null>(null);
  readonly platos = signal<Plato[]>([]);
  readonly carrito = signal<ItemCarrito[]>([]);

  readonly cargandoRestaurantes = signal(false);
  readonly cargandoPlatos = signal(false);
  readonly enviando = signal(false);
  readonly verificando = signal<number[]>([]);
  readonly consultando = signal(false);
  readonly cancelando = signal(false);

  readonly errorRestaurantes = signal('');
  readonly errorPlatos = signal('');
  readonly errorCarrito = signal('');
  readonly errorPedido = signal('');
  readonly errorConsulta = signal('');
  readonly exito = signal('');
  readonly exitoConsulta = signal('');

  readonly cantidades = signal<Record<number, string>>({});
  readonly cantidadesTocadas = signal<Record<number, boolean>>({});
  readonly imagenesFallidas = signal<Record<number, boolean>>({});

  readonly paginaRestaurantes = signal(0);
  readonly totalPaginasRestaurantes = signal(0);
  readonly paginaPlatos = signal(0);
  readonly totalPaginasPlatos = signal(0);
  readonly totalRestaurantes = signal(0);
  readonly totalPlatos = signal(0);

  readonly ultimoPedido = signal<PedidoCreadoResponse | null>(null);
  readonly trazabilidad = signal<unknown>(null);

  // Presentación derivada del historial devuelto por el backend.
  readonly seguimiento = computed(() => {
    const raw = this.trazabilidad();
    if (!raw || typeof raw !== 'object') return null;
    const datos = raw as { pedidoId?: number; historial?: Array<{
      estadoAnterior?: string | null;
      estadoNuevo?: string | null;
      fechaCambio?: string | null;
    }> };
    const historial = Array.isArray(datos.historial) ? datos.historial : [];
    const eventos = historial
      .filter(e => e && typeof e.estadoNuevo === 'string')
      .map(e => ({
        estado: String(e.estadoNuevo).toUpperCase(),
        fecha: e.fechaCambio ?? null
      }));
    const actual = eventos.length ? eventos[eventos.length - 1].estado : 'SIN_ESTADO';
    const cancelado = actual === 'CANCELADO';
    const etapas = [
      { codigo: 'PENDIENTE', titulo: 'Pedido recibido', descripcion: 'El restaurante recibió tu solicitud.' },
      { codigo: 'EN_PREPARACION', titulo: 'En preparación', descripcion: 'El equipo está preparando tus platos.' },
      { codigo: 'LISTO', titulo: 'Pedido listo', descripcion: 'La preparación ha finalizado.' },
      { codigo: 'ENTREGADO', titulo: 'Pedido entregado', descripcion: 'Tu pedido fue entregado.' }
    ];
    const indiceActual = etapas.findIndex(e => e.codigo === actual);
    const indiceAlcanzado = cancelado
      ? Math.max(0, ...eventos.map(e => etapas.findIndex(t => t.codigo === e.estado)))
      : indiceActual;
    return {
      pedidoId: datos.pedidoId ?? Number(this.pedidoIdConsulta()),
      estado: actual,
      cancelado,
      porcentaje: cancelado ? 0 : Math.max(0, (indiceActual + 1) * 25),
      etapas: etapas.map((etapa, indice) => {
        const evento = [...eventos].reverse().find(e => e.estado === etapa.codigo);
        return {
          ...etapa,
          completada: !!evento || (!cancelado && indice <= indiceActual),
          actual: !cancelado && indice === indiceActual,
          fecha: evento?.fecha ?? null,
          pendiente: !evento && (cancelado || indice > indiceAlcanzado)
        };
      }),
      cancelacion: [...eventos].reverse().find(e => e.estado === 'CANCELADO')?.fecha ?? null
    };
  });

  formatearFecha(fecha: string | null): string {
    if (!fecha) return 'Fecha no registrada';
    const valor = new Date(fecha);
    if (Number.isNaN(valor.getTime())) return fecha;
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium', timeStyle: 'short'
    }).format(valor);
  }

  nombreEstado(estado: string): string {
    const nombres: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      EN_PREPARACION: 'En preparación',
      LISTO: 'Listo para entregar',
      ENTREGADO: 'Entregado',
      CANCELADO: 'Cancelado'
    };
    return nombres[estado] ?? estado.replace(/_/g, ' ');
  }

  readonly envioIndeterminado = signal(false);
  readonly cancelacionIndeterminada = signal(false);

  readonly categoria = signal('');
  readonly busquedaPlatos = signal('');
  readonly pedidoIdConsulta = signal('');
  readonly consultaTocada = signal(false);

  private solicitudRestaurantes = 0;
  private solicitudPlatos = 0;
  private solicitudConsulta = 0;

  readonly platosFiltrados = computed(() => {
    const texto = this.busquedaPlatos().trim().toLowerCase();

    if (!texto) return this.platos();

    return this.platos().filter(plato =>
      plato.nombre.toLowerCase().includes(texto) ||
      plato.descripcion.toLowerCase().includes(texto) ||
      plato.categoria.toLowerCase().includes(texto) ||
      String(plato.id).includes(texto)
    );
  });

  readonly totalUnidades = computed(() =>
    this.carrito().reduce(
      (total, item) => total + item.cantidad,
      0
    )
  );

  readonly totalPrecio = computed(() =>
    this.carrito().reduce(
      (total, item) =>
        total + item.plato.precio * item.cantidad,
      0
    )
  );

  readonly carritoValido = computed(() => {
    const restauranteId = this.restaurante()?.id;

    return !!restauranteId &&
      this.carrito().length > 0 &&
      this.carrito().every(item =>
        item.plato.restauranteId === restauranteId &&
        item.plato.activo &&
        !item.plato.eliminado &&
        Number.isSafeInteger(item.cantidad) &&
        item.cantidad >= 1 &&
        item.cantidad <= 99
      );
  });

  ngOnInit(): void {
    this.cargarRestaurantes(0);
  }

  seleccionarSeccion(seccion: SeccionCliente): void {
    this.seccion.set(seccion);
  }

  cargarRestaurantes(pagina = 0): void {
    if (pagina < 0) return;

    const solicitud = ++this.solicitudRestaurantes;

    this.errorRestaurantes.set('');
    this.cargandoRestaurantes.set(true);

    this.restaurantesApi.listar(pagina, 10).subscribe({
      next: respuesta => {
        if (solicitud !== this.solicitudRestaurantes) return;

        this.restaurantes.set(respuesta.contenido ?? []);
        this.paginaRestaurantes.set(
          respuesta.paginaActual ?? pagina
        );
        this.totalPaginasRestaurantes.set(
          respuesta.totalPaginas ?? 0
        );
        this.totalRestaurantes.set(
          respuesta.totalElementos ?? 0
        );
        this.cargandoRestaurantes.set(false);
      },
      error: error => {
        if (solicitud !== this.solicitudRestaurantes) return;

        this.errorRestaurantes.set(
          obtenerMensajeHttp(error)
        );
        this.cargandoRestaurantes.set(false);
      }
    });
  }

  seleccionarRestaurante(item: RestauranteResumen): void {
    if (
      this.enviando() ||
      this.envioIndeterminado() ||
      this.verificando().length > 0
    ) return;

    if (this.restaurante()?.id === item.id) return;

    if (this.carrito().length > 0) {
      this.errorCarrito.set(
        'Tu carrito contiene platos de otro restaurante. ' +
        'Vacíalo antes de seleccionar uno diferente.'
      );
      return;
    }

    this.restaurante.set(item);
    this.platos.set([]);
    this.categoria.set('');
    this.busquedaPlatos.set('');
    this.cantidades.set({});
    this.cantidadesTocadas.set({});
    this.errorCarrito.set('');
    this.errorPedido.set('');
    this.imagenesFallidas.set({});

    this.cargarPlatos(0);
  }

  cargarPlatos(pagina = 0): void {
    const restauranteId = this.restaurante()?.id;

    if (!restauranteId || pagina < 0) return;

    const solicitud = ++this.solicitudPlatos;

    this.cargandoPlatos.set(true);
    this.errorPlatos.set('');
    this.platos.set([]);

    this.platosApi.listar(
      restauranteId,
      pagina,
      10,
      this.categoria()
    ).subscribe({
      next: respuesta => {
        if (
          solicitud !== this.solicitudPlatos ||
          this.restaurante()?.id !== restauranteId
        ) return;

        this.platos.set(respuesta.contenido ?? []);
        this.paginaPlatos.set(
          respuesta.paginaActual ?? pagina
        );
        this.totalPaginasPlatos.set(
          respuesta.totalPaginas ?? 0
        );
        this.totalPlatos.set(
          respuesta.totalElementos ?? 0
        );
        this.cargandoPlatos.set(false);

        this.cantidades.update(actual => {
          const copia = { ...actual };

          for (const plato of respuesta.contenido ?? []) {
            if (copia[plato.id] === undefined) {
              copia[plato.id] = '1';
            }
          }

          return copia;
        });
      },
      error: error => {
        if (solicitud !== this.solicitudPlatos) return;

        this.errorPlatos.set(
          obtenerMensajeHttp(error)
        );
        this.cargandoPlatos.set(false);
      }
    });
  }

  cambiarCategoria(valor: string): void {
    this.categoria.set(valor);
  }

  aplicarCategoria(): void {
    this.busquedaPlatos.set('');
    this.cargarPlatos(0);
  }

  marcarImagenFallida(id: number): void {
    this.imagenesFallidas.update(actual => ({
      ...actual,
      [id]: true
    }));
  }

  cambiarCantidad(
    id: number,
    valor: string | number | null
  ): void {
    this.cantidades.update(actual => ({
      ...actual,
      [id]: String(valor ?? '')
    }));

    this.cantidadesTocadas.update(actual => ({
      ...actual,
      [id]: true
    }));
  }

  errorCantidad(id: number): string {
    const valor = this.cantidades()[id] ?? '1';

    if (!valor.trim()) {
      return 'La cantidad es obligatoria.';
    }

    if (!/^\d+$/.test(valor)) {
      return 'La cantidad debe ser un número entero.';
    }

    const cantidad = Number(valor);

    if (
      !Number.isSafeInteger(cantidad) ||
      cantidad < 1
    ) {
      return 'La cantidad debe ser mayor que cero.';
    }

    if (cantidad > 99) {
      return 'La cantidad máxima permitida es 99.';
    }

    return '';
  }

  agregar(plato: Plato): void {
    if (
      this.enviando() ||
      this.envioIndeterminado()
    ) return;

    this.errorCarrito.set('');

    const seleccionado = this.restaurante();

    if (
      !seleccionado ||
      plato.restauranteId !== seleccionado.id
    ) {
      this.errorCarrito.set(
        'El plato no pertenece al restaurante seleccionado.'
      );
      return;
    }

    if (!plato.activo || plato.eliminado) {
      this.errorCarrito.set(
        'Este plato no está disponible.'
      );
      return;
    }

    this.cantidadesTocadas.update(actual => ({
      ...actual,
      [plato.id]: true
    }));

    if (this.errorCantidad(plato.id)) return;

    const cantidad = Number(
      this.cantidades()[plato.id] ?? '1'
    );

    const existente = this.carrito().find(
      item => item.plato.id === plato.id
    );

    if (
      existente &&
      existente.cantidad + cantidad > 99
    ) {
      this.errorCarrito.set(
        'No puedes agregar más de 99 unidades del mismo plato.'
      );
      return;
    }

    if (this.verificando().includes(plato.id)) return;

    this.verificando.update(ids => [
      ...ids,
      plato.id
    ]);

    // El backend exige platoId y restauranteId.
    this.platosApi.consultarDisponibilidad(
      plato.id,
      seleccionado.id
    )
      .pipe(
        finalize(() => {
          this.verificando.update(ids =>
            ids.filter(id => id !== plato.id)
          );
        })
      )
      .subscribe({
        next: disponible => {
          if (!disponible) {
            this.errorCarrito.set(
              `El plato "${plato.nombre}" ya no está disponible.`
            );
            return;
          }

          if (
            this.restaurante()?.id !== plato.restauranteId
          ) {
            this.errorCarrito.set(
              'El restaurante seleccionado cambió.'
            );
            return;
          }

          const actual = this.carrito().find(
            item => item.plato.id === plato.id
          );

          if (
            actual &&
            actual.cantidad + cantidad > 99
          ) {
            this.errorCarrito.set(
              'Se alcanzó el máximo de 99 unidades por plato.'
            );
            return;
          }

          this.carrito.update(items => {
            const itemActual = items.find(
              item => item.plato.id === plato.id
            );

            if (itemActual) {
              return items.map(item =>
                item.plato.id === plato.id
                  ? {
                      ...item,
                      cantidad:
                        item.cantidad + cantidad
                    }
                  : item
              );
            }

            return [
              ...items,
              { plato, cantidad }
            ];
          });

          this.cantidades.update(actual => ({
            ...actual,
            [plato.id]: '1'
          }));
        },
        error: error => {
          this.errorCarrito.set(
            obtenerMensajeHttp(error)
          );
        }
      });
  }

  aumentarCantidadCarrito(id: number): void {
    if (
      this.enviando() ||
      this.envioIndeterminado()
    ) return;

    this.carrito.update(items =>
      items.map(item =>
        item.plato.id === id && item.cantidad < 99
          ? {
              ...item,
              cantidad: item.cantidad + 1
            }
          : item
      )
    );
  }

  disminuirCantidadCarrito(id: number): void {
    if (
      this.enviando() ||
      this.envioIndeterminado()
    ) return;

    this.carrito.update(items =>
      items
        .map(item =>
          item.plato.id === id
            ? {
                ...item,
                cantidad: item.cantidad - 1
              }
            : item
        )
        .filter(item => item.cantidad > 0)
    );
  }

  quitar(id: number): void {
    if (
      this.enviando() ||
      this.envioIndeterminado()
    ) return;

    this.carrito.update(items =>
      items.filter(
        item => item.plato.id !== id
      )
    );

    this.errorCarrito.set('');
  }

  vaciar(): void {
    if (
      this.enviando() ||
      this.envioIndeterminado()
    ) return;

    this.carrito.set([]);
    this.errorCarrito.set('');
    this.errorPedido.set('');
  }

  crearPedido(): void {
    if (
      this.enviando() ||
      this.envioIndeterminado()
    ) return;

    this.errorPedido.set('');
    this.exito.set('');

    const seleccionado = this.restaurante();
    const items = this.carrito();

    if (
      !seleccionado ||
      !this.carritoValido()
    ) {
      this.errorPedido.set(
        'Selecciona un restaurante y verifica el carrito.'
      );
      return;
    }

    this.enviando.set(true);

    // Segunda verificación de disponibilidad
    // antes de enviar el pedido.
    forkJoin(
      items.map(item =>
        this.platosApi.consultarDisponibilidad(
          item.plato.id,
          seleccionado.id
        ).pipe(
          catchError(() => of(null))
        )
      )
    ).subscribe({
      next: resultados => {
        if (
          resultados.some(
            disponible => disponible !== true
          ) ||
          this.restaurante()?.id !== seleccionado.id
        ) {
          this.enviando.set(false);
          this.errorPedido.set(
            'No se pudo confirmar la disponibilidad de todos los platos.'
          );
          return;
        }

        this.pedidosApi.crear({
          restauranteId: seleccionado.id,
          platos: items.map(item => ({
            platoId: item.plato.id,
            cantidad: item.cantidad
          }))
        }).subscribe({
          next: pedido => {
            this.enviando.set(false);
            this.ultimoPedido.set(pedido);

            this.pedidoIdConsulta.set(
              String(pedido.pedidoId)
            );

            this.consultaTocada.set(false);
            this.trazabilidad.set(null);
            this.carrito.set([]);

            this.exito.set(
              `Pedido #${pedido.pedidoId} creado correctamente.`
            );
          },
          error: (error: HttpErrorResponse) => {
            this.enviando.set(false);

            if (
              error.status === 0 ||
              error.status === 408 ||
              error.status >= 500
            ) {
              this.envioIndeterminado.set(true);
              this.errorPedido.set(
                'No se pudo confirmar la creación. ' +
                'El pedido podría existir. ' +
                'No lo envíes nuevamente sin verificarlo.'
              );
              return;
            }

            this.errorPedido.set(
              obtenerMensajeHttp(error)
            );
          }
        });
      },
      error: error => {
        this.enviando.set(false);
        this.errorPedido.set(
          obtenerMensajeHttp(error)
        );
      }
    });
  }

  cambiarIdConsulta(valor: string): void {
    this.pedidoIdConsulta.set(valor);
    this.consultaTocada.set(true);
    this.errorConsulta.set('');
    this.exitoConsulta.set('');
    this.trazabilidad.set(null);
    ++this.solicitudConsulta;
  }

  errorIdPedido(): string {
    const valor = this.pedidoIdConsulta().trim();

    if (!valor) {
      return 'El número de pedido es obligatorio.';
    }

    if (
      !/^[1-9]\d*$/.test(valor) ||
      !Number.isSafeInteger(Number(valor))
    ) {
      return 'Ingresa un número de pedido válido y positivo.';
    }

    return '';
  }

  consultarUltimoPedido(): void {
    const pedido = this.ultimoPedido();

    if (!pedido) return;

    this.pedidoIdConsulta.set(
      String(pedido.pedidoId)
    );

    this.seccion.set('seguimiento');
    this.consultarPedido();
  }

  consultarPedido(): void {
    this.consultaTocada.set(true);
    this.errorConsulta.set('');
    this.exitoConsulta.set('');
    this.trazabilidad.set(null);

    if (
      this.errorIdPedido() ||
      this.consultando()
    ) return;

    const solicitud = ++this.solicitudConsulta;
    const pedidoId = Number(
      this.pedidoIdConsulta()
    );

    this.consultando.set(true);

    this.pedidosApi.consultarTrazabilidad(pedidoId)
      .pipe(
        finalize(() => {
          if (
            solicitud === this.solicitudConsulta
          ) {
            this.consultando.set(false);
          }
        })
      )
      .subscribe({
        next: respuesta => {
          if (
            solicitud !== this.solicitudConsulta
          ) return;

          this.trazabilidad.set(respuesta);
        },
        error: error => {
          if (
            solicitud !== this.solicitudConsulta
          ) return;

          this.errorConsulta.set(
            obtenerMensajeHttp(error)
          );
        }
      });
  }

  cancelarPedido(): void {
    this.consultaTocada.set(true);
    this.errorConsulta.set('');
    this.exitoConsulta.set('');

    if (
      this.errorIdPedido() ||
      this.cancelando() ||
      this.consultando() ||
      this.cancelacionIndeterminada()
    ) return;

    const id = Number(
      this.pedidoIdConsulta()
    );

    if (
      !window.confirm(
        `¿Deseas solicitar la cancelación del pedido #${id}? ` +
        'El backend determinará si todavía puede cancelarse.'
      )
    ) return;

    this.cancelando.set(true);

    this.pedidosApi.cancelar(id)
      .pipe(
        finalize(() =>
          this.cancelando.set(false)
        )
      )
      .subscribe({
        next: respuesta => {
          this.exitoConsulta.set(
            respuesta.mensaje ||
            `Pedido #${id} cancelado correctamente.`
          );

          this.trazabilidad.set(null);

          if (
            this.ultimoPedido()?.pedidoId === id
          ) {
            this.ultimoPedido.update(actual =>
              actual
                ? {
                    ...actual,
                    estado: 'CANCELADO'
                  }
                : null
            );
          }
        },
        error: (error: HttpErrorResponse) => {
          this.errorConsulta.set(
            obtenerMensajeHttp(error)
          );

          if (
            error.status === 0 ||
            error.status === 408 ||
            error.status >= 500
          ) {
            this.cancelacionIndeterminada.set(true);

            this.errorConsulta.set(
              'No se pudo confirmar la cancelación. ' +
              'Consulta la trazabilidad antes de intentar nuevamente.'
            );
          }
        }
      });
  }

  revisarCancelacion(): void {
    this.cancelacionIndeterminada.set(false);
    this.errorConsulta.set('');
    this.consultarPedido();
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }
}
