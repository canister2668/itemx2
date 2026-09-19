import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';
test('literal short names and Unknown remain legitimate with a concrete ID', async () => {
 const {core}=await presentationRuntime();
 for(const name of ['-', '_', '?', '검', 'A', 'Unknown', '미정']) {
  const result=core.extractResponse(`<itemExam><id>named_blade</id><name>${name}</name></itemExam>`,core.newRegistry());
  assert.equal(result.registry.items.named_blade?.name,name);
 }
});
test('an effect with a symbolic name and concrete description is retained', async () => {
 const {core}=await presentationRuntime();
 const result=core.normalizeItem({id:'blade',name:'검',effects:'-::공격 시 방어력을 낮춘다'});
 assert.equal(result.item.effects[0]?.name,'-');
});
test('unknown active skill costs are not asserted to be free', async () => {
 const {codex}=await presentationRuntime();
 for(const value of ['...', '…', '?', 'unknown']) {
  const skill=codex.extractResponse(`<skillExam><id>s</id><name>-</name><cost>${value}</cost><cooldown>${value}</cooldown></skillExam>`).snapshot.skills.entries.s;
  assert.equal(skill.name,'-');
  assert.doesNotMatch(skill.cost,/소모 없음/);
  assert.doesNotMatch(skill.cooldown,/제한 없음/);
 }
});
