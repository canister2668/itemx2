import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { setHost } from '../src/host.js';
import * as Settings from '../src/settings.js';
import * as Transport from '../src/transport.js';
import { rt } from './helpers/modules.mjs';

const BASE = { itemsEnabled: true, skillsEnabled: false, encountersEnabled: false, rarityMode: 'itemx' };

test('the author note is stored per bot as trimmed, capped text', async () => {
  setHost(createFakeHost().api);
  const long = `  ${'가'.repeat(Settings.AUTHOR_NOTE_MAX + 50)}  `;
  const saved = await Settings.changeSettings({ chaId: 'a' }, { authorNote: long });
  assert.equal(saved.authorNote.length, Settings.AUTHOR_NOTE_MAX);
  const other = await Settings.settingsFor({ chaId: 'b' });
  assert.equal(other.authorNote, '');
  const wrong = await Settings.changeSettings({ chaId: 'c' }, { authorNote: { x: 1 } });
  assert.equal(wrong.authorNote, '');
  const crlf = await Settings.changeSettings({ chaId: 'd' }, { authorNote: 'a\r\nb\rc' });
  assert.equal(crlf.authorNote, 'a\nb\nc');
});

test('the request protocol carries the author note only when one is written', () => {
  const without = Transport.protocolForSettings({ ...BASE, authorNote: '' }, { name: 'T' });
  assert.ok(!without.includes("AUTHOR'S NOTE"));
  const withNote = Transport.protocolForSettings({ ...BASE, authorNote: '금화 기준으로 매긴다' }, { name: 'T' });
  assert.ok(withNote.includes("ITEMX AUTHOR'S NOTE"));
  assert.ok(withNote.trimEnd().endsWith('금화 기준으로 매긴다'));
  const off = Transport.protocolForSettings({ ...BASE, itemsEnabled: false, authorNote: '금화' }, { name: 'T' });
  assert.equal(off, '', 'no domain enabled means no protocol, note included');
});

test('the drawer has no contenteditable box: v3 setInnerHTML strips the attribute', () => {
  const loaded = {
    key: 'c0:ch0',
    enabled: true,
    mainOutput: true,
    auxOutput: 'off',
    rarityMode: 'itemx',
    itemsEnabled: true,
    skillsEnabled: true,
    encountersEnabled: false,
    authorNote: '가치는 금화 기준',
    character: { name: 'T' },
    chat: { message: [], scriptstate: {} },
    snapshot: { registry: { order: [], items: {} }, history: {}, fingerprint: 'a' },
    codexSnapshot: {
      skills: { order: [], entries: {} },
      monsters: { order: [], entries: {} },
      history: { skill: {}, monster: {} },
      fingerprint: 'b'
    }
  };
  for (const tab of ['inventory', 'settings']) {
    const html = rt.rootInventoryHtml(loaded, true, tab);
    assert.ok(!/contenteditable/i.test(html), tab);
  }
  const settings = rt.rootInventoryHtml(loaded, true, 'settings');
  assert.ok(settings.includes('itemx2-setting-author-note'));
  assert.ok(settings.includes('가치는 금화 기준'));
});
