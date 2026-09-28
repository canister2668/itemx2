/* The chat's authoritative ITEMX document, one scriptstate entry.
 *
 * Key `itemx:ledger`, schema `v: 1`. ITEMX 2.2 – 2.3 kept `itemx:log` (and
 * `$__itemx2_*` DTOs); those are neither read nor overwritten, so a chat opened
 * by 2.4 still works if the plugin is rolled back.
 *
 *   events  anchor key -> { c: owning message chatId, d: 'item' | 'codex',
 *                           e: event, r?: review, s: sequence }
 *   manual  [{ id, a: chatId the row follows ('' = before the first message),
 *              d, e, l: label, r?, s, t: time }]
 *   base    restored backup state folded before every message, or null
 *   restoredThrough  last message chatId covered by that restore
 *   prefs   record-list preferences (display policy only)
 *   lore    lorebook enrichment ledger
 *   guards  aux: chatId -> processed record (authoritative, never cache)
 *
 * Nothing derived is stored here; replay views and checkpoints live in the
 * cache entry, which may be discarded at any time. */
import * as EntityHistory from '../engine/history.js';
import * as Lorebook from '../engine/lorebook.js';

export const DOCUMENT_KEY = 'itemx:ledger';
export const CACHE_KEY = 'itemx:ledger-cache';
export const VERSION = 1;

// Keys of earlier ITEMX versions, removed only by the explicit cleanup actions.
export const OLD_KEYS = [
  'itemx:log',
  'itemx:prefs',
  'itemx:cache',
  '$__itemx2_state',
  '$__itemx2_chat_id',
  '$__itemx2_codex_state',
  '$__itemx2_manual_events',
  '$__itemx2_message_events',
  '$__itemx2_checkpoint',
  '$__itemx2_aux_processed',
  '$__itemx2_lore_enrichment',
  '$__itemx2_history_preferences'
];

const object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function emptyDocument() {
  return {
    v: VERSION,
    seq: 0,
    events: {},
    manual: [],
    base: null,
    restoredThrough: '',
    prefs: EntityHistory.preferences(null),
    lore: Lorebook.emptyLedger(),
    guards: { aux: {} }
  };
}

// A malformed document is surfaced, never replaced: writing over it would
// discard facts that cannot be rebuilt.
export function readDocument(chat) {
  const raw = chat?.scriptstate?.[DOCUMENT_KEY];
  if (raw == null || raw === '') return emptyDocument();
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (value?.v !== VERSION || !object(value.events) || !Array.isArray(value.manual))
    throw new Error('ITEMX ledger document is invalid');
  for (const [key, row] of Object.entries(value.events))
    if (!/^[0-9a-z]{4,12}$/.test(key) || !row?.e?.kind || typeof row.c !== 'string')
      throw new Error('ITEMX ledger document is invalid');
  return {
    v: VERSION,
    seq: Number.isSafeInteger(value.seq) ? value.seq : 0,
    events: value.events,
    manual: value.manual.filter((row) => row?.e?.kind && typeof row.a === 'string'),
    base: object(value.base) ? value.base : null,
    restoredThrough: typeof value.restoredThrough === 'string' ? value.restoredThrough : '',
    prefs: EntityHistory.preferences(value.prefs),
    lore: Lorebook.read(value.lore),
    guards: { aux: object(value.guards?.aux) ? value.guards.aux : {} }
  };
}

// The chat with `doc` (and optionally a derived cache) stored. Messages are
// shared with `chat`: only scriptstate is replaced.
export function withDocument(chat, doc, cache = undefined) {
  const scriptstate = { ...(chat?.scriptstate || {}), [DOCUMENT_KEY]: JSON.stringify(doc) };
  if (cache === null) delete scriptstate[CACHE_KEY];
  else if (cache !== undefined) scriptstate[CACHE_KEY] = JSON.stringify(cache);
  return { ...chat, scriptstate };
}

export function readCache(chat) {
  try {
    const raw = chat?.scriptstate?.[CACHE_KEY];
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return object(value) ? value : null;
  } catch {
    return null;
  }
}

// Bytes this chat spends on ITEMX data: the document, its cache and anchors.
export function footprint(chat) {
  const encoder = new TextEncoder();
  const bytes = (value) => encoder.encode(typeof value === 'string' ? value : JSON.stringify(value ?? '')).length;
  const state = chat?.scriptstate || {};
  let stateBytes = 0;
  for (const key of [DOCUMENT_KEY, CACHE_KEY]) if (key in state) stateBytes += bytes(state[key]);
  let oldBytes = 0;
  for (const key of OLD_KEYS) if (key in state) oldBytes += bytes(state[key]);
  return { stateBytes, oldBytes };
}
