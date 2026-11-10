// backend/routes/exercises.js
// ES-194 · Ejercicios de acompañamiento creados, revisados y publicados desde la aplicación.
//   adminRouter (/api/admin/exercises): SOLO superadministración (403 al resto, verificado en cada ruta). Estado de publicación (draft | published | withdrawn) y
//     revisión del especialista (pending | done) son INDEPENDIENTES: publicar sin revisión hecha es posible y lo que ve la persona es veraz (`reviewStatus`).
//     Si cambia el contenido de un ejercicio revisado, la revisión vuelve a `pending`. publish, withdraw y review exigen `confirm: true`.
//   readRouter (/api/exercises, con sesión): SOLO ejercicios PUBLICADOS; borradores y retirados no salen ni por clave (404 idéntico a inexistente).
// Todo se escribe con la fila bloqueada dentro de una transacción; las comprobaciones de rol van antes (no se pide otra conexión con el bloqueo tomado).
const express = require('express');
const { Transaction } = require('sequelize');
const { sequelize } = require('../database');
const Exercise = require('../Exercise');
const ExerciseAudit = require('../ExerciseAudit');
const { KEY_RE, FIELDS, ExerciseInputError, normalizeContent, missingForPublish, nonClinicalViolations, contentChanged } = require('../utils/exerciseRules');

const IMPORT_LOCK_KEY = 194001;
const ID = /^[1-9][0-9]{0,9}$/;
const noStore = (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
const needSuperadmin = (req, res, next) => (req.user && req.user.role === 'superadmin' ? next()
  : res.status(403).json({ code: 'superadmin_only', error: 'Solo superadministración gestiona los ejercicios. / Only superadmin manages the exercises.' }));
const badInput = (res, error) => res.status(400).json({ code: 'invalid_input', field: error.field, reason: error.code, error: 'Datos inválidos. / Invalid data.' });
const unique = (error) => Boolean(error) && (error.name === 'SequelizeUniqueConstraintError' || error.original?.code === '23505');
const actorOf = (user) => ({ actorId: user.id ?? null, actorName: String(user.name || '').slice(0, 120) || null });
const minutesOf = (row) => (Number.isInteger(row.minutesMin) && Number.isInteger(row.minutesMax) ? [row.minutesMin, row.minutesMax] : null);
const missingKeys = (row) => missingForPublish(row);

const present = (row) => ({
  id: row.id, key: row.key, status: row.status, version: row.version, minutes: minutesOf(row), es: row.es, en: row.en,
  reviewStatus: row.reviewStatus, reviewedBy: row.reviewedBy, reviewedAt: row.reviewedAt,
  publishedBy: row.publishedBy, publishedAt: row.publishedAt, withdrawnBy: row.withdrawnBy, withdrawnAt: row.withdrawnAt,
  updatedBy: row.updatedBy, updatedAt: row.updatedAt, createdAt: row.createdAt, missing: missingKeys(row),
});
const summary = (row) => ({
  id: row.id, key: row.key, status: row.status, version: row.version, title: { es: row.es?.title ?? '', en: row.en?.title ?? '' }, minutes: minutesOf(row),
  reviewStatus: row.reviewStatus, reviewedBy: row.reviewedBy, reviewedAt: row.reviewedAt, publishedBy: row.publishedBy, publishedAt: row.publishedAt, updatedAt: row.updatedAt,
  complete: missingKeys(row).length === 0,
});
const snapshotOf = (row) => JSON.stringify({ status: row.status, version: row.version, minutes: minutesOf(row), es: row.es, en: row.en, reviewStatus: row.reviewStatus, reviewedBy: row.reviewedBy, reviewedAt: row.reviewedAt });
const audit = (action, row, user, transaction) => ExerciseAudit.create({ exerciseId: row.id, version: row.version, action, ...actorOf(user), snapshot: snapshotOf(row) }, { transaction });

// ---------------------------------------------------------------- administración
const adminRouter = express.Router();
adminRouter.use(noStore, needSuperadmin);
adminRouter.param('id', (req, res, next, value) => (ID.test(value) ? next() : res.status(404).json({ code: 'not_found', error: 'Ejercicio no encontrado. / Exercise not found.' })));

// Abre una transacción, bloquea la fila y ejecuta `work`; `work` devuelve { status, body } (nunca responde por sí mismo).
async function locked(req, res, work) {
  const transaction = await sequelize.transaction();
  try {
    const row = await Exercise.findOne({ where: { id: Number(req.params.id) }, transaction, lock: Transaction.LOCK.UPDATE });
    if (!row) { await transaction.rollback(); return res.status(404).json({ code: 'not_found', error: 'Ejercicio no encontrado. / Exercise not found.' }); }
    const outcome = await work(row, transaction);
    if (outcome.rollback) await transaction.rollback(); else await transaction.commit();
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    await transaction.rollback().catch(() => {});
    console.error('Error en ejercicios (administración).', error && error.name);
    return res.status(500).json({ error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
}
const needConfirm = (req, res) => (req.body && req.body.confirm === true ? true
  : (res.status(400).json({ code: 'confirmation_required', error: 'Falta la confirmación. / Confirmation is required.' }), false));

adminRouter.get('/', async (req, res) => {
  try {
    const rows = await Exercise.findAll({ order: [['updatedAt', 'DESC'], ['id', 'DESC']], limit: 500 });
    res.json(rows.map(summary));
  } catch { res.status(500).json({ error: 'No se pudieron obtener los ejercicios. / The exercises could not be loaded.' }); }
});

// Debe ir antes de «/:id/...»: importa como BORRADOR (revisión pendiente) lo que aún no exista; nunca publica ni sobrescribe.
adminRouter.post('/import-catalog', async (req, res) => {
  const catalog = require('../../shared/companion-exercises.json');
  const transaction = await sequelize.transaction();
  try {
    // E194-2: las importaciones se serializan (bloqueo consultivo de transacción); la segunda ve lo ya creado y lo salta. 23505 (carrera con POST /) también cuenta como «saltado».
    if (sequelize.getDialect?.() === 'postgres') await sequelize.query('SELECT pg_advisory_xact_lock(:key)', { replacements: { key: IMPORT_LOCK_KEY }, transaction });
    const created = []; const skipped = [];
    for (const item of catalog.exercises ?? []) {
      if (!KEY_RE.test(String(item.key))) { skipped.push(String(item.key)); continue; }
      if (await Exercise.findOne({ where: { key: item.key }, transaction })) { skipped.push(item.key); continue; }
      const content = normalizeContent({ es: item.es, en: item.en, minutes: item.minutes });
      const row = await Exercise.create({ key: item.key, status: 'draft', version: 1, reviewStatus: 'pending', ...content, updatedBy: actorOf(req.user).actorName }, { transaction });
      await audit('create', row, req.user, transaction);
      created.push(item.key);
    }
    await transaction.commit();
    res.json({ created, skipped, note: 'Todo queda como borrador con revisión pendiente. / Everything is a draft with review pending.' });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    if (error instanceof ExerciseInputError) return badInput(res, error);
    if (unique(error)) return res.status(409).json({ code: 'import_conflict', error: 'Otra persona creó ejercicios a la vez; vuelve a importar. / Someone created exercises at the same time; import again.' });
    console.error('Error al importar el catálogo de ejercicios.', error && error.name);
    res.status(500).json({ error: 'No se pudo importar el catálogo. / The catalog could not be imported.' });
  }
});

adminRouter.get('/:id', async (req, res) => {
  try {
    const row = await Exercise.findOne({ where: { id: Number(req.params.id) } });
    if (!row) return res.status(404).json({ code: 'not_found', error: 'Ejercicio no encontrado. / Exercise not found.' });
    const history = await ExerciseAudit.findAll({ where: { exerciseId: row.id }, attributes: ['id', 'action', 'version', 'actorName', 'createdAt'], order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: 100 });
    res.json({ ...present(row), history: history.map((h) => ({ id: h.id, action: h.action, version: h.version, actorName: h.actorName, createdAt: h.createdAt })) });
  } catch { res.status(500).json({ error: 'No se pudo obtener el ejercicio. / The exercise could not be loaded.' }); }
});

adminRouter.post('/', async (req, res) => {
  try {
    const key = req.body && req.body.key;
    if (typeof key !== 'string' || !KEY_RE.test(key)) return badInput(res, new ExerciseInputError('key', 'invalid_key'));
    const content = normalizeContent(req.body);
    const transaction = await sequelize.transaction();
    try {
      if (await Exercise.findOne({ where: { key }, transaction })) { await transaction.rollback(); return res.status(409).json({ code: 'key_exists', error: 'Ya existe un ejercicio con esa clave. / An exercise with that key already exists.' }); }
      const row = await Exercise.create({ key, status: 'draft', version: 1, reviewStatus: 'pending', ...content, updatedBy: actorOf(req.user).actorName }, { transaction });
      await audit('create', row, req.user, transaction);
      await transaction.commit();
      return res.status(201).json(present(row));
    } catch (error) {
      await transaction.rollback().catch(() => {});
      if (unique(error)) return res.status(409).json({ code: 'key_exists', error: 'Ya existe un ejercicio con esa clave. / An exercise with that key already exists.' });
      throw error;
    }
  } catch (error) {
    if (error instanceof ExerciseInputError) return badInput(res, error);
    console.error('Error al crear el ejercicio.', error && error.name);
    res.status(500).json({ error: 'No se pudo crear el ejercicio. / The exercise could not be created.' });
  }
});

adminRouter.put('/:id', async (req, res) => {
  let content; const expected = req.body && req.body.expectedVersion;
  try { content = normalizeContent(req.body); } catch (error) { if (error instanceof ExerciseInputError) return badInput(res, error); throw error; }
  if (!Number.isInteger(expected) || expected < 1) return res.status(400).json({ code: 'version_required', error: 'Falta la versión esperada. / The expected version is required.' });
  return locked(req, res, async (row, transaction) => {
    if (row.version !== expected) return { rollback: true, status: 409, body: { code: 'exercise_changed', error: 'Otra persona guardó este ejercicio. / Another person saved this exercise.', current: present(row) } };
    const next = { es: content.es, en: content.en, minutesMin: content.minutesMin, minutesMax: content.minutesMax };
    if (!contentChanged(row, next)) return { rollback: true, status: 200, body: { ...present(row), unchanged: true } }; // idempotente: sin cambios no hay versión nueva
    // E194-1: un ejercicio PUBLICADO llega a la persona al guardar; se revalidan completitud y reglas no clínicas igual que al publicar y NO se guarda (ni se pasa a borrador en silencio).
    if (row.status === 'published') {
      const missing = missingForPublish(next);
      if (missing.length) return { rollback: true, status: 422, body: { code: 'incomplete', missing, error: 'Faltan datos: el ejercicio está publicado. / Required data is missing: the exercise is published.' } };
      const violations = nonClinicalViolations(next);
      if (violations.length) return { rollback: true, status: 422, body: { code: 'non_clinical_rule', violations, error: 'El texto incumple las reglas no clínicas. / The text breaks the non-clinical rules.' } };
    }
    const updates = { ...next, version: row.version + 1, updatedBy: actorOf(req.user).actorName };
    // Una versión nueva del contenido NO hereda la revisión del especialista.
    if (row.reviewStatus === 'done') Object.assign(updates, { reviewStatus: 'pending', reviewedBy: null, reviewedAt: null });
    await row.update(updates, { transaction });
    await audit('update', row, req.user, transaction);
    return { status: 200, body: present(row) };
  });
});

adminRouter.post('/:id/publish', (req, res) => {
  if (!needConfirm(req, res)) return undefined;
  return locked(req, res, async (row, transaction) => {
    if (row.status === 'published') return { rollback: true, status: 200, body: { ...present(row), unchanged: true } };
    const missing = missingKeys(row);
    if (missing.length) return { rollback: true, status: 422, body: { code: 'incomplete', missing, error: 'Faltan datos para publicar. / Required data is missing to publish.' } };
    const violations = nonClinicalViolations(row);
    if (violations.length) return { rollback: true, status: 422, body: { code: 'non_clinical_rule', violations, error: 'El texto incumple las reglas no clínicas. / The text breaks the non-clinical rules.' } };
    const actor = actorOf(req.user).actorName;
    await row.update({ status: 'published', publishedBy: actor, publishedAt: new Date(), withdrawnBy: null, withdrawnAt: null, updatedBy: actor }, { transaction });
    await audit('publish', row, req.user, transaction);
    return { status: 200, body: present(row) };
  });
});

adminRouter.post('/:id/withdraw', (req, res) => {
  if (!needConfirm(req, res)) return undefined;
  return locked(req, res, async (row, transaction) => {
    if (row.status === 'withdrawn') return { rollback: true, status: 200, body: { ...present(row), unchanged: true } };
    if (row.status !== 'published') return { rollback: true, status: 409, body: { code: 'not_published', error: 'Solo se retira un ejercicio publicado. / Only a published exercise can be withdrawn.' } };
    const actor = actorOf(req.user).actorName;
    await row.update({ status: 'withdrawn', withdrawnBy: actor, withdrawnAt: new Date(), updatedBy: actor }, { transaction });
    await audit('withdraw', row, req.user, transaction);
    return { status: 200, body: present(row) };
  });
});

// Revisión del especialista: la registra una persona (superadmin) con confirmación. No cambia el estado de publicación.
adminRouter.post('/:id/review', (req, res) => {
  const target = req.body && req.body.reviewStatus;
  if (!['done', 'pending'].includes(target)) return badInput(res, new ExerciseInputError('reviewStatus', 'invalid'));
  if (!needConfirm(req, res)) return undefined;
  return locked(req, res, async (row, transaction) => {
    if (row.reviewStatus === target) return { rollback: true, status: 200, body: { ...present(row), unchanged: true } };
    const actor = actorOf(req.user).actorName;
    await row.update(target === 'done'
      ? { reviewStatus: 'done', reviewedBy: actor, reviewedAt: new Date(), updatedBy: actor }
      : { reviewStatus: 'pending', reviewedBy: null, reviewedAt: null, updatedBy: actor }, { transaction });
    await audit(target === 'done' ? 'review' : 'unreview', row, req.user, transaction);
    return { status: 200, body: present(row) };
  });
});

// ---------------------------------------------------------------- lectura de la persona
const readRouter = express.Router();
readRouter.use((req, res, next) => { res.set('Cache-Control', 'no-cache'); next(); });
const shape = (row) => ({ key: row.key, minutes: minutesOf(row), es: row.es, en: row.en, reviewStatus: row.reviewStatus, version: row.version });
const NOT_FOUND = { code: 'not_found', error: 'Ejercicio no encontrado. / Exercise not found.' };
readRouter.get('/', async (req, res) => {
  try {
    const rows = await Exercise.findAll({ where: { status: 'published' }, order: [['key', 'ASC']] });
    res.json(rows.map(shape));
  } catch { res.status(500).json({ error: 'No se pudieron obtener los ejercicios. / The exercises could not be loaded.' }); }
});
readRouter.get('/:key', async (req, res) => {
  try {
    if (!KEY_RE.test(req.params.key)) return res.status(404).json(NOT_FOUND);
    const row = await Exercise.findOne({ where: { key: req.params.key, status: 'published' } });
    if (!row) return res.status(404).json(NOT_FOUND); // borrador, retirado o inexistente: la misma respuesta
    res.json(shape(row));
  } catch { res.status(500).json({ error: 'No se pudo obtener el ejercicio. / The exercise could not be loaded.' }); }
});

module.exports = { adminRouter, readRouter, FIELDS };
