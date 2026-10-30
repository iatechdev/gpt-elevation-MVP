// backend/utils/safety.js
// Detector de riesgo y respuesta de seguridad (ES-21, RF-14). AYUDA LIMITADA, no un sistema clínico ni una garantía:
// cero casos detectados no significa que no haya riesgo.
//
// LÍMITES CONOCIDOS (se prueban y se documentan en docs/elevation-skillmap/16-LIMITES-Y-FRONTERA-PRIVADA.md):
//  - Sobre-activa a propósito: no entiende negaciones ni modismos («quiero morir de risa», «no quiero morir»).
//  - No detecta lo que no reconoce: ironía, metáforas, otros idiomas, faltas de ortografía, mensajes muy indirectos.
//  - Solo analiza el mensaje actual, no el historial. Lista de palabras en BORRADOR: requiere revisión del especialista.
//  - El nivel NUNCA se guarda, no se registra en logs y no sale de esta respuesta: no hay alertas ni transferencia a terceros.

const registryDefault = require('../config/supportResources.json');

const INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const flat = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(INVISIBLE, '').replace(/[\u2018\u2019\u02BC]/g, "'").toLowerCase().replace(/\s+/g, ' ');

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
  { lang: 'es', re: /\bmejor (que )?(yo )?no (estuviera|estuviese|existiera|existiese|estar|existir|estaria|existiria)\b/ },
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
function detectRisk(text) {
  const normalized = flat(text);
  for (const [level, rules] of [['high', HIGH], ['medium', MEDIUM]]) {
    const hit = rules.find((rule) => rule.re.test(normalized));
    if (hit) return { level, lang: hit.lang };
  }
  return { level: null, lang: null };
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

module.exports = { detectRisk, buildSafetyReply, buildSupportNote, verifiedResources, normalizeCountry };
