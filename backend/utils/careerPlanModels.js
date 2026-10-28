const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');
const owner = () => ({ type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } });
function define(name, fields, indexes) {
  return sequelize.define(name, {
    UserId: owner(), ...fields,
  }, { indexes });
}
const integer = () => ({ type: DataTypes.INTEGER, allowNull: false });
const string = length => ({ type: DataTypes.STRING(length), allowNull: false });
const encrypted = () => ({ type: DataTypes.TEXT, allowNull: false });
const command = () => ({ requestId: string(64), inputHash: string(64) });
module.exports = { define, integer, string, encrypted, command };
