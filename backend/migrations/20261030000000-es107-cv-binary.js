'use strict';
// ES-107 · La hoja de vida pasa de TEXT (base64 cifrado y expandido a hexadecimal, ≈2,7× el PDF) a BYTEA (bytes cifrados, PDF + 29 bytes).
// Convierte las filas existentes sin perder datos: descifra el valor anterior, vuelve a cifrar los bytes y verifica la huella antes de borrar la columna vieja.
// Debe coincidir con el modelo ProfessionalApplicationFile (db:drift lo comprueba).
const guardDown = require('../scripts/guard-down.cjs');
const crypto = require('crypto');

const TABLE = 'ProfessionalApplicationFiles';

async function convert(queryInterface, { select, write, transform }) {
  const sequelize = queryInterface.sequelize;
  const [rows] = await sequelize.query(`SELECT "id", ${select} AS "value", "sha256" FROM "${TABLE}" ORDER BY "id"`);
  for (const row of rows) {
    const bytes = transform(row.value);
    if (crypto.createHash('sha256').update(bytes.plain).digest('hex') !== row.sha256) {
      throw new Error(`ES-107: la huella de la hoja de vida ${row.id} no coincide tras la conversión; no se modificó nada más.`);
    }
    await sequelize.query(`UPDATE "${TABLE}" SET ${write} WHERE "id" = :id`, { replacements: { id: row.id, value: bytes.stored } });
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const { desencriptar, encriptarBuffer } = require('../utils/crypto');
    const { DataTypes } = Sequelize;
    await queryInterface.addColumn(TABLE, 'data', { type: DataTypes.BLOB, allowNull: true });
    await convert(queryInterface, {
      select: '"content"', write: '"data" = :value',
      transform: (content) => { const plain = Buffer.from(desencriptar(content), 'base64'); return { plain, stored: encriptarBuffer(plain) }; },
    });
    await queryInterface.changeColumn(TABLE, 'data', { type: DataTypes.BLOB, allowNull: false });
    await queryInterface.removeColumn(TABLE, 'content');
  },
  // Devuelve el formato anterior (base64 cifrado v2). Exige permiso explícito y no corre en producción (guarda común, ES-59).
  async down(queryInterface, Sequelize) {
    guardDown('20261030000000-es107-cv-binary');
    const { desencriptarBuffer, encriptarV2 } = require('../utils/crypto');
    const { DataTypes } = Sequelize;
    await queryInterface.addColumn(TABLE, 'content', { type: DataTypes.TEXT, allowNull: true });
    await convert(queryInterface, {
      select: '"data"', write: '"content" = :value',
      transform: (data) => { const plain = desencriptarBuffer(data); return { plain, stored: encriptarV2(plain.toString('base64')) }; },
    });
    await queryInterface.changeColumn(TABLE, 'content', { type: DataTypes.TEXT, allowNull: false });
    await queryInterface.removeColumn(TABLE, 'data');
  },
};
