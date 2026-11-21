
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from '../auth/auth';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const authService = inject(AuthService);
  const token = authService.obtenerToken();

  const urlsBackend = Object.values(environment.api);

  const esSolicitudBackend = urlsBackend.some(url =>
    req.url === url || req.url.startsWith(`${url}/`)
  );

  const esLogin = req.url ===
    `${environment.api.users}/api/v1/auth/login`;

  if (!token || !authService.estaAutenticado() ||
      !esSolicitudBackend || esLogin) {
    return next(req);
  }

  const solicitudAutenticada = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(solicitudAutenticada);
};
