import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const bundle=await readFile('dist/itemx2.plugin.js','utf8'),anchor='  try {\n    await loadBadgePosition();';
const fixture=bundle.replace(anchor,`globalThis.fixture=()=>{
const item=ITEMXCore.normalizeItem({id:'fixture',name:'경계 렌더 검사',rarity:'legendary',affinity:'lightning',itemType:'검',count:1,power:'123',trivia:'카드 경계와 레이아웃 검증'}).item;
return {css:mainStyleText(),html:displayHandler(ITEMXCore.marker({v:2,event:{kind:'exam',item},view:item}))};};return;${anchor}`);
const script=`const {chromium}=require('playwright-core');(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results=[];const deadline=setTimeout(()=>browser.close(),45000);deadline.unref();try{
for(const mode of ['contain-only','auto-520','auto-measured'])for(let run=0;run<3;run++){
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.setContent('<html><head></head><body><div class="chattext"></div></body></html>');await page.evaluate(()=>window.Risuai={});await page.evaluate(${JSON.stringify(fixture)});
 const result=await page.evaluate(async({mode,run})=>{
 const {css,html}=fixture();const style=document.createElement('style');style.textContent=css+'.chattext *,.chattext *::before,.chattext *::after{animation:none!important}';document.head.append(style);
 const chat=document.querySelector('.chattext');const start=performance.now();chat.innerHTML=html.repeat(120);for(const tag of chat.querySelectorAll('style'))tag.remove();for(const node of chat.querySelectorAll('[class]'))node.className=[...node.classList].map(c=>'x-risu-'+c).join(' ');
 const card=chat.querySelector('.x-risu-itemx-card');if(!card)throw Error('missing real card');
 const sizing=document.createElement('style');document.head.append(sizing);
 let measurementMs=0,intrinsic=520;
 if(mode==='auto-measured'){const t=performance.now();intrinsic=card.getBoundingClientRect().height;measurementMs=performance.now()-t;}
 sizing.textContent='.x-risu-itemx-card{animation-play-state:paused!important;'+(mode==='contain-only'?'':'content-visibility:auto;contain-intrinsic-size:auto '+intrinsic+'px;')+'}';
 const initialHeight=chat.offsetHeight,initialLayoutMs=performance.now()-start;
 let shifted=0,lastHeight=initialHeight,maxFrameMs=0;const frames=[];let prev=performance.now();
 for(let i=0;i<40;i++){scrollTo(0,i*180);await new Promise(r=>requestAnimationFrame(r));const now=performance.now();frames.push(now-prev);prev=now;const height=chat.offsetHeight;shifted+=Math.abs(height-lastHeight);lastHeight=height;}
 frames.sort((a,b)=>a-b);return {mode,run,cards:120,intrinsic,measurementMs,initialLayoutMs,initialHeight,finalHeight:lastHeight,cumulativeHeightChange:shifted,frameP95:frames[Math.floor(frames.length*.95)]};
 },{mode,run});results.push(result);await page.close();}
console.log(JSON.stringify({engine:browser.version(),viewport:'390x844 desktop headless Chromium; FX disabled to isolate layout',results}));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});`;
const result=JSON.parse(execFileSync('docker',['exec','-i','claudex-workhouse-browser-runtime','node'],{input:script,encoding:'utf8',timeout:90000,maxBuffer:4e6}));
await mkdir('artifacts/performance',{recursive:true});await writeFile('artifacts/performance/card-layout-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
