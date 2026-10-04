/* The chat's authoritative ITEMX document, one scriptstate entry.
 *
 * Key `itemx:ledger`, schema `v: 2`.
 *
 *   events  anchor key -> { c: owning message chatId, d: 'item' | 'codex',
 *                           e: event, r?: review, s: sequence,
 *                           v?: card view, p?: previous view (frozen at commit) }
 *   manual  [{ id, a: chatId the row follows ('' = before the first message),
 *              d, e, l: label, r?, s, t: time }]
 *   states  state entries, oldest first: { k: card anchor keys of the message,
 *           c: its chat id, i: absolute index, w: send time, t: completed turns, m: manual
 *           seqs included, x: full state after the message, b: the state it
 *           was built on (b.x omitted when equal to the previous entry's x) }
 *   root    { x, m, w, i, t } written by a backup restore (state, manual seqs,
 *           send time and index of the newest message then, turn), or null
 *   restoredThrough  last message chatId covered by that restore
 *   prefs   record-list preferences (display policy only)
 *   lore    lorebook enrichment ledger
 *   guards  aux: chatId -> processed record
 *
 * A 2.4 document (v1) is read with its events and manual rows; its restored
 * base is not carried over. */
import * as EntityHistory from '../engine/history.js';
import * as Lorebook from '../engine/lorebook.js';

export const DOCUMENT_KEY = 'itemx:ledger';
export const VERSION = 2;

const object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function emptyDocument() {
  return {
    v: VERSION,
    seq: 0,
    events: {},
    manual: [],
    states: [],
    root: null,
    restoredThrough: '',
    prefs: EntityHistory.preferences(null),
    lore: Lorebook.emptyLedger(),
    guards: { aux: {} }
  };
}

// An entry is found by its card keys, or by send time (else id) once its
// cards are gone.
const validEntry = (entry) =>
  object(entry) &&
  Array.isArray(entry.k) &&
  (entry.k.length > 0 || entry.w > 0 || typeof entry.c === 'string') &&
  object(entry.x) &&
  Array.isArray(entry.m || []);

// A malformed document is surfaced, never replaced: writing over it would
// discard facts that cannot be rebuilt.
export function readDocument(chat) {
  const raw = chat?.scriptstate?.[DOCUMENT_KEY];
  if (raw == null || raw === '') return emptyDocument();
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (![1, VERSION].includes(value?.v) || !object(value.events) || !Array.isArray(value.manual))
    throw new Error('ITEMX ledger document is invalid');
  for (const [key, row] of Object.entries(value.events))
    if (!/^[0-9a-z]{4,12}$/.test(key) || !row?.e?.kind || typeof row.c !== 'string')
      throw new Error('ITEMX ledger document is invalid');
  return {
    v: VERSION,
    seq: Number.isSafeInteger(value.seq) ? value.seq : 0,
    events: value.events,
    manual: value.manual.filter((row) => row?.e?.kind && typeof row.a === 'string'),
    states: Array.isArray(value.states) ? value.states.filter(validEntry) : [],
    root: object(value.root) && object(value.root.x) ? value.root : null,
    restoredThrough: typeof value.restoredThrough === 'string' ? value.restoredThrough : '',
    prefs: EntityHistory.preferences(value.prefs),
    lore: Lorebook.read(value.lore),
    guards: { aux: object(value.guards?.aux) ? value.guards.aux : {} }
  };
}

// The chat with `doc` stored. Messages are shared with `chat`: only
// scriptstate is replaced.
export function withDocument(chat, doc) {
  return { ...chat, scriptstate: { ...(chat?.scriptstate || {}), [DOCUMENT_KEY]: JSON.stringify(doc) } };
}

// Bytes this chat spends on the ITEMX document.
export function footprint(chat) {
  const value = chat?.scriptstate?.[DOCUMENT_KEY];
  if (value == null) return { stateBytes: 0 };
  return { stateBytes: new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length };
}
