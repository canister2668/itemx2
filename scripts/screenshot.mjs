import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const playwrightPath = process.env.ITEMX_PLAYWRIGHT;
const playwright = process.env.ITEMX_PLAYWRIGHT_CJS
  ? createRequire(import.meta.url)(process.env.ITEMX_PLAYWRIGHT_CJS)
  : await import(playwrightPath || 'playwright');
const { chromium } = playwright;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ITEMX_CHROMIUM ? { executablePath: process.env.ITEMX_CHROMIUM } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

for (const shot of [
  { name: 'inventory-desktop', viewport: { width: 1100, height: 900 }, action: '#list' },
  { name: 'multi-affinity-desktop', viewport: { width: 900, height: 980 }, action: '#multi' },
  { name: 'inventory-mobile', viewport: { width: 390, height: 844 }, action: '#list' },
  { name: 'single-affinity-mobile', viewport: { width: 390, height: 844 }, action: '#single' }
]) {
  const page = await browser.newPage({ viewport: shot.viewport, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve(root, 'dist/itemx2-preview.html')).href);
  await page.click(shot.action);
  await page.screenshot({ path: resolve(root, `dist/${shot.name}.png`), fullPage: true });
  const card = await page.locator('.itemx-card').count();
  const panel = await page.locator('.itemx-panel').count();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${shot.name}: card=${card} panel=${panel} horizontalOverflow=${overflow}`);
  await page.close();
}

await browser.close();
