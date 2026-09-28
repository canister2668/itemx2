import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { setHost, Pipeline, Ledger, Session } from './helpers/modules.mjs';

const settingsDoc = (lore, id) => ({
  v: 1,
  global: { badgePosition: 'rm' },
  characters: {
    [id]: {
      enabled: true,
      mainOutput: true,
      auxOutput: 'off',
      itemsEnabled: true,
      skillsEnabled: false,
      encountersEnabled: lore,
      lorebookEncounterEnabled: lore
    }
  }
});

for (const lore of [false, true])
  test(`main hooks write zero; committed transport plus lore=${lore} writes once; repeat writes zero`, async (t) => {
    t.mock.timers.enable({ apis: ['Date'] });
    const fake = createFakeHost({
      chat: { id: 'chat', message: [{ chatId: 'user', role: 'user', data: '검을 확인한다.' }], scriptstate: {} },
      character: { chaId: `c${lore}`, name: 'Test' },
      settings: settingsDoc(lore, `c${lore}`),
      lorebook: [
        {
          key: 'Guide',
          content: '[ITEMX-PUBLIC]\nkind: 안내자\nportrait: Guide_Default\ndescription: 길 안내를 맡는다.'
        }
      ]
    });
    setHost(fake.api);
    Session.resetSession(`c${lore}:chat`);
    const output = await Pipeline.processOutput(
      '검을 얻었다. <itemExam><id>blade</id><name>검</name><type>검</type><possession>owned</possession></itemExam>' +
        (lore
          ? '<monsterExam><id>guide</id><name>Guide</name><kind>미분류</kind><status>active</status></monsterExam>'
          : ''),
      'main'
    );
    assert.equal(fake.state.writes, 0);
    fake.state.chat.message.push({ chatId: 'reply', role: 'char', data: output });
    // The first sighting of a committed output only starts its settle window.
    await Pipeline.catchUpLatestOutput({ syncUi: false });
    assert.equal(fake.state.writes, 0);
    t.mock.timers.tick(2000);
    await Pipeline.scheduleCommittedOutputSync();
    assert.equal(fake.state.writes, 1);
    if (lore) assert.match(fake.state.chat.scriptstate['itemx:cache'], /Guide_Default/);
    t.mock.timers.tick(2000);
    await Pipeline.scheduleCommittedOutputSync();
    assert.equal(fake.state.writes, 1);
  });

test('a read-only rebuild uses the context snapshot without a second host read', async () => {
  const fake = createFakeHost({ character: { chaId: 'c', name: 'Test' } });
  setHost(fake.api);
  Session.resetSession('c:chat');
  await Ledger.rebuildCurrent();
  assert.equal(fake.state.reads, 1);
});
