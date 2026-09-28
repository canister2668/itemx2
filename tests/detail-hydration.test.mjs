import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { rt, setHost, Session, Style, uiState } from './helpers/modules.mjs';

const skills = (order) => {
  const snapshot = rt.codex.extractResponse(
    '<skillExam><id>a</id><name>검술</name></skillExam><skillExam><id>b</id><name>궁술</name></skillExam>'
  ).snapshot;
  snapshot.skills.order = order;
  return snapshot;
};
const loadedWith = (order) => ({
  key: 'detail',
  character: { name: 'T' },
  chat: { message: [] },
  rarityMode: 'world',
  snapshot: { registry: { order: [], items: {} }, history: {} },
  codexSnapshot: skills(order)
});
const drawer = (checked) =>
  [0, 1]
    .map(
      (index) =>
        `<input class="x-risu-itemx2-skill-entry-choice"${index === checked ? ' checked' : ''}><div class="x-risu-itemx2-skill-detail"><span class="x-risu-itemx2-codex-detail-index">${index}</span></div><div class="x-risu-itemx2-root-skill-detail-body-${index}"></div>`
    )
    .join('');

test('a detail card is written into the body of the entry now selected, not assumed from an earlier body', async () => {
  const fake = createFakeHost({ document: true });
  await Style.removeMainStyle();
  setHost(fake.api);
  await Style.installMainStyle();
  Session.resetSession('detail');
  uiState.query = '';
  const body = (index) => fake.dom.root.find(`.x-risu-itemx2-root-skill-detail-body-${index}`)[0].html();

  fake.dom.body().setHtml(drawer(0));
  assert.equal(await rt.hydrateCheckedCodexDetail('skill', loadedWith(['a', 'b'])), true);
  assert.match(body(0), /검술/);

  // The list order changes without a drawer render (a filter or a commit):
  // the same skill is now entry 1, whose body is still empty.
  fake.dom.body().setHtml(drawer(1));
  assert.equal(await rt.hydrateCheckedCodexDetail('skill', loadedWith(['b', 'a'])), true);
  assert.match(body(1), /검술/);

  // Tapping the same selection again does not rewrite the card.
  const writes = fake.dom.doc.calls.filter((call) => call === 'setInnerHTML').length;
  await rt.hydrateCheckedCodexDetail('skill', loadedWith(['b', 'a']));
  assert.equal(fake.dom.doc.calls.filter((call) => call === 'setInnerHTML').length, writes);
});
