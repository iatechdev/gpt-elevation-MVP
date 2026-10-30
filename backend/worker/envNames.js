// backend/worker/envNames.js
// Nombres de variables del worker, SIN dependencias: worker.js los comprueba antes de cargar nada que abra una conexión
// (database.js se evalúa al importarlo y lee DATABASE_URL en ese momento).
const FORBIDDEN = Object.freeze(['DATA_ENCRYPTION_KEY', 'PROMPT_ENCRYPTION_KEY', 'JWT_SECRET', 'DATABASE_URL']);
const REQUIRED = Object.freeze(['WORKER_DATABASE_URL', 'ANTHROPIC_API_KEY', 'PROFESSIONAL_ENCRYPTION_KEY', 'AI_BUDGET_TOKENS_PER_USER']);

// Problemas de presencia (sin valores). Lo demás (validez de claves, lease) lo comprueba worker/config.js.
function presenceProblems(env) {
  const problems = [];
  for (const name of FORBIDDEN) if (env[name]) problems.push(`${name} no debe estar definida en el worker.`);
  for (const name of REQUIRED) if (!env[name]) problems.push(`Falta ${name}.`);
  return problems;
}

module.exports = { FORBIDDEN, REQUIRED, presenceProblems };
