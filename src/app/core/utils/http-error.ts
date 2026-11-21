
import { HttpErrorResponse } from '@angular/common/http';

interface RespuestaError {
  mensaje?: unknown;
  message?: unknown;
  detalle?: unknown;
  detail?: unknown;
  errores?: unknown;
}

function textoSeguro(valor: unknown): string {
  return typeof valor === 'string'
    ? valor.trim()
    : '';
}

function extraerMensaje(error: HttpErrorResponse): string {
  const cuerpo: unknown = error.error;

  if (typeof cuerpo === 'string') {
    const texto = cuerpo.trim();

    if (!texto) return '';

    try {
      const json: unknown = JSON.parse(texto);
      return extraerMensajeObjeto(json) || texto;
    } catch {
      return texto.startsWith('<') ? '' : texto;
    }
  }

  return extraerMensajeObjeto(cuerpo);
}

function extraerMensajeObjeto(valor: unknown): string {
  if (
    !valor ||
    typeof valor !== 'object' ||
    Array.isArray(valor)
  ) {
    return '';
  }

  const datos = valor as RespuestaError;

  const mensaje =
    textoSeguro(datos.mensaje) ||
    textoSeguro(datos.message) ||
    textoSeguro(datos.detalle) ||
    textoSeguro(datos.detail);

  if (mensaje) return mensaje;

  if (Array.isArray(datos.errores)) {
    const mensajes = datos.errores
      .map(item => {
        if (typeof item === 'string') return item;

        if (item && typeof item === 'object') {
          const errorCampo = item as RespuestaError;

          return (
            textoSeguro(errorCampo.mensaje) ||
            textoSeguro(errorCampo.message)
          );
        }

        return '';
      })
      .filter(Boolean);

    return mensajes.join(' ');
  }

  return '';
}

export function obtenerMensajeHttp(
  error: unknown,
  predeterminado = 'Ocurrió un error inesperado.'
): string {

  if (!(error instanceof HttpErrorResponse)) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return predeterminado;
  }

  const mensajeBackend = extraerMensaje(error);

  switch (error.status) {

    case 0:
      return (
        'No se recibió respuesta del microservicio. ' +
        'Verifica la conexión, que el servicio esté ejecutándose ' +
        'y la configuración CORS. ' +
        'Si estabas guardando información, comprueba el resultado ' +
        'antes de repetir la operación.'
      );

    case 400:
      return mensajeBackend ||
        'La solicitud contiene datos inválidos. Revisa los campos.';

    case 401:
      return (
        'La sesión no es válida o ha expirado. ' +
        'Inicia sesión nuevamente.'
      );

    case 403:
      return mensajeBackend ||
        'No tienes permisos para realizar esta operación.';

    case 404:
      return mensajeBackend ||
        'El recurso solicitado no existe.';

    case 405:
      return (
        'El microservicio no permite el método HTTP utilizado.'
      );

    case 408:
      return (
        'El servidor tardó demasiado en responder. ' +
        'Verifica el resultado antes de repetir la operación.'
      );

    case 409:
      return mensajeBackend ||
        'Ya existe un registro incompatible o se produjo un conflicto.';

    case 413:
      return 'Los datos enviados superan el tamaño permitido.';

    case 415:
      return 'El formato de los datos enviados no es compatible.';

    case 422:
      return mensajeBackend ||
        'Los datos no cumplen las reglas de negocio.';

    case 429:
      return (
        'Se realizaron demasiadas solicitudes. ' +
        'Espera un momento antes de intentar nuevamente.'
      );

    case 500:
      return mensajeBackend ||
        'El microservicio presentó un error interno.';

    case 502:
      return 'El servidor intermediario recibió una respuesta inválida.';

    case 503:
      return 'El microservicio no está disponible temporalmente.';

    case 504:
      return (
        'El microservicio tardó demasiado en responder. ' +
        'Verifica si la operación se completó antes de repetirla.'
      );

    default:
      if (error.status >= 500) {
        return mensajeBackend ||
          `Error del servidor (HTTP ${error.status}).`;
      }

      if (error.status >= 400) {
        return mensajeBackend ||
          `No se pudo completar la solicitud (HTTP ${error.status}).`;
      }

      return mensajeBackend || predeterminado;
  }
}
