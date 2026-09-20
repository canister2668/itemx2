import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');

// 헤더 컨트롤은 모든 탭에서 보이지만, 설정 액션 라우팅은
// activeRootTab !== 'settings' 에서 끊긴다. 전원 토글을 헤더로 옮겼을 때
// 라우팅을 같이 옮기지 않아 설정 탭 밖에서는 눌러도 무반응이었다.
test('header actions route before the settings tab gate', () => {
  const headerLoop = source.indexOf('if (!action.header) continue;');
  const tabGate = source.indexOf("if (uiState.activeRootTab !== 'settings') return;");
  assert.ok(headerLoop > 0, 'header action loop missing');
  assert.ok(tabGate > 0, 'settings tab gate missing');
  assert.ok(headerLoop < tabGate, 'header actions must be routed before the tab gate');
});

test('the bot power toggle declares itself a header control', () => {
  const row = source.slice(source.indexOf("hook: 'itemx2-setting-toggle'"), source.indexOf("hook: 'itemx2-setting-toggle'") + 120);
  assert.match(row, /header: true/);
});

// 헤더 마크업과 액션 표시가 어긋나면 다시 무반응이 된다.
test('the header markup carries the power toggle hook', () => {
  assert.ok(
    source.includes('itemx-ph-btn itemx2-sw-power itemx2-setting-toggle'),
    'the header markup no longer carries the power toggle hook'
  );
});
