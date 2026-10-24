// backend/utils/anthropic.js
// Singleton del cliente Anthropic
// Todos los routers que necesiten IA importan desde aquí

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = anthropic;