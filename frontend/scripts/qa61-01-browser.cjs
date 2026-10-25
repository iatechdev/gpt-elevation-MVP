// Optional browser regression check. Use isolated built previews and synthetic fixtures only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const beforeUrl = process.env.BEFORE_URL || 'http://127.0.0.1:4201';
const afterUrl = process.env.AFTER_URL || 'http://127.0.0.1:4202';
const output = process.env.EVIDENCE_DIR || path.resolve(__dirname, '../../docs/landing/evidence/QA-61-01');
const manifest = [{ id: 1, version: 'v1', isActive: true, note: 'Synthetic fixture',
  content: 'Synthetic manifesto for regression testing only. '.repeat(3),
  createdAt: '2026-10-20T12:00:00.000Z', uploader: { id: 1, name: 'Synthetic', email: 'synthetic@example.invalid' } }];
function fixture(url) {
  if (url.pathname === '/api/board/manifest') return manifest;
  if (url.pathname === '/api/messages') return [{ role: 'user', text: 'Synthetic saved message' }];
  if (url.pathname === '/api/user/progress') return { moodLogs: [] };
  if (url.pathname === '/api/user/plan/me') return { plan: null, limits: null };
  if (url.pathname === '/api/sessions/user/upcoming') return { session: null };
  if (url.pathname === '/api/sessions/user/my-therapist') return { therapist: null };
  return [];
}
async function snapshot(page) {
  return page.evaluate(() => ({ text: document.body.innerText, elements: [...document.querySelectorAll('body *')]
    .filter(el => !['SCRIPT', 'STYLE'].includes(el.tagName)).map(el => {
      const s = getComputedStyle(el), rect = el.getBoundingClientRect();
      return [el.tagName, s.color, s.backgroundColor, s.fontFamily, s.fontSize, s.fontWeight,
        s.padding, s.borderRadius, s.display, rect.x, rect.y, rect.width, rect.height];
    }) }));
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [route, role] of [['/app/dashboard', 'user'], ['/board/manifest', 'board']]) {
      for (const width of [390, 1280]) {
        let before;
        for (const [label, base] of [['before', beforeUrl], ['after', afterUrl]]) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'es-CO', timezoneId: 'America/Bogota', colorScheme: 'light', reducedMotion: 'reduce' });
          await context.addInitScript(role => {
            localStorage.setItem('elevation_token', 'synthetic-fixture');
            localStorage.setItem('elevation_role', role);
            localStorage.setItem('elevation_name', 'Synthetic');
            localStorage.setItem('elv_lang', 'es');
            localStorage.setItem('elevation_checkin_date', new Date().toDateString());
          }, role);
          await context.route('https://**/*', r => r.abort());
          const requests = [], errors = [];
          await context.route('**/api/**', r => {
            const request = r.request(), url = new URL(request.url());
            requests.push(request.method() + ' ' + url.pathname + url.search);
            if (request.method() === 'POST' && url.pathname === '/api/board/manifest') return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic API error' }) });
            return r.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture(url)) });
          });
          const page = await context.newPage();
          page.on('pageerror', e => errors.push(e.message));
          await page.goto(base + route, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          assert.ok((await page.locator('body').innerText()).trim());
          if (role === 'user') await page.getByText('Synthetic saved message', { exact: true }).waitFor();
          else await page.getByText('Synthetic fixture', { exact: true }).first().waitFor();
          const initial = await snapshot(page);
          await page.screenshot({ path: path.join(output, `${role}-${width}-${label}.png`), fullPage: true });
          const requestsBeforeEdit = requests.length;
          if (role === 'user') {
            await page.locator('textarea').fill('Synthetic unsent draft');
          } else {
            await page.getByRole('button', { name: '+ Nueva versión', exact: true }).click();
            await page.locator('textarea').fill('Synthetic unsaved manifesto draft. '.repeat(3));
          }
          await page.waitForLoadState('networkidle');
          assert.equal(requests.length, requestsBeforeEdit, 'Editing caused an extra request');
          if (role === 'user') {
            await page.getByRole('button', { name: 'EN', exact: true }).click();
            await page.waitForLoadState('networkidle');
            assert.equal(requests.length, requestsBeforeEdit, 'Language change refetched data');
          }
          assert.equal(await page.locator('textarea').inputValue(), role === 'user' ? 'Synthetic unsent draft' : 'Synthetic unsaved manifesto draft. '.repeat(3));
          if (role === 'user') await page.getByText('Synthetic saved message', { exact: true }).waitFor();
          if (role === 'board') {
            await page.getByRole('button', { name: 'Publicar y activar', exact: true }).click();
            await page.getByText('Synthetic API error', { exact: true }).waitFor();
            assert.equal(await page.locator('textarea').inputValue(), 'Synthetic unsaved manifesto draft. '.repeat(3));
            assert.equal(requests.length, requestsBeforeEdit + 1);
          }
          assert.deepEqual(errors, []);
          const current = { initial, requests };
          if (label === 'before') before = current;
          else assert.deepEqual(current, before, `Visual or request regression: ${route} ${width}`);
          await context.close();
        }
        console.log(`PASS ${route} ${width}px: text, geometry and styles equal; requests equal; draft preserved; user language change or board API error verified.`);
      }
    }
    console.log('PASS: fixtures and HTTP mocked; no real authentication, database or external provider.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
