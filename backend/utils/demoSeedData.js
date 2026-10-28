// Datos y protecciones PURAS de la semilla de demostración (sin modelos ni base de datos, para poder probarlas solas). Ver demoSeed.js.
const skillSeed = require('../seeds/skillCatalogDraft.json');

const DEMO_EMAIL = 'demo.participante@example.invalid';
const MIN_PASSWORD = 12;
const LABEL_MARK = { es: '[SINTÉTICO] ', en: '[SYNTHETIC] ' };

class SeedError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Protección 1: bandera explícita de contenido sintético (producción nunca la define) y clave de la persona de demostración desde el entorno del operador.
function assertSeedAllowed(env = process.env) {
  if (env.ALLOW_SYNTHETIC_CATALOG !== 'true') {
    throw new SeedError('synthetic_not_allowed', 'Define ALLOW_SYNTHETIC_CATALOG=true solo en el entorno de pruebas o staging.');
  }
  const password = env.DEMO_USER_PASSWORD;
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw new SeedError('password_required', `Define DEMO_USER_PASSWORD (mínimo ${MIN_PASSWORD} caracteres) en el entorno del operador.`);
  }
}

const isSyntheticLabel = (labels) => Boolean(labels && typeof labels.es === 'string' && labels.es.startsWith(LABEL_MARK.es.trim()));

// Las 8 habilidades del borrador inicial, con rótulo sintético y la fuente/verificador/fecha que exige publicar.
function demoSkills(now = new Date()) {
  const verifiedAt = now.toISOString().slice(0, 10);
  return skillSeed.skills.map((skill) => ({
    skillKey: skill.skillKey,
    type: skill.type,
    labels: { es: LABEL_MARK.es + skill.labels.es, en: LABEL_MARK.en + skill.labels.en },
    rubric: { levels: skill.levels, source: 'Fuente sintética de demostración (no es contenido del cliente)', verifiedBy: 'Revisor sintético', verifiedAt },
  }));
}

// Tres evidencias confirmadas (sin origen del chat: no dependen del consentimiento del puente) y las autoevaluaciones que se apoyan en ellas.
// Las demás habilidades quedan sin evaluación a propósito: el mapa las muestra como «sin evidencia», nunca como cero.
const DEMO_EVIDENCE = [
  { requestId: 'demo-seed-evidence-001', skillKey: 'comunicacion', level: 3, title: '[SINTÉTICO] Presentación de resultados a un equipo',
    situation: 'Ejemplo sintético: había que explicar un cambio de proceso a un equipo de ocho personas.', responsibility: 'Preparar y presentar el mensaje.',
    action: 'Armé un resumen de una página y lo presenté con ejemplos.', delivered: 'Una presentación de 15 minutos con preguntas y respuestas.' },
  { requestId: 'demo-seed-evidence-002', skillKey: 'planificacion_organizacion', level: 2, title: '[SINTÉTICO] Calendario de entregas de un proyecto pequeño',
    situation: 'Ejemplo sintético: un proyecto con tres entregas y dos personas de apoyo.', responsibility: 'Ordenar tareas y fechas.',
    action: 'Dividí el trabajo por semanas y revisé el avance cada viernes.', delivered: 'Un calendario compartido con responsables.' },
  { requestId: 'demo-seed-evidence-003', skillKey: 'analisis_informacion', level: 3, title: '[SINTÉTICO] Revisión de un conjunto de datos de ventas',
    situation: 'Ejemplo sintético: una hoja con un año de ventas por producto.', responsibility: 'Encontrar los tres productos con mayor variación.',
    action: 'Ordené, agrupé por trimestre y comparé contra el año anterior.', delivered: 'Un resumen con tres hallazgos y sus limitaciones.' },
];

const assessRequestId = (item) => item.requestId.replace('evidence', 'assess');

function evidenceBody(item) {
  return {
    requestId: item.requestId, status: 'confirmed',
    payload: {
      title: item.title, situation: item.situation, responsibility: { text: item.responsibility }, actions: [{ text: item.action }],
      delivered: { text: item.delivered }, observedEffect: { known: false }, autonomy: 'autonomous',
    },
  };
}

module.exports = { DEMO_EMAIL, MIN_PASSWORD, LABEL_MARK, SeedError, assertSeedAllowed, isSyntheticLabel, demoSkills, DEMO_EVIDENCE, assessRequestId, evidenceBody };
