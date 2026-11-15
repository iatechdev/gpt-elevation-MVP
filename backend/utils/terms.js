// backend/utils/terms.js
// ES-301 · Aceptación del aviso de privacidad y términos en el registro (versión y fecha, desde el SERVIDOR).
//
// La versión vigente sale de ESTA constante, nunca del cliente: el cliente solo declara qué versión vio y el servidor la compara con la vigente.
// MARCADOR (no se inventa texto legal): `version: null` hasta que Alejo apruebe el texto ES/EN con revisión legal y fije la versión inicial (ES-301, punto 3).
//   - Mientras `version` sea null el registro NO exige aceptación (el frontend de hoy no tiene casilla) y rechaza con 400 `terms_not_available` a quien envíe una
//     aceptación: guardar «aceptó la versión X» de un texto que no existe sería una promesa vacía.
//   - Con `version` fijada y `required: true` (se cambian JUNTOS, en el mismo PR que la casilla del frontend) el registro la exige.
// `required` solo tiene efecto con `version` fijada; así no se puede cerrar el registro por error con una constante a medias.
const TERMS = Object.freeze({ version: null, required: false });

class TermsError extends Error {
  constructor(code, es, en, extra = {}) { super(`${es} / ${en}`); this.status = 400; this.code = code; Object.assign(this, extra); }
}

const VERSION_SHAPE = /^[A-Za-z0-9._-]{1,32}$/;
const current = () => TERMS; // las pruebas lo sustituyen (terms.current = …); el código de la aplicación lo llama SIEMPRE a través del módulo

// Devuelve null (sin aceptación que guardar) o { termsVersion, acceptedAt }. `acceptedAt` lo pone el SERVIDOR; lo que el cliente mande como fecha se ignora.
function validate(body) {
  const config = module.exports.current();
  const hasAcceptance = Object.hasOwn(body, 'acceptedTerms') || Object.hasOwn(body, 'termsVersion');
  const enforced = config.required === true && typeof config.version === 'string' && config.version !== '';
  if (!hasAcceptance) {
    if (enforced) throw new TermsError('terms_required', 'Debes aceptar el aviso de privacidad y los términos.', 'You must accept the privacy notice and terms.', { currentVersion: config.version });
    return null;
  }
  if (body.acceptedTerms !== true) throw new TermsError('terms_not_accepted', 'Debes aceptar el aviso de privacidad y los términos.', 'You must accept the privacy notice and terms.');
  if (typeof body.termsVersion !== 'string' || !VERSION_SHAPE.test(body.termsVersion)) throw new TermsError('terms_version_invalid', 'Falta la versión del aviso o es inválida.', 'The notice version is missing or invalid.');
  if (typeof config.version !== 'string' || config.version === '') throw new TermsError('terms_not_available', 'Aún no hay una versión del aviso para aceptar.', 'There is no notice version to accept yet.');
  if (body.termsVersion !== config.version) throw new TermsError('terms_version_mismatch', 'La versión del aviso cambió. Recarga la página y vuelve a aceptar.', 'The notice version changed. Reload the page and accept again.', { currentVersion: config.version });
  return { termsVersion: config.version, acceptedAt: new Date() };
}

module.exports = { TERMS, TermsError, validate, current };
