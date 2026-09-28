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



const probe = "(() => {\n// \uc560\ub2c8\uba54\uc774\uc158\uc774 \ud544\ud130/\ube14\ub80c\ub4dc \uc11c\ube0c\ud2b8\ub9ac \uc548\uc5d0 \uc788\uc73c\uba74 \ud569\uc131\uae30\uc5d0\uc11c \ubabb \ub3c8\ub2e4.\n// \uc5b4\ub290 \uc870\uc0c1\uc774 \uac00\ub450\uace0 \uc788\ub294\uc9c0 \uc774\ub984\uc73c\ub85c \uc9d1\uacc4\ud55c\ub2e4.\nconst blockers = {};\nlet animated = 0, blocked = 0;\nfor (const el of document.querySelectorAll('*')) {\n  const cs = getComputedStyle(el);\n  if (!cs.animationName || cs.animationName === 'none') continue;\n  if (el.getBoundingClientRect().width < 1) continue;\n  animated++;\n  let n = el, found = null;\n  while (n && n !== document.documentElement) {\n    const c = getComputedStyle(n);\n    const why = (c.filter && c.filter !== 'none') ? 'filter'\n              : (c.mixBlendMode && c.mixBlendMode !== 'normal') ? 'blend' : null;\n    if (why) { const cls = (n.className||'').toString().replace(/x-risu-/g,'').split(' ')[0] || n.tagName;\n      found = why + ' @ ' + cls + (n === el ? ' (\uc790\uae30\uc790\uc2e0)' : ' (\uc870\uc0c1)'); break; }\n    n = n.parentElement;\n  }\n  if (found) { blocked++; blockers[found] = (blockers[found] || 0) + 1; }\n}\nreturn { animated, blocked, blockers };\n})()";

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
console.log(`애니메이션 ${out.animated}개 중 합성 차단 ${out.blocked}개`);
for (const [k, v] of Object.entries(out.blockers).sort((a,b)=>b[1]-a[1]))
  console.log(`  ${String(v).padStart(3)}개  ${k}`);
