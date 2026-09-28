import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
await import('./render-actual-settings.mjs');

const moduleValue = process.env.ITEMX_PLAYWRIGHT_CJS
  ? createRequire(import.meta.url)(process.env.ITEMX_PLAYWRIGHT_CJS)
  : await import(process.env.ITEMX_PLAYWRIGHT || 'playwright');
const playwright = moduleValue.chromium ? moduleValue : moduleValue.default;
const { chromium } = playwright;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'docs/assets/guide');
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(process.env.ITEMX_CHROMIUM ? { executablePath: process.env.ITEMX_CHROMIUM } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

async function open(file, viewport = { width: 430, height: 920 }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve(root, file)).href);
  if (process.env.ITEMX_EMOJI_FONT) {
    const fontUrl = pathToFileURL(resolve(process.env.ITEMX_EMOJI_FONT)).href;
    await page.addStyleTag({
      content: `@font-face{font-family:ItemxCaptureEmoji;src:url('${fontUrl}') format('truetype')} .avatar,.event-icon,.tile-icon,.main-tab span,.itemx-emoji,.itemx-tile-em,.itemx-codex-glyph,.detail-icon,.x-risu-itemx2-inline-icon>span,.x-risu-itemx-main-tab,.x-risu-itemx-ph-btn{font-family:ItemxCaptureEmoji,"Noto Color Emoji",sans-serif!important}`
    });
  }
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' });
  return page;
}

async function shot(page, selector, name) {
  const target = page.locator(selector);
  await target.waitFor({ state: 'visible' });
  await target.screenshot({ path: resolve(out, name), animations: 'disabled' });
  const box = await target.boundingBox();
  console.log(`${name}: ${Math.round(box?.width || 0)}x${Math.round(box?.height || 0)}`);
  await page.close();
}

{
  const page = await open('design/itemx-inline-actual.html', { width: 520, height: 420 });
  await shot(page, '.chattext', '01-inline-events.png');
}

{
  const page = await open('dist/itemx2-preview.html', { width: 520, height: 920 });
  await page.click('#list');
  await shot(page, '.itemx-panel', '02-inventory.png');
}

{
  const page = await open('dist/itemx2-preview.html', { width: 620, height: 1000 });
  await page.click('#multi');
  await shot(page, '.itemx-card', '03-item-affinity.png');
}

{
  const page = await open('design/codex-skills-bestiary-tabs-demo.html', { width: 520, height: 920 });
  await page.click('[data-view="skills"]');
  await page.click('.skill-tile[data-id="moon_cut"]');
  await page.waitForTimeout(120);
  await shot(page, '.codex-panel', '04-skill-detail.png');
}

{
  const page = await open('design/codex-inline-event-demo.html', { width: 560, height: 760 });
  const encounter = page.locator('.encounter-row .event').first();
  await encounter.screenshot({ path: resolve(out, '05-encounter-active.png'), animations: 'disabled' });
  const box = await encounter.boundingBox();
  console.log(`05-encounter-active.png: ${Math.round(box?.width || 0)}x${Math.round(box?.height || 0)}`);
  await page.close();
}

{
  const page = await open('design/codex-inline-event-demo.html', { width: 560, height: 760 });
  const encounters = page.locator('.encounter-row .event');
  await encounters.nth(1).screenshot({ path: resolve(out, '06-encounter-defeated.png'), animations: 'disabled' });
  const box = await encounters.nth(1).boundingBox();
  console.log(`06-encounter-defeated.png: ${Math.round(box?.width || 0)}x${Math.round(box?.height || 0)}`);
  await page.close();
}

{
  const page = await open('design/itemx-settings-actual.html', { width: 520, height: 920 });
  await shot(page, '.x-risu-itemx2-root-panel', '07-settings-permissions.png');
}

for (const preview of [
  { name: 'itemx-codex-2.0-guide-preview.png', viewport: { width: 980, height: 1000 } },
  { name: 'itemx-codex-2.0-guide-mobile-preview.png', viewport: { width: 390, height: 844 } }
]) {
  const page = await open('docs/itemx-codex-2.0-arca-guide.html', preview.viewport);
  await page.screenshot({ path: resolve(root, `docs/${preview.name}`), fullPage: true, animations: 'disabled' });
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).length
  }));
  if (metrics.brokenImages || metrics.width > metrics.viewport)
    throw new Error(`${preview.name} layout failed: ${JSON.stringify(metrics)}`);
  console.log(`${preview.name}: width=${metrics.width} brokenImages=${metrics.brokenImages}`);
  await page.close();
}

await browser.close();
