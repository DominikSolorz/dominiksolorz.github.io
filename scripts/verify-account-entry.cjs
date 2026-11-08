// Run from the repository root with Playwright installed. All account requests
// are intercepted: this test never signs into or modifies a production account.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const user = {
  id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated',
  role: 'authenticated', email: 'test@example.invalid',
  email_confirmed_at: '2026-01-01T00:00:00Z', identities: [],
};
const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({
  sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600,
})).toString('base64url'), 'test'].join('.');

(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' }),
    headless: true, args: ['--no-sandbox'],
  });
  try {
    for (const query of ['?auth=login', '?panel=owner', '?panel=wlasciciel', '?auth=login&desktop=1']) {
      const page = await browser.newPage({ serviceWorkers: 'block' });
      const errors = [];
      let rejectPassword = true;
      page.on('pageerror', error => errors.push(error.message));
      if (query.includes('desktop=1')) {
        await page.addInitScript(() => { window.__HOME_SECURITY_DESKTOP__ = true; });
      }
      await page.route('https://dominiksolorz.github.io/kamera/**', route => {
        const relative = decodeURIComponent(new URL(route.request().url()).pathname.slice('/kamera/'.length)) || 'index.html';
        const file = path.join(root, 'kamera', relative);
        return fs.existsSync(file) ? route.fulfill({ path: file }) : route.abort();
      });
      await page.route('https://*.supabase.co/**', route => {
        const url = new URL(route.request().url());
        const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname.endsWith('/token')) {
          if (rejectPassword) return reply({ error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
          return reply({ access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user });
        }
        if (url.pathname.endsWith('/user')) return reply(user);
        if (url.pathname.includes('user_profiles')) return reply({
          user_id: user.id, first_name: 'Jan', last_name: 'Test', address_line: 'Adres',
          postal_code: '00-001', privacy_accepted_at: '2026-01-01', terms_accepted_at: '2026-01-01',
        });
        if (url.pathname.includes('user_security')) return reply({ pin_hash: 'hash', pin_salt: 'salt' });
        if (url.pathname.includes('user_access_roles')) return reply({ role: 'owner' });
        return reply({});
      });
      await page.goto('https://dominiksolorz.github.io/kamera/panel.html' + query, { waitUntil: 'networkidle' });
      await page.locator('#loginForm input[name=email]').fill(user.email);
      await page.locator('#loginForm input[name=password]').fill('test-password');
      await page.locator('#loginForm button[type=submit]').click();
      await page.locator('#authMessage').filter({ hasText: 'Nieprawidłowy e-mail lub hasło.' }).waitFor();
      assert.equal(await page.locator('#lock').isVisible(), false);
      rejectPassword = false;
      await page.locator('#loginForm button[type=submit]').click();
      await page.locator('#lock').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#authDialog').isVisible(), false);
      assert.equal(await page.locator('#app').isVisible(), false, 'The PIN gate must still protect the application');
      assert.deepEqual(errors, []);
      // Successful entry canonicalizes the URL to panel=owner. A fresh page
      // must restore the account and require PIN again without killing app.js.
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('#lock').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#authDialog').isVisible(), false);
      assert.equal(await page.locator('#app').isVisible(), false);
      assert.deepEqual(errors, []);
      console.log('PASS: rejected password, successful sign-in, PIN gate and reload: ' + query);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
