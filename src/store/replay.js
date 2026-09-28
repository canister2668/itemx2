/* Replay: fold the ledger's events in current message order.
 *
 * An event counts only while its anchor is still in the text of the message
 * that owns it. A reroll replaces the text and drops the anchor, so the event
 * goes inactive; a user edit that keeps the anchor keeps it; a deleted message
 * takes its events with it. Manual rows follow the message they were made
 * after, wherever that message now is, or run last when it is gone.
 *
 * The one derived checkpoint (cache entry) holds the state after the first N
 * steps and the chain hash of those steps' identities. It is reused only when
 * the current chat produces the same chain for its first N steps. */
import * as Codex from '../engine/codex.js';
import * as Core from '../engine/core.js';
import * as EntityHistory from '../engine/history.js';
import { anchorKeys } from './anchors.js';

export const CHECKPOINT_VERSION = 1;
// Recent messages are where rerolls and edits happen; the checkpoint stays
// clear of them so it survives ordinary play.
const CHECKPOINT_TAIL_MESSAGES = 30;
const CHECKPOINT_MIN_STEPS = 120;
const CHECKPOINT_STRIDE = 80;

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
const chainNext = (chain, id) => Core.fnv1a(`${chain}|${id}`);

export function emptyState() {
  const codex = Codex.snapshot();
  codex.history = { skill: {}, monster: {} };
  codex.updatedAt = 0;
  return { item: { registry: Core.newRegistry(), history: {} }, codex };
}

function baseState(base) {
  if (!base?.item?.registry || !base?.codex?.skills) return emptyState();
  const state = clone({ item: base.item, codex: base.codex });
  state.item.history ||= {};
  state.codex.history ||= { skill: {}, monster: {} };
  return state;
}

const messageId = (message) => (typeof message?.chatId === 'string' ? message.chatId : '');

// The ordered steps of this chat: which events and manual rows are active now.
// `pending(key)` supplies parsed records of a response not yet committed; they
// count for the message that carries their anchor.
export function steps(chat, doc, pending = null) {
  const messages = Array.isArray(chat?.message) ? chat.message : [];
  const manualAfter = new Map(),
    placed = new Set(),
    out = [];
  for (const row of doc.manual) {
    if (!manualAfter.has(row.a)) manualAfter.set(row.a, []);
    manualAfter.get(row.a).push(row);
  }
  const pushManual = (rows, index) => {
    for (const row of rows || []) {
      if (placed.has(row.id)) continue;
      placed.add(row.id);
      out.push({ id: `m:${row.id}`, manual: row, domain: row.d, event: row.e, review: row.r, index });
    }
  };
  pushManual(manualAfter.get(''), -1);
  const seen = new Set();
  messages.forEach((message, index) => {
    const chatId = messageId(message);
    for (const key of anchorKeys(Core.messageText(message))) {
      const row = doc.events[key] || pendingRow(pending, key, chatId);
      if (!row || row.c !== chatId || seen.has(key)) continue;
      seen.add(key);
      out.push({ id: `e:${chatId}:${key}`, key, domain: row.d, event: row.e, review: row.r, index, chatId });
    }
    if (chatId) pushManual(manualAfter.get(chatId), index);
  });
  // Rows whose message is gone still happened: they run last, in their order.
  pushManual(
    doc.manual.filter((row) => !placed.has(row.id)).sort((a, b) => (a.s || 0) - (b.s || 0)),
    messages.length - 1
  );
  return out;
}

function pendingRow(pending, key, chatId) {
  const record = pending?.(key);
  return record?.event
    ? { c: chatId, d: record.domain === 'item' ? 'item' : 'codex', e: record.event, r: record.review }
    : null;
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
      EntityHistory.observe(history, domain, prior.get(key), entries[key], event, step.index, step.id);
  }
  return {
    domain,
    view: view == null ? null : clone(view),
    previous: domain === 'item' ? Core.comparisonView(prior.get(id)) : prior.get(id) || null
  };
}

// Folds the chat. `checkpoint` (from the cache) is used when its chain still
// matches; `full` forces a fold from the start so every step has its view.
export function fold(chat, doc, { checkpoint = null, full = false, pending = null } = {}) {
  const list = steps(chat, doc, pending);
  const messages = Array.isArray(chat?.message) ? chat.message : [];
  const baseChain = Core.fnv1a(`base:${doc.base ? Core.fnv1a(JSON.stringify(doc.base)) : ''}`);
  const chains = new Array(list.length + 1);
  chains[0] = baseChain;
  for (let index = 0; index < list.length; index += 1) chains[index + 1] = chainNext(chains[index], list[index].id);
  let start = 0,
    state;
  const usable =
    !full &&
    checkpoint?.v === CHECKPOINT_VERSION &&
    Number.isInteger(checkpoint.steps) &&
    checkpoint.steps > 0 &&
    checkpoint.steps <= list.length &&
    checkpoint.chain === chains[checkpoint.steps] &&
    checkpoint.item?.registry?.items &&
    checkpoint.codex?.skills?.entries;
  if (usable) {
    state = clone({ item: checkpoint.item, codex: checkpoint.codex });
    start = checkpoint.steps;
  } else state = baseState(doc.base);
  // A new checkpoint candidate sits before the recent tail of the chat.
  const tailFrom = Math.max(0, messages.length - CHECKPOINT_TAIL_MESSAGES);
  let cut = list.findIndex((step) => step.index >= tailFrom);
  if (cut < 0) cut = list.length;
  const wantCheckpoint =
    cut >= CHECKPOINT_MIN_STEPS && cut >= start && (!usable || cut - checkpoint.steps >= CHECKPOINT_STRIDE);
  let candidate = null;
  const views = new Map();
  for (let index = start; index < list.length; index += 1) {
    if (wantCheckpoint && index === cut)
      candidate = {
        v: CHECKPOINT_VERSION,
        steps: cut,
        chain: chains[cut],
        item: clone(state.item),
        codex: clone(state.codex)
      };
    const step = list[index];
    const result = applyStep(state, step);
    views.set(step.key ? `e:${step.key}` : step.id, {
      ...result,
      event: step.event,
      review: step.review,
      index: step.index,
      manual: step.manual || null
    });
  }
  if (wantCheckpoint && !candidate && cut === list.length)
    candidate = {
      v: CHECKPOINT_VERSION,
      steps: cut,
      chain: chains[cut],
      item: clone(state.item),
      codex: clone(state.codex)
    };
  return {
    item: state.item,
    codex: state.codex,
    views,
    steps: list.length,
    complete: start === 0,
    chain: chains[list.length],
    checkpoint: candidate
  };
}
