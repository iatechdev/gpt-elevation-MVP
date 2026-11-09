// backend/routes/diary.js
// POST   /api/diary       — crea una entrada fechada (con requestId opcional: reintentar no duplica, ES-163)
// GET    /api/diary       — lista las entradas propias (no borradas)
// GET    /api/diary/:id   — una entrada propia
// PUT    /api/diary/:id   — edita contenido y/o fecha (registra invalidación de dependencias)
// DELETE /api/diary/:id   — borra: vacía el contenido, la retira de toda consulta y registra la invalidación
// Diario privado de su dueño (ES-20): el titular siempre es req.user.id. Ninguna ruta de administrador, terapeuta o
// facilitador lo lee, y guardar no comparte nada. Entra al chat solo si la persona elige la entrada (contextEntryIds).
// verificarToken aplicado en server.js

const express = require('express');
const router = express.Router();
const { sequelize } = require('../database');
const DiaryEntry = require('../DiaryEntry');
const DerivedInvalidation = require('../DerivedInvalidation');
const { encriptarV2, desencriptar } = require('../utils/crypto');
const { validateBody, nonempty, optional } = require('../middlewares/validateBody');

const MAX_CONTENT = 10000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const validContent = (value) => nonempty(value) && value.length <= MAX_CONTENT;
// Fecha de calendario real (AAAA-MM-DD), no posterior a mañana (margen de zona horaria).
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false;
  return parsed.getTime() <= Date.now() + 36 * 3600 * 1000;
};
// ES-163: identificador opcional del intento de guardado (el cliente genera uno por borrador nuevo y lo reutiliza al reintentar).
const validRequestId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
const parseId = (raw) => (/^[1-9]\d{0,9}$/.test(String(raw)) ? Number(raw) : null);

const present = (entry) => ({
  id: entry.id,
  date: entry.entryDate,
  content: desencriptar(entry.content),
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

const own = (userId, id) => DiaryEntry.findOne({ where: { id, UserId: userId, deletedAt: null } });
const notFound = (res) => res.status(404).json({ error: 'Entrada no encontrada. / Entry not found.' });

// Ejecuta fn(transaction) y confirma; ante cualquier error revierte (nunca queda una escritura sin su invalidación).
const inTransaction = async (fn) => {
  const transaction = await sequelize.transaction();
  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
};

// Repetición de un guardado con el mismo requestId: SOLO de la misma persona (el requestId va en la clave junto con el titular). Mismo contenido y fecha = la entrada ya
// creada (200, sin duplicar); otro contenido u otra fecha = 409 sin tocar nada; una entrada ya borrada no se puede repetir (su contenido se vació).
const replay = (res, existing, body) => {
  if (existing.deletedAt || existing.entryDate !== body.date || desencriptar(existing.content) !== body.content) {
    return res.status(409).json({ error: 'Este requestId ya se usó con otra entrada. / This requestId was already used with a different entry.', code: 'request_id_reuse' });
  }
  return res.status(200).json(present(existing));
};

router.post('/', validateBody({ date: validDate, content: validContent, requestId: optional(validRequestId) }), async (req, res) => {
  const { requestId } = req.body;
  try {
    if (requestId) {
      const existing = await DiaryEntry.findOne({ where: { UserId: req.user.id, requestId } });
      if (existing) return replay(res, existing, req.body);
    }
    let entry;
    try {
      entry = await DiaryEntry.create({
        UserId: req.user.id, entryDate: req.body.date, content: encriptarV2(req.body.content), ...(requestId ? { requestId } : {}),
      });
    } catch (error) {
      // Dos guardados simultáneos con el mismo requestId: gana el INSERT de uno; el otro devuelve esa misma entrada.
      if (requestId && error && error.name === 'SequelizeUniqueConstraintError') {
        const existing = await DiaryEntry.findOne({ where: { UserId: req.user.id, requestId } });
        if (existing) return replay(res, existing, req.body);
      }
      throw error;
    }
    res.status(201).json(present(entry));
  } catch (error) {
    console.error('❌ Error creando entrada de diario:', error.message);
    res.status(500).json({ error: 'No se pudo guardar la entrada.' });
  }
});

router.get('/', async (req, res) => {
  const limit = /^\d{1,3}$/.test(String(req.query.limit ?? '')) ? Math.min(Number(req.query.limit), MAX_LIMIT) : DEFAULT_LIMIT;
  try {
    const entries = await DiaryEntry.findAll({
      where: { UserId: req.user.id, deletedAt: null },
      order: [['entryDate', 'DESC'], ['id', 'DESC']],
      limit: Math.max(limit, 1),
    });
    res.json({ entries: entries.map(present) });
  } catch (error) {
    console.error('❌ Error listando el diario:', error.message);
    res.status(500).json({ error: 'No se pudo cargar el diario.' });
  }
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res);
  try {
    const entry = await own(req.user.id, id);
    if (!entry) return notFound(res);
    res.json(present(entry));
  } catch (error) {
    console.error('❌ Error leyendo entrada de diario:', error.message);
    res.status(500).json({ error: 'No se pudo cargar la entrada.' });
  }
});

router.put('/:id', validateBody({ date: optional(validDate), content: optional(validContent) }), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res);
  if (req.body.date === undefined && req.body.content === undefined) {
    return res.status(400).json({ error: 'Datos de entrada inválidos. / Invalid input data.' });
  }
  try {
    const entry = await own(req.user.id, id);
    if (!entry) return notFound(res);
    await inTransaction(async (transaction) => {
      const updates = {};
      if (req.body.date !== undefined) updates.entryDate = req.body.date;
      if (req.body.content !== undefined) updates.content = encriptarV2(req.body.content);
      await entry.update(updates, { transaction });
      await DerivedInvalidation.create({
        UserId: req.user.id, sourceType: 'diary_entry', sourceId: entry.id, reason: 'edited',
      }, { transaction });
    });
    res.json(present(entry));
  } catch (error) {
    console.error('❌ Error editando entrada de diario:', error.message);
    res.status(500).json({ error: 'No se pudo guardar la entrada.' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res);
  try {
    const entry = await own(req.user.id, id);
    if (!entry) return notFound(res);
    await inTransaction(async (transaction) => {
      // El contenido se vacía ya; la purga de copias y respaldos la completa ES-23.
      await entry.update({ content: encriptarV2(''), deletedAt: new Date() }, { transaction });
      await DerivedInvalidation.create({
        UserId: req.user.id, sourceType: 'diary_entry', sourceId: entry.id, reason: 'deleted',
      }, { transaction });
    });
    res.json({ id, deleted: true });
  } catch (error) {
    console.error('❌ Error borrando entrada de diario:', error.message);
    res.status(500).json({ error: 'No se pudo borrar la entrada.' });
  }
});

module.exports = router;
