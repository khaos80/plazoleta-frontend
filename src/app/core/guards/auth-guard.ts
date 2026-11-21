
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService, RolUsuario } from '../auth/auth';

export const authGuard: CanActivateFn = (route) => {

  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.estaAutenticado()) {
    return router.createUrlTree(['/login']);
  }

  const rolesPermitidos =
    route.data['roles'] as RolUsuario[] | undefined;

  if (
    rolesPermitidos &&
    !rolesPermitidos.includes(authService.obtenerRol()!)
  ) {
    return router.createUrlTree([
      authService.obtenerRutaPorRol()
    ]);
  }

  return true;
};
