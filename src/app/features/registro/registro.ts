
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  ClienteService,
  CrearClienteRequest
} from '../../core/services/cliente';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.scss'
})
export class Registro {
  private readonly clienteService = inject(ClienteService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly mostrarClave = signal(false);
  readonly mostrarConfirmacion = signal(false);

  datos: CrearClienteRequest = {
    nombre: '',
    apellido: '',
    documentoDeIdentidad: '',
    celular: '',
    correo: '',
    clave: ''
  };

  confirmarClave = '';

  alternarClave(): void {
    this.mostrarClave.update(valor => !valor);
  }

  alternarConfirmacion(): void {
    this.mostrarConfirmacion.update(valor => !valor);
  }

  registrar(): void {
    if (this.cargando()) {
      return;
    }

    this.error.set('');

    const datos: CrearClienteRequest = {
      nombre: this.datos.nombre.trim(),
      apellido: this.datos.apellido.trim(),
      documentoDeIdentidad:
        this.datos.documentoDeIdentidad.trim(),
      celular: this.datos.celular.trim(),
      correo: this.datos.correo.trim(),
      clave: this.datos.clave
    };

    if (Object.values(datos).some(valor => !valor)) {
      this.error.set('Todos los campos son obligatorios.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) {
      this.error.set('Ingresa un correo electrónico válido.');
      return;
    }

    if (!/^\d+$/.test(datos.documentoDeIdentidad)) {
      this.error.set(
        'El documento debe contener únicamente números.'
      );
      return;
    }

    if (!/^\+?\d{7,15}$/.test(datos.celular)) {
      this.error.set('Ingresa un número de celular válido.');
      return;
    }

    if (datos.clave.length < 8) {
      this.error.set(
        'La contraseña debe tener al menos 8 caracteres.'
      );
      return;
    }

    if (datos.clave !== this.confirmarClave) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.cargando.set(true);

    this.clienteService.registrarCliente(datos).subscribe({
      next: () => {
        this.cargando.set(false);

        this.router.navigate(['/login'], {
          queryParams: { registro: 'exitoso' }
        });
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
    const mensajeBackend =
      typeof err.error?.mensaje === 'string'
        ? err.error.mensaje
        : null;

    switch (err.status) {
      case 0:
        return 'No se pudo conectar con el servidor.';

      case 400:
        return mensajeBackend ??
          'Los datos del registro no son válidos.';

      case 409:
        return mensajeBackend ??
          'El correo o documento ya está registrado.';

      case 401:
      case 403:
        return 'El servidor rechazó la solicitud.';

      case 500:
      case 502:
      case 503:
        return 'El servidor presenta un problema. Intenta más tarde.';

      default:
        return mensajeBackend ??
          'No fue posible completar el registro.';
    }
  }
}
