// backend/routes/auth.js
// POST /api/register
// POST /api/login
// Sin middleware — rutas públicas

const express   = require('express');
const router    = express.Router();
const bcrypt    = require('bcryptjs');
const { issueToken } = require('../utils/sessions');
const rateLimit = require('express-rate-limit');
const User      = require('../User');
const { deletionPending } = require('../utils/deletionGuard');
const { validateBody, nonempty } = require('../middlewares/validateBody');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Inténtalo de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/register
router.post('/register', validateBody({ name: nonempty, email: nonempty, password: nonempty }), async (req, res) => {
  try {
    const { name, email, password } = req.body;

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

    if (!user) {
      await delay(200);
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    // Una cuenta inactiva no se recupera mediante el registro público.
    if (user.active === false) {
      return res.status(403).json({
        error: 'Cuenta inactiva. Contacta con soporte. / Inactive account. Contact support.',
        deactivated: true,
      });
    }

    // Cuenta bloqueada por intentos fallidos
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const minutosRestantes = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      return res.status(423).json({
        error: `Cuenta bloqueada. Inténtalo de nuevo en ${minutosRestantes} minuto${minutosRestantes > 1 ? 's' : ''}.`,
        locked: true,
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      const nuevosIntentos = (user.loginAttempts || 0) + 1;
      if (nuevosIntentos >= 3) {
        const bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000);
        await user.update({ loginAttempts: nuevosIntentos, lockedUntil: bloqueadoHasta });
        return res.status(423).json({ error: 'Cuenta bloqueada por 15 minutos.', locked: true });
      }
      await user.update({ loginAttempts: nuevosIntentos });
      await delay(200);
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    await user.update({ loginAttempts: 0, lockedUntil: null });

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
