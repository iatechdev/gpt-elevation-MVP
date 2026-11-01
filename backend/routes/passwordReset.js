// backend/routes/passwordReset.js
// POST /api/password-reset/request  — pide un enlace (respuesta idéntica exista o no el correo)
// POST /api/password-reset/confirm  — fija la contraseña nueva con el enlace (un solo uso, vence)
// Sin middleware de sesión — rutas públicas (ES-132).

const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { Op } = require('sequelize');
const User = require('../User');
const PasswordReset = require('../PasswordReset');
const { deletionPending } = require('../utils/deletionGuard');
const { revokeUserSessions } = require('../utils/sessions');
const { passwordProblems, policy } = require('../utils/registrationPassword');
const { sendPasswordReset } = require('../utils/mailer');
const { validateBody, nonempty } = require('../middlewares/validateBody');

const router = express.Router();

const ttlMinutes = () => Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 30;
const perAccountPerHour = () => Number(process.env.PASSWORD_RESET_PER_ACCOUNT_HOUR) || 3;
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

// Los límites se leen en cada petición para poder acotarlos en pruebas; los valores por defecto son los del diseño.
const limiter = (variable, fallback) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: () => Number(process.env[variable]) || fallback,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'rate_limited', error: 'Demasiados intentos. Espera unos minutos. / Too many attempts. Wait a few minutes.' },
});

const ACCEPTED = { message: 'Si el correo está registrado, te enviaremos un enlace. / If the email is registered, we will send you a link.' };
const INVALID_LINK = { code: 'reset_invalid', error: 'Este enlace ya no sirve. Pide uno nuevo. / This link no longer works. Request a new one.' };

const pending = new Set();
const track = promise => { pending.add(promise); promise.finally(() => pending.delete(promise)); };

// Se ejecuta DESPUÉS de responder: el tiempo de respuesta no depende de si el correo existe.
async function issueLink(email, locale) {
  const user = await User.findOne({ where: { email } });
  if (!user || user.active === false || await deletionPending(user.id)) return;
  const recent = await PasswordReset.count({ where: { UserId: user.id, createdAt: { [Op.gt]: new Date(Date.now() - 60 * 60 * 1000) } } });
  if (recent >= perAccountPerHour()) return;
  const token = crypto.randomBytes(32).toString('base64url');
  // Solo vale el último enlace pedido.
  await PasswordReset.update({ usedAt: new Date() }, { where: { UserId: user.id, usedAt: null } });
  await PasswordReset.create({ UserId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMinutes() * 60 * 1000) });
  const base = String(process.env.APP_BASE_URL || process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  // El token va en el fragmento (#): no viaja al servidor, ni a registros de acceso, ni en Referer.
  if (!base) return;
  const { sent } = await sendPasswordReset({ to: user.email, link: `${base}/reset-password#token=${token}`, locale, minutes: ttlMinutes() });
  if (!sent) console.error('Correo de recuperación no enviado: sin proveedor configurado (ES-12).');
}

router.post('/password-reset/request', limiter('PASSWORD_RESET_IP_LIMIT', 5), validateBody({ email: nonempty }), (req, res) => {
  const email = req.body.email;
  const locale = req.body.locale === 'en' ? 'en' : 'es';
  res.status(202).json(ACCEPTED);
  track(issueLink(email, locale).catch(() => console.error('Error al preparar la recuperación de contraseña.')));
});

router.post('/password-reset/confirm', limiter('PASSWORD_RESET_CONFIRM_LIMIT', 10), validateBody({ token: nonempty, password: nonempty }), async (req, res) => {
  try {
    const { token, password } = req.body;
    // La política se valida antes de gastar el enlace: una contraseña débil no lo consume.
    const missing = passwordProblems(password);
    if (missing.length) return res.status(400).json({ code: 'password_policy', missing, error: `${policy.message.es} / ${policy.message.en}` });
    if (token.length > 128) return res.status(400).json(INVALID_LINK);
    const row = await PasswordReset.findOne({ where: { tokenHash: hashToken(token) } });
    if (!row) return res.status(400).json(INVALID_LINK);
    // Consumo atómico: solo una petición logra marcarlo usado, aunque lleguen dos a la vez.
    const now = new Date();
    const [claimed] = await PasswordReset.update({ usedAt: now }, { where: { id: row.id, usedAt: null, expiresAt: { [Op.gt]: now } } });
    if (!claimed) return res.status(400).json(INVALID_LINK);
    const user = await User.findByPk(row.UserId);
    if (!user || user.active === false || await deletionPending(user.id)) return res.status(400).json(INVALID_LINK);
    await user.update({ password: await bcrypt.hash(password, 10), loginAttempts: 0, lockedUntil: null });
    await revokeUserSessions(user.id); // ES-18: las sesiones abiertas con la contraseña anterior dejan de valer
    await PasswordReset.update({ usedAt: now }, { where: { UserId: user.id, usedAt: null } });
    res.json({ message: 'Contraseña actualizada. Inicia sesión. / Password updated. Sign in.' });
  } catch {
    console.error('Error al restablecer la contraseña.');
    res.status(500).json({ error: 'Error en el servidor. / Server error.' });
  }
});

// Solo para pruebas: espera a que terminen los envíos pendientes.
router.idle = async () => { while (pending.size) await Promise.allSettled([...pending]); };

module.exports = router;
