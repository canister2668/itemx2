import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const bundle = await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');
const anchor = '  try {\n    await loadBadgePosition();';
const fixture = bundle.replace(anchor, `
  globalThis.itemxAudit = { async setup(tab, skin) {
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
    hostState.mainDoc=nativeElement(document); installMainStyle=async()=>true;
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

// page.evaluate runs a string as a script, so the probe wraps its own return.
const probe = `(() => {
const rect = el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; };
const lum = c => { const m=c.match(/[\\d.]+/g)||[0,0,0]; const f=m.slice(0,3).map(v=>{v=v/255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}); return 0.2126*f[0]+0.7152*f[1]+0.0722*f[2]; };
const contrast = (a,b) => { const l1=lum(a),l2=lum(b); return ((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)); };
const parse = c => { const m = (c || '').match(/[\d.]+/g) || [0,0,0]; return { r:+m[0]||0, g:+m[1]||0, b:+m[2]||0, a: m.length > 3 ? +m[3] : 1 }; };
const transparent = c => { const p = parse(c); return !c || p.a === 0; };
// A translucent layer is not the colour the reader sees: it has to be composited
// over whatever is behind it, or a 14% tint of the text colour measures as the
// text colour and reports a contrast of 1.0 where the real one is fine.
const bgOf = el => {
  const stack = [];
  let n = el;
  while (n && n !== document.documentElement) {
    const c = getComputedStyle(n).backgroundColor, p = parse(c);
    if (p.a > 0) { stack.push(p); if (p.a >= 1) break; }
    n = n.parentElement;
  }
  const base = (() => {
    const panelEl = document.querySelector('.x-risu-itemx-panel');
    const p = parse(panelEl ? getComputedStyle(panelEl).backgroundColor : '');
    return p.a >= 1 ? p : { r:0, g:0, b:0, a:1 };
  })();
  let out = stack.length && stack[stack.length-1].a >= 1 ? stack.pop() : base;
  while (stack.length) {
    const top = stack.pop();
    out = { r: top.r*top.a + out.r*(1-top.a), g: top.g*top.a + out.g*(1-top.a), b: top.b*top.a + out.b*(1-top.a), a:1 };
  }
  return 'rgb(' + Math.round(out.r) + ', ' + Math.round(out.g) + ', ' + Math.round(out.b) + ')';
};
const panel = document.querySelector('.x-risu-itemx2-root-panel');
const pr = panel ? rect(panel) : null;
let out_debug; const out = { panel: pr, touch: [], overflow: [], contrast: [], truncated: [] };
out_debug = {
  rootClass: document.querySelector('#itemx2-root')?.className || '(none)',
  firstLevels: [...document.querySelectorAll('#itemx2-root > *, #itemx2-root > * > *')].slice(0,6).map(e=>e.className.toString().slice(0,90)),
  styleLen: (document.head.querySelector('style')?.textContent || '').length,
  panelFound: !!panel,
  sampleBtn: (() => { const b=document.querySelector('[class*=ph-btn]'); if(!b) return null; const c=getComputedStyle(b); return {cls:b.className.toString().slice(0,60), w:c.width, h:c.height}; })()
};
for (const el of document.querySelectorAll('button, label[for], [role="switch"], [role="button"], a')) {
  const r = rect(el); if (r.w === 0 || r.h === 0) continue;
  const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24);
  const cls = (el.className || '').toString().replace(/x-risu-/g,'').split(' ').filter(Boolean)[0] || el.tagName;
  let hw = r.w, hh = r.h;
  for (const pseudo of ['::before', '::after']) {
    const ps = getComputedStyle(el, pseudo);
    if (ps.content === 'none') continue;
    const pw = parseFloat(ps.width), ph = parseFloat(ps.height);
    if (ps.position === 'absolute' && pw > hw) hw = pw;
    if (ps.position === 'absolute' && ph > hh) hh = ph;
  }
  // 43.99 rounds to 44; a half-pixel under the guideline is not a finding.
  if (hw < 43.5 || hh < 43.5)
    out.touch.push({ cls, label, w: Math.round(r.w), h: Math.round(r.h), hit: Math.round(hw) + 'x' + Math.round(hh) });
}
for (const el of document.querySelectorAll('*')) {
  const r = rect(el); if (r.w === 0) continue;
  if (pr && (r.x < pr.x - 1 || r.x + r.w > pr.x + pr.w + 1)) {
    const cls=(el.className||'').toString().replace(/x-risu-/g,'').split(' ').filter(Boolean)[0]||el.tagName;
    if(!out.overflow.some(o=>o.cls===cls)) out.overflow.push({ cls, x: Math.round(r.x), right: Math.round(r.x+r.w), panelRight: Math.round(pr.x+pr.w) });
  }
  if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && el.textContent.trim()) {
    const cls=(el.className||'').toString().replace(/x-risu-/g,'').split(' ').filter(Boolean)[0]||el.tagName;
    if(!out.truncated.some(o=>o.cls===cls)) out.truncated.push({ cls, text: el.textContent.trim().slice(0,20), scroll: el.scrollWidth, client: el.clientWidth });
  }
  if (el.children.length === 0 && el.textContent.trim().length > 1 && r.w > 0 && r.h > 0) {
    const s = getComputedStyle(el), size = parseFloat(s.fontSize);
    const ratio = contrast(s.color, bgOf(el));
    const need = size >= 18.66 || (size >= 14 && s.fontWeight >= 700) ? 3 : 4.5;
    if (ratio < need) {
      const cls=(el.className||'').toString().replace(/x-risu-/g,'').split(' ').filter(Boolean)[0]||el.tagName;
      if(!out.contrast.some(o=>o.cls===cls)) out.contrast.push({ cls, text: el.textContent.trim().slice(0,16), ratio: +ratio.toFixed(2), need, size: Math.round(size) });
    }
  }
}
out.panelBg = (() => {
  const el = document.querySelector('.x-risu-itemx-panel');
  if (!el) return '(패널 요소 없음)';
  const st = getComputedStyle(el);
  return { cls: el.className.toString().slice(0,70), bg: st.backgroundColor, matches: el.matches('.x-risu-itemx-panel') };
})();
out.probe = [...document.querySelectorAll('.x-risu-itemx-ph-title, .x-risu-itemx-main-tab')].map(el => {
  const st = getComputedStyle(el);
  let n = el, bg = null, bgEl = null;
  while (n && n !== document.documentElement) { const c = getComputedStyle(n).backgroundColor; if (!transparent(c)) { bg = c; bgEl = (n.className||'').toString().replace(/x-risu-/g,'').split(' ')[0]; break; } n = n.parentElement; }
  return { text: el.textContent.trim().slice(0,10), color: st.color, composited: bgOf(el), bgFrom: bgEl, parentCls: (el.parentElement.className||'').toString().replace(/x-risu-/g,'').split(' ').slice(0,3).join(' ') };
});
out.debug = out_debug;
return out;
})()`;

const script = `const {chromium}=require('playwright-core');
(async()=>{ const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
try {
  for (const skin of ['dark','frost','hanji'])
  for (const tab of ['inventory','skills','bestiary','settings']) {
    const page=await browser.newPage({viewport:{width:411,height:891},deviceScaleFactor:3});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.setContent('<html><head></head><body style="margin:0"><div id="itemx2-root"></div></body></html>');
    await page.evaluate(()=>{const store=new Map();window.Risuai={pluginStorage:{getItem:async k=>store.get(k)??null,setItem:async(k,v)=>store.set(k,v)},getDatabase:async()=>({}),nativeFetch:async()=>({}),};});
    await page.evaluate(${JSON.stringify(fixture)});
    await page.evaluate(([t,s])=>itemxAudit.setup(t,s),[tab,skin]);
    await page.waitForTimeout(120);
    const data=await page.evaluate(${JSON.stringify(probe)});
    results.push({skin,tab,errors,...data});
    await page.close();
  }
} finally { await browser.close(); }
process.stdout.write(JSON.stringify(results));
})();`;

// The bundle is far past the argv limit, so the runner goes to a file.
const runner = new URL('../artifacts/ui/runner.cjs', import.meta.url);
await mkdir(new URL('../artifacts/ui/', import.meta.url), { recursive: true });
await writeFile(runner, script);
const raw = execFileSync('node', [runner.pathname], { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
const results = JSON.parse(raw);
await mkdir(new URL('../artifacts/ui/', import.meta.url), { recursive: true });
await writeFile(new URL('../artifacts/ui/audit.json', import.meta.url), JSON.stringify(results, null, 1));

const agg = (key) => {
  const seen = new Map();
  for (const r of results) for (const row of r[key]) {
    const k = JSON.stringify(row);
    if (!seen.has(k)) seen.set(k, { ...row, where: [] });
    seen.get(k).where.push(`${r.skin}/${r.tab}`);
  }
  return [...seen.values()];
};
console.log('=== 패널 ===', results[0].panel && `${Math.round(results[0].panel.w)}×${Math.round(results[0].panel.h)} @411×891`);
console.log('오류:', results.flatMap(r => r.errors).length);
for (const r of results) if (r.tab === 'settings') console.log(r.skin, 'panelBg=', JSON.stringify(r.panelBg));
for (const [ko, key] of [['터치 타깃 44px 미만', 'touch'], ['패널 밖으로 넘침', 'overflow'], ['글자 잘림', 'truncated'], ['대비 부족', 'contrast']]) {
  const rows = agg(key);
  console.log(`\n=== ${ko}: ${rows.length}건 ===`);
  for (const row of rows.slice(0, 12)) {
    const { where, ...rest } = row;
    console.log(' ', JSON.stringify(rest), where.length > 6 ? `(${where.length}곳)` : where.join(','));
  }
}
