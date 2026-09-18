import { messageCatalog, localizeSource } from './localize.mjs';
import { readFile } from 'node:fs/promises';
// Plain concatenation: order declares shared constants before bootstrap runs.
export const runtimeModules = ['runtime-config', 'ui-surface', 'style', 'ui-settings', 'portraits', 'ledger', 'aux', 'pipeline', 'presentation', 'ui-panel'];
export async function runtimeSource() {
  const [bootstrap, ...modules] = await Promise.all(['runtime', ...runtimeModules].map(name => readFile(new URL(`../src/${name}.js`, import.meta.url), 'utf8')));
  if (bootstrap.split('/* ITEMX_MODULES */').length !== 2) throw new Error('runtime assembly marker must be unique');
  return localizeSource(bootstrap.replace('/* ITEMX_MODULES */', modules.join('\n')), await messageCatalog());
}
export async function styleSources() {
  const source = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  const sections = source.split(/\/\* ITEMX_CSS_(?:SHELL|CARDS|PRESENTATION) \*\/\n/).slice(1);
  if (sections.length !== 3) throw new Error('missing consolidated stylesheet section');
  return { shell: sections[0], cards: sections[1], presentation: sections[2] };
}
