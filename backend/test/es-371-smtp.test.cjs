// ES-371 · Proveedor de correo `smtp`. Servidor SMTP falso real (smtp-server) en puertos efímeros de la propia máquina; sin red, sin buzón real, sin secretos.
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { SMTPServer } = require('smtp-server');

const mailer = require('../utils/mailer');
const { sendSmtp, smtpOptions, closeSmtp, SmtpMailError, checkFrom } = require('../utils/mailSmtp');

const SECRET = 'S3cret-Pa55-for-test-only';
const LINK = 'https://staging.example.test/accept-invitation#token=TOKEN_abc123_-XYZ';

// Servidor falso: guarda cada mensaje (crudo), la sesión y los intentos de autenticación.
async function fakeServer(options = {}, host = '127.0.0.1') {
  const state = { messages: [], auths: [], connections: 0, rcpts: [] };
  const server = new SMTPServer({
    logger: false,
    authOptional: true,
    ...options,
    onConnect(session, cb) { state.connections += 1; cb(); },
    onAuth(auth, session, cb) {
      state.auths.push({ username: auth.username, password: auth.password });
      if (options.rejectAuth) return cb(new Error('535 credenciales inválidas'));
      return cb(null, { user: auth.username });
    },
    onRcptTo(address, session, cb) { state.rcpts.push(address.address); if (options.rejectRcpt) return cb(new Error('550 buzón no existe')); return cb(); },
    onData(stream, session, cb) {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => { state.messages.push({ raw: Buffer.concat(chunks).toString('utf8'), secure: Boolean(session.secure), from: session.envelope.mailFrom.address, to: session.envelope.rcptTo.map(r => r.address) }); cb(); });
    },
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, host, resolve); });
  return { state, port: server.server.address().port, host, close: () => new Promise(resolve => server.close(resolve)) };
}

const decodeQp = text => text.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
const bodyOf = raw => decodeQp(raw.split(/\r?\n\r?\n/).slice(1).join('\n\n'));
const headerOf = (raw, name) => { const head = raw.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, ' '); const line = head.split(/\r?\n/).find(l => l.toLowerCase().startsWith(name.toLowerCase() + ':')); return line ? line.slice(name.length + 1).trim() : null; };

// Cabecera con palabras codificadas «=?UTF-8?Q?...?=» o «=?UTF-8?B?...?=» (RFC 2047) → texto.
const rfc2047 = value => value.split(' ').map(word => {
  const parts = word.split('?'); // ['=', 'UTF-8', 'Q', 'texto', '=']
  if (parts.length !== 5 || parts[0] !== '=' || parts[4] !== '=') return ' ' + word;
  const bytes = parts[2].toUpperCase() === 'B' ? Buffer.from(parts[3], 'base64') : Buffer.from(parts[3].replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
  return bytes.toString('utf8');
}).join('').trim();
const envFor = (srv, extra = {}) => ({ SMTP_HOST: srv.host, SMTP_PORT: String(srv.port), SMTP_SECURE: 'false', SMTP_TIMEOUT_MS: '4000', MAIL_FROM: 'Elevation <no-reply@staging.example.test>', ...extra });
const withEnv = async (env, fn) => {
  const keys = ['MAIL_PROVIDER', 'MAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_TIMEOUT_MS'];
  const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, env);
  try { return await fn(); } finally { for (const k of keys) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; } closeSmtp(); }
};
const caught = async fn => { try { await fn(); } catch (error) { return error; } return null; };
const assertNoLeak = (error, extra = []) => {
  const text = `${error && error.message} ${error && error.stack && error.stack.split('\n')[0]} ${JSON.stringify(error)}`;
  for (const secret of [SECRET, 'TOKEN_abc123', 'persona@example.test', '127.0.0.1', '127.0.0.2', 'no-reply@staging.example.test', ...extra]) assert.ok(!text.includes(secret), `el error no debe contener «${secret}»: ${text}`);
};

test('ES-371: el proveedor smtp está registrado y sin MAIL_PROVIDER no se envía nada', async () => {
  assert.equal(typeof mailer.providers.smtp, 'function');
  await withEnv({}, async () => assert.deepEqual(await mailer.sendInvitation({ to: 'persona@example.test', link: LINK, locale: 'es', hours: 48 }), { sent: false }));
  await withEnv({ MAIL_PROVIDER: 'otro' }, async () => assert.rejects(mailer.sendInvitation({ to: 'persona@example.test', link: LINK, locale: 'es', hours: 48 }), /no soportado/));
});

test('ES-371: invitación y restablecimiento llegan en ES y EN, con el enlace íntegro, remitente y cabeceras correctas', async () => {
  const srv = await fakeServer();
  try {
    await withEnv({ MAIL_PROVIDER: 'smtp', ...envFor(srv) }, async () => {
      assert.deepEqual(await mailer.sendInvitation({ to: 'persona@example.test', link: LINK, locale: 'es', hours: 48 }), { sent: true });
      assert.deepEqual(await mailer.sendInvitation({ to: 'persona@example.test', link: LINK, locale: 'en', hours: 48 }), { sent: true });
      assert.deepEqual(await mailer.sendPasswordReset({ to: 'persona@example.test', link: LINK, locale: 'es', minutes: 30 }), { sent: true });
      assert.deepEqual(await mailer.sendPasswordReset({ to: 'persona@example.test', link: LINK, locale: 'en', minutes: 30 }), { sent: true });
    });
    assert.equal(srv.state.messages.length, 4);
    const [inviteEs, inviteEn, resetEs, resetEn] = srv.state.messages;
    const subject = raw => rfc2047(headerOf(raw, 'Subject'));
    assert.equal(subject(inviteEs.raw), 'Te invitaron a Elevation');
    assert.equal(subject(inviteEn.raw), 'You have been invited to Elevation');
    assert.equal(subject(resetEs.raw), 'Crea una contraseña nueva en Elevation');
    assert.equal(subject(resetEn.raw), 'Create a new password for Elevation');
    for (const message of [inviteEs, inviteEn, resetEs, resetEn]) {
      assert.ok(bodyOf(message.raw).includes(LINK), 'el enlace llega íntegro (sin cortes ni reescritura)');
      assert.deepEqual(message.to, ['persona@example.test']);
      assert.equal(message.from, 'no-reply@staging.example.test');
      assert.match(headerOf(message.raw, 'From'), /no-reply@staging\.example\.test/);
      assert.equal(headerOf(message.raw, 'To'), 'persona@example.test');
      assert.equal(headerOf(message.raw, 'Bcc'), null);
      assert.equal(headerOf(message.raw, 'Cc'), null);
      assert.match(headerOf(message.raw, 'Content-Type'), /^text\/plain/);
    }
    assert.match(bodyOf(inviteEs.raw), /caduca en 48 horas/);
    assert.match(bodyOf(inviteEn.raw), /expires in 48 hours/);
    assert.match(bodyOf(resetEs.raw), /caduca en 30 minutos/);
    assert.match(bodyOf(resetEn.raw), /expires in 30 minutes/);
  } finally { await srv.close(); }
});

test('ES-371: si el servidor ofrece STARTTLS en la propia máquina se usa; con TLS implícito (SMTP_SECURE=true) también llega', async () => {
  const starttls = await fakeServer({ secure: false });
  try {
    await withEnv(envFor(starttls), async () => { await sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: 'Prueba', text: LINK }); });
    assert.equal(starttls.state.messages.length, 1);
    assert.equal(starttls.state.messages[0].secure, true, 'la sesión se cifró con STARTTLS');
  } finally { await starttls.close(); }
  const implicit = await fakeServer({ secure: true });
  try {
    await withEnv(envFor(implicit, { SMTP_SECURE: 'true' }), async () => { await sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: 'Prueba', text: LINK }); });
    assert.equal(implicit.state.messages.length, 1);
    assert.equal(implicit.state.messages[0].secure, true);
  } finally { await implicit.close(); }
});

test('ES-371: en un servidor que NO es la propia máquina, sin TLS no se envía (STARTTLS obligatorio) y no se entrega nada', async () => {
  const srv = await fakeServer({ disabledCommands: ['STARTTLS'] }, '127.0.0.2'); // 127.0.0.2 NO cuenta como «la propia máquina» para la política
  try {
    const env = envFor(srv, { SMTP_USER: 'buzon', SMTP_PASS: SECRET });
    await withEnv(env, async () => {
      assert.equal(smtpOptions(process.env).requireTLS, true);
      const error = await caught(() => sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: 'Prueba', text: LINK }));
      assert.ok(error instanceof SmtpMailError, String(error));
      assert.equal(error.code, 'tls');
      assertNoLeak(error);
    });
    assert.equal(srv.state.messages.length, 0, 'no se entregó el mensaje');
    assert.equal(srv.state.auths.length, 0, 'las credenciales NO se enviaron en claro');
  } finally { await srv.close(); }
});

test('ES-371: en un servidor remoto el certificado se verifica: uno autofirmado se rechaza aunque ofrezca STARTTLS o TLS implícito', async () => {
  for (const secure of [false, true]) {
    const srv = await fakeServer({ secure }, '127.0.0.2');
    try {
      await withEnv(envFor(srv, { SMTP_SECURE: String(secure), SMTP_USER: 'buzon', SMTP_PASS: SECRET }), async () => {
        const opts = smtpOptions(process.env);
        assert.equal(opts.tls.rejectUnauthorized, true);
        assert.equal(opts.tls.minVersion, 'TLSv1.2');
        const error = await caught(() => sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: 'Prueba', text: LINK }));
        assert.ok(error instanceof SmtpMailError, String(error));
        assert.ok(['tls', 'connection'].includes(error.code), error.code);
        assertNoLeak(error);
      });
      assert.equal(srv.state.messages.length, 0);
      assert.equal(srv.state.auths.length, 0, 'sin canal verificado no se mandan credenciales');
    } finally { await srv.close(); }
  }
});

test('ES-371: política de TLS por host (pura): propia máquina vs. remoto, puertos por defecto y opciones acotadas', () => {
  const base = { MAIL_FROM: 'a@b.co' };
  for (const host of ['localhost', '127.0.0.1', '::1', 'LOCALHOST']) { const o = smtpOptions({ ...base, SMTP_HOST: host }); assert.equal(o.requireTLS, false, host); assert.equal(o.tls.rejectUnauthorized, false, host); }
  for (const host of ['smtp.example.test', '127.0.0.2', '10.0.0.5', 'localhost.example.test']) { const o = smtpOptions({ ...base, SMTP_HOST: host }); assert.equal(o.requireTLS, true, host); assert.equal(o.tls.rejectUnauthorized, true, host); assert.equal(o.ignoreTLS, false); }
  assert.equal(smtpOptions({ SMTP_HOST: 'smtp.example.test' }).port, 587);
  assert.equal(smtpOptions({ SMTP_HOST: 'smtp.example.test', SMTP_SECURE: 'true' }).port, 465);
  assert.equal(smtpOptions({ SMTP_HOST: 'smtp.example.test', SMTP_SECURE: 'true' }).requireTLS, false);
  assert.equal(smtpOptions({ SMTP_HOST: 'smtp.example.test', SMTP_PORT: '2525' }).port, 2525);
  assert.equal(smtpOptions({ SMTP_HOST: 'smtp.example.test', SMTP_PORT: 'abc' }).port, 587);
  const o = smtpOptions({ SMTP_HOST: 'smtp.example.test' });
  assert.equal(o.pool, true); assert.equal(o.maxConnections, 2); assert.equal(o.logger, false); assert.equal(o.debug, false);
  assert.equal(o.disableFileAccess, true); assert.equal(o.disableUrlAccess, true);
  assert.equal(o.connectionTimeout, 15000); assert.equal(o.socketTimeout, 15000); assert.equal(o.greetingTimeout, 15000);
  assert.equal(smtpOptions({ SMTP_HOST: 'x.test', SMTP_TIMEOUT_MS: '999999999' }).socketTimeout, 60000);
  assert.equal(smtpOptions({ SMTP_HOST: 'x.test', SMTP_TIMEOUT_MS: '1' }).socketTimeout, 500);
  assert.equal(smtpOptions({ SMTP_HOST: 'x.test', SMTP_TIMEOUT_MS: '-5' }).socketTimeout, 15000);
});

test('ES-371: configuración incompleta o peligrosa falla con un código fijo y sin valores', async () => {
  const bad = [{}, { SMTP_HOST: '  ' }, { SMTP_HOST: 'smtp.example.test\r\nRCPT TO:<x@y.co>' }, { SMTP_HOST: 'smtp.example.test', SMTP_USER: 'buzon' }, { SMTP_HOST: 'smtp.example.test', SMTP_PASS: SECRET }];
  for (const env of bad) {
    const error = await caught(async () => smtpOptions(env));
    assert.ok(error instanceof SmtpMailError, JSON.stringify(env)); assert.equal(error.code, 'config'); assertNoLeak(error);
  }
  await withEnv({ MAIL_PROVIDER: 'smtp', MAIL_FROM: 'Elevation <no-reply@staging.example.test>', SMTP_HOST: 'smtp.example.test', SMTP_USER: 'buzon' }, async () => {
    const error = await caught(() => mailer.sendPasswordReset({ to: 'persona@example.test', link: LINK, locale: 'es', minutes: 30 }));
    assert.equal(error.code, 'config'); assertNoLeak(error);
  });
});

test('ES-371: inyección de cabeceras — saltos de línea y destinatarios/remitentes inválidos se rechazan antes de abrir la conexión', async () => {
  const srv = await fakeServer();
  try {
    await withEnv(envFor(srv), async () => {
      const from = process.env.MAIL_FROM;
      const attempts = [
        { to: 'persona@example.test\r\nBcc: otra@example.test', from, subject: 'Hola', text: 'x', code: 'recipient' },
        { to: 'persona@example.test\nCc: otra@example.test', from, subject: 'Hola', text: 'x', code: 'recipient' },
        { to: 'persona@example.test,otra@example.test', from, subject: 'Hola', text: 'x', code: 'recipient' },
        { to: 'a@b.co‮', from, subject: 'Hola', text: 'x', code: 'recipient' },
        { to: '', from, subject: 'Hola', text: 'x', code: 'recipient' },
        { to: undefined, from, subject: 'Hola', text: 'x', code: 'recipient' },
        { to: 'persona@example.test', from, subject: 'Hola\r\nBcc: otra@example.test', text: 'x', code: 'message' },
        { to: 'persona@example.test', from, subject: 'Hola Bcc: otra@example.test', text: 'x', code: 'message' },
        { to: 'persona@example.test', from: 'no-reply@staging.example.test\r\nBcc: otra@example.test', subject: 'Hola', text: 'x', code: 'config' },
        { to: 'persona@example.test', from: 'Elevation <no-reply@staging.example.test>\nBcc: x@y.co', subject: 'Hola', text: 'x', code: 'config' },
        { to: 'persona@example.test', from: '', subject: 'Hola', text: 'x', code: 'config' },
        { to: 'persona@example.test', from: 'sin-arroba', subject: 'Hola', text: 'x', code: 'config' },
      ];
      for (const { code, ...message } of attempts) {
        const error = await caught(() => sendSmtp(message));
        assert.ok(error instanceof SmtpMailError, JSON.stringify(message)); assert.equal(error.code, code, JSON.stringify(message));
      }
    });
    assert.equal(srv.state.connections, 0, 'ni siquiera se abrió una conexión');
    assert.equal(srv.state.messages.length, 0);
    assert.equal(checkFrom('Elevation <no-reply@staging.example.test>'), true);
    assert.equal(checkFrom('no-reply@staging.example.test'), true);
  } finally { await srv.close(); }
});

test('ES-371: error de autenticación → código «auth», sin contraseña, usuario, destinatario ni enlace; y no se entrega nada', async () => {
  const srv = await fakeServer({ rejectAuth: true, authOptional: false });
  try {
    await withEnv(envFor(srv, { SMTP_USER: 'buzon@example.test', SMTP_PASS: SECRET }), async () => {
      const error = await caught(() => sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: 'Prueba', text: LINK }));
      assert.ok(error instanceof SmtpMailError); assert.equal(error.code, 'auth'); assertNoLeak(error, ['buzon@example.test']);
      const viaMailer = await caught(() => mailer.sendInvitation({ to: 'persona@example.test', link: LINK, locale: 'es', hours: 48 }).catch(e => { throw e; }));
      void viaMailer;
    });
    assert.equal(srv.state.messages.length, 0);
    assert.ok(srv.state.auths.length >= 1);
  } finally { await srv.close(); }
});

test('ES-371: credenciales correctas se usan para autenticar (y solo ahí)', async () => {
  const srv = await fakeServer({ authOptional: false });
  try {
    await withEnv(envFor(srv, { SMTP_USER: 'buzon@example.test', SMTP_PASS: SECRET }), async () => {
      await sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: 'Prueba', text: LINK });
    });
    assert.equal(srv.state.messages.length, 1);
    assert.deepEqual(srv.state.auths[0], { username: 'buzon@example.test', password: SECRET });
    assert.ok(!srv.state.messages[0].raw.includes(SECRET), 'la contraseña no viaja dentro del mensaje');
  } finally { await srv.close(); }
});

test('ES-371: un destinatario rechazado por el servidor es un fallo (no se declara enviado) y sin datos en el error', async () => {
  const srv = await fakeServer({ rejectRcpt: true });
  try {
    await withEnv(envFor(srv), async () => {
      const error = await caught(() => sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: 'Prueba', text: LINK }));
      assert.ok(error instanceof SmtpMailError); assert.equal(error.code, 'rejected'); assertNoLeak(error);
      const sent = await caught(() => mailer.sendPasswordReset({ to: 'persona@example.test', link: LINK, locale: 'en', minutes: 30 }));
      void sent;
    });
    assert.equal(srv.state.messages.length, 0);
  } finally { await srv.close(); }
});

test('ES-371: servidor que acepta la conexión pero no saluda → timeout acotado, un solo intento', async () => {
  let accepted = 0;
  const mute = net.createServer(socket => { accepted += 1; socket.on('error', () => {}); }); // no escribe nada
  await new Promise(resolve => mute.listen(0, '127.0.0.1', resolve));
  const port = mute.address().port;
  try {
    await withEnv({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_TIMEOUT_MS: '700', MAIL_FROM: 'Elevation <no-reply@staging.example.test>' }, async () => {
      const started = Date.now();
      const error = await caught(() => sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: 'Prueba', text: LINK }));
      const elapsed = Date.now() - started;
      assert.ok(error instanceof SmtpMailError); assert.equal(error.code, 'timeout'); assertNoLeak(error);
      assert.ok(elapsed >= 600 && elapsed < 4000, `tardó ${elapsed} ms`);
    });
    assert.equal(accepted, 1, 'un solo intento de conexión: sin reintentos');
  } finally { await new Promise(resolve => mute.close(resolve)); }
});

test('ES-371: servidor caído → código «connection» sin datos y sin reintentos', async () => {
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  await withEnv({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_TIMEOUT_MS: '2000', MAIL_FROM: 'Elevation <no-reply@staging.example.test>' }, async () => {
    const error = await caught(() => sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: 'Prueba', text: LINK }));
    assert.ok(error instanceof SmtpMailError); assert.equal(error.code, 'connection'); assertNoLeak(error);
  });
});

test('ES-371: el transporte se reutiliza (una conexión para envíos seguidos) y se recrea si cambia la configuración', async () => {
  const srv = await fakeServer();
  try {
    await withEnv(envFor(srv), async () => {
      for (let i = 0; i < 3; i += 1) await sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: `Prueba ${i}`, text: LINK });
    });
    assert.equal(srv.state.messages.length, 3);
    assert.equal(srv.state.connections, 1, 'tres mensajes, una sola conexión (transporte con pool reutilizado)');
    await withEnv(envFor(srv), async () => { await sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: 'Prueba', text: LINK }); });
    await withEnv(envFor(srv, { MAIL_FROM: 'Otro <otro@staging.example.test>' }), async () => { await sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: 'Prueba', text: LINK }); });
    assert.equal(srv.state.messages.at(-1).from, 'otro@staging.example.test');
  } finally { await srv.close(); }
});

test('ES-371: el proceso termina solo tras enviar (el pool no deja sockets abiertos)', async () => {
  const srv = await fakeServer();
  try {
    const script = `const { sendSmtp } = require(${JSON.stringify(path.join(__dirname, '..', 'utils', 'mailSmtp.js'))}); sendSmtp({ to: 'persona@example.test', from: 'Elevation <no-reply@staging.example.test>', subject: 'Prueba', text: 'x' }).then(() => { process.stdout.write('ok'); });`;
    const child = spawn(process.execPath, ['-e', script], { env: { ...process.env, SMTP_HOST: srv.host, SMTP_PORT: String(srv.port), SMTP_TIMEOUT_MS: '4000' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; child.stdout.on('data', chunk => { out += chunk; });
    const code = await new Promise((resolve, reject) => { const timer = setTimeout(() => { child.kill(); reject(new Error('el proceso no terminó solo')); }, 15000); child.on('exit', c => { clearTimeout(timer); resolve(c); }); });
    assert.equal(code, 0); assert.equal(out, 'ok'); assert.equal(srv.state.messages.length, 1);
  } finally { await srv.close(); }
});

test('ES-371: nada de lo que registra el módulo contiene el enlace, el destinatario ni credenciales', async () => {
  const lines = [];
  const original = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const level of Object.keys(original)) console[level] = (...args) => { lines.push(args.map(String).join(' ')); };
  const srv = await fakeServer({ rejectAuth: true, authOptional: false });
  try {
    await withEnv(envFor(srv, { SMTP_USER: 'buzon@example.test', SMTP_PASS: SECRET }), async () => { await caught(() => sendSmtp({ to: 'persona@example.test', from: process.env.MAIL_FROM, subject: 'Prueba', text: LINK })); });
  } finally { Object.assign(console, original); await srv.close(); }
  const all = lines.join('\n');
  for (const secret of [SECRET, 'TOKEN_abc123', 'persona@example.test', 'buzon@example.test']) assert.ok(!all.includes(secret), `el log no debe contener «${secret}»`);
});
