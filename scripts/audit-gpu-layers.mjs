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
      affinity:['fire','ice','lightning','wind','earth','dark','light','poison'][i],
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
    presentationState.visualSkin=skin;
    document.head.innerHTML='<style>'+mainStyleText()+'</style>';
    root.className='x-risu-itemx2-root-drawer x-risu-itemx2-pos-rb x-risu-itemx2-is-open x-risu-itemx2-font-small x-risu-itemx2-skin-'+skin;
    const prefixMarkup = html => html.replace(/class="([^"]*)"/g, (_, list) =>
      'class="' + list.trim().split(/\\s+/).filter(Boolean)
        .map(c => c.startsWith('x-risu-') ? c : 'x-risu-' + c).join(' ') + '"');
    root.innerHTML=prefixMarkup(items.map(i=>ITEMXRenderer.renderCard(i,{motion:tab})).join(''));
    const radio = document.querySelector('#itemx2-tab-' + tab) || document.querySelector('.x-risu-itemx2-tab-' + tab);
    if (radio) radio.checked = true;
    return true;
  }};
  return;
${anchor}`);
if (fixture === bundle) throw new Error('bootstrap anchor missing');


const probe = "(() => {\nconst dpr = window.devicePixelRatio || 1;\nconst panel = document.querySelector('#itemx2-root');\nconst rows = []; let bytes = 0, blend = 0, animated = 0;\nfor (const el of (panel ? panel.querySelectorAll('*') : [])) {\n  const s = getComputedStyle(el), r = el.getBoundingClientRect();\n  if (r.width < 1 || r.height < 1) continue;\n  const bm = s.mixBlendMode && s.mixBlendMode !== 'normal';\n  const bl = /blur\\(([\\d.]+)px\\)/.exec(s.filter || '');\n  const an = s.animationName && s.animationName !== 'none';\n  if (!bm && !bl && !an) continue;\n  // 블러는 반경의 약 3배까지 바깥을 읽어야 해서 버퍼가 그만큼 부풀어난다.\n  const pad = bl ? parseFloat(bl[1]) * 3 : 0;\n  const w = r.width + pad * 2, h = r.height + pad * 2;\n  const b = Math.ceil(w * dpr) * Math.ceil(h * dpr) * 4;\n  bytes += b; if (bm) blend++; if (an) animated++;\n  const cls = (el.className || '').toString().replace(/x-risu-/g, '').split(' ').filter(Boolean)[0] || el.tagName;\n  rows.push({ cls, w: Math.round(r.width), h: Math.round(r.height), blur: bl ? +bl[1] : 0,\n              blend: bm ? s.mixBlendMode : '', anim: an ? s.animationName.split(' ')[0].slice(0,16) : '', mb: +(b/1048576).toFixed(2) });\n}\nrows.sort((a,b) => b.mb - a.mb);\nreturn { dpr, cards: (panel ? panel.querySelectorAll('.x-risu-itemx-card').length : 0),\n         layers: rows.length, blend, animated, totalMB: +(bytes/1048576).toFixed(1), top: rows.slice(0, 12) };\n})()";

const script = `const {chromium}=require('playwright-core');
(async()=>{ const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const out={};
try {
  for (const motion of ['full','lite','off'])\n  for (const [name, vp] of [['폰 411x891 DPR3',{width:411,height:891,dpr:3}],['태블릿 834x1112 DPR2',{width:834,height:1112,dpr:2}]]) {
    const page=await browser.newPage({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:vp.dpr});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.setContent('<html><head></head><body style="margin:0"><div id="itemx2-root"></div></body></html>');
    await page.evaluate(()=>{const store=new Map();window.Risuai={pluginStorage:{getItem:async k=>store.get(k)??null,setItem:async(k,v)=>store.set(k,v)},getDatabase:async()=>({}),nativeFetch:async()=>({}),};});
    await page.evaluate(${JSON.stringify(fixture)});
    await page.evaluate(([t,s])=>itemxAudit.setup(t,s),[motion,'dark']);
    await page.waitForTimeout(400);
    out[motion+' | '+name]={...await page.evaluate(${JSON.stringify(probe)}), errors};
    await page.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1);});`;

await mkdir(new URL('../artifacts/ui/', import.meta.url), { recursive: true });
const runner = new URL('../artifacts/ui/gpu-runner.cjs', import.meta.url);
await writeFile(runner, script);
const raw = execFileSync('node', [runner.pathname], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const out = JSON.parse(raw.trim().split('\n').pop());
for (const [name, d] of Object.entries(out)) {
  console.log(`\n=== ${name} ===`);
  console.log(`카드 ${d.cards}장 · 합성 레이어 ${d.layers}개 (블렌드 ${d.blend} · 애니 ${d.animated}) · 추정 버퍼 ${d.totalMB} MB`);
  if (d.errors.length) console.log('오류:', d.errors.slice(0,2));
  for (const r of d.top) console.log(`  ${String(r.mb).padStart(6)} MB  ${r.cls.slice(0,26).padEnd(28)}${r.w}x${r.h}  blur${r.blur}  ${r.blend}  ${r.anim}`);
}
