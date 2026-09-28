// Renders body.html under two CSS files and compares computed styles of every
// element and its ::before/::after.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [bodyPath, cssA, cssB] = process.argv.slice(2);
const body = readFileSync(bodyPath, 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function snapshot(css, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${body}</body></html>`);
  const result = await page.evaluate(() => {
    const out = [];
    const props = null;
    const all = document.body.querySelectorAll('*');
    let i = 0;
    for (const el of all) {
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
        const values = {};
        for (let k = 0; k < cs.length; k++) values[cs[k]] = cs.getPropertyValue(cs[k]);
        out.push([i, el.tagName + '.' + (el.className?.baseVal ?? el.className) + (pseudo || ''), values]);
      }
      i++;
    }
    return out;
  });
  await page.close();
  return result;
}
let diffs = 0;
const summary = new Map();
for (const width of [1200, 400]) {
  const a = await snapshot(readFileSync(cssA, 'utf8'), width);
  const b = await snapshot(readFileSync(cssB, 'utf8'), width);
  if (a.length !== b.length) console.log('count differs', width, a.length, b.length);
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const pa = a[i][2], pb = b[i][2];
    const changed = Object.keys({ ...pa, ...pb }).filter((k) => pa[k] !== pb[k]);
    if (changed.length) {
      diffs++;
      for (const k of changed) summary.set(k, (summary.get(k) || 0) + 1);
      if (diffs <= 400) console.log(width, a[i][1].slice(0, 100), changed.slice(0, 5).map((k) => `${k}: ${pa[k]} -> ${pb[k]}`).join(' | '));
    }
  }
  console.log('width', width, 'nodes', n);
}
console.log('diffs', diffs, [...summary].sort((x, y) => y[1] - x[1]).slice(0, 15));
await browser.close();
