/* Replay: the ITEMX state of the loaded part of a chat.
 *
 * The host may hold only the newest messages of a chat in memory. Each
 * committed message with card anchors therefore leaves a state entry in the
 * ledger: the full state after it, found again by its exact, ordered list of
 * card anchor keys (message text, so it survives chat copies). The fold starts
 * from the newest entry that is still valid and replays only what follows:
 *
 *   present   a loaded message carries exactly the entry's keys
 *   unloaded  absent, and sent before the first loaded message
 *   gone      otherwise: rerolled, deleted or its anchors edited
 *
 * Manual rows are placed by the time they were made, after the last loaded
 * message sent before them. Deleting or editing an older message no longer
 * changes the state: a later entry already holds it ("the past is settled"). */
import * as Codex from '../engine/codex.js';
import * as Core from '../engine/core.js';
import * as EntityHistory from '../engine/history.js';
import { anchorKeys } from './anchors.js';

export const ENTRY_LIMIT = 8;

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
const messageId = (message) => (typeof message?.chatId === 'string' ? message.chatId : '');
const sendTime = (message) => (Number.isFinite(message?.time) && message.time > 0 ? message.time : 0);
// Card keys and send time of each loaded message, read once per pass.
function layoutOf(messages) {
  const keys = messages.map((message) => anchorKeys(Core.messageText(message)));
  keys.sent = messages.map(sendTime);
  keys.ids = messages.map(messageId);
  return keys;
}

export function emptyState() {
  const codex = Codex.snapshot();
  codex.history = { skill: {}, monster: {} };
  codex.updatedAt = 0;
  return { item: { registry: Core.newRegistry(), history: {} }, codex, notes: {} };
}

function stateFrom(stored) {
  if (!stored?.item?.registry || !stored?.codex?.skills) return emptyState();
  const state = clone({ item: stored.item, codex: stored.codex, notes: stored.notes || {} });
  state.item.history ||= {};
  state.codex.history ||= { skill: {}, monster: {} };
  return state;
}

// The host's paged window: messages before `offset` exist but are not loaded.
export function windowOffset(chat) {
  const offset = Number(chat?.messageOffset);
  return chat?.messagesFullyLoaded === false && Number.isSafeInteger(offset) && offset > 0 ? offset : 0;
}

const isUser = (message) => /^(?:user|human)$/i.test(String(message?.role || ''));

// Completed user turns through each loaded message: a user message followed
// by a non-empty, finished assistant reply. A window that starts with a reply
// had its user message before the window.
export function turnCounts(chat) {
  const messages = Array.isArray(chat?.message) ? chat.message : [];
  const counts = [];
  let count = 0,
    pending = windowOffset(chat) > 0;
  messages.forEach((message, index) => {
    if (!message?.isComment) {
      if (isUser(message)) pending = true;
      else if (
        pending &&
        ['char', 'assistant'].includes(message?.role) &&
        !message.isStreaming &&
        !(chat.isStreaming && index === messages.length - 1) &&
        String(message.data ?? message.content ?? '').trim()
      ) {
        count += 1;
        pending = false;
      }
    }
    counts.push(count);
  });
  return counts;
}

// Send time of each loaded message. One without (some user messages) takes
// the time of the message before it, or of the first timed one at the start.
function messageTimes(messages) {
  const times = messages.map((message) => (Number.isFinite(message?.time) && message.time > 0 ? message.time : 0));
  let carry = times.find(Boolean) || 0;
  return times.map((time) => (time ? (carry = time) : carry));
}

const sameKeys = (a, b) => a.length === b.length && a.every((key, index) => key === b[index]);

// The one loaded message sent at `time`, or -1 (none, or several).
function sentAt(layout, time) {
  if (!(time > 0)) return -1;
  const first = layout.sent.indexOf(time);
  return first >= 0 && layout.sent.indexOf(time, first + 1) < 0 ? first : -1;
}

// The loaded message an entry belongs to, or -1: the one carrying exactly its
// card keys, or, for the entry of a reply whose cards were all removed, the
// card-less message with its send time, else with its id.
export function entryPosition(entry, layout) {
  const keys = Array.isArray(entry?.k) ? entry.k : [];
  if (keys.length) {
    for (let index = layout.length - 1; index >= 0; index -= 1) if (sameKeys(layout[index], keys)) return index;
    return -1;
  }
  let at = sentAt(layout, entry?.w);
  if (at < 0 && entry?.c) at = layout.ids.lastIndexOf(entry.c);
  return at >= 0 && !layout[at].length ? at : -1;
}

// The loaded message whose cards changed since its entry was made, or -1: one
// still holding any of the entry's keys, else the one with its send time
// (only when no other message shares it), else the one with its id.
export function ownerPosition(entry, layout) {
  const keys = entry?.k || [];
  if (keys.length)
    for (let index = layout.length - 1; index >= 0; index -= 1)
      if (keys.some((key) => layout[index].includes(key))) return index;
  const byTime = sentAt(layout, entry?.w);
  if (byTime >= 0) return byTime;
  return entry?.c ? layout.ids.lastIndexOf(entry.c) : -1;
}

// An absent entry may still stand in a message the host has not loaded: one
// sent before the first loaded message. Send time survives deletions and
// copies; the absolute index is the fallback for a message without one.
export function windowStart(chat) {
  const messages = Array.isArray(chat?.message) ? chat.message : [];
  return { offset: windowOffset(chat), time: messageTimes(messages)[0] || 0 };
}
export function beforeWindow(entry, start) {
  if (!start.offset) return false;
  if (start.time && Number.isFinite(entry?.w) && entry.w > 0) return entry.w < start.time;
  return Number.isSafeInteger(entry?.i) && entry.i < start.offset;
}
// An absent entry proven gone: the chat is fully loaded, or its send time
// falls inside the window. An index alone may be stale and proves nothing, so
// such an entry is kept.
function provenGone(entry, start) {
  if (!start.offset) return true;
  return Boolean(start.time && Number.isFinite(entry?.w) && entry.w > 0 && entry.w >= start.time);
}

// The newest valid entry at or before local message `upTo`: `position` is its
// loaded message, or -1 when it lies before the window.
function findBase(doc, layout, start, upTo) {
  const entries = Array.isArray(doc.states) ? doc.states : [];
  for (let at = entries.length - 1; at >= 0; at -= 1) {
    const entry = entries[at];
    const position = entryPosition(entry, layout);
    if (position >= 0) {
      if (position > upTo) continue;
      return { entry, position };
    }
    if (beforeWindow(entry, start)) return { entry, position: -1 };
  }
  return null;
}

function applyStep(state, step) {
  const { event } = step;
  const domain = step.domain === 'item' ? 'item' : event.domain;
  if (domain !== 'item' && !['skill', 'monster'].includes(domain)) return { view: null, previous: null, domain };
  const engine = domain === 'item' ? Core : Codex;
  const entries = domain === 'item' ? state.item.registry.items : Codex.storeFor(state.codex, domain).entries;
  const patch = event.patch || {};
  const id = event.item?.id || event.entity?.id || patch.id;
  const ids = [
    ...new Set(
      [
        id,
        patch.equip,
        patch.unequip,
        ...(patch.inputs || []).map((x) => x.id),
        ...(patch.outputs || []).map((x) => x.id)
      ].filter(Boolean)
    )
  ];
  const prior = new Map(ids.map((key) => [key, entries[key] ? clone(entries[key]) : null]));
  const view = engine.applyEvent(domain === 'item' ? state.item.registry : state.codex, event);
  if (view != null) {
    const history = domain === 'item' ? state.item.history : state.codex.history[domain];
    for (const key of ids)
      EntityHistory.observe(history, domain, prior.get(key), entries[key], event, step.turn, step.id);
  }
  const result = {
    domain,
    view: view == null ? null : clone(view),
    previous: domain === 'item' ? Core.comparisonView(prior.get(id)) : prior.get(id) || null
  };
  if (result.view) note(state.notes, domain, step, result);
  return result;
}

// The drawer's change and review annotations: the latest previous view and
// review of each entity, carried inside the state. `evidence` names the card
// anchor (copy-safe) and the message whose text a repair may read.
function note(notes, domain, step, result) {
  const entity = result.view.id || step.event?.item?.id || step.event?.patch?.id;
  if (!entity) return;
  const key = `${domain}:${entity}`;
  const prior = notes[key];
  const review = { ...step.review };
  if (step.manual) {
    review.missing = step.review?.source === 'auxiliary' ? step.review.missing || [] : [];
    review.checked = step.review?.source === 'auxiliary' ? Boolean(step.review.checked) : false;
  } else if (prior?.review?.missing?.length && !step.review?.checked) {
    review.missing = prior.review.missing;
    review.evidence = prior.review.evidence ?? prior.evidence;
  }
  notes[key] = {
    previous: clone(result.previous),
    review,
    evidence: { key: step.key || '', chatId: step.chatId ?? step.manual?.a ?? '' }
  };
}

function pendingRow(pending, key, chatId) {
  const record = pending?.(key);
  return record?.event
    ? { c: chatId, d: record.domain === 'item' ? 'item' : 'codex', e: record.event, r: record.review }
    : null;
}

// Folds the loaded chat, optionally only through local message `upTo`, and
// reports the state just before that message (`before`). `from: { x, m, t,
// index }` replays from a known state before message `index` instead of an
// entry: a message is recomputed on the state it was first built on, so what
// lay before it stays settled even when older messages are gone.
export function fold(chat, doc, { pending = null, upTo = null, from = null } = {}) {
  const messages = Array.isArray(chat?.message) ? chat.message : [];
  const last = Number.isInteger(upTo) ? Math.min(upTo, messages.length - 1) : messages.length - 1;
  const keysByMessage = layoutOf(messages);
  const span = windowStart(chat);
  const counts = turnCounts(chat);
  const times = messageTimes(messages);
  const base = from ? { entry: from } : findBase(doc, keysByMessage, span, last);
  let state, included, start, baseTurn;
  if (from) {
    state = stateFrom(from.x);
    included = new Set(from.m || []);
    start = from.index;
    baseTurn = (from.t || 0) - (from.index > 0 ? counts[from.index - 1] || 0 : 0);
  } else if (base) {
    state = stateFrom(base.entry.x);
    included = new Set(base.entry.m || []);
    start = base.position + 1;
    // Turns between an unloaded entry and the window are not loaded; two
    // messages make one turn.
    baseTurn =
      base.position >= 0
        ? (base.entry.t || 0) - (counts[base.position] || 0)
        : (base.entry.t || 0) + Math.max(0, Math.floor((span.offset - base.entry.i - 1) / 2));
  } else if (doc.root) {
    // A restored backup. Messages before it lost their anchors and events, so
    // replaying them adds nothing; only the turn count needs its position.
    state = stateFrom(doc.root.x);
    included = new Set(doc.root.m || []);
    start = 0;
    let through = Number.isSafeInteger(doc.root.i) ? doc.root.i - span.offset : -1;
    if (times.some(Boolean) && doc.root.w) {
      through = -1;
      for (let index = 0; index < messages.length; index += 1) if (times[index] <= doc.root.w) through = index;
    }
    // A restore before the window: the turns between it and the window are
    // not loaded; two messages make one turn, as for an unloaded entry.
    const unloaded =
      through < 0 && span.offset && Number.isSafeInteger(doc.root.i)
        ? Math.max(0, Math.floor((span.offset - doc.root.i - 1) / 2))
        : 0;
    baseTurn = (doc.root.t || 0) + unloaded - (through >= 0 ? counts[through] || 0 : 0);
  } else {
    state = emptyState();
    included = new Set();
    start = 0;
    baseTurn = 0;
  }
  const turnAt = (index) => baseTurn + (index >= 0 ? counts[index] || 0 : 0);
  let turn = turnAt(start - 1);
  const views = new Map();
  const applied = [...included];
  const ids = [base ? `s:${base.entry.k?.join(',')}` : `r:${doc.root ? doc.root.w || 1 : 0}`];
  const run = (step) => {
    const result = applyStep(state, step);
    views.set(step.key ? `e:${step.key}` : step.id, {
      ...result,
      event: step.event,
      review: step.review,
      manual: step.manual || null
    });
    ids.push(step.id);
  };
  // Manual rows by the time they were made: after the last loaded message
  // sent before them. Rows before the replayed span run right after the base.
  const leading = [],
    after = new Map();
  for (const row of doc.manual || []) {
    if (included.has(row.s)) continue;
    let at = row.a ? messages.findIndex((message) => messageId(message) === row.a) : -1;
    if (at < 0 && row.a) {
      // Its message is gone or not loaded. By time when the chat has send
      // times; otherwise after every message, as it happened last.
      if (times.some(Boolean) && Number.isFinite(row.t)) {
        for (let index = 0; index < messages.length; index += 1) if (times[index] <= row.t) at = index;
      } else at = messages.length - 1;
    }
    if (at > last) continue;
    if (at < start) leading.push(row);
    else {
      if (!after.has(at)) after.set(at, []);
      after.get(at).push(row);
    }
  }
  const bySeq = (a, b) => (a.s || 0) - (b.s || 0);
  const manualStep = (row) => {
    applied.push(row.s);
    run({ id: `m:${row.id}`, manual: row, domain: row.d, event: row.e, review: row.r, turn });
  };
  for (const row of leading.sort(bySeq)) manualStep(row);
  const seen = new Set();
  let before = null;
  for (let index = start; index <= last; index += 1) {
    const message = messages[index];
    const chatId = messageId(message);
    if (index === last)
      before = { x: clone({ item: state.item, codex: state.codex, notes: state.notes }), m: [...applied], t: turn };
    turn = turnAt(index);
    for (const key of keysByMessage[index]) {
      const row = doc.events[key] || pendingRow(pending, key, chatId);
      if (!row || seen.has(key)) continue;
      seen.add(key);
      run({ id: `e:${key}`, key, chatId, domain: row.d, event: row.e, review: row.r, turn });
    }
    for (const row of (after.get(index) || []).sort(bySeq)) manualStep(row);
  }
  return {
    item: state.item,
    codex: state.codex,
    notes: state.notes,
    views,
    turn: turnAt(last),
    manual: applied,
    before,
    // The fold starts from facts that cover everything before the window.
    grounded: Boolean(base || doc.root || !span.offset),
    chain: Core.fnv1a(ids.join('|'))
  };
}

function entryOf(chat, index, folded) {
  const message = chat.message[index];
  return {
    k: anchorKeys(Core.messageText(message)),
    c: messageId(message),
    i: windowOffset(chat) + index,
    w: Number.isFinite(message?.time) ? message.time : 0,
    t: folded.turn,
    m: folded.manual,
    x: { item: folded.item, codex: folded.codex, notes: folded.notes },
    // The state the message was built on; see restampEntries.
    b: folded.before
  };
}

const committed = (keys, doc) => keys.length > 0 && keys.every((key) => doc.events[key]);

// Entries are stored with `b`, the state their message was built on. Its
// state part is left out when it equals the previous entry's state (the usual
// case), so the ledger holds little more than one state per entry.
function expand(entries) {
  let previous = null;
  for (const entry of entries) {
    if (entry.b && !entry.b.x && previous) entry.b = { ...entry.b, x: previous.x };
    previous = entry;
  }
  return entries;
}
function compact(entries) {
  return entries.map((entry, index) => {
    const prior = entries[index - 1];
    if (!entry.b?.x || !prior || JSON.stringify(entry.b.x) !== JSON.stringify(prior.x)) return entry;
    const { x: _shared, ...rest } = entry.b;
    void _shared;
    return { ...entry, b: rest };
  });
}

// Recomputes, in place on `doc`, the state entries of local message `from`
// and of every later message with card anchors (keeping the newest
// ENTRY_LIMIT), and drops entries proven gone. Message `from` is rebuilt on
// the state its earlier entry was built on (`b`), so a continue, a recovery or
// an edit, even one removing every card, never loses what older, since
// deleted messages left behind. A window that cannot ground the state changes
// nothing: a partial replay never becomes an entry. Returns the card views the
// recomputation produced, or null.
export function restampEntries(chat, doc, from) {
  const messages = Array.isArray(chat?.message) ? chat.message : [];
  const start = windowStart(chat);
  const layout = layoutOf(messages);
  const first = Math.max(0, from);
  let own = null;
  const kept = expand(Array.isArray(doc.states) ? doc.states : []).filter((entry) => {
    const position = entryPosition(entry, layout);
    if (position >= first) {
      if (position === first) own = entry;
      return false;
    }
    if (position >= 0) {
      entry.i = start.offset + position;
      return true;
    }
    const owner = ownerPosition(entry, layout);
    if (owner === first && first < messages.length) {
      own = entry;
      return false;
    }
    return owner < 0 && !provenGone(entry, start);
  });
  const next = { ...doc, states: kept };
  const keys = layout[first] || [];
  const rebuild = own?.b?.x && (committed(keys, doc) || !keys.length) ? own.b : null;
  if (!rebuild && !fold(chat, next, { upTo: first - 1 }).grounded) return null;
  const stamped = [];
  for (let index = first; index < messages.length; index += 1)
    if (committed(layout[index], doc) || (rebuild && index === first)) stamped.push(index);
  // Only the newest entries are kept; the first one computed still replays,
  // and so freezes, every card before it.
  const views = new Map();
  for (const index of stamped.slice(-ENTRY_LIMIT)) {
    const folded =
      rebuild && index === first
        ? fold(chat, next, { upTo: index, from: { ...rebuild, index } })
        : fold(chat, next, { upTo: index });
    for (const [key, view] of folded.views) views.set(key, view);
    next.states.push(entryOf(chat, index, folded));
  }
  doc.states = compact(next.states.sort((a, b) => a.i - b.i).slice(-ENTRY_LIMIT));
  return views;
}

// Where a commit pass with no new card must restamp, or -1. Entries owe a
// rewrite when the newest message with cards has none and the window can
// ground one (a chat from before state entries), when a message's cards
// changed since its entry (rebuilt on that entry's base), or when an entry is
// proven gone (a reroll or deletion). Restamping from the returned index
// clears every condition, so a pass writes at most once.
export function stampStart(chat, doc) {
  const messages = Array.isArray(chat?.message) ? chat.message : [];
  const layout = layoutOf(messages);
  const start = windowStart(chat);
  const entries = expand(doc.states || []);
  let from = Infinity;
  for (const entry of entries) {
    if (entryPosition(entry, layout) >= 0) continue;
    const owner = ownerPosition(entry, layout);
    if (owner >= 0 && entry.b?.x) from = Math.min(from, owner);
    else if (owner >= 0 || provenGone(entry, start)) from = Math.min(from, messages.length);
  }
  let newest = layout.length - 1;
  while (newest >= 0 && !layout[newest].length) newest -= 1;
  if (
    newest >= 0 &&
    newest < from &&
    committed(layout[newest], doc) &&
    !entries.some((entry) => entryPosition(entry, layout) === newest) &&
    fold(chat, doc, { upTo: newest - 1 }).grounded
  )
    from = newest;
  return from === Infinity ? -1 : from;
}
