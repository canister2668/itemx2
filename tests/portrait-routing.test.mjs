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
