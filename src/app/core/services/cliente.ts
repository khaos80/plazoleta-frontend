
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface CrearClienteRequest {
  nombre: string;
  apellido: string;
  documentoDeIdentidad: string;
  celular: string;
  correo: string;
  clave: string;
}

export interface MensajeResponse {
  mensaje: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  private readonly http = inject(HttpClient);

  registrarCliente(
    datos: CrearClienteRequest
  ): Observable<MensajeResponse> {
    return this.http.post<MensajeResponse>(
      `${environment.api.users}/api/v1/clientes`,
      datos
    );
  }
}
