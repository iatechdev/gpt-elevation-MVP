// backend/utils/anthropic.js
// Singleton del cliente Anthropic
// Todos los routers que necesiten IA importan desde aquí

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 60000, // ms por intento: un corte de Claude no deja la conexión colgada
  maxRetries: 1,
});

module.exports = anthropic;