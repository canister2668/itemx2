import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { Panel, setHost, Session, Style, uiState } from './helpers/modules.mjs';

const item = (id, name) => ({
  id,
  name,
  itemType: '무기',
  rarity: 'rare',
  displayRarity: '레어',
  possession: 'owned',
  location: 'inventory',
  count: 1,
  effects: [],
  augments: []
});
const loaded = {
  key: 'del',
  character: { name: 'T' },
  chat: { message: [] },
  snapshot: { registry: { order: ['a', 'b'], items: { a: item('a', '첫 검'), b: item('b', '둘째 검') } }, history: {} },
  codexSnapshot: { skills: { order: [], entries: {} }, monsters: { order: [], entries: {} }, history: {} }
};
// Both details were opened once, so both bodies hold a delete button; the
// second item is the one open now.
const drawer = (checked) =>
  [0, 1]
    .map(
      (index) =>
        `<div class="x-risu-itemx2-root-item"><input id="itemx2-detail-${index}"${index === checked ? ' checked' : ''}><div class="x-risu-itemx2-root-detail"><div class="x-risu-itemx2-root-detail-body-${index}"><button class="x-risu-itemx2-entity-delete">지우기</button></div></div></div>`
    )
    .join('');

test('the delete button of the open item takes the click even when an earlier detail kept its button', async () => {
  const fake = createFakeHost({ document: true });
  await Style.removeMainStyle();
  setHost(fake.api);
  await Style.installMainStyle();
  Session.resetSession('del');
  uiState.query = '';
  fake.dom.body().setHtml(drawer(1));
  const buttons = fake.dom.root.find('.x-risu-itemx2-entity-delete');
  assert.equal(buttons.length, 2);
  // The hidden first button measures zero; the open one sits under the click.
  buttons[1].rect = { left: 10, top: 10, right: 110, bottom: 40, width: 100, height: 30 };
  const handled = await Panel.routeEntityDelete({ clientX: 50, clientY: 20 }, loaded, 'item');
  assert.equal(handled, true);
  assert.equal(Panel.deleteArmed, 'item:b');
});
