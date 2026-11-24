// QA-Claude-2: proveedor de IA SIMULADO (Anthropic) para ES-161. Control: POST /__set {text,status,delayMs,hang}; GET /__count; POST /__reset.
const http = require('http'); let cfg = { text: '[]', status: 200, delayMs: 0, hang: false }; let count = 0; const bodies = []
http.createServer((q, r) => { let b = ''; q.on('data', d => b += d); q.on('end', async () => {
  if (q.url === '/__set') { cfg = { ...cfg, ...JSON.parse(b) }; r.end('ok'); return }
  if (q.url === '/__count') { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ count, last: bodies.slice(-1)[0] || null })); return }
  if (q.url === '/__reset') { count = 0; bodies.length = 0; cfg = { text: '[]', status: 200, delayMs: 0, hang: false }; r.end('ok'); return }
  count++; bodies.push(b.slice(0, 30000)); if (cfg.hang) return; if (cfg.delayMs) await new Promise(x => setTimeout(x, cfg.delayMs))
  if (cfg.status !== 200) { r.writeHead(cfg.status, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'simulado' } })) }
  r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify({ id: 'msg_sim', type: 'message', role: 'assistant', model: 'sim', content: [{ type: 'text', text: cfg.text }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } })) }) }).listen(9099, () => console.log('fake anthropic :9099'))
