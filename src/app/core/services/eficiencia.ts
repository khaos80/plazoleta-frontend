
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EstadoPedido } from './pedido';

export interface EficienciaPedido {
  pedidoId: number;
  restauranteId: number;
  empleadoId: number | null;
  estado: EstadoPedido;
  tiempoPreparacionSegundos: number | null;
  tiempoTotalSegundos: number | null;
}

export interface EficienciaEmpleado {
  empleadoId: number;
  pedidosCompletados: number;
  tiempoPromedioPreparacionSegundos: number;
}

@Injectable({ providedIn: 'root' })
export class EficienciaService {
  private readonly http = inject(HttpClient);
  private readonly url =
    `${environment.api.orders}/api/v1/restaurantes`;

  consultarPedidos(
    restauranteId: number
  ): Observable<EficienciaPedido[]> {
    return this.http.get<EficienciaPedido[]>(
      `${this.url}/${restauranteId}/pedidos/eficiencia`
    );
  }

  consultarRanking(
    restauranteId: number
  ): Observable<EficienciaEmpleado[]> {
    return this.http.get<EficienciaEmpleado[]>(
      `${this.url}/${restauranteId}/empleados/ranking`
    );
  }
}
