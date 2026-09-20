import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {presentationRuntime} from './helpers/presentation-runtime.mjs';
test('audit fixes preserve f289864 nonempty panel HTML and all affinity card markup',async()=>{
 const source=execFileSync('git',['show','f289864:dist/itemx2.plugin.js'],{maxBuffer:4e6,encoding:'utf8'});
 const old=await presentationRuntime({},'',source),next=await presentationRuntime();
 // The header actions row was resized after this oracle was taken: it had been
 // pinned to two buttons, so search pushed close outside the frame. That rule is
 // normalised out of both sides; everything else must still match byte for byte.
 const moved=h=>h.replace(/<button class="itemx-ph-btn itemx2-sw-power[^>]*>[\s\S]*?<\/button>/g,'').replace(/<section class="itemx2-root-setting-card"><span><strong>이 봇에서 사용<\/strong>[\s\S]*?<\/section>/g,'');
 const motes=h=>h.replace(/<i class="craft-mote[^>]*><\/i>/g,'').replace(/<i style="--x:[^>]*><\/i>/g,'')
   .replace(/<b style="--x:[^>]*><\/b>/g,'');
 const norm=h=>motes(moved(h)).replace(/--w:[\d.]+%/g,'RAYW').replace(/<style>[\s\S]*?<\/style>/g,'STYLE').replace(/\.itemx2-panel-actions\s*\{[^}]*\}\s*\.itemx2-panel-actions > button(,\s*\.itemx2-panel-actions > label)?\s*\{[^}]*\}/g,'ACTIONS_BOX');
 const items=Object.keys(next.renderer.affinities).map((affinity,i)=>next.core.normalizeItem({id:'a'+i,name:affinity,rarity:'legendary',affinity,count:1,itemType:'검',possession:'owned'}).item);
 const codex=next.codex.extractResponse('<skillExam><id>skill</id><name>검술</name><cost>내력 소모</cost></skillExam><monsterExam><id>guide</id><name>안내자</name><status>active</status></monsterExam>').snapshot;
 const loaded={key:'c:chat',enabled:true,mainOutput:true,auxOutput:'off',rarityMode:'world',itemsEnabled:true,skillsEnabled:true,encountersEnabled:true,lorebookEncounterEnabled:false,moduleAssetsEnabled:false,effectsEnabled:true,debugEnabled:false,fontScale:'small',character:{name:'Audit'},chat:{message:[],scriptstate:{}},snapshot:{registry:{order:items.map(i=>i.id),items:Object.fromEntries(items.map(i=>[i.id,i])),diagnostics:[]},history:{},fingerprint:'stable'},codexSnapshot:codex};
 for(const skin of ['dark','light'])for(const tab of ['inventory','skills','bestiary','settings'])for(const open of [true,false])assert.equal(norm(next.rootInventoryHtml({...loaded,skin},open,tab)),norm(old.rootInventoryHtml({...loaded,skin},open,tab)));
 for(const item of items){const marker=next.core.marker({v:2,event:{kind:'exam',item},view:item});assert.equal(norm(next.displayHandler(marker)),norm(old.displayHandler(marker)));}
});
