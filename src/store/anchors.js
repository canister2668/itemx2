/* Card anchors in message text. A stored message carries only a short comment
 * per card position, `<!--ix:k7f2q-->`; everything the card shows lives in
 * the chat's ledger document under that key. */
import * as Codex from '../engine/codex.js';
import * as Core from '../engine/core.js';

export const ANCHOR_RE = /<!--ix:([0-9a-z]{4,12})-->/g;
const ANCHOR_TEST_RE = /<!--ix:[0-9a-z]{4,12}-->/;

// Transport markers the parsers emit while turning model tags into events.
// They exist only inside one processing pass and never reach message text.
export const TRANSPORT_MARKER_RE = /<!--(ITEMX2|CODEX2):([A-Za-z0-9_-]+)-->/g;

export const anchor = (key) => `<!--ix:${key}-->`;
export const hasAnchor = (text) => ANCHOR_TEST_RE.test(String(text || ''));

export function anchorKeys(text) {
  const source = String(text || '');
  if (!source.includes('<!--ix:')) return [];
  return [...source.matchAll(ANCHOR_RE)].map((match) => match[1]);
}

// Card keys of a stored message, remembered by message id. Every pass reads
// the keys of every loaded message; a long chat must not regex-scan all of
// its text each time. A hit costs one string comparison (a pointer check when
// the host hands back the same string).
const KEY_CACHE_LIMIT = 4096;
const keyCache = new Map();
export function messageKeys(message) {
  const text = Core.messageText(message);
  const id = typeof message?.chatId === 'string' ? message.chatId : '';
  if (!id) return anchorKeys(text);
  const hit = keyCache.get(id);
  if (hit && hit.text === text) return hit.keys;
  const keys = anchorKeys(text);
  keyCache.delete(id);
  keyCache.set(id, { text, keys });
  if (keyCache.size > KEY_CACHE_LIMIT) keyCache.delete(keyCache.keys().next().value);
  return keys;
}

const tidy = (text) => text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

export const stripAnchors = (text) => String(text || '').replace(ANCHOR_RE, '');

// Comments ITEMX 2.0 – 2.3 left in message text. Their data is not read; they
// are only kept out of model requests.
const OLD_MARKER_RE = /<!--(?:ITEMX2|CODEX2)[:@][^>]*-->/g;
export const countOldMarkers = (text) => (String(text || '').match(OLD_MARKER_RE) || []).length;
export const stripOldMarkers = (text) => String(text || '').replace(OLD_MARKER_RE, '');

// What the model sees of a stored message: no anchors, no old markers.
export function requestText(text) {
  const source = String(text || '');
  const stripped = stripOldMarkers(stripAnchors(source));
  return stripped === source ? source : tidy(stripped);
}

// Plain text the parsers must leave alone. The engine reads every `[아이템: …]`
// line and every bracket tag in `inline code` as a transport, and drops each
// bare ``` line of a reply that carries a tag. Before parsing:
//   - a Korean alias without an id= / name= field is a status line of the
//     story, and a bracket tag inside inline code is a mention: both get a
//     guard character the engine's patterns do not match;
//   - each bare fence line is replaced by a token on its own line.
// `restore` takes the guards out again and puts the fences back, except
// around a block that only wrapped transport tags.
const GUARD = '\uE83A';
const FENCE_MARK = '\uE83B';
const GUARDED_RE = /(\[(?:itemx|아이템))\uE83A/gi;
const KOREAN_ALIAS_RE = /(\[아이템)(\s*:([^\]\r\n]*)\])/g;
const IDENTITY_FIELD_RE = /(?:^|\|)\s*(?:id|name|이름)\s*=/i;
const BRACKET_OPEN_RE = /(\[(?:itemx|아이템))(?=\s*:)/gi;
const INLINE_CODE_RE = /``(?!`)[^\n]*?``(?!`)|`[^`\n]+`/g;
const XML_TRANSPORT_SPAN_RE =
  /<(itemExam|itemPatch|itemx|skillExam|skillPatch|monsterExam|monsterPatch)\b[^>]*>(?:(?!<\1\b)[\s\S])*?<\/\1\s*>/gi;
const RAW_TAG_RE =
  /<\/?(?:itemExam|itemPatch|itemx|skillExam|skillPatch|monsterExam|monsterPatch)\b|\[(?:itemx|아이템)\s*:/i;
const ANY_FENCE_RE = /^[ \t]*(?:`{3,}|~{3,})/;
// The fence lines the engine removes.
const BARE_FENCE_RE = /^\s*```(?:xml)?\s*$/i;
const MARKER_ONLY_RE = /^(?:\s|<!--(?:ITEMX2|CODEX2):[A-Za-z0-9_-]+-->)*$/;

// A Korean alias line counts as a transport only with an id= or name= field.
export const plainKoreanAlias = (body) => !IDENTITY_FIELD_RE.test(String(body || ''));

function guardBrackets(source) {
  // Inside a complete XML transport the text is a field value: left as it is.
  const spans = [];
  XML_TRANSPORT_SPAN_RE.lastIndex = 0;
  for (let m; (m = XML_TRANSPORT_SPAN_RE.exec(source));) spans.push([m.index, XML_TRANSPORT_SPAN_RE.lastIndex]);
  const inSpan = (at) => spans.some(([start, end]) => at >= start && at < end);
  return source
    .replace(INLINE_CODE_RE, (code, at) =>
      inSpan(at) ? code : code.replace(BRACKET_OPEN_RE, (_, head) => head + GUARD)
    )
    .replace(KOREAN_ALIAS_RE, (raw, head, rest, body, at) =>
      inSpan(at) || !plainKoreanAlias(body) ? raw : head + GUARD + rest
    );
}

function maskFences(source) {
  const lines = source.split('\n');
  const blocks = [];
  let open = null,
    count = 0;
  const token = () => `${FENCE_MARK}${count++}${FENCE_MARK}`;
  for (let index = 0; index < lines.length; index += 1) {
    if (!ANY_FENCE_RE.test(lines[index])) continue;
    const bare = BARE_FENCE_RE.test(lines[index]);
    if (!open) {
      open = { start: index, token: bare ? token() : '', line: lines[index] };
      if (bare) lines[index] = open.token;
      continue;
    }
    // Whether the block held a tag is decided on the original text: an empty
    // fenced block of the story is not ours to remove.
    const tagged = RAW_TAG_RE.test(lines.slice(open.start + 1, index).join('\n'));
    const close = bare ? token() : '';
    if (open.token || close)
      blocks.push({ open: open.token, openLine: open.line, close, closeLine: lines[index], tagged });
    if (bare) lines[index] = close;
    open = null;
  }
  // A fence still open at the end (a reply being streamed).
  if (open?.token)
    blocks.push({
      open: open.token,
      openLine: open.line,
      close: '',
      closeLine: '',
      tagged: RAW_TAG_RE.test(lines.slice(open.start + 1).join('\n'))
    });
  return { text: lines.join('\n'), blocks };
}

function restoreFences(content, blocks) {
  let out = content,
    dropped = false;
  const drop = (token) => {
    out = out.replace(new RegExp(`[ \\t]*${token}[ \\t]*\\n?`), '');
    dropped = true;
  };
  for (const block of blocks) {
    const start = block.open ? out.indexOf(block.open) : -1;
    const end = block.close ? out.indexOf(block.close) : -1;
    // Dropped only when both ends are ours and nothing but cards is left
    // between them.
    const ours = block.tagged && start >= 0 && (block.close ? end > start : true);
    const inner = ours ? out.slice(start + block.open.length, block.close ? end : out.length) : '';
    if (ours && MARKER_ONLY_RE.test(inner)) {
      if (block.close) drop(block.close);
      drop(block.open);
      continue;
    }
    if (start >= 0) out = out.replace(block.open, () => block.openLine);
    if (end >= 0) out = out.replace(block.close, () => block.closeLine);
  }
  return dropped ? out.replace(/\n{3,}/g, '\n\n').trim() : out;
}

export function shieldPlainText(text) {
  const source = String(text || '');
  if (source.includes(GUARD) || source.includes(FENCE_MARK)) return { text: source, restore: (content) => content };
  const guarded = /\[(?:itemx|아이템)\s*:/i.test(source) ? guardBrackets(source) : source;
  const fenced = /```|~~~/.test(guarded) ? maskFences(guarded) : { text: guarded, blocks: [] };
  if (fenced.text === source) return { text: source, restore: (content) => content };
  return {
    text: fenced.text,
    restore: (content) => restoreFences(String(content ?? ''), fenced.blocks).replace(GUARDED_RE, '$1')
  };
}

// Model transport tags (<itemExam>, [itemx: …], …) and transport markers,
// parsed and dropped: nothing of them reaches stored or requested text.
export function stripTransport(text) {
  const shield = shieldPlainText(text);
  const items = Core.extractResponse(shield.text, Core.newRegistry()).content.replace(Core.MARKER_RE, '');
  return shield.restore(
    Codex.extractResponse(items, Codex.snapshot(), { enabledDomains: [] }).content.replace(Codex.MARKER_RE, '')
  );
}

const base36 = (hex) => parseInt(hex, 16).toString(36).padStart(7, '0');

// Keys are derived from content so that repeated passes over the same output
// (each streamed flush, then the final replacer) agree on every anchor. A key
// already taken in this chat is lengthened until it is free.
export function allocateKey(seed, taken) {
  const digest = base36(Core.fnv1a(seed)) + base36(Core.fnv1a(`${seed}#`));
  for (let length = 5; length <= 12; length += 1) {
    const key = digest.slice(0, length);
    if (!taken(key)) return key;
  }
  for (let n = 0; ; n += 1) {
    const key = (digest.slice(0, 8) + n.toString(36)).slice(0, 12);
    if (!taken(key)) return key;
  }
}
