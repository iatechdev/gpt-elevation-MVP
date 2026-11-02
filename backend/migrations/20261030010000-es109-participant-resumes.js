'use strict';
// ES-109 · Histórico de hojas de vida de la persona. Aditiva: solo crea una tabla.
// Debe coincidir con el modelo ParticipantResume (db:drift lo comprueba).
const guardDown = require('../scripts/guard-down.cjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('ParticipantResumes', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      UserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      version: { type: DataTypes.INTEGER, allowNull: false },
      size: { type: DataTypes.INTEGER, allowNull: false },
      sha256: { type: DataTypes.STRING(64), allowNull: false },
      data: { type: DataTypes.BLOB, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ParticipantResumes', ['UserId', 'version'], { unique: true, name: 'participant_resumes_user_version_unique' });
    await queryInterface.addIndex('ParticipantResumes', ['UserId', 'sha256'], { unique: true, name: 'participant_resumes_user_sha_unique' });
  },
  // El down borra hojas de vida (datos personales): solo con permiso explícito y nunca en producción (guarda común, ES-59).
  async down(queryInterface) {
    guardDown('20261030010000-es109-participant-resumes');
    await queryInterface.dropTable('ParticipantResumes');
  },
};
