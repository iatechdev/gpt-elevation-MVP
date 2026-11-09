// backend/routes/invitations.js
// ES-192 · Invitación por enlace (HU-P41).
//   adminRouter  (montado en /api/admin/invitations con verificarAdmin):
//     POST /            crea una invitación (correo + rol) y envía el enlace por correo
//     GET  /            lista las invitaciones (administración: las propias; superadministración: todas). Nunca devuelve el token
//     POST /:id/revoke  anula una invitación pendiente
//   publicRouter (montado en /api/invitations, sin sesión):
//     POST /accept      la persona invitada elige su contraseña (misma política que el registro) y la cuenta queda activa
// El enlace es de un solo uso, vence y NO contiene la contraseña ni datos personales: lleva un token aleatorio en el fragmento (#),
// que no viaja al servidor, a los registros de acceso ni en Referer. En la base solo queda el hash del token.

const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { Op, fn, col, where: sqlWhere } = require('sequelize');
const User = require('../User');
const Invitation = require('../Invitation');
const { passwordProblems, policy } = require('../utils/registrationPassword');
const { sendInvitation } = require('../utils/mailer');
const { validateBody, nonempty, optional, text } = require('../middlewares/validateBody');

// Quién puede invitar a qué rol. Pregunta abierta para el PO (¿también profesionales a sus personas?): se construye primero
// para administración y se deja aquí, en una constante fácil de cambiar. Nadie invita a un rol superior al propio.
const INVITER_ROLES = {
  admin: ['user', 'therapist'],
  superadmin: ['user', 'therapist', 'board', 'admin', 'superadmin'],
};

const ttlHours = () => Number(process.env.INVITATION_TTL_HOURS) || 72;
const perInviterPerHour = () => Number(process.env.INVITATION_PER_INVITER_HOUR) || 30;
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // el correo de quien nunca se registró no se conserva más de 30 días

const EMAIL = /^[^\s@<>"'`,;()[\]\\]{1,64}@[^\s@<>"'`,;()[\]\\]{1,190}\.[^\s@<>"'`,;()[\]\\]{2,}$/;
const INVALID_LINK = { code: 'invitation_invalid', error: 'Este enlace ya no sirve. Pide una invitación nueva. / This link no longer works. Ask for a new invitation.' };

const limiter = (variable, fallback) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: () => Number(process.env[variable]) || fallback,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'rate_limited', error: 'Demasiados intentos. Espera unos minutos. / Too many attempts. Wait a few minutes.' },
});

const statusOf = (row, now = new Date()) => {
  if (row.usedAt) return row.acceptedUserId ? 'accepted' : 'revoked';
  return new Date(row.expiresAt) <= now ? 'expired' : 'pending';
};
const present = row => ({ id: row.id, email: row.email, role: row.role, invitedBy: row.invitedBy, expiresAt: row.expiresAt, usedAt: row.usedAt, createdAt: row.createdAt, status: statusOf(row) });

// ---------------------------------------------------------------- administración
const adminRouter = express.Router();
adminRouter.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

adminRouter.post('/', validateBody({ email: nonempty, role: nonempty, locale: optional(text) }), async (req, res) => {
  try {
    const email = String(req.body.email).trim().toLowerCase();
    if (email.length > 254 || !EMAIL.test(email)) return res.status(400).json({ code: 'invalid_email', error: 'Correo inválido. / Invalid email.' });
    const allowed = INVITER_ROLES[req.user.role] || [];
    if (!allowed.includes(req.body.role)) return res.status(403).json({ code: 'role_not_allowed', error: 'No tienes permiso para invitar con ese rol. / You are not allowed to invite with that role.' });
    const locale = req.body.locale === 'en' ? 'en' : 'es';

    // A quien administra se le dice la verdad (ya puede listar usuarios); la persona invitada nunca sabe si el correo existía.
    if (await User.findOne({ where: sqlWhere(fn('lower', col('email')), email) })) {
      return res.status(409).json({ code: 'email_taken', error: 'Ya existe una cuenta con ese correo. / An account with that email already exists.' });
    }
    const recent = await Invitation.count({ where: { invitedBy: req.user.id, createdAt: { [Op.gt]: new Date(Date.now() - 60 * 60 * 1000) } } });
    if (recent >= perInviterPerHour()) return res.status(429).json({ code: 'rate_limited', error: 'Demasiadas invitaciones seguidas. Espera un rato. / Too many invitations in a row. Wait a while.' });

    const now = new Date();
    await Invitation.destroy({ where: { createdAt: { [Op.lt]: new Date(now.getTime() - STALE_AFTER_MS) }, [Op.or]: [{ usedAt: { [Op.ne]: null } }, { expiresAt: { [Op.lt]: now } }] } });
    await Invitation.update({ usedAt: now }, { where: { email, usedAt: null } }); // un solo enlace vivo por correo: vale el último
    const token = crypto.randomBytes(32).toString('base64url');
    const row = await Invitation.create({ email, role: req.body.role, invitedBy: req.user.id, tokenHash: hashToken(token), locale, expiresAt: new Date(now.getTime() + ttlHours() * 3600 * 1000) });

    let emailSent = false;
    const base = String(process.env.APP_BASE_URL || process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    if (base) {
      try { emailSent = (await sendInvitation({ to: email, link: `${base}/accept-invitation#token=${token}`, locale, hours: ttlHours() })).sent; }
      catch { console.error('Correo de invitación no enviado.'); }
    }
    if (!emailSent) console.error('Invitación creada sin correo: sin proveedor configurado (ES-12) o fallo de envío.');
    res.status(201).json({ ...present(row), emailSent });
  } catch {
    console.error('Error al crear la invitación.');
    res.status(500).json({ error: 'No se pudo crear la invitación. / The invitation could not be created.' });
  }
});

adminRouter.get('/', async (req, res) => {
  try {
    const filter = req.user.role === 'superadmin' ? {} : { invitedBy: req.user.id };
    const rows = await Invitation.findAll({ where: filter, attributes: ['id', 'email', 'role', 'invitedBy', 'expiresAt', 'usedAt', 'acceptedUserId', 'createdAt'], order: [['createdAt', 'DESC']], limit: 200 });
    res.json(rows.map(present));
  } catch {
    res.status(500).json({ error: 'No se pudieron obtener las invitaciones. / The invitations could not be loaded.' });
  }
});

adminRouter.post('/:id/revoke', async (req, res) => {
  try {
    if (!/^[1-9][0-9]{0,9}$/.test(req.params.id)) return res.status(404).json({ error: 'Invitación no encontrada. / Invitation not found.' });
    const mine = req.user.role === 'superadmin' ? {} : { invitedBy: req.user.id };
    const [changed] = await Invitation.update({ usedAt: new Date() }, { where: { id: Number(req.params.id), usedAt: null, ...mine } });
    if (!changed) return res.status(404).json({ error: 'Invitación no encontrada. / Invitation not found.' }); // ajena, usada o inexistente: igual
    res.json({ message: 'Invitación anulada. / Invitation revoked.' });
  } catch {
    res.status(500).json({ error: 'No se pudo anular la invitación. / The invitation could not be revoked.' });
  }
});

// ---------------------------------------------------------------- pública
const publicRouter = express.Router();

publicRouter.post('/accept', limiter('INVITATION_ACCEPT_LIMIT', 10), validateBody({ token: nonempty, name: nonempty, password: nonempty }), async (req, res) => {
  try {
    const { token, password } = req.body;
    const name = String(req.body.name).trim();
    // La política se valida antes de gastar el enlace: una contraseña débil no lo consume.
    const missing = passwordProblems(password);
    if (missing.length) return res.status(400).json({ code: 'password_policy', missing, error: `${policy.message.es} / ${policy.message.en}` });
    if (!name || name.length > 100) return res.status(400).json({ code: 'invalid_name', error: 'Nombre inválido. / Invalid name.' });
    if (token.length > 128) return res.status(400).json(INVALID_LINK);

    const row = await Invitation.findOne({ where: { tokenHash: hashToken(token) } });
    if (!row) return res.status(400).json(INVALID_LINK);
    // Consumo atómico: solo una petición logra marcarlo usado, aunque lleguen dos a la vez.
    const now = new Date();
    const [claimed] = await Invitation.update({ usedAt: now }, { where: { id: row.id, usedAt: null, expiresAt: { [Op.gt]: now } } });
    if (!claimed) return res.status(400).json(INVALID_LINK);

    // Vencido, usado, correo ya registrado o invitador sin permiso: el mismo mensaje (no revela si el correo existía).
    const inviter = await User.findByPk(row.invitedBy);
    if (!inviter || inviter.active === false || !(INVITER_ROLES[inviter.role] || []).includes(row.role)) return res.status(400).json(INVALID_LINK);
    if (await User.findOne({ where: sqlWhere(fn('lower', col('email')), row.email) })) return res.status(400).json(INVALID_LINK);

    let created;
    try { created = await User.create({ name, email: row.email, password: await bcrypt.hash(password, 10), role: row.role, active: true }); }
    catch (error) {
      if (error && error.name === 'SequelizeUniqueConstraintError') return res.status(400).json(INVALID_LINK); // otra cuenta con ese correo se creó a la vez
      throw error;
    }
    await Invitation.update({ acceptedUserId: created.id }, { where: { id: row.id } });
    res.status(201).json({ message: 'Cuenta creada. Inicia sesión. / Account created. Sign in.' });
  } catch {
    console.error('Error al aceptar la invitación.');
    res.status(500).json({ error: 'Error en el servidor. / Server error.' });
  }
});

module.exports = { adminRouter, publicRouter, INVITER_ROLES };
