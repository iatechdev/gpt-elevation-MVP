// backend/message.js
// Re-export de Message.js para compatibilidad case-insensitive (Windows vs Linux)
// El archivo canónico es Message.js — este archivo existe solo para evitar conflictos de case en Git
module.exports = require('./Message');
