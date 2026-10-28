// ES-16: explicit whole-message pauses. Not a universal intent classifier.
// Quotes, negations and contextual requests remain outside this small lexicon.
const { normalizeText } = require('./promptSafety');
const requests = {
  es: new Set(['quiero quedarme en silencio', 'silencio por favor', 'silencio', 'prefiero quedarme en silencio', 'quiero hacer una pausa']),
  en: new Set(['i want to sit in silence', 'please let me be quiet', 'silence please', 'silence', 'i would like to pause']),
};
const PAUSE_REPLY = {
  es: 'Está bien. Lo dejamos aquí.',
  en: 'That’s okay. We can stop here.',
};
const FALLBACK_REPLY = {
  es: 'No pudimos completar la respuesta. Puedes volver a intentarlo.',
  en: 'We could not complete the response. You can try again.',
};
function explicitPauseLanguage(message) {
  const text = normalizeText(message).toLowerCase().replace(/[,!.]+/g, ' ').replace(/\s+/g, ' ').trim();
  return Object.keys(requests).find(lang => requests[lang].has(text)) ?? null;
}
module.exports = { explicitPauseLanguage, PAUSE_REPLY, FALLBACK_REPLY };
