// backend/routes/auth.js
// POST /api/register
// POST /api/login
// Sin middleware — rutas públicas

const express   = require('express');
const router    = express.Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User      = require('../User');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_2026';
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET no está configurado — usando valor de desarrollo');
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Intentá de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos.' });
    }

    // Verificar si el email ya existe en la BD
    const existing = await User.findOne({ where: { email } });

    if (existing) {
      if (existing.active === false) {
        // Usuario desactivado — reactivar con los nuevos datos
        const hashedPassword = await bcrypt.hash(password, 10);
        await existing.update({
          name,
          password: hashedPassword,
          active: true,
          loginAttempts: 0,
          lockedUntil: null,
        });
        return res.status(200).json({
          message: '¡Bienvenido de vuelta a Elevation! Tu cuenta ha sido reactivada.',
          reactivated: true,
        });
      }

      // Usuario activo — no se puede registrar con ese email
      return res.status(400).json({ error: 'El correo ya está registrado.' });
    }

    // Usuario nuevo — crear normalmente
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const role = adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';
    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({ name, email, password: hashedPassword, role });
    res.status(201).json({ message: 'Usuario creado exitosamente. ¡Bienvenido a Elevation!' });

  } catch (error) {
    console.error('❌ Error en register:', error);
    res.status(500).json({ error: 'Error en el servidor al registrar.' });
  }
});

// POST /api/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      await delay(200);
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    // Usuario desactivado — informar que puede reactivarse
    if (user.active === false) {
      return res.status(403).json({
        error: 'Tu cuenta está desactivada. Podés reactivarla registrándote nuevamente con tu correo.',
        deactivated: true,
      });
    }

    // Cuenta bloqueada por intentos fallidos
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const minutosRestantes = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      return res.status(423).json({
        error: `Cuenta bloqueada. Intentá de nuevo en ${minutosRestantes} minuto${minutosRestantes > 1 ? 's' : ''}.`,
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

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      name: user.name,
      role: user.role,
      onboardingCompleted: user.onboardingCompleted ?? false,
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

module.exports = router;