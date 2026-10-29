const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ headless: true });
  const base = process.env.ES26_PREVIEW_URL || 'http://127.0.0.1:4226';
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  let count = 0;
  const check = label => { console.log('PASS ' + label); count++; };
  const field = { key: 'interests', text: 'Synthetic server-normalized career text' };
  const version = (n = 1, status = 'active') => ({ version: n, status, approvedAt: '2026-10-27T12:00:00Z', revokedAt: status === 'revoked' ? '2026-10-27T13:00:00Z' : null, fields: [field], ...(status === 'active' ? { needsReview: false } : {}) });
  async function setup(options = {}) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { localStorage.setItem('elevation_token', 'synthetic-session'); localStorage.setItem('elv_lang', 'es'); });
    const calls = []; let state = options.state || { active: null, versions: [] }; let mutated = false;
    await page.route('**/api/career-context**', async route => {
      const request = route.request(); const endpoint = new URL(request.url()).pathname; const method = request.method();
      const body = request.postDataJSON(); calls.push({ endpoint, method, body });
      if (method === 'GET') return route.fulfill({ status: options.loadError || (options.readbackError && mutated) ? 503 : 200, json: state });
      if (endpoint.endsWith('/preview')) return route.fulfill({ status: options.sessionExpired ? 401 : options.previewError ? 422 : 200, json: options.previewError ? { code: 'field_not_shareable', fieldIndex: 0, error: 'PRIVATE_REASON' } : { token: 'opaque-test-preview', expiresAt: new Date(Date.now() + (options.expired ? -1000 : 600000)).toISOString(), representation: [field] } });
      if (endpoint.endsWith('/confirm')) {
        mutated = true; const record = version(); state = options.concurrent ? { active: version(2), versions: [version(2), version(1, 'superseded')] } : { active: record, versions: [record] };
        if (options.lostConfirm) return route.abort('failed');
        return route.fulfill({ status: 201, json: record });
      }
      if (endpoint.endsWith('/revoke')) {
        state = { active: null, versions: [version(1, 'revoked')] };
        if (options.lostRevoke) return route.abort('failed');
        return route.fulfill({ json: { revoked: true } });
      }
      throw new Error('Unexpected endpoint');
    });
    await page.goto(base + '/app/compass');
    await page.getByRole('heading', { name: 'Brújula profesional', exact: true }).waitFor();
    if (!options.loadError) await page.getByRole('heading', { name: 'Nuevo contexto directo', exact: true }).waitFor();
    return { page, calls, errors };
  }
  async function fill(page) {
    await page.getByLabel('Selecciona una categoría', { exact: true }).selectOption('interests');
    await page.getByLabel('Texto que quiero autorizar', { exact: true }).fill('Synthetic raw career text');
    await page.getByLabel('Incluir en la autorización', { exact: true }).check();
  }
  const preview = page => page.getByRole('button', { name: 'Ver exactamente qué autorizo', exact: true }).click();
  try {
    {
      const { page, calls, errors } = await setup();
      assert.equal(await page.getByLabel('Incluir en la autorización', { exact: true }).isChecked(), false);
      await preview(page); await page.getByRole('alert').waitFor(); assert.equal(calls.filter(x => x.method === 'POST').length, 0);
      await fill(page); await preview(page); await page.getByRole('heading', { name: 'Ver exactamente qué autorizo', exact: true }).waitFor();
      assert.ok(await page.getByText(field.text, { exact: true }).isVisible());
      assert.ok(await page.getByRole('button', { name: 'Confirmar autorización', exact: true }).isDisabled());
      await page.getByRole('button', { name: 'Seguir editando' }).click();
      await page.getByLabel('Texto que quiero autorizar', { exact: true }).fill('Changed local text'); await preview(page);
      await page.getByLabel('He revisado estos campos y autorizo su uso profesional.', { exact: true }).check();
      await page.getByRole('button', { name: 'Confirmar autorización', exact: true }).click();
      await page.getByText('Autorización confirmada', { exact: true }).waitFor();
      assert.equal(calls.filter(x => x.endpoint.endsWith('/confirm')).length, 1);
      const confirm = calls.find(x => x.endpoint.endsWith('/confirm')).body;
      assert.equal(confirm.fields[0].text, 'Changed local text'); assert.deepEqual(confirm.fields[0].origin, { type: 'direct' });
      assert.ok(confirm.requestId.length >= 8); assert.deepEqual(errors, []);
      assert.equal(await page.getByLabel('Texto que quiero autorizar', { exact: true }).inputValue(), '');
      check('unchecked selection makes no write; exact server preview, edit invalidation, explicit confirmation and readback');
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow at ' + width);
        if (process.env.ES26_SCREENSHOT_DIR) { fs.mkdirSync(process.env.ES26_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.ES26_SCREENSHOT_DIR, 'compass-es-' + width + '.png'), fullPage: true }); }
      }
      await page.getByRole('button', { name: 'EN', exact: true }).click(); assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      await page.getByRole('heading', { name: 'Career compass', exact: true }).waitFor();
      await page.emulateMedia({ reducedMotion: 'reduce' }); await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.evaluate(() => { document.documentElement.style.zoom = ''; });
      await page.reload(); await page.getByRole('heading', { name: 'Nuevo contexto directo', exact: true }).waitFor(); await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.className), 'compass-skip');
      await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'compass-main');
      check('ES/EN, 320/375/768/1440, 200% zoom, reduced motion, keyboard skip/focus and screenshots'); await page.close();
    }
    {
      const { page, calls } = await setup(); await page.getByRole('button', { name: 'Continuar sin transferir', exact: true }).click(); await page.waitForURL('**/app/dashboard');
      assert.equal(calls.filter(x => x.method === 'POST').length, 0); check('continue without transferring sends no preview or write'); await page.close();
    }
    {
      const { page, calls } = await setup({ loadError: true }); await page.getByText('No pudimos cargar tu contexto.', { exact: true }).waitFor();
      assert.equal(await page.locator('textarea').count(), 0); assert.equal(calls.filter(x => x.method === 'POST').length, 0); check('failed initial read does not become empty state or enable writes'); await page.close();
    }
    for (const options of [{ expired: true }, { previewError: true }]) {
      const { page, calls } = await setup(options); await fill(page); await preview(page);
      if (options.expired) { await page.getByRole('button', { name: 'Renovar vista previa', exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Confirmar autorización', exact: true }).count(), 0); }
      else { await page.getByText('Este texto no se puede compartir. Reescríbelo o déjalo fuera.', { exact: true }).waitFor(); assert.ok(!(await page.textContent('body')).includes('PRIVATE_REASON')); }
      assert.equal(calls.filter(x => x.endpoint.endsWith('/confirm')).length, 0); check(options.expired ? 'expired preview cannot confirm' : '422 highlights selected field without leaking private reasons'); await page.close();
    }
    {
      const { page, calls } = await setup({ lostConfirm: true }); await fill(page); await preview(page); await page.getByLabel('He revisado estos campos y autorizo su uso profesional.', { exact: true }).check(); await page.getByRole('button', { name: 'Confirmar autorización', exact: true }).click();
      await page.getByText('No pudimos verificar esta confirmación. Revisa el contexto vigente antes de crear otra versión.', { exact: true }).waitFor();
      assert.equal(calls.filter(x => x.endpoint.endsWith('/confirm')).length, 1); assert.ok(await page.getByText(field.text, { exact: true }).first().isVisible());
      assert.equal(await page.getByText('Autorización confirmada', { exact: true }).count(), 0); check('lost confirmation ACK reads actual state and never guesses success or repeats POST'); await page.close();
    }
    {
      const active = { ...version(), needsReview: true }; const old = version(2, 'superseded');
      const { page, calls } = await setup({ state: { active, versions: [old, active] }, lostRevoke: true });
      assert.equal(await page.getByLabel('Texto que quiero autorizar', { exact: true }).inputValue(), '');
      await page.getByText('Pendiente de revisar.', { exact: false }).waitFor();
      await page.getByRole('button', { name: 'Retirar contexto vigente', exact: true }).click();
      assert.ok(await page.getByRole('dialog').isVisible()); await page.keyboard.press('Escape'); assert.ok(!(await page.getByRole('dialog').isVisible()));
      await page.getByRole('button', { name: 'Retirar contexto vigente', exact: true }).click(); await page.getByRole('button', { name: 'Retirar contexto', exact: true }).click();
      await page.getByText('No pudimos verificar la retirada. Consulta el contexto vigente antes de decidir otra acción.', { exact: true }).waitFor();
      assert.equal(calls.filter(x => x.endpoint.endsWith('/revoke')).length, 1); assert.equal(await page.getByRole('button', { name: 'Retirar contexto vigente', exact: true }).count(), 0);
      await page.getByText('Ver historial', { exact: false }).click(); await page.getByRole('heading', { name: 'Versión 1 · Retirada', exact: true }).waitFor();
      check('saved contexts are not prefilled; source-change warning, dialog Escape, lost withdrawal reads only, revoked history'); await page.close();
    }
    {
      const { page } = await setup(); await fill(page); await page.evaluate(() => { localStorage.setItem('elevation_token', 'changed-session'); window.dispatchEvent(new Event('storage')); });
      await page.getByLabel('Texto que quiero autorizar', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Texto que quiero autorizar', { exact: true }).inputValue(), '');
      check('session change removes private local drafts and previous owner state'); await page.close();
    }
    {
      const active = version(); const { page } = await setup({ state: { active, versions: [active] }, sessionExpired: true }); await fill(page); await preview(page);
      await page.getByText('Tu sesión venció. Inicia sesión para continuar.', { exact: true }).waitFor();
      assert.equal(await page.locator('textarea').count(), 0); assert.equal(await page.getByText(field.text, { exact: true }).count(), 0);
      check('401 during editing clears private draft and previously loaded context'); await page.close();
    }
    for (const options of [{ readbackError: true }, { concurrent: true }]) {
      const { page, calls } = await setup(options); await fill(page); await preview(page); await page.getByLabel('He revisado estos campos y autorizo su uso profesional.', { exact: true }).check(); await page.getByRole('button', { name: 'Confirmar autorización', exact: true }).click();
      await page.getByText('No pudimos verificar esta confirmación. Revisa el contexto vigente antes de crear otra versión.', { exact: true }).waitFor();
      assert.equal(await page.getByText('Autorización confirmada', { exact: true }).count(), 0); assert.equal(calls.filter(x => x.endpoint.endsWith('/confirm')).length, 1);
      if (options.readbackError) assert.equal(await page.getByRole('button', { name: 'Ver exactamente qué autorizo', exact: true }).count(), 0);
      else assert.ok(await page.getByRole('region', { name: 'Contexto actual', exact: true }).getByText('Versión 2 · Activa', { exact: true }).isVisible());
      check(options.readbackError ? 'failed readback blocks new writes and preserves uncertainty' : 'concurrent replacement cannot be reported as the confirmed active version'); await page.close();
    }
    {
      const { page } = await setup(); await page.evaluate(() => { history.pushState({ ...history.state, idx: history.state.idx + 1 }, '', '/app/compass?draft=1'); }); await fill(page);
      page.once('dialog', prompt => prompt.dismiss()); await page.goBack();
      await page.waitForURL('**/app/compass?draft=1'); assert.equal(await page.getByLabel('Texto que quiero autorizar', { exact: true }).inputValue(), 'Synthetic raw career text');
      check('canceling browser Back preserves the local draft and route'); await page.close();
    }
    console.log(`ES-26 browser: ${count} checks passed. HTTP responses are contract mocks; browser and built React are real.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
