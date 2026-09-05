import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

const p = await presentationRuntime();
const item = (id, extra = '') =>
  `[itemx: id=${id} | name=철광석 | type=재료 | rarity=normal | possession=owned | location=inventory | count=3 ${extra}]`;
const monster = (id, extra = '') =>
  `<monsterExam><id>${id}</id><name>늑대왕</name><type>야수</type><relation>hostile</relation><status>active</status>${extra}</monsterExam>`;
const extract = (domain, text) => (domain === 'item' ? p.core.extractResponse(text) : p.codex.extractResponse(text));

async function harness(domain, source, response, mode = 'missing') {
  let chat = { message: [{ role: 'char', data: source }], scriptstate: {} };
  let calls = 0,
    writes = 0,
    state;
  const env = await presentationRuntime(
    {
      Risuai: {
        runLLMModel: async () => {},
        getChatFromIndex: async () => chat,
        setChatToIndex: async (_ci, _chi, next) => {
          chat = next;
          writes++;
        }
      },
      testContext: () => ({ key: 'duplicate-probe', character: {}, characterIndex: 0, chatIndex: 0, chat }),
      testModel: async () => {
        calls++;
        return typeof response === 'function' ? response(calls) : response;
      },
      testSettings: {
        auxOutput: mode,
        itemsEnabled: domain === 'item',
        skillsEnabled: false,
        encountersEnabled: domain === 'monster'
      },
      probe: (fn) => {
        state = fn;
      }
    },
    `context=async()=>testContext();isEnabled=async()=>true;outputSettings=async()=>testSettings;
    automaticAuxReady=()=>true;auxiliaryZeroHistory=async()=>({});rememberAuxiliaryZero=async()=>{};
    runAuxModel=testModel;modulePortraitAssets=async()=>[];
    probe((chat)=>({items:rebuildWithManual(chat).registry,monsters:rebuildCodexWithLedger(chat).monsters}));
    globalThis.testRecovery=recoverAuxiliaryOutput;`
  );
  return {
    env,
    chat: () => chat,
    state: () => state(chat),
    counts: () => ({ calls, writes }),
    append: (source) => {
      chat.message.push({ role: 'char', data: source });
    },
    html: () => {
      env.refreshLatest(chat);
      return env.displayHandler(chat.message.at(-1).data);
    }
  };
}

for (const domain of ['item', 'monster'])
  for (const mode of ['missing', 'always']) {
    test(`${domain}/${mode}: main plus repeated auxiliary exams keep one registry entry and card`, async () => {
      const exam = domain === 'item' ? item : monster;
      const first = extract(domain, exam('first'));
      const h = await harness(
        domain,
        `${domain === 'item' ? '철광석을 얻었다.' : '늑대왕과 싸웠다.'}\n${first.content}`,
        `${exam('aux1')}\n${exam('aux2')}`,
        mode
      );
      for (let i = 0; i < 2; i++) assert.equal((await h.env.recoverAuxiliaryOutput({ force: true })).length, 0);
      assert.equal(h.state()[domain === 'item' ? 'items' : 'monsters'].order.length, 1);
      assert.equal(h.counts().writes, 0);
      assert.equal(
        (h.html().match(domain === 'item' ? /<article\b/g : /<section class="itemx2-inline-event /g) || []).length,
        1
      );
    });
  }

test('item: duplicate batch aliases route subsequent patches', async () => {
  const h = await harness(
    'item',
    '철광석을 얻었다.',
    item('one') + '\n' + item('two') + '\n[itemx: id=two | op=merge | trivia=새 설명]'
  );
  const events = await h.env.recoverAuxiliaryOutput({ force: true });
  assert.equal(events.length, 2);
  assert.equal(events[1].patch.id, 'one');
  assert.equal(h.state().items.order.join(','), 'one');
  assert.equal(h.state().items.items.one.trivia, '새 설명');
  assert.equal((h.html().match(/<article\b/g) || []).length, 1);
});

test('item: no-op partial appraisal still gets one evidence-checked repair and one commit', async () => {
  const exam = (id) =>
    `[itemx: id=${id} | name=화염검 | type=검 | rarity=rare | power=300 | possession=owned | location=inventory]`;
  const base = p.core.extractResponse(exam('blade'));
  const h = await harness('item', `화염검의 공격력: 300. 특수 효과 [불꽃]이 깃들었다.\n${base.content}`, (call) =>
    call === 1 ? exam('new_id') : '[itemx: id=blade | op=merge | effects=불꽃::화염 피해]'
  );
  const events = await h.env.recoverAuxiliaryOutput({ force: true });
  assert.equal(events.length, 1);
  assert.equal(events[0].patch.id, 'blade');
  assert.equal(h.state().items.order.join(','), 'blade');
  assert.equal(h.state().items.items.blade.effects[0].name, '불꽃');
  assert.deepEqual(h.counts(), { calls: 2, writes: 1 });
});

test('same-name equipment with incompatible explicit stats is not merged', async () => {
  const base = p.core.extractResponse('[itemx: id=old | name=철검 | type=검 | rarity=normal | power=10]');
  const h = await harness(
    'item',
    `철검의 공격력: 50.\n${base.content}`,
    '[itemx: id=other | name=철검 | type=검 | rarity=normal | power=50]'
  );
  assert.equal((await h.env.recoverAuxiliaryOutput({ force: true })).length, 1);
  assert.equal(h.state().items.order.length, 2);
});

test('item: main consume cannot be replayed by auxiliary, real next-message consume remains valid', async () => {
  const consume = '[itemx: id=ore | action=consume | quantity=1 | reason=제련]';
  const main = p.core.extractResponse(item('ore') + '\n' + consume);
  const h = await harness('item', '철광석 하나를 제련에 썼다.\n' + main.content, consume);
  assert.equal((await h.env.recoverAuxiliaryOutput({ force: true })).length, 0);
  assert.equal(h.state().items.items.ore.count, 2);
  h.append('다음 날 철광석 하나를 다시 제련에 썼다.');
  assert.equal((await h.env.recoverAuxiliaryOutput({ force: true })).length, 1);
  assert.equal(h.state().items.items.ore.count, 1);
});

test('monster: duplicate encounter action cannot increment count but later re-encounter can', async () => {
  const encounter = '<monsterPatch><id>wolf</id><action>encounter</action></monsterPatch>';
  const main = p.codex.extractResponse(monster('wolf') + encounter);
  const h = await harness('monster', '늑대왕과 다시 싸웠다.\n' + main.content, encounter);
  assert.equal((await h.env.recoverAuxiliaryOutput({ force: true })).length, 0);
  assert.equal(h.state().monsters.entries.wolf.encounterCount, 2);
  h.append('다음 날 늑대왕과 다시 교전했다.');
  assert.equal((await h.env.recoverAuxiliaryOutput({ force: true })).length, 1);
  assert.equal(h.state().monsters.entries.wolf.encounterCount, 3);
});

test('item: auxiliary state cycles are not mistaken for duplicate actions', async () => {
  const base = p.core.extractResponse(item('ore'));
  const equip = '[itemx: id=ore | action=equip | slot=main_hand]';
  const h = await harness(
    'item',
    `철광석을 장착했다가 해제하고 다시 장착했다.\n${base.content}`,
    `${equip}\n[itemx: id=ore | action=unequip]\n${equip}`
  );
  assert.equal((await h.env.recoverAuxiliaryOutput({ force: true })).length, 3);
  assert.equal(h.state().items.items.ore.location, 'equipped');
});

for (const domain of ['item', 'monster'])
  test(`${domain}: explicitly separate namesakes and differing identity fields survive`, async () => {
    const exam = domain === 'item' ? item : monster;
    const base = extract(domain, exam('old'));
    const h = await harness(
      domain,
      `${base.content}\n또 다른 ${domain === 'item' ? '철광석' : '늑대왕'}을 발견했다.`,
      exam('new')
    );
    assert.equal((await h.env.recoverAuxiliaryOutput({ force: true })).length, 1);
    assert.equal(h.state()[domain === 'item' ? 'items' : 'monsters'].order.length, 2);
  });

test('display suppresses identical states across paragraphs and both marker formats, without altering replay', () => {
  for (const domain of ['item', 'monster']) {
    const first = extract(domain, (domain === 'item' ? item : monster)('same'));
    const code = first.content.match(/<!--(?:ITEMX2|CODEX2):([A-Za-z0-9_-]+)-->/)[1];
    const payload = p.core.decodePayload(code);
    const prefix = domain === 'item' ? 'ITEMX2' : 'CODEX2';
    const inline = p.embeddedViewCode(payload, domain === 'item' ? 'item' : 'codex');
    // Identical logical view, same key ordering, full and compact ref mixed.
    p.runtime.eventPayloads.set(`${domain === 'item' ? 'item' : 'codex'}:testref`, payload);
    const source = `${first.content}\n첫 문단.\n<!--${prefix}@testref:${inline}-->\n둘째 문단.\n${first.content}`;
    const html = p.displayHandler(source);
    assert.equal(
      (html.match(domain === 'item' ? /<article\b/g : /<section class="itemx2-inline-event /g) || []).length,
      1
    );
    assert.ok(html.includes('첫 문단.') && html.includes('둘째 문단.'));
    assert.equal((source.match(/<!--/g) || []).length, 3);
    const changed = {
      ...payload,
      view: { ...payload.view, ...(domain === 'item' ? { durability: '50/100' } : { status: 'defeated' }) }
    };
    p.runtime.eventPayloads.set(`${domain === 'item' ? 'item' : 'codex'}:changedref`, changed);
    const changedInline = p.embeddedViewCode(changed, domain === 'item' ? 'item' : 'codex');
    const cycle = `<!--${prefix}@testref:${inline}-->\n\n상태 변화.\n\n<!--${prefix}@changedref:${changedInline}-->\n\n원상 복귀.\n\n<!--${prefix}@testref:${inline}-->`;
    assert.equal(
      (p.displayHandler(cycle).match(domain === 'item' ? /<article\b/g : /<section class="itemx2-inline-event /g) || [])
        .length,
      3
    );
  }
});
