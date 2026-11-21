// backend/routes/legal.js
// ES-336 (F1) · Documentos legales publicados, lectura PÚBLICA (sin sesión):
//   GET /api/legal/current        → { version, effectiveFrom, docs: [{ docKey, langs }] }   (sin publicación: { version: null, docs: [] })
//   GET /api/legal/:docKey?lang=  → { docKey, lang, version, effectiveFrom, source: 'db', content }   (404 not_published si no hay)
// Solo lo PUBLICADO; los borradores y el historial no salen por aquí. Claves e idioma de listas cerradas (400 estable). La SPA conserva el texto empaquetado como respaldo:
// ante cualquier error, 404 o respuesta inválida se queda con él (nunca una página vacía). Sin editor en esta fase: la escritura llega con la fase 2.
const express = require('express');
const router = express.Router();
const { DOC_KEYS, LANGS } = require('../utils/legalContent');
const { currentSummary, publishedDocument } = require('../utils/legalDocs');

const PUBLIC_CACHE = 'public, max-age=60'; // lectura pública y sin datos personales; ETag lo pone Express

router.get('/current', async (req, res) => {
  try {
    const { release, docs } = await currentSummary();
    res.set('Cache-Control', PUBLIC_CACHE);
    res.json({ version: release ? release.version : null, effectiveFrom: release ? release.effectiveFrom : null, docs });
  } catch (error) {
    console.error('❌ Error leyendo la publicación legal vigente:', error && (error.code || error.name));
    res.set('Cache-Control', 'no-store');
    res.status(500).json({ code: 'legal_unavailable', error: 'No se pudo leer el documento. / The document could not be read.' });
  }
});

router.get('/:docKey', async (req, res) => {
  const { docKey } = req.params;
  const lang = req.query.lang === undefined ? 'es' : req.query.lang;
  if (!DOC_KEYS.includes(docKey) || typeof lang !== 'string' || !LANGS.includes(lang)) {
    res.set('Cache-Control', 'no-store');
    return res.status(400).json({ code: 'invalid_legal_request', error: 'Documento o idioma inválido. / Invalid document or language.' });
  }
  try {
    const doc = await publishedDocument(docKey, lang);
    if (!doc) {
      res.set('Cache-Control', 'no-store');
      return res.status(404).json({ code: 'not_published', error: 'Este documento aún no está publicado. / This document is not published yet.' });
    }
    res.set('Cache-Control', PUBLIC_CACHE);
    res.json({ docKey: doc.docKey, lang: doc.lang, version: doc.version, effectiveFrom: doc.effectiveFrom, source: 'db', content: doc.content });
  } catch (error) {
    console.error('❌ Error leyendo un documento legal:', error && (error.code || error.name));
    res.set('Cache-Control', 'no-store');
    res.status(500).json({ code: 'legal_unavailable', error: 'No se pudo leer el documento. / The document could not be read.' });
  }
});

module.exports = router;
