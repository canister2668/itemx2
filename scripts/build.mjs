import { runtimeSource, styleSources } from './runtime-source.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const protocolPath = resolve(root, 'src/main-protocol.txt');
const [protocol, core, quality, codex, lorebook, renderer, runtime, packageRaw] = await Promise.all([
  readFile(protocolPath, 'utf8'),
  readFile(resolve(root, 'src/core.js'), 'utf8'),
  readFile(resolve(root, 'src/quality.js'), 'utf8'),
  readFile(resolve(root, 'src/codex.js'), 'utf8'),
  readFile(resolve(root, 'src/lorebook.js'), 'utf8'),
  readFile(resolve(root, 'src/renderer.js'), 'utf8'),
  runtimeSource(),
  readFile(resolve(root, 'package.json'), 'utf8')
]);
const packageVersion = JSON.parse(packageRaw).version;
const beta = packageVersion.match(/^(\d+)\.(\d+)\.\d+-beta\.(\d+)$/);
const displayVersion = beta ? `${beta[1]}.${beta[2]} · BETA ${beta[3]}` : packageVersion;
const updateUrl = String(process.env.ITEMX_UPDATE_URL || JSON.parse(packageRaw).itemxUpdateUrl || '').trim();
if (updateUrl && !/^https:\/\//i.test(updateUrl)) throw new Error('ITEMX update URL must use HTTPS');

// Stylesheets are source files, not something scraped out of a design mockup.
// `shell.css` is the iframe-fallback shell (.stage) plus mockup chrome and is
// scoped to the plugin's own document; `cards.css` is the card surface that is
// also rescoped into the chat body; `presentation.css` is the chat-body layer.
const { shell: shellCss, cards: cardsCss, presentation: presentationCss } = await styleSources();
const workQueue = await readFile(resolve(root, 'src/work-queue.js'), 'utf8');
const state = await readFile(resolve(root, 'src/state.js'), 'utf8');
const storage = await readFile(resolve(root, 'src/storage.js'), 'utf8');
const settingsStore = await readFile(resolve(root, 'src/settings-store.js'), 'utf8');
const history = await readFile(resolve(root, 'src/history.js'), 'utf8');
const backup = await readFile(resolve(root, 'src/backup.js'), 'utf8');
if (!cardsCss.startsWith('    .itemx-panel')) throw new Error('src/style.css card section must begin at the .itemx-panel surface');
const css = `${shellCss}${cardsCss}\n${presentationCss.trim()}`;
const chatCss = `${cardsCss}\n${presentationCss.trim()}`
  .replace(/\.stage\b/g, '.itemx2-never-stage')
  .replace(/\.risu-topbar\b/g, '.itemx2-never-topbar')
  .replace(/\.demo-note\b/g, '.itemx2-never-note')
  .replace(/\.lab\b/g, '.itemx2-never-lab');

function scopeSelectors(selectorList) {
  return selectorList
    .split(',')
    .map((selector) => {
      const value = selector.trim();
      if (!value) return value;
      return `.chattext ${value.replace(/\.([a-zA-Z][\w-]*)/g, (_, name) => (name.startsWith('x-risu-') ? `.${name}` : `.x-risu-${name}`))}`;
    })
    .join(', ');
}

function scopeBlock(source) {
  let out = '',
    cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf('{', cursor);
    if (open < 0) {
      out += source.slice(cursor);
      break;
    }
    const prelude = source.slice(cursor, open).trim();
    let depth = 1,
      end = open + 1;
    while (end < source.length && depth > 0) {
      if (source[end] === '{') depth += 1;
      else if (source[end] === '}') depth -= 1;
      end += 1;
    }
    const body = source.slice(open + 1, end - 1);
    if (prelude.startsWith('@'))
      out += /^@(media|supports|document|container)/.test(prelude)
        ? `${prelude}{${scopeBlock(body)}}`
        : `${prelude}{${body}}`;
    else out += `${scopeSelectors(prelude)}{${body}}`;
    cursor = end;
  }
  return out;
}
const mainCss = scopeBlock(chatCss.replace(/\/\*[\s\S]*?\*\//g, ''));
const productionSource = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/[^\r\n]*(?:\r?\n|$)/gm, '');

const metadata = `//@name itemx2\n//@api 3.0\n//@version ${packageVersion}\n${updateUrl ? `//@update-url ${updateUrl}\n` : ''}//@display-name ITEMX · v${packageVersion}\n//@description World Inventory & Encounter Archive\n\n/*\n * ITEMX - World Inventory & Encounter Archive\n * Copyright (C) 2026 canister2668\n *\n * A RisuAI derivative work, built on the RisuAI plugin API v3.\n * Upstream: RisuAI - Copyright (C) 2024 Kwaroran - https://github.com/kwaroran/RisuAI\n *\n * This program is free software: you can redistribute it and/or modify it under\n * the terms of the GNU General Public License as published by the Free Software\n * Foundation, either version 3 of the License, or (at your option) any later version.\n *\n * This program is distributed in the hope that it will be useful, but WITHOUT ANY\n * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A\n * PARTICULAR PURPOSE. See the GNU General Public License for more details.\n *\n * You should have received a copy of the GNU General Public License along with this\n * program. If not, see <https://www.gnu.org/licenses/>.\n *\n * Source: https://github.com/canister2668/itemx2\n */\n\n`;
const builtRuntime = productionSource(
  runtime
    .replace('__ITEMX_PLUGIN_VERSION_JSON__', JSON.stringify(packageVersion))
    .replace('__ITEMX_VERSION_LABEL_JSON__', JSON.stringify(displayVersion))
    .replace('__ITEMX_STYLE_JSON__', JSON.stringify(css))
    .replace('__ITEMX_PRESENTATION_STYLE_JSON__', JSON.stringify(presentationCss))
    .replace('__ITEMX_CHAT_STYLE_JSON__', JSON.stringify(chatCss))
    .replace('__ITEMX_MAIN_STYLE_JSON__', JSON.stringify(mainCss))
    .replace('__ITEMX_PROTOCOL_JSON__', JSON.stringify(protocol))
);
if (/__ITEMX_[A-Z_]+__/.test(builtRuntime)) throw new Error('unreplaced build placeholder');

await mkdir(resolve(root, 'dist'), { recursive: true });
const plugin = `${metadata}${productionSource(core).trimEnd()}\n${productionSource(quality).trimEnd()}\n${productionSource(codex).trimEnd()}\n${productionSource(lorebook).trimEnd()}\n${productionSource(renderer).trimEnd()}\n${productionSource(history).trimEnd()}\n${productionSource(backup).trimEnd()}\n${productionSource(workQueue).trimEnd()}\n${productionSource(state).trimEnd()}\n${productionSource(storage).trimEnd()}\n${productionSource(settingsStore).trimEnd()}\n${builtRuntime.trimEnd()}\n`;
await writeFile(resolve(root, 'dist/itemx2.plugin.js'), plugin);
await writeFile(resolve(root, 'dist/itemx2-ui.css'), `${css}\n`);
await writeFile(resolve(root, 'dist/itemx2-main-scoped.css'), `${mainCss.trimEnd()}\n`);

const fixture = [
  {
    id: 'yanggeom_chiyang',
    emoji: '⚔️',
    name: '치양의 양검',
    rarity: 'legendary',
    displayRarity: '전설',
    theme: 'oriental',
    affinity: 'fire',
    affinity2: 'wind',
    itemType: '장검',
    possession: 'owned',
    location: 'equipped',
    power: '7600-9400',
    durability: '77 / 100',
    effects: [{ name: '화염폭풍', desc: '불티가 바람의 궤도를 타고 휘몰아친다.' }],
    trivia: '검신을 따라 치양의 열기와 청람이 교차한다.'
  },
  {
    id: 'frostbolt',
    emoji: '🔱',
    name: '빙뢰의 청람창',
    rarity: 'mythical',
    displayRarity: '신화',
    theme: 'arcane',
    affinity: 'ice',
    affinity2: 'lightning',
    itemType: '장창',
    possession: 'owned',
    location: 'inventory',
    power: '17600-24400',
    durability: '95 / 100',
    effects: [{ name: '극뢰', desc: '빙결된 대상 사이로 번개가 연쇄 전도된다.' }]
  },
  {
    id: 'starter_linen',
    emoji: '👕',
    name: '초보자의 린넨 세트',
    rarity: 'normal',
    displayRarity: '일반',
    theme: 'forged',
    itemType: '천 방어구',
    possession: 'owned',
    location: 'equipped',
    power: '5-8',
    durability: '25 / 25',
    effects: []
  },
  {
    id: 'mana_potion',
    emoji: '🧪',
    name: '하급 마나 회복 물약',
    rarity: 'magic',
    displayRarity: '매직',
    theme: 'arcane',
    affinity: 'light',
    itemType: '소모품',
    possession: 'owned',
    location: 'inventory',
    count: 3,
    power: '120-180',
    durability: '해당 없음',
    effects: [{ name: '마나 회복', desc: '소량의 마나를 즉시 회복한다.' }]
  }
];
const preview = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>ITEMX Preview</title><style>${css}\n.preview-actions{display:flex;gap:8px;margin:0 auto 12px;width:min(560px,100%)}.preview-actions button{padding:8px 12px;border:1px solid #31394a;border-radius:8px;background:#171c28;color:#d9dfeb;cursor:pointer}</style></head><body><div class="risu-shell"><header class="risu-topbar"><strong>ITEMX ${displayVersion}</strong><span>World Inventory & Encounter Archive</span></header><main class="stage"><div class="demo-note"><b>PLUGIN PREVIEW</b><span>본문과 인벤토리가 같은 JavaScript 렌더러와 같은 CSS를 사용합니다.</span></div><div class="preview-actions"><button id="list">인벤토리</button><button id="single">단일 속성</button><button id="multi">다중 속성</button></div><div id="app"></div></main></div><script>${core}\n${renderer}\nconst items=${JSON.stringify(fixture)};const app=document.querySelector('#app');function list(){app.innerHTML='<section class="itemx-panel"><header class="itemx-ph"><span class="itemx-ph-text"><span class="itemx-ph-eyebrow">ITEMX · ${displayVersion}</span><span class="itemx-ph-title">인벤토리</span><span class="itemx-ph-sub">보유 4 · 장착 2 · 관찰 0</span></span><span class="itemx-ph-btn">✕</span></header><nav class="itemx-seg"><span class="itemx-seg-i itemx-seg-on">전체 <span class="itemx-seg-n">4</span></span><span class="itemx-seg-i">보유 <span class="itemx-seg-n">4</span></span><span class="itemx-seg-i">장착 <span class="itemx-seg-n">2</span></span></nav><div class="itemx-tools"><span class="itemx-tool">⇅ 최근</span><span class="itemx-search">검색</span></div><div class="itemx-body"><div class="itemx-grid">'+items.map(ITEMXRenderer.renderTile).join('')+'</div></div><footer class="itemx-pf">4점 표시 · 실제 렌더러</footer></section>';document.querySelectorAll('[data-item-id]').forEach((el)=>el.onclick=()=>card(items.find((x)=>x.id===el.dataset.itemId)))}function card(item){app.innerHTML='<div class="itemx-detail">'+ITEMXRenderer.renderCard(item,{motion:'full'})+'</div>'}document.querySelector('#list').onclick=list;document.querySelector('#single').onclick=()=>card(items[3]);document.querySelector('#multi').onclick=()=>card(items[0]);list();</script></body></html>`;
await writeFile(resolve(root, 'dist/itemx2-preview.html'), preview);

console.log(`built ${plugin.length} byte plugin and ${preview.length} byte preview`);
