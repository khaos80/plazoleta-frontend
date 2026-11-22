
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CrearPropietarioRequest {
  nombre: string;
  apellido: string;
  documentoIdentidad: string;
  celular: string;
  fechaNacimiento: string;
  correo: string;
  contrasena: string;
}

export interface CrearPropietarioResponse {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  rol: string;
  mensaje: string;
}

export interface PropietarioResumen {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdministracionService {
  private readonly http = inject(HttpClient);

  listarPropietarios(): Observable<PropietarioResumen[]> {
    return this.http.get<PropietarioResumen[]>(
      `${environment.api.users}/api/v1/propietarios`
    );
  }

  crearPropietario(
    datos: CrearPropietarioRequest
  ): Observable<CrearPropietarioResponse> {
    return this.http.post<CrearPropietarioResponse>(
      `${environment.api.users}/api/v1/propietarios`,
      datos
    );
  }
}
