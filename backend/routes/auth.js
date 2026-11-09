// backend/routes/auth.js
// POST /api/register
// POST /api/login
// Sin middleware — rutas públicas

const express   = require('express');
const router    = express.Router();
const bcrypt    = require('bcryptjs');
const { issueToken } = require('../utils/sessions');
const rateLimit = require('express-rate-limit');
const { loginRateMax } = require('../utils/loginRateLimit');
const User      = require('../User');
const { deletionPending } = require('../utils/deletionGuard');
const { validateBody, nonempty } = require('../middlewares/validateBody');
const { passwordProblems, policy } = require('../utils/registrationPassword');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ES-220: respuestas del login que no distinguen si el correo tiene cuenta (ver el bloque de /login).
const loginAttempts = require('../utils/loginAttempts');
const DECOY_HASH = bcrypt.hashSync('es220-señuelo-que-nunca-coincide', 10); // mismo costo (10) que los hashes reales: tiempo equivalente
const INVALID_CREDENTIALS = { error: 'Credenciales incorrectas.' };
// ES-220 (QA-220-01): el conteo de intentos fallidos de una cuenta real es ATÓMICO en la base. Con leer-sumar-escribir, cinco intentos simultáneos leían todos
// loginAttempts = 0 y ninguno bloqueaba, mientras el contador en memoria de un correo sin cuenta (síncrono) sí bloqueaba: otra vez un oráculo de existencia.
// Un solo UPDATE … RETURNING suma y decide el bloqueo con la fila bloqueada; el 3.er, 4.º y 5.º intento en paralelo reciben 423, igual que un correo inexistente.
// Semántica idéntica a la anterior (umbral 3, 15 min, la cuenta no se desbloquea hasta un acierto): el bloqueo solo se fija si no había uno vigente.
async function failRealAttempt(real) {
  const sequelize = User.sequelize;
  if (sequelize?.getDialect?.() === 'postgres') {
    const table = sequelize.getQueryInterface().queryGenerator.quoteTable(User.getTableName());
    const [rows] = await sequelize.query(
      `UPDATE ${table} SET "loginAttempts" = COALESCE("loginAttempts", 0) + 1,
         "lockedUntil" = CASE WHEN COALESCE("loginAttempts", 0) + 1 >= :max AND ("lockedUntil" IS NULL OR "lockedUntil" <= NOW()) THEN :until ELSE "lockedUntil" END
       WHERE "id" = :id RETURNING "loginAttempts", "lockedUntil"`,
      { replacements: { max: loginAttempts.MAX_ATTEMPTS, until: new Date(Date.now() + loginAttempts.LOCK_MS), id: real.id } },
    );
    const row = rows[0];
    if (!row) return { locked: false, until: null };
    const until = row.lockedUntil ? new Date(row.lockedUntil) : null;
    return row.loginAttempts >= loginAttempts.MAX_ATTEMPTS && until && until.getTime() > Date.now() ? { locked: true, until } : { locked: false, until: null };
  }
  // Sin Postgres (almacén simulado de las pruebas): leer-sumar-escribir como antes.
  const attemptsNow = (real.loginAttempts || 0) + 1;
  if (attemptsNow >= loginAttempts.MAX_ATTEMPTS) {
    const until = new Date(Date.now() + loginAttempts.LOCK_MS);
    await real.update({ loginAttempts: attemptsNow, lockedUntil: until });
    return { locked: true, until };
  }
  await real.update({ loginAttempts: attemptsNow });
  return { locked: false, until: null };
}
const lockedBody = (until) => {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000));
  return { error: `Cuenta bloqueada. Inténtalo de nuevo en ${minutes} minuto${minutes > 1 ? 's' : ''}.`, locked: true };
};

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: loginRateMax(), // por IP y minuto: 10 (LOGIN_RATE_LIMIT_MAX solo se respeta fuera de producción, ver utils/loginRateLimit.js)
  message: { error: 'Demasiados intentos. Inténtalo de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/register
router.post('/register', validateBody({ name: nonempty, email: nonempty, password: nonempty }), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const missing = passwordProblems(password);
    if (missing.length) {
      return res.status(400).json({ code: 'password_policy', missing, error: `${policy.message.es} / ${policy.message.en}` });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos.' });
    }

    // Verificar si el email ya existe en la BD
    const existing = await User.findOne({ where: { email } });

    if (existing) {
      if (existing.active === false) {
        // Registration is not proof of ownership of an existing account.
        return res.status(403).json({
          error: 'Cuenta inactiva. Contacta con soporte. / Inactive account. Contact support.',
        });
      }

      // Usuario activo — no se puede registrar con ese email
      return res.status(400).json({ error: 'El correo ya está registrado.' });
    }

    // Usuario nuevo — crear normalmente
    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({ name, email, password: hashedPassword, role: 'user' });
    res.status(201).json({ message: 'Usuario creado exitosamente. ¡Bienvenido a Elevation!' });

  } catch (error) {
    console.error('Error en register.');
    res.status(500).json({ error: 'Error en el servidor al registrar.' });
  }
});

// POST /api/login
router.post('/login', loginLimiter, validateBody({ email: nonempty, password: nonempty }), async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    // ES-220: tres casos con la MISMA respuesta hacia fuera, para que el login no sea un oráculo de qué correos tienen cuenta:
    //  - correo inexistente  → se compara contra un hash señuelo (mismo costo de bcrypt) y se cuentan intentos en memoria con el umbral de una cuenta real;
    //  - cuenta inactiva     → se trata como inexistente mientras la contraseña no sea correcta (sin 403 «inactiva» antes de comprobarla);
    //  - cuenta bloqueada    → 423 con el mismo cuerpo que un correo inexistente bloqueado (que se bloquea igual tras 3 intentos).
    // Quien ya tiene la contraseña correcta de una cuenta inactiva sí recibe el aviso de cuenta inactiva (no aprende nada que no sepa).
    const real = user && user.active !== false ? user : null;
    const lockedUntilDate = real
      ? (real.lockedUntil && new Date() < new Date(real.lockedUntil) ? new Date(real.lockedUntil) : null)
      : loginAttempts.lockedUntil(email);
    if (lockedUntilDate) return res.status(423).json(lockedBody(lockedUntilDate));

    const validPassword = await bcrypt.compare(password, user ? user.password : DECOY_HASH);

    if (!user || !validPassword) {
      if (real) {
        const failure = await failRealAttempt(real);
        if (failure.locked) return res.status(423).json(lockedBody(failure.until));
      } else {
        const failure = loginAttempts.recordFailure(email);
        if (failure.locked) return res.status(423).json(lockedBody(failure.until));
      }
      await delay(200);
      return res.status(401).json(INVALID_CREDENTIALS);
    }

    // Contraseña correcta de una cuenta inactiva: una cuenta inactiva no inicia sesión ni se recupera por el registro público.
    if (!real) {
      return res.status(403).json({
        error: 'Cuenta inactiva. Contacta con soporte. / Inactive account. Contact support.',
        deactivated: true,
      });
    }

    await real.update({ loginAttempts: 0, lockedUntil: null });

    // A permanent tombstone also denies new sessions after administrative reactivation.
    if (await deletionPending(user.id)) return res.status(403).json({
      code: 'deletion_pending', error: 'La cuenta tiene una solicitud de eliminación. / The account has a deletion request.',
    });
    const token = issueToken(user);

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      name: user.name,
      role: user.role,
      onboardingCompleted: user.onboardingCompleted ?? false,
    });

  } catch (error) {
    console.error('Error en login.');
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

module.exports = router;
