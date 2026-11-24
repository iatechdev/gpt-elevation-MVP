// [QA-Claude-3] ayudas para las baterías de crisis (ES-387/389/390).
// hasCtrl: ¿el texto conserva controles o invisibles (salvo \n \t \r)?
const hasCtrl = (text) => /[\p{Cc}\p{Cf}]/u.test(String(text).replace(/[\n\t\r]/g, ''))
// leaksCrisis: ¿el cuerpo enviado al proveedor lleva la frase de crisis, aunque traiga invisibles entre letras? (quita secuencias \uXXXX escapadas y controles antes de buscar)
const leaksCrisis = (body) => {
  let tx = String(body); try { tx = JSON.stringify(JSON.parse(body).messages) } catch { /* se usa el cuerpo entero */ }
  tx = tx.replace(/\\u[0-9a-fA-F]{4}/g, '').replace(/[\p{Cc}\p{Cf}]/gu, '')
  return /quiero|morir|matarme|me matar|viviendo|aguanto|suicid|want to (kill|die)|kill ?myself|wa?nt ?to ?die/i.test(tx)
}
// invisibles en el payload: ¿viaja algún control/invisible al proveedor?
const payloadHasInvisible = (body) => { let tx = String(body); try { tx = JSON.stringify(JSON.parse(body).messages) } catch { /* idem */ } return /\\u(0000|0001|000b|000c|0085|001c|007f|00ad|200b|200c|200d|200e|2060|202e|feff)/i.test(tx) || /[\p{Cc}\p{Cf}]/u.test(JSON.parse(JSON.stringify(tx)).replace(/[\n\t\r]/g, '')) }
module.exports = { hasCtrl, leaksCrisis, payloadHasInvisible }
