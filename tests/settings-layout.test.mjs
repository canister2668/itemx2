import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

test('grouped settings actions cannot shrink into vertical text', async () => {
  const css = await readFile(new URL('../src/styles/presentation.css', import.meta.url), 'utf8');
  // Both screens render one vocabulary now, so one rule covers both.
  assert.match(css, /\.itemx2-root-setting-card > \.itemx2-manager-actions \{[\s\S]*?flex: 0 0 100%/);
  assert.match(css, /\.itemx2-root-setting-card \.itemx2-root-setting-button \{[\s\S]*?white-space: nowrap/);
  assert.ok(!css.includes('.itemx-setting-card'), 'the retired fallback vocabulary must not linger');
});
