const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const port = 43185;
  process.env.VITE_BACKEND_URL = `http://127.0.0.1:${port}`;
  const { createServer } = await import('vite');
  let failPlans = true;
  let failContent = true;
  let failDeactivate = true;
  let denyContent = true;
  const writes = [];
  const plan = { id: 1, slug: 'fixture', name_es: 'Plan ficticio', name_en: 'Fixture plan', description_es: '', description_en: '', price: 10, currency: 'USD', period: 'month', features_es: [], features_en: [], isHighlighted: false, isActive: true, order: 0 };
  const server = await createServer({ server: { host: '127.0.0.1', port, strictPort: true }, plugins: [{
    name: 'es185-fixtures',
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
        if (url.pathname === '/api/session') return json(200, { role: 'superadmin', onboardingCompleted: true });
        if (url.pathname === '/api/junta/pending') return json(200, []);
        if (url.pathname === '/api/admin/pricing/all') return failPlans ? json(503, {}) : json(200, [plan]);
        if (url.pathname === '/api/landing-content/admin') return failContent ? json(503, {}) : json(200, { hero_title: 'Fixture title' });
        if (req.method !== 'GET') {
          let body = ''; for await (const chunk of req) body += chunk;
          writes.push({ path: url.pathname, method: req.method, body: body && JSON.parse(body) });
          if (req.method === 'DELETE' && failDeactivate) return json(500, {});
          if (url.pathname === '/api/landing-content' && denyContent) return json(403, {});
          return json(200, {});
        }
        return json(200, {});
      });
    },
  }] });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
    await page.addInitScript(() => { localStorage.setItem('elevation_token', 'synthetic'); if (!localStorage.getItem('elv_lang')) localStorage.setItem('elv_lang', 'es'); });
    await page.goto(`http://127.0.0.1:${port}/admin/content`);
    await page.getByRole('button', { name: 'Planes', exact: true }).click();
    await page.getByText('No se pudieron cargar los planes.', { exact: true }).waitFor();
    assert.equal(await page.getByText('No hay planes. Crea el primero.').count(), 0);
    failPlans = false; await page.getByRole('button', { name: 'Reintentar' }).click();
    await page.getByText('Plan ficticio').waitFor();
    await page.getByRole('button', { name: '+ Nuevo plan' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Slug * (sin espacios, ej: basic, essential, plus, pro)').fill('test');
    await dialog.getByLabel('Español *').fill('Prueba');
    await dialog.getByLabel('Inglés *').fill('Test');
    await dialog.getByRole('button', { name: 'Crear plan' }).click();
    await dialog.getByText('Introduce un precio válido.').waitFor();
    assert.equal(writes.length, 0);
    await dialog.getByLabel('Precio', { exact: true }).fill('15');
    await dialog.getByRole('button', { name: 'Crear plan' }).click();
    await page.getByText('Plan creado.').waitFor();
    assert.equal(writes.at(-1).body.price, '15');
    await page.getByRole('button', { name: 'Editar' }).click();
    assert.equal(await dialog.getByLabel('Slug * (sin espacios, ej: basic, essential, plus, pro)').evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Editar' }).evaluate(element => element === document.activeElement), true);
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'Desactivar' }).click();
    await page.getByText('No se pudo desactivar el plan.').waitFor();
    failDeactivate = false; page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'Desactivar' }).click();
    await page.getByText('Plan desactivado.').waitFor();
    await page.getByRole('button', { name: 'Textos públicos', exact: true }).click();
    await page.getByText('No se pudo cargar el contenido.', { exact: true }).waitFor();
    failContent = false; await page.getByRole('button', { name: 'Reintentar' }).click();
    const hero = page.getByLabel('Título Hero', { exact: true });
    await hero.fill('Texto ficticio');
    await hero.locator('..').getByRole('button', { name: 'Guardar' }).click();
    await page.getByText('Solo superadmin puede guardar textos.', { exact: true }).waitFor();
    assert.equal(await hero.inputValue(), 'Texto ficticio');
    denyContent = false;
    await hero.locator('..').getByRole('button', { name: 'Guardar' }).click();
    await page.getByText('✓ Guardado', { exact: true }).waitFor();
    await hero.fill('Nuevo borrador');
    assert.equal(await page.getByText('✓ Guardado', { exact: true }).count(), 0);
    assert.equal(writes.at(-1).body.value, 'Texto ficticio');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => localStorage.setItem('elv_lang', 'en'));
    await page.reload();
    await page.getByRole('button', { name: 'Plans', exact: true }).click();
    await page.getByRole('button', { name: '+ New plan', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Public texts', exact: true }).click();
    await page.getByLabel('Hero title', { exact: true }).waitFor();
    console.log('ES-185 browser: load failures, retry, price validation, deactivation failure/success, text save and stale status passed.');
  } finally { if (browser) await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
