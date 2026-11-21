
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';

export type RolUsuario =
  | 'ADMINISTRADOR'
  | 'PROPIETARIO'
  | 'EMPLEADO'
  | 'CLIENTE';

export interface LoginRequest {
  correo: string;
  contrasena: string;
}

export interface LoginResponse {
  token: string;
  tipo: string;
  expiraEn: number;
}

export interface JwtPayload {
  sub: string;
  rol: RolUsuario;
  correo: string;
  exp: number;
  iat?: number;
  iss?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly TOKEN_KEY = 'plazoleta_token';

  readonly usuario = signal<JwtPayload | null>(
    this.obtenerUsuarioDesdeToken()
  );

  login(datos: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${environment.api.users}/api/v1/auth/login`,
      datos
    ).pipe(
      tap(respuesta => {
        sessionStorage.setItem(
          this.TOKEN_KEY,
          respuesta.token
        );

        this.usuario.set(
          this.decodificarToken(respuesta.token)
        );
      })
    );
  }

  obtenerToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  estaAutenticado(): boolean {
    const usuario = this.usuario();

    return !!usuario && usuario.exp * 1000 > Date.now();
  }

  obtenerRol(): RolUsuario | null {
    return this.estaAutenticado()
      ? this.usuario()?.rol ?? null
      : null;
  }

  obtenerRutaPorRol(): string {
    switch (this.obtenerRol()) {
      case 'ADMINISTRADOR':
        return '/administrador';

      case 'PROPIETARIO':
        return '/propietario';

      case 'EMPLEADO':
        return '/empleado';

      case 'CLIENTE':
        return '/cliente';

      default:
        return '/login';
    }
  }

  cerrarSesion(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    this.usuario.set(null);
    this.router.navigateByUrl('/login');
  }

  private obtenerUsuarioDesdeToken(): JwtPayload | null {
    const token = this.obtenerToken();

    return token ? this.decodificarToken(token) : null;
  }

  private decodificarToken(token: string): JwtPayload | null {
    try {
      const partePayload = token.split('.')[1];

      if (!partePayload) {
        return null;
      }

      const base64 = partePayload
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const json = atob(base64);

      const payload = JSON.parse(json) as JwtPayload;

      if (
        typeof payload.exp !== 'number' ||
        typeof payload.sub !== 'string' ||
        typeof payload.correo !== 'string' ||
        !['ADMINISTRADOR', 'PROPIETARIO', 'EMPLEADO', 'CLIENTE']
          .includes(payload.rol)
      ) {
        return null;
      }

      return payload.exp * 1000 > Date.now()
        ? payload
        : null;

    } catch {
      return null;
    }
  }
}
