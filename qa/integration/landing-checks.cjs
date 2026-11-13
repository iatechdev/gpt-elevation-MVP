// [QA-Claude] Comprobaciones genéricas de la landing (textos de una sección contra el documento, estructura, responsive, contraste y red) con Playwright.
// Uso: PLAYWRIGHT_MODULE=<ruta> PLAYWRIGHT_BROWSERS_PATH=<ruta> LANDING_URL=http://127.0.0.1:8174 DOC=<TEXTOS-LANDING-FASE2-ES-EN.md> SECTION=S13 TAG=ES74 node qa/integration/landing-checks.cjs
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.LANDING_URL, section = process.env.SECTION, tag = process.env.TAG || 'LND';
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d }));
const doc = fs.readFileSync(process.env.DOC, 'utf8');
const norm = s => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').replace(/[“”]/g, '"').trim().toLowerCase();
const part = id => { const i = doc.indexOf('## ' + id); const j = doc.indexOf('\n---', i); return doc.slice(i, j === -1 ? undefined : j); };
function tableExpected(sec, lang) {
  const out = [];
  for (const line of sec.split('\n').map(x => x.trim()).filter(l => l.startsWith('|'))) {
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < 3 || /^-+$/.test(cells[0].replace(/\s/g, '')) || /^(bloque|es|en|\| )/i.test(cells[0]) && /^ES$/i.test(cells[1])) continue;
    const t = (lang === 'es' ? cells[1] : cells[2]).replace(/\*\*/g, '').replace(/`[^`]*`/g, '').trim();
    out.push(...t.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 6));
  }
  return out;
}
function expected(sec, lang) {
  if (/^\|.*\|.*\|.*\|/m.test(sec) && !/\*\*ES —/.test(sec)) return tableExpected(sec, lang);
  const a = sec.indexOf(lang === 'es' ? '**ES' : '**EN'); const e = lang === 'es' ? sec.indexOf('**EN') : sec.length;
  const body = sec.slice(a, e === -1 ? sec.length : e); const out = [];
  for (const line of body.split('\n').map(x => x.trim()).filter(Boolean)) {
    let t = line.replace(/^\*\*(ES|EN) — [^*]+\*\*:?\s*/, '').replace(/^- /, '').replace(/^\d+[.)]\s*/, '').replace(/\*\*/g, '');
    const m = t.match(/^([^:.]{2,20}):\s+(.*)$/); if (m) t = m[2];
    t = t.replace(/`[^`]*`/g, '').replace(/\[[^\]]*PENDIENTE[^\]]*\]/gi, '').trim();
    t = t.replace(/(^|\s)\d\)\s+/g, ' ');
    out.push(...t.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 6));
  }
  return out;
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 80)));
  const origins = new Set(); page.on('request', r => origins.add(new URL(r.url()).origin));
  await page.goto(url + '/'); await page.waitForTimeout(1500);
  const sec = part(section);
  for (const lang of ['ES', 'EN']) {
    await page.getByRole('button', { name: lang, exact: true }).first().click(); await page.waitForTimeout(700);
    const text = norm(await page.locator('body').innerText()); const exp = expected(sec, lang.toLowerCase());
    const miss = exp.filter(x => !text.includes(norm(x)));
    check(`${tag}-T01 ${lang}: las ${exp.length} frases de ${section} del documento aparecen literalmente`, exp.length > 0 && miss.length === 0, miss.slice(0, 3).map(x => x.slice(0, 80)).join(' || '));
    const bad = text.match(/garantiz|guarante(?!e)|empleabil|employab|\d+ ?%|testimon|cura|heal your/i);
    check(`${tag}-T02 ${lang}: sin promesas ni cifras en toda la página`, !bad || /sin diagn|without diagn|does not replace|no (garantiz|guarant)/i.test(text), bad ? bad[0] : '');
    const figma = /a tu ritmo\. bajo tu control|tu experiencia no desaparece/i.test(text); check(`${tag}-T03 ${lang}: sin frases de Figma no aprobadas`, !figma, '');
  }
  const struct = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, landmarks: ['header', 'nav', 'main', 'footer'].map(t => t + ':' + document.querySelectorAll(t).length).join(' '), anchors: [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href') + (document.querySelector(a.getAttribute('href').length > 1 ? a.getAttribute('href') : 'body') ? '→ok' : '→FALTA')), skip: [...document.querySelectorAll('a')].find(a => /skip|saltar/i.test(a.innerText))?.getAttribute('href') }));
  check(`${tag}-A01 un h1, landmarks completos, enlace de saltar y anclas que existen`, struct.h1 === 1 && /header:1 nav:1 main:1 footer:1/.test(struct.landmarks) && !!struct.skip && struct.anchors.every(a => !/FALTA/.test(a)), JSON.stringify(struct));
  const widths = [320, 375, 390, 768, 1024, 1440]; const res = [];
  for (const lang of ['ES', 'EN']) { await page.getByRole('button', { name: lang, exact: true }).first().click(); for (const w of widths) { await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(250); const r = await page.evaluate(() => ({ hs: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, clip: [...document.querySelectorAll('main h1,main h2,main h3,main p,main li')].filter(e => e.scrollWidth > e.clientWidth + 1).length, small: [...document.querySelectorAll('main a, main button, header a, header button')].filter(e => { const b = e.getBoundingClientRect(); return b.height > 0 && b.height < 44; }).length })); res.push(`${lang}${w}:${r.hs || r.clip ? 'MAL' : 'ok'}${r.small ? '(' + r.small + ' <44px)' : ''}`); } }
  check(`${tag}-R01 sin desplazamiento ni texto cortado a 320, 375, 390, 768, 1024 y 1440 px en ES y EN`, res.every(x => !/MAL/.test(x)), res.filter(x => /MAL|<44/.test(x)).join(' ') || 'ok');
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme }); await page.waitForTimeout(500);
    const c = await page.evaluate(() => { const parse = s => s.match(/[\d.]+/g).map(Number); const lum = a => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(a[0]) + 0.7152 * f(a[1]) + 0.0722 * f(a[2]); }; let n = 0, worst = 99; const theme = document.querySelector('[data-theme]'); for (const el of document.querySelectorAll('main *, header *, footer *')) { if (![...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim())) continue; const cs = getComputedStyle(el); let b = el, bg = null; while (b) { const v = parse(getComputedStyle(b).backgroundColor); if ((v[3] === undefined ? 1 : v[3]) > 0.9) { bg = v; break; } b = b.parentElement; } bg = bg || parse(getComputedStyle(theme).backgroundColor); const L1 = lum(parse(cs.color)), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); worst = Math.min(worst, ratio); if (ratio < (parseFloat(cs.fontSize) >= 24 ? 3 : 4.5)) n++; } return { n, worst: +worst.toFixed(2), theme: theme.getAttribute('data-theme') }; });
    check(`${tag}-A02 contraste AA en ${scheme}`, c.n === 0, JSON.stringify(c));
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(url + '/'); await page.waitForTimeout(1000); await page.keyboard.press('Tab'); const f1 = await page.evaluate(() => ({ t: (document.activeElement.innerText || '').slice(0, 20), fv: document.activeElement.matches(':focus-visible'), o: getComputedStyle(document.activeElement).outlineStyle }));
  check(`${tag}-A03 el primer foco con teclado es «saltar al contenido» y es visible`, /skip|saltar/i.test(f1.t) && f1.fv && f1.o !== 'none', JSON.stringify(f1));
  const ext = [...origins].filter(o => !o.startsWith(url) && !/fonts\.(googleapis|gstatic)\.com/.test(o));
  check(`${tag}-S01 la landing solo pide al propio origen y a las fuentes ya existentes`, ext.length === 0, ext.join(','));
  const ls = await page.evaluate(() => Object.keys(localStorage).sort().join(',')); check(`${tag}-S02 el almacenamiento local solo tiene el idioma`, /^elv_lang$/.test(ls) || ls === '', ls);
  check(`${tag}-E01 sin errores de página`, errs.length === 0, errs.join(' | '));
  await browser.close(); console.log(JSON.stringify({ fin: true }));
})().catch(e => { console.error(e); process.exit(1); });
