// backend/utils/safety.js
// Detector de riesgo y respuesta de seguridad (ES-21, RF-14). AYUDA LIMITADA, no un sistema clínico ni una garantía:
// cero casos detectados no significa que no haya riesgo.
//
// LÍMITES CONOCIDOS (se prueban y se documentan en docs/elevation-skillmap/16-LIMITES-Y-FRONTERA-PRIVADA.md):
//  - Sobre-activa a propósito: no entiende negaciones ni modismos («quiero morir de risa», «no quiero morir»).
//  - No detecta lo que no reconoce: ironía, metáforas, otros idiomas, faltas de ortografía, mensajes muy indirectos.
//  - Solo analiza el mensaje actual, no el historial. Lista de palabras en BORRADOR: requiere revisión del especialista.
//  - ES-304: ANTES de evaluar se normaliza el texto para no evadir el detector con trucos triviales de escritura (caracteres de etiqueta, ancho completo, homoglifos, rellenos invisibles,
//    letras separadas, leet, letras alargadas). Es SOLO para evaluar: el texto que se guarda y se muestra no cambia. NO cubre lo semántico (indirectas, otros idiomas, emojis, jerga),
//    ni «sin espacios», ni faltas de ortografía: eso es del especialista (ES-44/46). Cero casos detectados sigue sin ser garantía.
//  - El nivel NUNCA se guarda, no se registra en logs y no sale de esta respuesta: no hay alertas ni transferencia a terceros.

const registryDefault = require('../config/supportResources.json');

const INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const flat = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(INVISIBLE, '').replace(/[\u2018\u2019\u02BC]/g, "'").toLowerCase().replace(/\s+/g, ' ');

// ── ES-304 · Normalización para EVALUAR (no cambia lo que se guarda ni se muestra) ─────────────────────────────────────────────────────────────────────────────────────────
// Rellenos que se ven en blanco y no son espacios (Hangul, braille, mongol, árabe, joiner gráfico) y marcas/formato Unicode que se intercalan entre letras.
const FILLERS = /[\u3164\u2800\u115F\u1160\uFFA0\u180E\u061C\u034F]/g;
const FILLER_TEST = new RegExp(FILLERS.source); // sin la bandera g: `.test` con /g recuerda la posición
const FORMAT_AND_MARKS = /[\p{Cf}\p{Mn}\p{Me}\uE000-\uF8FF]/gu; // \p{Cf} incluye los caracteres de etiqueta U+E0000–E007F y el ancho cero
// Homoglifos latino/cirílico/griego (sobre minúsculas): «quiero mоrir» con «о» cirílica. Dos tablas que se SUMAN: la manual de ES-304 (utils/homoglyphs-manual.js, manda sobre la otra) y la generada de ES-312
// (utils/confusables-table.js, desde UTS #39 con reglas acotadas: scripts/gen-confusables.cjs; la fuente está versionada en data/unicode/ y el servidor NUNCA descarga nada).
// LÍMITE (E304-3/ES-312, documentado a propósito): la tabla cubre letras latinas extendidas/IPA/versalitas, griegas, cirílicas, armenias, cherokee y lisu que UTS #39 equipara a UNA letra a-z; NFKC cubre
// ancho completo, letras matemáticas y «ſ». NO cubre CJK, símbolos, emojis, cifras de otras escrituras, mapeos de varias letras, otros alfabetos completos ni lo semántico. Una frase escrita con un
// carácter fuera de la tabla NO se detecta: es una ayuda, no una protección completa.
const MANUAL_HOMOGLYPHS = require('./homoglyphs-manual.js');
const TABLE_HOMOGLYPHS = require('./confusables-table.js');
const HOMOGLYPHS = { ...TABLE_HOMOGLYPHS, ...MANUAL_HOMOGLYPHS };
// Escaneos: solo las letras que SÍ están en la tabla (antes se miraba todo carácter no ASCII y se buscaba en la tabla; el resultado es el mismo —lo que no está en la tabla queda igual— pero un texto cirílico o
// griego de 4.000 caracteres ya no dispara 4.000 llamadas). El de SIEMPRE (ES-304) usa solo la tabla manual: es la «forma anterior»; nada que se detectaba antes deja de detectarse (la tabla nueva solo AÑADE formas).
// Las claves de la tabla que caen dentro de U+00A0–U+024F («ı» U+0131, «ĸ» U+0138) entran; el resto de ese rango son letras latinas acentuadas que NO se tocan.
const cpEscape = (cp) => '\\u{' + cp.toString(16) + '}';
const scanOf = (table) => new RegExp('[' + Object.keys(table).map((c) => cpEscape(c.codePointAt(0))).join('') + ']', 'gu');
const MANUAL_SCAN = scanOf(MANUAL_HOMOGLYPHS);
const FULL_SCAN = scanOf(HOMOGLYPHS);
// ¿El texto trae alguna letra de la tabla NUEVA? Solo entonces se evalúa además la forma con la tabla completa.
const NEW_KEYS = new RegExp(scanOf(TABLE_HOMOGLYPHS).source, 'u');
const LEET = { 4: 'a', 3: 'e', 1: 'i', 0: 'o', 5: 's', 7: 't', '@': 'a', $: 's' };
const TAG_BLOCK = /[\u{E0020}-\u{E007E}]/gu;

// Paso 1: NFKC (ancho completo, letras matemáticas), minúsculas, rellenos y marcas fuera, homoglifos a latín.
// `filler`: los rellenos que se ven en blanco se quitan (intercalados entre letras) o se toman por ESPACIO (separan palabras): se prueban las dos lecturas.
const makeUnmask = (table, scan) => (text, filler = '', lowered) => (lowered === undefined ? String(text).normalize('NFKC').toLowerCase() : lowered).replace(FILLERS, filler).replace(FORMAT_AND_MARKS, '').replace(scan, (c) => table[c] || c);
const unmaskManual = makeUnmask(MANUAL_HOMOGLYPHS, MANUAL_SCAN); // exactamente lo que hacía main
const unmask = makeUnmask(HOMOGLYPHS, FULL_SCAN); // con la tabla completa
// Paso 2: una frase escrita SOLO con caracteres de etiqueta (U+E0020–E007E) se decodifica a ASCII.
const decodeTags = (text) => Array.from(String(text).matchAll(TAG_BLOCK), (m) => String.fromCharCode(m[0].codePointAt(0) - 0xE0000)).join('');
// Paso 3: «s u i c i d i o» / «s.u.i.c.i.d.i.o» → «suicidio» (cuatro o más letras sueltas separadas).
const joinSpelled = (text) => text.replace(/(?<![a-z0-9@$])(?:[a-z\u00e0-\u00ff0-9@$][ ._\-*,]){3,}[a-z\u00e0-\u00ff0-9@$](?![a-z0-9@$])/gi, (m) => m.replace(/[ ._\-*,]/g, ''));
// Paso 3b: letras sueltas con las PALABRAS separadas por dos o más espacios o por «. .»: «n o   q u i e r o» → «no quiero».
const SPELLED_RUN = /(?<![a-z0-9@$])(?:[a-z\u00e0-\u00ff0-9@$'][ ._\-*,]){3,}[a-z\u00e0-\u00ff0-9@$'](?![a-z0-9@$])/i;
const SPELLED_WORD = /^(?:[a-z\u00e0-\u00ff0-9@$'](?:[ ._\-*,]|$))+$/i;
const spellWords = (text) => (!SPELLED_RUN.test(text) ? text : text.split(/\s{2,}|[._\-*,] [._\-*,]/).map((word) => (word.trim().length > 1 && SPELLED_WORD.test(word.trim()) ? word.replace(/[ ._\-*,]/g, '') : word)).join(' '));
// Paso 4: leet («qu13r0 m0r1r») y Paso 5: letras alargadas («quieroooo», «suiciiidio»); Paso 6: signos entre palabras («quiero,morir», «quiero-morir»).
const unleet = (text) => text.replace(/[43105@$7]/g, (c) => LEET[c] || c);
const squeeze = (text) => text.replace(/(.)\1{2,}/g, '$1').replace(/(.)\1/g, '$1');
const halve = (text) => text.replace(/(.)\1/g, '$1'); // letras DUPLICADAS («kkiillll» → «kill»): se prueba aparte porque «llll» no es «l»
const spaceOut = (text) => text.replace(/[^a-z\u00e0-\u00ff0-9']+/gi, ' ');

// Formas a evaluar, de forma PEREZOSA (generador): la actual primero (lo que ya se detectaba se sigue detectando igual) y después las normalizadas; no se calcula una forma
// hasta que hace falta (salida en la primera alta) y se saltan las repetidas. Texto «llano» (letras, cifras y signos comunes): los pasos de Unicode son no-ops y no se calculan.
// Costo: UNA sola pasada de `flat` (NFD + acentos) por texto; las formas derivadas se calculan sobre el texto YA plegado y solo se ordenan los espacios (`tidy`).
// E304-8: «llano» = ASCII visible + letras latinas acentuadas + ¡ ¿ « ». NO incluye ª º ¹ ² ³ ¨ ¯ ´ ¸ ni otros símbolos de Latin-1 que NFKC convierte o que se intercalan entre letras («quierº mºrir», «su¹c¹d¹o»).
const PLAIN = /^[\x20-\x7e\n\r\t\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u00a1\u00bf\u00ab\u00bb]*$/;
const tidy = (text) => text.replace(/\s+/g, ' ');
function* riskFormsWith(raw, unmask, fresh, nfkc = raw.normalize('NFKC'), lowered = nfkc.toLowerCase()) {
  const first = flat(raw); if (fresh(first)) yield first;
  const plain = PLAIN.test(raw);
  const open = plain ? raw.toLowerCase() : unmask(raw, '', lowered); // sin plegar: «letras separadas» y «palabras separadas» dependen de los espacios múltiples
  const base = plain ? first : flat(open); // plegado una vez; las derivadas parten de aquí
  if (!plain && fresh(base)) yield base;
  const joined = joinSpelled(open); const spelled = joined === open ? base : flat(joined);
  const split = spellWords(open); const words = split === open ? base : flat(split);
  for (const thunk of [() => spelled, () => words, () => tidy(unleet(spelled)), () => tidy(halve(spelled)), () => tidy(halve(words)), () => tidy(squeeze(unleet(spelled))), () => tidy(spaceOut(base)), () => tidy(spaceOut(spelled))]) { const f = thunk(); if (fresh(f)) yield f; }
  if (!plain && FILLER_TEST.test(nfkc)) {
    const spacedOpen = unmask(raw, ' ', lowered); const spaced = flat(spacedOpen); const spacedJoined = joinSpelled(spacedOpen);
    for (const thunk of [() => spaced, () => (spacedJoined === spacedOpen ? spaced : flat(spacedJoined)), () => tidy(spaceOut(spaced))]) { const f = thunk(); if (fresh(f)) yield f; }
  }
  const decoded = plain ? '' : decodeTags(raw); if (decoded) { const f = flat(unmask(decoded)); if (fresh(f)) yield f; }
}
// ES-312: la seguridad solo puede GANAR cobertura. Una letra de la tabla nueva usada como relleno entre palabras («quiero ı morir») deja de ser separador si se mapea a una letra; por eso primero se evalúan las
// formas de SIEMPRE (tabla manual) y solo después, si el texto trae alguna letra de la tabla nueva, las formas con la tabla completa. Lo que se detectaba antes se sigue detectando con el mismo nivel e idioma.
function* riskForms(text) {
  const raw = String(text); const seen = new Set();
  const fresh = (form) => { if (seen.has(form)) return false; seen.add(form); return true; };
  const plain = PLAIN.test(raw); const nfkc = plain ? raw : raw.normalize('NFKC'); const lowered = plain ? raw.toLowerCase() : nfkc.toLowerCase(); // UNA normalización por texto para las dos pasadas
  yield* riskFormsWith(raw, unmaskManual, fresh, nfkc, lowered);
  if (!plain && NEW_KEYS.test(lowered)) yield* riskFormsWith(raw, unmask, fresh, nfkc, lowered);
}

// Patrones sobre texto sin acentos, en minúsculas.
const HIGH = [
  { lang: 'es', re: /\bsuicid\w*/ },
  { lang: 'es', re: /\b(quiero|quisiera|voy a|pienso en|pensando en|ganas de|decidi)\s+(morir(me)?|matarme|suicidarme|acabar con (mi vida|todo)|quitarme la vida)\b/ },
  { lang: 'es', re: /\b(matarme|quitarme la vida|acabar con mi vida|terminar con mi vida)\b/ },
  // ES-92 (QA-92-01): el «me» antes del verbo, igual que «matarme» y «quitarme la vida».
  { lang: 'es', re: /(?<!\bno )\bme (quiero|quisiera|voy a|pienso|dan ganas de) (matar|quitar la vida|suicidar)\b/ },
  { lang: 'es', re: /\bno quiero (seguir )?viv(ir|iendo)\b/ },
  { lang: 'es', re: /\bno vale la pena (vivir|seguir viviendo)\b/ },
  { lang: 'es', re: /\bmejor (estar )?muert[oa]\b/ },
  // ES43-QA-02: ideación implícita («mejor que no estuviera aquí», «mejor me desaparezco»). «desaparecer de/del…» es otra cosa (redes, radar).
  // Acotadas a primera persona o a lugar/vida: «sería mejor que no estuviera lloviendo» o «mejor no existir en esa lista» no activan (QA ES43-QA-06).
  { lang: 'es', re: /\bmejor (que )?yo no (estuviera|estuviese|existiera|existiese)\b/ },
  { lang: 'es', re: /\bmejor (que )?no (estuviera|estuviese|existiera|existiese) (aqui|aca|en este mundo|en esta vida|vivo|viva|con vida)\b/ },
  { lang: 'es', re: /\bmejor no (estar|existir) (en este mundo|en esta vida|vivo|viva|con vida)\b/ },
  { lang: 'es', re: /\bmejor (me )?(desaparezco|desaparecer(me)?|desaparecia)\b(?!\s+de(l)?\b)/ },
  { lang: 'en', re: /\bsuicid\w*/ },
  { lang: 'en', re: /\b(kill(ing)? myself|(end|ending) my (own )?life|(take|taking) my (own )?life)\b/ },
  { lang: 'en', re: /\b(want|wanna|going|plan|planning|thinking of|thinking about)\s+(to\s+)?(die|end it all|end things)\b/ },
  { lang: 'en', re: /\bbetter off dead\b/ },
  // ES43-QA-02: ideación implícita («better if I wasn't here», «better if I disappeared»). «disappear from/off…» es otra cosa (redes).
  { lang: 'en', re: /\bbetter (off )?(if|that) i (just )?(wasn'?t|was not|weren'?t|were not) (here|around|alive|born)\b/ },
  { lang: 'en', re: /\bbetter (off )?(if|that) i (just )?(disappeared|disappear|didn'?t exist|did not exist|was gone|were gone)\b(?!\s+(from|off)\b)/ },
  { lang: 'en', re: /\bbetter off (not being (here|alive)|not existing)\b/ },
  { lang: 'en', re: /\bwish (i|that i) (was|were) dead\b/ }, // ES-92 (QA-92-01)
  // ES-92: «do not» y «wanna»; «live in/at/near…» es un lugar, no riesgo.
  { lang: 'en', re: /\b(don'?t|do not) (want to|wanna) (live(?!\s+(in|at|near)\b)|be alive|be here anymore)\b/ },
];
const MEDIUM = [
  { lang: 'es', re: /\b(hacerme dano|cortarme|lastimarme|desaparecer|todo esta perdido)\b/ },
  { lang: 'es', re: /\bautolesion\w*/ },
  // ES-92: «me quiero hacer daño / lastimar / cortar». «cortar» no activa con un objeto cotidiano («cortar el pelo»).
  { lang: 'es', re: /(?<!\bno )\bme (quiero|quisiera|voy a|pienso|dan ganas de) (hacer dano|lastimar\b)/ },
  { lang: 'es', re: /(?<!\bno )\bme (quiero|quisiera|voy a|pienso|dan ganas de) cortar(?!\s+(el|la|los|las|un|una|unos|unas|mi|mis|tu|su)\b)/ },
  { lang: 'es', re: /(?<!\bno )\bme (quiero|quisiera|voy a|pienso|dan ganas de) cortar (las venas|la piel|los brazos|el brazo|las munecas)\b/ },
  { lang: 'es', re: /\b(no aguanto mas|no puedo mas|ya no puedo)\b/ },
  { lang: 'en', re: /\b(hurt myself|harm myself|harming myself|cut myself|disappear)\b/ },
  { lang: 'en', re: /\bself[- ]?harm\w*/ },
  { lang: 'en', re: /\b(can'?t go on|can'?t take (it|this) anymore)\b/ },
];

// -> { level: 'high' | 'medium' | null, lang: 'es' | 'en' | null } (el idioma del patrón que coincidió; no es el país)
const united = (rules) => new RegExp(rules.map((rule) => '(?:' + rule.re.source + ')').join('|'));
const UNITED = { high: united(HIGH), medium: united(MEDIUM) }; // equivalente a probar cada regla: alguna coincide ⇔ la unión coincide
function matchForm(normalized) {
  for (const [level, rules] of [['high', HIGH], ['medium', MEDIUM]]) {
    if (!UNITED[level].test(normalized)) continue;
    const hit = rules.find((rule) => rule.re.test(normalized));
    if (hit) return { level, lang: hit.lang };
  }
  return { level: null, lang: null };
}
// ES-304: el nivel más alto que salga de CUALQUIER forma normalizada (alto antes que medio; la primera forma es la de siempre).
const { createHash } = require('crypto');
const MEMO_MAX = 1000; const memo = new Map();
function detectRisk(text) {
  const raw = String(text);
  const key = createHash('sha256').update(raw).digest('hex'); // SIEMPRE la huella completa (también en textos cortos): nunca se retiene el texto ni se recorta la clave
  const cached = memo.get(key); if (cached) return { level: cached.level, lang: cached.lang };
  const result = evaluate(raw);
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value); // FIFO acotada
  memo.set(key, { level: result.level, lang: result.lang });
  return result;
}
function evaluate(text) {
  let best = { level: null, lang: null };
  for (const form of riskForms(text)) {
    const hit = matchForm(form);
    if (hit.level === 'high') return hit;
    if (hit.level === 'medium' && best.level !== 'medium') best = hit;
  }
  return best;
}

const normalizeCountry = (value) => (typeof value === 'string' && /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : null);

// Un recurso se publica solo con fuente, verificador y una fecha de verificación válida y vigente.
function verifiedResources(country, registry = registryDefault, now = new Date()) {
  const code = normalizeCountry(country);
  const entry = code && registry && registry.countries ? registry.countries[code] : null;
  if (!entry || !Array.isArray(entry.resources)) return [];
  const maxAgeMs = (Number.isFinite(registry.maxAgeDays) ? registry.maxAgeDays : 180) * 24 * 3600 * 1000;
  const filled = (value) => typeof value === 'string' && value.trim().length > 0;
  return entry.resources.filter((resource) => {
    if (!resource || !['label', 'contact', 'source', 'verifiedBy', 'verifiedAt'].every((key) => filled(resource[key]))) return false;
    const verified = Date.parse(resource.verifiedAt);
    return Number.isFinite(verified) && verified <= now.getTime() && now.getTime() - verified <= maxAgeMs;
  }).map((resource) => ({
    label: resource.label.trim().slice(0, 80),
    contact: resource.contact.trim().slice(0, 120),
  }));
}

const TEXTS = {
  es: {
    high: 'Lo que cuentas es importante, y no tienes que cargarlo en soledad. Esto está más allá de lo que puedo acompañar aquí: Elevation no es un servicio de emergencias ni de atención en salud. '
      + 'Si estás en peligro inmediato o piensas en hacerte daño, comunícate ahora con los servicios de emergencia de tu país o con una persona de confianza que pueda estar contigo.',
    generic: 'Busca la línea de ayuda o los servicios de emergencia oficiales de tu país. Todavía no tenemos recursos verificados para mostrarte aquí.',
    listed: 'Recursos verificados en tu país:',
    close: 'Puedes volver a escribirme cuando quieras.',
    medium: 'Si en algún momento sientes que es demasiado, hablar con una persona de confianza o con un servicio de apoyo de tu país puede ayudarte.',
  },
  en: {
    high: 'What you are sharing matters, and you do not have to carry it alone. This is beyond what I can support here: Elevation is not an emergency or health service. '
      + 'If you are in immediate danger or thinking of hurting yourself, contact your local emergency services now, or someone you trust who can be with you.',
    generic: 'Look for the official helpline or emergency services in your country. We do not have verified resources to show you here yet.',
    listed: 'Verified resources in your country:',
    close: 'You can write to me again whenever you want.',
    medium: 'If at any point it feels like too much, talking to someone you trust or to a support service in your country can help.',
  },
};

const list = (items) => items.map((item) => `• ${item.label}: ${item.contact}`).join('\n');

// Respuesta de seguridad cuando se interrumpe el flujo ordinario (nivel grave). No diagnostica ni prescribe.
function buildSafetyReply({ lang = 'es', country = null, registry = registryDefault, now = new Date() } = {}) {
  const text = TEXTS[lang] ?? TEXTS.es;
  const resources = verifiedResources(country, registry, now);
  const middle = resources.length > 0 ? `${text.listed}\n${list(resources)}` : text.generic;
  return `${text.high}\n\n${middle}\n\n${text.close}`;
}

// Nota breve que acompaña la respuesta ordinaria cuando hay señales de malestar.
function buildSupportNote({ lang = 'es', country = null, registry = registryDefault, now = new Date() } = {}) {
  const text = TEXTS[lang] ?? TEXTS.es;
  const resources = verifiedResources(country, registry, now);
  return resources.length > 0 ? `${text.medium}\n${list(resources)}` : text.medium;
}

module.exports = { _steps: process.env.NODE_ENV === 'production' ? undefined : { flat, matchForm, FILLER_TEST, memoKeys: () => [...memo.keys()], clearMemo: () => memo.clear(), memoSize: () => memo.size, legacy: (text) => matchForm(flat(text)), unmask, decodeTags, joinSpelled, spellWords, unleet, squeeze, halve, spaceOut, riskForms, riskFormsWith, unmaskManual }, detectRisk, buildSafetyReply, buildSupportNote, verifiedResources, normalizeCountry };
