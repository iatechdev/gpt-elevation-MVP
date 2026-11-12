// [QA-Claude] ES-278 (PR #245) · teclado en el formulario de planes: Tab desde el identificador, flechas del campo de precio frente a min/max, y Esc. Servidor real en QA_BASE.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const BASE = process.env.QA_BASE || 'http://127.0.0.1:9245'; const S = 'C:/Users/Usuario/Documents/qa13';
const { createRequire } = require('module'); const req = createRequire('C:/Users/Usuario/Documents/qa-pr-221/backend/package.json');
const { Client } = req('pg'); const jwt = req('jsonwebtoken'); const SECRET = fs.readFileSync(S + '/jwt', 'utf8').trim();
const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
(async () => {
  const db = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/qa245' }); await db.connect();
  const id = (await db.query(`SELECT id FROM "Users" WHERE role='admin' ORDER BY id LIMIT 1`)).rows[0].id;
  const token = jwt.sign({ id, name: 'Admin QA', role: 'admin', iatMs: Date.now() }, SECRET, { expiresIn: '8h', jwtid: crypto.randomBytes(16).toString('hex') });
  const browser = await chromium.launch({ headless: true }); const out = [];
  for (const [width, lang, newPlan, tab] of [[390, 'es', /Nuevo plan/, /Precios/], [1360, 'en', /New plan/, /Pric/]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } }); const page = await ctx.newPage();
    await page.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', l); }, [token, lang]);
    await page.goto(BASE + '/admin/content', { waitUntil: 'networkidle' }); await page.getByRole('button', { name: tab }).first().click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: newPlan }).click(); await page.waitForTimeout(300);
    const slug = page.locator('input[placeholder="ej: basic"], input[placeholder="e.g. basic"]').first(); const price = page.locator('input[type="number"][step="0.01"]').first();
    await slug.focus(); await page.keyboard.type('Mi Plan_1!'); const typed = await slug.inputValue();
    await page.keyboard.press('Tab'); const next = await page.evaluate(() => document.activeElement.tagName + ' ' + (document.activeElement.placeholder || ''));
    await price.fill('99999999.99'); await price.focus(); await page.keyboard.press('ArrowUp'); const up = await price.inputValue();
    await price.fill('0'); await page.keyboard.press('ArrowDown'); const down = await price.inputValue();
    await price.fill('0.01'); await page.keyboard.press('ArrowDown'); const step = await price.inputValue();
    out.push(`${width}px ${lang}: «Mi Plan_1!» tecleado → «${typed}»; tras Tab el foco va a ${next}; ArrowUp en el máximo → ${up}; ArrowDown en 0 → ${down}; ArrowDown desde 0,01 → ${step}`);
    await ctx.close();
  }
  console.log(out.join('\n')); await browser.close(); await db.end();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
