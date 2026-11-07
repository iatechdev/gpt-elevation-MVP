// ES-191: revisión automática en el servidor de las guías de la IA (propuestas de profesionales y de administración).
// La revisión NUNCA aprueba: una guía válida queda «pendiente de aprobación humana» y una inválida queda rechazada con motivos.
// Las frases por categoría son datos (tabla PromptRules, editable por superadministración). Aquí solo viven el algoritmo y los
// detectores técnicos (secretos, correos, teléfonos) y los textos de los motivos.
// Limitación: es un filtro por frases; reduce el riesgo, no lo elimina. La aprobación humana sigue siendo obligatoria.
const { normalizeText, redactSecrets } = require('./promptSafety');

const MIN_CHARS = 50;
const maxChars = () => { const n = Number(process.env.PROMPT_MAX_CHARS); return Number.isInteger(n) && n >= MIN_CHARS ? n : 20000; };

const CATEGORIES = ['override', 'diagnosis', 'treatment', 'employment_promise'];
// Las instrucciones de «no hagas X» son legítimas: en estas categorías una negación cercana exime la coincidencia.
// En `override` no: «no ignores…» no deja de ser un intento si el resto dice lo contrario, y se revisa a mano.
const NEGATABLE = new Set(['diagnosis', 'treatment', 'employment_promise']);
const NEGATORS = new Set(['no', 'nunca', 'jamas', 'evita', 'evitar', 'evites', 'evitando', 'sin', 'ni', 'tampoco',
  'not', 'never', 'dont', 'doesnt', 'cant', 'cannot', 'avoid', 'avoiding', 'without', 'nor', 'wont']);
const NEGATION_WINDOW = 4;

const REASONS = {
  too_short: { es: `La guía es demasiado corta (mínimo ${MIN_CHARS} caracteres).`, en: `The guide is too short (minimum ${MIN_CHARS} characters).` },
  too_long: { es: 'La guía es demasiado larga.', en: 'The guide is too long.' },
  override: {
    es: 'Contiene una instrucción para ignorar o anular las reglas del producto, o para revelar instrucciones internas.',
    en: 'It contains an instruction to ignore or override the product rules, or to reveal internal instructions.',
  },
  diagnosis: {
    es: 'Pide diagnosticar o atribuir un trastorno a la persona. El producto no es clínico.',
    en: 'It asks to diagnose or to attribute a disorder to the person. The product is non-clinical.',
  },
  treatment: {
    es: 'Pide recetar, recomendar medicación o indicar un tratamiento. El producto no es clínico.',
    en: 'It asks to prescribe, recommend medication or indicate a treatment. The product is non-clinical.',
  },
  employment_promise: {
    es: 'Promete empleo o resultados garantizados.',
    en: 'It promises employment or guaranteed results.',
  },
  secret: {
    es: 'Contiene lo que parece una clave, un token o una cadena de conexión. Quítalo del texto.',
    en: 'It contains what looks like a key, a token or a connection string. Remove it from the text.',
  },
  personal_data: {
    es: 'Contiene lo que parece un correo electrónico o un teléfono. No pegues datos personales.',
    en: 'It contains what looks like an email address or a phone number. Do not paste personal data.',
  },
};

// Minúsculas, sin tildes, sin apóstrofos y con espacios simples: la comparación no depende de cómo se escriba.
// Los puntos, dos puntos, signos y saltos de línea se vuelven `|` (corte de oración, usado por la negación).
const fold = (text) => normalizeText(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/['’`]/g, '').replace(/[.;:!?\n]+/g, ' | ').replace(/[^a-z0-9%*|\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Frase de la regla -> expresión. `*` solo vale al FINAL de una palabra (prefijo: «diagnos*»); en cualquier otro sitio se ignora.
// Así cada comodín va seguido de un espacio o del final y la coincidencia no retrocede: sin riesgo de ReDoS aunque la frase
// la escriba una persona administradora (probado con `*a*a*a…b` y `(a+)+$` en test/es-191-review.test.cjs).
const toRegExp = (phrase) => {
  const folded = fold(phrase);
  if (!folded.replace(/[*\s|]/g, '')) return null;
  const words = folded.split(' ').filter((w) => w.replace(/\*/g, '')).map((w) => {
    const stem = w.replace(/\*/g, '').replace(/[.\\+?^${}()|[\]]/g, '\\$&');
    return w.endsWith('*') ? `${stem}[a-z0-9]*` : stem;
  });
  return new RegExp(`(?:^|[^a-z0-9])(${words.join(' ')})(?![a-z0-9])`, 'g');
};

const negated = (text, index) => {
  // La negación solo cuenta dentro de la misma oración: `|` marca el corte.
  const before = text.slice(0, index).split('|').pop().split(' ').filter(Boolean).slice(-NEGATION_WINDOW);
  return before.some((word) => NEGATORS.has(word));
};

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?:\+?\d[\s().-]?){8,}/;
const hasPersonalData = (text) => EMAIL.test(text) || (PHONE.test(text) && (text.match(PHONE)[0].match(/\d/g) || []).length >= 8);

/**
 * rules: [{ id, category, locale, phrase }] activas. Devuelve { outcome: 'passed' | 'rejected', reasons: [{ code, category?, ruleId?, phrase? }] }.
 * 'passed' significa solo «sin hallazgos automáticos»: la guía sigue pendiente de aprobación humana.
 */
function reviewPrompt(content, rules) {
  const reasons = [];
  if (typeof content !== 'string') return { outcome: 'rejected', reasons: [{ code: 'too_short' }] };
  if (content.length > maxChars() * 2) return { outcome: 'rejected', reasons: [{ code: 'too_long' }] }; // no se recorre un texto enorme
  const raw = normalizeText(content);
  if (raw.length < MIN_CHARS) return { outcome: 'rejected', reasons: [{ code: 'too_short' }] };
  if (raw.length > maxChars()) return { outcome: 'rejected', reasons: [{ code: 'too_long' }] };
  const text = fold(raw);
  const seen = new Set();
  for (const rule of rules) {
    if (!CATEGORIES.includes(rule.category)) continue;
    const re = toRegExp(rule.phrase);
    if (!re) continue;
    for (const m of text.matchAll(re)) {
      const start = m.index + m[0].indexOf(m[1]);
      if (NEGATABLE.has(rule.category) && negated(text, start)) continue;
      if (seen.has(`${rule.category}:${rule.id}`)) break;
      seen.add(`${rule.category}:${rule.id}`);
      reasons.push({ code: rule.category, category: rule.category, ruleId: rule.id, phrase: String(rule.phrase).slice(0, 160) });
      break;
    }
  }
  if (redactSecrets(raw) !== raw) reasons.push({ code: 'secret' });
  if (hasPersonalData(raw)) reasons.push({ code: 'personal_data' });
  return { outcome: reasons.length ? 'rejected' : 'passed', reasons };
}

// Motivos legibles en ES y EN para la pantalla. No incluyen texto de la persona: solo la frase de la regla que saltó.
const describeReasons = (reasons) => (Array.isArray(reasons) ? reasons : []).map((r) => {
  const text = REASONS[r.code] || REASONS.override;
  return { code: r.code, category: r.category ?? null, phrase: r.phrase ?? null, es: text.es, en: text.en };
});

class PromptReviewError extends Error {
  constructor(code, reasons = []) { super(code); this.name = 'PromptReviewError'; this.code = code; this.reasons = reasons; }
}

// Reglas activas (datos). Si no se pueden leer, o no hay ninguna, NO se revisa «a ciegas»: se falla cerrado.
async function loadActiveRules(PromptRule) {
  let rows;
  try { rows = await PromptRule.findAll({ where: { active: true }, attributes: ['id', 'category', 'locale', 'phrase'], raw: true }); }
  catch { throw new PromptReviewError('rules_unavailable'); }
  if (!Array.isArray(rows) || !rows.length) throw new PromptReviewError('rules_unavailable');
  return rows;
}

module.exports = { MIN_CHARS, maxChars, CATEGORIES, REASONS, fold, toRegExp, reviewPrompt, describeReasons, loadActiveRules, PromptReviewError };
