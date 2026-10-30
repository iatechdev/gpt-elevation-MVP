// Texto de una respuesta de Claude: toma solo los bloques con texto y descarta los demás
// (p. ej. los bloques de razonamiento de los modelos 5.x, que no traen `text`).
const textOf = (msg) => (msg.content || [])
  .filter((b) => typeof b.text === 'string')
  .map((b) => b.text)
  .join('');

// ES43-QA-01: si el proveedor cortó la respuesta por el tope de tokens (stop_reason = max_tokens), no se entrega texto a medias:
// se recorta a la última frase completa. Sin ningún final de frase, se recorta a la última palabra entera y se marca con «…».
// Una respuesta completa (cualquier otro stop_reason) no se toca.
const SENTENCE_END = /[.!?…。](?:["'”’»)\]]*)(?=\s|$)/g;
function completeText(text, stopReason) {
  if (stopReason !== 'max_tokens' || typeof text !== 'string') return text;
  let end = -1;
  for (const match of text.matchAll(SENTENCE_END)) end = match.index + match[0].length;
  if (end > 0) return text.slice(0, end).trimEnd();
  const words = text.replace(/\s+\S*$/, '').trimEnd();
  return words ? `${words}…` : text;
}

module.exports = { textOf, completeText };
