// backend/routes/adminUsuarios.js
// HU-045 — Gestión de usuarios desde backoffice

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../User');
const MoodLog = require('../MoodLog');
const SessionRating = require('../SessionRating');

// ==========================================
// ROLES PERMITIDOS POR TIPO DE ADMIN
// ==========================================
const ROLES_VALIDOS = ['user', 'therapist', 'admin', 'superadmin'];
const ROLES_ADMIN_PUEDE_CREAR = ['user', 'therapist'];
const ROLES_PRIVILEGIADOS = ['admin', 'superadmin'];

// ==========================================
// POST /api/admin/usuarios — Crear usuario
// ==========================================
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const adminRole = req.user.role;

    // Validaciones básicas
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password y role son requeridos.' });
    }

    if (!ROLES_VALIDOS.includes(role)) {
      return res.status(400).json({ error: `Rol inválido. Roles válidos: ${ROLES_VALIDOS.join(', ')}.` });
    }

    // Admin no puede crear roles privilegiados
    if (adminRole === 'admin' && ROLES_PRIVILEGIADOS.includes(role)) {
      return res.status(403).json({ error: 'No tenés permisos para crear usuarios con ese rol.' });
    }

    // Verificar email duplicado
    const existente = await User.findOne({ where: { email } });
    if (existente) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      active: true,
    });

    res.status(201).json({
      message: `Usuario ${nuevoUsuario.name} creado exitosamente.`,
      usuario: {
        id: nuevoUsuario.id,
        name: nuevoUsuario.name,
        email: nuevoUsuario.email,
        role: nuevoUsuario.role,
        active: nuevoUsuario.active,
        createdAt: nuevoUsuario.createdAt,
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
      attributes: ['id', 'name', 'email', 'role', 'active', 'therapistId', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    // Agregar estadísticas básicas por usuario
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

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
          therapistId: u.therapistId,
          createdAt: u.createdAt,
          sesiones,
          ratingPromedio,
          moodPromedio,
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

    // No puede editarse a sí mismo
    if (parseInt(id) === adminId) {
      return res.status(403).json({ error: 'No podés modificar tu propio usuario.' });
    }

    const usuario = await User.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

    // Validar cambio de rol
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
        id: usuario.id,
        name: usuario.name,
        email: usuario.email,
        role: usuario.role,
        active: usuario.active,
      }
    });
  } catch (error) {
    console.error('❌ Error actualizando usuario:', error);
    res.status(500).json({ error: 'No se pudo actualizar el usuario.' });
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
        sesiones,
        ratingPromedio,
        moodPromedio,
        ultimosRatings: ratings.slice(-5),
        ultimosMoods: moodLogs.slice(0, 7),
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo stats:', error);
    res.status(500).json({ error: 'No se pudieron obtener las estadísticas.' });
  }
});

module.exports = router;