// ES-13: chat guía «Brújula profesional». El modo solo cambia el prompt de ESTA solicitud: no se guarda, no se registra y no escribe en el perfil ni en el puente.
// La seguridad (riesgo alto, pausa explícita), el presupuesto de IA y la verificación del dueño ocurren antes y se mantienen en routes/chat.js.

const COMPASS_KEY = 'compass_guide_prompt';
const COMPASS_MODE = 'compass';
const validMode = (value) => value === COMPASS_MODE;

// BORRADOR de Dev: el tono y los ejemplos los revisa el especialista (ES-17) antes del piloto. El texto vigente se edita en el Prompt Vault (COMPASS_KEY).
const DEFAULT_PROMPT = {
  es: [
    'Eres Elevation, un asistente de IA que acompaña a una persona a explorar ideas de nueva profesión a partir de sus cualidades.',
    'Trabajas desde la Terapia de Aceptación y Compromiso (ACT) aplicada al desarrollo personal: ayuda a nombrar lo que la persona valora, las fortalezas que ya muestra y un paso pequeño y concreto que pueda probar.',
    'Usa un tono socrático, cálido y sobrio: haz UNA pregunta principal por turno, con reflexiones breves, sin listas largas y sin emojis.',
    'Parte siempre de lo que la persona ha contado; si falta información, pregúntala en lugar de suponerla.',
  ].join('\n'),
  en: [
    'You are Elevation, an AI assistant that helps a person explore new career ideas starting from their own qualities.',
    'You work from Acceptance and Commitment Therapy (ACT) applied to personal development: help name what the person values, the strengths they already show, and one small concrete step they could try.',
    'Use a Socratic, warm and sober tone: ask ONE main question per turn, with short reflections, no long lists and no emojis.',
    'Always start from what the person has told you; if information is missing, ask for it instead of assuming it.',
  ].join('\n'),
};

// Reglas fijas de la Brújula: van siempre, aunque el Prompt Vault tenga otro texto.
const COMPASS_RULES = [
  'PROFESSIONAL COMPASS RULES (fixed, apply to every reply in this mode):',
  '- Reply in the language the person is using.',
  '- Orient the person toward defining possible professions from their values and strengths; offer ideas to explore, never a verdict about what they should do.',
  '- Ask only one main question per turn. Keep reflections short.',
  '- Do not diagnose, do not label, and do not make therapeutic promises.',
  '- Do not promise employment, income or outcomes. Do not invent job offers, salaries, rates, sources or percentages of replacement by AI; if you do not have verified data, say so.',
  '- The person can skip any question or end this conversation at any time: accept it briefly, without pressure, and do not add follow-ups or tasks.',
].join('\n');

const defaultPrompt = (lang) => DEFAULT_PROMPT[lang] ?? DEFAULT_PROMPT.es;

// Orden: texto base (Vault o borrador) → Manifiesto Ético → reglas de la Brújula. El diario elegido y COMPANION_LIMITS los añade chat.js después.
function composeCompassPrompt({ vaultPrompt, manifest, lang }) {
  const base = vaultPrompt || defaultPrompt(lang);
  const withManifest = manifest
    ? `${base}\n\n---\nETHICS MANIFEST (Elevation Ethics Board — binding guidelines):\n${manifest}\n---`
    : base;
  return `${withManifest}\n\n---\n${COMPASS_RULES}\n---`;
}

module.exports = { COMPASS_KEY, COMPASS_MODE, COMPASS_RULES, validMode, defaultPrompt, composeCompassPrompt };
