// backend/utils/pilotFeedback.js
// ES-173 (HU-P22) · «Mi opinión» del piloto. Contrato 11613 aprobado por delegación de Mauricio (decisiones 11887):
//   - permiso NUEVO `pilot_feedback` (alcance `default`), separado de `research`; versionado (REQUIRED_VERSION) y revocable;
//   - UNA respuesta por persona y ventana (`day7` | `day30`); catálogo CERRADO (sin texto libre); todas las preguntas son opcionales pero al menos una;
//   - escribir exige el permiso VIGENTE, comprobado dentro de la transacción y con bloqueo compartido (withConsent): consentimiento primero, versiones después;
//   - control de versión (409 `version_conflict`, con la respuesta guardada) e idempotencia por `requestId` (la misma petición devuelve lo mismo; con otros datos, 409 `request_conflict`);
//   - retirar BORRA lo respondido (se sobrescribe con `{}` y se deja `withdrawn`); reenviar después crea una versión nueva;
//   - NADIE ve respuestas individuales (ni profesionales ni administración): solo agregados con umbral de 5 personas (`aggregateMetrics`).
// El titular siempre es el id de la sesión. Leer lo propio y retirar NO exigen el permiso (revocarlo no puede impedir que la persona vea o borre lo suyo).
const { UniqueConstraintError } = require('sequelize');
const { sequelize } = require('../database');
const PilotFeedback = require('../PilotFeedback');
const consent = require('./consent');

const PURPOSE = 'pilot_feedback';
const WINDOWS = Object.freeze(['day7', 'day30']);
const QUESTIONNAIRE_VERSIONS = Object.freeze([1]);
const MIN_PEOPLE = 5; // ningún agregado se publica con menos personas
const TERNARY = [null, 'yes', 'no', 'unsure'];
const CLARITY = [null, 'yes', 'no', 'unsure', 'not_explored'];
const AREAS = [null, 'personal', 'career', 'both'];
const CATEGORIES = Object.freeze(['ideas', 'experience', 'next_step', 'other']);
const ANSWER_KEYS = Object.freeze(['initialValue', 'valueArea', 'listened', 'respected', 'professionalClarity', 'helpedBy']);

class FeedbackError extends Error {
  constructor(status, code, es, en, extra = {}) { super(`${es} / ${en}`); this.status = status; this.code = code; Object.assign(this, extra); }
}
const invalid = (code = 'invalid_input') => new FeedbackError(400, code, 'Datos inválidos.', 'Invalid data.');

const isPlain = (value) => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const hasExactKeys = (value, keys) => isPlain(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const isRequestId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
const isVersion = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 2147483000;

function cleanWindow(value) {
  if (typeof value !== 'string' || !WINDOWS.includes(value)) throw invalid('invalid_window');
  return value;
}

// Catálogo cerrado: claves EXACTAS, valores de lista, `valueArea` solo si la persona encontró algo útil, categorías sin repetir (máx. 4) y al menos una respuesta.
function cleanAnswers(value) {
  if (!hasExactKeys(value, ANSWER_KEYS)) throw invalid('invalid_answers');
  const { initialValue, valueArea, listened, respected, professionalClarity, helpedBy } = value;
  if (![initialValue, listened, respected].every((item) => TERNARY.includes(item))) throw invalid('invalid_answers');
  if (!CLARITY.includes(professionalClarity) || !AREAS.includes(valueArea)) throw invalid('invalid_answers');
  if (valueArea !== null && initialValue !== 'yes') throw invalid('invalid_answers');
  if (!Array.isArray(helpedBy) || helpedBy.length > CATEGORIES.length || !helpedBy.every((item) => CATEGORIES.includes(item)) || new Set(helpedBy).size !== helpedBy.length) throw invalid('invalid_answers');
  if (initialValue === null && listened === null && respected === null && professionalClarity === null && helpedBy.length === 0) throw invalid('empty_answers');
  return { initialValue, valueArea, listened, respected, professionalClarity, helpedBy: [...helpedBy] };
}
const sameAnswers = (a, b) => JSON.stringify(ANSWER_KEYS.map((key) => a[key])) === JSON.stringify(ANSWER_KEYS.map((key) => b[key]));

function dto(windowKey, row, granted) {
  const active = Boolean(row) && row.status === 'active';
  return {
    window: windowKey,
    status: row ? row.status : 'none',
    version: row ? row.version : 0,
    questionnaireVersion: row ? row.questionnaireVersion : QUESTIONNAIRE_VERSIONS[QUESTIONNAIRE_VERSIONS.length - 1],
    answers: active ? sameShape(row.answers) : null,
    lastRequestId: row ? row.lastRequestId : null,
    permission: { purpose: PURPOSE, granted },
  };
}
const sameShape = (answers) => ({ ...answers, helpedBy: [...answers.helpedBy] });

// Lo MÍO en esa ventana (o vacío). No exige el permiso; solo informa si está vigente.
async function read(userId, windowValue) {
  const windowKey = cleanWindow(windowValue);
  const row = await PilotFeedback.findOne({ where: { UserId: userId, windowKey } });
  return dto(windowKey, row, await consent.hasConsent(userId, PURPOSE));
}

// Crea o reemplaza mi respuesta. Orden: forma → permiso (dentro de la transacción) → repetición → versión → escritura.
async function save(userId, body) {
  if (!hasExactKeys(body, ['requestId', 'baseVersion', 'questionnaireVersion', 'window', 'answers'])) throw invalid();
  if (!isRequestId(body.requestId) || !isVersion(body.baseVersion)) throw invalid();
  if (!QUESTIONNAIRE_VERSIONS.includes(body.questionnaireVersion)) throw invalid('unsupported_questionnaire');
  const windowKey = cleanWindow(body.window);
  const answers = cleanAnswers(body.answers);
  for (let attempt = 1; ; attempt++) {
    try {
      return await consent.withConsent(userId, PURPOSE, async (transaction) => {
        const row = await PilotFeedback.findOne({ where: { UserId: userId, windowKey }, transaction, lock: transaction.LOCK.UPDATE });
        if (row && row.lastRequestId === body.requestId) {
          if (row.status === 'active' && row.questionnaireVersion === body.questionnaireVersion && sameAnswers(row.answers, answers)) return { replay: true, feedback: dto(windowKey, row, true) };
          throw new FeedbackError(409, 'request_conflict', 'Ese identificador de solicitud ya se usó con otros datos.', 'That request id was already used with different data.');
        }
        const current = row ? row.version : 0;
        if (body.baseVersion !== current) throw new FeedbackError(409, 'version_conflict', 'La respuesta guardada cambió.', 'The saved response changed.', { current: dto(windowKey, row, true) });
        const values = { questionnaireVersion: body.questionnaireVersion, answers, version: current + 1, status: 'active', lastRequestId: body.requestId };
        const saved = row ? await row.update(values, { transaction }) : await PilotFeedback.create({ UserId: userId, windowKey, ...values }, { transaction });
        return { replay: false, feedback: dto(windowKey, saved, true) };
      });
    } catch (error) {
      // Dos primeras respuestas simultáneas: gana una; la otra se reintenta UNA vez y ve la fila (repetición o conflicto de versión), nunca un 500.
      if (error instanceof UniqueConstraintError && attempt === 1) continue;
      if (error instanceof consent.ConsentRequiredError) throw new FeedbackError(403, 'consent_required', 'Consentimiento requerido. Autoriza guardar tu opinión.', 'Consent required. Authorize saving your feedback.', { purpose: PURPOSE });
      throw error;
    }
  }
}

// Retira mi respuesta: BORRA lo respondido (se sobrescribe con `{}`; no se oculta) y deja `withdrawn` con una versión nueva. Idempotente. `baseVersion` es opcional: si llega, debe ser la vigente.
async function withdraw(userId, windowValue, baseVersion) {
  const windowKey = cleanWindow(windowValue);
  if (baseVersion !== undefined && !isVersion(baseVersion)) throw invalid();
  const transaction = await sequelize.transaction();
  let finished = false;
  try {
    const row = await PilotFeedback.findOne({ where: { UserId: userId, windowKey }, transaction, lock: transaction.LOCK.UPDATE });
    if (baseVersion !== undefined && baseVersion !== (row ? row.version : 0)) throw new FeedbackError(409, 'version_conflict', 'La respuesta guardada cambió.', 'The saved response changed.', { current: dto(windowKey, row, false) });
    let out = row;
    if (row && row.status !== 'withdrawn') out = await row.update({ answers: {}, status: 'withdrawn', version: row.version + 1, lastRequestId: null }, { transaction });
    await transaction.commit(); finished = true;
    return dto(windowKey, out, await consent.hasConsent(userId, PURPOSE));
  } catch (error) {
    if (!finished) await transaction.rollback().catch(() => {});
    throw error;
  }
}

// ───────────────────────── Agregados (nunca respuestas individuales) ─────────────────────────
// Elegibles = personas (rol `user`, activas, sin eliminación pendiente) con el permiso `pilot_feedback` VIGENTE ahora: revocarlo saca a la persona de los agregados al instante.
// Una métrica se publica SOLO si hay al menos 5 elegibles Y al menos 5 que respondieron esa pregunta (con menos, `suppressed` y SIN conteos: no se puede reidentificar a quien respondió).
//   listening (día 7):  respondieron `listened` y `respected`; positivas = ambas «yes».
//   utility (día 30):   respondieron `professionalClarity` distinta de «not_explored»; positivas = «yes».
// activation y experiment no salen de esta opinión: `not_available`.
const METRICS = Object.freeze({
  listening: { window: 'day7', responded: `f."answers"->>'listened' IS NOT NULL AND f."answers"->>'respected' IS NOT NULL`, positive: `f."answers"->>'listened' = 'yes' AND f."answers"->>'respected' = 'yes'` },
  utility: { window: 'day30', responded: `f."answers"->>'professionalClarity' IN ('yes','no','unsure')`, positive: `f."answers"->>'professionalClarity' = 'yes'` },
});
const ELIGIBLE = `FROM "Consents" c JOIN "Users" u ON u.id = c."UserId"
  WHERE c.purpose = :purpose AND c.scope = 'default' AND c.status = 'granted' AND c.version >= :required
    AND u.role = 'user' AND u.active = true AND NOT EXISTS (SELECT 1 FROM "DeletionRequests" d WHERE d."UserId" = u.id)`;

async function aggregateMetrics() {
  const bind = { purpose: PURPOSE, required: consent.REQUIRED_VERSION[PURPOSE] };
  const eligible = Number((await sequelize.query(`SELECT count(*)::int AS n ${ELIGIBLE}`, { type: 'SELECT', replacements: bind }))[0].n);
  const metrics = [{ key: 'activation', status: 'not_available' }, { key: 'experiment', status: 'not_available' }];
  for (const [key, def] of Object.entries(METRICS)) {
    const [row] = await sequelize.query(`SELECT count(*) FILTER (WHERE ${def.responded})::int AS responded, count(*) FILTER (WHERE ${def.positive})::int AS positive
      FROM "Consents" c JOIN "Users" u ON u.id = c."UserId" JOIN "PilotFeedbacks" f ON f."UserId" = c."UserId" AND f."windowKey" = :window AND f.status = 'active'
      WHERE c.purpose = :purpose AND c.scope = 'default' AND c.status = 'granted' AND c.version >= :required
        AND u.role = 'user' AND u.active = true AND NOT EXISTS (SELECT 1 FROM "DeletionRequests" d WHERE d."UserId" = u.id)`,
    { type: 'SELECT', replacements: { ...bind, window: def.window } });
    const responded = Number(row.responded); const positive = Number(row.positive);
    metrics.push(eligible >= MIN_PEOPLE && responded >= MIN_PEOPLE
      ? { key, status: 'ready', window: def.window, counts: { eligible, responded, missing: eligible - responded, positive } }
      : { key, status: 'suppressed', window: def.window });
  }
  return { minPeople: MIN_PEOPLE, metrics: metrics.sort((a, b) => ['activation', 'experiment', 'listening', 'utility'].indexOf(a.key) - ['activation', 'experiment', 'listening', 'utility'].indexOf(b.key)) };
}

module.exports = { PURPOSE, WINDOWS, MIN_PEOPLE, CATEGORIES, FeedbackError, read, save, withdraw, aggregateMetrics, cleanAnswers };
