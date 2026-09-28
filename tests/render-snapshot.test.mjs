import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

// Committed render oracle. It replaced the tests that ran `git show <old commit>`
// (a shallow CI checkout cannot see them). Regenerate only for an intended visual
// change: ITEMX_UPDATE_SNAPSHOTS=1 npm test, and say why in the commit.
const FIXTURE = new URL('./fixtures/render-snapshots.json', import.meta.url);
const norm = (html) =>
  String(html)
    .replace(/<style>[\s\S]*?<\/style>/g, '<style>/* css is covered by style tests */</style>')
    .replace(/(ITEMX(?: CODEX)?(?: ·)? v?)\d+\.\d+\.\d+(?:-[\w.]+)?/g, '$1VERSION');

async function renderCases() {
  const rt = await presentationRuntime();
  const empty = {
    key: 'c:chat',
    enabled: true,
    mainOutput: true,
    auxOutput: 'off',
    rarityMode: 'itemx',
    itemsEnabled: true,
    skillsEnabled: true,
    encountersEnabled: true,
    lorebookEncounterEnabled: false,
    moduleAssetsEnabled: true,
    effectsLevel: 'full',
    effectsEnabled: true,
    debugEnabled: false,
    fontScale: 'small',
    skin: 'dark',
    character: { name: 'Test' },
    chat: { message: [], scriptstate: {} },
    snapshot: { registry: { order: [], items: {} }, history: {}, fingerprint: 'a' },
    codexSnapshot: {
      skills: { order: [], entries: {} },
      monsters: { order: [], entries: {} },
      history: { skill: {}, monster: {} },
      fingerprint: 'b'
    }
  };
  const items = Object.keys(rt.renderer.affinities).map(
    (affinity, i) =>
      rt.core.normalizeItem({
        id: 'a' + i,
        name: affinity,
        rarity: 'legendary',
        affinity,
        count: 1,
        itemType: '검',
        possession: 'owned'
      }).item
  );
  const codex = rt.codex.extractResponse(
    '<skillExam><id>skill</id><name>검술</name><cost>내력 소모</cost></skillExam><monsterExam><id>guide</id><name>안내자</name><status>active</status></monsterExam>'
  ).snapshot;
  const full = {
    ...empty,
    rarityMode: 'world',
    moduleAssetsEnabled: false,
    snapshot: {
      registry: {
        order: items.map((i) => i.id),
        items: Object.fromEntries(items.map((i) => [i.id, i])),
        diagnostics: []
      },
      history: {},
      fingerprint: 'stable'
    },
    codexSnapshot: codex
  };
  const out = {};
  for (const [name, loaded] of Object.entries({ empty, full }))
    for (const skin of ['dark', 'light'])
      for (const enabled of [true, false])
        for (const tab of ['inventory', 'skills', 'bestiary', 'settings'])
          for (const open of [true, false]) {
            if (name === 'full' && !enabled) continue;
            out[`drawer/${name}/${skin}/${enabled ? 'on' : 'off'}/${tab}/${open ? 'open' : 'closed'}`] = norm(
              rt.rootInventoryHtml({ ...loaded, skin, enabled }, open, tab)
            );
          }
  for (const item of items)
    out[`card/${item.affinity}`] = norm(
      rt.displayHandler(rt.core.marker({ v: 2, event: { kind: 'exam', item }, view: item }))
    );
  return out;
}

test('rendered drawer and cards match the committed render oracle', async () => {
  const actual = await renderCases();
  if (process.env.ITEMX_UPDATE_SNAPSHOTS === '1' || !existsSync(FIXTURE)) {
    writeFileSync(FIXTURE, `${JSON.stringify(actual, null, 1)}\n`);
    return;
  }
  const expected = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
  for (const key of Object.keys(expected)) assert.equal(actual[key], expected[key], key);
});
