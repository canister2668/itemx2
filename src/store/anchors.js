/* Card anchors in message text. A stored message carries only a short comment
 * per card position, `<!--ix:k7f2q-->`; everything the card shows lives in
 * the chat's ledger document under that key. */
import * as Codex from '../engine/codex.js';
import * as Core from '../engine/core.js';

export const ANCHOR_RE = /<!--ix:([0-9a-z]{4,12})-->/g;
const ANCHOR_TEST_RE = /<!--ix:[0-9a-z]{4,12}-->/;

// Markers written by ITEMX 2.0 – 2.3. Their data is not carried over; they are
// hidden from display, stripped from model requests, and removable on demand.
export const OLD_MARKER_RE = /<!--(?:ITEMX2|CODEX2)(?::[A-Za-z0-9_-]+|@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?)-->/g;
const OLD_MARKER_TEST_RE = /<!--(?:ITEMX2|CODEX2)[:@]/;

// Transport markers the parsers emit while turning model tags into events.
// They exist only inside one processing pass and never reach message text.
export const TRANSPORT_MARKER_RE = /<!--(ITEMX2|CODEX2):([A-Za-z0-9_-]+)-->/g;

export const anchor = (key) => `<!--ix:${key}-->`;
export const hasAnchor = (text) => ANCHOR_TEST_RE.test(String(text || ''));
export const hasOldMarker = (text) => OLD_MARKER_TEST_RE.test(String(text || ''));

export function anchorKeys(text) {
  return [...String(text || '').matchAll(ANCHOR_RE)].map((match) => match[1]);
}

export const countOldMarkers = (text) => (String(text || '').match(OLD_MARKER_RE) || []).length;

const tidy = (text) => text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

export const stripAnchors = (text) => String(text || '').replace(ANCHOR_RE, '');
export const stripOldMarkers = (text) => String(text || '').replace(OLD_MARKER_RE, '');

// What the model sees of a stored message: no anchors, no old markers.
export function requestText(text) {
  const source = String(text || '');
  if (!hasAnchor(source) && !hasOldMarker(source)) return source;
  return tidy(stripOldMarkers(stripAnchors(source)));
}

// Model transport tags (<itemExam>, [itemx: …], …) and transport markers,
// parsed and dropped: nothing of them reaches stored or requested text.
export function stripTransport(text) {
  const items = Core.extractResponse(String(text || ''), Core.newRegistry()).content.replace(Core.MARKER_RE, '');
  return Codex.extractResponse(items, Codex.snapshot(), { enabledDomains: [] }).content.replace(Codex.MARKER_RE, '');
}

export function removeOldMarkers(text) {
  const source = String(text || '');
  return hasOldMarker(source) ? tidy(stripOldMarkers(source)) : source;
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
