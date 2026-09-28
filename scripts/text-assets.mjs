/* Text imports shared by the esbuild bundle and the Node test loader: CSS and
 * the model protocol are source files, imported as strings. */
import { readFile } from 'node:fs/promises';
import * as esbuild from 'esbuild';

export async function loadText(path, { minifyCss = false } = {}) {
  const source = await readFile(path, 'utf8');
  if (!minifyCss || !path.endsWith('.css')) return source;
  const { code } = await esbuild.transform(source, { loader: 'css', minify: true, logLevel: 'silent' });
  return code.trimEnd();
}

export function textAssets(options = {}) {
  return {
    name: 'itemx-text-assets',
    setup(build) {
      build.onLoad({ filter: /\.(css|txt)$/ }, async (args) => ({
        contents: `export default ${JSON.stringify(await loadText(args.path, options))};`,
        loader: 'js'
      }));
    }
  };
}
