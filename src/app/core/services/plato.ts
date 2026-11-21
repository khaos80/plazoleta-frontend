
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Plato {
  id: number;
  nombre: string;
  precio: number;
  descripcion: string;
  urlImagen: string | null;
  categoria: string;
  restauranteId: number;
  activo: boolean;
  eliminado: boolean;
}

export interface PaginaPlatos {
  contenido: Plato[];
  paginaActual: number;
  tamanoPagina: number;
  totalElementos: number;
  totalPaginas: number;
}

export interface CrearPlatoRequest {
  nombre: string;
  precio: number;
  descripcion: string;
  urlImagen: string;
  categoria: string;
  restauranteId: number;
}

export interface ModificarPlatoRequest {
  precio: number;
  descripcion: string;
}

export interface PlatoOperacionResponse {
  id: number;
  mensaje: string;
}

export interface EstadoPlatoResponse {
  id: number;
  activo: boolean;
  mensaje: string;
}

export interface MensajePlatoResponse {
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class PlatoService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.api.dishes;
  private readonly platosUrl = `${this.url}/api/v1/platos`;

  listar(
    restauranteId: number,
    page = 0,
    size = 10,
    categoria = ''
  ): Observable<PaginaPlatos> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size);

    if (categoria.trim()) {
      params = params.set('categoria', categoria.trim());
    }

    return this.http.get<PaginaPlatos>(
      `${this.url}/api/v1/restaurantes/${restauranteId}/platos`,
      { params }
    );
  }

  consultarDisponibilidad(
    platoId: number,
    restauranteId: number
  ): Observable<boolean> {
    const params = new HttpParams()
      .set('restauranteId', restauranteId);

    return this.http.get<boolean>(
      `${this.platosUrl}/${platoId}/disponibilidad`,
      { params }
    );
  }

  crear(datos: CrearPlatoRequest): Observable<PlatoOperacionResponse> {
    return this.http.post<PlatoOperacionResponse>(
      this.platosUrl,
      datos
    );
  }

  modificar(
    platoId: number,
    datos: ModificarPlatoRequest
  ): Observable<PlatoOperacionResponse> {
    return this.http.patch<PlatoOperacionResponse>(
      `${this.platosUrl}/${platoId}`,
      datos
    );
  }

  habilitar(platoId: number): Observable<EstadoPlatoResponse> {
    return this.http.patch<EstadoPlatoResponse>(
      `${this.platosUrl}/${platoId}/habilitar`,
      null
    );
  }

  deshabilitar(platoId: number): Observable<EstadoPlatoResponse> {
    return this.http.patch<EstadoPlatoResponse>(
      `${this.platosUrl}/${platoId}/deshabilitar`,
      null
    );
  }

  eliminar(platoId: number): Observable<MensajePlatoResponse> {
    return this.http.delete<MensajePlatoResponse>(
      `${this.platosUrl}/${platoId}`
    );
  }
}
