import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const bundle=await readFile(new URL('../dist/itemx2.plugin.js',import.meta.url),'utf8');
const anchor='  try {\n    await loadBadgePosition();';
if(!bundle.includes(anchor))throw Error('bootstrap anchor missing');
const fixture=bundle.replace(anchor,`
  globalThis.probe={heavy:0,violations:0,commits:0, async setup(){
    const style=document.createElement('style');style.textContent=mainStyleText();document.head.append(style);
    const affinities=Object.keys(ITEMXRenderer.affinities);
    const cards=affinities.map((affinity,i)=>{const item=ITEMXCore.normalizeItem({id:'fx'+i,name:affinity,rarity:'legendary',affinity,count:1}).item;return displayHandler(ITEMXCore.marker({v:2,event:{kind:'exam',item},view:item}));});
    const monster={id:'threat',name:'Threat ring',glyph:'🐲',status:'active',relation:'hostile',rarity:'legendary'};
    cards.push(displayHandler(ITEMXCodex.marker({v:1,event:{kind:'exam',domain:'monster',entity:monster},view:monster})));
    const chat=document.querySelector('.chattext');chat.innerHTML=cards.join('').repeat(3);
    // Official host rendering prefixes classes. The plugin installs the scoped
    // stylesheet separately; do not accidentally measure unscoped fixture CSS.
    for(const style of chat.querySelectorAll('style'))style.remove();
    for(const node of chat.querySelectorAll('[class]'))node.className=[...node.classList].map(name=>'x-risu-'+name).join(' ');
    const second=chat.cloneNode(true);document.body.append(second);
    const port=node=>node&&({querySelector:async s=>port(node.querySelector(s)),getParent:async()=>port(node.parentElement),addClass:async c=>node.classList.add(c),removeClass:async c=>node.classList.remove(c),addEventListener:async(t,f,c)=>{node.addEventListener(t,f,c);return f},removeEventListener:async(t,f,c)=>node.removeEventListener(t,f,c)});
    hostState.mainDoc=port(document);pipelineState.activeContextKey='fixture';
    const heavy=()=>{probe.heavy++;if(presentationState.bodyFxScrollActive)probe.violations++};
    catchUpLatestOutput=async()=>{heavy()};rebuildCurrent=async()=>{heavy();probe.commits++;return null};ensureRootInventory=async()=>{heavy()};syncHostSettingsVisibility=async()=>{};
    await installBodyEffectGovernor();
    return {affinities,chatContainers:2,cards:chat.children.length+second.children.length};
  },active:()=>presentationState.bodyFxScrollActive,queue:()=>{void scheduleCommittedOutputSync();void scheduleCommittedOutputSync();void scheduleCommittedOutputSync()},
  startModel:()=>{void dispatch('aux',()=>workQueue.external(()=>new Promise(resolve=>{probe.releaseModel=resolve})))},
  done:()=>workQueue.close()};return;
${anchor}`);
const script=`const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results=[];try{
for(const width of [390,900]){
const page=await browser.newPage({viewport:{width,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setContent('<html><head><style>body{margin:0}.chattext{height:720px;overflow:auto}</style></head><body><div class="chattext"></div></body></html>');
await page.evaluate(()=>window.Risuai={});await page.evaluate(${JSON.stringify(fixture)});const setup=await page.evaluate(()=>probe.setup());
await page.waitForTimeout(100);
const before=await page.evaluate(()=>document.body.getAnimations({subtree:true}).filter(a=>a.playState==='running').length);
if(!before)throw Error('fixture has no active FX');
await page.evaluate(()=>probe.startModel());await page.waitForFunction(()=>typeof probe.releaseModel==='function');
await page.locator('.chattext').first().hover();await page.mouse.wheel(0,220);
await page.evaluate(()=>{probe.scrollInterval=setInterval(()=>{document.querySelector('.chattext').scrollTop+=3},16)});
const start=Date.now();
const during=await(await page.waitForFunction(()=>{
  if(!probe.active())return false;
  probe.queue();
  return {active:probe.active(),ownerClass:document.body.className,heavy:probe.heavy,running:document.body.getAnimations({subtree:true}).filter(a=>a.playState==='running').map(a=>({name:a.animationName,target:a.effect.target.className,pseudo:a.effect.pseudoElement})),paused:document.body.getAnimations({subtree:true}).filter(a=>a.playState==='paused').length};
})).jsonValue();
if(during.heavy)throw Error('heavy work ran during scroll');
if(!during.active)throw Error('fixture stopped scrolling before measurement');
await page.evaluate(()=>clearInterval(probe.scrollInterval));
await page.waitForFunction(()=>!probe.active());
const endWhileModelPending=await page.evaluate(()=>probe.heavy===0);
await page.evaluate(()=>probe.releaseModel());
await page.waitForFunction(()=>probe.commits===1);
// Repeat without a suspended model: only scroll readiness can hold this batch.
await page.evaluate(()=>{probe.scrollInterval=setInterval(()=>{document.querySelector('.chattext').scrollTop+=3},16)});
await page.waitForFunction(()=>{if(!probe.active())return false;probe.queue();return true});
await page.waitForTimeout(80);
await page.evaluate(()=>clearInterval(probe.scrollInterval));
await page.waitForFunction(()=>!probe.active());
await page.waitForFunction(()=>probe.commits>=2);await page.waitForTimeout(260);
const after=await page.evaluate(()=>({heavy:probe.heavy,committedBatches:probe.commits,heavyCallsDuringScroll:probe.violations,running:document.body.getAnimations({subtree:true}).filter(a=>a.playState==='running').length,active:probe.active()}));
if(after.active||!after.running)throw Error('FX failed to resume');
if(after.heavyCallsDuringScroll||after.committedBatches!==2)throw Error('scroll work deferral or deduplication failed');
if(errors.length)throw Error(errors.join(';'));
results.push({width,...setup,activeAnimationsBefore:before,scroll: during,scrollEndWhileModelPending:endWhileModelPending,scenarioWallMs:Date.now()-start,after});
await page.evaluate(()=>probe.done());await page.close();
}console.log(JSON.stringify(results));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});`;
const results=JSON.parse(execFileSync('docker',['exec','-i','claudex-workhouse-browser-runtime','node'],{input:script,encoding:'utf8',timeout:90000,maxBuffer:4e6}));
await mkdir(new URL('../artifacts/performance/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/performance/scroll.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(row=>({...row,scroll:{...row.scroll,running:row.scroll.running.length,runningNames:[...new Set(row.scroll.running.map(x=>x.name))]}})),null,2));
if(results.some(row=>row.scroll.running.length))throw Error('Some FX still animate during scrolling; see scroll.json');
