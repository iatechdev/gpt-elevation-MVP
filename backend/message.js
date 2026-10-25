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
    }
});

Message.belongsTo(User);
User.hasMany(Message);

module.exports = Message;