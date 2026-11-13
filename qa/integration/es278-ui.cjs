// [QA-Claude] ES-278 (PR #245) · panel de planes de precio (AdminContent → Precios) con el SERVIDOR REAL completo y PostgreSQL desechable.
//   QA_BASE=http://127.0.0.1:9245 QA_MODE=head|control QA_OUT=<carpeta> node qa/integration/es278-ui.cjs
// Verifica los dos atributos nuevos del formulario (maxLength del slug y max del precio), que el 400/409 del servidor no rompa la pantalla ni pierda lo escrito, que se pueda guardar
// cada plan de la semilla sin tocarlo y qué pasa con un plan heredado. ES/EN × 390/1360/320, teclado y axe. Datos sintéticos, 0 IA.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const BASE = process.env.QA_BASE || 'http://127.0.0.1:9245';
const OUT = process.env.QA_OUT || '.';
const MODE = process.env.QA_MODE || 'head';
const S = 'C:/Users/Usuario/Documents/qa13';
const { createRequire } = require('module');
const req = createRequire('C:/Users/Usuario/Documents/qa-pr-221/backend/package.json');
const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const SECRET = fs.readFileSync(S + '/jwt', 'utf8').trim();
const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const axeSource = fs.readFileSync('C:/Users/Usuario/tools/playwright/node_modules/axe-core/axe.min.js', 'utf8');
const results = []; const errors = [];
const rec = (id, ok, detail) => { results.push({ id, ok, detail }); console.log(JSON.stringify({ id, ok, detail: String(detail).slice(0, 700) })); };
const info = (id, detail) => { results.push({ id, info: detail }); console.log(JSON.stringify({ id, info: String(detail).slice(0, 700) })); };
const wr = (page, f) => page.waitForResponse(f, { timeout: 8000 }).catch(() => ({ status: () => 0 }));
const L = {
  es: { tab: /Precios/, newPlan: /Nuevo plan/, save: /^(Crear|Actualizar|Guardando)/, edit: /^Editar$/, cancel: /^Cancelar/ },
  en: { tab: /Pric/, newPlan: /New plan/, save: /^(Create|Update|Saving)/, edit: /^Edit$/, cancel: /^Cancel/ },
};

(async () => {
  const db = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/qa245' }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;
  const cols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0; const stamp = crypto.randomBytes(3).toString('hex');
  async function mkAdmin() {
    seq += 1; const names = []; const values = [];
    for (const c of cols) { let v; if (c.column_name === 'role') v = 'admin'; else if (c.column_name === 'name') v = `Admin QA ${seq}`; else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `qa245-${stamp}-${seq}@example.test` : `sintetico-${seq}-${c.column_name}`; else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}'; names.push(`"${c.column_name}"`); values.push(v); }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id; await q(`UPDATE "Users" SET role='admin', active=true WHERE id=$1`, [id]);
    return { id, token: jwt.sign({ id, name: `Admin QA ${seq}`, role: 'admin', iatMs: Date.now() }, SECRET, { expiresIn: '8h', jwtid: crypto.randomBytes(16).toString('hex') }) };
  }
  const admin = await mkAdmin();
  const api = async (method, route, body) => { const r = await fetch(BASE + route, { method, headers: { Authorization: 'Bearer ' + admin.token, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); let b = null; try { b = await r.json(); } catch { /* sin cuerpo */ } return { status: r.status, body: b }; };
  await api('POST', '/api/admin/pricing/seed', {});
  const legacy = (await q(`INSERT INTO "PricingPlans" (slug, name_es, name_en, price, currency, period, features_es, features_en, "isHighlighted", "isActive", "order", "createdAt", "updatedAt") VALUES ('plan_heredado','Heredado QA','Legacy QA',5,'USD','month','[]','[]',false,true,50,now(),now()) RETURNING id`))[0].id;
  const browser = await chromium.launch({ headless: true });

  async function open(width, lang) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }); const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    page.on('dialog', (d) => d.accept());
    await page.addInitScript(([tk, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', l); }, [admin.token, lang]);
    await page.goto(BASE + '/admin/content', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: L[lang].tab }).first().click(); await page.waitForTimeout(500);
    return { context, page };
  }
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };
  const slugInput = (page) => page.locator('input[placeholder="ej: basic"], input[placeholder="e.g. basic"]').first();
  const priceInput = (page) => page.locator('input[type="number"][step="0.01"]').first();
  const nameInputs = (page) => page.locator('input[placeholder*="spa"], input[placeholder*="nglish"], input[placeholder*="Nombre"], input[placeholder*="Name"]');
  const formText = (page) => page.locator('div[style*="position: fixed"]').first().innerText().catch(() => '');
  const planRow = async (slug) => (await q('SELECT slug, name_es, price, period FROM "PricingPlans" WHERE slug=$1', [slug]))[0];

  for (const [width, lang] of MODE === 'control' ? [[390, 'es'], [320, 'es'], [1360, 'es']] : [[390, 'es'], [390, 'en'], [1360, 'es'], [1360, 'en'], [320, 'es']]) {
    const tag = `${width}px ${lang}`; const l = L[lang];
    const { context, page } = await open(width, lang);
    try {
      await page.getByRole('button', { name: l.newPlan }).click(); await page.waitForTimeout(300);
      const slug = slugInput(page); const price = priceInput(page);
      // U1 atributos y filtro del identificador
      const attrs = { slugMax: await slug.getAttribute('maxlength'), priceMin: await price.getAttribute('min'), priceMax: await price.getAttribute('max'), priceStep: await price.getAttribute('step') };
      await slug.fill(''); await slug.pressSequentially('ABC def_ñ!x', { delay: 5 }); const typed = await slug.inputValue();
      await slug.fill(''); await slug.pressSequentially('abcdefghijklmnopqrstuvwxyz0123', { delay: 2 }); const long = await slug.inputValue();
      rec(`U1 identificador y precio: atributos y filtro (${tag}) [${MODE}]`, MODE === 'control' ? true : (attrs.slugMax === '20' && attrs.priceMax === '99999999.99' && attrs.priceMin === '0' && typed === 'abc-defx' && long.length === 20), `maxlength ${attrs.slugMax}; precio min ${attrs.priceMin} max ${attrs.priceMax} step ${attrs.priceStep}; «ABC def_ñ!x» → «${typed}»; 30 letras → ${long.length} caracteres`);
      // U2 crear un plan válido
      const mine = 'qa' + crypto.randomBytes(3).toString('hex') + lang + width; await slug.fill(''); await slug.pressSequentially(mine, { delay: 2 });
      const ins = page.locator('div[style*="position: fixed"] input[type="text"], div[style*="position: fixed"] input:not([type])'); const n = await ins.count();
      // nombres: los dos primeros campos de texto tras el identificador
      await ins.nth(1).fill('Plan de prueba'); await ins.nth(2).fill('Test plan'); await price.fill('12.5');
      const resp = wr(page, (r) => r.url().includes('/api/admin/pricing') && r.request().method() === 'POST'); await page.getByRole('button', { name: l.save }).click(); const st = (await resp).status(); await page.waitForTimeout(600);
      const row = await planRow(mine.slice(0, 20));
      rec(`U2 crear un plan válido desde la pantalla (${tag}) [${MODE}]`, st === 201 && !!row && Number(row.price) === 12.5, `estado ${st}; fila guardada: ${JSON.stringify(row)}`);
      // axe y reflow del formulario (se reabre)
      await page.getByRole('button', { name: l.newPlan }).click(); await page.waitForTimeout(300);
      const viol = await axe(page); const flow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
      if (width !== 320) await page.screenshot({ path: path.join(OUT, `ES-278-${MODE}-form-${width}-${lang}.png`) });
      rec(`U3 formulario abierto: axe y sin desborde (${tag}) [${MODE}]`, viol.length === 0 && flow, `axe ${JSON.stringify(viol)}; sin desborde ${flow}`);
      await page.getByRole('button', { name: l.cancel }).first().click(); await page.waitForTimeout(200);
    } catch (e) { rec(`U1-U3 (${tag}) [${MODE}]`, false, 'excepción: ' + e.message.split('\n')[0] + ' | ' + (await formText(page)).slice(0, 200).replace(/\s+/g, ' ')); }
    await context.close();
  }

  // U4–U8 (solo cabeza y control en 1360 es/en)
  for (const lang of MODE === 'control' ? ['es'] : ['es', 'en']) {
    const l = L[lang]; const { context, page } = await open(1360, lang);
    try {
      // U4 precio fuera de rango: el servidor responde 400 y la pantalla conserva lo escrito y muestra el motivo
      await page.getByRole('button', { name: l.newPlan }).click(); await page.waitForTimeout(300);
      const ins = page.locator('div[style*="position: fixed"] input[type="text"], div[style*="position: fixed"] input:not([type])');
      const s = 'rng' + crypto.randomBytes(2).toString('hex'); await slugInput(page).fill(s); await ins.nth(1).fill('Fuera de rango'); await ins.nth(2).fill('Out of range'); await priceInput(page).fill('100000000');
      const r1 = wr(page, (r) => r.url().includes('/api/admin/pricing') && r.request().method() === 'POST'); await page.getByRole('button', { name: l.save }).click(); const st1 = (await r1).status(); await page.waitForTimeout(500);
      const txt1 = (await formText(page)).replace(/\s+/g, ' '); const kept = (await slugInput(page).inputValue()) === s && (await priceInput(page).inputValue()) === '100000000';
      rec(`U4 precio 100 000 000: 400 del servidor, la pantalla muestra el motivo y conserva lo escrito (${lang}) [${MODE}]`, MODE === 'control' ? true : (st1 === 400 && kept && /precio|price/i.test(txt1)), `estado ${st1}; datos conservados ${kept}; texto visible: ${txt1.slice(-230)}`);
      // U5 identificador repetido
      await priceInput(page).fill('5'); await slugInput(page).fill('basic');
      const r2 = wr(page, (r) => r.url().includes('/api/admin/pricing') && r.request().method() === 'POST'); await page.getByRole('button', { name: l.save }).click(); const st2 = (await r2).status(); await page.waitForTimeout(500);
      const txt2 = (await formText(page)).replace(/\s+/g, ' ');
      rec(`U5 identificador repetido: 409 y mensaje claro, formulario abierto (${lang}) [${MODE}]`, MODE === 'control' ? true : (st2 === 409 && /ya existe|already exists/i.test(txt2)), `estado ${st2}; texto: ${txt2.slice(-200)}`);
      await page.getByRole('button', { name: l.cancel }).first().click(); await page.waitForTimeout(200);
      // U6 guardar cada plan de la semilla sin tocarlo
      const edits = page.getByRole('button', { name: l.edit }); const count = await edits.count(); const bad = [];
      for (let i = 0; i < Math.min(count, 5); i += 1) { await edits.nth(i).click(); await page.waitForTimeout(250); const r = wr(page, (x) => /\/api\/admin\/pricing\/\d+/.test(x.url()) && x.request().method() === 'PUT'); await page.getByRole('button', { name: l.save }).click(); const st = (await r).status(); if (st !== 200) bad.push(`#${i}: ${st}`); await page.waitForTimeout(500); }
      rec(`U6 abrir y guardar sin cambios cada plan (los ${Math.min(count, 5)} primeros, incluida la semilla) → 200 (${lang}) [${MODE}]`, bad.length === 0, `${count} botones «Editar»; ${bad.join(' | ') || 'todos 200'}`);
      // U7 plan heredado: ¿se puede cambiar el precio? ¿se puede corregir el identificador desde la pantalla?
      const legacyRow = page.locator('div').filter({ hasText: /Heredado QA|Legacy QA/ }).last(); await legacyRow.getByRole('button', { name: l.edit }).first().click().catch(async () => { await page.getByRole('button', { name: l.edit }).last().click(); }); await page.waitForTimeout(300);
      await priceInput(page).fill('6'); const r3 = wr(page, (x) => /\/api\/admin\/pricing\/\d+/.test(x.url()) && x.request().method() === 'PUT'); await page.getByRole('button', { name: l.save }).click(); const st3 = (await r3).status(); await page.waitForTimeout(500);
      const txt3 = (await formText(page)).replace(/\s+/g, ' ');
      info(`U7 plan heredado «plan_heredado» (identificador con guion bajo, válido antes): cambiar solo el precio (${lang}) [${MODE}]`, `estado ${st3}; ${st3 === 200 ? 'guardó' : 'texto visible: ' + txt3.slice(-210)}`);
      if (st3 === 400) { await slugInput(page).fill('plan-heredado'); const r4 = wr(page, (x) => /\/api\/admin\/pricing\/\d+/.test(x.url()) && x.request().method() === 'PUT'); await page.getByRole('button', { name: l.save }).click(); const st4 = (await r4).status(); info(`U7b tras corregir el identificador desde la pantalla (${lang})`, `estado ${st4} (la persona administradora PUEDE corregirlo en el mismo formulario: ${st4 === 200})`); }
    } catch (e) { rec(`U4-U7 (${lang}) [${MODE}]`, false, 'excepción: ' + e.message.split('\n')[0] + ' | ' + (await formText(page)).slice(0, 200).replace(/\s+/g, ' ')); }
    await context.close();
  }
  rec(`sin errores de consola ni de página [${MODE}]`, errors.length === 0, errors.slice(0, 4).join(' | ') || 'ninguno');
  fs.writeFileSync(path.join(OUT, `ES-278-ui-${MODE}.json`), JSON.stringify(results, null, 1));
  console.log('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.filter((r) => 'ok' in r).length);
  await browser.close(); await db.end(); process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
