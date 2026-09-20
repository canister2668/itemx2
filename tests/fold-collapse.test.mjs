import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');

// overflow:hidden on a closed <details> collapses it to its border width in
// Chrome: the 48px summary is clipped away and the fold shows as a hairline.
// That silently hid both the item manager and the debug diagnostics.
// overflow:clip still rounds the corners without collapsing it.
test('the settings folds clip without collapsing the closed summary', () => {
  const rule = source.match(/\.itemx2-manager-fold\{[^}]*\}/);
  assert.ok(rule, 'the fold rule is gone');
  assert.match(rule[0], /overflow:clip/);
  assert.equal(/overflow:hidden/.test(rule[0]), false, 'overflow:hidden collapses a closed details');
});

// Both folds share the rule, so a regression takes the item manager with it.
test('both settings folds use the shared rule', () => {
  assert.match(source, /itemx2-manager-fold itemx2-debug-fold/);
  assert.ok(
    (source.match(/class=\\"itemx2-manager-fold/g) || source.match(/itemx2-manager-fold/g) || []).length > 1,
    'the manager fold no longer shares the rule'
  );
});
