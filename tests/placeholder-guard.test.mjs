import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

// A model that echoes the transport template instead of filling it in used to
// register a real item whose every field was an ellipsis. Seen live in 무림속으로.
const ECHOED = '<itemExam><id>...</id><name>...</name><type>...</type><displayrarity>...</displayrarity><power>...</power><trivia>...</trivia><effects>...</effects></itemExam>';

test('an echoed template does not become an item', async () => {
  const { core } = await presentationRuntime();
  const result = core.extractResponse(ECHOED, core.newRegistry());
  assert.equal(result.registry.order.length, 0, 'placeholder appraisal must be rejected');
});

test('placeholder names paired with template IDs are rejected', async () => {
  const { core } = await presentationRuntime();
  for (const name of ['...', '…', '....', '-', '_', '?', 'none', 'N/A', 'unknown', 'TBD', 'placeholder', '없음', '미상', '미정'])
    assert.equal(
      core.extractResponse(`<itemExam><id>...</id><name>${name}</name></itemExam>`, core.newRegistry()).registry
        .order.length,
      0,
      `${name} must not register`
    );
});

test('a real item alongside an echoed template still registers', async () => {
  const { core } = await presentationRuntime();
  const text = `${ECHOED}<itemExam><id>real_blade</id><name>청상벽려검</name><type>검</type><internalrarity>legendary</internalrarity></itemExam>`;
  const reg = core.extractResponse(text, core.newRegistry()).registry;
  assert.deepEqual([...reg.order], ['real_blade']);
  assert.equal(reg.items.real_blade.name, '청상벽려검');
});

test('placeholder field values do not reach a valid item', async () => {
  const { core } = await presentationRuntime();
  const text =
    '<itemExam><id>blade</id><name>진짜검</name><type>...</type><displayrarity>...</displayrarity><power>...</power><trivia>...</trivia></itemExam>';
  const item = core.extractResponse(text, core.newRegistry()).registry.items.blade;
  assert.equal(item.name, '진짜검');
  assert.equal(item.itemType, '기타', 'placeholder type falls back to the default');
  assert.equal(item.power, '');
  assert.equal(item.trivia, '');
  assert.ok(!String(item.displayRarity).includes('.'), 'placeholder rarity label must not survive');
});

test('skills and encounters treat an ellipsis as an empty value', async () => {
  const { codex } = await presentationRuntime();
  const text = '<skillExam><id>s</id><name>진짜무공</name><cost>...</cost><cooldown>…</cooldown></skillExam>';
  const skill = codex.extractResponse(text, codex.snapshot(), {}).snapshot.skills.entries.s;
  assert.ok(skill, 'a named skill still registers');
  assert.ok(!String(skill.cost).startsWith('.'), 'ellipsis cost must be replaced');
  assert.ok(!String(skill.cooldown).startsWith('…'), 'ellipsis cooldown must be replaced');
});
