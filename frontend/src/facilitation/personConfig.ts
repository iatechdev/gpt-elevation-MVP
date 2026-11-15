// ES-175 (HU-P24, decisión 10): mientras Mauricio no firme el contrato real, «Mis revisiones» lleva una franja VERDADERA de «función en validación».
// Al firmar se pone `true` y la franja desaparece (cambio de una línea + su prueba). NUNCA se muestra «datos ficticios/sintéticos» con datos reales (lo impide una prueba).
export const PERSON_REVIEWS_SIGNED = false
