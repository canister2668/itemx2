import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const bundle = await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');
const anchor = '  try {\n    await loadBadgePosition();';
if (!bundle.includes(anchor)) throw new Error('bootstrap boundary missing');
const source = bundle.replace(
  anchor,
  `window.h = { runtime, ui, rootInventoryHtml, mainStyleText, drawRootHistory, historyAction, installRootClickRouter, removeRootClickRouter, openInventory, rebuildWithManual, rebuildCodexWithLedger, core: ITEMXCore, codex: ITEMXCodex, drawInventory, iframeStyle: ITEMX_STYLE };
context = async () => window.loaded;
cachedOrRebuildCurrent = async () => window.loaded;
rebuildCurrent = async () => window.loaded;
isEnabled = async () => true;
outputSettings = async () => window.loaded;
return;\n${anchor}`
);

async function check(source) {
  window.Risuai = {};
  await (0, eval)(source);
  const h = window.h;
  const prefix = (html) =>
    html.replace(
      /class="([^"]*)"/g,
      (_, list) =>
        `class="${list
          .split(/\s+/)
          .map((x) => (x.startsWith('x-risu-') ? x : 'x-risu-' + x))
          .join(' ')}"`
    );
  class Safe {
    constructor(el) {
      this.el = el;
    }
    async setInnerHTML(html) {
      this.el.innerHTML = prefix(html);
    }
    async setOuterHTML(html) {
      this.el.outerHTML = prefix(html);
    }
    async addClass(name) {
      this.el.classList.add(name);
    }
    async removeClass(name) {
      this.el.classList.remove(name);
    }
    async appendChild(other) {
      this.el.appendChild(other.el);
    }
    async remove() {
      this.el.remove();
    }
    async textContent() {
      return this.el.textContent;
    }
    async getBoundingClientRect() {
      return this.el.getBoundingClientRect();
    }
    async addEventListener(type, fn, capture) {
      const handler = (e) => fn({ clientX: e.clientX, clientY: e.clientY });
      document.addEventListener(type, handler, capture);
      return handler;
    }
    async removeEventListener(type, fn, capture) {
      document.removeEventListener(type, fn, capture);
    }
  }
  h.runtime.mainDoc = {
    querySelector: async (s) => {
      const el = document.querySelector(s);
      return el ? new Safe(el) : null;
    },
    createElement: async (tag) => new Safe(document.createElement(tag))
  };
  const item = (id, extra = {}) => ({
    kind: 'exam',
    item: h.core.normalizeItem({
      id,
      name: id,
      type: 'weapon',
      possession: 'owned',
      location: 'inventory',
      count: 1,
      ...extra
    }).item
  });
  const chat = {
    id: 'visual',
    scriptstate: {},
    message: [
      { role: 'user', data: '확인' },
      {
        role: 'char',
        data: [
          ...Array.from({ length: 24 }, (_, i) => item('blade_' + i)),
          item('pill', {
            name: '구전환혼단',
            type: 'elixir',
            count: 0,
            possession: 'removed',
            trivia: '소생시키기 위해 복용되었다.'
          })
        ]
          .map((event) => h.core.marker({ v: 2, event }))
          .join('')
      }
    ]
  };
  window.loaded = {
    key: 'test:visual',
    characterIndex: 0,
    chatIndex: 0,
    character: { name: '검증' },
    chat,
    snapshot: h.rebuildWithManual(chat),
    codexSnapshot: h.rebuildCodexWithLedger(chat),
    enabled: true,
    effectsEnabled: true,
    rarityMode: 'world'
  };
  window.writes = 0;
  Risuai.getChatFromIndex = async () => window.loaded.chat;
  Risuai.setChatToIndex = async (_c, _h, next) => {
    window.loaded.chat = next;
    window.writes++;
  };
  h.runtime.activeContextKey = loaded.key;
  h.runtime.cachedLoaded = loaded;
  h.runtime.cachedGeneration = h.runtime.generation;
  h.runtime.rootOpen = true;
  h.runtime.activeRootTab = 'inventory';
  document.head.innerHTML = '<style>' + h.mainStyleText() + 'html,body{margin:0}*{box-sizing:border-box}</style>';
  document.body.innerHTML =
    '<div class="x-risu-itemx2-root-drawer x-risu-itemx2-pos-rm x-risu-itemx2-is-open">' +
    prefix(h.rootInventoryHtml(loaded)) +
    '</div>';
  const owner = new Safe(document.body.firstElementChild);
  h.runtime.rootDrawer = owner;
  await h.installRootClickRouter(owner);
  const geometry = () =>
    ['.x-risu-itemx-ph', '.x-risu-itemx-main-tabs', '.x-risu-itemx2-root-tile-0'].map((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    });
  const baseline = geometry();
  const menu = document.querySelector('.x-risu-itemx2-panel-menu');
  const saved = menu.outerHTML;
  menu.outerHTML = '<button class="x-risu-itemx-ph-btn">✕</button>';
  const previous = geometry();
  document.querySelector('.x-risu-itemx-ph-btn').outerHTML = saved;
  if (JSON.stringify(baseline) !== JSON.stringify(previous))
    throw Error('menu moved header/cards ' + JSON.stringify({ baseline, previous }));
  const scroller = document.querySelector('.x-risu-itemx2-root-inventory > .x-risu-itemx-body');
  scroller.scrollTop = 180;
  const top = scroller.scrollTop;
  const normal = document.querySelector('.x-risu-itemx2-root-inventory');
  window.normal = normal;
  window.oldTop = top;
  document.querySelector('#itemx2-filter-owned').checked = true;
  return { baseline, top };
}

const script = `const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {const page=await browser.newPage({viewport:{width:390,height:844}});const results=[];
for(const width of [320,390,768]){
await page.setViewportSize({width,height:844});await page.goto('about:blank');
const before=await page.evaluate(${check.toString()},${JSON.stringify(source)});
await page.click('.x-risu-itemx2-panel-menu > summary');await page.click('.x-risu-itemx2-history-open');
await page.waitForSelector('.x-risu-itemx2-history-pane');
const open=await page.evaluate(()=>{const body=document.querySelector('.x-risu-itemx2-root-tab-body').getBoundingClientRect();const pane=document.querySelector('.x-risu-itemx2-history-pane').getBoundingClientRect();return {hidden:getComputedStyle(normal).visibility==='hidden',fits:pane.width<=body.width&&pane.height<=body.height,overflows:document.querySelector('.x-risu-itemx2-history-pane').scrollWidth>pane.width+1,text:document.querySelector('.x-risu-itemx2-history-pane').textContent}});
if(!open.hidden||!open.fits||open.overflows||!open.text.includes('구전환혼단'))throw Error(JSON.stringify({width,open}));
await page.click('.x-risu-itemx2-history-keep-0');await page.waitForFunction(()=>window.writes===1);
await page.click('.x-risu-itemx2-history-filter-kept');await page.click('.x-risu-itemx2-history-detail-0');
await page.waitForSelector('.x-risu-itemx2-history-pane .x-risu-itemx-card');
await page.click('.x-risu-itemx2-history-back');await page.click('.x-risu-itemx2-history-back');
await page.waitForSelector('.x-risu-itemx2-history-pane',{state:'detached'});
const restored=await page.evaluate(()=>({same:normal===document.querySelector('.x-risu-itemx2-root-inventory'),scroll:normal.querySelector('.x-risu-itemx-body').scrollTop,filter:document.querySelector('#itemx2-filter-owned').checked,visible:getComputedStyle(normal).visibility==='visible',count:loaded.snapshot.registry.items.pill.count}));
if(!restored.same||!restored.filter||!restored.visible||restored.scroll!==before.top||restored.count!==0)throw Error(JSON.stringify({width,before,restored}));
results.push({width,geometryUnchanged:true,scrollRestored:true,keepDoesNotRevive:true});
await page.evaluate(async()=>{
  await h.removeRootClickRouter();h.runtime.rootOpen=false;
  Risuai.resizeContainer=async()=>{};Risuai.showContainer=async()=>{};
  const events=h.codex.extractResponse('<skillExam><id>forgotten</id><name>잊은 기술</name><status>lost</status></skillExam><monsterExam><id>defeated</id><name>종료된 상대</name><status>defeated</status><relation>hostile</relation></monsterExam>').events;
  loaded.chat.message[1].data+=events.map(event=>h.codex.marker({v:1,event})).join('');
  loaded.codexSnapshot=h.rebuildCodexWithLedger(loaded.chat);
  await h.openInventory('skills');
});
for(const [tab,label] of [['skills','잊은 기술'],['bestiary','종료된 상대']]){
  if(tab==='bestiary')await page.click('[data-tab="bestiary"]');
  await page.click('.itemx2-panel-menu > summary');await page.click('[data-action="history-open"]');
  await page.waitForSelector('.itemx2-history-pane');
  const content=await page.locator('.itemx2-history-pane').innerText();
  if(!content.includes(label))throw Error('iframe history domain '+tab+': '+content);
  await page.click('.itemx2-history-detail-0');
  await page.waitForSelector('.itemx2-history-pane .itemx-codex-hero');
  await page.click('.itemx2-history-back');await page.click('.itemx2-history-back');
  await page.waitForSelector('.itemx2-history-pane',{state:'detached'});
}
results.push({width,iframeSkillAndEncounter:true});
}console.log(JSON.stringify(results));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});`;
console.log(
  execFileSync('docker', ['exec', '-i', 'claudex-workhouse-browser-runtime', 'node'], {
    input: script,
    encoding: 'utf8',
    timeout: 60000
  })
);
