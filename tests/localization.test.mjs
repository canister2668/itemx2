import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parsers } from 'prettier/plugins/babel';
import { t, catalog } from '../src/i18n.js';

const dir = new URL('../src/', import.meta.url);
const files = (await readdir(dir, { recursive: true })).filter((name) => name.endsWith('.js'));
const sources = Object.fromEntries(
  await Promise.all(files.map(async (name) => [name, await readFile(new URL(name, dir), 'utf8')]))
);
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const [key, value] of Object.entries(node))
    if (!['comments', 'tokens', 'loc', 'extra'].includes(key))
      Array.isArray(value) ? value.forEach((one) => walk(one, visit)) : walk(value, visit);
}
const calls = [];
for (const [name, source] of Object.entries(sources))
  walk(parsers.babel.parse(source), (node) => {
    if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 't')
      calls.push({ name, node });
  });

test('interpolation keeps argument order and never escapes or evaluates its values', () => {
  assert.equal(
    t('ui-settings.049', '<b>'),
    `${[].concat(catalog['ui-settings.049'])[0]}<b>${[].concat(catalog['ui-settings.049'])[1]}`
  );
  assert.throws(() => t('no.such.key'), /Missing ITEMX text/);
});

test('every t() call names a catalog entry with a static key and matching arity', () => {
  assert.ok(calls.length > 300, 'scanner missed the runtime');
  for (const { name, node } of calls) {
    assert.equal(node.arguments[0]?.type, 'StringLiteral', `${name}: dynamic text key`);
    const key = node.arguments[0].value,
      entry = catalog[key];
    assert.ok(entry !== undefined, `${name}: missing text ${key}`);
    const expected = typeof entry === 'string' ? 0 : entry.length - 1;
    assert.equal(node.arguments.length - 1, expected, `${name}: ${key} takes ${expected} values`);
  }
});

test('the catalog is text only and every entry is used', () => {
  const used = new Set(calls.map(({ node }) => node.arguments[0]?.value));
  for (const [key, entry] of Object.entries(catalog)) {
    assert.doesNotMatch([].concat(entry).join(''), /<\/?[a-z][^>]*>/i, `${key} carries markup`);
    assert.ok(used.has(key), `${key} is never used`);
  }
});

// Engine modules keep Korean only as domain data and parsing vocabulary
// (grade labels, lore field names); every message and label lives in the catalog.
test('no module outside the engine carries a Korean literal', () => {
  for (const [name, source] of Object.entries(sources)) {
    if (name.startsWith('engine/')) continue;
    walk(parsers.babel.parse(source), (node) => {
      if (node.type === 'StringLiteral') assert.doesNotMatch(node.value, /[가-힣]/, `${name}: ${node.value}`);
      if (node.type === 'TemplateElement') assert.doesNotMatch(node.value.cooked || '', /[가-힣]/, name);
    });
  }
});
