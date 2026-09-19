import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
test('a light scroll pass cannot replace a pending full host refresh', async () => {
  const source=await readFile(new URL('../src/ui-panel.js',import.meta.url),'utf8');
  const queue=await readFile(new URL('../src/work-queue.js',import.meta.url),'utf8');
  let full=0;
  const sb={setTimeout,clearTimeout,setInterval,clearInterval,uiState:{rootOpen:false},presentationState:{bodyFxScrollActive:false},
    installBodyEffectGovernor:async()=>{},ensureRootInventory:async()=>full++,syncHostSettingsVisibility:async()=>{},flushEventBursts:async()=>{},debugRecord:()=>{}};
  vm.runInNewContext(queue+'\nconst workQueue=ITEMXWorkQueue.create();\n'+source.slice(source.indexOf('  function scheduleHostDomSync('),source.indexOf('  async function installHostObserver'))+'\nglobalThis.api={scheduleHostDomSync,workQueue};',sb);
  sb.api.scheduleHostDomSync(5);sb.api.scheduleHostDomSync(5,{light:true});
  await new Promise(resolve=>setTimeout(resolve,30));await sb.api.workQueue.close();
  assert.equal(full,1);
});
