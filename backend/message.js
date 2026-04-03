const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');
const User = require('./User'); // Importamos el modelo de Usuario

const Message = sequelize.define('Message', {
    role: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    content: { 
        type: DataTypes.TEXT, // Mantenemos TEXT para que quepa la encriptación
        allowNull: false 
    }
});

// ESTO CREA LA COLUMNA UserId AUTOMÁTICAMENTE
Message.belongsTo(User);
User.hasMany(Message);

module.exports = Message;