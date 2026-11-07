// [QA-Claude] ES-40 fase A4 (0 tokens de IA): archivos NO válidos o hostiles como hoja de vida. Todos SINTÉTICOS creados aquí. Se espera rechazo ANTES de llamar a la IA: se comprueba que el consumo de IA no cambia.
// Uso: node qa/e2e/a4-cv-invalid.cjs   (staging; cuenta sintética nueva)
const L = require('./lib.cjs'); const { API, rec, savResults, j } = L;
const pdf = (pages, text) => { // PDF mínimo válido con N páginas y, opcionalmente, texto en la primera
  const objs = []; const kids = []; let id = 3;
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageIds = []; for (let i = 0; i < pages; i++) { pageIds.push(id); id += 2; }
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map(x => x + ' 0 R').join(' ')}] /Count ${pages} >>`;
  pageIds.forEach((pid, i) => { const body = i === 0 && text ? `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, ' ')}) Tj ET` : ''; objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${pid + 1} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>`; objs[pid + 1] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`; });
  let out = '%PDF-1.4\n'; const offs = []; for (let i = 1; i < objs.length; i++) { if (!objs[i]) continue; offs[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const x = out.length; out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`; for (let i = 1; i < objs.length; i++) out += `${String(offs[i] ?? 0).padStart(10, '0')} 00000 n \n`; out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`; return Buffer.from(out, 'latin1'); };
const CASES = [
  ['archivo vacío (0 bytes)', Buffer.alloc(0), 'cv.pdf', 'empty'],
  ['ejecutable renombrado a .pdf (cabecera MZ)', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2000, 0x90)]), 'cv.pdf', 'not_pdf'],
  ['texto plano con extensión .pdf', Buffer.from('Soy una hoja de vida en texto plano. '.repeat(30)), 'cv.pdf', 'not_pdf'],
  ['HTML/script con extensión .pdf', Buffer.from('<html><script>alert(1)</script></html>'), 'cv.pdf', 'not_pdf'],
  ['firma %PDF- pero contenido corrupto', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('basura no pdf '.repeat(200))]), 'cv.pdf', 'corrupt'],
  ['tamaño excesivo (5 MB + 1 byte, firma PDF)', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024 + 1, 0x20)]), 'cv.pdf', 'too_large'],
  ['16 páginas (el límite es 15)', pdf(16, 'Texto sintetico de prueba suficiente para pasar el minimo de caracteres del analisis'), 'cv.pdf', 'too_many_pages'],
  ['PDF válido sin texto (como imagen escaneada)', pdf(1, ''), 'cv.pdf', 'no_text'],
  ['nombre de archivo malicioso (ruta y comillas) con PDF sin texto', pdf(1, ''), '../../etc/passwd"; filename="x.pdf', null],
  ['nombre de archivo con RTL y emojis con archivo vacío', Buffer.alloc(0), '‮txt.fdp‭📄.pdf', 'empty'],
];
const multipart = (buf, filename, field = 'cv') => { const boundary = '----qa' + Date.now(); const C = String.fromCharCode(13, 10); const rid = Buffer.from('--' + boundary + C + 'Content-Disposition: form-data; name="requestId"' + C + C + require('crypto').randomUUID() + C); const head = Buffer.from('--' + boundary + C + 'Content-Disposition: form-data; name="' + field + '"; filename="' + filename.split(C).join(' ') + '"' + C + 'Content-Type: application/pdf' + C + C, 'utf8'); const tail = Buffer.from(C + '--' + boundary + '--' + C); return { body: Buffer.concat([rid, head, buf, tail]), type: 'multipart/form-data; boundary=' + boundary }; };
let cnt = 0, cur = null; const who = async () => { if (!cur || cnt >= 5) { const P = await L.newPersona('cv'); const t = await L.login(P); await j('PUT', '/api/consents/resume_ai_reading', t.token, { status: 'granted' }); cur = t; cnt = 0; } cnt++; return cur; };
(async () => {
  const P = await L.newPersona('cv'); const s = await L.login(P); await j('PUT', '/api/consents/resume_ai_reading', s.token, { status: 'granted' }); const used0 = (await j('GET', '/api/ai/usage', s.token)).j?.used;
  rec('A4-0 cuenta sintética y consumo de IA inicial leído', !!s && typeof used0 === 'number', `used=${used0}`);
  for (const [name, buf, filename, code] of CASES) {
    const m = multipart(buf, filename); const r = await fetch(API + '/api/user/resumes/analyze', { method: 'POST', headers: { Authorization: 'Bearer ' + (await who()).token, 'content-type': m.type }, body: m.body }); const text = await r.text(); let o = null; try { o = JSON.parse(text); } catch { /* */ }
    const got = o?.code ?? o?.error ?? text.slice(0, 60); const ok = r.status >= 400 && r.status < 500 && (code ? String(o?.code ?? '').includes(code) || new RegExp(code.replace('_', '.?'), 'i').test(text) : true);
    rec(`A4 ${name}: rechazado con 4xx y código «${code ?? 'cualquiera'}»`, ok, `http=${r.status} respuesta=${String(got).slice(0, 80)}`);
  }
  // sin sesión, token inválido, campo equivocado, sin archivo, segundo archivo
  { const m = multipart(pdf(1, ''), 'cv.pdf'); const a = await fetch(API + '/api/user/resumes/analyze', { method: 'POST', headers: { 'content-type': m.type }, body: m.body }); const bt = await fetch(API + '/api/user/resumes/analyze', { method: 'POST', headers: { Authorization: 'Bearer token-invalido', 'content-type': m.type }, body: m.body }); rec('A4 subir sin sesión y con token inválido: 401/403', [401, 403].includes(a.status) && [401, 403].includes(bt.status), `${a.status}/${bt.status}`); }
  { const m = multipart(pdf(1, 'x'), 'cv.pdf', 'archivo_equivocado'); const r = await fetch(API + '/api/user/resumes/analyze', { method: 'POST', headers: { Authorization: 'Bearer ' + s.token, 'content-type': m.type }, body: m.body }); rec('A4 campo de archivo equivocado: 4xx sin 5xx', r.status >= 400 && r.status < 500, `http=${r.status}`); }
  { const r = await fetch(API + '/api/user/resumes/analyze', { method: 'POST', headers: { Authorization: 'Bearer ' + s.token } }); rec('A4 petición sin cuerpo multipart: 4xx sin 5xx', r.status >= 400 && r.status < 500, `http=${r.status}`); }
  // ID ajeno e inexistente
  const l = await j('GET', '/api/user/resumes', s.token); rec('A4 la lista de hojas de vida de una cuenta nueva está vacía', l.s === 200 && (l.j?.resumes ?? []).length === 0, `http=${l.s}`);
  for (const [m2, u] of [['GET', '/api/user/resumes/999999/file'], ['DELETE', '/api/user/resumes/999999'], ['GET', '/api/user/resumes/abc/file'], ['DELETE', '/api/user/resumes/1%27%20OR%201=1']]) { const r = await j(m2, u, s.token); rec(`A4 ${m2} ${u}: 4xx (no 5xx, sin datos ajenos)`, r.s >= 400 && r.s < 500, `http=${r.s}`); }
  const used1 = (await j('GET', '/api/ai/usage', s.token)).j?.used; rec('A4 NINGÚN archivo no válido consumió IA (consumo igual antes y después)', used1 === used0, `${used0} → ${used1}`);
  const sw = await fetch(API + '/api/user/resumes/analyze', { method: 'GET', headers: { Authorization: 'Bearer ' + s.token } }); rec('A4 método incorrecto (GET en analyze): 404/405, sin 5xx', sw.status >= 400 && sw.status < 500, `http=${sw.status}`);
  console.log('RESUMEN-A4 ' + JSON.stringify({ total: L.results.length, fallos: L.results.filter(r => !r.ok).length })); savResults('a4-cv-invalid');
})().catch(e => { console.log('ERROR ' + String(e).slice(0, 300)); process.exit(1); });
