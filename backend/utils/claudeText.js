// Texto de una respuesta de Claude: toma solo los bloques con texto y descarta los demás
// (p. ej. los bloques de razonamiento de los modelos 5.x, que no traen `text`).
const textOf = (msg) => (msg.content || [])
  .filter((b) => typeof b.text === 'string')
  .map((b) => b.text)
  .join('');

module.exports = { textOf };
