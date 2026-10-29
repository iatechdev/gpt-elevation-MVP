'use strict';
// ES-95 · Solicitudes públicas de profesionales y su hoja de vida (PDF cifrado). Aditiva: solo crea dos tablas.
// Debe coincidir con los modelos ProfessionalApplication y ProfessionalApplicationFile (db:drift lo comprueba).
const guardDown = require('../scripts/guard-down.cjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('ProfessionalApplications', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(254), allowNull: false },
      country: { type: DataTypes.STRING(80), allowNull: false },
      profession: { type: DataTypes.STRING(120), allowNull: false },
      licenseNumber: { type: DataTypes.STRING(60), allowNull: true },
      profileUrl: { type: DataTypes.STRING(300), allowNull: true },
      message: { type: DataTypes.TEXT, allowNull: true },
      locale: { type: DataTypes.STRING(2), allowNull: false, defaultValue: 'es' },
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
      reviewedBy: { type: DataTypes.STRING(120), allowNull: true },
      reviewNote: { type: DataTypes.TEXT, allowNull: true },
      reviewedAt: { type: DataTypes.DATE, allowNull: true },
      consentAt: { type: DataTypes.DATE, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ProfessionalApplications', ['status', 'createdAt']);
    await queryInterface.addIndex('ProfessionalApplications', ['email']);
    await queryInterface.createTable('ProfessionalApplicationFiles', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      ApplicationId: {
        type: DataTypes.INTEGER, allowNull: false, unique: true,
        references: { model: 'ProfessionalApplications', key: 'id' }, onDelete: 'CASCADE',
      },
      size: { type: DataTypes.INTEGER, allowNull: false },
      sha256: { type: DataTypes.STRING(64), allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },
  // El down borra solicitudes y hojas de vida (datos personales): solo con permiso explícito y nunca en producción (guarda común, ES-59).
  async down(queryInterface) {
    guardDown('20261029000000-es95-professional-applications');
    await queryInterface.dropTable('ProfessionalApplicationFiles');
    await queryInterface.dropTable('ProfessionalApplications');
  },
};
