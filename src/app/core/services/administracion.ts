
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

export interface MensajeAdministracionResponse {
  mensaje: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdministracionService {
  private readonly http = inject(HttpClient);

  crearPropietario(
    datos: CrearPropietarioRequest
  ): Observable<MensajeAdministracionResponse> {
    return this.http.post<MensajeAdministracionResponse>(
      `${environment.api.users}/api/v1/propietarios`,
      datos
    );
  }
}
