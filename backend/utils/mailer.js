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

// ES-192: invitación por enlace. Mismo contrato que el restablecimiento: sin proveedor no se envía; nunca se registra el enlace ni el destinatario.
const INVITATION = {
  es: {
    subject: 'Te invitaron a Elevation',
    body: ({ link, hours }) => [
      'Te invitaron a crear tu cuenta en Elevation.',
      '',
      `Abre este enlace para elegir tu contraseña (sirve una sola vez y caduca en ${hours} horas):`,
      link,
      '',
      'Si no esperabas esta invitación, ignora este mensaje: no se crea ninguna cuenta.',
    ].join('\n'),
  },
  en: {
    subject: 'You have been invited to Elevation',
    body: ({ link, hours }) => [
      'You have been invited to create your Elevation account.',
      '',
      `Open this link to choose your password (it works once and expires in ${hours} hours):`,
      link,
      '',
      'If you did not expect this invitation, ignore this message: no account is created.',
    ].join('\n'),
  },
};

function invitationMessage({ link, locale, hours }) {
  const copy = INVITATION[locale === 'en' ? 'en' : 'es'];
  return { subject: copy.subject, text: copy.body({ link, hours }) };
}

async function sendInvitation({ to, link, locale, hours }) {
  const name = process.env.MAIL_PROVIDER;
  if (!name) return { sent: false };
  const send = providers[name];
  if (typeof send !== 'function') throw new Error('Proveedor de correo no soportado.');
  await send({ to, from: process.env.MAIL_FROM, ...invitationMessage({ link, locale, hours }) });
  return { sent: true };
}

module.exports = { providers, sendPasswordReset, passwordResetMessage, sendInvitation, invitationMessage };
