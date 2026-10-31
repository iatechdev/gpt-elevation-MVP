// [QA-Claude] Captura del chat a tamaño de ventana real (1440x900 y 390x844) para medir el espacio útil del panel de conversación.
const fs = require('fs'); const path = require('path'); const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'credenciales-staging.json'), 'utf8')); const a = cfg.cuentas[process.env.QA_ACCT || 'P4']; const OUT = process.env.OUT;
(async () => { const b = await chromium.launch(); const res = {};
  for (const [n, vp] of [['desktop', { width: 1440, height: 900 }], ['movil', { width: 390, height: 844 }]]) {
    const p = await (await b.newContext({ viewport: vp })).newPage(); await p.goto(cfg.api + '/login', { waitUntil: 'networkidle' });
    await p.fill('input[type=email]', a.email); await p.fill('input[type=password]', a.password); await p.keyboard.press('Enter'); await p.waitForTimeout(3000);
    await p.goto(cfg.api + '/app/chat', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000); await p.screenshot({ path: path.join(OUT, n + '-chat.png') });
    res[n] = await p.evaluate(() => { const q = s => document.querySelector(s)?.getBoundingClientRect(); const r = q('.space-message'), l = q('[class*=messages],[class*=thread],main'); return { viewport: [innerWidth, innerHeight], textarea: r && [Math.round(r.width), Math.round(r.height)], main: l && [Math.round(l.width), Math.round(l.height)] }; });
  } console.log(JSON.stringify(res)); await b.close(); })();
