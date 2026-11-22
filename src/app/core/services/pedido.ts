
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type EstadoPedido =
  | 'PENDIENTE'
  | 'EN_PREPARACION'
  | 'LISTO'
  | 'ENTREGADO'
  | 'CANCELADO';

export interface DetallePedidoRequest {
  platoId: number;
  cantidad: number;
}

export interface CrearPedidoRequest {
  restauranteId: number;
  platos: DetallePedidoRequest[];
}

export interface PedidoCreadoResponse {
  pedidoId: number;
  restauranteId: number;
  estado: EstadoPedido;
  platos: DetallePedidoRequest[];
}

export interface MensajeResponse {
  mensaje: string;
}

export interface Pedido {
  id: number;
  clienteId: number;
  restauranteId: number;
  platos: DetallePedidoRequest[];
  estado: EstadoPedido;
  empleadoAsignado: number | null;
}

export interface PaginaPedidos {
  content: Pedido[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface EntregarPedidoRequest {
  pin: string;
}

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.api.orders}/api/v1/pedidos`;

  // CLIENTE: crear pedido
  crear(datos: CrearPedidoRequest): Observable<PedidoCreadoResponse> {
    return this.http.post<PedidoCreadoResponse>(this.url, datos);
  }

  // CLIENTE: el backend identifica al cliente desde su JWT.
  obtenerMiPedidoActivo(): Observable<Pedido | null> {
    return this.http.get<Pedido>(`${this.url}/mi-pedido-activo`);
  }

  // CLIENTE: cancelar pedido
  cancelar(pedidoId: number): Observable<MensajeResponse> {
    return this.http.patch<MensajeResponse>(
      `${this.url}/${pedidoId}/cancelar`,
      null
    );
  }

  // Consultar trazabilidad
  consultarTrazabilidad(pedidoId: number): Observable<unknown> {
    return this.http.get<unknown>(
      `${this.url}/${pedidoId}/trazabilidad`
    );
  }

  // EMPLEADO: listar pedidos por estado
  listarPorEstado(
    estado: EstadoPedido,
    page = 0,
    size = 10
  ): Observable<PaginaPedidos> {
    const params = new HttpParams()
      .set('estado', estado)
      .set('page', page)
      .set('size', size);

    return this.http.get<PaginaPedidos>(this.url, { params });
  }

  // EMPLEADO: asignarse pedido
  asignar(pedidoId: number): Observable<Pedido> {
    return this.http.patch<Pedido>(
      `${this.url}/${pedidoId}/asignar`,
      null
    );
  }

  // EMPLEADO: marcar pedido como listo
  marcarListo(pedidoId: number): Observable<MensajeResponse> {
    return this.http.patch<MensajeResponse>(
      `${this.url}/${pedidoId}/listo`,
      null
    );
  }

  // EMPLEADO: entregar pedido mediante PIN
  entregar(
    pedidoId: number,
    pin: string
  ): Observable<MensajeResponse> {
    const datos: EntregarPedidoRequest = { pin };

    return this.http.patch<MensajeResponse>(
      `${this.url}/${pedidoId}/entregar`,
      datos
    );
  }
}
