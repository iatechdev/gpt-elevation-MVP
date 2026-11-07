// [QA-Claude] proveedor simulado ES-142: fija stop_reason y registra max_tokens. /_cfg?stop=<v>&text=<t> · /_log
const http = require('node:http'); let stop = 'end_turn', text = 'Respuesta de prueba completa.'; const log = [];
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/_cfg') { stop = u.searchParams.get('stop') ?? stop; if (u.searchParams.has('text')) text = u.searchParams.get('text'); return res.end('ok'); }
  if (u.pathname === '/_log') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(log)); }
  const ch = []; req.on('data', c => ch.push(c)); req.on('end', () => {
    let b = {}; try { b = JSON.parse(Buffer.concat(ch).toString()); } catch { /* */ }
    log.push({ path: u.pathname, max_tokens: b.max_tokens });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ id: 'msg_qa', type: 'message', role: 'assistant', model: b.model || 'm', content: [{ type: 'text', text }], stop_reason: stop === 'none' ? undefined : stop, stop_sequence: null, usage: { input_tokens: 200, output_tokens: 3000 } }));
  });
}).listen(Number(process.argv[2]), '127.0.0.1');
