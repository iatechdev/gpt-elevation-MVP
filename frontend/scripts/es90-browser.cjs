// ES-90: panel «Pendientes de contenido» del administrador y landing pública sin marcadores. Red simulada, sin datos reales.
const assert = require('node:assert/strict');
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ headless: true });
  const base = process.env.ES90_URL || 'http://127.0.0.1:4390';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  const check = label => console.log('PASS ' + label);
  const PENDING = {
    es: { 'landing.modules.elevation.status': 'En piloto', 'landing.skillmap.routes.continuity.pending': 'Las fuentes, fechas, barreras y brechas se mostrarán cuando el catálogo esté verificado.', 'landing.skillmap.routes.adjacent.pending': 'Las fuentes, fechas, barreras y brechas se mostrarán cuando el catálogo esté verificado.', 'landing.skillmap.routes.exploratory.pending': 'Las fuentes, fechas, barreras y brechas se mostrarán cuando el catálogo esté verificado.', 'landing.join.professional_pending': 'Próximamente: el alta de profesionales aún no está disponible.' },
    en: { 'landing.modules.elevation.status': 'In pilot', 'landing.skillmap.routes.continuity.pending': 'Sources, dates, barriers and gaps will be shown once the catalog is verified.', 'landing.skillmap.routes.adjacent.pending': 'Sources, dates, barriers and gaps will be shown once the catalog is verified.', 'landing.skillmap.routes.exploratory.pending': 'Sources, dates, barriers and gaps will be shown once the catalog is verified.', 'landing.join.professional_pending': 'Coming soon: professional sign-up is not available yet.' },
  };
  async function create(role, viewport = { width: 1100, height: 900 }) {
    const page = await browser.newPage({ viewport }); const puts = []; const errors = []; const saved = { es: {}, en: {} };
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(r => { localStorage.setItem('elevation_token', 'synthetic'); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', 'es'); }, role);
    await page.route('**/api/**', async route => {
      const req = route.request(); const url = new URL(req.url());
      if (url.pathname === '/api/landing-content' && req.method() === 'GET') { const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es'; return route.fulfill({ json: { ...PENDING[lang], ...saved[lang] } }); }
      if (url.pathname === '/api/landing-content' && req.method() === 'PUT') { const body = JSON.parse(req.postData() || '{}'); puts.push(body); saved[body.lang][body.key] = body.value; return route.fulfill({ json: { message: 'ok' } }); }
      return route.fulfill({ json: [] });
    });
    return { page, puts, errors };
  }
  try {
    { // Panel
      const { page, puts, errors } = await create('superadmin');
      await page.goto(base + '/admin/content'); await page.getByRole('button', { name: '🌐 Landing' }).click();
      const panel = page.getByRole('region', { name: 'Pendientes de contenido' }); await panel.waitFor();
      await page.getByText('4 pendientes · 0 listos (ES)', { exact: false }).waitFor();
      assert.equal(await panel.getByText('Pendiente', { exact: true }).count(), 4);
      for (const label of ['Estado de Elevation', 'Ruta de continuidad', 'Ruta adyacente', 'Ruta exploratoria']) assert.equal(await panel.getByLabel(label, { exact: true }).count(), 1, label);
      assert.ok(await page.getByText('Falta:', { exact: false }).count() >= 5);
      assert.ok((await page.content()).indexOf('Pendientes de contenido') < (await page.content()).indexOf('Título Hero'), 'el panel va antes de la lista general');
      assert.equal(await page.getByLabel('landing.modules.elevation.status', { exact: true }).count(), 0, 'sin campo duplicado en la lista general');
      check('panel primero, 4 tarjetas Pendiente con etiqueta, «Falta» y sin duplicados en la lista');
      const field = panel.getByLabel('Estado de Elevation', { exact: true }); await field.fill('Disponible en piloto cerrado');
      await panel.getByRole('button', { name: 'Guardar' }).first().click(); await panel.getByText('✓ Guardado').waitFor();
      assert.equal(puts.length, 1); assert.deepEqual(puts[0], { key: 'landing.modules.elevation.status', lang: 'es', value: 'Disponible en piloto cerrado' });
      check('guardar usa el PUT existente con clave, idioma y valor');
      await page.getByText('3 pendientes · 1 listos (ES)', { exact: false }).waitFor();
      assert.equal(await panel.getByText('Listo', { exact: true }).count(), 1);
      check('al reemplazar el texto pasa a Listo y el contador baja');
      await page.getByRole('main').getByRole('button', { name: 'EN', exact: true }).click(); await page.getByText('4 pendientes · 0 listos (EN)', { exact: false }).waitFor();
      assert.equal(await panel.getByLabel('Estado de Elevation', { exact: true }).inputValue(), 'In pilot');
      check('en EN el estado se calcula por idioma (sigue pendiente)');
      await page.keyboard.press('Tab'); assert.deepEqual(errors, []); await page.close();
    }
    { // Landing pública
      const { page, errors } = await create('user', { width: 1280, height: 900 });
      await page.goto(base + '/'); await page.waitForSelector('#skill-map');
      const text = await page.evaluate(() => document.body.textContent);
      assert.ok(!/\[[^\]]*\]/.test(text), 'sin corchetes: ' + (text.match(/\[[^\]]*\]/g) || []).join(' '));
      assert.ok(text.includes('En piloto') && text.includes('Las fuentes, fechas, barreras y brechas se mostrarán cuando el catálogo esté verificado.'));
      check('la landing pública no muestra ningún marcador y sí los textos provisionales'); assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
