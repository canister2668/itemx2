import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const bundle = await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');
const anchor = '  try {\n    await loadBadgePosition();';
const fixture = bundle.replace(anchor, `
  globalThis.itemxAudit = {
    run: async (hook) => { const a = rootSettingActions().find(x => x.hook === hook);
      if (!a) return 'no action'; try { await a.run(); return 'ok'; } catch (e) { return 'throw: ' + (e && e.message); } },
    async setup(tab, skin) {
    const root = document.querySelector('#itemx2-root');
    const names = ['청상벽려검(靑霜霹靂劍)','흑염단마도','칠성벽해인','만겁유혼검','태을진령비갑','태초무극검','단검','목걸이'];
    const items = names.map((name,i) => ITEMXCore.normalizeItem({
      id:'item'+i, name, type:i%2?'장신구':'검', internalrarity:i<3?'legendary':'rare',
      affinity:['fire','ice','lightning','wind','earth',null,null,null][i],
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
    const hostPort = (node) => ({ node,
      querySelector: async (sel) => { const el = node.querySelector(sel); return el ? hostPort(el) : null; },
      addClass: async (v) => node.classList.add(v),
      removeClass: async (v) => node.classList.remove(v),
      setAttribute: async (k, v) => node.setAttribute(k, v),
      setTextContent: async (v) => { node.textContent = v; },
      setInnerHTML: async (v) => { node.innerHTML = v; },
      getBoundingClientRect: async () => node.getBoundingClientRect() });
    hostState.mainDoc=hostPort(document); installMainStyle=async()=>true;
    uiState.rootOpen=true; uiState.activeRootTab=tab;
    presentationState.visualSkin=skin;
    document.head.innerHTML='<style>'+mainStyleText()+'</style>';
    document.head.insertAdjacentHTML('beforeend','<style>*,*::before,*::after{transition:none!important;animation:none!important}</style>');
    root.className='x-risu-itemx2-root-drawer x-risu-itemx2-pos-rb x-risu-itemx2-is-open x-risu-itemx2-font-small x-risu-itemx2-skin-'+skin;
    const prefixMarkup = html => html.replace(/class="([^"]*)"/g, (_, list) =>
      'class="' + list.trim().split(/\\s+/).filter(Boolean)
        .map(c => c.startsWith('x-risu-') ? c : 'x-risu-' + c).join(' ') + '"');
    root.innerHTML=prefixMarkup(rootInventoryHtml(loaded,true,tab));
    const radio = document.querySelector('#itemx2-tab-' + tab) || document.querySelector('.x-risu-itemx2-tab-' + tab);
    if (radio) radio.checked = true;
    return true;
  }};
  return;
${anchor}`);
if (fixture === bundle) throw new Error('bootstrap anchor missing');


const probe = "(async () => {\nconst p = document.querySelector('.x-risu-itemx2-sw-power');\nconst pick = (el, ps) => { const c = getComputedStyle(el, ps);\n  return { content: c.content, w: c.width, h: c.height, bg: c.backgroundColor, radius: c.borderRadius }; };\nconst before = { after: pick(p,'::after'), bef: pick(p,'::before'), text: JSON.stringify(p.textContent), cls: p.className.toString().replace(/x-risu-/g,'') };\nawait itemxAudit.run('itemx2-setting-toggle');\nconst off = { color: getComputedStyle(p).color, bg: getComputedStyle(p).backgroundColor, dot: getComputedStyle(p,'::before').backgroundColor };\nreturn { before, off };\n})()";

const script = `const {chromium}=require('playwright-core');
(async()=>{ const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try { const page=await browser.newPage({viewport:{width:411,height:891},deviceScaleFactor:3});
  page.on('pageerror', e => console.log('PAGEERROR ' + e.message));
  await page.setContent('<html><head></head><body style="margin:0"><div id="itemx2-root"></div></body></html>');
  await page.evaluate(()=>{const store=new Map();window.Risuai={pluginStorage:{getItem:async k=>store.get(k)??null,setItem:async(k,v)=>store.set(k,v)},getDatabase:async()=>({}),nativeFetch:async()=>({}),};});
  await page.evaluate(${JSON.stringify(fixture)});
  await page.evaluate(([t,s])=>itemxAudit.setup(t,s),['settings','dark']);
  await page.waitForTimeout(250);
  const r = await page.evaluate(${JSON.stringify(probe)});
  console.log('@@'+JSON.stringify(r));
} finally { await browser.close(); } })().catch(e=>{console.error(e);process.exit(1);});`;
await mkdir(new URL('../artifacts/ui/', import.meta.url), { recursive: true });
const runner = new URL('../artifacts/ui/probe-runner.cjs', import.meta.url);
await writeFile(runner, script);
const raw = execFileSync('node', [runner.pathname], { encoding: 'utf8' });
const line = raw.split('\n').find((l) => l.startsWith('@@'));
if (!line) { console.log(raw.slice(-900)); process.exit(1); }
const out = JSON.parse(line.slice(2));
console.log(JSON.stringify(out, null, 1));
