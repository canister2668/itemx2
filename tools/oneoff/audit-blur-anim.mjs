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
    root.innerHTML=prefixMarkup(items.map(i=>ITEMXRenderer.renderCard(i,{motion:tab})).join(''));
    const radio = document.querySelector('#itemx2-tab-' + tab) || document.querySelector('.x-risu-itemx2-tab-' + tab);
    if (radio) radio.checked = true;
    return true;
  }};
  return;
${anchor}`);
if (fixture === bundle) throw new Error('bootstrap anchor missing');



const probe = "(() => {\n// \ube14\ub7ec\uc640 \uc560\ub2c8\uba54\uc774\uc158\uc774 \uac19\uc740 \uc694\uc18c\uc5d0 \uac78\ub9ac\uba74 \ub9e4 \ud504\ub808\uc784 \ube14\ub7ec\ub97c \ub2e4\uc2dc \uacc4\uc0b0\ud55c\ub2e4.\n// \uc624\ud504\uc2a4\ud06c\ub9b0 \ubc84\ud37c\uac00 \ud504\ub808\uc784\ub9c8\ub2e4 \uc0c8\ub85c \ub9cc\ub4e4\uc5b4\uc9c0\ub294 \uac83\uc774\ub77c \uac00\uc7a5 \ube44\uc2f8\ub2e4.\nconst rows = [];\nconst scan = (el, tag) => {\n  const cs = getComputedStyle(el, tag || null);\n  const bl = /blur\\(([\\d.]+)px\\)/.exec(cs.filter || '');\n  const an = cs.animationName && cs.animationName !== 'none';\n  if (!bl || !an) return;\n  const r = el.getBoundingClientRect();\n  if (r.width < 1) return;\n  const cls = (el.className || '').toString().replace(/x-risu-/g, '').split(' ')[0] || el.tagName;\n  rows.push({ cls: cls + (tag || ''), blur: +bl[1], w: Math.round(r.width), h: Math.round(r.height),\n              anim: cs.animationName.split(' ')[0].slice(0, 20),\n              px: Math.round(r.width * r.height * 9 / 1000) });\n};\nfor (const el of document.querySelectorAll('*')) { scan(el, null); scan(el, '::before'); scan(el, '::after'); }\nconst agg = {};\nfor (const r of rows) { const k = r.cls + '|' + r.blur + '|' + r.w + 'x' + r.h + '|' + r.anim;\n  agg[k] = (agg[k] || 0) + 1; }\nreturn { total: rows.length, agg };\n})()";

const script = `const {chromium}=require('playwright-core');
(async()=>{ const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try { const page=await browser.newPage({viewport:{width:411,height:891},deviceScaleFactor:3});
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="itemx2-root"></div></body></html>');
  await page.evaluate(()=>{const store=new Map();window.Risuai={pluginStorage:{getItem:async k=>store.get(k)??null,setItem:async(k,v)=>store.set(k,v)},getDatabase:async()=>({}),nativeFetch:async()=>({}),};});
  await page.evaluate('globalThis.ITEMX_CARDS=1');
  await page.evaluate(${JSON.stringify(fixture)});
  await page.evaluate(([t,s])=>itemxAudit.setup(t,s),['full','aff:mixed']);
  await page.waitForTimeout(300);
  console.log('@@'+JSON.stringify(await page.evaluate(${JSON.stringify(probe)})));
} finally { await browser.close(); } })().catch(e=>{console.error(e);process.exit(1);});`;
await mkdir(new URL('../artifacts/ui/', import.meta.url), { recursive: true });
const runner = new URL('../artifacts/ui/blocker-runner.cjs', import.meta.url);
await writeFile(runner, script);
const raw = execFileSync('node', [runner.pathname], { encoding: 'utf8' });
const line = raw.split('\n').find((l) => l.startsWith('@@'));
if (!line) { console.log(raw.slice(-800)); process.exit(1); }
const out = JSON.parse(line.slice(2));
console.log(`블러 + 애니메이션이 같이 걸린 요소: ${out.total}개`);
for (const [k, v] of Object.entries(out.agg).sort((a,b)=>b[1]-a[1])) {
  const [cls, blur, size, anim] = k.split('|');
  console.log(`  ${String(v).padStart(3)}개  ${cls.padEnd(26)} blur${blur.padEnd(4)} ${size.padEnd(10)} ${anim}`);
}
