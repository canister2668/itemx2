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



const script = `const {chromium}=require('playwright-core');
(async()=>{ const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const out={};
try {
  for (const n of (process.env.ITEMX_CARDS||'1,2,4,8').split(',')) {
    const page=await browser.newPage({viewport:{width:411,height:891},deviceScaleFactor:3});
    await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="itemx2-root"></div></body></html>');
    await page.evaluate(()=>{const store=new Map();window.Risuai={pluginStorage:{getItem:async k=>store.get(k)??null,setItem:async(k,v)=>store.set(k,v)},getDatabase:async()=>({}),nativeFetch:async()=>({}),};});
    await page.evaluate('globalThis.ITEMX_CARDS=' + n);
    await page.evaluate(${JSON.stringify(fixture)});
    await page.evaluate(([t,s])=>itemxAudit.setup(t,s),[process.env.ITEMX_MOTION||'full','aff:mixed']);
    if (process.env.ITEMX_KILL) await page.addStyleTag({content: process.env.ITEMX_KILL});
    await page.waitForTimeout(600);
    const cdp = await page.context().newCDPSession(page);
    const layers = await new Promise(async (done) => {
      cdp.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers) done(e.layers); });
      await cdp.send('LayerTree.enable');
      setTimeout(() => done([]), 4000);
    });
    const dpr = 3;
    let bytes = 0; const rows = [];
    for (const l of layers) { const b = Math.ceil(l.width) * Math.ceil(l.height) * 4;
      bytes += b; rows.push({ w: Math.round(l.width), h: Math.round(l.height), mb: +(b/1048576).toFixed(2) }); }
    rows.sort((a,b)=>b.mb-a.mb);
    out[n]={ layers: layers.length, totalMB: +(bytes/1048576).toFixed(1), top: rows.slice(0,5) };
    await page.close();
  }
} finally { await browser.close(); }
console.log('@@'+JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1);});`;

await mkdir(new URL('../artifacts/ui/', import.meta.url), { recursive: true });
const runner = new URL('../artifacts/ui/cdp-runner.cjs', import.meta.url);
await writeFile(runner, script);
const raw = execFileSync('node', [runner.pathname], { encoding: 'utf8', maxBuffer: 64*1024*1024 });
const line = raw.split('\n').find((l) => l.startsWith('@@'));
if (!line) { console.log(raw.slice(-900)); process.exit(1); }
for (const [n, d] of Object.entries(JSON.parse(line.slice(2)))) {
  console.log(`카드 ${n}장  합성 레이어 ${d.layers}개  실제 텍스처 ${d.totalMB} MB`);
  for (const r of d.top) console.log(`    ${String(r.mb).padStart(7)} MB  ${r.w}x${r.h}`);
}
