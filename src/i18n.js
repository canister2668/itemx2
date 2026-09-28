/* Text catalog. Entries are plain text; an array entry interleaves its
 * arguments between the pieces. Markup never lives in the catalog. */
import catalog from './locales/ko.json' with { type: 'json' };

export function t(key, ...args) {
  const entry = catalog[key];
  if (entry === undefined) throw new Error(`Missing ITEMX text: ${key}`);
  if (typeof entry === 'string') return entry;
  let out = entry[0];
  for (let index = 1; index < entry.length; index += 1) out += String(args[index - 1] ?? '') + entry[index];
  return out;
}

export { catalog };
