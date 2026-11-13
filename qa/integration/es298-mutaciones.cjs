// [QA-Claude] Mutaciones ES-298 (PR #267, cabeza 765e2221). Árbol: C:/Users/Usuario/Documents/qa-pr-253
const fs = require('fs'); const F = 'C:/Users/Usuario/Documents/qa-pr-253/backend/routes/chat.js'; const m = process.argv[2];
const read = () => fs.readFileSync(F, 'utf8'); const edit = (a, b) => { const s = read(); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 80)); fs.writeFileSync(F, s.replace(a, () => b)); };
const LINE = "if (m.role === 'user' && detectRisk(m.text).level === 'high') { interrumpidos.add(i); if (secuencia[i + 1]?.role === 'assistant') interrumpidos.add(i + 1); }";
if (m === 'Q1') edit("const historial = secuencia.filter((_, i) => !interrumpidos.has(i)).map(", "const historial = secuencia.map("); // quitar el filtro
if (m === 'Q2') edit(LINE, "if (m.role === 'user' && detectRisk(m.text).level === 'high') { interrumpidos.add(i); }"); // omitir solo la frase, el apoyo viaja
if (m === 'Q3') edit(LINE, "if (m.role === 'user' && detectRisk(m.text).level === 'high') { if (secuencia[i + 1]?.role === 'assistant') interrumpidos.add(i + 1); }"); // omitir solo el apoyo, la frase viaja
if (m === 'Q4') edit("detectRisk(m.text).level === 'high') {", "detectRisk(m.text).level) {"); // omite también el nivel medio
if (m === 'Q5') edit(LINE, "if (m.role === 'user' && detectRisk(capText(m.text, 200)).level === 'high') { interrumpidos.add(i); if (secuencia[i + 1]?.role === 'assistant') interrumpidos.add(i + 1); }"); // evalúa solo un trozo recortado
if (m === 'Q6') edit("if (secuencia[i + 1]?.role === 'assistant') interrumpidos.add(i + 1); }", "if (secuencia[i + 1]?.role === 'assistant' && secuencia[i + 2]) interrumpidos.add(i + 1); }"); // no omite el apoyo si es el último mensaje guardado
if (m === 'Q7') edit("secuencia.forEach((m, i) => {\n      if (m.role === 'user' &&", "secuencia.forEach((m, i) => {\n      if (false && m.role === 'user' &&"); // detección apagada
if (m === 'Q8') edit("while (historial.length > 0 && historial[0].role === 'assistant') historial.shift();", ""); // no recorta el apoyo suelto al inicio
console.log('M apl ' + m);
