const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ headless: true });
  const release = process.env.ES16_RELEASE_URL || 'http://127.0.0.1:4216';
  const preview = process.env.ES16_PREVIEW_URL || 'http://127.0.0.1:4217';
  for (const url of [release, preview]) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
  let count = 0; const check = label => { count++; console.log('PASS ' + label); };
  async function create() {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const requests = []; const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('elevation_token', 'synthetic-session'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es');
      window.__copies = []; window.__copyFails = false;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { if (window.__copyFails) throw new Error('Synthetic denial'); window.__copies.push(text); } } });
    });
    await page.route('**/api/**', async route => { requests.push({ method: route.request().method(), body: route.request().postData() }); await route.fulfill({ json: [] }); });
    return { page, requests, errors };
  }
  try {
    {
      const { page, requests, errors } = await create();
      await page.goto(release + '/app/exercises'); await page.getByText('Los ejercicios aún no están disponibles.', { exact: true }).waitFor();
      assert.equal(await page.locator('textarea').count(), 0); assert.equal(await page.getByRole('button', { name: 'Elegir', exact: true }).count(), 0);
      await page.goto(release + '/app/chat'); await page.getByText('Asistente de IA', { exact: true }).waitFor(); assert.equal(await page.getByText('Asistente de IA', { exact: true }).count(), 1, 'la identificación de IA aparece una sola vez en el chat');
      assert.equal(await page.getByRole('link', { name: 'Ejercicios opcionales', exact: true }).count(), 0);
      assert.ok(requests.every(request => request.method === 'GET')); assert.deepEqual(errors, []);
      check('default release hides links and direct exercise content, while chat identifies AI'); await page.close();
    }
    {
      const { page, requests, errors } = await create();
      await page.goto(preview + '/app/chat'); assert.equal(await page.getByRole('link', { name: 'Ejercicios opcionales', exact: true }).count(), 1, 'un solo enlace a los ejercicios');
      await page.getByRole('link', { name: 'Ejercicios opcionales', exact: true }).click();
      await page.waitForURL('**/app/exercises?from=chat'); await page.getByText('Contenido en revisión. No habilitado para el piloto.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Elegir', exact: true }).count(), 3);
      await page.getByRole('button', { name: 'Omitir', exact: true }).click(); await page.waitForURL('**/app/chat'); assert.ok(requests.every(request => request.method === 'GET'));
      check('opt-in review build has three cards; entry and skipping return to chat without writes');
      await page.goto(preview + '/app/exercises'); await page.getByRole('button', { name: 'Elegir', exact: true }).first().click();
      assert.equal(await page.locator('h3').count(), 1); assert.equal(await page.locator('textarea').inputValue(), '');
      const note = 'PRIVATE_ES16_SYNTHETIC <script>not executed</script>';
      await page.getByLabel('Notas opcionales', { exact: true }).fill(note);
      const countBefore = requests.length; assert.deepEqual(await page.evaluate(() => window.__copies), []);
      await page.getByRole('button', { name: 'EN', exact: true }).click(); assert.equal(await page.getByLabel('Optional notes', { exact: true }).inputValue(), note); assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      assert.ok(!(await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href)).includes('PRIVATE_ES16_SYNTHETIC'));
      assert.equal(requests.length, countBefore); assert.ok(requests.every(request => !String(request.body).includes('PRIVATE_ES16_SYNTHETIC')));
      await page.getByRole('button', { name: 'Copy my notes', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Copied to clipboard' }).waitFor();
      assert.deepEqual(await page.evaluate(() => window.__copies), [note]);
      await page.evaluate(() => { window.__copyFails = true; }); await page.getByRole('button', { name: 'Copy my notes', exact: true }).click();
      await page.getByRole('alert').waitFor(); assert.equal(await page.getByLabel('Optional notes', { exact: true }).inputValue(), note);
      check('one question, original notes survive language switch; notes stay off network/storage and clipboard is explicit with handled failure');
      await page.getByRole('button', { name: 'Close exercise', exact: true }).click(); await page.getByRole('dialog').waitFor();
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Back to exercise');
      await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0); assert.equal(await page.getByLabel('Optional notes', { exact: true }).inputValue(), note);
      await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.getByRole('dialog').waitFor();
      await page.getByRole('dialog').getByRole('button', { name: 'Back to exercise', exact: true }).click();
      await page.getByRole('button', { name: 'Close exercise', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Close without saving', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'We can stop here. You can return whenever you want.' }).waitFor(); assert.equal(await page.locator('textarea').count(), 0);
      check('close/back ask before losing notes; Escape and cancel preserve them; explicit discard clears them without penalty');
      await page.getByRole('button', { name: 'ES', exact: true }).click();
      for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Elegir', exact: true }).nth(i).click(); assert.equal(await page.locator('h3').count(), 1); await page.getByRole('button', { name: 'Cerrar ejercicio', exact: true }).click(); }
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'selector width ' + width);
        if (process.env.ES16_SCREENSHOT_DIR) { fs.mkdirSync(process.env.ES16_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.ES16_SCREENSHOT_DIR, `exercises-${width}.png`), fullPage: true }); }
      }
      await page.setViewportSize({ width: 375, height: 1000 }); await page.getByRole('button', { name: 'Elegir', exact: true }).first().click(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (process.env.ES16_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.ES16_SCREENSHOT_DIR, 'exercise-note-375.png'), fullPage: true });
      await page.emulateMedia({ reducedMotion: 'reduce' }); await page.evaluate(() => { document.documentElement.style.zoom = '2'; }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.evaluate(() => { document.documentElement.style.zoom = ''; });
      check('all three exercises work individually; selector/note responsive at 320/375/768/1440, 200% zoom and reduced motion');
      await page.getByLabel('Notas opcionales', { exact: true }).fill(note);
      const canceledBack = new Promise(resolve => page.once('dialog', async dialog => { await dialog.dismiss(); resolve(); })); await page.evaluate(() => history.back()); await canceledBack; assert.ok(page.url().endsWith('/app/exercises')); assert.equal(await page.getByLabel('Notas opcionales', { exact: true }).inputValue(), note);
      await page.evaluate(() => { localStorage.setItem('elevation_token', 'synthetic-other-session'); window.dispatchEvent(new Event('storage')); });
      await page.getByRole('button', { name: 'Elegir', exact: true }).first().waitFor(); assert.equal(await page.locator('textarea').count(), 0);
      assert.deepEqual(errors, []); check('canceled browser Back keeps notes; session change drops them and produces no follow-up requests'); await page.close();
    }
    {
      const { page } = await create(); await page.goto(preview + '/app/exercises'); await page.getByRole('button', { name: 'Elegir', exact: true }).first().waitFor(); await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.className), 'exercise-skip'); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'exercise-main');
      check('initial keyboard order reaches skip link and main'); await page.close();
    }
    console.log(`ES-16 browser: ${count} checks passed. Real built React/Chromium; chat GET responses and Clipboard API are simulated, no real OS clipboard or model calls.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
