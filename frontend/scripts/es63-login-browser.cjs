const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.TEST_URL || 'http://127.0.0.1:4233';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const locale of ['es-CO', 'en-US']) for (const [role, onboarding] of [
      [null, null], ['user', null], ['user', 'done'], ['admin', null],
      ['superadmin', null], ['therapist', null], ['board', null],
    ]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale });
      await context.addInitScript(({ role, onboarding }) => {
        if (role) {
          localStorage.setItem('elevation_token', 'synthetic-session');
          localStorage.setItem('elevation_role', role);
        }
        if (onboarding) localStorage.setItem('elevation_onboarding', onboarding);
      }, { role, onboarding });
      await context.route('https://**/*', route => route.abort());
      await context.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (let index = 0; index < 2; index++) {
        await page.goto(base, { waitUntil: 'networkidle' });
        const doors = page.locator('a.landing-door');
        assert.equal(await doors.count(), 2);
        for (const door of await doors.all()) {
          assert.equal(await door.getAttribute('href'), '/login');
          assert.equal(await door.locator('a,button,input,select,textarea').count(), 0);
        }
        await doors.nth(index).focus();
        await page.keyboard.press('Enter');
        await page.waitForURL('**/login');
        assert.equal(new URL(page.url()).pathname, '/login');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${locale} ${role ?? 'visitor'} ${onboarding ?? 'unset'}: both doors reach /login via keyboard.`);
      await context.close();
    }
    console.log('PASS 14 session/language cases, 28 door navigations. Synthetic sessions and API mocks; no real authentication or DB.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
