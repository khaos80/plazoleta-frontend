
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CrearEmpleadoRequest {
  nombre: string;
  apellido: string;
  documentoIdentidad: string;
  celular: string;
  correo: string;
  clave: string;
  idRol: 'EMPLEADO';
  restauranteId: number;
}

export interface CrearEmpleadoResponse {
  mensaje: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmpleadoService {
  private readonly http = inject(HttpClient);

  private readonly url =
    `${environment.api.users}/api/v1/empleados`;

  crear(
    datos: CrearEmpleadoRequest
  ): Observable<CrearEmpleadoResponse> {
    return this.http.post<CrearEmpleadoResponse>(
      this.url,
      datos
    );
  }
}
