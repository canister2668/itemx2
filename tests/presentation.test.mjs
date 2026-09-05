import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

const p = await presentationRuntime();
const { core, renderer } = p;

test('always auxiliary recovery suppresses main/aux skill duplicates and repeated fresh IDs', async () => {
  const exam = (id) => `<skillExam><id>${id}</id><name>월영참</name></skillExam>`;
  const initial = p.codex.extractResponse(exam('main_skill'));
  let chat = { message: [{ role: 'char', data: `월영참을 사용했다.\n${initial.content}` }], scriptstate: {} };
  let calls = 0,
    writes = 0,
    zeros = 0;
  const env = await presentationRuntime(
    {
      Risuai: {
        runLLMModel: async () => {},
        getChatFromIndex: async () => chat,
        setChatToIndex: async (_ci, _chi, next) => {
          writes++;
          chat = next;
        }
      },
      testContext: () => ({ key: 'test-chat', character: {}, characterIndex: 0, chatIndex: 0, chat }),
      testModel: async () => {
        calls++;
        return exam(`aux_${calls}`);
      },
      testZero: () => {
        zeros++;
      }
    },
    `context = async () => testContext(); isEnabled = async () => true;
    outputSettings = async () => ({ auxOutput: 'always', itemsEnabled: false, skillsEnabled: true, encountersEnabled: false });
    automaticAuxReady = () => true; auxiliaryZeroHistory = async () => ({});
    rememberAuxiliaryZero = async () => testZero(); runAuxModel = testModel;
    globalThis.testRecovery = recoverAuxiliaryOutput;`
  );
  for (let i = 0; i < 2; i++) {
    const events = await env.recoverAuxiliaryOutput();
    assert.equal(events.length, 0);
  }
  assert.equal(calls, 2);
  assert.equal(zeros, 2);
  assert.equal(writes, 0);
  assert.equal(p.codex.rebuild(chat.message).skills.order.join(','), 'main_skill');
});
const item = {
  id: 'blade',
  name: '강화된 화염검',
  rarity: 'epic',
  power: '300',
  durability: '80/100',
  possession: 'owned',
  location: 'inventory',
  count: 1,
  effects: [{ name: '출혈', desc: '적중 시 출혈' }]
};

test('comparison stores only needed prior fields and leaves replay authoritative', () => {
  const reg = core.newRegistry();
  core.applyEvent(reg, { kind: 'exam', item: { ...item, trivia: 'long lore'.repeat(100) } });
  const result = core.extractResponse('[itemx: id=blade | op=merge | power=420 | durability=61/100]', reg);
  const payload = core.decodePayload([...result.content.matchAll(/<!--ITEMX2:([^>]+)-->/g)][0][1]);
  assert.equal(payload.previous.power, '300');
  assert.equal(payload.previous.trivia, undefined);
  assert.equal(payload.view.power, '420');
  assert.equal(reg.items.blade.power, '300');
  const html = renderer.renderMarkerPayload(payload);
  assert.match(html, /300<\/del><b aria-hidden="true">→<\/b><em>420/);
  assert.match(html, /80\/100/);
  assert.match(html, /61\/100/);
});

test('unknown prior values do not become invented zero deltas and model text is escaped', () => {
  assert.equal(renderer.changesHtml(null, item), '');
  assert.equal(renderer.changesHtml({ mastery: null }, { mastery: 70 }, 'skill'), '');
  const html = renderer.changesHtml({ effects: [] }, { effects: [{ name: '<script>alert(1)</script>' }] });
  assert.ok(!html.includes('<script>'));
  assert.match(html, /효과 추가/);
  assert.equal(renderer.eventKind({ previous: item, view: { ...item, power: '10' } }), '');
  assert.equal(renderer.eventKind({ previous: item, view: { ...item, power: '420' } }), 'enhanced');
});

test('skill forms are conservative and add at most one material layer without reducing weapon particles', () => {
  for (const [name, form] of [
    ['화염 참격', 'slash'],
    ['빙결 방벽', 'ward'],
    ['성광 치유', 'heal'],
    ['어둠 잠행', 'shadow'],
    ['정체불명의 힘', 'default']
  ]) {
    assert.equal(renderer.skillForm({ name }), form);
    const before = renderer.renderSkillFx({ id: 'skill', name: '기술', affinity: 'fire' }, 'epic');
    const html = renderer.renderSkillFx({ id: 'skill', name, affinity: 'fire' }, 'epic');
    assert.equal((html.match(/class="craft-mote/g) || []).length, (before.match(/class="craft-mote/g) || []).length);
    assert.equal((html.match(/itemx2-technique-material/g) || []).length, form === 'default' ? 0 : 1);
    assert.ok(!renderer.renderSkillFx({ name }, 'epic', 'off').includes('itemx2-technique-material'));
  }
  assert.equal(renderer.skillForm({ name: '기술', description: '검술과 치유를 모두 다룬다' }), 'default');
});

test('blend styling does not invent effects or add repeating particle elements', () => {
  const html = renderer.renderCard({ ...item, affinity: 'fire', affinity2: 'ice' });
  assert.match(html, /itemx2-blend-fire-ice/);
  assert.equal((html.match(/class="craft-mote/g) || []).length, renderer.particleBudget.epic);
  assert.equal(item.effects.length, 1);
});

test('events animate only after commit, consume once and never embed the active class in cached markup', async () => {
  const timers = new Map();
  let serial = 0,
    mutations = 0,
    queries = 0;
  const env = await presentationRuntime({
    setTimeout: (fn) => {
      timers.set(++serial, fn);
      return serial;
    },
    clearTimeout: (id) => timers.delete(id)
  });
  env.runtime.activeContextKey = 'chat';
  env.runtime.visualEffectsEnabled = true;
  env.runtime.mainDoc = {
    querySelector: async () => {
      queries++;
      return {
        addClass: async () => {
          mutations++;
        },
        removeClass: async () => {}
      };
    }
  };
  const payload = {
    event: { kind: 'exam', domain: 'skill', entity: { id: 'skill' } },
    view: { id: 'skill', name: '화염 참격', affinity: 'fire', rank: '레어', effects: [] }
  };
  const text = env.codex.marker(payload);
  const chat = { message: [{ role: 'char', data: text }], scriptstate: {} };
  env.armEventBursts(text);
  await env.flushEventBursts();
  assert.equal(queries, 0);
  env.commitEventBursts({ ...chat, isStreaming: true });
  await env.flushEventBursts();
  assert.equal(mutations, 0);
  env.commitEventBursts(chat);
  await env.flushEventBursts();
  assert.equal(mutations, 1);
  env.armEventBursts(text);
  env.commitEventBursts(chat);
  await env.flushEventBursts();
  assert.equal(mutations, 1);
  const html = env.displayHandler(text);
  assert.match(html, /x-itemx2-event=/);
  assert.ok(!/class="[^"]*itemx2-burst-active/.test(html));
  env.clearEventBursts();
  assert.equal(timers.size, 0);
});

test('fresh chat loads never arm historical event animation', async () => {
  const env = await presentationRuntime();
  env.runtime.activeContextKey = 'chat';
  env.runtime.visualEffectsEnabled = true;
  const text = env.codex.marker({
    event: { kind: 'exam', domain: 'skill' },
    view: { id: 's', name: '치유', effects: [] }
  });
  env.refreshLatest({ message: [{ data: text }], scriptstate: {} });
  env.displayHandler(text);
  assert.equal(env.runtime.eventBursts.size, 0);
});

test('review metadata survives compact fallback without altering event replay', () => {
  const payload = {
    v: 2,
    event: { kind: 'patch', patch: { id: 'blade', op: 'merge', fields: { power: '420' } } },
    previous: item,
    view: { ...item, power: '420' },
    review: { source: 'auxiliary', checked: true, missing: ['effects'] }
  };
  const restored = p.inlineViewPayload(p.embeddedViewCode(payload, 'item'), 'item');
  assert.equal(restored.previous.power, '300');
  assert.equal(restored.review.missing[0], 'effects');
  assert.match(renderer.reviewHtml(restored.review), /일부 정보 보완 실패/);
  assert.match(renderer.reviewHtml(null, { _inferred: ['level', 'mastery'] }), /추정값 · 레벨, 숙련/);
  assert.ok(!renderer.reviewHtml(null).includes('본문 확정'));
  assert.equal(renderer.reviewHtml(null), '');
  assert.equal(renderer.reviewHtml({}), '');
  assert.equal(renderer.reviewHtml({ source: 'unknown' }), '');
  assert.ok(!renderer.reviewHtml(null, { _inferred: ['level'] }).includes('출처 미기록'));
});

test('item detail keeps cards and annotations in one vertical flex child', async () => {
  const runtime = await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/presentation.css', import.meta.url), 'utf8');
  assert.match(runtime, /class="itemx2-detail-stack">\$\{ITEMXRenderer\.renderCard/);
  assert.match(css, /\.itemx2-detail-stack\s*\{[^}]*flex-direction: column;[^}]*width: 100%;/);
});

test('new visual decorations honor reduced motion and effects off with no will-change promotion', async () => {
  const css = await readFile(new URL('../src/presentation.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.itemx2-effects-off \.itemx2-event-burst/);
  assert.ok(!css.includes('will-change'));
  assert.ok(!css.includes('blur('));
});

test('single-item repair makes one model call, validates evidence and preserves remaining omissions', async () => {
  const chat = {
    message: [
      {
        role: 'char',
        data: `강화된 화염검\n공격력: 420\n내구도: 61/100\n${core.marker({ event: { kind: 'exam', item }, view: item })}`
      }
    ],
    scriptstate: {}
  };
  const commits = [];
  let calls = 0;
  const env = await presentationRuntime(
    {
      testContext: { key: 'chat', chat },
      testModel: async () => {
        calls++;
        return '[itemx: id=blade | op=merge | power=420]';
      },
      commitSpy: (...args) => {
        commits.push(args);
      }
    },
    `context = async () => testContext; runAuxModel = testModel; commitManualEvents = async (...args) => commitSpy(...args); rebuildCurrent = async () => ({ updated: true });`
  );
  env.runtime.activeContextKey = 'chat';
  env.runtime.presentationRecords = new Map([
    ['item:blade', { messageIndex: 0, review: { source: 'auxiliary', missing: ['power', 'durability'] } }]
  ]);
  const result = await env.repairOneItem({ key: 'chat', itemsEnabled: true, chat }, 'blade');
  assert.equal(result.updated, true);
  assert.equal(calls, 1);
  assert.equal(commits.length, 1);
  assert.equal(commits[0][1][0].patch.id, 'blade');
  assert.equal(commits[0][3].missing.join(','), 'durability');
  assert.equal(commits[0][4], false);
});

test('single-item repair rejects invented values and extra sibling events without any commit', async () => {
  for (const raw of [
    '[itemx: id=blade | op=merge | power=999]',
    '[itemx: id=blade | op=merge | power=420]\n[itemx: id=other | name=Other | rarity=normal]'
  ]) {
    let commits = 0;
    const chat = {
      message: [
        {
          role: 'char',
          data: `강화된 화염검\n공격력: 420\n${core.marker({ event: { kind: 'exam', item }, view: item })}`
        }
      ],
      scriptstate: {}
    };
    const env = await presentationRuntime(
      {
        testContext: { key: 'chat', chat },
        testModel: async () => raw,
        commitSpy: () => {
          commits++;
        }
      },
      `context = async () => testContext; runAuxModel = testModel; commitManualEvents = async (...args) => commitSpy(...args); rebuildCurrent = async () => ({});`
    );
    env.runtime.presentationRecords = new Map([['item:blade', { messageIndex: 0, review: { missing: ['power'] } }]]);
    await assert.rejects(env.repairOneItem({ key: 'chat', itemsEnabled: true, chat }, 'blade'));
    assert.equal(commits, 0);
  }
});
