import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const ctx = vm.createContext({ TextEncoder, TextDecoder, Buffer });
vm.runInContext(await readFile(new URL('../src/core.js', import.meta.url), 'utf8'), ctx);
const core = ctx.ITEMXCore;
const echo = `[ITEMX v2]

    crude_stone_dagger | 조악한 돌 단검 | 무기 | 🗡️ | normal | 일반 | forged | removed | inventory | 0 | 10-35 | 내구도 18/30

    boiled_leather_wraps | 삶은 가죽 발싸개 | 방어구 | 👞 | normal | 일반 | forged | owned | equipped | 1 | 10-40 | 내구도 25/25 | slot=feet | cost=6 Copper | effects=보행 보호::발바닥 보호
`;

test('reported read-only rows disappear without creating or applying any events', () => {
  const base = core.extractResponse(
    '<itemExam><id>crude_stone_dagger</id><name>조악한 돌 단검</name><possession>owned</possession><count>1</count></itemExam>'
  ).registry;
  const before = JSON.stringify(base);
  const result = core.extractResponse(echo, base);
  assert.equal(result.content, '');
  assert.equal(result.events.length, 0);
  assert.equal(JSON.stringify(result.registry), before);
  assert.equal(JSON.stringify(base), before);
});

test('narrative, other bot trailers, and genuine events survive', () => {
  const input = `앞 문장.\n${echo}<sys>상태 유지</sys>\n<itemExam><id>ore</id><name>철광석</name></itemExam>\n뒤 문장.`;
  const result = core.extractResponse(input);
  assert.equal(result.events.length, 1);
  assert.ok(result.content.startsWith('앞 문장.\n<sys>상태 유지</sys>'));
  assert.ok(result.content.endsWith('뒤 문장.'));
  assert.ok(!result.content.includes('[ITEMX v2]'));
});

test('only recognized tables are stripped, including CRLF and repeated blocks', () => {
  assert.equal(core.stripInventoryEcho(echo.replaceAll('\n', '\r\n')), '');
  assert.equal(core.stripInventoryEcho(echo + '서술\n' + echo), '서술\n');
  for (const text of [
    '[ITEMX v2]\n사용법 설명',
    'a | b | c',
    echo.split('\n').slice(2).join('\n'),
    '<state>정상</state>'
  ]) {
    assert.equal(core.stripInventoryEcho(text), text);
  }
});

test('table-only fences disappear without eating surrounding prose or code', () => {
  assert.equal(core.stripInventoryEcho('앞\n```text\n' + echo + '```\n뒤'), '앞\n뒤');
  assert.equal(core.stripInventoryEcho('```\n설명\n' + echo + '```'), '```\n설명\n```');
});

test('current authoritative anchor echo is stripped too', () => {
  const result = core.extractResponse(
    '<itemExam><id>ore</id><name>철광석</name><possession>owned</possession></itemExam>'
  );
  const text = core.anchor({ registry: result.registry });
  assert.ok(text.includes('id=ore'));
  assert.equal(core.stripInventoryEcho(text), '');
});

test('display and request early returns use cleaned text, including no-context output', async () => {
  const source = await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8');
  vm.runInContext(
    source.slice(
      source.indexOf('  const OWNED_TRANSPORT_HINT_RE ='),
      source.indexOf('  function processTransportStripper(')
    ),
    ctx
  );
  vm.runInContext(
    source.slice(
      source.indexOf('  function processTransportStripper('),
      source.indexOf('\n  function ', source.indexOf('  function processTransportStripper(') + 12)
    ),
    ctx
  );
  vm.runInContext(
    source.slice(source.indexOf('  const displayHandler ='), source.indexOf('\n  function beginBodyScrollEffects')),
    ctx
  );
  ctx.input = echo;
  assert.equal(vm.runInContext('processTransportStripper(input)', ctx), '');
  assert.equal(vm.runInContext('displayHandler(input)', ctx), '');
  assert.match(
    source,
    /if \(!mainRequestType\(type\)\) return content;\s*content = ITEMXCore.stripInventoryEcho\(content\);/
  );
});
