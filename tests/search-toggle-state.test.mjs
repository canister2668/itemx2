import test from 'node:test';
import assert from 'node:assert/strict';
import {presentationRuntime} from './helpers/presentation-runtime.mjs';
test('a confirmed search remains visible after rebuilding the panel',async()=>{
 const p=await presentationRuntime();
 p.ui.query='검';
 const loaded={character:{name:'Test'},chat:{message:[],scriptstate:{}},snapshot:{registry:p.core.newRegistry()},codexSnapshot:p.codex.snapshot(),itemsEnabled:true,skillsEnabled:true,encountersEnabled:true};
 const html=p.rootInventoryHtml(loaded,true,'inventory');
 assert.match(html,/<input[^>]+id="itemx2-search-toggle"[^>]+checked/);
});
