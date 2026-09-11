import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(projectRoot, 'docs/itemx-codex-2.0-arca-guide.html');
const htmlPath = resolve(projectRoot, 'docs/itemx-codex-2.0-arca-body.html');
const textPath = resolve(projectRoot, 'docs/itemx-codex-2.0-arca-body.txt');
const source = await readFile(sourcePath, 'utf8');
const bodyMatch = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);

if (!bodyMatch) {
  throw new Error('Guide body was not found.');
}

const body = bodyMatch[1]
  .trim()
  .replace(/\sloading="lazy"/g, '')
  .replace(
    /src="assets\/guide\/([^"]+)"/g,
    'src="https://raw.githubusercontent.com/canister2668/itemx2/main/docs/assets/guide/$1"',
  );

if (/<\/?(?:html|head|body)\b/i.test(body)) {
  throw new Error('Document wrapper leaked into the paste-ready fragment.');
}

const imageUrls = [...body.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)].map((match) => match[1]);
if (
  imageUrls.length !== 7
  || imageUrls.some((url) => !url.startsWith('https://raw.githubusercontent.com/canister2668/itemx2/main/docs/assets/guide/'))
) {
  throw new Error(`Unexpected guide image set: ${imageUrls.length}`);
}

await Promise.all([
  writeFile(htmlPath, `${body}\n`, 'utf8'),
  writeFile(textPath, `${body}\n`, 'utf8'),
]);

console.log(`Created ${htmlPath}`);
console.log(`Created ${textPath}`);
console.log(`Images: ${imageUrls.length}`);
