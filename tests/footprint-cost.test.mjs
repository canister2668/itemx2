import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';
test('measuring persisted document bytes does not capture or replay the log', async () => {
 const p=await presentationRuntime({},'runtime.footprint = itemxStorageFootprint;');
 const c={message:[],scriptstate:{'itemx:log':'{"v":1,"rows":[]}','itemx:cache':'{"v":1}','itemx:prefs':'{}'}};
 const hydrated=p.storage.hydrate(c);let calls=0;const original=p.storage.persist;
 p.storage.persist=(...args)=>{calls++;return original(...args)};
 const result=p.runtime.footprint(hydrated);
 assert.equal(calls,0,'a size warning must not run the persistence pipeline');
 assert.equal(result.stateBytes,Object.values(c.scriptstate).reduce((n,v)=>n+Buffer.byteLength(v),0));
});
