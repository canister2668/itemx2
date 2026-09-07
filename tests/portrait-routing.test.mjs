import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

test('list portrait survives cached-copy detail hydration and inline rendering', async () => {
  let detailHtml = '',
    reads = 0;
  const mayuri = {
    id: 'mayuri',
    name: '마유리',
    portrait: 'Mayuri',
    glyph: '🪓',
    status: 'active',
    relation: 'hostile',
    active: true
  };
  const testCtx = {
    key: 'murim',
    character: { chaId: 'murim', additionalAssets: [['Mayuri', 'assets/mayuri.png', 'avif']] },
    chat: { message: [] }
  };
  const p = await presentationRuntime(
    {
      testCtx,
      btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      Risuai: {
        readImage: async (id) => {
          assert.equal(id, 'assets/mayuri.png');
          reads++;
          return [0, 0, 0, 20, 102, 116, 121, 112, 97, 118, 105, 102];
        }
      }
    },
    `context = async () => testCtx; outputSettings = async () => ({moduleAssetsEnabled:false});
    runtime.testLoadPortraits = loadCodexPortraits;
    runtime.testHydrateDetail = hydrateCheckedCodexDetail;
    runtime.testDisplay = displayWithPortraits;`
  );
  const loaded = { ...testCtx, codexSnapshot: { monsters: { order: ['mayuri'], entries: { mayuri } } } };
  p.runtime.activeContextKey = 'murim';
  p.runtime.mainDoc = {
    querySelector: async (selector) =>
      selector.includes(':checked')
        ? { textContent: async () => '0' }
        : {
            setInnerHTML: async (html) => {
              detailHtml = html;
            }
          }
  };
  const listCopy = { ...loaded };
  listCopy.portraits = await p.runtime.testLoadPortraits(loaded.character, loaded.chat, loaded.codexSnapshot, loaded);
  assert.match(listCopy.portraits.mayuri, /^data:image\/avif;base64,/);
  assert.equal(loaded.portraits, undefined);
  assert.equal(await p.runtime.testHydrateDetail('monster', loaded), true);
  assert.match(detailHtml, /class="itemx-monster-portrait" src="data:image\/avif;base64,/);
  const marker = p.codex.marker({ v: 1, event: { domain: 'monster', kind: 'exam', entity: mayuri }, view: mayuri });
  const inline = await p.runtime.testDisplay(marker);
  assert.match(inline, /itemx2-inline-icon"><img src="data:image\/avif;base64,/);
  assert.equal(reads, 1, 'list, detail and inline share the asset cache');
  const compact = p.embeddedViewCode(
    { event: { domain: 'monster', kind: 'exam', entity: mayuri }, view: mayuri },
    'codex'
  );
  p.runtime.eventPayloads.set('codex:c1', { event: { domain: 'monster', kind: 'exam', entity: mayuri }, view: mayuri });
  assert.match(await p.runtime.testDisplay(`<!--CODEX2@c1:${compact}-->`), /itemx2-inline-icon"><img/);
  const unknown = { ...mayuri, id: 'brigands', name: '이름 없는 도적들', portrait: 'NONE' };
  const fallback = await p.runtime.testDisplay(
    p.codex.marker({ v: 1, event: { domain: 'monster', kind: 'exam', entity: unknown }, view: unknown })
  );
  assert.match(fallback, /itemx2-inline-icon"><span>🪓/);
});

test('cold concurrent display returns immediately without host reads or writes', async () => {
  let hostCalls = 0;
  const p = await presentationRuntime(
    {
      Risuai: new Proxy(
        {},
        {
          get: () => () => {
            hostCalls++;
            return new Promise(() => {});
          }
        }
      )
    },
    'runtime.testDisplay = displayWithPortraits;'
  );
  p.runtime.activeContextKey = 'murim';
  const entity = {
    id: 'mayuri',
    name: '마유리',
    portrait: 'Mayuri',
    glyph: '🪓',
    status: 'active',
    relation: 'hostile'
  };
  const marker = p.codex.marker({ v: 1, event: { domain: 'monster', kind: 'exam', entity }, view: entity });
  for (let i = 0; i < 100; i++) {
    const html = p.runtime.testDisplay(marker);
    assert.equal(typeof html, 'string', 'display must not wait for any host promise');
    assert.match(html, /마유리/);
  }
  assert.equal(hostCalls, 0);
});

test('portrait preparation coalesces concurrent recovery work without waiting for a stalled image read', async () => {
  let reads = 0;
  const p = await presentationRuntime(
    {
      Risuai: {
        readImage: () => {
          reads++;
          return new Promise(() => {});
        }
      }
    },
    'runtime.testPrepare = prepareInlinePortraits; runtime.testDisplay = displayWithPortraits;'
  );
  p.runtime.activeContextKey = 'murim';
  const entity = {
    id: 'mayuri',
    name: '마유리',
    portrait: 'Mayuri',
    glyph: '🪓',
    status: 'active',
    relation: 'hostile'
  };
  const ctx = {
    key: 'murim',
    character: { chaId: 'murim', additionalAssets: [['Mayuri', 'assets/mayuri.png', 'avif']] },
    chat: { message: [] }
  };
  const snapshot = { monsters: { order: ['mayuri'], entries: { mayuri: entity } } };
  for (let i = 0; i < 20; i++)
    assert.equal(p.runtime.testPrepare(ctx, snapshot, { moduleAssetsEnabled: false }), undefined);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(reads, 1, 'only one in-flight image read despite concurrent recovery/rebuild');
  const marker = p.codex.marker({ v: 1, event: { domain: 'monster', kind: 'exam', entity }, view: entity });
  assert.equal(typeof p.runtime.testDisplay(marker), 'string');
  assert.equal(reads, 1, 'display must not retry a stalled image');
  p.runtime.activeContextKey = 'another-chat';
  p.runtime.portraitThumbnailCache.set('murim:assets/mayuri.png:avif', 'data:image/avif;base64,AAAA');
  assert.doesNotMatch(p.runtime.testDisplay(marker), /<img/, 'old chat portraits must not leak across contexts');
});

test('large original images never enter inline HTML or the inline-only original cache', async () => {
  const full = 'data:image/png;base64,' + 'A'.repeat(300000);
  const p = await presentationRuntime(
    { Risuai: { readImage: async () => full } },
    'runtime.testLoadPortraits = loadCodexPortraits; runtime.testDisplay = displayWithPortraits;'
  );
  p.runtime.activeContextKey = 'murim';
  const entity = {
    id: 'mayuri',
    name: '마유리',
    portrait: 'Mayuri',
    glyph: '🪓',
    status: 'active',
    relation: 'hostile'
  };
  const character = { chaId: 'murim', additionalAssets: [['Mayuri', 'assets/mayuri.png', 'png']] };
  const snapshot = { monsters: { order: ['mayuri'], entries: { mayuri: entity } } };
  await p.runtime.testLoadPortraits(character, { message: [] }, snapshot, { moduleAssetsEnabled: false }, true);
  assert.equal(p.runtime.portraitCache.size, 0, 'inline preparation must not retain original images');
  const marker = p.codex.marker({ v: 1, event: { domain: 'monster', kind: 'exam', entity }, view: entity });
  const html = p.runtime.testDisplay(marker);
  assert.equal(html.includes(full), false);
  assert.match(
    html,
    /itemx2-inline-icon"><span>🪓/,
    'no thumbnail API must fall back instead of embedding a full image'
  );
  const details = await p.runtime.testLoadPortraits(character, { message: [] }, snapshot, {
    moduleAssetsEnabled: false
  });
  assert.equal(details.mayuri, full, 'detail keeps its original portrait');
});

test('history pages load only visible portraits and late selected records get original detail assets', async () => {
  const reads = [];
  const p = await presentationRuntime(
    {
      Risuai: {
        readImage: async (id) => {
          reads.push(id);
          return 'data:image/png;base64,AAAA';
        }
      }
    },
    'runtime.testPrepareHistory = prepareHistoryPortraits; runtime.testHistoryHtml = historyHtml;'
  );
  const entities = Object.fromEntries(
    Array.from({ length: 33 }, (_, i) => [
      `m${i}`,
      { id: `m${i}`, name: `상대${i}`, portrait: `P${i}`, glyph: '👺', status: 'ended', active: false }
    ])
  );
  const loaded = {
    key: 'history',
    character: {
      chaId: 'history',
      additionalAssets: Object.keys(entities).map((id, i) => [`P${i}`, `assets/${id}.png`, 'png'])
    },
    chat: { message: [], scriptstate: {} },
    moduleAssetsEnabled: false,
    snapshot: { registry: { order: [], entries: {} } },
    codexSnapshot: { monsters: { order: Object.keys(entities), entries: entities }, history: { monster: {} } }
  };
  p.runtime.historyView = { open: true, key: 'history', domain: 'monster', filter: 'recent', page: 1, selected: null };
  await p.runtime.testPrepareHistory(loaded);
  assert.equal(reads.length, 16);
  assert.equal(Object.keys(loaded.historyThumbnails).length, 16);
  assert.match(p.runtime.testHistoryHtml(loaded), /<img[^>]+data:image\/png;base64,AAAA/);
  p.runtime.historyView.selected = 'm32';
  await p.runtime.testPrepareHistory(loaded);
  assert.equal(reads.length, 17);
  assert.equal(reads.at(-1), 'assets/m32.png');
  assert.equal(loaded.portraits.m32, 'data:image/png;base64,AAAA');
  assert.match(p.runtime.testHistoryHtml(loaded), /class="itemx-monster-portrait" src="data:image\/png;base64,AAAA/);
});
