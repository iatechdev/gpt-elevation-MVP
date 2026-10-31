// [QA-Claude] Proveedor de IA simulado para pruebas de integración (sin llamadas reales a Claude).
// Uso: node qa/integration/mock-anthropic.cjs <puerto>   y   ANTHROPIC_BASE_URL=http://127.0.0.1:<puerto> en el servidor.
// Control por el texto del último mensaje del usuario: __FAIL__ (siempre 500), __FAILONCE__ (500 la primera vez por texto), __FAILTWICE__ (500 las dos primeras veces: el SDK reintenta una vez, así que el primer envío falla y el reintento del cliente funciona),
// __SLOW__ (1500 ms), __VERYSLOW__ (6000 ms), __TOK<n>__ (informa n tokens de uso en cualquier mensaje del historial reciente). /_text?v=<texto> fija el texto de respuesta hasta /_reset. /_stats devuelve llamadas y el último cuerpo; /_reset las pone a cero.
const http = require('node:http');
const port = Number(process.argv[2] || 9911);
let calls = 0; let last = null; const once = new Map(); let fixedText = null;
const lastUserText = body => { const m = [...(body.messages || [])].reverse().find(x => x.role === 'user'); return typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content); };
http.createServer((req, res) => {
  const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', async () => {
    if (req.url === '/_stats') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ calls, last })); }
    if (req.url === '/_reset') { calls = 0; last = null; fixedText = null; once.clear(); return res.end('ok'); }
    if (req.url.startsWith('/_text')) { fixedText = decodeURIComponent((req.url.split('?v=')[1] || '')) || null; return res.end('ok'); }
    let body = {}; try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { /* vacío */ }
    calls++; last = body; const text = lastUserText(body);
    if (text.includes('__FAIL__')) { res.statusCode = 500; res.setHeader('content-type', 'application/json'); return res.end('{"type":"error","error":{"type":"api_error","message":"fallo simulado"}}'); }
    if (text.includes('__FAILONCE__') && !once.get(text)) { once.set(text, true); res.statusCode = 500; res.setHeader('content-type', 'application/json'); return res.end('{"type":"error","error":{"type":"api_error","message":"fallo simulado"}}'); }
    if (text.includes('__FAILTWICE__') && (once.set(text, (once.get(text) || 0) + 1), once.get(text) <= 2)) { res.statusCode = 500; res.setHeader('content-type', 'application/json'); return res.end('{"type":"error","error":{"type":"api_error","message":"fallo simulado"}}'); }
    if (text.includes('__SLOW__')) await new Promise(r => setTimeout(r, 1500));
    if (text.includes('__VERYSLOW__')) await new Promise(r => setTimeout(r, 6000));
    const toks = [...JSON.stringify(body.messages || []).matchAll(/__TOK([0-9]+)__/g)]; const tok = toks.length ? toks[toks.length - 1] : null;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ id: 'msg_sim' + calls, type: 'message', role: 'assistant', model: body.model || 'sim', content: [{ type: 'text', text: fixedText ?? ('Respuesta sintética #' + calls) }], stop_reason: 'end_turn', stop_sequence: null, usage: tok ? { input_tokens: Number(tok[1]), output_tokens: 0 } : { input_tokens: 1, output_tokens: 1 } }));
  });
}).listen(port, '127.0.0.1');
