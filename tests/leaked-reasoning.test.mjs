import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

// Some providers leak reasoning into the body without a <Thoughts> wrapper. That reasoning
// names the protocol tags, and a name must never swallow the response that follows it.
const body = [
  '# 응답',
  '',
  '포신 끝에서 불을 뿜은 것은 쇳덩이가 아니었다.',
  '',
  '<monsterExam><id>rika</id><name>리카</name><type>인간</type><status>active</status><relation>hostile</relation></monsterExam>',
  '',
  '"살려줘요! 왜 쇠뭉치가 날아와!"',
  '',
  '<itemExam><id>axe</id><name>무쇠 도끼</name><type>도구</type><possession>owned</possession><location>inventory</location><count>1</count></itemExam>',
  '마지막 문장.'
].join('\n');

async function extract(text) {
  const { core, codex } = await presentationRuntime();
  const item = core.extractResponse(text, core.newRegistry());
  const result = codex.extractResponse(item.content, codex.snapshot(), { enabledDomains: ['skill', 'monster'] });
  return { content: result.content, items: item.events.length, codex: result.events.length };
}

for (const [label, reasoning] of [
  ['quoted in backticks', 'Plan:\n  - Encounter bestiary for Rika (`<monsterExam>`).\n  - Items via `<itemExam>` at the end.\n'],
  ['named bare in prose', 'Plan: bestiary for Rika (<monsterExam>) and items via <itemExam>.\n'],
  ['glued to the header', 'Review length and immersion, then emit <itemExam> and <monsterExam>.']
]) {
  test(`leaked reasoning ${label} keeps the whole body and still records events`, async () => {
    const out = await extract(reasoning + body);
    for (const line of ['# 응답', '포신 끝에서', '살려줘요', '마지막 문장.']) assert.ok(out.content.includes(line), `${line} lost`);
    assert.equal(out.items, 1);
    assert.equal(out.codex, 1);
  });
}

test('a truncated transport at the stream edge is still hidden', async () => {
  for (const tail of ['<itemExam><id>ax', '<itemExam', '<monsterExam><id>ri', '<monsterExam']) {
    const out = await extract(`본문.\n\n${tail}`);
    assert.equal(out.content, '본문.');
  }
});
