// ES-352 · Caracteres invisibles y de dirección en textos de persona: UNA utilidad con la tabla de decisión por campo.
//
//   Campo                              | Decisión
//   -----------------------------------|----------------------------------------------------------------------------------------------
//   NOMBRES (registro, invitación,     | SE RECHAZA (400 estable `invalid_name` / campo `name` en la solicitud profesional) si lleva
//   solicitud de profesional)          | caracteres de control, U+200B, U+200E/200F, U+202A–202E, U+2066–2069, U+2028/2029, U+FEFF
//                                      | (decisión de Infra, reversible por Mauricio/Alejo) y, además, los «tag» U+E0000–E007F y U+2060 (invisibles
//                                      | sin uso legítimo en un nombre; ES-287/ES-352). SE PERMITEN ZWNJ (U+200C: persa, otras escrituras),
//                                      | ZWJ (U+200D: emoji compuestos, escrituras índicas) y los selectores de variación (U+FE00–FE0F).
//                                      | Exige al menos un carácter visible (letra, marca o número) y cuenta la longitud en puntos de código.
//   TEXTO LIBRE (chat, diario, notas)  | NO se rechaza nada y se conserva lo escrito; solo la detección de crisis y la sanitización del prompt
//                                      | (utils/promptSafety.js, utils/safety.js) lo normalizan internamente, como hasta ahora.
//   CORREO                             | utils/emailGuard.js (ES-252) rechaza todo Cc/Cf/Zl/Zp/Co/Cn; no cambia.
//
//   ZWNJ/ZWJ en la barrera de la IA (utils/promptSafety.js): se CONSERVAN solo si hay UNO entre dos caracteres con significado (letra, marca, emoji), que es el uso legítimo
//   (persa, escrituras índicas, emoji compuestos); en los demás casos (en cadena, al borde, junto a espacios o signos) se quitan, que es como se esconde un mensaje.
//
// No normaliza NFC/NFD (el nombre no es un identificador) ni detecta homoglifos.

// ES-352 (E397-1, QA): blancos «de relleno», sin significado propio y con aspecto vacío (CGJ, marca árabe de letra [ALM], rellenos Hangul, separador mongol, reservado U+2065,
// controles de formato obsoletos U+206A–206F, braille en blanco, Hangul de relleno). NO incluye los selectores de variación (FE00–FE0F, U+180B–180D mongoles), que se permiten.
// La barrera de la IA (promptSafety.stripInvisible) quita esta misma lista: una sola fuente.
const BLANK_FILLERS_RE = /[\u{034F}\u{061C}\u{115F}\u{1160}\u{180E}\u{2065}\u{206A}-\u{206F}\u{2800}\u{3164}\u{FFA0}]/gu;
// Rechazados en nombres. \p{Cc}: controles C0/C1 (NUL, saltos de línea, tabulaciones, DEL…) y, al final, los blancos de relleno (la prueba comprueba que coinciden con BLANK_FILLERS_RE).
const FORBIDDEN_IN_NAME = /[\p{Cc}\u{200B}\u{200E}\u{200F}\u{2028}\u{2029}\u{202A}-\u{202E}\u{2060}\u{2066}-\u{2069}\u{FEFF}\u{E0000}-\u{E007F}\u{034F}\u{061C}\u{115F}\u{1160}\u{180E}\u{2065}\u{206A}-\u{206F}\u{2800}\u{3164}\u{FFA0}]/u;
// «Visible»: al menos una letra, un número o un símbolo/emoji (ES-324 admite nombres hechos solo de emoji). NO cuentan la puntuación, los espacios, ZWNJ/ZWJ, los selectores de variación
// ni una marca combinante suelta (E397-1: se dibuja como un círculo punteado o nada, no es un nombre).
const VISIBLE = /[\p{L}\p{N}\p{S}]/u;
// Los selectores de variación (U+FE00–FE0F, U+E0100–E01EF) son marcas (Mn) pero no se ven por sí solos: no cuentan como carácter visible.
const VARIATION_SELECTORS = /[\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}]/gu;
const MAX_NAME = 100;

const codePoints = (text) => [...text].length;

/** -> null si el nombre es válido; si no, el motivo estable: 'type' | 'empty' | 'too_long' | 'forbidden' | 'no_visible'. Nunca devuelve ni repite el texto recibido. */
function nameProblem(value, max = MAX_NAME) {
  if (typeof value !== 'string') return 'type';
  if (FORBIDDEN_IN_NAME.test(value)) return 'forbidden';
  const text = value.trim();
  if (!text) return 'empty';
  if (codePoints(text) > max) return 'too_long';
  if (!VISIBLE.test(text.replace(VARIATION_SELECTORS, ""))) return 'no_visible';
  return null;
}

const isValidName = (value, max = MAX_NAME) => nameProblem(value, max) === null;

module.exports = { MAX_NAME, FORBIDDEN_IN_NAME, BLANK_FILLERS_RE, nameProblem, isValidName, codePoints };
