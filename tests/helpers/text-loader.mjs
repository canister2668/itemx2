/* Node counterpart of scripts/text-assets.mjs: `.css` and `.txt` imports are strings. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function load(url, context, nextLoad) {
  if (/\.(css|txt)$/.test(url)) {
    const text = await readFile(fileURLToPath(url), 'utf8');
    return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(text)};` };
  }
  return nextLoad(url, context);
}
