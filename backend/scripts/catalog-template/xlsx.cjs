// ES-410 · Lector y escritor mínimos de .xlsx (OOXML = zip + XML), sin dependencias. Solo lo que necesita la plantilla:
// celdas de texto, listas desplegables y anchos. El lector entiende lo que guardan Excel, LibreOffice y Google Sheets (cadenas
// compartidas, en línea, números y booleanos). No ejecuta fórmulas ni macros: de una fórmula solo lee el último valor guardado.
const zlib = require('node:zlib');

const MAX_BYTES = 5 * 1024 * 1024; // tamaño máximo del archivo y de cada parte descomprimida
const MAX_ROWS = 2000;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zip(files) {
  const locals = []; const central = []; let offset = 0;
  for (const [name, content] of files) {
    const raw = Buffer.from(content, 'utf8'); const data = zlib.deflateRawSync(raw, { level: 9 }); const nameBuf = Buffer.from(name, 'utf8'); const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt16LE(0x21, 12); // fecha fija: archivo reproducible
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(8, 10); entry.writeUInt16LE(0x21, 14);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(raw.length, 24); entry.writeUInt16LE(nameBuf.length, 28); entry.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data); central.push(entry, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(central); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

function unzip(buf) {
  if (buf.length > MAX_BYTES) throw new Error('El archivo supera 5 MB.');
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('El archivo no es un .xlsx válido.');
  const count = buf.readUInt16LE(end + 10); let p = buf.readUInt32LE(end + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('El archivo no es un .xlsx válido.');
    const method = buf.readUInt16LE(p + 10); const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28); const extraLen = buf.readUInt16LE(p + 30); const commentLen = buf.readUInt16LE(p + 32); const at = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, () => {
      const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
      const data = buf.subarray(start, start + size);
      return (method === 0 ? data : zlib.inflateRawSync(data, { maxOutputLength: MAX_BYTES })).toString('utf8');
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return (name) => (entries.has(name) ? entries.get(name)() : null);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unesc = (s) => s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (m, e) => (e[0] === '#' ? String.fromCodePoint(Number(e[1] === 'x' ? `0${e.slice(1)}` : e.slice(1))) : ENTITIES[e]))
  .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const colName = (i) => (i >= 26 ? colName(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));
const colIndex = (ref) => [...ref.match(/^[A-Z]+/)[0]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// sheets: [{ name, rows: [[valor]], styles: [índice de estilo por fila], widths: [n], validations: [{ col, from, options }], freeze }]
// Estilos: 0 normal (formato texto), 1 encabezado, 2 ayuda, 3 título.
function writeWorkbook(sheets) {
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const sheetXml = (sheet) => {
    const rows = sheet.rows.map((row, r) => `<row r="${r + 1}">${row.map((v, i) => (v === '' || v == null ? '' : `<c r="${colName(i)}${r + 1}" s="${sheet.styles?.[r] ?? 0}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`)).join('')}</row>`).join('');
    // El estilo de columna en formato TEXTO evita que Excel convierta fechas y códigos por su cuenta.
    const cols = sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" style="0" customWidth="1"/>`).join('');
    const pane = sheet.freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freeze}" topLeftCell="A${sheet.freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '';
    const dv = (sheet.validations || []).map((v) => `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${colName(v.col)}${v.from}:${colName(v.col)}500"><formula1>"${esc(v.options.join(','))}"</formula1></dataValidation>`);
    return `${head}<worksheet xmlns="${ns}">${pane}<cols>${cols}</cols><sheetData>${rows}</sheetData>${dv.length ? `<dataValidations count="${dv.length}">${dv.join('')}</dataValidations>` : ''}</worksheet>`;
  };
  const xf = (font, fill, bold = '') => `<xf numFmtId="49" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"${bold}><alignment vertical="top" wrapText="1"/></xf>`;
  const styles = `${head}<styleSheet xmlns="${ns}"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><i/><sz val="9"/><color rgb="FF444444"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>`
    + '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F1"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill></fills>'
    + '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>'
    + `<cellXfs count="4">${xf(0, 0)}${xf(1, 2)}${xf(2, 3)}${xf(3, 0)}</cellXfs></styleSheet>`;
  const files = [
    ['[Content_Types].xml', `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${head}<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', styles],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ];
  return zip(files);
}

const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], unesc(m[2])]));
const elements = (xml, tag) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${tag}(?=[\\s/>])([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${tag}>)`, 'g'))].map((m) => ({ attrs: attrs(m[1]), body: m[2] || '' }));
const textOf = (xml) => elements(xml.replace(/<(?:\w+:)?rPh[\s\S]*?<\/(?:\w+:)?rPh>/g, ''), 't').map((t) => unesc(t.body)).join('');

// Devuelve Map(nombre de hoja → filas); cada fila es { number, cells: [string] }. Las filas vacías no aparecen.
function readWorkbook(buffer) {
  const part = unzip(buffer);
  const workbook = part('xl/workbook.xml'); const rels = part('xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) throw new Error('El archivo no es un .xlsx válido.');
  const targets = new Map(elements(rels, 'Relationship').map((r) => [r.attrs.Id, r.attrs.Target]));
  const shared = elements(part('xl/sharedStrings.xml') || '', 'si').map((si) => textOf(si.body));
  const out = new Map();
  for (const sheet of elements(workbook, 'sheet')) {
    const target = targets.get(sheet.attrs['r:id']) || '';
    const xml = part(target.startsWith('/') ? target.slice(1) : `xl/${target}`) || '';
    const rows = [];
    for (const row of elements(xml, 'row')) {
      const cells = [];
      let next = 0;
      for (const cell of elements(row.body, 'c')) {
        const at = cell.attrs.r ? colIndex(cell.attrs.r) : next;
        next = at + 1;
        if (at > 200) continue;
        const raw = elements(cell.body, 'v')[0]?.body;
        let value = '';
        if (cell.attrs.t === 'inlineStr') value = textOf(cell.body);
        else if (raw === undefined) value = '';
        else if (cell.attrs.t === 's') value = shared[Number(raw)] ?? '';
        else if (cell.attrs.t === 'b') value = raw === '1' ? 'SI' : 'NO';
        else value = unesc(raw);
        cells[at] = value.trim();
      }
      if (cells.some(Boolean)) rows.push({ number: Number(row.attrs.r) || rows.length + 1, cells: Array.from(cells, (v) => v || '') });
      if (rows.length > MAX_ROWS) throw new Error(`La hoja «${sheet.attrs.name}» tiene más de ${MAX_ROWS} filas.`);
    }
    out.set(sheet.attrs.name, rows);
  }
  return out;
}

module.exports = { writeWorkbook, readWorkbook, zip, unzip };
