// ES-109: validación y extracción de texto de una hoja de vida en PDF. El archivo es NO confiable: se valida el tamaño y la firma en el servidor,
// se acota el número de páginas y el tiempo, y no se ejecuta nada del documento (sin JavaScript, sin fuentes del sistema, sin red).
// Nunca registra el contenido; los errores solo llevan un código.
const MAX_RESUME_BYTES = 5 * 1024 * 1024; // decisión de Mauricio (29-oct): PDF de hasta 5 MB, validado aquí y no solo en el cliente
const MAX_PAGES = 15;
const PARSE_TIMEOUT_MS = 20000;
const MIN_TEXT_CHARS = 40; // menos que esto en un PDF con páginas = imagen escaneada

class ResumePdfError extends Error {
  constructor(code) { super('No se pudo leer el PDF.'); this.code = code; }
}
// Códigos: empty · too_large · not_pdf · encrypted · corrupt · too_many_pages · no_text · timeout

const isPdf = (buffer) => Buffer.isBuffer(buffer) && buffer.length >= 8 && buffer.subarray(0, 5).toString('latin1') === '%PDF-'; // firma al inicio, como en ES-95: sin políglotas

// Valida lo que se puede saber sin abrir el documento. Orden fijo: vacío, tamaño, firma.
function checkResumeFile(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new ResumePdfError('empty');
  if (buffer.length > MAX_RESUME_BYTES) throw new ResumePdfError('too_large');
  if (!isPdf(buffer)) throw new ResumePdfError('not_pdf');
}

let pdfjs;
async function loadPdfjs() {
  pdfjs ??= await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

// -> { text, pages }. El PDF se abre solo para leer texto: sin scripts, sin fuentes del sistema, sin recursos externos.
async function extractResumeText(buffer) {
  checkResumeFile(buffer);
  const lib = await loadPdfjs();
  let task;
  const run = async () => {
    task = lib.getDocument({
      data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, useWorkerFetch: false,
      enableXfa: false, verbosity: 0, stopAtErrors: false,
    });
    const doc = await task.promise;
    try {
      if (doc.numPages > MAX_PAGES) throw new ResumePdfError('too_many_pages');
      const chunks = [];
      for (let number = 1; number <= doc.numPages; number++) {
        const page = await doc.getPage(number);
        const content = await page.getTextContent();
        let line = '';
        for (const item of content.items) {
          if (typeof item.str !== 'string') continue;
          line += item.str;
          if (item.hasEOL) { chunks.push(line); line = ''; }
        }
        if (line) chunks.push(line);
        page.cleanup();
      }
      return { text: chunks.join('\n'), pages: doc.numPages };
    } finally { await doc.destroy().catch(() => {}); }
  };
  let timer;
  try {
    const result = await Promise.race([
      run(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new ResumePdfError('timeout')), PARSE_TIMEOUT_MS); }),
    ]);
    if (result.text.replace(/\s/g, '').length < MIN_TEXT_CHARS) throw new ResumePdfError('no_text');
    return result;
  } catch (error) {
    if (error instanceof ResumePdfError) throw error;
    if (error && error.name === 'PasswordException') throw new ResumePdfError('encrypted');
    throw new ResumePdfError('corrupt');
  } finally {
    clearTimeout(timer);
    if (task) task.destroy().catch(() => {});
  }
}
module.exports = { MAX_RESUME_BYTES, MAX_PAGES, PARSE_TIMEOUT_MS, MIN_TEXT_CHARS, ResumePdfError, checkResumeFile, extractResumeText, isPdf };
