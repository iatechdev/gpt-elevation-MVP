// ES-109: PDFs SINTÉTICOS para las pruebas (nunca hojas de vida reales). Se construyen a mano para no añadir dependencias: PDF mínimo válido con texto
// en WinAnsi, un PDF «escaneado» (páginas sin texto), uno con contraseña (diccionario /Encrypt) y uno corrupto.
const enc = (value) => {
  let out = '';
  for (const ch of String(value)) {
    const byte = Buffer.from(ch, 'latin1')[0];
    const code = ch.codePointAt(0);
    if (code > 255 && code !== 8211 && code !== 8212 && code !== 183) { out += '?'; continue; }
    const map = { 8211: 0x96, 8212: 0x97, 183: 0xb7 };
    const b = map[code] ?? byte;
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (b > 126 || b < 32) out += '\\' + b.toString(8).padStart(3, '0');
    else out += ch;
  }
  return out;
};

function assemble(objects, trailerExtra = '') {
  let body = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(body, 'latin1')); body += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${trailerExtra}>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

// pages: lista de páginas; cada página, lista de líneas de texto.
function makeTextPdf(pages) {
  const list = Array.isArray(pages[0]) ? pages : [pages];
  const objects = [];
  const pageIds = list.map((_, i) => 4 + i * 2);
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${list.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  list.forEach((lines, i) => {
    const stream = 'BT /F1 11 Tf 14 TL 50 780 Td ' + lines.map((line) => `(${enc(line)}) Tj T*`).join(' ') + ' ET';
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  });
  return assemble(objects);
}

// «Escaneado»: la página solo dibuja un rectángulo (como una imagen), sin una sola operación de texto.
function makeScannedPdf(pageCount = 1) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>'];
  const ids = Array.from({ length: pageCount }, (_, i) => 3 + i * 2);
  objects.push(`<< /Type /Pages /Kids [${ids.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`);
  ids.forEach((id) => {
    const stream = '0.8 g 40 40 500 760 re f';
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents ${id + 1} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  return assemble(objects);
}

// Con contraseña: diccionario /Encrypt estándar con valores arbitrarios; abrirlo sin la clave falla con PasswordException.
function makeEncryptedPdf() {
  const hex = (n, seed) => Array.from({ length: n }, (_, i) => ((i * 31 + seed) & 255).toString(16).padStart(2, '0')).join('');
  const base = makeTextPdf(['Contenido protegido de prueba con suficiente texto para superar el mínimo de caracteres.']);
  const text = base.toString('latin1').replace('/Root 1 0 R', `/Root 1 0 R /Encrypt << /Filter /Standard /V 1 /R 2 /O <${hex(32, 7)}> /U <${hex(32, 99)}> /P -4 >> /ID [<${hex(16, 3)}> <${hex(16, 3)}>]`);
  return Buffer.from(text, 'latin1');
}
const makeCorruptPdf = () => Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 99 0 R >>\nendobj\n' + 'garbage '.repeat(40) + '\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1');

module.exports = { makeTextPdf, makeScannedPdf, makeEncryptedPdf, makeCorruptPdf };
