/* A small SafeElement-compatible DOM for tests. It parses the HTML our
 * templates produce, answers the selectors the runtime uses and counts every
 * bridge call, so tests can assert RPC budgets as well as results. */
const VOID = new Set(['input', 'img', 'br', 'meta', 'link', 'hr', 'source', 'area', 'col', 'wbr']);

function decode(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

export class FakeNode {
  constructor(doc, tag, attrs = {}) {
    this.doc = doc;
    this.tag = tag;
    this.attrs = { ...attrs };
    this.children = [];
    this.parent = null;
    this.text = '';
    this.rect = null;
    this.listeners = [];
  }
  get classes() {
    return String(this.attrs.class || '')
      .split(/\s+/)
      .filter(Boolean);
  }
  set classes(list) {
    this.attrs.class = [...new Set(list)].join(' ');
  }
  descendants() {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
  textOf() {
    return this.tag === '#text' ? this.text : this.children.map((c) => c.textOf()).join('');
  }
  html() {
    return this.children.map((c) => c.outer()).join('');
  }
  outer() {
    if (this.tag === '#text') return this.text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    if (this.tag === '#comment') return `<!--${this.text}-->`;
    const attrs = Object.entries(this.attrs)
      .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${String(v).replace(/"/g, '&quot;')}"`))
      .join('');
    return VOID.has(this.tag) ? `<${this.tag}${attrs}>` : `<${this.tag}${attrs}>${this.html()}</${this.tag}>`;
  }
  setHtml(source) {
    for (const child of this.children) child.parent = null;
    this.children = [];
    const stack = [this];
    const re =
      /<!--([\s\S]*?)-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+|<)/g;
    let m;
    while ((m = re.exec(String(source)))) {
      const top = stack.at(-1);
      if (m[1] !== undefined) top.append(Object.assign(new FakeNode(this.doc, '#comment'), { text: m[1] }));
      else if (m[2]) {
        const tag = m[2].toLowerCase();
        const at = stack.findLastIndex((n) => n.tag === tag);
        if (at > 0) stack.length = at;
      } else if (m[3]) {
        const tag = m[3].toLowerCase(),
          attrs = {};
        for (const a of m[4].matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))
          attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
        const node = new FakeNode(this.doc, tag, attrs);
        top.append(node);
        if (!VOID.has(tag) && !m[0].endsWith('/>')) stack.push(node);
        if (tag === 'style' || tag === 'script') {
          const close = String(source).indexOf(`</${tag}`, re.lastIndex);
          const end = close < 0 ? String(source).length : close;
          node.append(
            Object.assign(new FakeNode(this.doc, '#text'), { text: String(source).slice(re.lastIndex, end) })
          );
          re.lastIndex = end;
        }
      } else if (m[5]) top.append(Object.assign(new FakeNode(this.doc, '#text'), { text: decode(m[5]) }));
    }
  }
  append(node) {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1);
    node.parent = this;
    this.children.push(node);
  }
  matchesSimple(part) {
    if (this.tag.startsWith('#')) return false;
    const re = /([.#]?)([\w-]+|\*)|\[([\w-]+)(?:([~^$*]?=)"?([^"\]]*)"?)?\]|:(checked|focus|not\(([^)]*)\))/g;
    let m;
    while ((m = re.exec(part))) {
      if (m[6] === 'checked') {
        if (!('checked' in this.attrs)) return false;
      } else if (m[6] === 'focus') {
        if (this.doc.focused !== this) return false;
      } else if (m[7] !== undefined) {
        if (this.matchesSimple(m[7])) return false;
      } else if (m[3]) {
        const value = this.attrs[m[3]];
        if (value === undefined) return false;
        if (m[4] === '=' && value !== m[5]) return false;
        if (m[4] === '*=' && !value.includes(m[5])) return false;
        if (m[4] === '^=' && !value.startsWith(m[5])) return false;
      } else if (m[1] === '.') {
        if (!this.classes.includes(m[2])) return false;
      } else if (m[1] === '#') {
        if (this.attrs.id !== m[2]) return false;
      } else if (m[2] !== '*' && this.tag !== m[2].toLowerCase()) return false;
    }
    return true;
  }
  // Compound selectors joined by descendant (space), child (>) and sibling (~).
  matches(selector) {
    return String(selector)
      .split(',')
      .some((one) => {
        const tokens = one
          .trim()
          .replace(/\s*([>~])\s*/g, ' $1 ')
          .split(/\s+/);
        const test = (node, index) => {
          if (!node || !node.matchesSimple(tokens[index])) return false;
          if (index === 0) return true;
          const combinator = tokens[index - 1];
          if (combinator === '>') return test(node.parent, index - 2);
          if (combinator === '~') {
            const siblings = node.parent?.children || [];
            return siblings.slice(0, siblings.indexOf(node)).some((s) => test(s, index - 2));
          }
          for (let up = node.parent; up; up = up.parent) if (test(up, index - 1)) return true;
          return false;
        };
        return test(this, tokens.length - 1);
      });
  }
  find(selector) {
    return this.descendants().filter((n) => n.matches(selector));
  }
}

export function createFakeDocument({ prefix = 'x-risu-', strict = true } = {}) {
  const calls = [];
  const doc = { calls, focused: null, prefix };
  const root = new FakeNode(doc, '#document');
  root.setHtml('<html><head></head><body></body></html>');
  const wrap = new WeakMap();
  const count = (name) => calls.push(name);
  const prefixed = (value) =>
    String(value)
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => (c.startsWith(prefix) || !prefix ? c : prefix + c))
      .join(' ');
  // The host sanitizer prefixes class names of injected markup.
  const sanitize = (node) => {
    if (!prefix) return;
    for (const one of node.descendants()) if (one.attrs.class) one.attrs.class = prefixed(one.attrs.class);
  };
  const safe = (node) => {
    if (!node) return null;
    if (wrap.has(node)) return wrap.get(node);
    const element = {
      node,
      async querySelector(selector) {
        count('querySelector');
        return safe(node.find(selector)[0] || null);
      },
      async querySelectorAll(selector) {
        count('querySelectorAll');
        return node.find(selector).map(safe);
      },
      async matches(selector) {
        count('matches');
        return node.matches(selector);
      },
      async getParent() {
        count('getParent');
        return node.parent && node.parent !== root ? safe(node.parent) : node.parent === root ? safe(root) : null;
      },
      async getBoundingClientRect() {
        count('getBoundingClientRect');
        const r = node.rect || doc.layout?.(node) || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
        return { ...r };
      },
      async textContent() {
        count('textContent');
        return node.textOf();
      },
      async setTextContent(value) {
        count('setTextContent');
        node.children = [];
        node.append(Object.assign(new FakeNode(doc, '#text'), { text: String(value) }));
      },
      async setInnerHTML(value) {
        count('setInnerHTML');
        node.setHtml(value);
        sanitize(node);
      },
      async getInnerHTML() {
        count('getInnerHTML');
        return node.html();
      },
      async getOuterHTML() {
        count('getOuterHTML');
        return node.outer();
      },
      async setOuterHTML(value) {
        count('setOuterHTML');
        const holder = new FakeNode(doc, 'div');
        holder.setHtml(value);
        sanitize(holder);
        const parent = node.parent;
        if (!parent) return;
        const at = parent.children.indexOf(node);
        parent.children.splice(at, 1, ...holder.children);
        for (const child of holder.children) child.parent = parent;
        node.parent = null;
      },
      async setClassName(value) {
        count('setClassName');
        node.attrs.class = prefixed(value);
      },
      async addClass(value) {
        count('addClass');
        node.classes = [...node.classes, prefixed(value)];
      },
      async removeClass(value) {
        count('removeClass');
        node.classes = node.classes.filter((c) => c !== prefixed(value));
      },
      async hasClass(value) {
        count('hasClass');
        return node.classes.includes(prefixed(value));
      },
      // The stock bridge only lets plugins touch x- attributes.
      async setAttribute(key, value) {
        count('setAttribute');
        if (strict && !String(key).startsWith('x-')) throw new Error(`SafeElement rejects attribute ${key}`);
        node.attrs[key] = key === 'class' ? prefixed(value) : String(value);
      },
      async getAttribute(key) {
        count('getAttribute');
        if (strict && !String(key).startsWith('x-')) throw new Error(`SafeElement rejects attribute ${key}`);
        return node.attrs[key] ?? null;
      },
      async removeAttribute(key) {
        count('removeAttribute');
        delete node.attrs[key];
      },
      async appendChild(child) {
        count('appendChild');
        node.append(child.node);
      },
      async remove() {
        count('remove');
        if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1);
        node.parent = null;
      },
      async focus() {
        count('focus');
        doc.focused = node;
      },
      createElement(tag) {
        count('createElement');
        return safe(new FakeNode(doc, String(tag).toLowerCase()));
      },
      async addEventListener(type, handler, capture) {
        count('addEventListener');
        const id = `listener-${doc.calls.length}`;
        node.listeners.push({ type, handler, capture, id });
        return id;
      },
      async removeEventListener(type, id) {
        count('removeEventListener');
        node.listeners = node.listeners.filter((l) => !(l.type === type && (l.id === id || l.handler === id)));
      }
    };
    wrap.set(node, element);
    return element;
  };
  const document = safe(root);
  // createElement on the document may be awaited or not, as on the real bridge.
  const create = document.createElement;
  document.createElement = (tag) => {
    const element = create(tag);
    return Object.assign(Promise.resolve(element), element);
  };
  return { doc, root, document, safe, body: () => root.find('body')[0], head: () => root.find('head')[0] };
}

// Fires a click at a point through the listeners registered on any node.
export async function click(dom, point) {
  const listeners = [dom.root, ...dom.root.descendants()].flatMap((n) => n.listeners.filter((l) => l.type === 'click'));
  for (const listener of listeners) await listener.handler({ clientX: point.x, clientY: point.y });
}

// A DOM-shaped facade over the same tree, for the plugin's own iframe document
// (the fallback panel), which the runtime reaches through real DOM calls.
export function createIframeDocument() {
  const dom = createFakeDocument({ prefix: '', strict: false });
  const wraps = new WeakMap();
  const el = (node) => {
    if (!node) return null;
    if (wraps.has(node)) return wraps.get(node);
    const facade = {
      node,
      querySelector: (selector) => el(node.find(selector)[0] || null),
      querySelectorAll: (selector) => node.find(selector).map(el),
      matches: (selector) => node.matches(selector),
      get parentElement() {
        return el(node.parent);
      },
      getBoundingClientRect: () =>
        node.rect || dom.doc.layout?.(node) || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
      get textContent() {
        return node.textOf();
      },
      set textContent(value) {
        node.children = [];
        node.append(Object.assign(new FakeNode(dom.doc, '#text'), { text: String(value) }));
      },
      get innerHTML() {
        return node.html();
      },
      set innerHTML(value) {
        node.setHtml(value);
      },
      set className(value) {
        node.attrs.class = String(value);
      },
      get className() {
        return node.attrs.class || '';
      },
      classList: {
        add: (value) => (node.classes = [...node.classes, value]),
        remove: (value) => (node.classes = node.classes.filter((c) => c !== value)),
        contains: (value) => node.classes.includes(value)
      },
      setAttribute: (key, value) => (node.attrs[key] = String(value)),
      getAttribute: (key) => node.attrs[key] ?? null,
      removeAttribute: (key) => delete node.attrs[key],
      appendChild: (child) => node.append(child.node),
      remove: () => {
        if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1);
        node.parent = null;
      },
      focus: () => (dom.doc.focused = node),
      addEventListener: (type, handler) => node.listeners.push({ type, handler }),
      removeEventListener: (type, handler) => (node.listeners = node.listeners.filter((l) => l.handler !== handler))
    };
    wraps.set(node, facade);
    return facade;
  };
  const document = el(dom.root);
  document.createElement = (tag) => el(new FakeNode(dom.doc, String(tag).toLowerCase()));
  Object.defineProperty(document, 'head', { get: () => el(dom.head()) });
  Object.defineProperty(document, 'body', { get: () => el(dom.body()) });
  return { ...dom, document };
}
