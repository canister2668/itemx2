import vm from 'node:vm';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const anchor='  try {\n    await loadBadgePosition();';
async function styles(revision) {
  const source=revision?execFileSync('git',['show',`${revision}:dist/itemx2.plugin.js`],{maxBuffer:4e6,encoding:'utf8'}):await readFile(new URL('../dist/itemx2.plugin.js',import.meta.url),'utf8');
  const context=vm.createContext({TextEncoder,TextDecoder,Buffer,console,setTimeout,clearTimeout,setInterval,clearInterval,Risuai:{}});
  assert.ok(source.includes(anchor));
  await vm.runInContext(source.replace(anchor,`globalThis.styles={ main:mainStyleText(), shell:ITEMX_STYLE, inline:ITEMX_CODEX_INLINE_STYLE+ITEMX_CODEX_INLINE_DENSE_STYLE+ITEMX_CODEX_INLINE_APPRAISAL_STYLE, controls:ITEMX_CONTROL_STYLE, skins:skinStyleSheet(), badge:badgeStyle(), codex:codexPageStyle(), scroll:bodyScrollStyle, effects:bodyEffectsStyle, settings:ITEMX_SETTINGS_STYLE };return;${anchor}`),context);
  return context.styles;
}
const inputs={beforeSplit:await styles('f131ad2'),afterSplit:await styles('869ffa5'),current:await styles()};
const script=`const {chromium}=require('playwright-core');(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{const page=await browser.newPage();console.log(JSON.stringify(await page.evaluate(inputs=>Object.fromEntries(Object.entries(inputs).map(([version,parts])=>[version,Object.fromEntries(Object.entries(parts).map(([name,css])=>{const sheet=new CSSStyleSheet();sheet.replaceSync(css);return [name,[...sheet.cssRules].map(rule=>rule.cssText)]}))])),${JSON.stringify(inputs)})));}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});`;
const parsed=JSON.parse(execFileSync('docker',['exec','-i','claudex-workhouse-browser-runtime','node'],{input:script,encoding:'utf8',timeout:60000,maxBuffer:12e6}));
const result={comparison:'f131ad2 -> 869ffa5 -> current',engine:'Chromium CSSOM',parts:{}};
for(const name of Object.keys(inputs.beforeSplit)) {
  assert.deepEqual(parsed.afterSplit[name],parsed.beforeSplit[name],`file splitting changed ${name}: rule text/order`);
  const remaining=[...parsed.current[name]];
  const missing=parsed.beforeSplit[name].filter(rule=>{const at=remaining.indexOf(rule);if(at<0)return true;remaining.splice(at,1);return false;});
  // Scroll pause selectors may be strengthened by this follow-up; every old
  // declaration still has to appear in the replacement with all old selectors.
  const strengthened=missing.filter(rule=>remaining.some(candidate=>{
    const split=rule.indexOf('{'),other=candidate.indexOf('{');
    return rule.slice(split)===candidate.slice(other)&&rule.slice(0,split).split(',').every(selector=>candidate.slice(0,other).split(',').map(x=>x.trim()).includes(selector.trim()));
  }));
  assert.equal(missing.length,strengthened.length,`lost current ${name} rules: ${JSON.stringify(missing.filter(x=>!strengthened.includes(x)))}`);
  result.parts[name]={originalRules:parsed.beforeSplit[name].length,splitExactOrderEqual:true,currentRules:parsed.current[name].length,lostRules:0,strengthenedRules:strengthened.length};
}
await mkdir(new URL('../artifacts/performance/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/performance/css-rules.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
