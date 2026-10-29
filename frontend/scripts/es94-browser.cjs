// ES-94: la landing explica cada ruta y Elevation no lleva etiqueta de estado; el administrador ya no muestra el panel de pendientes. Red simulada.
const assert = require('node:assert/strict');
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ headless: true });
  const base = process.env.ES94_URL || 'http://127.0.0.1:4394';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  const check = label => console.log('PASS ' + label);
  const ROUTES = { es: ['Un rol del mismo contexto del que vienes.', 'Un rol de otro contexto que comparte contigo al menos una capacidad esencial', 'Un rol ligado a tus intereses'],
    en: ['A role in the same context you already work in.', 'A role in a different context that shares at least one essential capability', 'A role linked to your interests'] };
  async function landing(lang, viewport) {
    const page = await browser.newPage({ viewport }); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(l => localStorage.setItem('elv_lang', l), lang);
    await page.route('**/api/**', r => r.fulfill({ status: 404, json: {} }));
    await page.goto(base + '/'); await page.waitForSelector('#skill-map');
    return { page, errors };
  }
  try {
    for (const [lang, viewport] of [['es', { width: 1280, height: 900 }], ['en', { width: 375, height: 800 }]]) {
      const { page, errors } = await landing(lang, viewport);
      const text = await page.evaluate(() => document.body.textContent);
      for (const piece of ROUTES[lang]) assert.ok(text.includes(piece), `${lang}: ${piece}`);
      assert.ok(!/catálogo esté verificado|catalog is verified/.test(text)); assert.ok(!/\[[^\]]*\]/.test(text), 'sin corchetes');
      assert.ok(text.includes(lang === 'es' ? 'Tú decides cuál aceptar y puedes rechazar cualquiera.' : 'You decide which to accept, and you can reject any of them.'));
      const chips = await page.evaluate(() => [...document.querySelectorAll('.landing-module-status')].map(e => e.textContent.trim()));
      assert.deepEqual(chips, [lang === 'es' ? 'Próximamente' : 'Coming soon'], 'solo Skill Map lleva etiqueta');
      const elevationCard = await page.evaluate(() => [...document.querySelectorAll('.landing-module')].find(c => /Elevation/.test(c.querySelector('h3').textContent)).querySelector('.landing-module-status'));
      assert.equal(elevationCard, null, 'la tarjeta de Elevation no tiene etiqueta');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sin scroll horizontal');
      check(`${lang} ${viewport.width}px: las tres rutas explicadas, sin «se mostrarán…», sin corchetes, solo Skill Map con etiqueta y sin desbordes`);
      assert.deepEqual(errors, []); await page.close();
    }
    { // Administrador: sin panel de pendientes
      const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
      await page.addInitScript(() => { localStorage.setItem('elevation_token', 's'); localStorage.setItem('elevation_role', 'superadmin'); localStorage.setItem('elv_lang', 'es'); });
      await page.route('**/api/**', r => r.fulfill({ json: r.request().url().includes('landing-content') ? { hero_title: 'x' } : [] }));
      await page.goto(base + '/admin/content'); await page.getByRole('button', { name: '🌐 Landing' }).click(); await page.getByText('Título Hero', { exact: true }).waitFor();
      assert.equal(await page.getByRole('region', { name: 'Pendientes de contenido' }).count(), 0);
      check('administrador: sin panel de pendientes y la pestaña Landing sigue funcionando'); await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
