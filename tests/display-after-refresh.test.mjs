import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

// Older messages carry a compact ref instead of the whole payload, so the card
// can only be drawn once the chat's event ledger is loaded. After a refresh the
// display hook is live before anything reads the chat, so the ledger has to be
// loaded from that first read or the reader sees a restoring chip where a card
// belongs - and nothing redraws it.
function chatWithRef(rt) {
  const item = rt.core.normalizeItem({
    id: 'jade_blade', name: '청옥검', type: '검', internalrarity: 'legendary',
    possession: 'owned', location: 'inventory', count: 1
  }).item;
  const payload = { v: rt.core.VERSION, event: { kind: 'exam', item }, view: item };
  const ref = 'r1';
  return {
    body: `서사 본문<!--ITEMX2@${ref}-->`,
    chat: {
      message: [{ chatId: 'm0', role: 'char', data: `서사 본문<!--ITEMX2@${ref}-->` }],
      scriptstate: {
        '$__itemx2_message_events': JSON.stringify([{ ref, domain: 'item', payload }])
      }
    }
  };
}

test('a compact ref renders a card once the ledger is loaded', async () => {
  const rt = await presentationRuntime();
  const { body, chat } = chatWithRef(rt);
  rt.refreshLatest(chat);
  const html = rt.displayHandler(body);
  assert.match(html, /청옥검/, 'the card must carry the item');
  assert.equal(/기록 복원 중/.test(html), false, 'the restoring chip is not a card');
});

test('without the ledger the ref degrades to the restoring chip', async () => {
  const rt = await presentationRuntime();
  const { body } = chatWithRef(rt);
  rt.refreshLatest({ message: [], scriptstate: {} });
  const html = rt.displayHandler(body);
  assert.match(html, /기록 복원 중/, 'this is the state the boot order has to avoid');
});

test('bootstrap loads the ledger from its first chat read', async () => {
  const source = await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8');
  const boot = source.slice(source.indexOf('const initial = await context()'), source.indexOf('installPipelineHooks()'));
  assert.match(boot, /refreshLatest\(initial\.chat\)/, 'the ledger must load before the slow work');
  // It has to come before the rebuild, which is several awaits and a host write away.
  assert.ok(
    boot.indexOf('refreshLatest(initial.chat)') < boot.length,
    'the ledger load must not sit after the rebuild'
  );
  const rebuildAt = source.indexOf("rebuildCurrent({ upgradeDisplayRefs: true })");
  const loadAt = source.indexOf('refreshLatest(initial.chat)');
  assert.ok(loadAt > 0 && loadAt < rebuildAt, 'ledger load precedes the rebuild');
});
