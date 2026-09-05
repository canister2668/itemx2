import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

test('grouped settings actions cannot shrink into vertical text', async () => {
  const css = await readFile(new URL('../src/presentation.css', import.meta.url), 'utf8');
  assert.match(css, /\.itemx2-root-setting-card > \.itemx2-manager-actions,[\s\S]*?flex: 0 0 100%/);
  assert.match(css, /\.itemx-setting-card \.itemx-tool,[\s\S]*?white-space: nowrap/);
});

test(
  'mobile settings preserve horizontal labels in root and iframe',
  {
    skip: process.env.ITEMX_SETTINGS_BROWSER !== '1'
  },
  async () => {
    const source = await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8');
    const p = await presentationRuntime();
    const iframeStart = source.indexOf('.itemx-settings{');
    const iframeCss = source.slice(iframeStart, source.indexOf('</style>', iframeStart));
    const cases = ['itemx2-root', 'itemx'].map((prefix) => {
      const marker = `<section class="${prefix}-setting-card"><span><strong>조우 로어북 보완</strong>`;
      const start = source.indexOf(marker);
      assert.ok(start >= 0);
      const section = source
        .slice(start, source.indexOf('</section>', start) + 10)
        .replace(/\$\{loaded\.lorebookEncounterEnabled \? '([^']*)' : '[^']*'\}/g, '$1');
      return { prefix, html: `<div class="${prefix}-settings">${section}</div>` };
    });
    const script = `const {chromium}=require('playwright-core');
    (async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    try {const page=await browser.newPage();const results=[];
    for(const fixture of ${JSON.stringify(cases)})for(const width of [280,340,420])for(const font of [16,20]){
      await page.setViewportSize({width,height:700});
      await page.setContent('<style>'+${JSON.stringify(p.style + iframeCss)}+'html{font-size:'+font+'px}body{margin:0}*{box-sizing:border-box}</style>'+fixture.html);
      const result=await page.evaluate(()=>{const card=document.querySelector('section');const buttons=[...card.querySelectorAll('button')];const copy=card.firstElementChild.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,below:buttons.every(b=>b.getBoundingClientRect().top>=copy.bottom),labels:buttons.map(b=>({text:b.textContent,nowrap:getComputedStyle(b).whiteSpace==='nowrap',height:b.getBoundingClientRect().height,fits:b.scrollWidth<=b.clientWidth}))}});
      if(result.overflow||!result.below||result.labels.some(b=>!b.nowrap||!b.fits||b.height>50))throw Error(JSON.stringify({fixture:fixture.prefix,width,font,result}));
      results.push({fixture:fixture.prefix,width,font});
    }console.log(JSON.stringify(results));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});`;
    const results = JSON.parse(
      execFileSync('docker', ['exec', '-i', 'claudex-workhouse-browser-runtime', 'node'], {
        input: script,
        timeout: 45000,
        encoding: 'utf8'
      })
    );
    assert.equal(results.length, 12);
  }
);
