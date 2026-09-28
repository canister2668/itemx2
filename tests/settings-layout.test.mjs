import { styleSources } from '../scripts/runtime-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('grouped settings actions cannot shrink into vertical text', async () => {
  const css = await styleSources().then((styles) => styles.presentation);
  // Both screens render one vocabulary now, so one rule covers both.
  assert.match(css, /\.itemx2-root-setting-card > \.itemx2-manager-actions \{[\s\S]*?flex: 0 0 100%/);
  assert.match(css, /\.itemx2-root-setting-card \.itemx2-root-setting-button \{[\s\S]*?white-space: nowrap/);
  assert.ok(!css.includes('.itemx-setting-card'), 'the retired fallback vocabulary must not linger');
});
