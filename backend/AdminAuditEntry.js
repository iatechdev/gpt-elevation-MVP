const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-186 (parte B) · Auditoría de acciones de administración: quién (actorId, rol), qué (action), sobre quién (targetId) y con qué resultado.
// NO guarda contraseñas, tokens, enlaces ni correos completos: solo ids y claves de acción. Solo la lee superadministración.
// Se escribe en la MISMA transacción que la acción (si la acción se revierte, la entrada también; las denegaciones se registran aparte, con result = 'denied').
const AdminAuditEntry = sequelize.define('AdminAuditEntry', {
  actorId: { type: DataTypes.INTEGER, allowNull: true },
  actorRole: { type: DataTypes.STRING(16), allowNull: true },
  action: { type: DataTypes.STRING(40), allowNull: false },
  targetType: { type: DataTypes.STRING(24), allowNull: true },
  targetId: { type: DataTypes.INTEGER, allowNull: true },
  result: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'ok' }, // ok | denied | failed
}, {
  updatedAt: false, // una entrada de auditoría no se edita
  indexes: [
    { name: 'admin_audit_entries__created_at', fields: ['createdAt'] },
    { name: 'admin_audit_entries__actor_created_at', fields: ['actorId', 'createdAt'] },
    { name: 'admin_audit_entries__target', fields: ['targetType', 'targetId'] },
  ],
});

module.exports = AdminAuditEntry;
