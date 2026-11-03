const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');
const User = require('./User');

const Message = sequelize.define('Message', {
    role: {
        type: DataTypes.STRING,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    // ES-142: la respuesta del asistente se cortó por el tope de salida del modelo (el texto se guarda tal cual).
    truncated: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
});

Message.belongsTo(User);
User.hasMany(Message);

module.exports = Message;