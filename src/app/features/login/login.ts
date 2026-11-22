
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink
} from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/auth/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  correo = '';
  contrasena = '';

  readonly mostrarContrasena = signal(false);
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly registroExitoso =
    this.route.snapshot.queryParamMap.get('registro') === 'exitoso';

  alternarVisibilidadContrasena(): void {
    this.mostrarContrasena.update(valor => !valor);
  }

  iniciarSesion(): void {
    if (this.cargando()) {
      return;
    }

    this.error.set('');

    const correo = this.correo.trim();

    if (!correo || !this.contrasena) {
      this.error.set('Completa los campos obligatorios.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      this.error.set('Ingresa un correo electrónico válido.');
      return;
    }

    this.cargando.set(true);

    this.authService.login({
      correo,
      contrasena: this.contrasena
    }).subscribe({
      next: () => {
        this.cargando.set(false);

        if (!this.authService.estaAutenticado()) {
          this.error.set('No fue posible validar la sesión.');
          return;
        }

        this.router.navigateByUrl(
          this.authService.obtenerRutaPorRol()
        );
      },

      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(this.obtenerMensajeError(err));
      }
    });
  }

  private obtenerMensajeError(
    err: HttpErrorResponse
  ): string {
    switch (err.status) {
      case 0:
        return 'No se pudo conectar con el servidor.';

      case 400:
        return 'Los datos ingresados no son válidos.';

      case 401:
        return 'Correo electrónico o contraseña incorrectos.';

      case 403:
        return 'No tienes autorización para acceder.';

      case 429:
        return 'Demasiados intentos. Intenta más tarde.';

      case 500:
      case 502:
      case 503:
        return 'El servidor presenta un problema. Intenta más tarde.';

      default:
        return typeof err.error?.mensaje === 'string'
          ? err.error.mensaje
          : 'Ocurrió un error inesperado.';
    }
  }
}
