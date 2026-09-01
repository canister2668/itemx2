import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const playwrightPath = process.env.ITEMX_PLAYWRIGHT;
const playwright = process.env.ITEMX_PLAYWRIGHT_CJS ? createRequire(import.meta.url)(process.env.ITEMX_PLAYWRIGHT_CJS) : await import(playwrightPath || 'playwright');
const { chromium } = playwright;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const purifyPath = process.env.ITEMX_PURIFY;
if (!purifyPath) throw new Error('ITEMX_PURIFY must point to the PocketRisu 1.10 DOMPurify bundle');
const [core, renderer, css, purify] = await Promise.all([
  readFile(resolve(root, 'src/core.js'), 'utf8'), readFile(resolve(root, 'src/renderer.js'), 'utf8'),
  readFile(resolve(root, 'dist/itemx2-main-scoped.css'), 'utf8'), readFile(purifyPath, 'utf8')
]);
const browser = await chromium.launch({ headless: true, ...(process.env.ITEMX_CHROMIUM ? { executablePath: process.env.ITEMX_CHROMIUM } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#080a10}.chattext{width:100%;padding:12px;box-sizing:border-box}</style><style>${css}</style><script>${purify}</script></head><body><div class="chattext" id="chat"></div><script>${core}\n${renderer}\nDOMPurify.addHook('uponSanitizeAttribute',function(node,data){if(data.attrName==='class'&&data.attrValue){data.attrValue=data.attrValue.split(' ').map(function(v){return v.startsWith('x-risu-')?v:'x-risu-'+v}).join(' ')}});const item={id:'risu_pipeline',emoji:'⚡',name:'천뢰를 품은 왕창',rarity:'legendary',displayRarity:'전설',theme:'oriental',affinity:'lightning',affinity2:'ice',itemType:'왕창',possession:'owned',location:'equipped',power:'7600-9400',durability:'81/100',effects:[{name:'극뢰',desc:'빙결된 대상 사이로 번개가 연쇄 전도된다.'}],trivia:'Risu 표시 파이프라인 검증.'};const raw=ITEMXRenderer.renderCard(item,{motion:'full',inline:true});document.querySelector('#chat').innerHTML=DOMPurify.sanitize(raw,{ADD_TAGS:['style'],ADD_ATTR:['data-itemx-id']});</script></body></html>`;
await page.setContent(html, { waitUntil: 'load' });
const result = await page.evaluate(() => {
  const card = document.querySelector('.x-risu-itemx-card');
  const rect = card?.getBoundingClientRect();
  return {
    cards: document.querySelectorAll('.x-risu-itemx-card').length,
    lightning: document.querySelectorAll('.x-risu-afx-lightning b').length,
    ice: document.querySelectorAll('.x-risu-afx-ice i').length,
    width: rect?.width || 0,
    height: rect?.height || 0,
    background: card ? getComputedStyle(card).backgroundColor : '',
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    rawTag: document.body.textContent.includes('<itemExam>')
  };
});
if (result.cards !== 1 || result.lightning < 5 || result.ice < 3 || result.width < 250 || result.height < 250 || result.overflow !== 0 || result.rawTag) {
  throw new Error(`Risu pipeline geometry failed: ${JSON.stringify(result)}`);
}
await page.screenshot({ path: process.env.ITEMX_SCREENSHOT || resolve(root, 'dist/risu-pipeline-mobile.png'), fullPage: true });
console.log(JSON.stringify(result));
await browser.close();
