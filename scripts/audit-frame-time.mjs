import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const bundle = await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');
const anchor = '  try {\n    await loadBadgePosition();';
const fixture = bundle.replace(anchor, `
  globalThis.itemxAudit = { async setup(tab, skin) {
    const root = document.querySelector('#itemx2-root');
    const names = ['청상벽려검(靑霜霹靂劍)','흑염단마도','칠성벽해인','만겁유혼검','태을진령비갑','태초무극검','단검','목걸이'];
    const items = names.map((name,i) => ITEMXCore.normalizeItem({
      id:'item'+i, name, type:i%2?'장신구':'검', internalrarity:'empyrean',
      affinity: (skin.startsWith('aff:') && skin.slice(4) !== 'mixed') ? skin.slice(4) : ['fire','ice','lightning','wind','earth','dark','light','poison'][i],
      possession:'owned', location:i===0?'equipped':'inventory', count:1,
      power:'7800', durability:'950/1000', cost:'350,000 냥', required:'초절정 이상',
      effects:'극한지기::검신에서 뿜어지는 극한의 한기가 닿는 대상의 혈류와 경락을 서서히 동결시킴 ;; 빙화만개::초식 전개 시 얼음꽃 형상의 서리 검기가 허공을 가르며 방어막을 형성함'
    }).item);
    const codex = ITEMXCodex.extractResponse('<skillExam><id>s0</id><name>구양신공</name><status>learned</status><rank>legendary</rank><cost>내력 소모</cost></skillExam><monsterExam><id>m0</id><name>흑의 복면인</name><relation>hostile</relation><status>active</status><threat>절정</threat></monsterExam>').snapshot;
    const loaded = { key:'audit:chat', character:{chaId:'audit',name:'무림 속으로(in to the Murim)'},
      chat:{id:'chat',message:[],scriptstate:{}},
      snapshot:{registry:{order:items.map(i=>i.id),items:Object.fromEntries(items.map(i=>[i.id,i]))},history:{},fingerprint:'a'},
      codexSnapshot:codex, portraits:{}, enabled:true, mainOutput:true, auxOutput:'off', rarityMode:'world',
      itemsEnabled:true, skillsEnabled:true, encountersEnabled:true, lorebookEncounterEnabled:false,
      moduleAssetsEnabled:true, effectsEnabled:true, debugEnabled:false, fontScale:'small', skin };
    pipelineState.cachedLoaded=loaded; pipelineState.activeContextKey=loaded.key;
    cachedOrRebuildCurrent=async()=>loaded; rebuildCurrent=async()=>loaded;
    hostState.mainDoc=nativeElement(document); installMainStyle=async()=>true;
    uiState.rootOpen=true; uiState.activeRootTab=tab;
    presentationState.visualSkin = skin.startsWith('aff:') ? 'dark' : skin;
    document.head.innerHTML='<style>'+mainStyleText()+'</style>';
    root.className='x-risu-itemx2-root-drawer x-risu-itemx2-pos-rb x-risu-itemx2-is-open x-risu-itemx2-font-small x-risu-itemx2-skin-dark';
    const prefixMarkup = html => html.replace(/class="([^"]*)"/g, (_, list) =>
      'class="' + list.trim().split(/\\s+/).filter(Boolean)
        .map(c => c.startsWith('x-risu-') ? c : 'x-risu-' + c).join(' ') + '"');
    root.innerHTML=prefixMarkup(items.slice(0, Number(globalThis.ITEMX_CARDS||8)).map(i=>ITEMXRenderer.renderCard(i,{motion:tab})).join(''));
    const radio = document.querySelector('#itemx2-tab-' + tab) || document.querySelector('.x-risu-itemx2-tab-' + tab);
    if (radio) radio.checked = true;
    return true;
  }};
  return;
${anchor}`);
if (fixture === bundle) throw new Error('bootstrap anchor missing');



const probe = "(async () => {\nconst live = () => [...document.querySelectorAll('*')].filter((el) => {\n  const c = getComputedStyle(el);\n  return c.animationName && c.animationName !== 'none' && c.display !== 'none' &&\n         el.getBoundingClientRect().width > 0;\n}).length;\nconst animated = live();\nconst deltas = [];\nawait new Promise((done) => {\n  let last = performance.now(); const stop = last + 4000;\n  const tick = (now) => { deltas.push(now - last); last = now;\n    if (now < stop) requestAnimationFrame(tick); else done(); };\n  requestAnimationFrame(tick);\n});\ndeltas.shift();\nconst sorted = [...deltas].sort((a, b) => a - b);\nconst q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];\nreturn { animated, frames: deltas.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1),\n         max: +sorted[sorted.length - 1].toFixed(1) };\n})()";

const script = `const {chromium}=require('playwright-core');
(async()=>{ const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const out={};
try {
  for (const label of (process.env.ITEMX_CASES||'full,full:blend,full:blur,full:anim,full:particles,full:big,off').split(',')) {
    const page=await browser.newPage({viewport:{width:411,height:891},deviceScaleFactor:3,hasTouch:process.env.ITEMX_TOUCH!=='0',isMobile:process.env.ITEMX_TOUCH!=='0'});
    await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="itemx2-root"></div></body></html>');
    await page.evaluate(()=>{const store=new Map();window.Risuai={pluginStorage:{getItem:async k=>store.get(k)??null,setItem:async(k,v)=>store.set(k,v)},getDatabase:async()=>({}),nativeFetch:async()=>({}),};});
    await page.evaluate(${JSON.stringify(fixture)});
    await page.evaluate('globalThis.ITEMX_CARDS=' + (process.env.ITEMX_CARDS || 8));
    const [motion, kill] = label.split(':');
    await page.evaluate(([t,s])=>itemxAudit.setup(t,s),[motion,'aff:mixed']);
    const css = await (async () => ({
      blend: '*{mix-blend-mode:normal!important}',
      blur: '*{filter:none!important}',
      anim: '*,*::before,*::after{animation:none!important}',
      particles: '.x-risu-afx>*,.x-risu-craft-mote{display:none!important}',
      novar: (await page.evaluate(() => [...document.styleSheets].flatMap((sh) => {
        try { return [...sh.cssRules]; } catch { return []; } })
        .filter((r) => r.type === 7 && r.cssText.includes('var('))
        .map((r) => r.cssText.replace(/var\\(--int[^)]*\\)/g, '1').replace(/var\\(--[\\w-]+[^)]*\\)/g, '1')).join('\\n'))),
      aura: '.x-risu-itemx-card{animation:none!important}',\n      fb: '*{filter:none!important;mix-blend-mode:normal!important}',\n      fbc: '*{filter:none!important;mix-blend-mode:normal!important}.x-risu-itemx-card{contain:none!important}',\n      contain: '.x-risu-itemx-card{contain:none!important}',\n      isolate: '.x-risu-itemx-card{isolation:auto!important}',\n      big: '.x-risu-current-rays,.x-risu-current-veil,.x-risu-current-fog,.x-risu-light-veilfall,.x-risu-light-ground,.x-risu-affinity-signature{display:none!important}'
    }))().then((m) => m[kill]);
    if (css) await page.addStyleTag({content:css});
    await page.waitForTimeout(500);
    out[label]=await page.evaluate(${JSON.stringify(probe)});
    await page.close();
  }
} finally { await browser.close(); }
console.log('@@'+JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1);});`;

await mkdir(new URL('../artifacts/ui/', import.meta.url), { recursive: true });
const runner = new URL('../artifacts/ui/frame-runner.cjs', import.meta.url);
await writeFile(runner, script);
const raw = execFileSync('node', [runner.pathname], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const line = raw.split('\n').find((l) => l.startsWith('@@'));
if (!line) { console.log(raw.slice(-800)); process.exit(1); }
for (const [name, d] of Object.entries(JSON.parse(line.slice(2))))
  console.log(`${name.padEnd(16)} 살아있는애니 ${String(d.animated).padStart(4)}개  p50 ${String(d.p50).padStart(6)}ms  p95 ${String(d.p95).padStart(7)}ms`);
