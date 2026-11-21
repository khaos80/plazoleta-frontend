
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

import { AuthService } from '../../core/auth/auth';
import {
  EstadoPedido,
  Pedido,
  PedidoService
} from '../../core/services/pedido';
import { obtenerMensajeHttp } from '../../core/utils/http-error';

@Component({
  selector: 'app-empleado',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empleado.html',
  styleUrl: './empleado.scss'
})
export class Empleado implements OnInit {
  private readonly pedidosApi = inject(PedidoService);
  private readonly auth = inject(AuthService);

  readonly estados: {
    valor: EstadoPedido;
    etiqueta: string;
    descripcion: string;
  }[] = [
    {
      valor: 'PENDIENTE',
      etiqueta: 'Pendientes',
      descripcion: 'Pedidos disponibles para asignación'
    },
    {
      valor: 'EN_PREPARACION',
      etiqueta: 'En preparación',
      descripcion: 'Pedidos que están siendo preparados'
    },
    {
      valor: 'LISTO',
      etiqueta: 'Listos',
      descripcion: 'Pedidos pendientes de entrega'
    },
    {
      valor: 'ENTREGADO',
      etiqueta: 'Entregados',
      descripcion: 'Pedidos entregados a sus clientes'
    },
    {
      valor: 'CANCELADO',
      etiqueta: 'Cancelados',
      descripcion: 'Pedidos que fueron cancelados'
    }
  ];

  readonly estadoSeleccionado = signal<EstadoPedido>('PENDIENTE');
  readonly pedidos = signal<Pedido[]>([]);
  readonly cargando = signal(false);
  readonly procesandoId = signal<number | null>(null);

  readonly errorListado = signal('');
  readonly errorOperacion = signal('');
  readonly mensajeExito = signal('');

  readonly paginaActual = signal(0);
  readonly totalPaginas = signal(0);
  readonly totalElementos = signal(0);

  readonly busqueda = signal('');
  readonly pedidoEntrega = signal<Pedido | null>(null);
  readonly pin = signal('');
  readonly pinTocado = signal(false);

  readonly operacionIndeterminada = signal(false);
  readonly descripcionOperacionIncierta = signal('');

  private numeroSolicitud = 0;

  readonly pedidosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    if (!texto) {
      return this.pedidos();
    }

    return this.pedidos().filter(pedido =>
      String(pedido.id).includes(texto) ||
      String(pedido.clienteId).includes(texto) ||
      String(pedido.restauranteId).includes(texto)
    );
  });

  readonly cantidadPlatosPagina = computed(() =>
    this.pedidos().reduce(
      (total, pedido) =>
        total + (pedido.platos ?? []).reduce(
          (suma, detalle) => suma + detalle.cantidad,
          0
        ),
      0
    )
  );

  readonly descripcionEstado = computed(() =>
    this.estados.find(
      estado => estado.valor === this.estadoSeleccionado()
    )?.descripcion ?? ''
  );

  readonly usuarioId = computed(() => {
    const id = Number(this.auth.usuario()?.sub);

    return Number.isSafeInteger(id) && id > 0
      ? id
      : null;
  });

  ngOnInit(): void {
    this.cargarPedidos(0);
  }

  seleccionarEstado(estado: EstadoPedido): void {
    if (
      this.estadoSeleccionado() === estado ||
      this.procesandoId() !== null
    ) {
      return;
    }

    this.estadoSeleccionado.set(estado);
    this.busqueda.set('');
    this.errorOperacion.set('');
    this.mensajeExito.set('');
    this.pedidoEntrega.set(null);
    this.pin.set('');
    this.pinTocado.set(false);

    this.cargarPedidos(0);
  }

  cargarPedidos(pagina = 0): void {
    if (pagina < 0) return;

    const solicitud = ++this.numeroSolicitud;
    const estado = this.estadoSeleccionado();

    this.cargando.set(true);
    this.errorListado.set('');
    this.pedidos.set([]);

    this.pedidosApi.listarPorEstado(estado, pagina, 10)
      .subscribe({
        next: respuesta => {
          if (solicitud !== this.numeroSolicitud) return;

          this.pedidos.set(respuesta.content ?? []);
          this.paginaActual.set(respuesta.page ?? pagina);
          this.totalPaginas.set(respuesta.totalPages ?? 0);
          this.totalElementos.set(respuesta.totalElements ?? 0);
          this.cargando.set(false);
        },
        error: error => {
          if (solicitud !== this.numeroSolicitud) return;

          this.errorListado.set(obtenerMensajeHttp(error));
          this.cargando.set(false);
        }
      });
  }

  actualizar(): void {
    if (this.procesandoId() !== null) return;
    this.cargarPedidos(this.paginaActual());
  }

  private iniciarOperacion(pedidoId: number): void {
    this.errorOperacion.set('');
    this.mensajeExito.set('');
    this.procesandoId.set(pedidoId);
  }

  private resultadoIncierto(error: unknown, operacion: string): void {
    if (
      error instanceof HttpErrorResponse &&
      (
        error.status === 0 ||
        error.status === 408 ||
        error.status >= 500
      )
    ) {
      this.operacionIndeterminada.set(true);
      this.descripcionOperacionIncierta.set(operacion);
    }
  }

  revisarOperacion(): void {
    this.operacionIndeterminada.set(false);
    this.descripcionOperacionIncierta.set('');
    this.errorOperacion.set('');
    this.pedidoEntrega.set(null);
    this.pin.set('');
    this.pinTocado.set(false);
    this.cargarPedidos(this.paginaActual());
  }

  asignarPedido(pedido: Pedido): void {
    if (
      pedido.estado !== 'PENDIENTE' ||
      this.procesandoId() !== null ||
      this.operacionIndeterminada()
    ) return;

    if (!window.confirm(
      `¿Deseas asignarte el pedido #${pedido.id}?`
    )) return;

    this.iniciarOperacion(pedido.id);

    this.pedidosApi.asignar(pedido.id).subscribe({
      next: () => {
        this.procesandoId.set(null);
        this.mensajeExito.set(
          `Pedido #${pedido.id} asignado correctamente. ` +
          'Puedes consultarlo en En preparación.'
        );
        this.cargarPedidos(this.paginaActual());
      },
      error: error => {
        this.procesandoId.set(null);
        this.errorOperacion.set(obtenerMensajeHttp(error));
        this.resultadoIncierto(
          error,
          `asignación del pedido #${pedido.id}`
        );

        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.cargarPedidos(this.paginaActual());
        }
      }
    });
  }

  marcarListo(pedido: Pedido): void {
    if (
      pedido.estado !== 'EN_PREPARACION' ||
      this.procesandoId() !== null ||
      this.operacionIndeterminada()
    ) return;

    if (!window.confirm(
      `¿Confirmas que el pedido #${pedido.id} está listo?`
    )) return;

    this.iniciarOperacion(pedido.id);

    this.pedidosApi.marcarListo(pedido.id).subscribe({
      next: respuesta => {
        this.procesandoId.set(null);
        this.mensajeExito.set(
          respuesta.mensaje || `Pedido #${pedido.id} marcado como listo.`
        );
        this.cargarPedidos(this.paginaActual());
      },
      error: error => {
        this.procesandoId.set(null);
        this.errorOperacion.set(obtenerMensajeHttp(error));
        this.resultadoIncierto(
          error,
          `cambio a LISTO del pedido #${pedido.id}`
        );

        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.cargarPedidos(this.paginaActual());
        }
      }
    });
  }

  abrirEntrega(pedido: Pedido): void {
    if (
      pedido.estado !== 'LISTO' ||
      this.procesandoId() !== null ||
      this.operacionIndeterminada()
    ) return;

    this.pedidoEntrega.set(pedido);
    this.pin.set('');
    this.pinTocado.set(false);
    this.errorOperacion.set('');
  }

  cerrarEntrega(): void {
    if (this.procesandoId() !== null) return;

    this.pedidoEntrega.set(null);
    this.pin.set('');
    this.pinTocado.set(false);
    this.errorOperacion.set('');
  }

  cambiarPin(valor: string): void {
    this.pin.set(valor);
    this.pinTocado.set(true);
    this.errorOperacion.set('');
  }

  errorPin(): string {
    const valor = this.pin();

    if (!valor) {
      return 'El PIN de seguridad es obligatorio.';
    }

    if (!/^\d+$/.test(valor)) {
      return 'El PIN solamente puede contener números.';
    }

    if (valor.length !== 6) {
      return 'El PIN debe contener exactamente 6 dígitos.';
    }

    return '';
  }

  entregarPedido(): void {
    const pedido = this.pedidoEntrega();

    this.pinTocado.set(true);
    this.errorOperacion.set('');

    if (
      !pedido ||
      this.errorPin() ||
      this.procesandoId() !== null ||
      this.operacionIndeterminada()
    ) return;

    this.iniciarOperacion(pedido.id);

    this.pedidosApi.entregar(pedido.id, this.pin()).subscribe({
      next: respuesta => {
        this.procesandoId.set(null);
        this.mensajeExito.set(
          respuesta.mensaje ||
          `Pedido #${pedido.id} entregado correctamente.`
        );
        this.pedidoEntrega.set(null);
        this.pin.set('');
        this.pinTocado.set(false);
        this.cargarPedidos(this.paginaActual());
      },
      error: error => {
        this.procesandoId.set(null);
        this.errorOperacion.set(obtenerMensajeHttp(error));
        this.resultadoIncierto(
          error,
          `entrega del pedido #${pedido.id}`
        );

        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.pedidoEntrega.set(null);
          this.pin.set('');
          this.cargarPedidos(this.paginaActual());
        }
      }
    });
  }

  puedeMarcarListo(pedido: Pedido): boolean {
    return pedido.estado === 'EN_PREPARACION' &&
      this.usuarioId() !== null &&
      pedido.empleadoAsignado === this.usuarioId();
  }

  estadoTexto(estado: EstadoPedido): string {
    switch (estado) {
      case 'PENDIENTE': return 'Pendiente';
      case 'EN_PREPARACION': return 'En preparación';
      case 'LISTO': return 'Listo';
      case 'ENTREGADO': return 'Entregado';
      case 'CANCELADO': return 'Cancelado';
    }
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }
}
