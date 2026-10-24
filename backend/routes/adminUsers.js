// backend/routes/adminUsers.js
// HU-045 + HU-063 + HU-077 + HU-078 — Gestión usuarios + alertas + planes + desbloqueo + reset password

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../User');
const MoodLog = require('../MoodLog');
const SessionRating = require('../SessionRating');
const PricingPlan = require('../PricingPlan');

const ROLES_VALIDOS = ['user', 'therapist', 'admin', 'superadmin', 'board'];
const ROLES_ADMIN_PUEDE_CREAR = ['user', 'therapist'];
const ROLES_PRIVILEGIADOS = ['admin', 'superadmin', 'board'];

// ==========================================
// POST /api/admin/usuarios — Crear usuario
// ==========================================
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const adminRole = req.user.role;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password y role son requeridos.' });
    }
    if (!ROLES_VALIDOS.includes(role)) {
      return res.status(400).json({ error: `Rol inválido. Roles válidos: ${ROLES_VALIDOS.join(', ')}.` });
    }
    if (adminRole === 'admin' && ROLES_PRIVILEGIADOS.includes(role)) {
      return res.status(403).json({ error: 'No tenés permisos para crear usuarios con ese rol.' });
    }

    const existente = await User.findOne({ where: { email } });
    if (existente) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = await User.create({
      name, email, password: hashedPassword, role, active: true,
    });

    res.status(201).json({
      message: `Usuario ${nuevoUsuario.name} creado exitosamente.`,
      usuario: {
        id: nuevoUsuario.id, name: nuevoUsuario.name,
        email: nuevoUsuario.email, role: nuevoUsuario.role,
        active: nuevoUsuario.active, createdAt: nuevoUsuario.createdAt,
      }
    });
  } catch (error) {
    console.error('❌ Error creando usuario:', error);
    res.status(500).json({ error: 'No se pudo crear el usuario.' });
  }
});

// ==========================================
// GET /api/admin/usuarios — Listar usuarios
// ==========================================
router.get('/', async (req, res) => {
  try {
    const { role, active, therapistId } = req.query;
    const where = {};
    if (role) where.role = role;
    if (active !== undefined) where.active = active === 'true';
    if (therapistId) where.therapistId = therapistId;

    const usuarios = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'role', 'active', 'therapistId', 'planId', 'createdAt', 'loginAttempts', 'lockedUntil'],
      include: [{ model: PricingPlan, as: 'plan', attributes: ['id', 'slug', 'name_es', 'name_en'] }],
      order: [['createdAt', 'DESC']],
    });

    const usuariosConStats = await Promise.all(
      usuarios.map(async (u) => {
        const sesiones = await MoodLog.count({ where: { UserId: u.id } });
        const ratings = await SessionRating.findAll({ where: { UserId: u.id }, attributes: ['rating'] });
        const moodLogs = await MoodLog.findAll({
          where: { UserId: u.id },
          attributes: ['checkin_mood', 'checkout_mood'],
        });

        const ratingPromedio = ratings.length > 0
          ? Math.round((ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length) * 10) / 10
          : null;

        const todosLosMoods = moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean);
        const moodPromedio = todosLosMoods.length > 0
          ? Math.round((todosLosMoods.reduce((a, b) => a + b, 0) / todosLosMoods.length) * 10) / 10
          : null;

        // Determinar si está bloqueado por intentos fallidos
        const isLocked = u.lockedUntil && new Date() < new Date(u.lockedUntil);

        return {
          id: u.id, name: u.name, email: u.email, role: u.role,
          active: u.active, therapistId: u.therapistId, createdAt: u.createdAt,
          plan: u.plan ?? null,
          sesiones, ratingPromedio, moodPromedio,
          isLocked: !!isLocked,
          lockedUntil: u.lockedUntil,
          loginAttempts: u.loginAttempts,
        };
      })
    );

    res.json(usuariosConStats);
  } catch (error) {
    console.error('❌ Error listando usuarios:', error);
    res.status(500).json({ error: 'No se pudo obtener la lista de usuarios.' });
  }
});

// ==========================================
// PUT /api/admin/usuarios/:id — Editar usuario
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, active } = req.body;
    const adminRole = req.user.role;
    const adminId = req.user.id;

    if (parseInt(id) === adminId) {
      return res.status(403).json({ error: 'No podés modificar tu propio usuario.' });
    }

    const usuario = await User.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

    if (role !== undefined) {
      if (!ROLES_VALIDOS.includes(role)) {
        return res.status(400).json({ error: `Rol inválido. Roles válidos: ${ROLES_VALIDOS.join(', ')}.` });
      }
      if (adminRole === 'admin' && ROLES_PRIVILEGIADOS.includes(role)) {
        return res.status(403).json({ error: 'No tenés permisos para asignar ese rol.' });
      }
    }

    const updates = {};
    if (role !== undefined) updates.role = role;
    if (active !== undefined) updates.active = active;

    await usuario.update(updates);

    res.json({
      message: 'Usuario actualizado correctamente.',
      usuario: {
        id: usuario.id, name: usuario.name,
        email: usuario.email, role: usuario.role, active: usuario.active,
      }
    });
  } catch (error) {
    console.error('❌ Error actualizando usuario:', error);
    res.status(500).json({ error: 'No se pudo actualizar el usuario.' });
  }
});

// ==========================================
// DELETE /api/admin/usuarios/:id — Eliminar usuario
// Solo superadmin. Borrado físico permanente.
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const adminRole = req.user.role;
    const adminId   = req.user.id;

    if (adminRole !== 'superadmin') {
      return res.status(403).json({ error: 'Solo el superadmin puede eliminar usuarios permanentemente.' });
    }
    if (parseInt(id) === adminId) {
      return res.status(403).json({ error: 'No podés eliminar tu propio usuario.' });
    }

    const usuario = await User.findByPk(id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (usuario.role === 'superadmin') {
      return res.status(403).json({ error: 'No se puede eliminar a un superadmin.' });
    }

    const nombreUsuario = usuario.name;
    await usuario.destroy();

    console.log(`🗑️ Usuario eliminado permanentemente: ${nombreUsuario} (id: ${id}) por superadmin ${req.user.name}`);
    res.json({ message: `Usuario ${nombreUsuario} eliminado permanentemente.` });
  } catch (error) {
    console.error('❌ Error eliminando usuario:', error);
    res.status(500).json({ error: 'No se pudo eliminar el usuario.' });
  }
});

// ==========================================
// PUT /api/admin/usuarios/:id/asignar-terapeuta
// ==========================================
router.put('/:id/asignar-terapeuta', async (req, res) => {
  try {
    const { id } = req.params;
    const { therapistId } = req.body;

    const usuario = await User.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (usuario.role !== 'user') {
      return res.status(400).json({ error: 'Solo se puede asignar terapeuta a usuarios con rol user.' });
    }

    if (therapistId !== null) {
      const terapeuta = await User.findOne({ where: { id: therapistId, role: 'therapist', active: true } });
      if (!terapeuta) {
        return res.status(404).json({ error: 'Terapeuta no encontrado o no está activo.' });
      }
    }

    await usuario.update({ therapistId: therapistId || null });
    res.json({ message: 'Terapeuta asignado correctamente.' });
  } catch (error) {
    console.error('❌ Error asignando terapeuta:', error);
    res.status(500).json({ error: 'No se pudo asignar el terapeuta.' });
  }
});

// ==========================================
// PUT /api/admin/usuarios/:id/plan — HU-077
// ==========================================
router.put('/:id/plan', async (req, res) => {
  try {
    const { id } = req.params;
    const { planId } = req.body;

    const usuario = await User.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (usuario.role !== 'user') {
      return res.status(400).json({ error: 'Solo se puede asignar plan a usuarios con rol user.' });
    }

    if (planId !== null && planId !== undefined) {
      const plan = await PricingPlan.findOne({ where: { id: planId, isActive: true } });
      if (!plan) return res.status(404).json({ error: 'Plan no encontrado o inactivo.' });
    }

    await usuario.update({ planId: planId || null });

    const updatedUser = await User.findByPk(id, {
      include: [{ model: PricingPlan, as: 'plan', attributes: ['id', 'slug', 'name_es', 'name_en', 'price'] }],
    });

    res.json({
      message: 'Plan asignado correctamente.',
      usuario: {
        id: updatedUser.id,
        name: updatedUser.name,
        plan: updatedUser.plan ?? null,
      }
    });
  } catch (error) {
    console.error('❌ Error asignando plan:', error);
    res.status(500).json({ error: 'No se pudo asignar el plan.' });
  }
});

// ==========================================
// GET /api/admin/usuarios/:id/stats
// ==========================================
router.get('/:id/stats', async (req, res) => {
  try {
    const usuario = await User.findByPk(req.params.id, {
      attributes: ['id', 'name', 'email', 'role', 'active', 'createdAt'],
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const sesiones = await MoodLog.count({ where: { UserId: usuario.id } });
    const ratings = await SessionRating.findAll({ where: { UserId: usuario.id }, attributes: ['rating', 'date'] });
    const moodLogs = await MoodLog.findAll({
      where: { UserId: usuario.id },
      attributes: ['checkin_mood', 'checkout_mood', 'date'],
      order: [['date', 'DESC']],
      limit: 30,
    });

    const ratingPromedio = ratings.length > 0
      ? Math.round((ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length) * 10) / 10
      : null;

    const todosLosMoods = moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean);
    const moodPromedio = todosLosMoods.length > 0
      ? Math.round((todosLosMoods.reduce((a, b) => a + b, 0) / todosLosMoods.length) * 10) / 10
      : null;

    res.json({
      usuario: usuario.toJSON(),
      stats: {
        sesiones, ratingPromedio, moodPromedio,
        ultimosRatings: ratings.slice(-5),
        ultimosMoods: moodLogs.slice(0, 7),
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo stats:', error);
    res.status(500).json({ error: 'No se pudieron obtener las estadísticas.' });
  }
});

// ==========================================
// HU-063 — GET /api/admin/alerts
// ==========================================
router.get('/alerts', async (req, res) => {
  try {
    const { PromptVault } = require('../promptVault');
    const TherapistProfile = require('../TherapistProfile');

    const pendingPrompts = await PromptVault.findAll({
      where: { status: 'pending_review' },
      attributes: ['id', 'key', 'version', 'proposed_by', 'createdAt'],
      order: [['createdAt', 'ASC']],
      limit: 5,
    });

    const pendingPromptsList = await Promise.all(
      pendingPrompts.map(async (p) => {
        const match = p.key.match(/therapist_prompt_(\d+)/);
        let therapistName = p.proposed_by ?? 'Unknown';
        if (match) {
          const therapist = await User.findByPk(match[1], { attributes: ['name'] });
          if (therapist) therapistName = therapist.name;
        }
        return {
          id: p.id,
          therapistName,
          version: p.version,
          proposedBy: p.proposed_by,
          createdAt: p.createdAt,
        };
      })
    );

    const therapists = await User.findAll({
      where: { role: 'therapist', active: true },
      attributes: ['id', 'name'],
    });

    let therapistsWithoutProfile = 0;
    await Promise.all(therapists.map(async (t) => {
      const profile = await TherapistProfile.findOne({ where: { UserId: t.id } });
      if (!profile || !profile.bio || !profile.specialties) {
        therapistsWithoutProfile++;
      }
    }));

    res.json({
      pendingPrompts: pendingPromptsList.length,
      pendingPromptsList,
      therapistsWithoutProfile,
      manifestoVersion: 'v1.0',
      manifestoDate: '2026-04-02',
    });
  } catch (error) {
    console.error('❌ Error fetching admin alerts:', error);
    res.status(500).json({ error: 'Could not fetch admin alerts.' });
  }
});

// ==========================================
// HU-078 — PUT /api/admin/usuarios/:id/unlock
// Desbloquear cuenta bloqueada por intentos fallidos
// Admin y superadmin pueden hacer esto
// ==========================================
router.put('/:id/unlock', async (req, res) => {
  try {
    const usuario = await User.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

    await usuario.update({
      loginAttempts: 0,
      lockedUntil:   null,
      active:        true,
    });

    console.log(`🔓 Usuario desbloqueado: ${usuario.name} (id: ${usuario.id}) por ${req.user.role} ${req.user.name}`);
    res.json({ message: `Cuenta de ${usuario.name} desbloqueada correctamente.` });
  } catch (error) {
    console.error('❌ Error desbloqueando usuario:', error);
    res.status(500).json({ error: 'No se pudo desbloquear el usuario.' });
  }
});

// ==========================================
// HU-078 — PUT /api/admin/usuarios/:id/reset-password
// Reset de contraseña por superadmin
// El admin establece una contraseña temporal
// ==========================================
router.put('/:id/reset-password', async (req, res) => {
  try {
    const adminRole = req.user.role;

    // Solo superadmin puede resetear contraseñas
    if (adminRole !== 'superadmin') {
      return res.status(403).json({ error: 'Solo el superadmin puede resetear contraseñas.' });
    }

    const { newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    const usuario = await User.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

    // No se puede resetear la contraseña de otro superadmin
    if (usuario.role === 'superadmin' && usuario.id !== req.user.id) {
      return res.status(403).json({ error: 'No se puede resetear la contraseña de otro superadmin.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
    await usuario.update({
      password:      hashedPassword,
      loginAttempts: 0,
      lockedUntil:   null,
      active:        true,
    });

    console.log(`🔑 Contraseña reseteada para: ${usuario.name} (id: ${usuario.id}) por superadmin ${req.user.name}`);
    res.json({ message: `Contraseña de ${usuario.name} reseteada correctamente.` });
  } catch (error) {
    console.error('❌ Error reseteando contraseña:', error);
    res.status(500).json({ error: 'No se pudo resetear la contraseña.' });
  }
});

module.exports = router;