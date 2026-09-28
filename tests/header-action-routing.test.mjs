import test from 'node:test';
import assert from 'node:assert/strict';
import { rt } from './helpers/modules.mjs';

const loaded = {
  key: 'k',
  enabled: true,
  character: { name: 'T' },
  chat: { message: [], scriptstate: {} },
  snapshot: { registry: rt.core.newRegistry() },
  codexSnapshot: rt.codex.snapshot(),
  itemsEnabled: true,
  skillsEnabled: true,
  encountersEnabled: true
};

// 헤더 컨트롤은 모든 탭에서 보인다. 전원 토글을 헤더로 옮기면서 라우팅을 같이
// 옮기지 않아 설정 탭 밖에서는 눌러도 무반응이었던 회귀를 막는다.
test('the bot power toggle declares itself a header control', () => {
  const row = rt.rootSettingActions().find((action) => action.hook === 'itemx2-setting-toggle');
  assert.equal(row?.header, true);
});

test('every tab renders the power toggle hook in the header', () => {
  for (const tab of ['inventory', 'skills', 'bestiary', 'settings']) {
    const html = rt.rootInventoryHtml(loaded, true, tab);
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    assert.ok(header.includes('itemx-ph-btn itemx2-sw-power itemx2-setting-toggle'), tab);
  }
});
