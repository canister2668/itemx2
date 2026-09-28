/* Rescopes the card stylesheet into the host chat body (.chattext, x-risu-
 * prefixed classes). Interim: 2.4 phase 4 replaces the duplicated scoped copy. */
function scopeSelectors(selectorList) {
  return selectorList
    .split(',')
    .map((selector) => {
      const value = selector.trim();
      if (!value) return value;
      return `.chattext ${value.replace(/\.([a-zA-Z][\w-]*)/g, (_, name) => (name.startsWith('x-risu-') ? `.${name}` : `.x-risu-${name}`))}`;
    })
    .join(', ');
}

export function scopeBlock(source) {
  let out = '',
    cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf('{', cursor);
    if (open < 0) {
      out += source.slice(cursor);
      break;
    }
    const prelude = source.slice(cursor, open).trim();
    let depth = 1,
      end = open + 1;
    while (end < source.length && depth > 0) {
      if (source[end] === '{') depth += 1;
      else if (source[end] === '}') depth -= 1;
      end += 1;
    }
    const body = source.slice(open + 1, end - 1);
    if (prelude.startsWith('@'))
      out += /^@(media|supports|document|container)/.test(prelude)
        ? `${prelude}{${scopeBlock(body)}}`
        : `${prelude}{${body}}`;
    else out += `${scopeSelectors(prelude)}{${body}}`;
    cursor = end;
  }
  return out;
}
