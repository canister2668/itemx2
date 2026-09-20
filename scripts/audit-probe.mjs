import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const bundle = await readFile(process.env.ITEMX_PROBE_BUNDLE || new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');
const anchor = '  try {\n    await loadBadgePosition();';
const fixture = bundle.replace(anchor, `
  globalThis.itemxAudit = {
    run: async (hook) => { const a = rootSettingActions().find(x => x.hook === hook);
      if (!a) return 'no action'; try { await a.run(); return 'ok'; } catch (e) { return 'throw: ' + (e && e.message); } },
    async setup(tab, skin, surface = 'host', strict = true) {
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
    // Match SafeElement's attribute restriction and literal class operations.
    // No class prefix stripping, and host/iframe documents are separate.
    const trace = globalThis.itemxProbeTrace = [];
    const hostPort = (node) => ({
      querySelector: async (sel) => {
        const el = node.querySelector(sel);
        if (el && /setting-(main|toggle)$/.test(sel)) trace.push({ op: 'query', selector: sel,
          document: el.ownerDocument === document ? 'visible' : 'hidden-host',
          connected: el.isConnected, width: el.getBoundingClientRect().width });
        return el ? hostPort(el) : null;
      },
      addClass: async (v) => { trace.push({ op: 'addClass', value: v }); node.classList.add(v); },
      removeClass: async (v) => { trace.push({ op: 'removeClass', value: v }); node.classList.remove(v); },
      setAttribute: async (k, v) => {
        trace.push({ op: 'setAttribute', key: k, rejected: strict && !k.startsWith('x-') });
        if (strict && !k.startsWith('x-')) throw new Error("Can only set attributes starting with 'x-' for security reasons. for other attributes, use dedicated methods.");
        node.setAttribute(k, v);
      },
      getOuterHTML: async () => node.outerHTML,
      // The markup under test is plugin-generated buttons (no unsafe content).
      // Production SafeElement additionally sanitizes these HTML writes.
      setOuterHTML: async v => { trace.push({ op: 'setOuterHTML' }); node.outerHTML = v; },
      focus: async () => node.focus(),
      setTextContent: async (v) => { node.textContent = v; },
      setInnerHTML: async (v) => { node.innerHTML = v; },
      getBoundingClientRect: async () => node.getBoundingClientRect() });
    let hostDocument = document;
    if (surface !== 'host') {
      const frame = document.createElement('iframe'); frame.hidden = true; document.body.appendChild(frame);
      hostDocument = frame.contentDocument;
      hostDocument.body.innerHTML = '<div id="host-copy"></div>';
    }
    hostState.mainDoc=hostPort(hostDocument); installMainStyle=async()=>true;
    uiState.panelOpen = surface !== 'host';
    globalThis.itemxProbeHost = hostDocument;
    uiState.rootOpen=true; uiState.activeRootTab=tab;
    presentationState.visualSkin=skin;
    document.head.innerHTML='<style>'+mainStyleText()+'</style>';
    document.head.insertAdjacentHTML('beforeend','<style>*,*::before,*::after{transition:none!important;animation:none!important}</style>');
    root.className='x-risu-itemx2-root-drawer x-risu-itemx2-pos-rb x-risu-itemx2-is-open x-risu-itemx2-font-small x-risu-itemx2-skin-'+skin;
    const prefixMarkup = html => html.replace(/class="([^"]*)"/g, (_, list) =>
      'class="' + list.trim().split(/\\s+/).filter(Boolean)
        .map(c => c.startsWith('x-risu-') ? c : 'x-risu-' + c).join(' ') + '"');
    const html = rootInventoryHtml(loaded,true,tab);
    root.innerHTML = surface === 'host' ? prefixMarkup(html) : html;
    if (surface !== 'host') {
      if (surface === 'dual') hostDocument.querySelector('#host-copy').innerHTML = prefixMarkup(html);
      root.className = root.className.replaceAll('x-risu-', '') + ' itemx2-frame';
      document.head.innerHTML = fallbackDocumentHead();
      document.head.insertAdjacentHTML('beforeend','<style>*,*::before,*::after{transition:none!important;animation:none!important}</style>');
    }
    if (!document.querySelector('meta[name="viewport"]'))
      document.head.insertAdjacentHTML('afterbegin','<meta name="viewport" content="width=device-width, initial-scale=1">');
    globalThis.itemxProbeSettings = () => outputSettings(loaded.character, { refresh: true });
    const radio = document.querySelector('#itemx2-tab-' + tab) || document.querySelector('.x-risu-itemx2-tab-' + tab);
    if (radio) radio.checked = true;
    return true;
  }};
  return;
${anchor}`);
if (fixture === bundle) throw new Error('bootstrap anchor missing');


const probe = async ({ hook, key, onClass, surface }) => {
  const prefix = surface === 'host' ? 'x-risu-' : '';
  const selector = '.' + prefix + hook;
  const sample = () => {
    const el = document.querySelector(selector);
    const style = getComputedStyle(el);
    return { on: el.classList.contains(prefix + onClass), aria: el.getAttribute('aria-checked'),
      knob: !!el.querySelector('i'), background: style.backgroundColor,
      dot: getComputedStyle(el, '::before').backgroundColor,
      transform: el.querySelector('i') ? getComputedStyle(el.querySelector('i')).transform : null };
  };
  const before = sample();
  const visible = document.querySelector(selector);
  visible.focus();
  const sibling = document.querySelector('.' + prefix + (hook.endsWith('main') ? 'itemx2-setting-toggle' : 'itemx2-setting-main'));
  const hostCopy = globalThis.itemxProbeHost === document ? null : globalThis.itemxProbeHost.querySelector('.x-risu-' + hook);
  const hiddenBefore = hostCopy?.outerHTML;
  const rounds = [];
  for (const expected of [false, true]) {
    const result = await itemxAudit.run(hook);
    const saved = await itemxProbeSettings();
    rounds.push({ expected, result, stored: saved[key], visual: sample(),
      hiddenUntouched: !hostCopy || hiddenBefore === globalThis.itemxProbeHost.querySelector('.x-risu-' + hook).outerHTML,
      focused: document.activeElement === document.querySelector(selector) });
  }
  return { hook, before, rounds, trace: itemxProbeTrace,
    siblingRetained: sibling.isConnected,
    hiddenUntouched: !hostCopy || hiddenBefore === globalThis.itemxProbeHost.querySelector('.x-risu-' + hook).outerHTML };
};

const script = `const {chromium}=require('playwright-core');
(async()=>{ const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
try {
  for (const [surface, strict] of [['host',true],['native',true],['dual',true],['dual',false]])
  for (const [hook,key,onClass] of [
    ['itemx2-setting-main','mainOutput','itemx2-setting-on'],
    ['itemx2-setting-toggle','enabled','itemx2-power-on'],
    ['itemx2-setting-effects','effectsEnabled','itemx2-setting-on'],
    ['itemx2-setting-lorebook','lorebookEncounterEnabled','itemx2-setting-on']
  ]) {
    const page=await browser.newPage({viewport:{width:411,height:891},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const errors=[]; page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<html><head></head><body style="margin:0"><div id="itemx2-root"></div></body></html>');
    await page.evaluate(()=>{const store=new Map();window.Risuai={pluginStorage:{getItem:async k=>store.get(k)??null,setItem:async(k,v)=>store.set(k,v)},getDatabase:async()=>({}),nativeFetch:async()=>({}),};});
    await page.evaluate(${JSON.stringify(fixture)});
    await page.evaluate(([surface,strict])=>itemxAudit.setup('settings','dark',surface,strict),[surface,strict]);
    const data = await page.evaluate(${probe.toString()}, {hook,key,onClass,surface});
    results.push({surface,strict,errors,...data});
    await page.close();
  }
  console.log('@@'+JSON.stringify(results));
} finally { await browser.close(); } })().catch(e=>{console.error(e);process.exit(1);});`;
await mkdir(new URL('../artifacts/ui/', import.meta.url), { recursive: true });
const runner = new URL('../artifacts/ui/probe-runner.cjs', import.meta.url);
await writeFile(runner, script);
const raw = execFileSync('node', [runner.pathname], { encoding: 'utf8' });
const line = raw.split('\n').find((l) => l.startsWith('@@'));
if (!line) { console.log(raw.slice(-900)); process.exit(1); }
const out = JSON.parse(line.slice(2));
await writeFile(new URL('../artifacts/ui/toggle-probe.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
if (!process.env.ITEMX_PROBE_DIAGNOSE) {
  const failures = out.filter(row => row.errors.length || !row.siblingRetained || !row.hiddenUntouched ||
    row.rounds.some(r => r.result !== 'ok' || r.visual.on !== r.stored ||
      r.visual.aria !== String(r.stored) || r.visual.knob !== row.before.knob || !r.focused || !r.hiddenUntouched) ||
    !['background', 'dot', 'transform'].some(key => row.before[key] !== row.rounds[0].visual[key]));
  if (failures.length) throw new Error(`Toggle bridge regression: ${failures.length}/${out.length} scenarios failed`);
}
