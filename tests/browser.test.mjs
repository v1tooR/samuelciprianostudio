import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { root, startPreview } from '../scripts/preview.mjs';

test('HTML sem JavaScript, layout móvel, menu e fallback sem bibliotecas de animação', async () => {
  const server = await startPreview(0);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
    const base = `http://127.0.0.1:${server.address().port}`;
    await mkdir(resolve(root, '.seo-preview'), { recursive: true });
    const noJS = await browser.newContext({ javaScriptEnabled: false });
    for (const path of ['/', '/projetos/entremeio/', '/projetos/lets-dance/', '/projetos/samuel-cipriano-studio/', '/projetos/victor-santos/']) {
      const page = await noJS.newPage();
      await page.goto(base + path);
      assert.equal(await page.locator('head title').count(), 1);
      assert.equal(await page.locator('head meta[name="description"]').count(), 1);
      assert.equal(await page.locator('main h1').count(), 1);
      assert.ok(await page.locator('main h1').isVisible());
      if (path === '/') assert.equal(await page.locator('[data-curtain]').isVisible(), false);
      await page.close();
    }
    await noJS.close();
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-curtain]')).display === 'none');
    await page.waitForFunction(() => !window.gsap || !window.gsap.isTweening('[data-hlogo-in]'));
    assert.equal(await page.locator('iframe').count(), 0, 'YouTube carrega apenas ao pressionar play');
    assert.equal(await page.locator('script[src*="react"]').count(), 0);
    await page.screenshot({ path: resolve(root, '.seo-preview/home-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-curtain]')).display === 'none');
    await page.waitForFunction(() => !window.gsap || !window.gsap.isTweening('[data-hlogo-in]'));
    await page.screenshot({ path: resolve(root, '.seo-preview/home-mobile.png') });
    await page.locator('[data-menu-open]').click();
    await page.waitForFunction(() => document.querySelector('[data-menu-open]').getAttribute('aria-expanded') === 'true');
    assert.equal(await page.locator('[data-menu]').evaluate(menu => menu.inert), false);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-menu-open]').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('[data-menu]').evaluate(menu => menu.inert), true);
    assert.deepEqual(errors, []);
    await context.close();

    const fallback = await browser.newContext({ reducedMotion: 'reduce' });
    await fallback.route('**/cdn.jsdelivr.net/**', route => route.abort());
    const fallbackPage = await fallback.newPage();
    await fallbackPage.goto(base + '/');
    await fallbackPage.waitForFunction(() => document.documentElement.classList.contains('has-hlogo'));
    assert.ok(await fallbackPage.locator('main h1').isVisible());
    assert.equal(await fallbackPage.locator('[data-curtain]').isVisible(), false);
    await fallbackPage.locator('[data-menu-open]').click();
    assert.equal(await fallbackPage.locator('[data-menu-open]').getAttribute('aria-expanded'), 'true');
    await fallback.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(done => server.close(done));
  }
});
