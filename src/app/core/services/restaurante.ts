
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RestauranteResumen {
  id: number;
  nombre: string;
  urlLogo: string | null;
  nit: string;
  propietarioId: number;
}

export interface MiRestaurante {
  id: number;
  nombre: string;
  nit: string;
  direccion: string;
  telefono: string;
  urlLogo: string | null;
  propietarioId: number;
}

export interface PaginaRestaurantes {
  contenido: RestauranteResumen[];
  paginaActual: number;
  tamanoPagina: number;
  totalElementos: number;
  totalPaginas: number;
}

export interface CrearRestauranteRequest {
  nombre: string;
  nit: string;
  direccion: string;
  telefono: string;
  urlLogo: string;
  propietarioId: number;
}

export interface RestauranteCreadoResponse {
  id: number;
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class RestauranteService {
  private readonly http = inject(HttpClient);

  private readonly url =
    `${environment.api.restaurants}/api/v1/restaurantes`;

  obtenerMiRestaurante(): Observable<MiRestaurante> {
    return this.http.get<MiRestaurante>(`${this.url}/mi-restaurante`);
  }

  obtenerMiRestauranteEmpleado(): Observable<MiRestaurante> {
    return this.http.get<MiRestaurante>(
      `${this.url}/mi-restaurante-empleado`
    );
  }

  listar(page = 0, size = 10): Observable<PaginaRestaurantes> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size);

    return this.http.get<PaginaRestaurantes>(this.url, { params });
  }

  listarPropietariosAsignados(): Observable<number[]> {
    return this.http.get<number[]>(
      `${this.url}/propietarios-asignados`
    );
  }

  verificarPropietario(
    restauranteId: number,
    usuarioId: number
  ): Observable<boolean> {
    return this.http.get<boolean>(
      `${this.url}/${restauranteId}/propietarios/${usuarioId}`
    );
  }

  crear(
    datos: CrearRestauranteRequest
  ): Observable<RestauranteCreadoResponse> {
    return this.http.post<RestauranteCreadoResponse>(
      this.url,
      datos
    );
  }
}
