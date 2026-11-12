// backend/middlewares/apiErrors.js
// ES-280 (ES-189) · Último eslabón de /api: un error que ninguna ruta atendió se responde en JSON con un cuerpo FIJO, nunca con la página HTML de Express (que en desarrollo
// trae la traza) ni con el texto del error interno. Un porcentaje mal formado en la URL (`/api/diary/%E0%A4%A`) ya no es una página HTML con traza: es un 400 JSON.
// Los errores con un tratamiento propio (cuerpo JSON mal formado o demasiado grande) los atienden antes los manejadores de server.js y no llegan aquí.
const BAD_REQUEST = { code: 'invalid_input', error: 'Datos inválidos. / Invalid data.' };
const FAILED = { code: 'internal_error', error: 'No se pudo completar la solicitud. / The request could not be completed.' };

function apiErrors(error, req, res, next) {
  if (res.headersSent) return next(error);
  res.set('Cache-Control', 'no-store');
  const status = Number(error && (error.status || error.statusCode)) || 500;
  if (error && (error.code === 'DECODE_PARAM_FAILED' || error instanceof URIError)) return res.status(400).json(BAD_REQUEST);
  if (status >= 400 && status < 500) return res.status(status).json(status === 400 ? BAD_REQUEST : { code: 'request_error', error: 'Solicitud no válida. / Invalid request.' });
  console.error('Error no atendido en la API.'); // sin mensaje, traza ni datos de la solicitud
  return res.status(500).json(FAILED);
}

module.exports = { apiErrors, BAD_REQUEST, FAILED };
