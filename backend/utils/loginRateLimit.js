// ES-220 (seguimiento de QA): máximo de intentos de login por IP y minuto. El valor real es 10. LOGIN_RATE_LIMIT_MAX solo existe para las pruebas con ráfagas
// desde una sola IP y NUNCA se respeta en producción ni en staging (NODE_ENV=production o RAILWAY_ENVIRONMENT_ID): si alguien la sube en Railway el límite sigue en 10.
const DEFAULT_MAX = 10;

function loginRateMax(env = process.env) {
  if (env.NODE_ENV === 'production' || env.RAILWAY_ENVIRONMENT_ID) return DEFAULT_MAX;
  const value = Number(env.LOGIN_RATE_LIMIT_MAX);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX;
}

module.exports = { DEFAULT_MAX, loginRateMax };
