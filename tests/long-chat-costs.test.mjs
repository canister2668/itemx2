import test from 'node:test';
import assert from 'node:assert/strict';
import { sameChat } from '../src/chat-io.js';
import { messageKeys } from '../src/store/anchors.js';
import * as Core from '../src/engine/core.js';

test('sameChat equals the serialized comparison it replaces', () => {
  const base = {
    id: 'c',
    message: [
      { chatId: 'a', role: 'user', data: '안녕', time: 1 },
      { chatId: 'b', role: 'char', data: '답 <!--ix:k1abc-->', generationInfo: { model: 'm' } }
    ],
    scriptstate: { 'itemx:ledger': '{"v":2}', $hp: 3 }
  };
  const copy = structuredClone(base);
  assert.equal(sameChat(base, copy), true);
  // Undefined fields vanish from JSON, so they do not count as a change.
  assert.equal(sameChat(base, { ...copy, extra: undefined }), true);
  for (const change of [
    (chat) => (chat.message[1].data += '!'),
    (chat) => chat.message.push({ chatId: 'c', role: 'user', data: '' }),
    (chat) => (chat.message[1].generationInfo.model = 'n'),
    (chat) => (chat.scriptstate.$hp = 4),
    (chat) => delete chat.scriptstate['itemx:ledger'],
    (chat) => (chat.isStreaming = true)
  ]) {
    const changed = structuredClone(base);
    change(changed);
    assert.equal(sameChat(base, changed), JSON.stringify(base) === JSON.stringify(changed));
  }
});

test('cached message keys follow a changed message text', () => {
  const message = { chatId: 'cache-1', data: '카드 <!--ix:k1abc-->' };
  assert.deepEqual(messageKeys(message), ['k1abc']);
  assert.deepEqual(messageKeys({ ...message }), ['k1abc']);
  assert.deepEqual(messageKeys({ ...message, data: '카드 <!--ix:k1abc--> <!--ix:k2def-->' }), ['k1abc', 'k2def']);
  assert.deepEqual(messageKeys({ ...message, data: '카드 없음' }), []);
  assert.deepEqual(messageKeys({ data: '<!--ix:k3ghi-->' }), ['k3ghi']);
});

test('the request inventory carries effect names, not their descriptions', () => {
  const reg = Core.newRegistry();
  const parsed = Core.extractResponse(
    '[itemx: id=sword | name=검 | type=무기 | emoji=🗡️ | rarity=rare | display=레어 | theme=forged | possession=owned | location=equipped | count=1 | effects=베기::긴 설명이 들어가는 효과 ;; 막기::또 다른 긴 설명]',
    reg
  );
  for (const event of parsed.events) Core.applyEvent(reg, event);
  const text = Core.anchor({ registry: reg });
  assert.match(text, /effects=베기 ;; 막기/);
  assert.doesNotMatch(text, /긴 설명/);
  assert.doesNotMatch(text, /theme=/);
});
