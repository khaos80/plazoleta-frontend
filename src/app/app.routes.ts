import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./features/registro/registro')
        .then(m => m.Registro)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login')
        .then(m => m.Login)
  },
  {
    path: 'administrador',
    canActivate: [authGuard],
    data: { roles: ['ADMINISTRADOR'] },
    loadComponent: () =>
      import('./features/administrador/administrador')
        .then(m => m.Administrador)
  },
  {
    path: 'propietario',
    canActivate: [authGuard],
    data: { roles: ['PROPIETARIO'] },
    loadComponent: () =>
      import('./features/propietario/propietario')
        .then(m => m.Propietario)
  },
  {
    path: 'empleado',
    canActivate: [authGuard],
    data: { roles: ['EMPLEADO'] },
    loadComponent: () =>
      import('./features/empleado/empleado')
        .then(m => m.Empleado)
  },
  {
    path: 'cliente',
    canActivate: [authGuard],
    data: { roles: ['CLIENTE'] },
    loadComponent: () =>
      import('./features/cliente/cliente')
        .then(m => m.Cliente)
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];