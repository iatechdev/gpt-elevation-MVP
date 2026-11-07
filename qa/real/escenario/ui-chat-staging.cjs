// [QA-Claude] Revisión visual del chat en staging (observación de Alejo): tamaño del panel, contenido e idioma mezclado ES/EN.
// Uso: QA_ENV=staging OUT=<carpeta> node qa/real/escenario/ui-chat-staging.cjs   (lee credenciales locales; no imprime contraseñas)
const fs = require('fs'); const path = require('path');
const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, `credenciales-${process.env.QA_ENV || 'staging'}.json`), 'utf8'));
const OUT = process.env.OUT || path.join(__dirname, '..', 'resultado', 'ui'); fs.mkdirSync(OUT, { recursive: true });
const acct = cfg.cuentas[process.env.QA_ACCT || 'P1']; const RUTAS = (process.env.QA_RUTAS || '/app/compass').split(',').map(r => r.startsWith('/') ? r : '/' + r);
(async () => {
  const b = await chromium.launch(); const rep = {};
  for (const [lang, vp] of [['es', { width: 1440, height: 900 }], ['en', { width: 1440, height: 900 }], ['es-m', { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp, locale: lang === 'en' ? 'en-US' : 'es-ES' }); const p = await ctx.newPage(); rep[lang] = {};
    await p.addInitScript(l => { try { localStorage.setItem('lang', l); localStorage.setItem('i18nextLng', l); localStorage.setItem('language', l); } catch {} }, lang === 'en' ? 'en' : 'es');
    await p.goto(cfg.api + '/login', { waitUntil: 'networkidle' });
    await p.fill('input[type=email]', acct.email); await p.fill('input[type=password]', acct.password); await p.keyboard.press('Enter'); await p.waitForTimeout(3500);
    rep[lang].tras_login = p.url();
    for (const r of RUTAS) {
      await p.goto(cfg.api + r, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); if (lang === 'en') { await p.getByRole('button', { name: 'EN', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(1200); } const tag = lang + r.replace(/\//g, '_');
      await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: true });
      rep[lang][r] = { url: p.url(), texto: (await p.innerText('body')).slice(0, 3000), cajas: await p.$$eval('textarea,input[type=text],[class*=chat],[class*=Chat]', els => els.slice(0, 12).map(e => ({ tag: e.tagName, cls: String(e.className).slice(0, 60), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }))) };
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify(rep, null, 2)); console.log('listo');
  await b.close();
})();
