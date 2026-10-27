// Additive, explicit migration. Run through the reviewed infrastructure migration
// runner, never against production from a development session. No sync/alter.
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
  // Deliberately no destructive down: preserve participant data on app rollback.
};
