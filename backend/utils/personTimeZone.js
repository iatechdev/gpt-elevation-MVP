// E393-3 (ES-329): «qué día es» para una persona. Los registros de ánimo y las calificaciones guardan `date` (AAAA-MM-DD) y la pantalla de Inicio cuenta «esta semana»
// y pinta la tendencia con ese mismo día. Antes el día era el del reloj del servidor en UTC: desde las 19:00 en Bogotá (UTC−5) ya era «mañana». Ahora es el día en la ZONA
// de la persona: la que confirmó en su contexto participante (ES-14, `timeZone`), validada como zona IANA; si falta o no es válida, `America/Bogota` (la del piloto).
// El navegador no decide la zona: el servidor la lee de lo guardado. Lo ya guardado NO se reescribe (sigue en el día UTC con que se registró).
const ParticipantContext = require('../ParticipantContext');
const { desencriptar } = require('./crypto');

const DEFAULT_TIME_ZONE = 'America/Bogota';

const isValidTimeZone = (zone) => {
  if (typeof zone !== 'string' || !zone.trim() || zone.length > 64) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; } catch { return false; }
};

/** Zona IANA de la persona: la de su contexto si es válida; si no, America/Bogota. Nunca lanza (un contexto ilegible o ausente cae al respaldo). */
async function timeZoneFor(userId) {
  try {
    const row = await ParticipantContext.findOne({ where: { UserId: userId }, attributes: ['content'] });
    const zone = row ? JSON.parse(desencriptar(row.content)).timeZone : null;
    return isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
  } catch { return DEFAULT_TIME_ZONE; }
}

/** AAAA-MM-DD de `now` en la zona dada. */
const dayInZone = (now, zone) => new Intl.DateTimeFormat('en-CA', { timeZone: isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/** Reloj sustituible en las pruebas (zonas límite sin mover la hora del sistema). */
const clock = { now: () => new Date() };

/** Día de hoy para una persona (zona de su contexto o respaldo). */
const todayFor = async (userId) => dayInZone(clock.now(), await timeZoneFor(userId));

/** Día de hace `back` días en la zona (para la racha): resta días de calendario, no 24 h, así no se descuadra en cambios de horario. */
function dayBack(today, back) {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - back)).toISOString().slice(0, 10);
}

module.exports = { DEFAULT_TIME_ZONE, isValidTimeZone, timeZoneFor, dayInZone, todayFor, dayBack, clock };
