// backend/utils/mailer.js
// ES-132: envío de correo transaccional. El proveedor real lo elige ES-12 y se registra en `providers`;
// el nombre llega en MAIL_PROVIDER y MAIL_FROM es el remitente verificado. Sin proveedor no se envía nada.
// Nunca se escribe el enlace, el token ni el destinatario en logs.

const providers = {};

const MESSAGES = {
  es: {
    subject: 'Crea una contraseña nueva en Elevation',
    body: ({ link, minutes }) => [
      'Recibimos una solicitud para crear una contraseña nueva en tu cuenta de Elevation.',
      '',
      `Abre este enlace para elegirla (sirve una sola vez y caduca en ${minutes} minutos):`,
      link,
      '',
      'Si no fuiste tú, ignora este mensaje: tu contraseña actual no cambia.',
    ].join('\n'),
  },
  en: {
    subject: 'Create a new password for Elevation',
    body: ({ link, minutes }) => [
      'We received a request to create a new password for your Elevation account.',
      '',
      `Open this link to choose it (it works once and expires in ${minutes} minutes):`,
      link,
      '',
      'If this was not you, ignore this message: your current password does not change.',
    ].join('\n'),
  },
};

function passwordResetMessage({ link, locale, minutes }) {
  const copy = MESSAGES[locale === 'en' ? 'en' : 'es'];
  return { subject: copy.subject, text: copy.body({ link, minutes }) };
}

// Devuelve { sent: boolean }. Un proveedor mal configurado lanza (quien llama lo registra sin datos personales).
async function sendPasswordReset({ to, link, locale, minutes }) {
  const name = process.env.MAIL_PROVIDER;
  if (!name) return { sent: false };
  const send = providers[name];
  if (typeof send !== 'function') throw new Error('Proveedor de correo no soportado.');
  await send({ to, from: process.env.MAIL_FROM, ...passwordResetMessage({ link, locale, minutes }) });
  return { sent: true };
}

module.exports = { providers, sendPasswordReset, passwordResetMessage };
