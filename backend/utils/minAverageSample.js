// QA-18-02 / ES-343: un promedio de muy pocas entradas revela el valor individual de una persona. Por debajo de este número de entradas
// el promedio NO se calcula: se devuelve null (la pantalla muestra «Sin datos»). Una sola definición para /admin/usuarios y /admin/metrics.
const MIN_AVERAGE_SAMPLE = 5;
const averageOf = (values) => (values.length >= MIN_AVERAGE_SAMPLE
  ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
  : null);
module.exports = { MIN_AVERAGE_SAMPLE, averageOf };
