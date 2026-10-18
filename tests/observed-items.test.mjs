import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { documentOf } from './helpers/ledger.mjs';
import { setHost, Pipeline, Session, Ledger, Aux, Quality, History } from './helpers/modules.mjs';
import { inventoryLayout } from '../src/ui/panel.js';

const settings = (id) => ({
  v: 1,
  global: { badgePosition: 'rm' },
  characters: {
    [id]: {
      enabled: true,
      mainOutput: true,
      auxOutput: 'off',
      itemsEnabled: true,
      skillsEnabled: false,
      encountersEnabled: false
    }
  }
});
const sword =
  '장비창을 열었다.\n\n[itemx: id=sword | name=빛의 검 | type=양손 무기 | emoji=⚔️ | rarity=legendary | display=레전더리 | possession=owned | location=equipped | count=1]\n\n농부의 활이 벽에 걸려 있었다.\n\n[itemx: id=bow | name=농부의 활 | type=무기 | emoji=🏹 | rarity=epic | display=에픽 | possession=observed | location=unknown | count=1]';

async function setup(id, llm = null) {
  const fake = createFakeHost({
    chat: { id: 'chat', message: [], scriptstate: {} },
    character: { chaId: id, name: 'Test' },
    settings: settings(id),
    llm
  });
  setHost(fake.api);
  Session.resetSession(`${id}:chat`);
  for (const [user, text] of [
    ['장비', sword],
    ['다음', '광장으로 나갔다.']
  ]) {
    fake.state.chat.message.push({ chatId: `u-${user}`, role: 'user', data: user });
    const output = await Pipeline.processOutput(text, 'main');
    fake.state.chat.message.push({ chatId: `r-${user}`, role: 'char', data: output });
    await Pipeline.catchUpLatestOutput({ syncUi: false });
  }
  return fake;
}

test('an observed item stays out of the inventory and of requests that no longer mention it', async () => {
  const fake = await setup('obs1');
  const loaded = await Ledger.rebuildCurrent();
  assert.deepEqual(
    inventoryLayout(loaded).items.map((item) => item.id),
    ['sword']
  );
  const quiet = History.requestSnapshot(loaded, '광장으로 나갔다.');
  assert.deepEqual(quiet.registry.order, ['sword']);
  const mentioned = History.requestSnapshot(loaded, '농부의 활을 집어 들었다.');
  assert.deepEqual(mentioned.registry.order.sort(), ['bow', 'sword']);
  assert.equal(Object.keys(documentOf(fake.state.chat).events).length, 2);
  assert.deepEqual(Quality.appraisalGaps(loaded.snapshot.registry.items.bow), []);
});

test('a manual check appraises owned gear the latest message does not show', async () => {
  const fake = await setup('obs2', async (request) => {
    const prompt = request.messages[0].content;
    if (/Complete the appraisal/.test(prompt))
      return {
        type: 'success',
        result: '[itemx: id=sword | op=merge | required=레벨 90 | durability=90/100 | effects=섬광::빛 피해]'
      };
    return { type: 'success', result: 'NONE' };
  });
  const result = await Aux.recoverAuxiliaryOutputNow({ force: true });
  assert.equal(result.status, 'ok');
  const prompt = fake.state.llmCalls
    .map((call) => call.messages[0].content)
    .find((one) => /Complete the appraisal/.test(one));
  assert.match(prompt, /id=sword/);
  assert.doesNotMatch(prompt, /id=bow/);
  const loaded = await Ledger.rebuildCurrent();
  assert.equal(loaded.snapshot.registry.items.sword.required, '레벨 90');
});
