const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../design/home-security-redesign/prototyp-mobilny');
const url = process.env.HS_PREVIEW_URL || 'https://hs-preview.invalid/podglad-mobilny/';
const artifacts = process.env.HS_PREVIEW_ARTIFACTS;
const sizes = [[390, 844], [320, 568], [844, 390], [1280, 900]];

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' }),
    args: ['--no-sandbox'],
  });
  if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
  try {
    for (const [width, height] of sizes) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [], external = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (new URL(request.url()).origin !== new URL(url).origin) external.push(request.url());
      });
      if (!process.env.HS_PREVIEW_URL) {
        await page.route('https://hs-preview.invalid/**', route => {
          const relative = decodeURIComponent(new URL(route.request().url()).pathname.replace('/podglad-mobilny/', '')) || 'index.html';
          const file = path.join(root, relative);
          return fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: 'Missing preview asset' });
        });
      }
      await page.clock.install();
      await page.goto(url, { waitUntil: 'networkidle' });
      const visible = id => page.locator('#' + id).isVisible();
      const capture = async name => {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name + ' overflows horizontally');
        if (artifacts && width === 390) await page.screenshot({ path: path.join(artifacts, name + '.png') });
      };
      assert.equal(await visible('reklama'), true);
      assert.equal(await page.locator('#ad > img.on').count(), 1);
      await capture('00-oczekiwanie');
      await page.clock.runFor(10000);
      assert.equal(await page.locator('#ad > img').nth(1).getAttribute('class'), 'on');
      await page.clock.runFor(10000);
      assert.equal(await page.locator('#ad > img').nth(2).getAttribute('class'), 'on');
      await page.clock.runFor(10000);
      assert.equal(await visible('start'), true);
      await capture('01-start');
      await page.clock.runFor(1500);
      assert.equal(await visible('intro'), true);
      await capture('02-strona-glowna');
      await page.locator('#intro .btn.primary').click();
      assert.equal(await visible('login'), true);
      await page.locator('#previewEmail').fill('tester@example.invalid');
      await page.locator('#previewPassword').fill('dane-pokazowe');
      await capture('03-logowanie');
      await page.locator('#previewLogin button[type=submit]').click();
      assert.equal(await visible('pin'), true);
      await capture('04-pin');
      for (const digit of '0000') await page.locator('[data-pin="' + digit + '"]').click();
      assert.match(await page.locator('#pinStatus').textContent(), /Spróbuj ponownie/);
      assert.equal(await visible('dash'), false);
      for (const digit of '1234') await page.locator('[data-pin="' + digit + '"]').click();
      await page.clock.runFor(300);
      assert.equal(await visible('dash'), true);
      await capture('05-pulpit');
      for (const [id, name] of [['cams', '06-kamery'], ['recs', '07-nagrania'], ['settings', '08-ustawienia']]) {
        await page.locator('#tabs [data-go="' + id + '"]').click();
        assert.equal(await visible(id), true);
        await capture(name);
      }
      await page.goBack();
      assert.equal(await visible('recs'), true, 'Browser Back must restore recordings');
      await page.locator('#restartPreview').click();
      assert.equal(await visible('reklama'), true);
      await page.locator('#adSkip').click();
      await page.clock.runFor(35000);
      assert.equal(await visible('intro'), true, 'Leaving ads must cancel their timer');
      await page.goto(new URL('#dash', url).href, { waitUntil: 'networkidle' });
      assert.equal(await visible('login'), true, 'A fresh direct dashboard route must enter the demonstration login');
      assert.deepEqual(errors, []);
      assert.deepEqual(external, [], 'Walkthrough must not contact account or camera services');
      console.log(`PASS ${width}x${height}: banners, home, login, wrong/right PIN, four app views, Back, restart and no external requests`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
