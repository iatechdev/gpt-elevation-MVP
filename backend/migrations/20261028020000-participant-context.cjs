// Additive, explicit migration. Run through the reviewed infrastructure migration
// runner, never against production from a development session. No sync/alter.
const guardDown = require('../scripts/guard-down.cjs');

module.exports = {
  async up(queryInterface, Sequelize, transaction) {
    await queryInterface.createTable('ParticipantContexts', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      UserId: { type: Sequelize.INTEGER, allowNull: false, unique: true,
        references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      version: { type: Sequelize.INTEGER, allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      completedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    }, { transaction });
  },
  // El down borra datos de participantes: solo con permiso explícito y nunca en producción (guarda común, ES-59).
  async down(queryInterface) {
    guardDown('20261028020000-participant-context');
    await queryInterface.dropTable('ParticipantContexts');
  },
};
