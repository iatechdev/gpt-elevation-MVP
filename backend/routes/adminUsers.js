// backend/routes/adminUsers.js
// HU-045 + HU-063 + HU-077 + HU-078 — Gestión usuarios + alertas + planes + desbloqueo + reset password

const express = require('express');
const router = express.Router();
const { sequelize } = require('../database');
const { Op, Transaction } = require('sequelize');
const User = require('../User');
const MoodLog = require('../MoodLog');
const SessionRating = require('../SessionRating');
const PricingPlan = require('../PricingPlan');
const { validateBody, nonempty, optional, nullable, id, boolean } = require('../middlewares/validateBody');
const { revokeUserSessions } = require('../utils/sessions');
const { deletionPending } = require('../utils/deletionGuard');

const refuseDeletionPending = async (id, res) => {
  if (!await deletionPending(Number(id))) return false;
  res.status(409).json({ code: 'deletion_pending', error: 'La cuenta tiene una solicitud de eliminación. / The account has a deletion request.' });
  return true;
};

// Un promedio de muy pocas entradas revela el valor individual: por debajo de este número de entradas se devuelve null (QA-18-02).
const MIN_AVERAGE_SAMPLE = 5;
const averageOf = (values) => (values.length >= MIN_AVERAGE_SAMPLE
  ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
  : null);

// ==========================================
// POST /api/admin/usuarios — Crear usuario
// ==========================================
const ROLES_VALIDOS = ['user', 'therapist', 'admin', 'superadmin', 'board'];
const ROLES_PRIVILEGIADOS = ['admin', 'superadmin', 'board'];
// ES-215 (QA-42-01): una cuenta no puede cambiar el rol ni el estado de otra de rango igual o mayor. admin = 2, superadmin = 3; el resto no tiene rango de gestión.
const RANK = { admin: 2, superadmin: 3 };
const rankOf = (role) => RANK[role] || 0;

// ES-192 (decisión 24): administración ya no define la contraseña de otra persona. Se invita por enlace (POST /api/admin/invitations):
// la persona elige su propia contraseña con las reglas del registro. Esta ruta quedó retirada.
router.post('/', (req, res) => res.status(410).json({
  code: 'user_create_with_password_removed',
  error: 'Esta ruta se retiró: invita a la persona por enlace. / This route was removed: invite the person by link.',
}));

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

        const ratingPromedio = averageOf(ratings.map(r => r.rating));

        const todosLosMoods = moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean);
        const moodPromedio = averageOf(todosLosMoods);

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
    console.error('Error listando usuarios.');
    res.status(500).json({ error: 'No se pudo obtener la lista de usuarios.' });
  }
});

// ==========================================
// PUT /api/admin/usuarios/:id — Editar usuario
// ==========================================
router.put('/:id', validateBody({ role: optional(nonempty), active: optional(boolean) }), async (req, res) => {
  try {
    const { id } = req.params;
    if (await refuseDeletionPending(id, res)) return;
    const { role, active } = req.body;
    const adminRole = req.user.role;
    const adminId = req.user.id;

    if (parseInt(id) === adminId) {
      return res.status(403).json({ error: 'No puedes modificar tu propio usuario.' });
    }

    if (role !== undefined) {
      if (!ROLES_VALIDOS.includes(role)) {
        return res.status(400).json({ error: `Rol inválido. Roles válidos: ${ROLES_VALIDOS.join(', ')}.` });
      }
      if (adminRole === 'admin' && ROLES_PRIVILEGIADOS.includes(role)) {
        return res.status(403).json({ error: 'No tienes permisos para asignar ese rol.' });
      }
    }

    const updates = {};
    if (role !== undefined) updates.role = role;
    if (active !== undefined) updates.active = active;

    // ES-215: todo ocurre en una transacción con las filas de superadministración bloqueadas (en orden fijo), así dos cambios
    // simultáneos no pueden dejar la plataforma sin superadmin activo ni saltarse la regla de rango con un rol leído a destiempo.
    const tx = await sequelize.transaction();
    let usuario; let refused = null;
    try {
      const supers = await User.findAll({ where: { role: 'superadmin' }, attributes: ['id', 'active'], order: [['id', 'ASC']], lock: Transaction.LOCK.UPDATE, transaction: tx });
      usuario = await User.findByPk(id, { transaction: tx, lock: Transaction.LOCK.UPDATE });
      if (!usuario) refused = [404, { error: 'Usuario no encontrado.' }];
      else if (adminRole !== 'superadmin' && rankOf(usuario.role) >= rankOf(adminRole) && (role !== undefined || active !== undefined)) {
        // Una cuenta admin no cambia el rol ni el estado de otra admin ni de una superadmin; solo superadmin lo hace.
        refused = [403, { code: 'target_rank', error: 'No tienes permisos para cambiar el rol o el estado de una cuenta de administración. / You cannot change the role or status of an administration account.' }];
      } else if (usuario.role === 'superadmin' && ((role !== undefined && role !== 'superadmin') || active === false)
        && !(Array.isArray(supers) ? supers : []).some((s) => s.id !== usuario.id && s.active)) {
        refused = [409, { code: 'last_superadmin', error: 'La plataforma debe conservar al menos una cuenta superadmin activa. / The platform must keep at least one active superadmin account.' }];
      } else {
        await usuario.update(updates, { transaction: tx });
      }
      if (refused) await tx.rollback(); else await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw error;
    }
    if (refused) return res.status(refused[0]).json(refused[1]);
    // ES-18: un cambio de rol o estado corta las sesiones anteriores de esa cuenta
    if (role !== undefined || active !== undefined) await revokeUserSessions(usuario.id);

    res.json({
      message: 'Usuario actualizado correctamente.',
      usuario: {
        id: usuario.id, name: usuario.name,
        email: usuario.email, role: usuario.role, active: usuario.active,
      }
    });
  } catch (error) {
    console.error('Error actualizando usuario.');
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
    if (await refuseDeletionPending(id, res)) return;
    if (parseInt(id) === adminId) {
      return res.status(403).json({ error: 'No puedes eliminar tu propio usuario.' });
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
    await revokeUserSessions(usuario.id); // ES-18

    console.log('Borrado administrativo ejecutado.');
    res.json({ message: `Usuario ${nombreUsuario} eliminado permanentemente.` });
  } catch (error) {
    console.error('Error eliminando usuario.');
    res.status(500).json({ error: 'No se pudo eliminar el usuario.' });
  }
});

// ==========================================
// PUT /api/admin/usuarios/:id/asignar-terapeuta
// ==========================================
router.put('/:id/asignar-terapeuta', validateBody({ therapistId: nullable(id) }), async (req, res) => {
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

    const next = therapistId || null;
    const previous = usuario.therapistId || null;
    const transaction = await sequelize.transaction();
    try {
      // La autorización de compartir es con UN terapeuta: al cambiar o quitar, la del anterior se retira (el nuevo debe obtener la suya; si la persona
      // vuelve al original, tampoco revive la anterior). Un error no se traga: el cambio y el retiro ocurren juntos o ninguno.
      if (previous !== null && previous !== next) await require('../utils/consent').revokeTherapistSharing(usuario.id, previous, transaction);
      await usuario.update({ therapistId: next }, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
    res.json({ message: 'Terapeuta asignado correctamente.' });
  } catch (error) {
    console.error('Error asignando terapeuta.');
    res.status(500).json({ error: 'No se pudo asignar el terapeuta.' });
  }
});

// ==========================================
// PUT /api/admin/usuarios/:id/plan — HU-077
// ==========================================
router.put('/:id/plan', validateBody({ planId: optional(nullable(id)) }), async (req, res) => {
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
    console.error('Error asignando plan.');
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

    const ratingPromedio = averageOf(ratings.map(r => r.rating));

    const todosLosMoods = moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean);
    const moodPromedio = averageOf(todosLosMoods);

    res.json({
      usuario: usuario.toJSON(),
      stats: {
        // ES-18: solo cifras agregadas; las entradas de ánimo y valoración por fecha no se entregan al administrador
        sesiones, ratingPromedio, moodPromedio,
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas.');
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
    console.error('Error fetching admin alerts.');
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
    if (await refuseDeletionPending(req.params.id, res)) return;
    const usuario = await User.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

    await usuario.update({
      loginAttempts: 0,
      lockedUntil:   null,
      active:        true,
    });

    console.log('Desbloqueo administrativo ejecutado.');
    res.json({ message: `Cuenta de ${usuario.name} desbloqueada correctamente.` });
  } catch (error) {
    console.error('Error desbloqueando usuario.');
    res.status(500).json({ error: 'No se pudo desbloquear el usuario.' });
  }
});

// ==========================================
// HU-078 — PUT /api/admin/usuarios/:id/reset-password
// Reset de contraseña por superadmin
// El admin establece una contraseña temporal
// ==========================================
// ES-192 (decisión 24): administración NO escribe ni ve la contraseña de otra cuenta. Esta ruta quedó retirada; ver POST /:id/reset-link.
router.put('/:id/reset-password', (req, res) => res.status(410).json({
  code: 'admin_password_reset_removed',
  error: 'Esta ruta se retiró: envía un enlace de restablecimiento. / This route was removed: send a reset link.',
}));

// POST /api/admin/usuarios/:id/reset-link — «Enviar enlace de restablecimiento» (sustituye a la contraseña escrita por administración).
// El enlace (un solo uso, vence) va al correo de la cuenta; la respuesta no lo incluye. Solo superadmin, como el reset anterior.
router.post('/:id/reset-link', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Solo el superadmin puede enviar enlaces de restablecimiento.' });
    if (await refuseDeletionPending(req.params.id, res)) return;
    const usuario = await User.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
    // No se puede restablecer la contraseña de otro superadmin
    if (usuario.role === 'superadmin' && usuario.id !== req.user.id) return res.status(403).json({ error: 'No se puede restablecer la contraseña de otro superadmin.' });
    const locale = req.body && req.body.locale === 'en' ? 'en' : 'es';
    const passwordReset = require('./passwordReset');
    passwordReset.track(passwordReset.issueLinkForUser(usuario, locale).catch(() => console.error('Error al preparar el enlace de restablecimiento.')));
    res.status(202).json({ message: 'Si la cuenta puede recibirlo, se envió un enlace de restablecimiento a su correo. / If the account can receive it, a reset link was sent to its email.' });
  } catch (error) {
    console.error('Error al enviar el enlace de restablecimiento.');
    res.status(500).json({ error: 'No se pudo enviar el enlace.' });
  }
});

module.exports = router;
