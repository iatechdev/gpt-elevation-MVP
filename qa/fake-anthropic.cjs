// QA-Claude-2 — proveedor «Anthropic» SIMULADO en loopback (127.0.0.1) para probar #97 sin gastar tokens reales.
// El backend lo usa con ANTHROPIC_BASE_URL=http://127.0.0.1:8097 y una clave falsa. No hay red externa ni claves reales.
// Control (solo loopback): POST /__queue  {entries:[{text|status|delayMs|raw}]}  encola respuestas (se consumen en orden; sin cola: devuelve «[]»)
//                          GET  /__log    cuerpos recibidos (para inspeccionar lo que viaja al proveedor)      POST /__reset  vacía cola y registro
const http = require('http')
const PORT = Number(process.env.FAKE_PORT || 8097)
let queue = [], log = []
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
const readBody = (req) => new Promise(resolve => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => resolve(d)) })
http.createServer(async (req, res) => {
  const body = await readBody(req)
  if (req.url === '/__reset') { queue = []; log = []; return send(res, 200, { ok: true }) }
  if (req.url === '/__log') return send(res, 200, log)
  if (req.url === '/__queue') { queue.push(...(JSON.parse(body).entries || [])); return send(res, 200, { queued: queue.length }) }
  if (req.url.startsWith('/v1/messages')) {
    let parsed = null; try { parsed = JSON.parse(body) } catch { /* se registra igual */ }
    log.push({ at: new Date().toISOString(), body: parsed })
    const entry = queue.shift() || { text: '[]' }
    if (entry.delayMs) await new Promise(r => setTimeout(r, entry.delayMs))
    if (entry.status) return send(res, entry.status, { type: 'error', error: { type: entry.status === 429 ? 'rate_limit_error' : 'api_error', message: 'simulado' } })
    return send(res, 200, { id: 'msg_sim', type: 'message', role: 'assistant', model: 'sim', stop_reason: 'end_turn', stop_sequence: null,
      content: [{ type: 'text', text: entry.raw ?? entry.text ?? '[]' }], usage: { input_tokens: 400, output_tokens: 120 } })
  }
  send(res, 404, { error: 'no' })
}).listen(PORT, '127.0.0.1', () => console.log('fake-anthropic en', PORT))
