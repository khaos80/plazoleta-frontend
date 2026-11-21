import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PropietarioGuardado {
  id: number;
  nombre: string;
  correo: string;
}

export interface RolUsuarioResponse {
  rol: string;
}

@Injectable({ providedIn: 'root' })
export class PropietariosSelectorService {
  private readonly http = inject(HttpClient);
  private readonly clave = 'plazoleta_propietarios_locales_v1';
  readonly propietarios = signal<PropietarioGuardado[]>(this.leer());

  consultarRol(id: number): Observable<RolUsuarioResponse> {
    return this.http.get<RolUsuarioResponse>(
      `${environment.api.users}/api/v1/usuarios/${id}/rol`
    );
  }

  guardar(propietario: PropietarioGuardado): void {
    const actualizados = [
      ...this.propietarios().filter(p => p.id !== propietario.id),
      propietario
    ].sort((a, b) => a.nombre.localeCompare(b.nombre));
    this.propietarios.set(actualizados);
    try { localStorage.setItem(this.clave, JSON.stringify(actualizados)); } catch { /* almacenamiento no disponible */ }
  }

  private leer(): PropietarioGuardado[] {
    try {
      const datos: unknown = JSON.parse(localStorage.getItem(this.clave) ?? '[]');
      if (!Array.isArray(datos)) return [];
      return datos.filter((p): p is PropietarioGuardado =>
        !!p && Number.isSafeInteger(p.id) && p.id > 0 &&
        typeof p.nombre === 'string' && typeof p.correo === 'string'
      );
    } catch { return []; }
  }
}
