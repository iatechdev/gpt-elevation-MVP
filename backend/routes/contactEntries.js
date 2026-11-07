// backend/routes/contactEntries.js
// ES-193 · Datos de contacto y ayuda (línea de emergencia) editables desde Contenido.
//   publicRouter (/api/contact-entries, sin sesión): GET ?country=CO — solo entradas activas con verificación vigente. Sin ninguna: lista vacía
//     (la pantalla muestra el aviso genérico, nunca un número). Nunca se guarda en caché (un número desactivado deja de verse al instante).
//   adminRouter (/api/admin/contact-entries, verificarAdmin): administración LEE (todo, con su estado de verificación); solo superadministración
//     crea, edita, ordena y activa o desactiva (403 al resto). Se desactiva sin borrar. Cada cambio guarda quién y cuándo (ContactEntryAudit).
const express = require('express');
const { sequelize } = require('../database');
const ContactEntry = require('../ContactEntry');
const ContactEntryAudit = require('../ContactEntryAudit');
const { verificationStatus, validateFields, publicShape, publishedEntries, maxAgeDays } = require('../utils/contactEntries');

const COUNTRY = /^[A-Za-z]{2}$/;
const ID = /^[1-9][0-9]{0,9}$/;
const present = (row) => ({
  id: row.id, country: row.country, name: row.name, contact: row.contact, descriptionEs: row.descriptionEs, descriptionEn: row.descriptionEn,
  position: row.position, active: row.active, source: row.source, verifiedBy: row.verifiedBy, verifiedAt: row.verifiedAt,
  verification: verificationStatus(row), version: row.version, updatedBy: row.updatedBy, updatedAt: row.updatedAt,
});
const noStore = (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
const needSuperadmin = (req, res, next) => (req.user.role === 'superadmin' ? next()
  : res.status(403).json({ code: 'superadmin_only', error: 'Solo superadministración puede cambiar los datos de contacto. / Only superadmin can change contact data.' }));
const badInput = (res, error) => res.status(400).json({ code: 'invalid_input', field: error.field, reason: error.code, error: 'Datos inválidos. / Invalid data.' });

// ---------------------------------------------------------------- pública
const publicRouter = express.Router();
publicRouter.use(noStore);
publicRouter.get('/', async (req, res) => {
  try {
    const raw = req.query.country;
    if (raw !== undefined && (typeof raw !== 'string' || !COUNTRY.test(raw))) return res.status(400).json({ code: 'invalid_input', error: 'País inválido. / Invalid country.' });
    const rows = await publishedEntries({ country: raw ? raw.toUpperCase() : undefined });
    res.json({ entries: rows.map(publicShape) });
  } catch {
    // Error: la pantalla muestra el aviso genérico con «reintentar»; no se inventa nada.
    console.error('No se pudieron leer los datos de contacto.');
    res.status(503).json({ code: 'contact_unavailable', error: 'No se pudieron cargar los datos de contacto. / Contact data could not be loaded.' });
  }
});

// ---------------------------------------------------------------- administración
const adminRouter = express.Router();
adminRouter.use(noStore);

async function audit(action, row, user, transaction) {
  await ContactEntryAudit.create({ entryId: row.id, action, actorId: user.id ?? null, actorName: String(user.name || '').slice(0, 120) || null, snapshot: JSON.stringify(present(row)) }, { transaction });
}

adminRouter.get('/', async (req, res) => {
  try {
    const rows = await ContactEntry.findAll({ order: [['country', 'ASC'], ['position', 'ASC'], ['id', 'ASC']] });
    res.json({ maxAgeDays: maxAgeDays(), entries: rows.map(present) });
  } catch { res.status(500).json({ error: 'No se pudieron obtener las entradas. / The entries could not be loaded.' }); }
});

adminRouter.get('/:id/history', async (req, res) => {
  try {
    if (!ID.test(req.params.id)) return res.status(404).json({ error: 'Entrada no encontrada. / Entry not found.' });
    const rows = await ContactEntryAudit.findAll({ where: { entryId: Number(req.params.id) }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: 100 });
    res.json(rows.map((row) => ({ id: row.id, action: row.action, actorName: row.actorName, createdAt: row.createdAt, snapshot: JSON.parse(row.snapshot) })));
  } catch { res.status(500).json({ error: 'No se pudo obtener el historial. / The history could not be loaded.' }); }
});

// Activar exige procedencia vigente (fuente, quién verificó y fecha dentro de CONTACT_MAX_AGE_DAYS): igual que el registro de ES-21.
const activationBlocked = (row) => verificationStatus(row) !== 'verified';
const blocked = (res) => res.status(409).json({ code: 'verification_required', error: 'Para activar una entrada hace falta fuente, quién la verificó y una fecha de verificación vigente. / To activate an entry you need a source, who verified it and a current verification date.' });

adminRouter.post('/', needSuperadmin, async (req, res) => {
  try {
    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) return badInput(res, { field: 'body', code: 'invalid' });
    const { values, error } = validateFields(req.body);
    if (error) return badInput(res, error);
    if (values.active && activationBlocked({ ...values })) return blocked(res);
    const last = await ContactEntry.max('position', { where: { country: values.country } });
    const saved = await sequelize.transaction(async (transaction) => {
      const row = await ContactEntry.create({ active: false, ...values, position: Number.isInteger(last) ? last + 1 : 0, version: 1, updatedBy: String(req.user.name || '').slice(0, 120) || null }, { transaction });
      await audit('create', row, req.user, transaction);
      return row;
    });
    res.status(201).json(present(saved));
  } catch { console.error('Error al crear la entrada de contacto.'); res.status(500).json({ error: 'No se pudo crear la entrada. / The entry could not be created.' }); }
});

// Reordenar: la lista de ids define el orden dentro de su país. Va ANTES de /:id para que «order» no se tome por un id.
adminRouter.put('/order', needSuperadmin, async (req, res) => {
  try {
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 200 || !ids.every((id) => Number.isInteger(id) && id > 0) || new Set(ids).size !== ids.length) return badInput(res, { field: 'ids', code: 'invalid' });
    const done = await sequelize.transaction(async (transaction) => {
      const rows = await ContactEntry.findAll({ where: { id: ids }, transaction });
      if (rows.length !== ids.length) return null;
      if (new Set(rows.map((row) => row.country)).size !== 1) return 'mixed';
      for (const [index, id] of ids.entries()) {
        const row = rows.find((candidate) => candidate.id === id);
        if (row.position === index) continue;
        await row.update({ position: index, version: row.version + 1, updatedBy: String(req.user.name || '').slice(0, 120) || null }, { transaction });
        await audit('reorder', row, req.user, transaction);
      }
      return 'ok';
    });
    if (done === null) return res.status(404).json({ error: 'Entrada no encontrada. / Entry not found.' });
    if (done === 'mixed') return badInput(res, { field: 'ids', code: 'mixed_countries' });
    res.json({ message: 'Orden guardado. / Order saved.' });
  } catch { console.error('Error al ordenar las entradas de contacto.'); res.status(500).json({ error: 'No se pudo guardar el orden. / The order could not be saved.' }); }
});

adminRouter.put('/:id', needSuperadmin, async (req, res) => {
  try {
    if (!ID.test(req.params.id)) return res.status(404).json({ error: 'Entrada no encontrada. / Entry not found.' });
    const body = req.body;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return badInput(res, { field: 'body', code: 'invalid' });
    if (!Number.isInteger(body.version) || body.version < 1) return badInput(res, { field: 'version', code: 'required' });
    const { values, error } = validateFields(body, { partial: true });
    if (error) return badInput(res, error);
    const outcome = await sequelize.transaction(async (transaction) => {
      const row = await ContactEntry.findOne({ where: { id: Number(req.params.id) }, transaction, lock: true });
      if (!row) return { status: 404 };
      if (row.version !== body.version) return { status: 409, row }; // alguien más lo cambió: se muestra lo vigente y se decide
      const next = { ...row.toJSON(), ...values };
      // Activar, o cambiar el contacto, el país o la procedencia de una entrada que sigue activa, exige procedencia vigente.
      // Editar solo textos de una entrada activa cuya verificación venció no se bloquea (deja de verse sola y se puede corregir).
      const touchesProvenance = ['contact', 'country', 'source', 'verifiedBy', 'verifiedAt'].some((key) => key in values);
      if ((values.active === true || (row.active && values.active !== false && touchesProvenance)) && activationBlocked(next)) return { status: 422 };
      const action = values.active === true && !row.active ? 'activate' : values.active === false && row.active ? 'deactivate' : 'update';
      await row.update({ ...values, version: row.version + 1, updatedBy: String(req.user.name || '').slice(0, 120) || null }, { transaction });
      await audit(action, row, req.user, transaction);
      return { status: 200, row };
    });
    if (outcome.status === 404) return res.status(404).json({ error: 'Entrada no encontrada. / Entry not found.' });
    if (outcome.status === 409) return res.status(409).json({ code: 'conflict', error: 'Otra persona cambió esta entrada. Revisa lo vigente. / Someone else changed this entry. Review the current version.', current: present(outcome.row) });
    if (outcome.status === 422) return blocked(res);
    res.json(present(outcome.row));
  } catch { console.error('Error al editar la entrada de contacto.'); res.status(500).json({ error: 'No se pudo guardar. / It could not be saved.' }); }
});

module.exports = { publicRouter, adminRouter };
