import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeSource, messageCatalog } from '../scripts/localize.mjs';
import { readFile } from 'node:fs/promises';
import { runtimeModules } from '../scripts/runtime-source.mjs';
import { parsers } from 'prettier/plugins/babel';
import vm from 'node:vm';

test('localization preserves interpolation order, escaping and nested messages', () => {
  const source = "ITEMXText('sentence', ITEMXText('name'), '<script>')";
  assert.equal(vm.runInNewContext(localizeSource(source, { name: '이름', sentence: ['안녕 ', ': ', ' 끝'] })), '안녕 이름: <script> 끝');
  assert.equal(vm.runInNewContext(localizeSource(source, { name: 'Name', sentence: ['Hello ', ': ', ' end'] })), 'Hello Name: <script> end');
  assert.throws(() => localizeSource(source, { name: 'Name', sentence: ['short'] }), /Interpolation count/);
  assert.throws(() => localizeSource(source, {}), /Missing localized/);
});

test('runtime modules keep Korean literal messages in the catalog', async () => {
  const messages = await messageCatalog();
  assert.ok(Object.keys(messages).length >= 450);
  for (const name of ['runtime', ...runtimeModules]) {
    const source = await readFile(new URL(`../src/${name}.js`, import.meta.url), 'utf8');
    const ast = parsers.babel.parse(source);
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'StringLiteral') assert.doesNotMatch(node.value, /[가-힣]/, name);
      if (node.type === 'TemplateElement') assert.doesNotMatch(node.value.cooked || '', /[가-힣]/, name);
      for (const [key, value] of Object.entries(node)) if (!['comments','tokens','loc','extra'].includes(key)) Array.isArray(value) ? value.forEach(walk) : walk(value);
    }
    walk(ast);
  }
});
