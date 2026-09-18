import { readFile } from 'node:fs/promises';
import { parsers } from 'prettier/plugins/babel';
export async function messageCatalog(locale = process.env.ITEMX_LOCALE || 'ko') {
  if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) throw new Error('Invalid ITEMX locale');
  const fallback = JSON.parse(await readFile(new URL('../src/locales/ko.json', import.meta.url), 'utf8'));
  if (locale === 'ko') return fallback;
  const translated = JSON.parse(await readFile(new URL(`../src/locales/${locale}.json`, import.meta.url), 'utf8'));
  return { ...fallback, ...translated };
}
const quote = text => "'" + text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + "'";
const template = text => text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
export function localizeSource(source, messages) {
  if (!source.includes('ITEMXText(')) return source;
  const ast = parsers.babel.parse(source);
  function children(node) { return Object.entries(node).filter(([key]) => !['comments', 'tokens', 'loc', 'extra'].includes(key)).flatMap(([, value]) => Array.isArray(value) ? value : [value]).filter(value => value && typeof value.type === 'string' && Number.isInteger(value.start)); }
  function render(node) {
    if (node.type === 'CallExpression' && node.callee.name === 'ITEMXText') {
      const key = node.arguments[0]?.value, text = messages[key];
      if (text === undefined) throw new Error(`Missing localized string: ${key}`);
      if (typeof text === 'string') { if (node.arguments.length !== 1) throw new Error(`Unexpected interpolation: ${key}`); return quote(text); }
      if (!Array.isArray(text) || text.length !== node.arguments.length) throw new Error(`Interpolation count mismatch: ${key}`);
      return '`' + text.map((part, index) => template(part) + (index < text.length - 1 ? '${' + render(node.arguments[index + 1]) + '}' : '')).join('') + '`';
    }
    let result = source.slice(node.start, node.end);
    for (const child of children(node).sort((a,b) => b.start-a.start)) result = result.slice(0,child.start-node.start) + render(child) + result.slice(child.end-node.start);
    return result;
  }
  return render(ast.program);
}
