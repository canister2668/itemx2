import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rt, setHost, Session, Style, Presentation } from './helpers/modules.mjs';
import { createFakeHost } from './helpers/fake-host.mjs';
import { anchored, documentOf, pendingAnchor } from './helpers/ledger.mjs';
import { anchorKeys } from '../src/store/anchors.js';

const reviewed = (data, missing) => ({
  role: 'char',
  chatId: 'm0',
  data: `${data}\n${core.marker({ event: { kind: 'exam', item }, view: item, review: { source: 'auxiliary', checked: true, missing } })}`
});
const presentationCss = () => readFile(new URL('../src/styles/presentation.css', import.meta.url), 'utf8');
let hostId = 0;
function fakeBot(chat, character, extra = {}) {
  const id = `presentation-${++hostId}`;
  const fake = createFakeHost({
    chat: { id: 'chat', ...chat },
    character: { chaId: id, name: 'Probe' },
    settings: { v: 1, global: { badgePosition: 'rm' }, characters: { [id]: character } },
    ...extra
  });
  setHost(fake.api);
  Session.resetSession(`${id}:chat`);
  return fake;
}

const p = rt;
const { core, renderer } = p;

test('always auxiliary recovery suppresses main/aux skill duplicates and repeated fresh IDs', async () => {
  const exam = (id) => `<skillExam><id>${id}</id><name>월영참</name></skillExam>`;
  const initial = p.codex.extractResponse(exam('main_skill'));
  const data = `월영참을 사용했다.\n${initial.content}`;
  let calls = 0;
  const chat = anchored({ message: [{ role: 'char', data, chatId: 'm0' }], scriptstate: {} });
  const fake = fakeBot(
    chat,
    { auxOutput: 'always', itemsEnabled: false, skillsEnabled: true, encountersEnabled: false },
    { llm: async () => exam(`aux_${++calls}`) }
  );
  for (let i = 0; i < 2; i++) assert.equal((await p.recoverAuxiliaryOutput()).length, 0);
  // The second pass is refused by the recorded zero result, not by another model call.
  assert.equal(calls, 1);
  assert.equal(fake.state.chat.message[0].data, chat.message[0].data, 'no card may be appended');
  assert.equal(p.project({ chat: fake.state.chat, key: 'k' }).codexSnapshot.skills.order.join(','), 'main_skill');
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

test('events animate only after commit, consume once and never embed the active class in cached markup', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fake = createFakeHost({ document: true });
  await Style.removeMainStyle();
  setHost(fake.api);
  await Style.installMainStyle();
  Session.resetSession('chat');
  Presentation.applyVisualSettings({ effectsLevel: 'full', skin: 'dark' });
  const payload = {
    event: { kind: 'exam', domain: 'skill', entity: { id: 'skill' } },
    view: { id: 'skill', name: '화염 참격', affinity: 'fire', rank: '레어', effects: [] }
  };
  const text = pendingAnchor(payload);
  const keys = anchorKeys(text);
  const chat = { message: [{ role: 'char', data: text }], scriptstate: {} };
  const html = await p.displayHandler(text);
  assert.match(html, /x-itemx2-event=/);
  assert.ok(!/class="[^"]*itemx2-burst-active/.test(html));
  fake.dom.body().setHtml(html);
  const card = () => fake.dom.root.find('[x-itemx2-event]')[0];
  const lit = () => card().classes.includes('x-risu-itemx2-burst-active');
  const queries = () => fake.dom.doc.calls.filter((c) => c === 'querySelector').length;
  const before = queries();
  p.armEventBursts(keys);
  await p.flushEventBursts();
  assert.equal(queries(), before, 'an uncommitted burst never touches the host');
  p.commitEventBursts({ ...chat, isStreaming: true });
  await p.flushEventBursts();
  assert.equal(lit(), false);
  p.commitEventBursts(chat);
  await p.flushEventBursts();
  assert.equal(lit(), true);
  t.mock.timers.tick(1400);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lit(), false);
  p.armEventBursts(keys);
  p.commitEventBursts(chat);
  await p.flushEventBursts();
  assert.equal(lit(), false, 'a seen burst plays once');
  p.clearEventBursts();
  assert.equal(Presentation.pendingBurstCount(), 0);
});

test('fresh chat loads never arm historical event animation', async () => {
  Session.resetSession('chat');
  Presentation.applyVisualSettings({ effectsLevel: 'full', skin: 'dark' });
  const text = pendingAnchor({
    event: { kind: 'exam', domain: 'skill' },
    view: { id: 's', name: '치유', effects: [] }
  });
  p.refreshLatest({ key: 'chat', chat: { message: [{ data: text }], scriptstate: {} } });
  await p.displayHandler(text);
  assert.equal(Presentation.pendingBurstCount(), 0);
});

test('review metadata lives with the event and reaches the drawer annotations', () => {
  const chat = anchored({ message: [reviewed('강화된 화염검', ['effects'])], scriptstate: {} });
  const loaded = p.project({ key: 'k', chat });
  const record = p.presentationRecord('item', 'blade', loaded);
  assert.equal(record.review.missing[0], 'effects');
  assert.equal(record.messageIndex, 0);
  assert.match(renderer.reviewHtml(record.review), /일부 정보 보완 실패/);
  assert.match(renderer.reviewHtml(null, { _inferred: ['level', 'mastery'] }), /추정값 · 레벨, 숙련/);
  assert.ok(!renderer.reviewHtml(null).includes('본문 확정'));
  assert.equal(renderer.reviewHtml(null), '');
  assert.equal(renderer.reviewHtml({}), '');
  assert.equal(renderer.reviewHtml({ source: 'unknown' }), '');
  assert.ok(!renderer.reviewHtml(null, { _inferred: ['level'] }).includes('출처 미기록'));
});

test('item detail keeps cards and annotations in one vertical flex child', async () => {
  const css = await presentationCss();
  assert.match(
    p.itemDetailHtml(p.core.normalizeItem(item).item),
    /^<div class="itemx2-detail-stack"><article class="itemx-card/
  );
  assert.match(css, /\.itemx2-detail-stack\s*\{[^}]*flex-direction: column;[^}]*width: 100%;/);
});

test('new visual decorations honor reduced motion and effects off with no will-change promotion', async () => {
  const css = await presentationCss();
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.itemx2-effects-off \.itemx2-event-burst/);
  assert.ok(!css.includes('will-change'));
  assert.ok(!css.includes('blur('));
});

const itemsOn = { itemsEnabled: true, skillsEnabled: false, encountersEnabled: false };

test('single-item repair makes one model call, validates evidence and preserves remaining omissions', async () => {
  let calls = 0;
  const fake = fakeBot(
    anchored({
      message: [reviewed('강화된 화염검\n공격력: 420\n내구도: 61/100', ['power', 'durability'])],
      scriptstate: {}
    }),
    itemsOn,
    {
      llm: async () => (calls++, '[itemx: id=blade | op=merge | power=420]')
    }
  );
  const loaded = await p.rebuildCurrent();
  const result = await p.repairOneItem(loaded, 'blade');
  assert.equal(calls, 1);
  assert.equal(fake.state.writes, 1);
  assert.equal(result.snapshot.registry.items.blade.power, '420');
  const manual = documentOf(fake.state.chat).manual;
  assert.equal(manual.length, 1);
  assert.equal(manual[0].e.patch.id, 'blade');
  assert.deepEqual(manual[0].r.missing, ['durability']);
});

test('single-item repair rejects invented values and extra sibling events without any commit', async () => {
  for (const raw of [
    '[itemx: id=blade | op=merge | power=999]',
    '[itemx: id=blade | op=merge | power=420]\n[itemx: id=other | name=Other | rarity=normal]'
  ]) {
    const fake = fakeBot(
      anchored({ message: [reviewed('강화된 화염검\n공격력: 420', ['power'])], scriptstate: {} }),
      itemsOn,
      {
        llm: async () => raw
      }
    );
    const loaded = await p.rebuildCurrent();
    await assert.rejects(p.repairOneItem(loaded, 'blade'));
    assert.equal(fake.state.writes, 0);
  }
});

test('without our stylesheet in the host document a card falls back to a small chip, not an inline sheet', async () => {
  await Style.removeMainStyle();
  setHost(createFakeHost().api);
  const html = await p.displayHandler(`본문\n\n${pendingAnchor({ event: { kind: 'exam', item }, view: item })}`);
  assert.match(html, /itemx-event-chip/);
  assert.doesNotMatch(html, /itemx-card/);
  assert.ok(html.length < 1500, `fallback is ${html.length} bytes`);
});
