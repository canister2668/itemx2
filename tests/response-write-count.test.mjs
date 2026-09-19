import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';
for(const lore of [false,true]) test(`main hooks write zero; committed transport plus lore=${lore} writes once; repeat writes zero`, async () => {
 let chat={id:'chat',message:[{chatId:'user',role:'user',data:'검을 확인한다.'}],scriptstate:{}},writes=0;
 const p=await presentationRuntime({
 Risuai:{getCurrentLorebookEntries:async()=>[{key:'Guide',content:'[ITEMX-PUBLIC]\nkind: 안내자\nportrait: Guide_Default\ndescription: 길 안내를 맡는다.'}],getChatFromIndex:async()=>structuredClone(chat),setChatToIndex:async(_,__,value)=>{writes++;chat=structuredClone(value)}},
 ctx:{key:'c:chat',characterIndex:0,chatIndex:0,character:{chaId:'c',name:'Test'}},
 options:{enabled:true,mainOutput:true,auxOutput:'off',itemsEnabled:true,skillsEnabled:false,encountersEnabled:lore,moduleAssetsEnabled:false,lorebookEncounterEnabled:lore,rarityMode:'world'}
 },`context=async()=>({...ctx,chat:await readChat(0,0)});outputSettings=async()=>options;isEnabled=async()=>true;
 ensureRootInventory=async()=>{};automaticAuxSettled=()=>true;
 pipelineState.activeContextKey=ctx.key;
 runtime.process=processOutput;runtime.sync=scheduleCommittedOutputSync;runtime.queue=workQueue;`);
 const output=await p.runtime.process('검을 얻었다. <itemExam><id>blade</id><name>검</name><type>검</type><possession>owned</possession></itemExam>'+ (lore ? '<monsterExam><id>guide</id><name>Guide</name><kind>미분류</kind><status>active</status></monsterExam>' : ''),'main');
 assert.equal(writes,0);
 chat.message.push({chatId:'reply',role:'char',data:output});
 await p.runtime.sync();
 assert.equal(writes,1);
 if(lore)assert.match(chat.scriptstate['itemx:cache'],/Guide_Default/);
 await p.runtime.sync();
 assert.equal(writes,1);
 await p.runtime.queue.close();
});
test('a read-only rebuild uses the context snapshot without a second host read', async () => {
 let reads=0;
 const p=await presentationRuntime({Risuai:{getChatFromIndex:async()=>{reads++;return {id:'chat',message:[],scriptstate:{}}}},ctx:{key:'c:chat',characterIndex:0,chatIndex:0,character:{chaId:'c',name:'Test'}}},
 `context=async()=>({...ctx,chat:await readChat(0,0)});outputSettings=async()=>({itemsEnabled:true,skillsEnabled:false,encountersEnabled:false});isEnabled=async()=>true;pipelineState.activeContextKey=ctx.key;runtime.rebuild=rebuildCurrent;runtime.queue=workQueue;`);
 await p.runtime.rebuild();await p.runtime.queue.close();assert.equal(reads,1);
});
