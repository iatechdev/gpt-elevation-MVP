// ES-105 (ES102-O1): promedio de ánimo compartido por el resumen del terapeuta, el matching y las recomendaciones.
// Antes cada ruta sumaba la entrada y la salida de cada registro y dividía entre el número de REGISTROS, así que con dos valores por
// registro el promedio salía fuera de la escala 1-5 (p. ej. 7,5). Aquí se divide entre los valores registrados.
const VALID = (value) => Number.isFinite(value) && value >= 1 && value <= 5;

// -> número entre 1 y 5, o null si no hay ningún valor válido (nunca se inventa un promedio).
function averageMood(logs) {
  const values = (Array.isArray(logs) ? logs : []).flatMap((log) => [log?.checkin_mood, log?.checkout_mood]).filter(VALID);
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

const formatAverage = (average, empty) => (average === null ? empty : average.toFixed(1));

module.exports = { averageMood, formatAverage };
