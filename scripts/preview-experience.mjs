import { writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { presentationRuntime } from '../tests/helpers/presentation-runtime.mjs';

const p = await presentationRuntime();
p.runtime.visualEffectsEnabled = true;
const base = {
  id: 'skill',
  name: '염화 참격',
  rank: '에픽',
  type: 'active',
  status: 'equipped',
  school: '검술',
  affinity: 'fire',
  level: 7,
  mastery: 75,
  cost: '내공 소모',
  cooldown: '호흡을 가다듬은 후',
  effects: ['검신에 불꽃을 두른 참격'],
  description: '검신을 따라 응축된 열기가 참격의 궤적에 잔광을 남긴다.',
  _inferred: ['level', 'mastery']
};
const forms = [
  base,
  {
    ...base,
    name: '빙결 방벽',
    school: '결계술',
    affinity: 'ice',
    description: '투명한 결정면이 겹쳐 충격을 받아낸다.',
    effects: ['얼음 방벽']
  },
  {
    ...base,
    name: '성광 치유',
    school: '치유술',
    affinity: 'light',
    description: '상처에 빛이 스며들며 천천히 회복한다.',
    effects: ['상처 치유']
  },
  {
    ...base,
    name: '심연 잠행',
    school: '은신술',
    affinity: 'dark',
    description: '그림자 속으로 몸을 감춘다.',
    effects: ['기척 은폐']
  }
];
const item = {
  id: 'blade',
  name: '빙염의 장검',
  rarity: 'epic',
  displayRarity: '에픽',
  itemType: '장검',
  emoji: '🗡️',
  possession: 'owned',
  location: 'equipped',
  count: 1,
  theme: 'forged',
  affinity: 'fire',
  affinity2: 'ice',
  power: '420',
  durability: '61/100',
  effects: [{ name: '출혈', desc: '적중 시 출혈을 일으킨다.' }]
};
p.runtime.presentationRecords = new Map([
  [
    'item:blade',
    {
      previous: { ...item, power: '300', durability: '80/100', effects: [] },
      review: { source: 'auxiliary', checked: true, missing: ['required'] }
    }
  ]
]);
const views = [...forms.map((skill) => p.skillPageHtml(skill, '')), p.itemDetailHtml(item)];
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ITEMX 2.0.6 시각 검증</title><style>${p.style}\nbody{margin:0;background:#080d14;color:#e7edf5;font-family:sans-serif}main{width:min(560px,100%);margin:0 auto;padding:12px;box-sizing:border-box}nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}button{padding:9px;border:1px solid #384359;border-radius:8px;background:#162033;color:#dce8fc}.preview-note{font-size:12px;color:#99a9bc}.itemx2-codex-page{display:block!important}.itemx2-effects-off .itemx-fx{display:none!important}</style><main><h2>ITEMX CODEX · 2.0.6</h2><p class="preview-note">실제 렌더러 · 검증용 데이터 · 파티클 예산 유지</p><nav>${['화염 참격', '빙결 방벽', '성광 치유', '심연 잠행', '변경점·보완 상태'].map((name, i) => `<button onclick="show(${i})">${name}</button>`).join('')}<button onclick="document.querySelector('#view').classList.toggle('itemx2-effects-off')">효과 ON/OFF</button></nav><div id="view">${views[0]}</div></main><script>const views=${JSON.stringify(views).replace(/</g, '\\u003c')};function show(i){document.querySelector('#view').innerHTML=views[i]}</script></html>`;
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/experience-preview.html', import.meta.url), html);
if (process.env.ITEMX_VISUAL_BROWSER === '1') {
  const script = `const {chromium}=require('playwright-core');(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:390,height:844}});await page.setContent(${JSON.stringify(html)});const results=[];for(const [i,name] of [[0,'slash'],[1,'ward'],[2,'heal'],[3,'shadow'],[4,'changes']]){await page.evaluate(i=>show(i),i);await page.waitForTimeout(250);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);if(overflow>0)throw Error('overflow '+name+':'+overflow);results.push({name,png:(await page.screenshot({fullPage:true})).toString('base64')});}await page.evaluate(()=>show(0));await page.emulateMedia({reducedMotion:'reduce'});const motion=await page.locator('.itemx2-technique-material').evaluate(el=>getComputedStyle(el).animationName);if(motion!=='none')throw Error('reduced motion '+motion);await page.evaluate(()=>document.querySelector('#view').classList.add('itemx2-effects-off'));const off=await page.locator('.itemx2-technique-material').evaluate(el=>getComputedStyle(el).display);if(off!=='none')throw Error('effects off '+off);await browser.close();console.log(JSON.stringify(results));})().catch(e=>{console.error(e);process.exit(1)});`;
  const result = execFileSync('docker', ['exec', '-i', 'claudex-workhouse-browser-runtime', 'node'], {
    input: script,
    maxBuffer: 20 * 1024 * 1024,
    timeout: 60000
  }).toString();
  for (const shot of JSON.parse(result))
    await writeFile(new URL(`../dist/experience-${shot.name}.png`, import.meta.url), Buffer.from(shot.png, 'base64'));
  console.log('390px browser: five views, no horizontal overflow; new FX OFF and reduced-motion verified');
}
console.log('dist/experience-preview.html');
