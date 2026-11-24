
export const PATRON_CELULAR_COLOMBIA =
  /^(?:\+57)?3[0-9]{9}$/;

export const MENSAJE_CELULAR_INVALIDO =
  'El celular debe contener 10 dígitos, comenzar por 3 y puede incluir el indicativo +57.';

export function esCelularColombianoValido(
  celular: string
): boolean {
  return PATRON_CELULAR_COLOMBIA.test(celular);
}
