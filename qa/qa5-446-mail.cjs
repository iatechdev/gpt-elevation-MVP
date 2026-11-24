// [QA-Claude-5] #446: precarga de pruebas (node --require). Registra proveedores de correo FALSOS en utils/mailer (nada sale de la máquina):
//   MAIL_PROVIDER=qa     → «envía»: guarda el mensaje en out/outbox.jsonl (solo en la máquina de QA, con el enlace sintético), salvo que exista out/mail-fail.flag (entonces guarda y LANZA, como un proveedor caído tras recibir el mensaje).
//   MAIL_PROVIDER=qafail → lanza siempre sin guardar.
const fs = require('fs'); const path = require('path'); const OUT = (process.env.QA_TOOLS || '.') + '/qa5/out'
const mailer = require(path.join(process.env.BACKEND, 'utils', 'mailer'))
mailer.providers.qa = async (msg) => { fs.appendFileSync(OUT + '/outbox.jsonl', JSON.stringify({ to: msg.to, text: msg.text, at: Date.now() }) + '\n'); if (fs.existsSync(OUT + '/mail-fail.flag')) throw new Error('proveedor caído (simulado)') }
mailer.providers.qafail = async () => { throw new Error('proveedor caído (simulado)') }
